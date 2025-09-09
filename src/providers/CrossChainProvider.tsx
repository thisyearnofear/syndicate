"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  nearIntentsService, 
  ChainSignatureRequest, 
  CrossChainTransaction 
} from '@/services/nearIntents';
import { useNearWallet } from './NearWalletProvider';

interface CrossChainContextType {
  // Connection state
  isNearConnected: boolean;
  isInitializing: boolean;
  
  // Transaction state
  activeTransactions: CrossChainTransaction[];
  pendingIntents: string[];
  
  // Actions
  initializeNear: () => Promise<boolean>;
  createCrossChainPurchase: (request: ChainSignatureRequest) => Promise<string>;
  getTransactionStatus: (txId: string) => Promise<CrossChainTransaction | null>;
  estimateFees: (request: ChainSignatureRequest) => Promise<any>;
  
  // UI state
  showTransactionModal: boolean;
  setShowTransactionModal: (show: boolean) => void;
  selectedTransaction: CrossChainTransaction | null;
  setSelectedTransaction: (tx: CrossChainTransaction | null) => void;
}

const CrossChainContext = createContext<CrossChainContextType | undefined>(undefined);

interface CrossChainProviderProps {
  children: ReactNode;
}

export function CrossChainProvider({ children }: CrossChainProviderProps) {
  const [isNearConnected, setIsNearConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [activeTransactions, setActiveTransactions] = useState<CrossChainTransaction[]>([]);
  const [pendingIntents, setPendingIntents] = useState<string[]>([]);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<CrossChainTransaction | null>(null);
  
  const { accountId, isConnected: isNearWalletConnected, wallet } = useNearWallet();

  // Poll for transaction updates
  useEffect(() => {
    if (activeTransactions.length > 0) {
      const interval = setInterval(async () => {
        const updatedTransactions = await Promise.all(
          activeTransactions.map(async (tx) => {
            if (tx.status === 'pending' || tx.status === 'signed') {
              const updated = await nearIntentsService.getTransactionStatus(tx.id);
              return updated || tx;
            }
            return tx;
          })
        );
        setActiveTransactions(updatedTransactions);
      }, 3000); // Poll every 3 seconds

      return () => clearInterval(interval);
    }
  }, [activeTransactions]);

  const initializeNear = async (): Promise<boolean> => {
    if (isNearConnected) return true;
    if (!isNearWalletConnected || !accountId || !wallet) {
      console.error('NEAR wallet not connected or accountId not available');
      return false;
    }
    
    setIsInitializing(true);
    try {
      const success = await nearIntentsService.initialize(wallet);
      setIsNearConnected(success);
      return success;
    } catch (error) {
      console.error('Failed to initialize NEAR:', error);
      return false;
    } finally {
      setIsInitializing(false);
    }
  };

  const createCrossChainPurchase = async (request: ChainSignatureRequest): Promise<string> => {
    if (!isNearConnected) {
      throw new Error('NEAR not connected. Please initialize first.');
    }

    try {
      // Create the intent
      const intentId = await nearIntentsService.createCrossChainIntent(request);
      setPendingIntents(prev => [...prev, intentId]);

      // Execute the chain signature
      const transaction = await nearIntentsService.executeChainSignature(intentId);
      
      // Add to active transactions
      setActiveTransactions(prev => [...prev, transaction]);
      
      // Remove from pending intents
      setPendingIntents(prev => prev.filter(id => id !== intentId));
      
      return intentId;
    } catch (error) {
      console.error('Failed to create cross-chain purchase:', error);
      throw error;
    }
  };

  const getTransactionStatus = async (txId: string): Promise<CrossChainTransaction | null> => {
    try {
      return await nearIntentsService.getTransactionStatus(txId);
    } catch (error) {
      console.error('Failed to get transaction status:', error);
      return null;
    }
  };

  const estimateFees = async (request: ChainSignatureRequest) => {
    try {
      return await nearIntentsService.estimateFees(request);
    } catch (error) {
      console.error('Failed to estimate fees:', error);
      throw error;
    }
  };

  const value: CrossChainContextType = {
    // Connection state
    isNearConnected,
    isInitializing,
    
    // Transaction state
    activeTransactions,
    pendingIntents,
    
    // Actions
    initializeNear,
    createCrossChainPurchase,
    getTransactionStatus,
    estimateFees,
    
    // UI state
    showTransactionModal,
    setShowTransactionModal,
    selectedTransaction,
    setSelectedTransaction,
  };

  return (
    <CrossChainContext.Provider value={value}>
      {children}
    </CrossChainContext.Provider>
  );
}

export function useCrossChain() {
  const context = useContext(CrossChainContext);
  if (context === undefined) {
    throw new Error('useCrossChain must be used within a CrossChainProvider');
  }
  return context;
}

// Transaction status component for UI
export function TransactionStatusBadge({ status }: { status: CrossChainTransaction['status'] }) {
  const getStatusConfig = (status: CrossChainTransaction['status']) => {
    switch (status) {
      case 'pending':
        return { color: 'bg-yellow-500', text: 'Pending', icon: '⏳' };
      case 'signed':
        return { color: 'bg-blue-500', text: 'Signed', icon: '✍️' };
      case 'executed':
        return { color: 'bg-green-500', text: 'Complete', icon: '✅' };
      case 'failed':
        return { color: 'bg-red-500', text: 'Failed', icon: '❌' };
      default:
        return { color: 'bg-gray-500', text: 'Unknown', icon: '❓' };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white ${config.color}`}>
      <span>{config.icon}</span>
      {config.text}
    </span>
  );
}

// Cross-chain transaction list component
export function CrossChainTransactionList() {
  const { activeTransactions, setSelectedTransaction, setShowTransactionModal } = useCrossChain();

  if (activeTransactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No cross-chain transactions yet</p>
        <p className="text-sm">Purchase lottery tickets to see your transactions here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activeTransactions.map((tx) => (
        <div
          key={tx.id}
          onClick={() => {
            setSelectedTransaction(tx);
            setShowTransactionModal(true);
          }}
          className="bg-gray-700/50 rounded-lg p-4 cursor-pointer hover:bg-gray-700 transition-colors"
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="font-medium text-white">
                {tx.ticketCount} Lottery Ticket{tx.ticketCount > 1 ? 's' : ''}
              </div>
              <div className="text-sm text-gray-400">
                {tx.sourceChain} → {tx.targetChain}
              </div>
            </div>
            <TransactionStatusBadge status={tx.status} />
          </div>
          
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">
              {new Date(tx.timestamp).toLocaleTimeString()}
            </span>
            <span className="text-blue-400 font-medium">{tx.totalCost}</span>
          </div>
          
          {tx.targetHash && (
            <div className="mt-2 text-xs text-green-400">
              Tx: {tx.targetHash.slice(0, 10)}...{tx.targetHash.slice(-8)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}