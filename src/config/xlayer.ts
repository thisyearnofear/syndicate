import { defineChain, isAddress, type Address } from 'viem';

export const XLAYER_TESTNET_CHAIN_ID = 1952;
export const XLAYER_MAINNET_CHAIN_ID = 196;

export const xLayerTestnet = defineChain({
  id: XLAYER_TESTNET_CHAIN_ID,
  name: 'X Layer Testnet',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_XLAYER_TESTNET_RPC_URL ||
          'https://testrpc.xlayer.tech/terigon',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'OKLink',
      url: 'https://www.oklink.com/x-layer-test',
    },
  },
  testnet: true,
});

export const XLAYER_TESTNET_EXPLORER_URL =
  'https://www.oklink.com/x-layer-test';

/**
 * Official OKX faucet: issues testnet OKB (gas) and USDC_TEST / USDG / USD₮0.
 * This is the only supported funding path for the testnet demo — the pool's
 * deposit token (0xcb8b…c79d) is what this faucet mints.
 */
export const XLAYER_FAUCET_URL = 'https://web3.okx.com/xlayer/faucet';

export const XLAYER_TESTNET_USDC_ADDRESS =
  (process.env.NEXT_PUBLIC_XLAYER_TESTNET_USDC_ADDRESS || '') as Address;

export const XLAYER_PRIZE_POOL_HOOK_ADDRESS =
  (process.env.NEXT_PUBLIC_XLAYER_PRIZE_POOL_HOOK_ADDRESS || '') as Address;

export const XLAYER_PRIZE_POOL_ROUTER_ADDRESS =
  (process.env.NEXT_PUBLIC_XLAYER_PRIZE_POOL_ROUTER_ADDRESS || '') as Address;

export const XLAYER_POOL_MANAGER_ADDRESS =
  (process.env.NEXT_PUBLIC_XLAYER_POOL_MANAGER_ADDRESS || '') as Address;

export const XLAYER_ORACLE_ADDRESS =
  (process.env.NEXT_PUBLIC_XLAYER_ORACLE_ADDRESS || '') as Address;

export function isXLayerDeploymentConfigured(addresses: {
  hook: string;
  router: string;
  poolManager: string;
}): boolean {
  return [addresses.hook, addresses.router, addresses.poolManager].every((address) => isAddress(address));
}

export const XLAYER_HOOK_IS_CONFIGURED = isXLayerDeploymentConfigured({
  hook: XLAYER_PRIZE_POOL_HOOK_ADDRESS,
  router: XLAYER_PRIZE_POOL_ROUTER_ADDRESS,
  poolManager: XLAYER_POOL_MANAGER_ADDRESS,
});

export const XLAYER_HOOK_ABI = [
  {
    type: 'function',
    name: 'potBalance',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalShares',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'minPotForDraw',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'drawCooldown',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'surchargeBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint24' }],
  },
  {
    type: 'function',
    name: 'surchargeEnabled',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'draw',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { type: 'bool', name: 'open' },
      { type: 'bool', name: 'resolved' },
      { type: 'bool', name: 'claimed' },
      { type: 'bool', name: 'cancelled' },
      { type: 'uint256', name: 'epochId' },
      { type: 'uint256', name: 'snapshotAt' },
      { type: 'uint256', name: 'snapshotTotalShares' },
      { type: 'uint256', name: 'potAtSnapshot' },
      { type: 'address', name: 'winner' },
      { type: 'uint256', name: 'randomValue' },
    ],
  },
  {
    type: 'function',
    name: 'shares',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'principal',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'swapRouter',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'randomnessOracle',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'lastDrawAt',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const;

export function xLayerExplorerAddress(address: string): string {
  return `${XLAYER_TESTNET_EXPLORER_URL}/address/${address}`;
}

export function xLayerExplorerTx(hash: string): string {
  return `${XLAYER_TESTNET_EXPLORER_URL}/tx/${hash}`;
}

export function formatXLayerShareOdds(
  userShares: bigint | undefined,
  totalShares: bigint | undefined,
): string {
  if (!userShares || !totalShares || totalShares === 0n) return '—';

  const basisPoints = (userShares * 10_000n) / totalShares;
  const whole = basisPoints / 100n;
  const fraction = (basisPoints % 100n).toString().padStart(2, '0');
  return `${whole}.${fraction}%`;
}
