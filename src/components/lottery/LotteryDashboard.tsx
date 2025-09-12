// Enhanced Lottery Dashboard Component
// Consolidated component incorporating all lottery functionality
// Follows Core Principles: ENHANCEMENT FIRST, DRY, CLEAN, MODULAR

import { getChainConfig } from '@/config/chains';
import React, { useState, useEffect } from 'react';
import { useMegapot, useJackpotDisplay, useUserStatsDisplay } from '@/providers/MegapotProvider';
import { useAccount, useChainId, useWalletClient } from 'wagmi';
import { useTransactionStatus } from '@/hooks/useMegapot';
import { useSmartAccount, useGaslessTransaction, useDeploySmartAccount } from '@/hooks/useSmartAccount';
import { useCrossChain } from '@/providers/CrossChainProvider';
import { useNearWalletConnection } from '@/providers/NearWalletProvider';
import { nearIntentsService } from '@/services/nearIntents';
import { unifiedTicketService, type PurchaseMethod, type TicketPurchaseOptions } from '@/services/unifiedTicketService';
import { base, avalanche } from 'viem/chains';
import { formatUnits } from 'viem';
import SNSDomainSearch from '../SNSDomainSearch';
import CrossChainBridgeStatus from '../CrossChainBridgeStatus';
import UserDashboard from '../UserDashboard';
import DelightfulButton from '@/components/core/DelightfulButton';
import TicketPurchaseAnimation from '../TicketPurchaseAnimation';
import CelebrationModal from '@/components/modal/CelebrationModal';
import NearWalletConnection from '@/components/wallet/NearWalletConnection';

interface LotteryDashboardProps {
  className?: string;
  syndicateId?: string;
  causeAllocation?: number;
  isFlask?: boolean;
}

function LotteryDashboard({ 
  className = '', 
  syndicateId, 
  causeAllocation = 20, 
  isFlask = false 
}: LotteryDashboardProps) {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  
  // Megapot hooks
  const {
    purchaseTickets,
    approveUsdc,
    isPurchasing,
    isApproving,
    purchaseError,
    approveError,
    purchaseHash,
    approveHash,
    isCorrectNetwork,
    switchToBase,
  } = useMegapot();
  
  // Smart account hooks
  const {
    smartAccount,
    isLoading: smartAccountLoading,
    error: smartAccountError,
    isDeployed,
  } = useSmartAccount();
  
  const { executeGaslessTransaction, isExecuting, canExecuteGasless } = useGaslessTransaction();
  const { deploySmartAccount, isDeploying, needsDeployment } = useDeploySmartAccount();
  
  // Cross-chain hooks
  const { isNearConnected, initializeNear, activeTransactions } = useCrossChain();
  const { isConnected: nearConnected, accountId: nearAccountId } = useNearWalletConnection();
  
  // Display hooks
  const { currentPrize, ticketsSold, timeRemainingText, isExpired, isLoading } = useJackpotDisplay();
  const { totalTickets, totalSpentFormatted, recentPurchases, isLoading: isLoadingUserData } = useUserStatsDisplay();
  
  // Component state
  const [ticketCount, setTicketCount] = useState(1);
  const [availableMethods, setAvailableMethods] = useState<PurchaseMethod[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [purchaseEstimate, setPurchaseEstimate] = useState<any>(null);
  const [crossChainStatus, setCrossChainStatus] = useState<'idle' | 'creating' | 'executing' | 'completed' | 'failed'>('idle');
  const [crossChainTxId, setCrossChainTxId] = useState<string | null>(null);
  
  // Auto-detect optimal purchase method and source chain
  const currentChain = getChainConfig(chainId);
  const [selectedMethod, setSelectedMethod] = useState<'standard' | 'gasless' | 'cross-chain'>(currentChain.purchaseMethod);
  const [sourceChain, setSourceChain] = useState('avalanche');

  // Update method when chain changes
  useEffect(() => {
    const chain = getChainConfig(chainId);
    setSelectedMethod(chain.purchaseMethod);
    if ('sourceChain' in chain && chain.sourceChain) {
        setSourceChain(chain.sourceChain);
    }
  }, [chainId]);
  
  // Transaction status tracking
  const purchaseStatus = useTransactionStatus(purchaseHash);
  const approveStatus = useTransactionStatus(approveHash);
  
  // Update available methods when context changes
  useEffect(() => {
    const methods = unifiedTicketService.getAvailablePurchaseMethods({
      chainId,
      hasBalance: true,
      isSmartAccountDeployed: isDeployed,
      isNearConnected,
      isFlaskEnabled: isFlask
    });
    
    setAvailableMethods(methods);
    
    // Auto-select optimal method
    const optimal = unifiedTicketService.getOptimalPurchaseMethod(methods);
    if (optimal) {
      setSelectedMethod(optimal.id);
    }
  }, [chainId, isDeployed, isNearConnected, isFlask]);
  
  // Update purchase estimate when parameters change
  useEffect(() => {
    const updateEstimate = async () => {
      if (ticketCount > 0) {
        try {
          const estimate = await unifiedTicketService.estimatePurchase(
            { ticketCount, syndicateId, causeAllocation },
            selectedMethod
          );
          setPurchaseEstimate(estimate);
        } catch (error) {
          console.error('Failed to estimate purchase:', error);
        }
      }
    };
    
    updateEstimate();
  }, [ticketCount, selectedMethod, syndicateId, causeAllocation]);
  
  const handleApprove = async () => {
    const amount = (ticketCount * 1).toString(); // 1 USDC per ticket
    await approveUsdc(amount);
  };
  
  const handlePurchase = async () => {
    if (!walletClient) return;
    
    const options: TicketPurchaseOptions = {
      ticketCount,
      syndicateId,
      causeAllocation,
    };
    
    try {
      let result;
      
      switch (selectedMethod) {
        case 'standard':
          result = await unifiedTicketService.executeStandardPurchase(
            options,
            walletClient,
            purchaseTickets
          );
          break;
          
        case 'gasless':
          result = await unifiedTicketService.executeGaslessPurchase(
            options,
            executeGaslessTransaction
          );
          break;
          
        case 'cross-chain':
          if (!nearConnected) {
            throw new Error('NEAR wallet not connected');
          }
          
          setCrossChainStatus('creating');
          
          const intentId = await nearIntentsService.createCrossChainIntent({
            sourceChain: sourceChain,
            targetChain: 'base',
            userAddress: address!,
            ticketCount,
            syndicateId,
            causeAllocation,
          });
          
          setCrossChainTxId(intentId);
          setCrossChainStatus('executing');
          
          const transaction = await nearIntentsService.executeChainSignature(intentId);
          
          if (transaction.status === 'executed') {
            setCrossChainStatus('completed');
            result = { hash: transaction.targetHash };
          } else {
            setCrossChainStatus('failed');
            throw new Error('Cross-chain transaction failed');
          }
          break;
          
        default:
          await purchaseTickets(ticketCount);
          return;
      }
      
      if (!result.success) {
        console.error('Purchase failed:', result.error);
        // Handle error display
      }
    } catch (error) {
      console.error('Purchase error:', error);
      if (selectedMethod === 'cross-chain') {
        setCrossChainStatus('failed');
      }
    }
  };
  
  const handleDeploySmartAccount = async () => {
    try {
      await deploySmartAccount();
    } catch (error) {
      console.error('Failed to deploy smart account:', error);
    }
  };
  
  const handleInitializeNear = async () => {
    try {
      await initializeNear();
    } catch (error) {
      console.error('Failed to initialize NEAR:', error);
    }
  };
  
  const ticketPrice = ticketCount * 1; // 1 USDC per ticket
  const selectedMethodData = availableMethods.find(m => m.id === selectedMethod);
  
  if (!isConnected) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">🎯 Cross-Chain Lottery</h2>
          <p className="text-gray-600 mb-4">Buy Megapot lottery tickets from any supported blockchain</p>
          <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto mb-4 text-sm">
            <div className="flex items-center justify-center space-x-1 p-2 bg-blue-50 rounded">
              <span>🔵</span><span>Base (Direct)</span>
            </div>
            <div className="flex items-center justify-center space-x-1 p-2 bg-red-50 rounded">
              <span>🔺</span><span>Avalanche (NEAR)</span>
            </div>
            <div className="flex items-center justify-center space-x-1 p-2 bg-gray-50 rounded">
              <span>⟠</span><span>Ethereum (NEAR)</span>
            </div>
            <div className="flex items-center justify-center space-x-1 p-2 bg-purple-50 rounded">
              <span>🟣</span><span>Polygon (NEAR)</span>
            </div>
          </div>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  // Show unsupported network message
  if (!currentChain.supported) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">❓ Unsupported Network</h2>
          <p className="text-gray-600 mb-4">Please switch to a supported network to buy lottery tickets</p>
          <div className="text-sm text-gray-500 mb-4">
            Supported: Base, Avalanche, Ethereum, Polygon
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Jackpot Info */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg p-6 text-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">
            {isLoading ? 'Loading...' : currentPrize}
          </h1>
          <p className="text-xl opacity-90 mb-4">Current Jackpot</p>
          
          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
            <div className="text-center">
              <p className="text-2xl font-semibold">{ticketsSold.toLocaleString()}</p>
              <p className="text-sm opacity-75">Tickets Sold</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold">
                {isExpired ? 'Ended' : timeRemainingText}
              </p>
              <p className="text-sm opacity-75">Time Remaining</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Chain Status Indicator */}
      <div className="bg-white rounded-lg shadow-lg p-4 border-l-4 border-blue-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{currentChain.icon}</span>
            <div>
              <h3 className="font-semibold text-gray-900">Connected to {currentChain.name}</h3>
              <p className="text-sm text-gray-600">
                {currentChain.native ? 'Direct lottery purchase available' : `Using ${currentChain.method}`}
              </p>
            </div>
          </div>
          {!currentChain.native && nearConnected && (
            <div className="flex items-center space-x-2 text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-sm font-medium">NEAR Ready</span>
            </div>
          )}
          {!currentChain.native && !nearConnected && (
            <div className="flex items-center space-x-2 text-yellow-600">
              <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
              <span className="text-sm font-medium">NEAR Required</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Ticket Purchase */}
      {!isExpired && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Buy Tickets</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Tickets
              </label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}
                  className="bg-gray-200 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                  disabled={ticketCount <= 1}
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={ticketCount}
                  onChange={(e) => setTicketCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 text-center border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => setTicketCount(Math.min(100, ticketCount + 1))}
                  className="bg-gray-200 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                  disabled={ticketCount >= 100}
                >
                  +
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Total cost: ${ticketPrice.toFixed(2)} USDC
              </p>
            </div>
            
            {/* Purchase Method Selection */}
            {availableMethods.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Purchase Method
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {availableMethods.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setSelectedMethod(method.id)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        selectedMethod === method.id
                          ? 'border-blue-500 bg-blue-50 text-blue-900'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="font-medium">{method.name}</div>
                       <div className="text-sm text-gray-600">{method.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Advanced Options */}
            {selectedMethod === 'cross-chain' && (
              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm text-blue-600 hover:text-blue-800 mb-2"
                >
                  {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                </button>
                
                {showAdvanced && (
                  <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Source Chain
                      </label>
                      <select
                        value={sourceChain}
                        onChange={(e) => setSourceChain(e.target.value as 'avalanche' | 'base')}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="avalanche">Avalanche</option>
                        <option value="base">Base</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Purchase Estimate */}
            {purchaseEstimate && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-700 mb-2">Purchase Summary</div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Tickets:</span>
                    <span>{ticketCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cost:</span>
                    <span>${ticketPrice.toFixed(2)} USDC</span>
                  </div>
                  {purchaseEstimate.fees.gas && (
                     <div className="flex justify-between">
                       <span>Est. Gas:</span>
                       <span>{formatUnits(purchaseEstimate.fees.gas, 18)} ETH</span>
                     </div>
                   )}
                  {selectedMethodData && (
                    <div className="flex justify-between font-medium">
                      <span>Method:</span>
                      <span>{selectedMethodData.name}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              {/* Show approval button for standard purchases that need approval */}
              {selectedMethod === 'standard' && purchaseEstimate?.needsApproval && (
                <button
                  onClick={handleApprove}
                  disabled={isApproving || approveStatus.isLoading}
                  className="w-full bg-yellow-600 text-white py-3 px-4 rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isApproving || approveStatus.isLoading ? 'Approving...' : `Approve ${ticketPrice.toFixed(2)} USDC`}
                </button>
              )}
              
              {/* Show deploy button for gasless purchases that need deployment */}
              {selectedMethod === 'gasless' && needsDeployment && (
                <button
                  onClick={handleDeploySmartAccount}
                  disabled={isDeploying}
                  className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isDeploying ? 'Deploying Smart Account...' : 'Deploy Smart Account'}
                </button>
              )}
              
              {/* Show NEAR connection for cross-chain purchases */}
              {selectedMethod === 'cross-chain' && !nearConnected && (
                <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-600 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <span className="text-green-400">🔗</span>
                    <span className="text-green-200 font-medium">
                      NEAR Chain Signatures Required
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-blue-300">{currentChain.name} {currentChain.icon}</span>
                      <span className="text-gray-500">→</span>
                      <span className="text-green-300">NEAR 🔗</span>
                      <span className="text-gray-500">→</span>
                      <span className="text-purple-300">Base 🔵</span>
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm mb-4">
                    Connect NEAR wallet to sign Base transactions from {currentChain.name}.
                  </p>
                  <NearWalletConnection />
                </div>
              )}
              
              {/* Show cross-chain status */}
              {selectedMethod === 'cross-chain' && nearConnected && crossChainStatus !== 'idle' && (
                <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-blue-400">⚡</span>
                    <span className="text-blue-200 font-medium">Cross-Chain Transaction</span>
                  </div>
                  <div className="text-sm text-gray-300">
                    {crossChainStatus === 'creating' && '🔄 Creating NEAR intent...'}
                    {crossChainStatus === 'executing' && '⚡ Executing chain signature...'}
                    {crossChainStatus === 'completed' && '✅ Transaction completed successfully!'}
                    {crossChainStatus === 'failed' && '❌ Transaction failed. Please try again.'}
                  </div>
                  {crossChainTxId && (
                    <div className="text-xs text-gray-400 mt-2">
                      Intent ID: {crossChainTxId.slice(0, 20)}...
                    </div>
                  )}
                </div>
              )}
              
              <button
                onClick={handlePurchase}
                disabled={
                  isPurchasing || 
                  purchaseStatus.isLoading || 
                  isExecuting ||
                  crossChainStatus === 'creating' ||
                  crossChainStatus === 'executing' ||
                  (selectedMethod === 'standard' && purchaseEstimate?.needsApproval && !approveStatus.isSuccess) ||
                  (selectedMethod === 'gasless' && needsDeployment) ||
                  (selectedMethod === 'cross-chain' && !nearConnected)
                }
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {selectedMethod === 'cross-chain' ? (
                  crossChainStatus === 'creating' ? 'Creating Intent...' :
                  crossChainStatus === 'executing' ? 'Executing Cross-Chain...' :
                  crossChainStatus === 'completed' ? 'Purchase Complete!' :
                  crossChainStatus === 'failed' ? 'Purchase Failed' :
                  `Buy ${ticketCount} Ticket${ticketCount > 1 ? 's' : ''} (Cross-Chain)`
                ) : (
                  (isPurchasing || purchaseStatus.isLoading || isExecuting) ? 'Processing...' : `Buy ${ticketCount} Ticket${ticketCount > 1 ? 's' : ''}`
                )}
              </button>
            </div>
            
            {/* Error Messages */}
            {approveError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{approveError}</p>
              </div>
            )}
            
            {purchaseError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{purchaseError}</p>
              </div>
            )}
            
            {/* Success Messages */}
            {approveStatus.isSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-700 text-sm">USDC approval successful!</p>
              </div>
            )}
            
            {purchaseStatus.isSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-700 text-sm">Tickets purchased successfully!</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* User Stats */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Stats</h2>
        
        {isLoadingUserData ? (
          <div className="text-center py-4">
            <p className="text-gray-600">Loading your stats...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{totalTickets}</p>
              <p className="text-sm text-gray-600">Total Tickets</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{totalSpentFormatted}</p>
              <p className="text-sm text-gray-600">Total Spent</p>
            </div>
          </div>
        )}
        
        {/* Recent Purchases */}
        {recentPurchases.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Purchases</h3>
            <div className="space-y-2">
              {recentPurchases.map((purchase, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      {purchase.ticketsPurchased} ticket{purchase.ticketsPurchased > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-gray-600">
                      Round #{purchase.jackpotRoundId}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      ${(purchase.ticketsPurchasedTotalBps / 1000000).toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-600">
                      Tickets #{purchase.startTicket}-{purchase.endTicket}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* User Dashboard */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">👤 Your Dashboard</h2>
        <UserDashboard />
      </div>

      {/* SNS Integration Section */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">🔍 SNS Domain Lookup</h2>
        <p className="text-gray-600 mb-4">
          Search and resolve Solana Name Service domains to find wallet addresses and verify identities.
        </p>
        <SNSDomainSearch 
          onDomainSelect={(domain, publicKey) => {
            // DEBUG: console.log('Selected domain:', domain, 'for address:', publicKey.toString());
          }}
        />
       </div>
       
       {/* Cross-Chain Bridge Status */}
       <CrossChainBridgeStatus className="" />
     </div>
   );
 }

 export default LotteryDashboard;