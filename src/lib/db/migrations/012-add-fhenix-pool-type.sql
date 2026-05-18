-- Migration: Add 'fhenix' pool type support
-- This is required because the original CHECK constraint in 005-add-pool-type.sql
-- only allowed ('safe', 'splits', 'pooltogether').

-- Update the CHECK constraint to include 'fhenix'
ALTER TABLE syndicate_pools 
DROP CONSTRAINT IF EXISTS syndicate_pools_pool_type_check;

ALTER TABLE syndicate_pools 
ADD CONSTRAINT syndicate_pools_pool_type_check 
CHECK (pool_type IN ('safe', 'splits', 'pooltogether', 'fhenix'));

COMMENT ON COLUMN syndicate_pools.pool_type IS 'Type of pooling mechanism: safe (multisig), splits (0xSplits), pooltogether (PT V5), or fhenix (FHE private vault)';
