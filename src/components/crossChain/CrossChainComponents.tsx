/**
 * Cross-Chain UI Components
 * 
 * Simplified, working React components for cross-chain operations
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import { 
  type CrossChainIntent,
  type IntentStatus,
  type FeeBreakdown,
  type ChainConfig,
  SUPPORTED_CHAINS,
} from '../../services/crossChain/types';

// Component props interfaces
interface CrossChainBridgeProps {
  onIntentCreated?: (intent: CrossChainIntent) => void;
  onTransactionComplete?: (result: any) => void;
  className?: string;
  theme?: 'light' | 'dark';
}

interface ChainSelectorProps {
  selectedChain?: keyof typeof SUPPORTED_CHAINS;
  onChainSelect: (chainId: keyof typeof SUPPORTED_CHAINS) => void;
  excludeChains?: (keyof typeof SUPPORTED_CHAINS)[];
  label?: string;
  disabled?: boolean;
}

interface FeeDisplayProps {
  fees: FeeBreakdown | null;
  loading?: boolean;
  compact?: boolean;
}

interface TransactionStatusProps {
  intent: CrossChainIntent;
  onRetry?: () => void;
  onCancel?: () => void;
  showDetails?: boolean;
}

/**
 * Main Cross-Chain Bridge Component
 */
export const CrossChainBridge = memo<CrossChainBridgeProps>(({
  onIntentCreated,
  onTransactionComplete,
  className = '',
  theme = 'light',
}) => {
  const [sourceChain, setSourceChain] = useState<keyof typeof SUPPORTED_CHAINS>('ethereum');
  const [targetChain, setTargetChain] = useState<keyof typeof SUPPORTED_CHAINS>('polygon');
  const [amount, setAmount] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Memoized chain options
  const chainOptions = useMemo(() => {
    return Object.entries(SUPPORTED_CHAINS).map(([id, config]) => ({
      id: id as keyof typeof SUPPORTED_CHAINS,
      name: config.name,
      type: config.type,
    }));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !recipient || !sourceChain || !targetChain) {
      return;
    }

    setIsLoading(true);
    try {
      // Mock intent creation for now
      const mockIntent: CrossChainIntent = {
        id: `intent_${Date.now()}`,
        sourceChain: SUPPORTED_CHAINS[sourceChain],
        targetChain: SUPPORTED_CHAINS[targetChain],
        userAddress: recipient,
        ticketCount: parseInt(amount) || 1,
        totalAmount: BigInt(parseInt(amount) || 1),
        status: 'pending' as IntentStatus,
        createdAt: new Date(),
      };

      onIntentCreated?.(mockIntent);
      onTransactionComplete?.({ success: true, intent: mockIntent });
    } catch (error) {
      console.error('Transaction failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [amount, recipient, sourceChain, targetChain, onIntentCreated, onTransactionComplete]);

  return (
    <div className={`cross-chain-bridge ${className} ${theme}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <ChainSelector
            selectedChain={sourceChain}
            onChainSelect={setSourceChain}
            label="From Chain"
          />
          <ChainSelector
            selectedChain={targetChain}
            onChainSelect={setTargetChain}
            excludeChains={[sourceChain]}
            label="To Chain"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Ticket Count
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-3 border rounded-lg"
            placeholder="Enter ticket count"
            min="1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Recipient Address
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="w-full p-3 border rounded-lg"
            placeholder="Enter recipient address"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !amount || !recipient}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Processing...' : 'Create Cross-Chain Intent'}
        </button>
      </form>
    </div>
  );
});

/**
 * Chain Selector Component
 */
export const ChainSelector = memo<ChainSelectorProps>(({
  selectedChain,
  onChainSelect,
  excludeChains = [],
  label,
  disabled = false,
}) => {
  const availableChains = useMemo(() => {
    return Object.entries(SUPPORTED_CHAINS)
      .filter(([id]) => !excludeChains.includes(id as keyof typeof SUPPORTED_CHAINS))
      .map(([id, config]) => ({
        id: id as keyof typeof SUPPORTED_CHAINS,
        name: config.name,
        type: config.type,
      }));
  }, [excludeChains]);

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium mb-2">
          {label}
        </label>
      )}
      <select
        value={selectedChain || ''}
        onChange={(e) => onChainSelect(e.target.value as keyof typeof SUPPORTED_CHAINS)}
        disabled={disabled}
        className="w-full p-3 border rounded-lg"
      >
        <option value="">Select Chain</option>
        {availableChains.map(({ id, name, type }) => (
          <option key={id} value={id}>
            {name} ({type.toUpperCase()})
          </option>
        ))}
      </select>
    </div>
  );
});

/**
 * Fee Display Component
 */
export const FeeDisplay = memo<FeeDisplayProps>(({
  fees,
  loading = false,
  compact = false,
}) => {
  if (loading) {
    return (
      <div className="fee-display loading">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!fees) {
    return (
      <div className="fee-display empty">
        <p className="text-gray-500">Enter amount to see fee estimate</p>
      </div>
    );
  }

  const formatFee = (fee: bigint) => {
    return (Number(fee) / 1e18).toFixed(6);
  };

  if (compact) {
    return (
      <div className="fee-display compact">
        <span className="text-sm">
          Total: {formatFee(fees.totalFee)} {fees.currency}
        </span>
      </div>
    );
  }

  return (
    <div className="fee-display detailed space-y-2">
      <h4 className="font-medium">Fee Breakdown</h4>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span>NEAR Gas Fee:</span>
          <span>{formatFee(fees.nearGasFee)} NEAR</span>
        </div>
        <div className="flex justify-between">
          <span>Target Chain Gas:</span>
          <span>{formatFee(fees.targetChainGasFee)} {fees.currency}</span>
        </div>
        <div className="flex justify-between">
          <span>Bridge Fee:</span>
          <span>{formatFee(fees.bridgeFee)} {fees.currency}</span>
        </div>
        <div className="flex justify-between">
          <span>Relayer Fee:</span>
          <span>{formatFee(fees.relayerFee)} {fees.currency}</span>
        </div>
        <div className="flex justify-between font-medium border-t pt-1">
          <span>Total:</span>
          <span>{formatFee(fees.totalFee)} {fees.currency}</span>
        </div>
      </div>
    </div>
  );
});

/**
 * Transaction Status Component
 */
export const TransactionStatus = memo<TransactionStatusProps>(({
  intent,
  onRetry,
  onCancel,
  showDetails = true,
}) => {
  const getStatusColor = (status: IntentStatus) => {
    switch (status) {
      case 'pending':
      case 'signing':
      case 'signed':
      case 'broadcasting':
        return 'text-yellow-600';
      case 'executed':
        return 'text-green-600';
      case 'failed':
      case 'expired':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusText = (status: IntentStatus) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'signing':
        return 'Signing Transaction';
      case 'signed':
        return 'Transaction Signed';
      case 'broadcasting':
        return 'Broadcasting';
      case 'executed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'expired':
        return 'Expired';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="transaction-status">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-medium">Transaction Status</h3>
          <p className={`text-sm ${getStatusColor(intent.status)}`}>
            {getStatusText(intent.status)}
          </p>
        </div>
        
        {(intent.status === 'failed' || intent.status === 'expired') && onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        )}
        
        {intent.status === 'pending' && onCancel && (
          <button
            onClick={onCancel}
            className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Cancel
          </button>
        )}
      </div>

      {showDetails && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Intent ID:</span>
            <span className="font-mono text-xs">{intent.id}</span>
          </div>
          <div className="flex justify-between">
            <span>From:</span>
            <span>{intent.sourceChain.name}</span>
          </div>
          <div className="flex justify-between">
            <span>To:</span>
            <span>{intent.targetChain.name}</span>
          </div>
          <div className="flex justify-between">
            <span>Tickets:</span>
            <span>{intent.ticketCount}</span>
          </div>
          {intent.txHash && (
            <div className="flex justify-between">
              <span>Tx Hash:</span>
              <span className="font-mono text-xs truncate">{intent.txHash}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default {
  CrossChainBridge,
  ChainSelector,
  FeeDisplay,
  TransactionStatus,
};