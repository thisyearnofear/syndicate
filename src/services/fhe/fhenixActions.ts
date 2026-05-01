/**
 * Fhenix actions (client-side).
 *
 * Core Principles:
 * - DRY: Single implementation of approve + encrypt + depositEncrypted
 * - CLEAN: No React/wagmi imports; consumers provide wallet/public clients
 * - MODULAR: Pure helpers, easy to unit test by mocking clients
 *
 * Note: walletClient/publicClient use `any` because wagmi's viem client types
 * have `account` injected at the hook level, making strict typing impractical
 * at this abstraction boundary. Consumers are the wagmi hooks in useVaultDeposit
 * and useSyndicateDeposit.
 */

import { encryptUsdcAmount } from './fheService';
import { FHENIX_VAULT_CHAIN } from './fhenixChain';
import { ERC20_ABI } from '@/abis/erc20';

/* eslint-disable @typescript-eslint/no-explicit-any */

const DEPOSIT_ENCRYPTED_ABI = [
  {
    name: 'depositEncrypted',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'encryptedAmount',
        type: 'tuple',
        components: [
          { name: 'data', type: 'bytes' },
          { name: 'securityZone', type: 'int32' },
        ],
      },
      { name: 'plainAmount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

export async function approveAndDepositEncrypted(params: {
  walletClient: any;
  publicClient: any;
  userAddress: `0x${string}`;
  vaultAddress: `0x${string}`;
  usdcAddress: `0x${string}`;
  amountWei: bigint;
}): Promise<{ approveTxHash?: `0x${string}`; depositTxHash: `0x${string}` }> {
  const { walletClient, publicClient, userAddress, vaultAddress, usdcAddress, amountWei } = params;

  const currentAllowance = await publicClient.readContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [userAddress, vaultAddress],
  }) as bigint;

  let approveTxHash: `0x${string}` | undefined;
  if (currentAllowance < amountWei) {
    approveTxHash = await walletClient.writeContract({
      address: usdcAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [vaultAddress, amountWei],
      chain: FHENIX_VAULT_CHAIN,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
  }

  const encResult = await encryptUsdcAmount(amountWei);
  if (!encResult.success) {
    throw new Error(`FHE encryption failed: ${encResult.error?.message ?? 'unknown error'}`);
  }
  const encryptedInput = encResult.data[0];

  const depositTxHash = await walletClient.writeContract({
    address: vaultAddress,
    abi: DEPOSIT_ENCRYPTED_ABI,
    functionName: 'depositEncrypted',
    args: [encryptedInput, amountWei],
    chain: FHENIX_VAULT_CHAIN,
  });
  await publicClient.waitForTransactionReceipt({ hash: depositTxHash });

  return { approveTxHash, depositTxHash };
}

const WITHDRAW_ABI = [
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'plainAmount', type: 'uint256' }],
    outputs: [],
  },
] as const;

export async function withdrawFromFhenixVault(params: {
  walletClient: any;
  publicClient: any;
  vaultAddress: `0x${string}`;
  amountWei: bigint;
}): Promise<{ withdrawTxHash: `0x${string}` }> {
  const { walletClient, publicClient, vaultAddress, amountWei } = params;

  const withdrawTxHash = await walletClient.writeContract({
    address: vaultAddress,
    abi: WITHDRAW_ABI,
    functionName: 'withdraw',
    args: [amountWei],
    chain: FHENIX_VAULT_CHAIN,
  });

  await publicClient.waitForTransactionReceipt({ hash: withdrawTxHash });
  return { withdrawTxHash };
}
