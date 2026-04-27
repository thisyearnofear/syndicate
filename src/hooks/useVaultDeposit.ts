"use client";

import { useState, useCallback } from 'react';
import { useWalletClient, usePublicClient } from 'wagmi';
import { base } from 'wagmi/chains';
import { parseUnits } from 'viem';
import { useUnifiedWallet } from './useUnifiedWallet';
import { AAVE_CONFIG } from '@/services/vaults/aaveProvider';
import { MORPHO_CONFIG } from '@/services/vaults/morphoProvider';
import { SPARK_CONFIG } from '@/services/vaults/sparkProvider';
import type { VaultProtocol } from '@/services/vaults';
import { FHENIX_VAULT_CHAIN } from '@/services/fhe/fhenixChain';
import { approveAndDepositEncrypted } from '@/services/fhe/fhenixActions';
import { withdrawFromFhenixVault } from '@/services/fhe/fhenixActions';

type DepositStatus = 'idle' | 'checking_allowance' | 'approving' | 'building_tx' | 'depositing' | 'signing' | 'confirming' | 'complete' | 'error';

export interface VaultDepositState {
  isDepositing: boolean;
  error: string | null;
  txHash: string | null;
  approveTxHash: string | null;
  status: DepositStatus;
}

// Minimal ABIs for Aave V3 (viem-compatible)
const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: 'success', type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: 'amount', type: 'uint256' }] },
] as const;

const AAVE_POOL_ABI = [
  { name: 'supply', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'onBehalfOf', type: 'address' }, { name: 'referralCode', type: 'uint16' }], outputs: [] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'to', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
] as const;

const USDC_BASE = AAVE_CONFIG.BASE.USDC_ADDRESS as `0x${string}`;
const AAVE_POOL = AAVE_CONFIG.BASE.POOL_ADDRESS as `0x${string}`;

export function useVaultDeposit() {
  const { address } = useUnifiedWallet();
  const { data: walletClient } = useWalletClient({ chainId: base.id });
  const publicClient = usePublicClient({ chainId: base.id });
  const { data: fhenixWalletClient } = useWalletClient({ chainId: FHENIX_VAULT_CHAIN.id });
  const fhenixPublicClient = usePublicClient({ chainId: FHENIX_VAULT_CHAIN.id });

  const [state, setState] = useState<VaultDepositState>({
    isDepositing: false,
    error: null,
    txHash: null,
    approveTxHash: null,
    status: 'idle',
  });

  // ─── EVM (Aave on Base) — approve USDC + supply / withdraw via wagmi ───

  const depositAave = useCallback(
    async (amount: string): Promise<{ success: boolean; txHash?: string }> => {
      if (!walletClient || !publicClient || !address) throw new Error('No EVM wallet connected');

      const amountWei = parseUnits(amount, 6);
      const userAddr = address as `0x${string}`;

      // 1. Check USDC allowance for Aave Pool
      setState(prev => ({ ...prev, status: 'checking_allowance' }));
      const currentAllowance = await publicClient.readContract({
        address: USDC_BASE, abi: ERC20_ABI, functionName: 'allowance', args: [userAddr, AAVE_POOL],
      });

      // 2. Approve if needed
      if (currentAllowance < amountWei) {
        setState(prev => ({ ...prev, status: 'approving' }));
        const approveHash = await walletClient.writeContract({
          address: USDC_BASE, abi: ERC20_ABI, functionName: 'approve', args: [AAVE_POOL, amountWei], chain: base,
        });
        setState(prev => ({ ...prev, approveTxHash: approveHash }));
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // 3. Supply USDC to Aave V3 Pool
      setState(prev => ({ ...prev, status: 'depositing' }));
      const supplyHash = await walletClient.writeContract({
        address: AAVE_POOL, abi: AAVE_POOL_ABI, functionName: 'supply', args: [USDC_BASE, amountWei, userAddr, 0], chain: base,
      });
      await publicClient.waitForTransactionReceipt({ hash: supplyHash });

      return { success: true, txHash: supplyHash };
    },
    [walletClient, publicClient, address],
  );

  // ─── EVM (ERC4626 Vaults: Morpho, PoolTogether) — approve USDC + deposit via wagmi ───

  const depositERC4626 = useCallback(
    async (amount: string, vaultAddress: `0x${string}`): Promise<{ success: boolean; txHash?: string }> => {
      if (!walletClient || !publicClient || !address) throw new Error('No EVM wallet connected');

      const amountWei = parseUnits(amount, 6);
      const userAddr = address as `0x${string}`;

      // ERC4626 deposit ABI
      const ERC4626_DEPOSIT_ABI = [
        { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }], outputs: [{ name: 'shares', type: 'uint256' }] },
      ] as const;

      // 1. Check USDC allowance for vault
      setState(prev => ({ ...prev, status: 'checking_allowance' }));
      const currentAllowance = await publicClient.readContract({
        address: USDC_BASE, abi: ERC20_ABI, functionName: 'allowance', args: [userAddr, vaultAddress],
      });

      // 2. Approve if needed
      if (currentAllowance < amountWei) {
        setState(prev => ({ ...prev, status: 'approving' }));
        const approveHash = await walletClient.writeContract({
          address: USDC_BASE, abi: ERC20_ABI, functionName: 'approve', args: [vaultAddress, amountWei], chain: base,
        });
        setState(prev => ({ ...prev, approveTxHash: approveHash }));
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // 3. Deposit USDC to ERC4626 vault
      setState(prev => ({ ...prev, status: 'depositing' }));
      const depositHash = await walletClient.writeContract({
        address: vaultAddress, abi: ERC4626_DEPOSIT_ABI, functionName: 'deposit', args: [amountWei, userAddr], chain: base,
      });
      await publicClient.waitForTransactionReceipt({ hash: depositHash });

      return { success: true, txHash: depositHash };
    },
    [walletClient, publicClient, address],
  );

  const withdrawAave = useCallback(
    async (amount: string): Promise<{ success: boolean; txHash?: string }> => {
      if (!walletClient || !publicClient || !address) throw new Error('No EVM wallet connected');

      const amountWei = parseUnits(amount, 6);
      const userAddr = address as `0x${string}`;

      setState(prev => ({ ...prev, status: 'signing' }));
      const withdrawHash = await walletClient.writeContract({
        address: AAVE_POOL, abi: AAVE_POOL_ABI, functionName: 'withdraw', args: [USDC_BASE, amountWei, userAddr], chain: base,
      });
      await publicClient.waitForTransactionReceipt({ hash: withdrawHash });

      return { success: true, txHash: withdrawHash };
    },
    [walletClient, publicClient, address],
  );

  const withdrawERC4626 = useCallback(
    async (amount: string, vaultAddress: `0x${string}`): Promise<{ success: boolean; txHash?: string }> => {
      if (!walletClient || !publicClient || !address) throw new Error('No EVM wallet connected');

      const amountWei = parseUnits(amount, 6);
      const userAddr = address as `0x${string}`;

      // ERC4626 withdraw ABI
      const ERC4626_WITHDRAW_ABI = [
        { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }], outputs: [{ name: 'shares', type: 'uint256' }] },
      ] as const;

      setState(prev => ({ ...prev, status: 'signing' }));
      const withdrawHash = await walletClient.writeContract({
        address: vaultAddress, abi: ERC4626_WITHDRAW_ABI, functionName: 'withdraw', args: [amountWei, userAddr, userAddr], chain: base,
      });
      await publicClient.waitForTransactionReceipt({ hash: withdrawHash });

      return { success: true, txHash: withdrawHash };
    },
    [walletClient, publicClient, address],
  );

  // ─── Public API ───

  const deposit = useCallback(
    async (protocol: VaultProtocol, amount: string): Promise<{ success: boolean; txHash?: string; error?: string }> => {
      if (!address) {
        const err = 'No wallet connected';
        setState({ isDepositing: false, error: err, txHash: null, approveTxHash: null, status: 'error' });
        return { success: false, error: err };
      }

      setState({ isDepositing: true, error: null, txHash: null, approveTxHash: null, status: 'building_tx' });

      try {
        let result: { success: boolean; txHash?: string };
        
        // Route to appropriate deposit handler
        if (protocol === 'aave') {
          result = await depositAave(amount);
        } else if (protocol === 'morpho') {
          // Morpho USDC Vault on Base
          result = await depositERC4626(amount, MORPHO_CONFIG.BASE.VAULT_ADDRESS);
        } else if (protocol === 'spark') {
          // Spark sUSDC Vault on Base
          result = await depositERC4626(amount, SPARK_CONFIG.BASE.VAULT_ADDRESS);
        } else if (protocol === 'pooltogether') {
          // PoolTogether PrizeVault on Base
          result = await depositERC4626(amount, '0x7f5C2b379b88499aC2B997Db583f8079503f25b9');
        } else if (protocol === 'octant') {
          // Octant uses octantVaultService which needs initialization
          const { octantVaultService } = await import('@/services/octantVaultService');
          const { web3Service } = await import('@/services/web3Service');
          const provider = web3Service.getProvider();
          const signer = await web3Service.getFreshSigner();
          if (!provider) throw new Error('Provider not available');
          await octantVaultService.initialize(provider, signer);
          const vaultAddr = 'mock:octant-usdc'; // Use mock vault for MVP
          const depositResult = await octantVaultService.deposit(vaultAddr, amount, address);
          result = { success: depositResult.success, txHash: depositResult.txHash };
          if (!depositResult.success) throw new Error(depositResult.error || 'Octant deposit failed');
        } else if (protocol === 'uniswap') {
          // Uniswap V3 requires complex position management - not yet implemented
          throw new Error('Uniswap V3 deposits require position management UI. Coming soon.');
        } else if (protocol === 'lifiearn') {
          // LI.FI Earn uses Composer - requires cross-chain deposit flow
          throw new Error('LI.FI Earn requires cross-chain deposit. Use useLifiEarnVaultDeposit hook for Composer execution.');
        } else if (protocol === 'fhenix') {
          // Fhenix FHE vault: encrypt amount then call depositEncrypted on vault
          if (!fhenixWalletClient || !fhenixPublicClient || !address) throw new Error('No EVM wallet connected');
          const amountWei = parseUnits(amount, 6);
          const userAddr = address as `0x${string}`;

          const { FHENIX_POOL_CONFIG } = await import('@/services/syndicate/poolProviders/fhenixProvider');
          const vaultAddress = FHENIX_POOL_CONFIG.VAULT_ADDRESS;
          const usdcAddress = FHENIX_POOL_CONFIG.USDC_ADDRESS as `0x${string}`;

          setState(prev => ({ ...prev, status: 'checking_allowance' }));
          const { approveTxHash, depositTxHash } = await approveAndDepositEncrypted({
            walletClient: fhenixWalletClient as any,
            publicClient: fhenixPublicClient as any,
            userAddress: userAddr,
            vaultAddress,
            usdcAddress,
            amountWei,
          });
          if (approveTxHash) setState(prev => ({ ...prev, approveTxHash }));
          result = { success: true, txHash: depositTxHash };
        } else {
          throw new Error(`Deposit not yet supported for ${protocol}`);
        }

        setState(prev => ({ ...prev, isDepositing: false, error: null, txHash: result.txHash ?? null, status: 'complete' }));
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Deposit failed';
        const isCancel = msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('denied');
        setState({ isDepositing: false, error: isCancel ? 'Transaction cancelled' : msg, txHash: null, approveTxHash: null, status: 'error' });
        return { success: false, error: isCancel ? 'Transaction cancelled' : msg };
      }
    },
    [address, depositAave, depositERC4626],
  );

  const withdraw = useCallback(
    async (protocol: VaultProtocol, amount: string): Promise<{ success: boolean; txHash?: string; error?: string }> => {
      if (!address) return { success: false, error: 'No wallet connected' };

      setState({ isDepositing: true, error: null, txHash: null, approveTxHash: null, status: 'building_tx' });

      try {
        let result: { success: boolean; txHash?: string };
        
        // Route to appropriate withdraw handler
        if (protocol === 'aave') {
          result = await withdrawAave(amount);
        } else if (protocol === 'morpho') {
          // Morpho USDC Vault on Base
          result = await withdrawERC4626(amount, MORPHO_CONFIG.BASE.VAULT_ADDRESS);
        } else if (protocol === 'spark') {
          // Spark sUSDC Vault on Base
          result = await withdrawERC4626(amount, SPARK_CONFIG.BASE.VAULT_ADDRESS);
        } else if (protocol === 'pooltogether') {
          // PoolTogether PrizeVault on Base
          result = await withdrawERC4626(amount, '0x7f5C2b379b88499aC2B997Db583f8079503f25b9');
        } else if (protocol === 'octant') {
          // Octant withdrawal
          const { octantVaultService } = await import('@/services/octantVaultService');
          const { web3Service } = await import('@/services/web3Service');
          const provider = web3Service.getProvider();
          const signer = await web3Service.getFreshSigner();
          if (!provider) throw new Error('Provider not available');
          await octantVaultService.initialize(provider, signer);
          const vaultAddr = 'mock:octant-usdc';
          const withdrawResult = await octantVaultService.withdraw(vaultAddr, amount, address, address);
          result = { success: withdrawResult.success, txHash: withdrawResult.txHash };
          if (!withdrawResult.success) throw new Error(withdrawResult.error || 'Octant withdrawal failed');
        } else if (protocol === 'uniswap') {
          // Uniswap V3 requires complex position management - not yet implemented
          throw new Error('Uniswap V3 withdrawals require position management UI. Coming soon.');
        } else if (protocol === 'fhenix') {
          // Fhenix FHE vault withdrawal — coordinator-attested plain amount
          if (!fhenixWalletClient || !fhenixPublicClient || !address) throw new Error('No EVM wallet connected');
          const amountWei = parseUnits(amount, 6);
          const { FHENIX_POOL_CONFIG } = await import('@/services/syndicate/poolProviders/fhenixProvider');
          setState(prev => ({ ...prev, status: 'signing' }));
          const { withdrawTxHash } = await withdrawFromFhenixVault({
            walletClient: fhenixWalletClient as any,
            publicClient: fhenixPublicClient as any,
            vaultAddress: FHENIX_POOL_CONFIG.VAULT_ADDRESS,
            amountWei,
          });
          result = { success: true, txHash: withdrawTxHash };
        } else {
          throw new Error(`Withdrawal not yet supported for ${protocol}`);
        }

        setState(prev => ({ ...prev, isDepositing: false, error: null, txHash: result.txHash ?? null, status: 'complete' }));
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Withdrawal failed';
        setState({ isDepositing: false, error: msg, txHash: null, approveTxHash: null, status: 'error' });
        return { success: false, error: msg };
      }
    },
    [address, withdrawAave, withdrawERC4626],
  );

  const reset = useCallback(() => {
    setState({ isDepositing: false, error: null, txHash: null, approveTxHash: null, status: 'idle' });
  }, []);

  return { ...state, deposit, withdraw, reset };
}
