import { BrowserProvider, Contract, toBeHex } from 'ethers';
import {
  LIFI_DESTINATION_CHAIN_ID,
  LIFI_DESTINATION_TOKEN,
  LIFI_STATUS_POLL_INTERVAL_MS,
  LIFI_STATUS_TIMEOUT_MS,
} from '@/config/lifi';
import type {
  BridgeEstimate,
  BridgeParams,
  BridgeProtocol,
  BridgeResult,
  ChainIdentifier,
  ProtocolHealth,
} from '../types';
import { BridgeError, BridgeErrorCode } from '../types';

interface LifiQuoteResponse {
  id: string;
  tool: string;
  toolDetails?: {
    key?: string;
    name?: string;
  };
  action: {
    fromChainId: number;
    toChainId: number;
    fromAmount: string;
    fromToken: {
      address: string;
      symbol: string;
      decimals: number;
      chainId: number;
    };
    toToken: {
      address: string;
      symbol: string;
      decimals: number;
      chainId: number;
    };
  };
  estimate: {
    approvalAddress?: string;
    executionDuration?: number;
    feeCosts?: Array<{ amountUSD?: string }>;
    gasCosts?: Array<{ amountUSD?: string }>;
  };
  transactionRequest?: {
    to: string;
    data?: string;
    value?: string;
    gasLimit?: string;
    gasPrice?: string;
  };
}

interface LifiStatusResponse {
  status: 'PENDING' | 'DONE' | 'FAILED' | 'INVALID' | 'NOT_FOUND';
  substatus?: string;
  receiving?: {
    txHash?: string;
  };
}

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
] as const;

function toWalletHex(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('0x')) return value;

  try {
    return toBeHex(BigInt(value));
  } catch {
    return undefined;
  }
}

export class LifiProtocol implements BridgeProtocol {
  readonly name = 'lifi' as const;

  private successCount = 0;
  private failureCount = 0;
  private totalTimeMs = 0;
  private lastFailure?: Date;

  supports(sourceChain: ChainIdentifier, destinationChain: ChainIdentifier): boolean {
    return sourceChain === 'ethereum' && destinationChain === 'base';
  }

  async estimate(params: BridgeParams): Promise<BridgeEstimate> {
    const quote = await this.fetchQuote(params);
    return {
      fee: this.getEstimatedFeeUsd(quote).toFixed(2),
      timeMs: (quote.estimate.executionDuration || 300) * 1000,
      gasEstimate: quote.transactionRequest?.gasLimit || undefined,
    };
  }

  async bridge(params: BridgeParams): Promise<BridgeResult> {
    const startTime = Date.now();

    try {
      const quote = await this.fetchQuote(params);
      const provider = await this.getBrowserProvider();
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      const fromChainId = this.getSourceChainId(params, quote);

      params.onStatus?.('validating', {
        protocol: this.name,
        fromChainId,
        tool: quote.toolDetails?.name || quote.tool,
      });

      await this.ensureCorrectChain(provider, fromChainId);
      await this.ensureApprovalIfNeeded(quote, signerAddress, signer, provider, params);

      if (!quote.transactionRequest?.to) {
        throw new BridgeError(
          BridgeErrorCode.TRANSACTION_FAILED,
          'LI.FI quote did not return executable transaction data',
          this.name
        );
      }

      params.onStatus?.('pending_signature', {
        protocol: this.name,
        tool: quote.toolDetails?.name || quote.tool,
      });

      const txHash = await (window as any).ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: signerAddress,
          to: quote.transactionRequest.to,
          data: quote.transactionRequest.data || '0x',
          value: toWalletHex(quote.transactionRequest.value) || '0x0',
          gas: toWalletHex(quote.transactionRequest.gasLimit),
          gasPrice: toWalletHex(quote.transactionRequest.gasPrice),
        }],
      });

      params.onStatus?.('waiting_attestation', {
        protocol: this.name,
        txHash,
      });

      const status = await this.pollStatus(quote, txHash);
      if (status.status !== 'DONE') {
        throw new BridgeError(
          BridgeErrorCode.TRANSACTION_FAILED,
          `LI.FI transfer failed${status.substatus ? `: ${status.substatus}` : ''}`,
          this.name
        );
      }

      const actualTimeMs = Date.now() - startTime;
      this.successCount++;
      this.totalTimeMs += actualTimeMs;

      params.onStatus?.('complete', {
        protocol: this.name,
        txHash,
        destinationTxHash: status.receiving?.txHash,
      });

      return {
        success: true,
        protocol: this.name,
        status: 'complete',
        sourceTxHash: txHash,
        destinationTxHash: status.receiving?.txHash,
        bridgeId: quote.id,
        actualTimeMs,
        estimatedTimeMs: (quote.estimate.executionDuration || 300) * 1000,
        bridgeFee: this.getEstimatedFeeUsd(quote).toFixed(2),
        details: {
          fromChainId,
          toChainId: quote.action.toChainId,
          tool: quote.toolDetails?.name || quote.tool,
        },
      };
    } catch (error) {
      this.failureCount++;
      this.lastFailure = new Date();

      return {
        success: false,
        protocol: this.name,
        status: 'failed',
        error: error instanceof Error ? error.message : 'LI.FI bridge failed',
        errorCode:
          error instanceof BridgeError ? error.code : BridgeErrorCode.TRANSACTION_FAILED,
      };
    }
  }

  async getHealth(): Promise<ProtocolHealth> {
    const total = this.successCount + this.failureCount;
    const successRate = total > 0 ? this.successCount / total : 0.96;
    const averageTimeMs = this.successCount > 0 ? this.totalTimeMs / this.successCount : 300_000;

    return {
      protocol: this.name,
      isHealthy: successRate >= 0.75,
      successRate,
      averageTimeMs,
      lastFailure: this.lastFailure,
      consecutiveFailures: this.failureCount,
      estimatedFee: '0.25',
    };
  }

  async validate(params: BridgeParams): Promise<{ valid: boolean; error?: string }> {
    if (!this.supports(params.sourceChain, params.destinationChain)) {
      return { valid: false, error: 'LI.FI currently supports EVM -> Base in this app.' };
    }

    if (!params.sourceAddress?.startsWith('0x') || !params.destinationAddress?.startsWith('0x')) {
      return { valid: false, error: 'LI.FI requires EVM source and destination addresses.' };
    }

    if (!params.amount || Number(params.amount) <= 0) {
      return { valid: false, error: 'Amount must be greater than zero.' };
    }

    return { valid: true };
  }

  private getSourceChainId(params: BridgeParams, quote?: LifiQuoteResponse): number {
    const optionValue = params.options?.sourceChainId;
    if (typeof optionValue === 'number') {
      return optionValue;
    }

    if (typeof optionValue === 'string' && optionValue) {
      const parsed = Number(optionValue);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    if (quote?.action.fromChainId) {
      return quote.action.fromChainId;
    }

    return 1;
  }

  private async fetchQuote(params: BridgeParams): Promise<LifiQuoteResponse> {
    const url = new URL('/api/lifi/quote', window.location.origin);
    url.searchParams.set('fromChain', String(this.getSourceChainId(params)));
    url.searchParams.set('toChain', String(LIFI_DESTINATION_CHAIN_ID));
    url.searchParams.set('fromToken', params.tokenAddress || params.token || 'USDC');
    url.searchParams.set('toToken', LIFI_DESTINATION_TOKEN);
    url.searchParams.set('fromAddress', params.sourceAddress);
    url.searchParams.set('toAddress', params.destinationAddress);
    url.searchParams.set('fromAmount', this.toBaseUnitAmount(params.amount));
    url.searchParams.set('integrator', 'syndicate');

    const response = await fetch(url.toString(), { cache: 'no-store' });
    const data = await response.json();

    if (!response.ok) {
      throw new BridgeError(
        BridgeErrorCode.NETWORK_ERROR,
        data?.message || data?.error || 'Failed to fetch LI.FI quote',
        this.name
      );
    }

    return data as LifiQuoteResponse;
  }

  private toBaseUnitAmount(amount: string): string {
    const [wholePart, fractionalPart = ''] = amount.split('.');
    const whole = BigInt(wholePart || '0') * 1_000_000n;
    const fractional = BigInt((fractionalPart.padEnd(6, '0').slice(0, 6)) || '0');
    return (whole + fractional).toString();
  }

  private getEstimatedFeeUsd(quote: LifiQuoteResponse): number {
    return [...(quote.estimate.feeCosts || []), ...(quote.estimate.gasCosts || [])].reduce(
      (sum, item) => sum + Number(item.amountUSD || 0),
      0
    );
  }

  private async getBrowserProvider(): Promise<BrowserProvider> {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      throw new BridgeError(
        BridgeErrorCode.WALLET_REJECTED,
        'An EVM wallet is required for LI.FI transfers.',
        this.name
      );
    }

    return new BrowserProvider((window as any).ethereum);
  }

  private async ensureCorrectChain(provider: BrowserProvider, sourceChainId: number): Promise<void> {
    const network = await provider.getNetwork();
    if (Number(network.chainId) === sourceChainId) {
      return;
    }

    await (window as any).ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${sourceChainId.toString(16)}` }],
    });
  }

  private async ensureApprovalIfNeeded(
    quote: LifiQuoteResponse,
    signerAddress: string,
    signer: Awaited<ReturnType<BrowserProvider['getSigner']>>,
    provider: BrowserProvider,
    params: BridgeParams
  ): Promise<void> {
    const approvalAddress = quote.estimate.approvalAddress;
    const tokenAddress = quote.action.fromToken.address;

    if (!approvalAddress || tokenAddress.toLowerCase() === '0x0000000000000000000000000000000000000000') {
      return;
    }

    params.onStatus?.('checking_allowance', {
      protocol: this.name,
      spender: approvalAddress,
    });

    const token = new Contract(tokenAddress, ERC20_ABI, signer);
    const currentAllowance = BigInt((await token.allowance(signerAddress, approvalAddress)).toString());
    const requiredAmount = BigInt(quote.action.fromAmount);

    if (currentAllowance >= requiredAmount) {
      return;
    }

    params.onStatus?.('approving', {
      protocol: this.name,
      spender: approvalAddress,
    });

    const approveTx = await token.approve(approvalAddress, requiredAmount);
    await provider.waitForTransaction(approveTx.hash);

    params.onStatus?.('approved', {
      protocol: this.name,
      txHash: approveTx.hash,
    });
  }

  private async pollStatus(quote: LifiQuoteResponse, txHash: string): Promise<LifiStatusResponse> {
    const deadline = Date.now() + LIFI_STATUS_TIMEOUT_MS;
    const url = new URL('/api/lifi/status', window.location.origin);
    url.searchParams.set('txHash', txHash);
    url.searchParams.set('fromChain', String(quote.action.fromChainId));
    url.searchParams.set('toChain', String(quote.action.toChainId));
    url.searchParams.set('bridge', quote.toolDetails?.key || quote.tool);

    while (Date.now() < deadline) {
      const response = await fetch(url.toString(), { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) {
        throw new BridgeError(
          BridgeErrorCode.NETWORK_ERROR,
          data?.error || 'Failed to fetch LI.FI status',
          this.name
        );
      }

      const status = data as LifiStatusResponse;
      if (status.status === 'DONE' || status.status === 'FAILED' || status.status === 'INVALID') {
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, LIFI_STATUS_POLL_INTERVAL_MS));
    }

    throw new BridgeError(
      BridgeErrorCode.TRANSACTION_TIMEOUT,
      'Timed out waiting for LI.FI route completion',
      this.name
    );
  }
}

export const lifiProtocol = new LifiProtocol();
