/**
 * Agent session transcript ring: append, cap, clear, event broadcast.
 */

import {
  agentSessionTranscript,
  recordAgentTransition,
  AGENT_TRANSCRIPT_EVENT,
} from '@/services/agents/transcript/agentSessionTranscript';
import { getHistory, reset as resetEmitter } from '@/services/observability/emitter';

describe('agentSessionTranscript', () => {
  beforeEach(() => {
    localStorage.clear();
    resetEmitter();
  });

  it('appends entries newest-first and round-trips through storage', () => {
    agentSessionTranscript.append('plan', { sessionId: 'xlayer-abc123', label: 'Plan created (heuristic)' });
    agentSessionTranscript.append('approve', { sessionId: 'xlayer-abc123', label: 'Approved: Open draw', toolId: 'xlayer.openDraw' });

    const entries = agentSessionTranscript.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].kind).toBe('approve');
    expect(entries[1].kind).toBe('plan');
    expect(entries[0].toolId).toBe('xlayer.openDraw');
    expect(entries[0].sessionId).toBe('xlayer-abc123');
  });

  it('caps the ring at 50 entries', () => {
    for (let i = 0; i < 55; i++) {
      agentSessionTranscript.append('plan', { sessionId: `s${i}`, label: `Plan ${i}` });
    }
    const entries = agentSessionTranscript.getEntries();
    expect(entries).toHaveLength(50);
    expect(entries[0].sessionId).toBe('s54');
  });

  it('dispatches an update event on append and clear', () => {
    const onUpdate = jest.fn();
    window.addEventListener(AGENT_TRANSCRIPT_EVENT, onUpdate);
    agentSessionTranscript.append('plan', { sessionId: 'x', label: 'l' });
    agentSessionTranscript.clear();
    expect(onUpdate).toHaveBeenCalledTimes(2);
    window.removeEventListener(AGENT_TRANSCRIPT_EVENT, onUpdate);
  });

  it('clear empties the ring', () => {
    agentSessionTranscript.append('plan', { sessionId: 'x', label: 'l' });
    agentSessionTranscript.clear();
    expect(agentSessionTranscript.getEntries()).toEqual([]);
  });
});

describe('recordAgentTransition', () => {
  beforeEach(() => {
    localStorage.clear();
    resetEmitter();
  });

  it('emits a structured agent lifecycle event AND persists a transcript entry', () => {
    recordAgentTransition('agent.step_completed', 'complete', {
      sessionId: 'xlayer-session',
      toolId: 'xlayer.claimPrize',
      label: 'Completed: Claim prize',
      detail: 'Pot transferred',
      txHash: '0xdeadbeef',
    });

    const transcript = agentSessionTranscript.getEntries();
    expect(transcript).toHaveLength(1);
    expect(transcript[0].txHash).toBe('0xdeadbeef');

    const events = getHistory();
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('agent.step_completed');
    expect(events[0].category).toBe('agent');
    expect(events[0].transactionHash).toBe('0xdeadbeef');
  });

  it('attaches structured error info for failure transitions', () => {
    recordAgentTransition('agent.step_failed', 'fail', {
      sessionId: 'xlayer-session',
      toolId: 'xlayer.openDraw',
      label: 'Failed: Open draw',
      detail: 'Cooldown not elapsed',
      errorMessage: 'Cooldown not elapsed',
    });

    const event = getHistory()[0];
    expect(event.error).toEqual({
      code: 'AGENT_ERROR',
      message: 'Cooldown not elapsed',
      phase: 'fail',
      userCancelled: false,
    });
  });

  it('records session resets as their own event, not plan creations', () => {
    recordAgentTransition('agent.session_reset', 'reset', {
      sessionId: 'xlayer-session',
      label: 'Session reset',
      detail: 'Plan discarded; a fresh session memory follows',
    });

    const transcript = agentSessionTranscript.getEntries();
    expect(transcript[0].kind).toBe('reset');

    const event = getHistory()[0];
    expect(event.name).toBe('agent.session_reset');
    expect(event.category).toBe('agent');
    expect(event.error).toBeNull();
  });
});
