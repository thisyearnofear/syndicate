import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function ensureActivityTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS user_activity_events (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK (event_type IN ('bridge', 'vault_deposit')),
      protocol TEXT,
      amount TEXT,
      tx_hash TEXT,
      source_chain TEXT,
      destination_chain TEXT,
      source_address TEXT,
      destination_address TEXT,
      status TEXT,
      error TEXT,
      bridge_activity_id TEXT,
      target_strategy TEXT,
      linked_vault_protocol TEXT,
      linked_deposit_tx_hash TEXT,
      metadata JSONB,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_user_activity_wallet_address ON user_activity_events(wallet_address)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_activity_event_type ON user_activity_events(event_type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_activity_updated_at ON user_activity_events(updated_at DESC)`;
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    await ensureActivityTable();

    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');
    const eventType = searchParams.get('type');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Missing wallet address' },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = eventType
      ? await sql`
          SELECT *
          FROM user_activity_events
          WHERE LOWER(wallet_address) = LOWER(${walletAddress})
            AND event_type = ${eventType}
          ORDER BY updated_at DESC
          LIMIT 100
        `
      : await sql`
          SELECT *
          FROM user_activity_events
          WHERE LOWER(wallet_address) = LOWER(${walletAddress})
          ORDER BY updated_at DESC
          LIMIT 100
        `;

    return NextResponse.json(
      result.rows.map((row: any) => ({
        id: row.id,
        walletAddress: row.wallet_address,
        eventType: row.event_type,
        protocol: row.protocol,
        amount: row.amount,
        txHash: row.tx_hash,
        sourceChain: row.source_chain,
        destinationChain: row.destination_chain,
        sourceAddress: row.source_address,
        destinationAddress: row.destination_address,
        status: row.status,
        error: row.error,
        bridgeActivityId: row.bridge_activity_id,
        targetStrategy: row.target_strategy,
        linkedVaultProtocol: row.linked_vault_protocol,
        linkedDepositTxHash: row.linked_deposit_tx_hash,
        metadata: row.metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Activity API] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureActivityTable();

    const body = await request.json();
    const {
      id,
      walletAddress,
      eventType,
      protocol,
      amount,
      txHash,
      sourceChain,
      destinationChain,
      sourceAddress,
      destinationAddress,
      status,
      error,
      bridgeActivityId,
      targetStrategy,
      linkedVaultProtocol,
      linkedDepositTxHash,
      metadata,
      createdAt,
      updatedAt,
    } = body ?? {};

    if (!id || !walletAddress || !eventType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400, headers: corsHeaders }
      );
    }

    await sql`
      INSERT INTO user_activity_events (
        id,
        wallet_address,
        event_type,
        protocol,
        amount,
        tx_hash,
        source_chain,
        destination_chain,
        source_address,
        destination_address,
        status,
        error,
        bridge_activity_id,
        target_strategy,
        linked_vault_protocol,
        linked_deposit_tx_hash,
        metadata,
        created_at,
        updated_at
      ) VALUES (
        ${id},
        ${walletAddress},
        ${eventType},
        ${protocol ?? null},
        ${amount ?? null},
        ${txHash ?? null},
        ${sourceChain ?? null},
        ${destinationChain ?? null},
        ${sourceAddress ?? null},
        ${destinationAddress ?? null},
        ${status ?? null},
        ${error ?? null},
        ${bridgeActivityId ?? null},
        ${targetStrategy ?? null},
        ${linkedVaultProtocol ?? null},
        ${linkedDepositTxHash ?? null},
        ${metadata ? JSON.stringify(metadata) : null},
        ${createdAt ?? Date.now()},
        ${updatedAt ?? Date.now()}
      )
      ON CONFLICT (id) DO UPDATE SET
        wallet_address = EXCLUDED.wallet_address,
        event_type = EXCLUDED.event_type,
        protocol = EXCLUDED.protocol,
        amount = EXCLUDED.amount,
        tx_hash = EXCLUDED.tx_hash,
        source_chain = EXCLUDED.source_chain,
        destination_chain = EXCLUDED.destination_chain,
        source_address = EXCLUDED.source_address,
        destination_address = EXCLUDED.destination_address,
        status = EXCLUDED.status,
        error = EXCLUDED.error,
        bridge_activity_id = EXCLUDED.bridge_activity_id,
        target_strategy = EXCLUDED.target_strategy,
        linked_vault_protocol = EXCLUDED.linked_vault_protocol,
        linked_deposit_tx_hash = EXCLUDED.linked_deposit_tx_hash,
        metadata = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at
    `;

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('[Activity API] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
