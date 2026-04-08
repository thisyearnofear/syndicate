import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const walletAddress =
      typeof body?.walletAddress === 'string' ? body.walletAddress.trim() : null;
    const source = typeof body?.source === 'string' ? body.source.trim() : 'vaults-page';
    const interest = typeof body?.interest === 'string' ? body.interest.trim() : null;

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    let persisted = false;
    try {
      await sql`
        INSERT INTO vault_waitlist_leads (email, wallet_address, source, interest, created_at)
        VALUES (${email}, ${walletAddress}, ${source}, ${interest}, NOW())
        ON CONFLICT (email)
        DO UPDATE SET
          wallet_address = COALESCE(EXCLUDED.wallet_address, vault_waitlist_leads.wallet_address),
          source = EXCLUDED.source,
          interest = COALESCE(EXCLUDED.interest, vault_waitlist_leads.interest),
          updated_at = NOW()
      `;
      persisted = true;
    } catch (error) {
      console.warn('[VaultWaitlist] DB insert skipped, falling back to logs:', error);
      console.log('[VaultWaitlistLead]', { email, walletAddress, source, interest });
    }

    return NextResponse.json({ success: true, persisted }, { headers: corsHeaders });
  } catch (error) {
    console.error('[VaultWaitlist] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
