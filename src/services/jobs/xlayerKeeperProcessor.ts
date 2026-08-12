/**
 * X LAYER KEEPER PROCESSOR — server-side operator loop (cron).
 *
 * The interactive /xlayer agent panel is human-in-the-loop by design; this
 * processor is the operator-side complement so the testnet pool stays alive
 * between visitors. Each tick CHAINS the full epoch cycle the current state
 * allows — open draw → seed demo oracle → fulfill randomness → claim (only
 * when the operator actually won) — re-reading on-chain state between
 * stages, so a single daily Hobby-tier cron run completes a whole epoch.
 *
 * Every money claim is receipt-verified before it is recorded; pending is
 * never persisted as success. It NEVER fabricates a tx hash.
 *
 * Gates (all fail closed with an explicit reason — no silent no-ops):
 *   - XLAYER_HOOK_IS_CONFIGURED (deployment addresses present)
 *   - XLAYER_KEEPER_PRIVATE_KEY (server-only operator key; TESTNET ONLY —
 *     the key owns the testnet hook/oracle and holds only testnet funds.
 *     Never reuse a key that controls mainnet value.)
 *   - Role checks: setNextValue requires oracle owner, fundPot requires
 *     hook owner, claimPrize requires the operator to be the winner.
 *
 * Every transition is persisted to agent_run_events so the /xlayer page can
 * replay the latest operator run to anyone (see getLatestAgentRunSession).
 */

import { randomBytes } from 'node:crypto';
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  parseUnits,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  xLayerTestnet,
  XLAYER_HOOK_ABI,
  XLAYER_HOOK_IS_CONFIGURED,
  XLAYER_PRIZE_POOL_HOOK_ADDRESS,
  XLAYER_TESTNET_USDC_ADDRESS,
} from '@/config/xlayer';
import { XLAYER_DEMO_ORACLE_ABI, XLAYER_ERC20_ABI, XLAYER_KEEPER_HOOK_ABI } from '@/services/xlayer/abi';
import {
  appendAgentRunEvent,
  ensureAgentRunEventsTable,
  type AgentRunKind,
} from '@/lib/db/repositories/agentRunRepository';
import { logger } from '@/lib/logger';

export interface XLayerKeeperActionResult {
  tool: string;
  ok: boolean;
  txHash?: string;
  error?: string;
}

export interface XLayerKeeperRunResult {
  attempted: boolean;
  reason?: string;
  sessionId?: string;
  actions: XLayerKeeperActionResult[];
}

/** Full-cycle chaining needs more headroom than one-stage-per-tick. */
const MAX_ACTIONS_PER_TICK = 6;
const MAX_STAGES_PER_TICK = 4;

// draw tuple indices (see XLAYER_HOOK_ABI draw() outputs)
const DRAW_OPEN = 0;
const DRAW_RESOLVED = 1;
const DRAW_CLAIMED = 2;
const DRAW_EPOCH_ID = 4;
const DRAW_WINNER = 8;

interface KeeperState {
  drawOpen: boolean;
  drawResolved: boolean;
  drawClaimed: boolean;
  epochId: bigint;
  winner: Address;
  potBalance: bigint;
  totalShares: bigint;
  minPotForDraw: bigint;
  drawCooldown: bigint;
  lastDrawAt: bigint;
  hookOwner: Address;
  oracleAddress: Address | null;
  blockTimestamp: bigint;
}

function defaultFundAmount(): bigint {
  const raw = process.env.XLAYER_KEEPER_FUND_POT_USDC ?? '25';
  const parsed = Number(raw);
  return parseUnits(Number.isFinite(parsed) && parsed > 0 ? raw : '25', 6);
}

function defaultDepositAmount(): bigint {
  const raw = process.env.XLAYER_KEEPER_DEPOSIT_USDC ?? '5';
  const parsed = Number(raw);
  return parseUnits(Number.isFinite(parsed) && parsed > 0 ? raw : '5', 6);
}

/**
 * Demo-pot floor: minPotForDraw is 0 on this deployment, which lets epochs
 * cycle with an empty pot — a broken first impression on /xlayer. The
 * keeper tops the pot up to a small floor so the page always shows a live
 * number. Testnet USDC only.
 */
function minDemoPot(): bigint {
  const raw = process.env.XLAYER_KEEPER_MIN_DEMO_POT_USDC ?? '5';
  const parsed = Number(raw);
  return parseUnits(Number.isFinite(parsed) && parsed > 0 ? raw : '5', 6);
}

export async function runXLayerKeeper(): Promise<XLayerKeeperRunResult> {
  if (!XLAYER_HOOK_IS_CONFIGURED || !isAddress(XLAYER_PRIZE_POOL_HOOK_ADDRESS)) {
    return { attempted: false, reason: 'X Layer hook is not configured.', actions: [] };
  }

  const privateKey = process.env.XLAYER_KEEPER_PRIVATE_KEY;
  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    return {
      attempted: false,
      reason:
        'XLAYER_KEEPER_PRIVATE_KEY is not set (or malformed) — keeper is fail-closed and no run was recorded.',
      actions: [],
    };
  }

  const account = privateKeyToAccount(privateKey as Hex);
  const hook = XLAYER_PRIZE_POOL_HOOK_ADDRESS as Address;
  const usdc = XLAYER_TESTNET_USDC_ADDRESS as Address;
  const transport = http(xLayerTestnet.rpcUrls.default.http[0]);
  const publicClient = createPublicClient({ chain: xLayerTestnet, transport });
  const walletClient = createWalletClient({ account, chain: xLayerTestnet, transport });
  const operator = account.address.toLowerCase();

  const sessionId = `keeper_${Date.now()}_${randomBytes(3).toString('hex')}`;
  const actions: XLayerKeeperActionResult[] = [];
  let seq = 0;

  const record = async (
    kind: AgentRunKind,
    label: string,
    opts: { detail?: string; toolId?: string; txHash?: string } = {},
  ): Promise<void> => {
    try {
      await appendAgentRunEvent({
        id: `${sessionId}_${seq++}`,
        sessionId,
        kind,
        label,
        detail: opts.detail ?? null,
        toolId: opts.toolId ?? null,
        txHash: opts.txHash ?? null,
        source: 'keeper-cron',
        createdAt: Date.now(),
      });
    } catch (err) {
      // Persistence failure must not mask the on-chain outcome.
      logger.error('[XLayerKeeper] Failed to persist run event', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const budgetLeft = () => actions.filter((a) => a.txHash).length < MAX_ACTIONS_PER_TICK;

  const execute = async (
    tool: string,
    label: string,
    write: () => Promise<Hex>,
  ): Promise<XLayerKeeperActionResult> => {
    if (!budgetLeft()) {
      const skipped = { tool, ok: false, error: 'Tick action budget exhausted.' };
      actions.push(skipped);
      await record('fail', label, { toolId: tool, detail: skipped.error });
      return skipped;
    }
    await record('execute', label, { toolId: tool });
    try {
      const hash = await write();
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') {
        const result = { tool, ok: false, txHash: hash, error: 'Transaction reverted on-chain.' };
        actions.push(result);
        await record('fail', label, { toolId: tool, txHash: hash, detail: result.error });
        return result;
      }
      const result = { tool, ok: true, txHash: hash };
      actions.push(result);
      await record('complete', label, { toolId: tool, txHash: hash });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : `${tool} failed`;
      const result = { tool, ok: false, error: message };
      actions.push(result);
      await record('fail', label, { toolId: tool, detail: message });
      return result;
    }
  };

  const readState = async (): Promise<KeeperState> => {
    const [drawRaw, potBalance, totalShares, minPotForDraw, drawCooldown, lastDrawAt, hookOwner, oracleAddress, block] =
      await Promise.all([
        publicClient.readContract({ address: hook, abi: XLAYER_HOOK_ABI, functionName: 'draw' }),
        publicClient.readContract({ address: hook, abi: XLAYER_HOOK_ABI, functionName: 'potBalance' }),
        publicClient.readContract({ address: hook, abi: XLAYER_HOOK_ABI, functionName: 'totalShares' }),
        publicClient.readContract({ address: hook, abi: XLAYER_HOOK_ABI, functionName: 'minPotForDraw' }),
        publicClient.readContract({ address: hook, abi: XLAYER_HOOK_ABI, functionName: 'drawCooldown' }),
        publicClient.readContract({ address: hook, abi: XLAYER_HOOK_ABI, functionName: 'lastDrawAt' }),
        publicClient.readContract({ address: hook, abi: XLAYER_HOOK_ABI, functionName: 'owner' }),
        publicClient.readContract({ address: hook, abi: XLAYER_HOOK_ABI, functionName: 'randomnessOracle' }),
        publicClient.getBlock(),
      ]);
    return {
      drawOpen: Boolean(drawRaw[DRAW_OPEN]),
      drawResolved: Boolean(drawRaw[DRAW_RESOLVED]),
      drawClaimed: Boolean(drawRaw[DRAW_CLAIMED]),
      epochId: drawRaw[DRAW_EPOCH_ID] as bigint,
      winner: drawRaw[DRAW_WINNER] as Address,
      potBalance: potBalance as bigint,
      totalShares: totalShares as bigint,
      minPotForDraw: minPotForDraw as bigint,
      drawCooldown: drawCooldown as bigint,
      lastDrawAt: lastDrawAt as bigint,
      hookOwner: hookOwner as Address,
      oracleAddress: isAddress(oracleAddress) ? (oracleAddress as Address) : null,
      blockTimestamp: block.timestamp,
    };
  };

  /**
   * The public testnet RPC can serve state from before a just-confirmed
   * tx (observed 2026-08-12: openDraw confirmed, next read still showed
   * draw.open=false → a redundant openDraw reverted DrawAlreadyOpen).
   * After a mutating stage, re-read until the expected effect is visible
   * before chaining. If the node stays behind, stop honestly — the next
   * tick resumes the chain from the true state.
   */
  const waitForState = async (
    expect: (s: KeeperState) => boolean,
    what: string,
    tries = 5,
    delayMs = 2_500,
  ): Promise<KeeperState | null> => {
    for (let attempt = 0; attempt < tries; attempt++) {
      const state = await readState();
      if (expect(state)) return state;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    await record('plan', 'RPC state lag — pausing chain', {
      detail: `Node still shows pre-transaction state after ${tries} reads (${what}). Next tick continues from the true on-chain state.`,
    });
    return null;
  };

  /** Oracle owner is stable per deployment — read once, not per stage. */
  let oracleOwner: Address | null | undefined;

  const getOracleOwner = async (oracle: Address): Promise<Address | null> => {
    if (oracleOwner !== undefined) return oracleOwner;
    try {
      oracleOwner = (await publicClient.readContract({
        address: oracle,
        abi: XLAYER_DEMO_ORACLE_ABI,
        functionName: 'owner',
      })) as Address;
    } catch {
      oracleOwner = null;
    }
    return oracleOwner;
  };

  try {
    await ensureAgentRunEventsTable();

    // Chain stages until the pool no longer progresses (stand-down) or the
    // tick budget/stage cap is hit. State is re-read every stage, and after
    // a mutating stage the next read waits out RPC lag.
    let expectAfter: ((s: KeeperState) => boolean) | null = null;
    for (let stage = 0; stage < MAX_STAGES_PER_TICK; stage++) {
      if (!budgetLeft()) {
        await record('plan', 'Tick budget exhausted', {
          detail: `Stopping after ${actions.length} actions; remaining stages run next tick.`,
        });
        break;
      }
      const state = expectAfter ? await waitForState(expectAfter, 'stage transition') : await readState();
      if (!state) break; // node stayed behind — next tick resumes
      expectAfter = null;

      // ── Stage: resolve an open draw ───────────────────────────────────
      if (state.drawOpen && !state.drawResolved) {
        if (!state.oracleAddress) {
          await record('plan_failed', 'Resolve draw', {
            detail: 'No randomness oracle configured on the hook.',
          });
          break;
        }
        const owner = await getOracleOwner(state.oracleAddress);
        if (!owner || owner.toLowerCase() !== operator) {
          await record('plan_failed', 'Resolve draw', {
            detail: `Keeper ${account.address} is not the demo oracle owner (${owner ?? 'unreadable'}) — cannot set the epoch value.`,
          });
          break;
        }

        if (stage === 0) {
          await record('plan', `Resolve epoch ${state.epochId.toString()} (demo oracle)`, {
            detail: 'Draw is open; seeding demo oracle and fulfilling randomness. Testnet only.',
          });
        }

        const beaconValue = BigInt(`0x${randomBytes(32).toString('hex')}`);
        const setResult = await execute('xlayer.setDemoOracle', 'Set demo oracle value', () =>
          walletClient.writeContract({
            address: state.oracleAddress as Address,
            abi: XLAYER_DEMO_ORACLE_ABI,
            functionName: 'setNextValue',
            args: [state.epochId, beaconValue],
          }),
        );
        if (!setResult.ok) break;

        const fulfillResult = await execute('xlayer.fulfillRandomness', 'Fulfill randomness', () =>
          walletClient.writeContract({
            address: hook,
            abi: XLAYER_KEEPER_HOOK_ABI,
            functionName: 'fulfillRandomness',
            args: [beaconValue, '0x'],
          }),
        );
        if (!fulfillResult.ok) break;
        expectAfter = (s) => s.drawResolved;
        continue; // resolved → next stage may claim
      }

      // ── Stage: claim, but only when the operator actually won ─────────
      if (state.drawResolved && !state.drawClaimed) {
        if (state.winner.toLowerCase() !== operator) {
          await record('plan', `Epoch ${state.epochId.toString()} resolved — awaiting winner claim`, {
            detail: `Winner is ${state.winner}; only the winner can claim. Keeper stands down.`,
          });
          break;
        }
        await record('plan', `Claim epoch ${state.epochId.toString()} prize`, {
          detail: 'Keeper operator won this epoch; claiming to recycle the pot for the demo loop.',
        });
        const claimResult = await execute('xlayer.claimPrize', 'Claim prize', () =>
          walletClient.writeContract({
            address: hook,
            abi: XLAYER_KEEPER_HOOK_ABI,
            functionName: 'claimPrize',
          }),
        );
        if (!claimResult.ok) break;
        expectAfter = (s) => s.drawClaimed;
        continue; // claimed → next stage may open a fresh epoch
      }

      // ── Stage: idle — open the next epoch (funding/entries first) ────
      const cooldownEndsAt = state.lastDrawAt + state.drawCooldown;
      if (state.lastDrawAt > 0n && state.blockTimestamp < cooldownEndsAt) {
        const waitSeconds = Number(cooldownEndsAt - state.blockTimestamp);
        await record('plan', 'Wait for draw cooldown', {
          detail: `Cooldown ends in ~${Math.ceil(waitSeconds / 60)}m. Waiting is the correct keeper action.`,
        });
        break;
      }

      // openDraw reverts NoEntries when nobody holds shares — the keeper
      // seeds the pool with its own principal so the demo loop is
      // self-sustaining. Disclosed in the run record and on the replay card:
      // the operator becomes a depositor and can win; winnings are claimed
      // and recycled into the testnet pot.
      const potFloor =
        state.minPotForDraw > minDemoPot() ? state.minPotForDraw : minDemoPot();
      const needsFund = state.potBalance < potFloor;
      const needsDeposit = state.totalShares === 0n;

      if (needsFund && state.hookOwner.toLowerCase() !== operator) {
        await record('plan_failed', 'Open next epoch', {
          detail: `Pot ${state.potBalance} is below the minimum ${potFloor} and keeper ${account.address} is not the hook owner — cannot fundPot.`,
        });
        break;
      }

      const shortfall = needsFund ? potFloor - state.potBalance : 0n;
      const fundAmount =
        needsFund && defaultFundAmount() > shortfall ? defaultFundAmount() : shortfall;
      const depositAmount = needsDeposit ? defaultDepositAmount() : 0n;
      const needed = fundAmount + depositAmount;

      if (needed > 0n) {
        const [usdcBalance, allowance] = await Promise.all([
          publicClient.readContract({
            address: usdc,
            abi: XLAYER_ERC20_ABI,
            functionName: 'balanceOf',
            args: [account.address],
          }),
          publicClient.readContract({
            address: usdc,
            abi: XLAYER_ERC20_ABI,
            functionName: 'allowance',
            args: [account.address, hook],
          }),
        ]);

        if ((usdcBalance as bigint) < needed) {
          await record('plan_failed', needsFund ? 'Fund pot' : 'Seed pool entries', {
            detail: `Keeper USDC_TEST balance ${usdcBalance} is below the required ${needed} — top up from the X Layer faucet.`,
          });
          break;
        }

        const planParts: string[] = [];
        if (needsFund) planParts.push(`funding ${fundAmount} to the pot (shortfall ${shortfall})`);
        if (needsDeposit)
          planParts.push(
            `depositing ${depositAmount} of operator principal — disclosed: no depositors yet, and openDraw reverts NoEntries without shares`,
          );
        await record('plan', 'Fund, seed entries, open next epoch', {
          detail: `${planParts.join('; ')}.`,
        });

        if ((allowance as bigint) < needed) {
          const approveResult = await execute('xlayer.approveUsdc', 'Approve USDC spend', () =>
            walletClient.writeContract({
              address: usdc,
              abi: XLAYER_ERC20_ABI,
              functionName: 'approve',
              args: [hook, needed],
            }),
          );
          if (!approveResult.ok) break;
        }

        if (needsFund) {
          const fundResult = await execute('xlayer.fundPot', 'Fund pot (owner)', () =>
            walletClient.writeContract({
              address: hook,
              abi: XLAYER_KEEPER_HOOK_ABI,
              functionName: 'fundPot',
              args: [fundAmount],
            }),
          );
          if (!fundResult.ok) break;
        }

        if (needsDeposit) {
          const depositResult = await execute('xlayer.deposit', 'Deposit operator principal', () =>
            walletClient.writeContract({
              address: hook,
              abi: XLAYER_KEEPER_HOOK_ABI,
              functionName: 'deposit',
              args: [depositAmount],
            }),
          );
          if (!depositResult.ok) break;
          expectAfter = (s) => s.totalShares > 0n;
        }
      } else {
        await record('plan', 'Open next epoch', {
          detail: 'Cooldown elapsed, pot clears the minimum, and shares exist.',
        });
      }

      const openResult = await execute('xlayer.openDraw', 'Open draw', () =>
        walletClient.writeContract({
          address: hook,
          abi: XLAYER_KEEPER_HOOK_ABI,
          functionName: 'openDraw',
        }),
      );
      if (!openResult.ok) break;
      expectAfter = (s) => s.drawOpen && !s.drawResolved;
      continue; // freshly opened → next stage resolves immediately
    }

    return { attempted: true, sessionId, actions };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[XLayerKeeper] Tick failed', { message });
    await record('plan_failed', 'Keeper tick failed', { detail: message });
    return { attempted: true, sessionId, actions, reason: message };
  }
}
