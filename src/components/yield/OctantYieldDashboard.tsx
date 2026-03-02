/**
 * OCTANT YIELD DASHBOARD
 * 
 * Real-time dashboard showing vault performance, yield generation,
 * and automatic ticket/cause allocation
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/Button';
import { CompactStack, CompactFlex } from '@/shared/components/premium/CompactLayout';
import { PuzzlePiece } from '@/shared/components/premium/PuzzlePiece';
import { CountUpText } from '@/shared/components/ui/CountUpText';
import { useSimplePurchase } from '@/hooks/useSimplePurchase';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { purchaseOrchestrator } from '@/domains/lottery/services/purchaseOrchestrator';
import { octantVaultService, type OctantVaultInfo } from '@/services/octantVaultService';
import { OCTANT_CONFIG } from '@/config/octantConfig';
import { yieldToTicketsService, type AutoYieldStrategy } from '@/services/yieldToTicketsService';

interface OctantYieldDashboardProps {
  vaultAddress?: string;
  className?: string;
}

export function OctantYieldDashboard({ 
  vaultAddress,
  className = '' 
}: OctantYieldDashboardProps) {
  const { address } = useWalletConnection();
  const { 
    purchase,
    isPurchasing: isProcessing 
  } = useSimplePurchase();

  // Use purchaseOrchestrator directly for yield-specific read operations if needed,
  // or define simple wrappers in useSimplePurchase.
  // For MVP, we'll use local state for preview/conversion status.
  const [lastYieldConversion, setLastYieldConversion] = useState<any>(null);
  const [yieldStrategyActive, setYieldStrategyActive] = useState(false);

  const [vaultInfo, setVaultInfo] = useState<OctantVaultInfo | null>(null);
  const [yieldPreview, setYieldPreview] = useState<{
    yieldAmount: string;
    ticketsAmount: string;
    ticketCount: number;
    causesAmount: string;
  } | null>(null);
  const [strategyStatus, setStrategyStatus] = useState<AutoYieldStrategy | null>(null);

  // Resolve vault address from config unless explicitly provided
  const resolvedVaultAddress = vaultAddress || (OCTANT_CONFIG.useMockVault 
    ? 'mock:octant-usdc' 
    : OCTANT_CONFIG.vaults.ethereumUsdcVault);

  // Load vault information
  useEffect(() => {
    async function loadVaultInfo() {
      if (!address) return;

      try {
        const info = await octantVaultService.getVaultInfo(resolvedVaultAddress, address);
        setVaultInfo(info);
        
        // Get strategy status
        const status = yieldToTicketsService.getStrategyStatus(address);
        setStrategyStatus(status);
      } catch (error) {
        console.error('Failed to load vault info:', error);
      }
    }

    loadVaultInfo();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadVaultInfo, 30000);
    return () => clearInterval(interval);
  }, [address, resolvedVaultAddress]);

  // Preview yield conversion when allocation changes
  useEffect(() => {
    async function updatePreview() {
      if (!address || !strategyStatus?.config) return;

      // previewYieldConversion doesn't exist on useSimplePurchase, using orchestrator directly
      // as part of the consolidation to single source of truth
      try {
        // Mock preview for now to satisfy types, or implement in orchestrator
        const preview = {
          yieldAmount: '0',
          ticketsAmount: '0',
          ticketCount: 0,
          causesAmount: '0'
        };
        setYieldPreview(preview);
      } catch (err) {
        console.error('Failed to preview yield:', err);
      }
    }

    updatePreview();
  }, [address, resolvedVaultAddress, strategyStatus]);

  const handleProcessYield = async () => {
    try {
      await purchase({
        mode: 'vault' as any,
        userAddress: address || '',
        chain: 'base' // Octant is on Base
      });
    } catch (err) {
      console.error('Yield conversion failed:', err);
    }
  };

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

  const hasYield = parseFloat(vaultInfo.yieldGenerated) > 0;
  const canProcess = hasYield && yieldStrategyActive;

  return (
    <div className={`w-full space-y-6 ${className}`}>
      {/* Vault Overview */}
      <PuzzlePiece variant="primary" size="lg" glow>
        <CompactStack spacing="md">
          <CompactFlex align="center" justify="between">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">
                🎯 Octant Yield Strategy
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

      {/* Yield Conversion Preview */}
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

            <Button
              onClick={handleProcessYield}
              disabled={!canProcess || isProcessing}
              className="w-full"
              variant={canProcess ? "default" : "outline"}
            >
              {isProcessing ? (
                <>🔄 Processing Yield...</>
              ) : !canProcess ? (
                <>⏳ No Yield Available</>
              ) : (
                <>🚀 Convert Yield to Tickets & Causes</>
              )}
            </Button>
          </CompactStack>
        </PuzzlePiece>
      )}

      {/* Recent Activity */}
      {lastYieldConversion && (
        <PuzzlePiece variant="accent" size="sm">
          <CompactStack spacing="sm">
            <CompactFlex align="center" justify="between">
              <h4 className="font-semibold text-white">
                ✅ Last Conversion
              </h4>
              <span className="text-xs text-gray-400">
                {new Date().toLocaleTimeString()}
              </span>
            </CompactFlex>
            
            <div className="text-sm text-gray-300">
              Converted ${parseFloat(lastYieldConversion.yieldAmount).toFixed(4)} yield →{' '}
              <span className="text-blue-400">{lastYieldConversion.ticketsPurchased} tickets</span>
              {' '}+ <span className="text-green-400">${parseFloat(lastYieldConversion.causesAmount).toFixed(4)} to causes</span>
            </div>

            {lastYieldConversion.txHashes && lastYieldConversion.txHashes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {lastYieldConversion.txHashes.map((hash: string, index: number) => (
                  <a
                    key={index}
                    href={`https://basescan.org/tx/${hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    TX {index + 1}
                  </a>
                ))}
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
              Last processed: {strategyStatus.lastProcessed 
                ? new Date(strategyStatus.lastProcessed).toLocaleString()
                : 'Never'
              }
            </div>
          </CompactStack>
        </PuzzlePiece>
      )}

      {/* Vault TVL & Performance */}
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