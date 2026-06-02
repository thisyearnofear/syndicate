import type { Address, Hex } from 'viem';
import { TOKENS } from '@/config/contracts';
import type { PermissionedAutopilotDelegation } from './delegationTypes';

export interface OneShotRelayerRequest {
  chainId: number;
  from: Address;
  to: Address;
  data: Hex;
  value?: string;
  permissionId?: string;
  permissionContext?: PermissionedAutopilotDelegation[];
  memo?: string;
}

export interface OneShotRelayerResult {
  success: boolean;
  status: 'submitted' | 'missing-permission-context' | 'failed';
  relayerRequestId?: Hex;
  transactionHash?: Hex;
  error?: string;
}

export type OneShotTaskStatusCode = 100 | 110 | 200 | 400 | 500;

export interface OneShotRelayerStatus {
  id: Hex;
  chainId: string;
  createdAt: number;
  status: OneShotTaskStatusCode;
  memo?: string;
  hash?: Hex;
  message?: string;
  receipt?: {
    blockHash: Hex;
    blockNumber: Hex;
    gasUsed: Hex;
    transactionHash: Hex;
  };
  data?: unknown;
}

interface JsonRpcResponse<T> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

const MAINNET_RELAYER_URL = 'https://relayer.1shotapi.com/relayers';
const TESTNET_RELAYER_URL = 'https://relayer.1shotapi.dev/relayers';

class OneShotRelayerService {
  getEndpoint(chainId: number): string {
    return process.env.ONESHOT_RELAYER_URL
      ?? process.env.NEXT_PUBLIC_ONESHOT_RELAYER_URL
      ?? (chainId === 84532 ? TESTNET_RELAYER_URL : MAINNET_RELAYER_URL);
  }

  isConfigured(chainId = 8453): boolean {
    return Boolean(this.getEndpoint(chainId));
  }

  async submit(request: OneShotRelayerRequest): Promise<OneShotRelayerResult> {
    if (!request.permissionContext?.length) {
      return {
        success: false,
        status: 'missing-permission-context',
        error: 'MetaMask did not return an ERC-7710 permissionContext for this policy. Recreate the autopilot permission before using 1Shot relay.',
      };
    }

    try {
      const taskId = createTaskId(request);
      const result = await this.call<Hex>(
        request.chainId,
        'relayer_send7710Transaction',
        {
          chainId: String(request.chainId),
          transactions: [
            {
              permissionContext: request.permissionContext,
              executions: [
                {
                  target: request.to,
                  value: toHexQuantity(request.value ?? '0'),
                  data: request.data,
                },
              ],
            },
          ],
          taskId,
          memo: request.memo ?? `syndicate-autopilot:${request.permissionId ?? request.from}`,
        }
      );

      return {
        success: true,
        status: 'submitted',
        relayerRequestId: result,
      };
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        error: error instanceof Error ? error.message : '1Shot relayer submission failed.',
      };
    }
  }

  async getCapabilities(chainIds: number[] = [8453]): Promise<unknown> {
    return this.call(
      chainIds[0] ?? 8453,
      'relayer_getCapabilities',
      chainIds.map(String)
    );
  }

  async getStatus(taskId: Hex, chainId = 8453): Promise<OneShotRelayerStatus> {
    return this.call<OneShotRelayerStatus>(
      chainId,
      'relayer_getStatus',
      {
        id: taskId,
        logs: false,
      }
    );
  }

  private async call<T>(chainId: number, method: string, params: unknown): Promise<T> {
    const response = await fetch(this.getEndpoint(chainId), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params: [params],
      }),
    });

    if (!response.ok) {
      throw new Error(`1Shot relayer HTTP ${response.status}`);
    }

    const body = await response.json() as JsonRpcResponse<T>;
    if (body.error) {
      throw new Error(`1Shot relayer ${body.error.code}: ${body.error.message}`);
    }

    if (body.result === undefined) {
      throw new Error('1Shot relayer returned no result.');
    }

    return body.result;
  }
}

export const oneShotRelayerService = new OneShotRelayerService();

function createTaskId(request: OneShotRelayerRequest): Hex {
  const source = [
    request.chainId,
    request.from,
    request.to,
    request.data,
    request.permissionId ?? '',
    Date.now(),
    Math.random().toString(16).slice(2),
  ].join(':');

  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
  }

  const suffix = Math.abs(hash).toString(16).padStart(8, '0');
  return `0x${TOKENS.usdc.address.slice(2).padEnd(56, '0')}${suffix}` as Hex;
}

function toHexQuantity(value: string): Hex {
  if (value.startsWith('0x')) return value as Hex;
  return `0x${BigInt(value).toString(16)}` as Hex;
}
