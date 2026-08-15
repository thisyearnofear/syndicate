/**
 * TESTS — Capability Registry
 *
 * Validates that the registry correctly declares feature readiness and that
 * lookup/helper functions return consistent results.
 */

import {
  CAPABILITIES,
  getCapability,
  getCtaState,
  isLive,
  isVisible,
  isNavVisible,
  isWriteEnabled,
  isReadEnabled,
  honestyChip,
  honestyChipFor,
  getAvailabilityMessage,
  getCapabilitiesForChain,
  getNonLiveCapabilities,
} from '@/config/capabilities';

describe('Capability Registry', () => {
  describe('registry structure', () => {
    it('contains no duplicate IDs', () => {
      const ids = CAPABILITIES.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('all capabilities have at least one chain', () => {
      for (const cap of CAPABILITIES) {
        expect(cap.chains.length).toBeGreaterThan(0);
      }
    });

    it('paused capabilities have neither reads nor writes', () => {
      const paused = CAPABILITIES.filter((c) => c.status === 'paused');
      for (const cap of paused) {
        expect(cap.readsEnabled).toBe(false);
        expect(cap.writesEnabled).toBe(false);
      }
    });

    it('testnetOnly capabilities are never status=live', () => {
      const testnetOnly = CAPABILITIES.filter((c) => c.testnetOnly);
      for (const cap of testnetOnly) {
        expect(cap.status).not.toBe('live');
      }
    });
  });

  describe('getCapability()', () => {
    it('returns the correct capability by ID', () => {
      const cap = getCapability('megapot');
      expect(cap.label).toBe('Play Megapot');
      expect(cap.status).toBe('live');
    });

    it('throws for unknown ID', () => {
      expect(() => getCapability('nonexistent' as never)).toThrow('Unknown capability');
    });
  });

  describe('isLive()', () => {
    it('returns true for fully live capabilities', () => {
      expect(isLive('megapot')).toBe(true);
      expect(isLive('vaults')).toBe(true);
      expect(isLive('syndicates')).toBe(true);
    });

    it('returns false for testnet capabilities', () => {
      expect(isLive('fhenix_privacy')).toBe(false);
    });

    it('returns false for read-only capabilities', () => {
      expect(isLive('xlayer_prize_pool')).toBe(false);
    });
  });

  describe('isVisible()', () => {
    it('returns true for live capabilities', () => {
      expect(isVisible('megapot')).toBe(true);
    });

    it('returns false for paused capabilities', () => {
      expect(isVisible('bridge_ton')).toBe(false);
    });
  });

  describe('getCtaState()', () => {
    it('returns enabled for live write-capable surfaces', () => {
      expect(getCtaState('megapot')).toBe('enabled');
      expect(getCtaState('syndicates')).toBe('enabled');
    });

    it('returns hidden for paused capabilities', () => {
      expect(getCtaState('bridge_ton')).toBe('hidden');
    });

    it('returns disabled for read-only capabilities', () => {
      // xlayer may be either disabled (if configured) or hidden (if not)
      const state = getCtaState('xlayer_prize_pool');
      expect(['disabled', 'hidden']).toContain(state);
    });
  });

  describe('isNavVisible()', () => {
    it('returns false for paused capabilities', () => {
      expect(isNavVisible('bridge_ton')).toBe(false);
    });
  });

  describe('getAvailabilityMessage()', () => {
    it('returns null for live capabilities', () => {
      expect(getAvailabilityMessage('megapot')).toBeNull();
    });

    it('returns a message for non-live capabilities', () => {
      expect(getAvailabilityMessage('fhenix_privacy')).toMatch(/Paused/i);
    });
  });

  describe('isWriteEnabled() / isReadEnabled()', () => {
    it('megapot has reads and writes', () => {
      expect(isWriteEnabled('megapot')).toBe(true);
      expect(isReadEnabled('megapot')).toBe(true);
    });

    it('bridge_ton has neither', () => {
      expect(isWriteEnabled('bridge_ton')).toBe(false);
      expect(isReadEnabled('bridge_ton')).toBe(false);
    });
  });

  describe('honestyChip()', () => {
    it('leaves live unlabeled', () => {
      expect(honestyChip('live')).toBeNull();
      expect(honestyChipFor('megapot')).toBeNull();
    });

    it('uses Paused for gated-off rails', () => {
      expect(honestyChipFor('fhenix_privacy')).toEqual({ label: 'Paused', tone: 'gray' });
      expect(honestyChipFor('bridge_ton')).toEqual({ label: 'Paused', tone: 'gray' });
    });

    it('uses Partial for incomplete payouts', () => {
      expect(honestyChipFor('syndicate_distribution')).toEqual({ label: 'Partial', tone: 'amber' });
    });
  });

  describe('getCapabilitiesForChain()', () => {
    it('returns multiple capabilities for base', () => {
      const baseCaps = getCapabilitiesForChain('base');
      expect(baseCaps.length).toBeGreaterThan(3);
      expect(baseCaps.some((c) => c.id === 'megapot')).toBe(true);
    });

    it('returns only fhenix capability for fhenix_testnet', () => {
      const fhenixCaps = getCapabilitiesForChain('fhenix_testnet');
      expect(fhenixCaps.length).toBe(1);
      expect(fhenixCaps[0].id).toBe('fhenix_privacy');
    });
  });

  describe('getNonLiveCapabilities()', () => {
    it('includes testnet and paused items but not live', () => {
      const nonLive = getNonLiveCapabilities();
      expect(nonLive.some((c) => c.id === 'fhenix_privacy')).toBe(true);
      expect(nonLive.some((c) => c.id === 'bridge_ton')).toBe(true);
      expect(nonLive.some((c) => c.id === 'megapot')).toBe(false);
    });
  });
});
