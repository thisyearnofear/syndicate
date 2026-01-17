import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migrate() {
  try {
    console.log('Creating wallet_links table...');

    await sql`
      CREATE TABLE IF NOT EXISTS wallet_links (
        source_wallet VARCHAR(255) NOT NULL,
        source_chain VARCHAR(50) NOT NULL,
        evm_address VARCHAR(42) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (source_wallet, source_chain)
      );
    `;

    console.log('Migration complete: wallet_links table created successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
