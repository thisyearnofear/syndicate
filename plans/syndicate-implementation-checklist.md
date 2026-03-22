# Syndicate Implementation Checklist

## Phase 1: Core API Layer Implementation

### Task 1.1: Replace Mock Data with Real Database Queries
**File**: `/src/app/api/syndicates/route.ts`
**Lines**: 5-174 (mock data)

**Steps:**
1. Delete lines 5-174 (mock data array)
2. Import `syndicateRepository` at top:
   ```typescript
   import { syndicateRepository } from '@/lib/db/repositories/syndicateRepository';
   ```
3. Create mapping function:
   ```typescript
   function mapPoolToSyndicateInfo(pool: SyndicatePoolRow): SyndicateInfo {
     return {
       id: pool.id,
       name: pool.name,
       description: pool.description || '',
       model: 'altruistic', // Default, could be stored in DB
       causePercentage: pool.cause_allocation_percent,
       membersCount: pool.members_count,
       ticketsPurchased: 0, // TODO: Add ticket tracking
       totalImpact: parseFloat(pool.total_pooled_usdc) * 0.2, // Example calculation
       isActive: pool.is_active,
       // Add other required fields with defaults or calculated values
     };
   }
   ```
4. Update GET handler to use repository:
   ```typescript
   export async function GET() {
     try {
       const pools = await syndicateRepository.getActivePools();
       const syndicates = pools.map(mapPoolToSyndicateInfo);
       return NextResponse.json(syndicates, { headers: corsHeaders });
     } catch (error) {
       console.error('Error fetching syndicates:', error);
       return NextResponse.json(
         { error: 'Failed to fetch syndicates' },
         { status: 500 }
       );
     }
   }
   ```

### Task 1.2: Add Missing API Endpoints
**Add to same file:**

1. **GET by ID endpoint**:
   ```typescript
   export async function GET_byId(req: NextRequest) {
     const { searchParams } = new URL(req.url);
     const id = searchParams.get('id');
     if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
     
     const pool = await syndicateRepository.getPoolById(id);
     if (!pool) return NextResponse.json({ error: 'Not found' }, { status: 404 });
     
     return NextResponse.json(mapPoolToSyndicateInfo(pool));
   }
   ```

2. **POST create endpoint** (add to existing POST handler):
   ```typescript
   if (action === 'create') {
     const { name, description, coordinatorAddress, causeAllocationPercent } = body;
     // Validation
     const poolId = await syndicateRepository.createPool({
       name,
       description,
       coordinatorAddress,
       causeAllocationPercent
     });
     return NextResponse.json({ id: poolId });
   }
   ```

3. **POST join endpoint**:
   ```typescript
   if (action === 'join') {
     const { poolId, memberAddress, amountUsdc } = body;
     await syndicateRepository.addMember({ poolId, memberAddress, amountUsdc });
     return NextResponse.json({ success: true });
   }
   ```

### Task 1.3: Add CORS Headers Helper
**Add at top of file:**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
```

## Phase 2: Complete Service Layer

### Task 2.1: Implement executeSyndicatePurchase()
**File**: `/src/domains/syndicate/services/syndicateService.ts`
**Lines**: 382-416

**Implementation:**
```typescript
async executeSyndicatePurchase(
  poolId: string,
  ticketCount: number,
  coordinatorAddress: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    // Verify pool exists and is active (already implemented)
    const pool = await syndicateRepository.getPoolById(poolId);
    if (!pool) return { success: false, error: 'Pool not found' };
    if (!pool.is_active) return { success: false, error: 'Pool is not active' };
    
    // Initialize web3 service
    if (!web3Service.isReady()) {
      await web3Service.initialize();
    }
    
    // Get contract instance (need to add SyndicatePool contract to web3Service)
    // For now, use existing Megapot contract as placeholder
    // TODO: Replace with actual SyndicatePool contract
    
    // Execute purchase through web3Service
    const result = await web3Service.purchaseTickets(ticketCount, pool.pool_address);
    
    if (result.success) {
      // Track purchase in database (add ticket tracking field)
      // await syndicateRepository.recordTicketPurchase(poolId, ticketCount, result.txHash);
    }
    
    return {
      success: result.success,
      txHash: result.txHash,
      error: result.error?.message
    };
  } catch (error) {
    console.error('[SyndicateService] Purchase failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

### Task 2.2: Fix getActivePools() ticket tracking
**Line 105**: Change `totalTickets: 0` to query actual tickets

**Option 1**: Add ticket tracking to database schema
**Option 2**: Calculate from member contributions (tickets = totalPooled / ticketPrice)

### Task 2.3: Remove mock API fallback
**Lines 111-116**: Replace with direct database query:
```typescript
async getActiveSyndicates(): Promise<SyndicateInfo[]> {
  const pools = await syndicateRepository.getActivePools();
  return pools.map(mapPoolToSyndicateInfo);
}
```

## Phase 3: Create Syndicate Flow

### Task 3.1: Update create-syndicate page
**File**: `/src/app/create-syndicate/page.tsx`
**Lines**: 66-68

**Replace setTimeout with:**
```typescript
const response = await fetch('/api/syndicates', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'create',
    name: formData.name,
    description: formData.description,
    coordinatorAddress: address,
    causeAllocationPercent: formData.causePercentage
  })
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.error || 'Failed to create syndicate');
}

const { id: newPoolId } = await response.json();
// Optionally redirect to the new syndicate
router.push(`/syndicate/${newPoolId}`);
```

### Task 3.2: Remove Coming Soon banner
**Lines**: 340-343 - Delete the ComingSoonBanner component

## Phase 4: Contract Integration

### Task 4.1: Update contract configuration
**File**: `/src/config/index.ts`
**Line**: 109

**Replace zero address with:**
```typescript
syndicate: process.env.NEXT_PUBLIC_SYNDICATE_CONTRACT || "0x...", // Actual deployed address
```

### Task 4.2: Add SyndicatePool ABI
**Add to web3Service.ts or create new file:**
```typescript
export const SYNDICATE_POOL_ABI = [
  "function purchaseTicketsFromPool(uint256 poolId, uint256 ticketCount) external",
  "function getPoolInfo(uint256 poolId) external view returns (address coordinator, uint256 totalPooled, bool isActive)",
  // Add other necessary functions
];
```

## Phase 5: UI Enhancements

### Task 5.1: Remove hardcoded metrics
**File**: `/src/app/syndicate/[id]/page.tsx`
**Line**: 242

**Replace:**
```typescript
// Remove: <div className="flex justify-between items-center"><span className="text-gray-400">Weekly Growth</span><span className="text-green-400 font-medium">+12%</span></div>

// Replace with real data from API:
{syndicate.weeklyGrowth && (
  <div className="flex justify-between items-center">
    <span className="text-gray-400">Weekly Growth</span>
    <span className="text-green-400 font-medium">{syndicate.weeklyGrowth}%</span>
  </div>
)}
```

## Phase 6: Database Schema Updates

### Task 6.1: Add ticket tracking (if needed)
**Create migration:**
```sql
ALTER TABLE syndicate_pools ADD COLUMN tickets_purchased INTEGER DEFAULT 0;
ALTER TABLE syndicate_pools ADD COLUMN total_impact_usdc DECIMAL(18,6) DEFAULT 0;
```

### Task 6.2: Update repository
**Add to syndicateRepository.ts:**
```typescript
async recordTicketPurchase(poolId: string, ticketCount: number, txHash: string): Promise<void> {
  // Update pool totals
  await sql`
    UPDATE syndicate_pools
    SET tickets_purchased = tickets_purchased + ${ticketCount},
        updated_at = ${Date.now()}
    WHERE id = ${poolId}
  `;
  
  // Record in distribution history (new table)
  // await sql`INSERT INTO syndicate_distributions (...) VALUES (...)`;
}
```

## Testing Checklist

### API Endpoints
- [ ] GET /api/syndicates returns real data
- [ ] GET /api/syndicates?id=1 returns single syndicate
- [ ] POST /api/syndicates action=create creates new pool
- [ ] POST /api/syndicates action=join adds member
- [ ] POST /api/syndicates action=snapshot works (existing)

### Service Layer
- [ ] executeSyndicatePurchase() makes real contract calls
- [ ] getActivePools() returns real ticket counts
- [ ] getActiveSyndicates() doesn't fallback to mock API

### UI Flows
- [ ] Create syndicate page submits to real API
- [ ] Syndicate listing shows real data
- [ ] Syndicate detail page shows real metrics
- [ ] Join syndicate button works end-to-end

### Error Handling
- [ ] API returns proper error codes
- [ ] UI shows user-friendly error messages
- [ ] Loading states work correctly

## Rollback Plan
1. Keep mock data in separate file as fallback
2. Use feature flags for new API endpoints
3. Test thoroughly on staging before production
4. Monitor error rates after deployment