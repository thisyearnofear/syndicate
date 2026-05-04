'use client';

import { useCallback, useState } from 'react';
import {
  createBridgeActivityId,
  getBridgeActivityHistory,
  updateBridgeActivity,
  upsertBridgeActivity,
  type BridgeActivityRecord,
} from '@/utils/bridgeStateManager';
import { persistBridgeActivityRecord } from '@/services/activity/activityClient';

export function useBridgeActivityTracker() {
  const [bridgeActivityId] = useState(() => createBridgeActivityId());

  const syncBridgeActivity = useCallback(() => {
    const record = getBridgeActivityHistory().find((entry) => entry.id === bridgeActivityId);
    if (!record) return;

    void persistBridgeActivityRecord(record).catch((persistError) => {
      console.warn('[useBridgeActivityTracker] Failed to persist bridge activity:', persistError);
    });
  }, [bridgeActivityId]);

  const createBridgeActivity = useCallback((record: BridgeActivityRecord) => {
    upsertBridgeActivity(record);
    syncBridgeActivity();
  }, [syncBridgeActivity]);

  const patchBridgeActivity = useCallback((
    updates: Partial<Omit<BridgeActivityRecord, 'id' | 'timestamp'>>
  ) => {
    updateBridgeActivity(bridgeActivityId, updates);
    syncBridgeActivity();
  }, [bridgeActivityId, syncBridgeActivity]);

  return {
    bridgeActivityId,
    createBridgeActivity,
    patchBridgeActivity,
  };
}

