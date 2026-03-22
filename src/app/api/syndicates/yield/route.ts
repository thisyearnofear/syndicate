/**
 * Syndicate Yield API
 * 
 * Returns yield information for a syndicate:
 * - Vault info and current APY
 * - Yield accrued
 * - Conversion history
 */

import { NextResponse } from 'next/server';
import { syndicateVaultService } from '@/services/syndicate/syndicateVaultService';
import { vaultManager } from '@/services/vaults';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const action = searchParams.get('action');

    if (!poolId) {
      return NextResponse.json(
        { error: 'Missing poolId' },
        { status: 400, headers: corsHeaders }
      );
    }

    switch (action) {
      case 'vaults': {
        // Get available vault strategies
        const vaults = await vaultManager.getAvailableVaults();
        return NextResponse.json({ vaults }, { headers: corsHeaders });
      }

      case 'conversions': {
        // Get yield conversion history
        const conversions = await syndicateVaultService.getConversionHistory(poolId);
        return NextResponse.json({ conversions }, { headers: corsHeaders });
      }

      case 'pending': {
        // Get pending yield for conversion
        const pendingYield = await syndicateVaultService.getPendingYield(poolId);
        const vaultInfo = await syndicateVaultService.getSyndicateVault(poolId);
        const shouldConvert = await syndicateVaultService.shouldConvertYield(poolId);
        
        return NextResponse.json({
          pendingYield,
          threshold: vaultInfo?.ticketConversionThreshold || 10,
          shouldConvert,
          autoConvert: vaultInfo?.autoConvertToTickets || false,
        }, { headers: corsHeaders });
      }

      default: {
        // Get full yield info for syndicate
        const vaultInfo = await syndicateVaultService.getSyndicateVault(poolId);
        const pendingYield = await syndicateVaultService.getPendingYield(poolId);
        const conversions = await syndicateVaultService.getConversionHistory(poolId, 5);

        return NextResponse.json({
          vaultInfo,
          pendingYield,
          recentConversions: conversions,
        }, { headers: corsHeaders });
      }
    }
  } catch (error) {
    console.error('[SyndicateYield API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
