import {
  applyPlan,
  approveStep,
  autoCompleteReadOnlySteps,
  beginExecuteStep,
  buildPlanFromKeeperRecommendation,
  createInitialAgentLoopState,
  observeStep,
  rejectStep,
} from '@/services/agents/loop/agentLoop';
import { buildPlanFromBaseYieldContext } from '@/services/agents/loop/baseAgentPlan';
import { __resetAgentToolRegistryForTests } from '@/services/agents/tools/registry';
import { ensureXLayerToolsRegistered } from '@/services/agents/tools/xlayerTools';
import { ensureBaseToolsRegistered } from '@/services/agents/tools/baseTools';
import type { XLayerKeeperRecommendation } from '@/services/agents/veniceXLayerKeeper';

jest.mock('@/config/capabilities', () => ({
  getCapability: (id: string) => ({
    id,
    label: 'X Layer Prize Pool',
    status: 'testnet',
    chains: ['xlayer_testnet'],
    readsEnabled: true,
    writesEnabled: false,
    requiresOptIn: false,
    testnetOnly: true,
    availabilityMessage: null,
    walletRequirement: null,
    productMode: null,
  }),
}));

describe('agent loop + X Layer tools', () => {
  beforeEach(() => {
    __resetAgentToolRegistryForTests();
    ensureXLayerToolsRegistered();
  });

  const recommendation = (
    action: XLayerKeeperRecommendation['action'],
  ): XLayerKeeperRecommendation => ({
    action,
    shouldOpenDraw: action === 'open_draw',
    recommendedSurchargeBps: 100,
    surchargeChangeAllowedNow: false,
    demoOracleValue: action === 'set_oracle' || action === 'fulfill_randomness' ? '42' : null,
    amountUsdc: action === 'deposit' || action === 'fund_pot' ? '5.00' : null,
    rationale: ['test'],
    warnings: ['demo oracle'],
    source: 'heuristic',
  });

  it('builds a plan with read-only tools plus HITL openDraw', () => {
    const plan = buildPlanFromKeeperRecommendation(recommendation('open_draw'), { pot: 1 }, 0);
    expect(plan.steps.map((s) => s.toolId)).toEqual([
      'xlayer.getPoolState',
      'xlayer.recommendSurcharge',
      'xlayer.openDraw',
    ]);
    expect(plan.steps[2].status).toBe('proposed');
  });

  it('builds a deposit plan with amountUsdc when shares are missing', () => {
    const plan = buildPlanFromKeeperRecommendation(recommendation('deposit'), { pot: 0 }, 0);
    expect(plan.steps.map((s) => s.toolId)).toContain('xlayer.deposit');
    const deposit = plan.steps.find((s) => s.toolId === 'xlayer.deposit')!;
    expect(deposit.args.amountUsdc).toBe('5.00');
  });

  it('auto-completes read-only steps and requires approve before execute', () => {
    let state = createInitialAgentLoopState();
    const plan = buildPlanFromKeeperRecommendation(recommendation('open_draw'), { pot: 1 }, 0);
    state = applyPlan(state, plan);
    state = autoCompleteReadOnlySteps(state, (step) => ({
      ok: true,
      message: `ran ${step.toolId}`,
    }));

    const reads = state.plan!.steps.filter(
      (s) => s.toolId === 'xlayer.getPoolState' || s.toolId === 'xlayer.recommendSurcharge',
    );
    expect(reads.every((s) => s.status === 'completed')).toBe(true);

    const open = state.plan!.steps.find((s) => s.toolId === 'xlayer.openDraw')!;
    expect(open.status).toBe('proposed');

    const blocked = beginExecuteStep(state, open.id);
    expect(blocked.error).toMatch(/requires approval/i);

    state = approveStep(state, open.id);
    expect(state.plan!.steps.find((s) => s.id === open.id)?.status).toBe('approved');

    state = beginExecuteStep(state, open.id);
    expect(state.status).toBe('executing');

    state = observeStep(state, open.id, {
      ok: true,
      message: 'done',
      transactionHash: '0xabc',
      receiptConfirmed: true,
    });
    expect(state.plan!.steps.find((s) => s.id === open.id)?.status).toBe('completed');
    expect(state.memory.lastTxHash).toBe('0xabc');
  });

  it('rejects incomplete receipt for receipt-required tools', () => {
    let state = createInitialAgentLoopState();
    const plan = buildPlanFromKeeperRecommendation(recommendation('open_draw'), {}, 0);
    state = applyPlan(state, plan);
    const open = state.plan!.steps.find((s) => s.toolId === 'xlayer.openDraw')!;
    state = approveStep(state, open.id);
    state = beginExecuteStep(state, open.id);
    state = observeStep(state, open.id, {
      ok: true,
      message: 'signed but no receipt',
      transactionHash: '0xabc',
      receiptConfirmed: false,
    });
    const step = state.plan!.steps.find((s) => s.id === open.id)!;
    expect(step.status).toBe('failed');
    expect(step.result?.ok).toBe(false);
  });

  it('reject removes pending HITL step from memory', () => {
    let state = createInitialAgentLoopState();
    const plan = buildPlanFromKeeperRecommendation(recommendation('claim_prize'), {}, 1);
    state = applyPlan(state, plan);
    const claim = state.plan!.steps.find((s) => s.toolId === 'xlayer.claimPrize')!;
    expect(state.memory.pendingStepIds).toContain(claim.id);
    state = rejectStep(state, claim.id);
    expect(state.memory.pendingStepIds).not.toContain(claim.id);
    expect(state.plan!.steps.find((s) => s.id === claim.id)?.status).toBe('rejected');
  });

  it('blocks deposit when write gate is required and writes are disabled', () => {
    let state = createInitialAgentLoopState();
    const plan = buildPlanFromKeeperRecommendation(recommendation('deposit'), {}, 0);
    state = applyPlan(state, plan);
    const deposit = state.plan!.steps.find((s) => s.toolId === 'xlayer.deposit')!;
    state = approveStep(state, deposit.id);
    expect(state.plan!.steps.find((s) => s.id === deposit.id)?.status).toBe('failed');
    expect(state.error).toMatch(/WRITES_ENABLED|writes/i);
  });
});

describe('Base yield agent plan', () => {
  beforeEach(() => {
    __resetAgentToolRegistryForTests();
    ensureBaseToolsRegistered();
  });

  it('builds advisory yield tools including policy proposal', () => {
    const plan = buildPlanFromBaseYieldContext({
      yieldUsdc: 4,
      maxSpendUsdc: 10,
      ticketCount: 5,
      sourceVault: 'spark',
      advice: {
        sourceVault: 'spark',
        period: 'weekly',
        maxSpendUsdc: '5.00',
        ticketCount: 5,
        rationale: ['cap spend'],
        warnings: ['review'],
      },
    });
    expect(plan.chain).toBe('base');
    expect(plan.steps.map((s) => s.toolId)).toEqual([
      'base.getYieldSnapshot',
      'base.planYieldSpend',
      'base.proposeAutopilotPolicy',
    ]);
    expect(plan.steps.every((s) => s.status === 'proposed')).toBe(true);
  });
});
