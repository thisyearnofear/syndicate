-- Migration: Add ticket tracking to syndicate pools
-- Add tickets_purchased column for accurate ticket counts

ALTER TABLE syndicate_pools 
ADD COLUMN IF NOT EXISTS tickets_purchased INTEGER DEFAULT 0;

ALTER TABLE syndicate_pools 
ADD COLUMN IF NOT EXISTS total_impact_usdc NUMERIC(20, 6) DEFAULT 0;

-- Add index for faster queries on tickets
CREATE INDEX IF NOT EXISTS idx_syndicate_pools_tickets ON syndicate_pools(tickets_purchased);

-- Update comments
COMMENT ON COLUMN syndicate_pools.tickets_purchased IS 'Total number of lottery tickets purchased by this syndicate pool';
COMMENT ON COLUMN syndicate_pools.total_impact_usdc IS 'Total USDC allocated to causes from this pool';