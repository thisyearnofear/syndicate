"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PERMISSIONED_AUTOPILOT_STORAGE_EVENT,
  permissionedAutopilotService,
} from '@/services/metamask/permissionedAutopilotService';
import type { PermissionedAutopilotPolicy } from '@/services/metamask/delegationTypes';

export function usePermissionedAutopilotPolicies() {
  const [policies, setPolicies] = useState<PermissionedAutopilotPolicy[]>(() => (
    typeof window === 'undefined' ? [] : permissionedAutopilotService.getPolicies()
  ));

  const refresh = useCallback(() => {
    setPolicies(permissionedAutopilotService.getPolicies());
  }, []);

  const deactivatePolicy = useCallback((policyId: string) => {
    permissionedAutopilotService.deactivatePolicy(policyId);
    refresh();
  }, [refresh]);

  useEffect(() => {
    window.addEventListener(PERMISSIONED_AUTOPILOT_STORAGE_EVENT, refresh);
    window.addEventListener('storage', refresh);

    return () => {
      window.removeEventListener(PERMISSIONED_AUTOPILOT_STORAGE_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  const activePolicies = useMemo(
    () => policies.filter((policy) => policy.isActive),
    [policies]
  );

  return {
    policies,
    activePolicies,
    refresh,
    deactivatePolicy,
  };
}
