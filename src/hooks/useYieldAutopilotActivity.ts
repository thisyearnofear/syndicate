"use client";

import { useCallback, useEffect, useState } from 'react';
import {
  type YieldAutopilotActivity,
  yieldAutopilotAgent,
} from '@/services/agents/yieldAutopilotAgent';
import { usePermissionedAutopilotPolicies } from './usePermissionedAutopilotPolicies';

export function useYieldAutopilotActivity() {
  const { activePolicies } = usePermissionedAutopilotPolicies();
  const [activity, setActivity] = useState<YieldAutopilotActivity[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  const refresh = useCallback(async () => {
    if (activePolicies.length === 0) {
      setActivity([]);
      return;
    }

    setIsChecking(true);
    try {
      const results = await Promise.all(
        activePolicies.map((policy) => yieldAutopilotAgent.planPolicy(policy))
      );
      setActivity(results);
    } finally {
      setIsChecking(false);
    }
  }, [activePolicies]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [refresh]);

  return {
    activity,
    isChecking,
    refresh,
  };
}
