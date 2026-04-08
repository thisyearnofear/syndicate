export const VAULTS_ROUTE = '/vaults';
export const RANGER_ROUTE = '/ranger';
export const YIELD_STRATEGIES_ROUTE = '/yield-strategies';
export const VAULT_EXECUTION_ROUTE = YIELD_STRATEGIES_ROUTE;

export const YIELD_ENTRY_PARAM = 'entry';
export const YIELD_ENTRY_VAULTS = 'vaults';

export type YieldStrategiesTab = 'overview' | 'strategies' | 'allocation';

export function buildVaultExecutionHref(
  tab: YieldStrategiesTab = 'strategies',
  entry: string = YIELD_ENTRY_VAULTS
): string {
  return `${VAULT_EXECUTION_ROUTE}?tab=${tab}&${YIELD_ENTRY_PARAM}=${entry}`;
}

export function buildYieldStrategiesHref(
  tab: YieldStrategiesTab = 'strategies',
  entry: string = YIELD_ENTRY_VAULTS
): string {
  return buildVaultExecutionHref(tab, entry);
}

export function hasYieldExecutionIntent(
  searchParams: Pick<URLSearchParams, 'get'> | null | undefined
): boolean {
  if (!searchParams) return false;

  const tab = searchParams.get('tab');
  const protocol = searchParams.get('protocol');
  const entry = searchParams.get(YIELD_ENTRY_PARAM);

  if (protocol) return true;

  if (entry !== YIELD_ENTRY_VAULTS) return false;
  if (!tab) return true;
  if (tab === 'overview' || tab === 'strategies' || tab === 'allocation') return true;

  return false;
}
