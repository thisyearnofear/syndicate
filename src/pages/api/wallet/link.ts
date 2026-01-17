import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '@vercel/postgres';

/**
 * Wallet Linking API
 *
 * Persists the link between a non-EVM wallet (Solana/NEAR/Stacks) and an EVM address.
 * This allows the user to see their tickets and winnings across sessions and devices.
 *
 * Schema:
 * - source_wallet: string (Primary Key) - The non-EVM wallet address
 * - source_chain: string - 'solana', 'near', 'stacks'
 * - evm_address: string - The linked EVM address on Base
 * - created_at: timestamp
 * - updated_at: timestamp
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    return handleLinkWallet(req, res);
  } else if (req.method === 'GET') {
    return handleGetLink(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleLinkWallet(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { sourceWallet, sourceChain, evmAddress } = req.body;

    if (!sourceWallet || !sourceChain || !evmAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate EVM address format
    if (!evmAddress.startsWith('0x') || evmAddress.length !== 42) {
      return res.status(400).json({ error: 'Invalid EVM address format' });
    }

    // Upsert the link
    await sql`
      INSERT INTO wallet_links (source_wallet, source_chain, evm_address, updated_at)
      VALUES (${sourceWallet}, ${sourceChain}, ${evmAddress}, NOW())
      ON CONFLICT (source_wallet, source_chain)
      DO UPDATE SET evm_address = ${evmAddress}, updated_at = NOW();
    `;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Failed to link wallet:', error);
    return res.status(500).json({ error: 'Database error' });
  }
}

async function handleGetLink(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { sourceWallet, sourceChain } = req.query;

    if (!sourceWallet || !sourceChain) {
      return res.status(400).json({ error: 'Missing source wallet or chain' });
    }

    const result = await sql`
      SELECT evm_address
      FROM wallet_links
      WHERE source_wallet = ${sourceWallet as string}
      AND source_chain = ${sourceChain as string}
      LIMIT 1;
    `;

    if (result.rows.length === 0) {
      return res.status(404).json({ linked: false });
    }

    return res.status(200).json({
      linked: true,
      evmAddress: result.rows[0].evm_address
    });
  } catch (error) {
    console.error('Failed to get wallet link:', error);
    return res.status(500).json({ error: 'Database error' });
  }
}
