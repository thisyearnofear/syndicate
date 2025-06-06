"use client";

import {
  Implementation,
  MetaMaskSmartAccount,
  toMetaMaskSmartAccount,
} from "@metamask/delegation-toolkit";
import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { http } from "viem";
import {
  createBundlerClient,
  createPaymasterClient,
} from "viem/account-abstraction";

export interface SmartAccountState {
  smartAccount: MetaMaskSmartAccount<Implementation> | null;
  isLoading: boolean;
  error: string | null;
  isDeployed: boolean;
  bundlerClient: any;
  paymasterClient: any;
  pimlicoClient: any;
}

export function useSmartAccount(): SmartAccountState {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  
  const [smartAccount, setSmartAccount] = useState<MetaMaskSmartAccount<Implementation> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeployed, setIsDeployed] = useState(false);
  const [bundlerClient, setBundlerClient] = useState<any>(null);
  const [paymasterClient, setPaymasterClient] = useState<any>(null);
  const [pimlicoClient, setPimlicoClient] = useState<any>(null);

  // Initialize Pimlico clients
  useEffect(() => {
    const pimlicoKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY;
    
    if (!pimlicoKey || !publicClient) return;

    try {
      const chainId = publicClient.chain.id;
      
      const bundler = createBundlerClient({
        transport: http(
          `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoKey}`
        ),
      });

      const paymaster = createPaymasterClient({
        transport: http(
          `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoKey}`
        ),
      });

      const pimlico = createPimlicoClient({
        transport: http(
          `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoKey}`
        ),
      });

      setBundlerClient(bundler);
      setPaymasterClient(paymaster);
      setPimlicoClient(pimlico);
    } catch (err) {
      console.error("Failed to initialize Pimlico clients:", err);
      setError("Failed to initialize account abstraction services");
    }
  }, [publicClient]);

  // Create smart account
  useEffect(() => {
    if (!address || !walletClient || !publicClient || !isConnected) {
      setSmartAccount(null);
      setIsDeployed(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const createSmartAccount = async () => {
      try {
        console.log("Creating smart account for:", address);

        const account = await toMetaMaskSmartAccount({
          client: publicClient,
          implementation: Implementation.Hybrid,
          deployParams: [address, [], [], []],
          deploySalt: "0x",
          signatory: { walletClient },
        });

        setSmartAccount(account);

        // Check if account is deployed
        const code = await publicClient.getCode({ address: account.address });
        setIsDeployed(code !== undefined && code !== "0x");

        console.log("Smart account created:", account.address);
        console.log("Is deployed:", code !== undefined && code !== "0x");
      } catch (err) {
        console.error("Failed to create smart account:", err);
        setError(err instanceof Error ? err.message : "Failed to create smart account");
      } finally {
        setIsLoading(false);
      }
    };

    createSmartAccount();
  }, [address, walletClient, publicClient, isConnected]);

  return {
    smartAccount,
    isLoading,
    error,
    isDeployed,
    bundlerClient,
    paymasterClient,
    pimlicoClient,
  };
}

// Hook for gasless transactions
export function useGaslessTransaction() {
  const { smartAccount, bundlerClient, paymasterClient, pimlicoClient, isDeployed } = useSmartAccount();
  const [isExecuting, setIsExecuting] = useState(false);

  const executeGaslessTransaction = async (calls: any[]) => {
    if (!smartAccount || !bundlerClient || !paymasterClient || !pimlicoClient) {
      throw new Error("Smart account infrastructure not ready");
    }

    setIsExecuting(true);
    try {
      // Get gas prices
      const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

      // Send user operation
      const userOperationHash = await bundlerClient.sendUserOperation({
        account: smartAccount,
        calls,
        paymaster: paymasterClient,
        ...fee,
      });

      // Wait for receipt
      const { receipt } = await bundlerClient.waitForUserOperationReceipt({
        hash: userOperationHash,
      });

      return { userOperationHash, receipt };
    } finally {
      setIsExecuting(false);
    }
  };

  return {
    executeGaslessTransaction,
    isExecuting,
    canExecuteGasless: !!smartAccount && !!bundlerClient && !!paymasterClient,
  };
}

// Hook for deploying smart account
export function useDeploySmartAccount() {
  const { smartAccount, bundlerClient, paymasterClient, pimlicoClient, isDeployed } = useSmartAccount();
  const [isDeploying, setIsDeploying] = useState(false);

  const deploySmartAccount = async () => {
    if (!smartAccount || !bundlerClient || !paymasterClient || !pimlicoClient) {
      throw new Error("Smart account infrastructure not ready");
    }

    if (isDeployed) {
      throw new Error("Smart account already deployed");
    }

    setIsDeploying(true);
    try {
      const { fast: fee } = await pimlicoClient.getUserOperationGasPrice();

      // Deploy with a simple transaction to zero address
      const userOperationHash = await bundlerClient.sendUserOperation({
        account: smartAccount,
        calls: [
          {
            to: "0x0000000000000000000000000000000000000000",
            value: 0n,
            data: "0x",
          },
        ],
        paymaster: paymasterClient,
        ...fee,
      });

      const { receipt } = await bundlerClient.waitForUserOperationReceipt({
        hash: userOperationHash,
      });

      return { userOperationHash, receipt };
    } finally {
      setIsDeploying(false);
    }
  };

  return {
    deploySmartAccount,
    isDeploying,
    needsDeployment: !!smartAccount && !isDeployed,
  };
}
