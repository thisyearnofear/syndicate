"use client";

import { useState, useCallback } from 'react';
import { base } from 'wagmi/chains';
import { parseUnits } from 'viem';
import { useUnifiedWallet } from './useUnifiedWallet';
import { useEVMClients } from './useEVMClients';
import { AAVE_CONFIG } from '@/services/vaults/aaveProvider';
import { MORPHO_CONFIG } from '@/services/vaults/morphoProvider';
import { SPARK_CONFIG } from '@/services/vaults/sparkProvider';
import type { VaultProtocol } from '@/services/vaults';
import { ERC20_ABI } from '@/abis/erc20';
import { mapErrorMessage } from '@/services/vaults/router';
import { lifecycle } from '@/services/observability';
import { useExecution } from '@/services/execution';
import { invalidatePortfolio } from './usePortfolioInvalidation';

type DepositStatus = 'idle' | 'checking_allowance' | 'approving' | 'building_tx' | 'depositing' | 'signing' | 'confirming' | 'complete' | 'error';

export interface VaultDepositState {
  isDepositing: boolean;
  error: string | null;
  txHash: string | null;
  approveTxHash: string | null;
  status: DepositStatus;
}

const AAVE_POOL_ABI = [
  { name: 'supply', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'onBehalfOf', type: 'address' }, { name: 'referralCode', type: 'uint16' }], outputs: [] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'to', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
] as const;

const USDC_BASE = AAVE_CONFIG.BASE.USDC_ADDRESS as `0x${string}`;
const AAVE_POOL = AAVE_CONFIG.BASE.POOL_ADDRESS as `0x${string}`;

export function useVaultDeposit() {
  const { address, walletType } = useUnifiedWallet();
  const execution = useExecution();
  const {
    walletClient,
    publicClient,
    fhenixWalletClient,
    fhenixPublicClient,
    fhenixChainName,
    ensureBaseChain,
    ensureFhenixChain,
  } = useEVMClients();

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
      await ensureBaseChain();
      if (walletType !== 'evm') throw new Error('Vault deposits require an EVM wallet (MetaMask, WalletConnect, etc.)');
      if (!walletClient || !publicClient || !address) throw new Error('Connect an EVM wallet on Base to deposit into this vault.');

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
          account: userAddr,
          address: USDC_BASE, abi: ERC20_ABI, functionName: 'approve', args: [AAVE_POOL, amountWei], chain: base,
        });
        setState(prev => ({ ...prev, approveTxHash: approveHash }));
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // 3. Supply USDC to Aave V3 Pool
      setState(prev => ({ ...prev, status: 'depositing' }));
      const supplyHash = await walletClient.writeContract({
        account: userAddr,
        address: AAVE_POOL, abi: AAVE_POOL_ABI, functionName: 'supply', args: [USDC_BASE, amountWei, userAddr, 0], chain: base,
      });
      await publicClient.waitForTransactionReceipt({ hash: supplyHash });

      return { success: true, txHash: supplyHash };
    },
    [ensureBaseChain, walletClient, publicClient, address, walletType],
  );

  // ─── EVM (ERC4626 Vaults: Morpho, PoolTogether) — approve USDC + deposit via wagmi ───

  const depositERC4626 = useCallback(
    async (amount: string, vaultAddress: `0x${string}`): Promise<{ success: boolean; txHash?: string }> => {
      await ensureBaseChain();
      if (walletType !== 'evm') throw new Error('Vault deposits require an EVM wallet (MetaMask, WalletConnect, etc.)');
      if (!walletClient || !publicClient || !address) throw new Error('Connect an EVM wallet on Base to deposit into this vault.');

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
          account: userAddr,
          address: USDC_BASE, abi: ERC20_ABI, functionName: 'approve', args: [vaultAddress, amountWei], chain: base,
        });
        setState(prev => ({ ...prev, approveTxHash: approveHash }));
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // 3. Deposit USDC to ERC4626 vault
      setState(prev => ({ ...prev, status: 'depositing' }));
      const depositHash = await walletClient.writeContract({
        account: userAddr,
        address: vaultAddress, abi: ERC4626_DEPOSIT_ABI, functionName: 'deposit', args: [amountWei, userAddr], chain: base,
      });
      await publicClient.waitForTransactionReceipt({ hash: depositHash });

      return { success: true, txHash: depositHash };
    },
    [ensureBaseChain, walletClient, publicClient, address, walletType],
  );

  const withdrawAave = useCallback(
    async (amount: string): Promise<{ success: boolean; txHash?: string }> => {
      await ensureBaseChain();
      if (walletType !== 'evm') throw new Error('Vault deposits require an EVM wallet (MetaMask, WalletConnect, etc.)');
      if (!walletClient || !publicClient || !address) throw new Error('Connect an EVM wallet on Base to withdraw from this vault.');

      const amountWei = parseUnits(amount, 6);
      const userAddr = address as `0x${string}`;

      setState(prev => ({ ...prev, status: 'signing' }));
      const withdrawHash = await walletClient.writeContract({
        account: userAddr,
        address: AAVE_POOL, abi: AAVE_POOL_ABI, functionName: 'withdraw', args: [USDC_BASE, amountWei, userAddr], chain: base,
      });
      await publicClient.waitForTransactionReceipt({ hash: withdrawHash });

      return { success: true, txHash: withdrawHash };
    },
    [ensureBaseChain, walletClient, publicClient, address, walletType],
  );

  const withdrawERC4626 = useCallback(
    async (amount: string, vaultAddress: `0x${string}`): Promise<{ success: boolean; txHash?: string }> => {
      await ensureBaseChain();
      if (walletType !== 'evm') throw new Error('Vault deposits require an EVM wallet (MetaMask, WalletConnect, etc.)');
      if (!walletClient || !publicClient || !address) throw new Error('Connect an EVM wallet on Base to withdraw from this vault.');

      const amountWei = parseUnits(amount, 6);
      const userAddr = address as `0x${string}`;

      // ERC4626 withdraw ABI
      const ERC4626_WITHDRAW_ABI = [
        { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }], outputs: [{ name: 'shares', type: 'uint256' }] },
      ] as const;

      setState(prev => ({ ...prev, status: 'signing' }));
      const withdrawHash = await walletClient.writeContract({
        account: userAddr,
        address: vaultAddress, abi: ERC4626_WITHDRAW_ABI, functionName: 'withdraw', args: [amountWei, userAddr, userAddr], chain: base,
      });
      await publicClient.waitForTransactionReceipt({ hash: withdrawHash });

      return { success: true, txHash: withdrawHash };
    },
    [ensureBaseChain, walletClient, publicClient, address, walletType],
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
      execution.prepare(`Preparing ${protocol} deposit`);
      lifecycle.emit('vault.deposit_initiated', {
        chain: protocol === 'fhenix' ? 'fhenix_testnet' : 'base',
        chainId: protocol === 'fhenix' ? 84532 : 8453,
        operation: 'deposit',
        provider: protocol,
        userAddress: address,
        metadata: { amount, protocol },
      });

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
          // PoolTogether PrizeVault on Base — import exported address from provider
          const { PRIZE_VAULT: PT_VAULT } = await import('@/services/vaults/poolTogetherProvider');
          result = await depositERC4626(amount, PT_VAULT as `0x${string}`);
        } else if (protocol === 'octant') {
          // Octant uses octantVaultService which needs initialization
          const { octantVaultService } = await import('@/services/octantVaultService');
          const { resolveOctantVaultAddress } = await import('@/config/octantConfig');
          const vaultAddr = resolveOctantVaultAddress();
          if (!vaultAddr) {
            throw new Error('Octant vault is disabled: configure a real ERC-4626 vault address or set NEXT_PUBLIC_OCTANT_MOCK=true for demos/tests.');
          }
          const { web3Service } = await import('@/services/web3Service');
          const provider = web3Service.getProvider();
          const signer = await web3Service.getFreshSigner();
          if (!provider) throw new Error('Provider not available');
          await octantVaultService.initialize(provider, signer);
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
          throw new Error(
            'Fhenix deposits are paused. The Base Sepolia vault is deprecated — do not send funds.',
          );
        } else {
          throw new Error(`Deposit not yet supported for ${protocol}`);
        }

        setState(prev => ({ ...prev, isDepositing: false, error: null, txHash: result.txHash ?? null, status: 'complete' }));
        // Complete execution state machine with verified receipt.
        // The inner handlers (depositAave, depositERC4626) have already
        // waited for waitForTransactionReceipt, so the tx is confirmed.
        if (result.txHash) {
          const chainId = protocol === 'fhenix' ? 84532 : 8453;
          try {
            // Re-read the receipt to get blockNumber for the ConfirmedReceipt
            const client = protocol === 'fhenix' ? fhenixPublicClient : publicClient;
            if (client) {
              const receipt = await client.getTransactionReceipt({ hash: result.txHash as `0x${string}` });
              execution.awaitSignature(protocol === 'fhenix' ? 'fhenix_testnet' : 'base');
              execution.submit(result.txHash, chainId);
              execution.confirm(result.txHash, chainId);
              execution.complete({
                transactionHash: result.txHash,
                blockNumber: Number(receipt.blockNumber),
                chainId,
                confirmedAt: Date.now(),
              });
            }
          } catch {
            // If receipt re-read fails, the deposit still succeeded (we already
            // waited for confirmation inside the handler). Don't break the flow.
          }
        }
        lifecycle.emit('vault.deposit_confirmed', {
          chain: protocol === 'fhenix' ? 'fhenix_testnet' : 'base',
          chainId: protocol === 'fhenix' ? 84532 : 8453,
          operation: 'deposit',
          provider: protocol,
          transactionHash: result.txHash || undefined,
          userAddress: address || undefined,
          metadata: { amount, protocol },
        });
        invalidatePortfolio({
          operation: 'deposit',
          provider: protocol,
          chain: protocol === 'fhenix' ? 'fhenix_testnet' : 'base',
          transactionHash: result.txHash || undefined,
        });
        return result;
      } catch (error) {
        const msg = mapErrorMessage(error, 'Deposit failed');
        setState({ isDepositing: false, error: msg, txHash: null, approveTxHash: null, status: 'error' });
        const userCancelled = msg.includes('reject') || msg.includes('denied');
        execution.fail(userCancelled ? 'USER_REJECTED' : 'UNKNOWN', msg, { userCancelled, cause: error });
        lifecycle.emit('vault.operation_failed', {
          chain: protocol === 'fhenix' ? 'fhenix_testnet' : 'base',
          chainId: protocol === 'fhenix' ? 84532 : 8453,
          operation: 'deposit',
          provider: protocol,
          userAddress: address || undefined,
          error: { code: 'DEPOSIT_FAILED', message: msg, phase: 'depositing', userCancelled: msg.includes('reject') || msg.includes('denied') },
        });
        return { success: false, error: msg };
      }
    },
    [address, depositAave, depositERC4626, ensureFhenixChain, fhenixChainName, fhenixPublicClient, fhenixWalletClient, walletType, execution, publicClient],
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
          const { resolveOctantVaultAddress } = await import('@/config/octantConfig');
          const vaultAddr = resolveOctantVaultAddress();
          if (!vaultAddr) {
            throw new Error('Octant vault is disabled: configure a real ERC-4626 vault address or set NEXT_PUBLIC_OCTANT_MOCK=true for demos/tests.');
          }
          const { web3Service } = await import('@/services/web3Service');
          const provider = web3Service.getProvider();
          const signer = await web3Service.getFreshSigner();
          if (!provider) throw new Error('Provider not available');
          await octantVaultService.initialize(provider, signer);
          const withdrawResult = await octantVaultService.withdraw(vaultAddr, amount, address, address);
          result = { success: withdrawResult.success, txHash: withdrawResult.txHash };
          if (!withdrawResult.success) throw new Error(withdrawResult.error || 'Octant withdrawal failed');
        } else if (protocol === 'uniswap') {
          // Uniswap V3 requires complex position management - not yet implemented
          throw new Error('Uniswap V3 withdrawals require position management UI. Coming soon.');
        } else if (protocol === 'fhenix') {
          throw new Error(
            'Fhenix withdrawals are paused. The Base Sepolia vault is deprecated.',
          );
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
    [address, ensureFhenixChain, fhenixChainName, withdrawAave, withdrawERC4626, fhenixPublicClient, fhenixWalletClient, walletType],
  );

  const resetAll = useCallback(() => {
    execution.reset();
    setState({ isDepositing: false, error: null, txHash: null, approveTxHash: null, status: 'idle' });
  }, [execution]);

  return { ...state, deposit, withdraw, reset: resetAll, execution: execution.state };
}
