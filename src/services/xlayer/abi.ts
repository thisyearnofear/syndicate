/**
 * X LAYER — Contract ABIs for write operations
 */

/** PrizePoolSwapRouter.swapExactInput ABI */
export const XLAYER_ROUTER_ABI = [
  {
    type: 'function',
    name: 'swapExactInput',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'zeroForOne', type: 'bool' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'minAmountOut', type: 'uint256' },
      { name: 'sqrtPriceLimitX96', type: 'uint160' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const;

/** PrizePoolHook keeper write + view surface used by the AI keeper. */
export const XLAYER_KEEPER_HOOK_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'fundPot',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'openDraw',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'fulfillRandomness',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'beaconValue', type: 'uint256' },
      { name: 'proof', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'claimPrize',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
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

/** SimpleRandomnessOracle — TESTNET demo only. */
export const XLAYER_DEMO_ORACLE_ABI = [
  {
    type: 'function',
    name: 'setNextValue',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'epochId', type: 'uint256' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'epochValues',
    stateMutability: 'view',
    inputs: [{ name: 'epochId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

/** Standard ERC-20 approve ABI (for USDC approval). */
export const XLAYER_ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;
