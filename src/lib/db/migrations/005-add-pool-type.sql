-- Add pool type support for Safe, Splits, and PoolTogether

-- Add pool_type enum
ALTER TABLE syndicate_pools 
ADD COLUMN IF NOT EXISTS pool_type TEXT DEFAULT 'safe'
CHECK (pool_type IN ('safe', 'splits', 'pooltogether'));

-- Add specific addresses for each pool type
ALTER TABLE syndicate_pools 
ADD COLUMN IF NOT EXISTS safe_address TEXT;

ALTER TABLE syndicate_pools 
ADD COLUMN IF NOT EXISTS split_address TEXT;

ALTER TABLE syndicate_pools 
ADD COLUMN IF NOT EXISTS pt_vault_address TEXT;

-- Add members JSONB for storing member shares (for splits)
ALTER TABLE syndicate_pools 
ADD COLUMN IF NOT EXISTS member_shares JSONB DEFAULT '[]';

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_syndicate_pools_pool_type ON syndicate_pools(pool_type);

-- Comments
COMMENT ON COLUMN syndicate_pools.pool_type IS 'Type of pooling mechanism: safe (multisig), splits (0xSplits), or pooltogether';
COMMENT ON COLUMN syndicate_pools.safe_address IS 'Safe multisig contract address';
COMMENT ON COLUMN syndicate_pools.split_address IS '0xSplits contract address for distribution';
COMMENT ON COLUMN syndicate_pools.pt_vault_address IS 'PoolTogether vault address for delegation';
COMMENT ON COLUMN syndicate_pools.member_shares IS 'JSON array of member addresses and share percentages';