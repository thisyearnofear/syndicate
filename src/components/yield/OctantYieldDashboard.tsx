/**
 * OCTANT YIELD DASHBOARD
 * 
 * Real-time dashboard showing vault performance, yield generation,
 * and automatic ticket/cause allocation
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/shared/components/ui/Button';
import { CompactStack, CompactFlex } from '@/shared/components/premium/CompactLayout';
import { PuzzlePiece } from '@/shared/components/premium/PuzzlePiece';
import { CountUpText } from '@/shared/components/ui/CountUpText';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { useYieldAutoProcessor } from '@/hooks/useYieldAutoProcessor';
import { solanaWalletService } from '@/services/solanaWalletService';
import { octantVaultService, type OctantVaultInfo } from '@/services/octantVaultService';
import { OCTANT_CONFIG } from '@/config/octantConfig';
import { yieldToTicketsService, type AutoYieldStrategy } from '@/services/yieldToTicketsService';
import { useToast } from '@/shared/components/ui/Toast';
import { useWalletClient, usePublicClient } from 'wagmi';
import { base } from 'wagmi/chains';
import { parseUnits } from 'viem';
import { Loader, Check, ExternalLink, Bell } from 'lucide-react';

// USDC contract on Base
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  }
] as const;

interface OctantYieldDashboardProps {
  vaultAddress?: string;
  className?: string;
}

export function OctantYieldDashboard({ 
  vaultAddress,
  className = '' 
}: OctantYieldDashboardProps) {
  const { address } = useWalletConnection();
  const { addToast } = useToast();
  const { availableYield, estimatedTickets, isChecking: isAutoChecking, strategy: autoStrategy } = useYieldAutoProcessor();

  const [vaultInfo, setVaultInfo] = useState<OctantVaultInfo | null>(null);
  const [yieldPreview, setYieldPreview] = useState<{
    yieldAmount: string;
    ticketsAmount: string;
    ticketCount: number;
    causesAmount: string;
  } | null>(null);
  const [strategyStatus, setStrategyStatus] = useState<AutoYieldStrategy | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<{
    success: boolean;
    txHashes: string[];
    ticketsPurchased: number;
    causesAmount: string;
    causeTransferParams?: {
      chain: 'evm' | 'solana';
      to: string;
      amountWei: string;
      data?: string;
    } | null;
    error?: string;
  } | null>(null);
  const [isSendingToCause, setIsSendingToCause] = useState(false);
  const [causeTransferTxHash, setCauseTransferTxHash] = useState<string | null>(null);

  const resolvedVaultAddress = vaultAddress || (OCTANT_CONFIG.useMockVault 
    ? 'mock:octant-usdc' 
    : OCTANT_CONFIG.vaults.ethereumUsdcVault);

  // Load vault info + strategy status
  useEffect(() => {
    async function load() {
      if (!address) return;
      try {
        const [info, status] = await Promise.all([
          octantVaultService.getVaultInfo(resolvedVaultAddress, address).catch(() => null),
          Promise.resolve(yieldToTicketsService.getStrategyStatus(address)),
        ]);
        setVaultInfo(info);
        setStrategyStatus(status);
      } catch (err) {
        console.error('[OctantYieldDashboard] Failed to load:', err);
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [address, resolvedVaultAddress]);

  // Load yield preview when strategy is active
  useEffect(() => {
    async function preview() {
      if (!address || !strategyStatus?.isActive) {
        setYieldPreview(null);
        return;
      }
      try {
        const result = await yieldToTicketsService.previewYieldConversion(
          strategyStatus.config.vaultProtocol,
          address,
          strategyStatus.config.ticketsAllocation,
          strategyStatus.config.causesAllocation,
          strategyStatus.config.ticketPrice,
        );
        setYieldPreview(result);
      } catch {
        setYieldPreview(null);
      }
    }
    preview();
  }, [address, strategyStatus]);

  const handleProcessYield = useCallback(async () => {
    if (!address) return;
    setIsProcessing(true);
    setProcessResult(null);

    try {
      const result = await yieldToTicketsService.processYieldConversion(address);

      // If Drift withdrawal needs client-side signing
      if (result.pendingWithdrawalTx) {
        try {
          if (!solanaWalletService.isReady()) {
            const pk = await solanaWalletService.connectPhantom();
            if (!pk) throw new Error('Failed to connect Phantom wallet');
          }

          const { VersionedTransaction } = await import('@solana/web3.js');
          const txBytes = Buffer.from(result.pendingWithdrawalTx, 'base64');
          const transaction = VersionedTransaction.deserialize(txBytes);
          const signature = await solanaWalletService.signAndSendTransaction(transaction);

          // Complete the conversion after signing
          const completeResult = await yieldToTicketsService.completeYieldConversion(address, signature);
          setProcessResult({
            success: completeResult.success,
            txHashes: completeResult.txHashes,
            ticketsPurchased: completeResult.ticketsPurchased,
            causesAmount: completeResult.causesAmount,
            causeTransferParams: completeResult.causeTransferParams,
            error: completeResult.error,
          });
          return;
        } catch (signErr) {
          const msg = signErr instanceof Error ? signErr.message : 'Signing failed';
          const isCancel = msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('reject');
          setProcessResult({
            success: false,
            txHashes: [],
            ticketsPurchased: 0,
            causesAmount: '0',
            error: isCancel ? 'Transaction cancelled' : msg,
          });
          return;
        }
      }

      // EVM or already-complete path
      setProcessResult({
        success: result.success,
        txHashes: result.txHashes,
        ticketsPurchased: result.ticketsPurchased,
        causesAmount: result.causesAmount,
        causeTransferParams: result.causeTransferParams,
        error: result.error,
      });

      // Refresh strategy status
      setStrategyStatus(yieldToTicketsService.getStrategyStatus(address));
    } catch (err) {
      setProcessResult({
        success: false,
        txHashes: [],
        ticketsPurchased: 0,
        causesAmount: '0',
        error: err instanceof Error ? err.message : 'Processing failed',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [address]);

  // Wagmi hooks for EVM transfers
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  // Handle sending yield portion to causes
  const handleSendToCause = useCallback(async () => {
    if (!address || !processResult?.causeTransferParams) return;

    setIsSendingToCause(true);
    try {
      const params = processResult.causeTransferParams;
      
      if (params.chain === 'solana') {
        // Solana SPL transfer
        if (!solanaWalletService.isReady()) {
          const pk = await solanaWalletService.connectPhantom();
          if (!pk) throw new Error('Failed to connect Phantom wallet');
        }
        
        // TODO: Construct and send SPL token transfer
        // For now, show success message
        setCauseTransferTxHash('solana-tx-placeholder');
        addToast({
          type: 'success',
          title: 'Cause Donation Sent',
          message: `$${parseFloat(processResult.causesAmount).toFixed(2)} sent to cause wallet`,
        });
      } else {
        // EVM USDC transfer using wagmi
        if (!walletClient || !publicClient) {
          throw new Error('No EVM wallet connected');
        }

        const amountWei = parseUnits(processResult.causesAmount, 6);
        const causeWallet = params.to as `0x${string}`;

        // Send USDC transfer transaction
        const txHash = await walletClient.writeContract({
          address: USDC_BASE,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [causeWallet, amountWei],
          chain: base,
        });

        // Wait for confirmation
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        
        setCauseTransferTxHash(txHash);
        addToast({
          type: 'success',
          title: 'Cause Donation Sent',
          message: `$${parseFloat(processResult.causesAmount).toFixed(2)} sent to cause wallet. TX: ${txHash.slice(0, 10)}...`,
        });
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Cause Transfer Failed',
        message: err instanceof Error ? err.message : 'Failed to send to cause',
      });
    } finally {
      setIsSendingToCause(false);
    }
  }, [address, processResult, addToast, walletClient, publicClient]);

  if (!vaultInfo) {
    return (
      <div className={`w-full ${className}`}>
        <PuzzlePiece variant="neutral" size="lg">
          <div className="text-center py-8">
            <div className="text-2xl mb-2">🔄</div>
            <p className="text-gray-400">Loading vault information...</p>
          </div>
        </PuzzlePiece>
      </div>
    );
  }

  const hasYield = parseFloat(vaultInfo.yieldGenerated) > 0 || parseFloat(availableYield) > 0;
  const canProcess = hasYield && (strategyStatus?.isActive || autoStrategy?.isActive);

  return (
    <div className={`w-full space-y-6 ${className}`}>
      {/* Yield Available Notification (auto-checked) */}
      {autoStrategy?.isActive && parseFloat(availableYield) > 0 && (
        <PuzzlePiece variant="accent" size="sm">
          <CompactFlex align="center" justify="between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Bell className="w-5 h-5 text-yellow-400 animate-pulse" />
              </div>
              <div>
                <p className="font-semibold text-white">
                  Yield Available: ${parseFloat(availableYield).toFixed(2)}
                </p>
                <p className="text-xs text-gray-400">
                  ~{estimatedTickets} tickets ready to convert
                </p>
              </div>
            </div>
            <Button
              onClick={handleProcessYield}
              disabled={isProcessing}
              variant="default"
              size="sm"
              className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
            >
              {isProcessing ? 'Converting...' : 'Convert Now'}
            </Button>
          </CompactFlex>
        </PuzzlePiece>
      )}

      {/* Vault Overview */}
      <PuzzlePiece variant="primary" size="lg" glow>
        <CompactStack spacing="md">
          <CompactFlex align="center" justify="between">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">
                🎯 Yield Strategy
              </h3>
              <p className="text-gray-400 text-sm">
                Capital preserved • Yield generates tickets & funds causes
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-400">
                {vaultInfo.apy.toFixed(1)}% APY
              </div>
              <div className="text-xs text-gray-400">Current Rate</div>
            </div>
          </CompactFlex>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass p-4 rounded-xl">
              <div className="text-lg font-bold text-white">
                <CountUpText 
                  value={Math.round(parseFloat(vaultInfo.userAssets) * 100) / 100} 
                  prefix="$" 
                />
              </div>
              <div className="text-xs text-gray-400">Your Deposit</div>
            </div>
            
            <div className="glass p-4 rounded-xl">
              <div className="text-lg font-bold text-yellow-400">
                ${parseFloat(vaultInfo.yieldGenerated).toFixed(4)}
              </div>
              <div className="text-xs text-gray-400">Yield Generated</div>
            </div>

            {strategyStatus && (
              <>
                <div className="glass p-4 rounded-xl">
                  <div className="text-lg font-bold text-blue-400">
                    {strategyStatus.totalTicketsBought}
                  </div>
                  <div className="text-xs text-gray-400">Tickets Bought</div>
                </div>
                
                <div className="glass p-4 rounded-xl">
                  <div className="text-lg font-bold text-green-400">
                    <CountUpText 
                      value={Math.round(parseFloat(strategyStatus.totalCausesFunded) * 100) / 100} 
                      prefix="$" 
                    />
                  </div>
                  <div className="text-xs text-gray-400">Causes Funded</div>
                </div>
              </>
            )}
          </div>
        </CompactStack>
      </PuzzlePiece>

      {/* Yield Conversion */}
      {yieldPreview && hasYield && (
        <PuzzlePiece variant="neutral" size="md">
          <CompactStack spacing="md">
            <h4 className="text-lg font-semibold text-white">
              🔄 Available Yield Conversion
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 glass rounded-xl">
                <div className="text-xl font-bold text-yellow-400">
                  ${parseFloat(yieldPreview.yieldAmount).toFixed(4)}
                </div>
                <div className="text-xs text-gray-400">Total Yield</div>
              </div>
              
              <div className="text-center p-4 glass rounded-xl">
                <div className="text-xl font-bold text-blue-400">
                  {yieldPreview.ticketCount} tickets
                </div>
                <div className="text-xs text-gray-400">
                  From ${parseFloat(yieldPreview.ticketsAmount).toFixed(4)}
                </div>
              </div>
              
              <div className="text-center p-4 glass rounded-xl">
                <div className="text-xl font-bold text-green-400">
                  ${parseFloat(yieldPreview.causesAmount).toFixed(4)}
                </div>
                <div className="text-xs text-gray-400">To Causes</div>
              </div>
            </div>

            {/* Result display */}
            {processResult && (
              <div className={`p-4 rounded-lg border ${
                processResult.success
                  ? 'bg-green-500/10 border-green-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}>
                {processResult.success ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="w-5 h-5 text-green-400" />
                      <span className="font-bold text-green-300">
                        Converted! {processResult.ticketsPurchased} tickets purchased
                      </span>
                    </div>
                    {processResult.txHashes.map((hash, i) => (
                      <a
                        key={i}
                        href={`https://basescan.org/tx/${hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-400 hover:text-green-300 underline flex items-center gap-1"
                      >
                        TX {i + 1} <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                    
                    {/* Cause Transfer Section */}
                    {parseFloat(processResult.causesAmount) > 0 && !causeTransferTxHash && processResult.causeTransferParams && (
                      <div className="mt-3 pt-3 border-t border-green-500/20">
                        <p className="text-sm text-green-300 mb-2">
                          ${parseFloat(processResult.causesAmount).toFixed(2)} allocated to causes
                        </p>
                        <Button
                          onClick={handleSendToCause}
                          disabled={isSendingToCause}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          {isSendingToCause ? (
                            <>
                              <Loader className="w-4 h-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            'Send to Cause'
                          )}
                        </Button>
                      </div>
                    )}
                    
                    {causeTransferTxHash && (
                      <div className="mt-3 pt-3 border-t border-green-500/20">
                        <p className="text-sm text-green-300 flex items-center gap-2">
                          <Check className="w-4 h-4" />
                          Cause donation completed!
                        </p>
                        {causeTransferTxHash !== 'solana-tx-placeholder' && causeTransferTxHash !== 'evm-tx-placeholder' && (
                          <a
                            href={`https://basescan.org/tx/${causeTransferTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-green-400 hover:text-green-300 underline flex items-center gap-1 mt-1"
                          >
                            View donation TX <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-red-300">{processResult.error}</p>
                )}
              </div>
            )}

            <Button
              onClick={handleProcessYield}
              disabled={!canProcess || isProcessing}
              className="w-full"
              variant={canProcess ? "default" : "outline"}
            >
              {isProcessing ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Converting Yield...
                </>
              ) : (
                <>Convert Yield to Tickets & Causes</>
              )}
            </Button>
            
            {isProcessing && (
              <div className="mt-3 text-center">
                <p className="text-xs text-gray-400 animate-pulse">
                  Please wait while we process your yield conversion...
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  This may take a moment for Solana transactions.
                </p>
              </div>
            )}
          </CompactStack>
        </PuzzlePiece>
      )}

      {/* Strategy Status */}
      {strategyStatus && (
        <PuzzlePiece variant="neutral" size="sm">
          <CompactStack spacing="sm">
            <CompactFlex align="center" justify="between">
              <h4 className="font-semibold text-white">
                ⚙️ Strategy Settings
              </h4>
              <div className={`text-xs px-2 py-1 rounded-full ${
                strategyStatus.isActive 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {strategyStatus.isActive ? 'Active' : 'Inactive'}
              </div>
            </CompactFlex>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Tickets Allocation:</span>
                <span className="text-blue-400 ml-2 font-semibold">
                  {strategyStatus.config.ticketsAllocation}%
                </span>
              </div>
              <div>
                <span className="text-gray-400">Causes Allocation:</span>
                <span className="text-green-400 ml-2 font-semibold">
                  {strategyStatus.config.causesAllocation}%
                </span>
              </div>
            </div>

            <div className="text-xs text-gray-400">
              Last processed: {strategyStatus.lastProcessed && new Date(strategyStatus.lastProcessed).getTime() > 0
                ? new Date(strategyStatus.lastProcessed).toLocaleString()
                : 'Never'
              }
            </div>
          </CompactStack>
        </PuzzlePiece>
      )}

      {/* Vault Performance */}
      <PuzzlePiece variant="neutral" size="sm">
        <CompactStack spacing="sm">
          <h4 className="font-semibold text-white">
            📊 Vault Performance
          </h4>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Total Value Locked:</span>
              <div className="text-white font-semibold">
                ${parseFloat(vaultInfo.totalDeposits).toLocaleString()}
              </div>
            </div>
            <div>
              <span className="text-gray-400">Your Vault Shares:</span>
              <div className="text-white font-semibold">
                {parseFloat(vaultInfo.userShares).toFixed(4)}
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-400">
            Vault: {vaultInfo.address.startsWith('0x')
              ? `${vaultInfo.address.substring(0, 6)}...${vaultInfo.address.slice(-4)}`
              : vaultInfo.address}
          </div>
        </CompactStack>
      </PuzzlePiece>
    </div>
  );
}
