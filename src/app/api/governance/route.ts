/**
 * Governance API
 * 
 * Handles governance operations:
 * - GET: Fetch proposals and votes
 * - POST: Create proposals and cast votes
 */

import { NextResponse } from 'next/server';
import { governanceService } from '@/services/governance/governanceService';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');
    const proposalId = searchParams.get('proposalId');
    const action = searchParams.get('action');

    if (!poolId && !proposalId) {
      return NextResponse.json(
        { error: 'Missing poolId or proposalId' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get votes for a proposal
    if (action === 'votes' && proposalId) {
      const votes = await governanceService.getVotes(proposalId);
      return NextResponse.json({ votes }, { headers: corsHeaders });
    }

    // Get proposals for a pool
    if (poolId) {
      const status = searchParams.get('status') as any;
      const proposals = await governanceService.getProposals(poolId, status);
      return NextResponse.json({ proposals }, { headers: corsHeaders });
    }

    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Governance API] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, poolId, proposalId, type, title, description, proposer, proposalData, voter, choice, reason } = body;

    if (action === 'create') {
      if (!poolId || !type || !title || !description || !proposer) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400, headers: corsHeaders }
        );
      }

      const id = await governanceService.createProposal({
        poolId,
        type,
        title,
        description,
        proposer,
        proposalData: proposalData || {},
      });

      return NextResponse.json({ id, success: true }, { headers: corsHeaders });
    }

    if (action === 'vote') {
      if (!proposalId || !voter || !choice) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400, headers: corsHeaders }
        );
      }

      await governanceService.castVote(proposalId, voter, choice, reason);

      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    if (action === 'check_status') {
      if (!proposalId) {
        return NextResponse.json(
          { error: 'Missing proposalId' },
          { status: 400, headers: corsHeaders }
        );
      }

      const status = await governanceService.checkProposalStatus(proposalId);
      return NextResponse.json({ status }, { headers: corsHeaders });
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Governance API] POST error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}
