const DEFAULT_RANGER_API_BASE_URL = 'https://api.ranger.finance';
const DEFAULT_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const RANGER_API_OVERRIDE_KEY = 'syndicate:ranger-api-base-url';

export interface RangerVaultDetails {
  pubkey?: string;
  name?: string;
  symbol?: string;
  asset?: {
    mint?: string;
    symbol?: string;
    decimals?: number;
  };
  apy?: number;
  tvl?: string;
  allocations?: Array<{
    adaptor?: string;
    strategy?: string;
    value?: string;
    weightBps?: number;
  }>;
  raw: unknown;
}

export interface RangerDepositTransactionRequest {
  userPubkey: string;
  lamportAmount: string;
  assetMint?: string;
  assetTokenProgram?: string;
}

export interface RangerPreparedTransaction {
  transaction?: string;
  tx?: string;
  message?: string;
  raw: unknown;
}

function getRangerApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const override = window.localStorage.getItem(RANGER_API_OVERRIDE_KEY);
    if (override) {
      return override;
    }
  }

  return process.env.NEXT_PUBLIC_RANGER_API_BASE_URL || DEFAULT_RANGER_API_BASE_URL;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function requestRanger<T>(
  path: string,
  init?: RequestInit,
  transform?: (payload: unknown) => T
): Promise<T> {
  const response = await fetch(`${getRangerApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      `Ranger API request failed (${response.status}): ${
        typeof payload === 'string' ? payload : JSON.stringify(payload)
      }`
    );
  }

  return transform ? transform(payload) : (payload as T);
}

function normalizeVaultDetails(payload: unknown): RangerVaultDetails {
  const value = (payload ?? {}) as Record<string, unknown>;
  const asset = (value.asset ?? value.underlyingAsset ?? {}) as Record<string, unknown>;
  const allocations = Array.isArray(value.allocations) ? value.allocations : [];

  return {
    pubkey: (value.pubkey ?? value.vaultPubkey ?? value.address) as string | undefined,
    name: value.name as string | undefined,
    symbol: value.symbol as string | undefined,
    asset: {
      mint: (asset.mint ?? asset.address) as string | undefined,
      symbol: asset.symbol as string | undefined,
      decimals: asset.decimals as number | undefined,
    },
    apy: typeof value.apy === 'number' ? value.apy : undefined,
    tvl:
      typeof value.tvl === 'string'
        ? value.tvl
        : typeof value.totalValueLocked === 'string'
        ? (value.totalValueLocked as string)
        : undefined,
    allocations: allocations.map((allocation) => {
      const item = allocation as Record<string, unknown>;
      return {
        adaptor: (item.adaptor ?? item.adapter ?? item.protocol) as string | undefined,
        strategy: (item.strategy ?? item.name) as string | undefined,
        value: (item.value ?? item.amount) as string | undefined,
        weightBps: item.weightBps as number | undefined,
      };
    }),
    raw: payload,
  };
}

function normalizePreparedTransaction(payload: unknown): RangerPreparedTransaction {
  const value = (payload ?? {}) as Record<string, unknown>;
  return {
    transaction: (value.transaction ?? value.serializedTransaction) as string | undefined,
    tx: value.tx as string | undefined,
    message: value.message as string | undefined,
    raw: payload,
  };
}

export async function fetchRangerVaultDetails(
  vaultPubkey: string
): Promise<RangerVaultDetails> {
  return requestRanger(
    `/vault/${vaultPubkey}`,
    { method: 'GET' },
    normalizeVaultDetails
  );
}

export async function createRangerDepositTransaction(
  vaultPubkey: string,
  request: RangerDepositTransactionRequest
): Promise<RangerPreparedTransaction> {
  return requestRanger(
    `/vault/${vaultPubkey}/deposit`,
    {
      method: 'POST',
      body: JSON.stringify({
        ...request,
        assetMint: request.assetMint || DEFAULT_USDC_MINT,
      }),
    },
    normalizePreparedTransaction
  );
}

export function usdcToLamports(amount: string, decimals = 6): string {
  const trimmed = amount.trim();
  if (!trimmed) return '0';

  const [wholePart, fractionalPart = ''] = trimmed.split('.');
  const safeWhole = wholePart.replace(/\D/g, '') || '0';
  const safeFraction = fractionalPart.replace(/\D/g, '').slice(0, decimals);
  const paddedFraction = safeFraction.padEnd(decimals, '0');

  return `${safeWhole}${paddedFraction}`.replace(/^0+(?=\d)/, '') || '0';
}

export function getRangerVaultManageUrl(vaultPubkey: string): string {
  return `https://vaults.ranger.finance/manage/${vaultPubkey}`;
}

export function getStoredRangerApiOverride(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(RANGER_API_OVERRIDE_KEY) || '';
}

export function setStoredRangerApiOverride(baseUrl: string): void {
  if (typeof window === 'undefined') return;

  const trimmed = baseUrl.trim();
  if (!trimmed) {
    window.localStorage.removeItem(RANGER_API_OVERRIDE_KEY);
    return;
  }

  window.localStorage.setItem(RANGER_API_OVERRIDE_KEY, trimmed.replace(/\/+$/, ''));
}

export function getEffectiveRangerApiBaseUrl(): string {
  return getRangerApiBaseUrl();
}

export async function probeRangerApiBaseUrl(): Promise<{
  ok: boolean;
  status: number | null;
  body: string;
}> {
  try {
    const response = await fetch(`${getRangerApiBaseUrl()}/vault/invalid-test-pubkey`, {
      method: 'GET',
    });
    const body = await response.text();

    return {
      ok: response.ok || response.status === 400 || response.status === 404,
      status: response.status,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      body: error instanceof Error ? error.message : 'Unknown network error',
    };
  }
}
