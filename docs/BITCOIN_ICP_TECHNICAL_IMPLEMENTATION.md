# Bitcoin/ICP Technical Implementation

**Last Updated**: Nov 22, 2025  
**Status**: Implementation Planning

## ICP Canister Development

### Week 4-5: ICP Canister Development

#### Week 4: Learn + Setup
- [ ] ICP fundamentals (canisters, Candid, cycles)
- [ ] Set up dfx development environment
- [ ] Create test canister project
- [ ] Learn Bitcoin API basics
- [ ] Run IC local replica

**Resources**:
- ICP Developer Docs: https://internetcomputer.org/docs/current/developer-docs
- Basic Bitcoin example: IC GitHub
- Candid spec: https://github.com/dfinity/candid

**Deliverable**: Working local canister with Bitcoin balance queries

#### Week 5: Core Bitcoin Canister
Build `bitcoin-lottery.did` + `bitcoin-lottery.rs`:

```rust
// Core functions to implement
service : {
  // Lottery functions
  "create_lottery" : (CreateLotteryRequest) -> (CreateLotteryResponse);
  "purchase_ticket" : (PurchaseTicketRequest) -> (PurchaseTicketResponse);
  "draw_winner" : (DrawWinnerRequest) -> (DrawWinnerResponse);
  
  // Bitcoin integration
  "get_btc_balance" : (GetBtcBalanceRequest) -> (GetBtcBalanceResponse);
  "send_btc_transaction" : (SendBtcTransactionRequest) -> (SendBtcTransactionResponse);
  
  // ICP-specific
  "get_cycles_balance" : () -> (nat64);
}
```

## Rust Canister Implementation

### Core Data Structures

```rust
// Types for lottery management
type LotteryId = u64;
type TicketId = u64;
type UserId = Principal;

#[derive(CandidType, Deserialize, Clone)]
struct Lottery {
    id: LotteryId,
    name: String,
    description: String,
    ticket_price: u64, // in satoshis
    max_tickets: u32,
    tickets_sold: u32,
    winner_drawn: bool,
    winner: Option<UserId>,
    created_at: u64, // timestamp
    end_time: u64, // timestamp
}

#[derive(CandidType, Deserialize, Clone)]
struct Ticket {
    id: TicketId,
    lottery_id: LotteryId,
    owner: UserId,
    purchase_time: u64, // timestamp
    transaction_id: String, // Bitcoin transaction ID
}

#[derive(CandidType, Deserialize)]
struct CreateLotteryRequest {
    name: String,
    description: String,
    ticket_price_satoshis: u64,
    max_tickets: u32,
    duration_hours: u32,
}

#[derive(CandidType)]
struct CreateLotteryResponse {
    success: bool,
    lottery_id: Option<LotteryId>,
    error: Option<String>,
}

#[derive(CandidType, Deserialize)]
struct PurchaseTicketRequest {
    lottery_id: LotteryId,
    btc_transaction_id: String,
    btc_amount_satoshis: u64,
}

#[derive(CandidType)]
struct PurchaseTicketResponse {
    success: bool,
    ticket_id: Option<TicketId>,
    error: Option<String>,
}
```

### Bitcoin Integration

```rust
use ic_cdk::api::management_canister::bitcoin::*;

// Get Bitcoin balance for the canister
#[update]
async fn get_btc_balance(network: BitcoinNetwork) -> u64 {
    let balance = bitcoin_get_balance(
        bitcoin_get_balance_args(network)
    ).await.unwrap();
    
    balance
}

// Send Bitcoin transaction
#[update]
async fn send_btc_transaction(
    network: BitcoinNetwork,
    address: String,
    amount_satoshis: u64,
    fee_satoshis: u64
) -> SendTransactionResult {
    let args = SendTransactionRequest {
        network,
        address,
        amount_satoshis,
        fee_satoshis,
    };
    
    let result = bitcoin_send_transaction(args).await;
    
    match result {
        Ok(_) => SendTransactionResult::Success,
        Err(e) => SendTransactionResult::Error(format!("{:?}", e)),
    }
}

#[derive(CandidType)]
enum SendTransactionResult {
    Success,
    Error(String),
}
```

### Lottery Management Functions

```rust
use std::cell::RefCell;
use std::collections::HashMap;
use ic_cdk::api::time;

thread_local! {
    static LOTTERIES: RefCell<HashMap<LotteryId, Lottery>> = RefCell::new(HashMap::new());
    static TICKETS: RefCell<HashMap<TicketId, Ticket>> = RefCell::new(HashMap::new());
    static LOTTERY_COUNTER: RefCell<u64> = RefCell::new(0);
    static TICKET_COUNTER: RefCell<u64> = RefCell::new(0);
}

#[update]
fn create_lottery(request: CreateLotteryRequest) -> CreateLotteryResponse {
    let id = LOTTERY_COUNTER.with(|counter| {
        let mut counter = counter.borrow_mut();
        *counter += 1;
        *counter
    });
    
    let now = time() / 1_000_000_000; // Convert nanoseconds to seconds
    let end_time = now + (request.duration_hours as u64 * 3600);
    
    let lottery = Lottery {
        id,
        name: request.name,
        description: request.description,
        ticket_price: request.ticket_price_satoshis,
        max_tickets: request.max_tickets,
        tickets_sold: 0,
        winner_drawn: false,
        winner: None,
        created_at: now,
        end_time,
    };
    
    LOTTERIES.with(|lotteries| {
        lotteries.borrow_mut().insert(id, lottery);
    });
    
    CreateLotteryResponse {
        success: true,
        lottery_id: Some(id),
        error: None,
    }
}

#[update]
fn purchase_ticket(request: PurchaseTicketRequest) -> PurchaseTicketResponse {
    // Verify lottery exists and is active
    let lottery = LOTTERIES.with(|lotteries| {
        lotteries.borrow().get(&request.lottery_id).cloned()
    });
    
    if lottery.is_none() {
        return PurchaseTicketResponse {
            success: false,
            ticket_id: None,
            error: Some("Lottery not found".to_string()),
        };
    }
    
    let mut lottery = lottery.unwrap();
    
    // Check if lottery has ended
    let now = time() / 1_000_000_000;
    if now > lottery.end_time {
        return PurchaseTicketResponse {
            success: false,
            ticket_id: None,
            error: Some("Lottery has ended".to_string()),
        };
    }
    
    // Check if maximum tickets reached
    if lottery.tickets_sold >= lottery.max_tickets {
        return PurchaseTicketResponse {
            success: false,
            ticket_id: None,
            error: Some("Maximum tickets sold".to_string()),
        };
    }
    
    // Verify Bitcoin transaction (simplified - would need more validation in production)
    if request.btc_amount_satoshis < lottery.ticket_price {
        return PurchaseTicketResponse {
            success: false,
            ticket_id: None,
            error: Some("Insufficient Bitcoin amount".to_string()),
        };
    }
    
    // Create ticket
    let ticket_id = TICKET_COUNTER.with(|counter| {
        let mut counter = counter.borrow_mut();
        *counter += 1;
        *counter
    });
    
    let ticket = Ticket {
        id: ticket_id,
        lottery_id: request.lottery_id,
        owner: ic_cdk::caller(),
        purchase_time: now,
        transaction_id: request.btc_transaction_id,
    };
    
    TICKETS.with(|tickets| {
        tickets.borrow_mut().insert(ticket_id, ticket);
    });
    
    // Update lottery
    lottery.tickets_sold += 1;
    LOTTERIES.with(|lotteries| {
        lotteries.borrow_mut().insert(request.lottery_id, lottery);
    });
    
    PurchaseTicketResponse {
        success: true,
        ticket_id: Some(ticket_id),
        error: None,
    }
}

#[update]
fn draw_winner(lottery_id: LotteryId) -> DrawWinnerResponse {
    // Verify lottery exists
    let lottery = LOTTERIES.with(|lotteries| {
        lotteries.borrow().get(&lottery_id).cloned()
    });
    
    if lottery.is_none() {
        return DrawWinnerResponse {
            success: false,
            winner: None,
            error: Some("Lottery not found".to_string()),
        };
    }
    
    let mut lottery = lottery.unwrap();
    
    // Check if lottery has ended
    let now = time() / 1_000_000_000;
    if now < lottery.end_time {
        return DrawWinnerResponse {
            success: false,
            winner: None,
            error: Some("Lottery is still active".to_string()),
        };
    }
    
    // Check if winner already drawn
    if lottery.winner_drawn {
        return DrawWinnerResponse {
            success: false,
            winner: None,
            error: Some("Winner already drawn".to_string()),
        };
    }
    
    // Get all tickets for this lottery
    let tickets: Vec<Ticket> = TICKETS.with(|tickets| {
        tickets.borrow()
            .values()
            .filter(|ticket| ticket.lottery_id == lottery_id)
            .cloned()
            .collect()
    });
    
    if tickets.is_empty() {
        return DrawWinnerResponse {
            success: false,
            winner: None,
            error: Some("No tickets sold".to_string()),
        };
    }
    
    // Simple random selection (would need cryptographic randomness in production)
    let winner_index = (now % tickets.len() as u64) as usize;
    let winner = tickets[winner_index].owner;
    
    // Update lottery
    lottery.winner_drawn = true;
    lottery.winner = Some(winner);
    
    LOTTERIES.with(|lotteries| {
        lotteries.borrow_mut().insert(lottery_id, lottery);
    });
    
    DrawWinnerResponse {
        success: true,
        winner: Some(winner),
        error: None,
    }
}

#[derive(CandidType)]
struct DrawWinnerResponse {
    success: bool,
    winner: Option<UserId>,
    error: Option<String>,
}
```

## TypeScript Frontend Integration

### Bitcoin Wallet Integration

```typescript
// Connect to Bitcoin wallet (e.g., Leather, Xverse)
async function connectBitcoinWallet(): Promise<string | null> {
  if (typeof window.bitcoin === 'undefined') {
    throw new Error('Bitcoin wallet not found');
  }
  
  try {
    const response = await window.bitcoin.request('getAddresses');
    return response.addresses[0].address; // Return first address
  } catch (error) {
    console.error('Failed to connect to Bitcoin wallet:', error);
    return null;
  }
}

// Create Bitcoin transaction for lottery ticket
async function createBitcoinTransaction(
  recipientAddress: string,
  amountSatoshis: number,
  feeSatoshis: number = 1000
): Promise<string | null> {
  try {
    const response = await window.bitcoin.request('sendTransfer', {
      recipients: [
        {
          address: recipientAddress,
          amount: amountSatoshis,
        },
      ],
      feeRate: feeSatoshis,
    });
    
    return response.txid; // Return transaction ID
  } catch (error) {
    console.error('Failed to create Bitcoin transaction:', error);
    return null;
  }
}

// Verify Bitcoin transaction
async function verifyBitcoinTransaction(
  txId: string,
  expectedAmount: number,
  recipientAddress: string
): Promise<boolean> {
  try {
    // In a real implementation, you would query a Bitcoin node or API
    // to verify the transaction details
    const response = await fetch(`https://blockstream.info/api/tx/${txId}`);
    const txData = await response.json();
    
    // Verify recipient address and amount
    const output = txData.vout.find((out: any) => 
      out.scriptpubkey_address === recipientAddress
    );
    
    if (!output) {
      return false;
    }
    
    const amountSatoshis = Math.round(output.value * 100000000); // Convert BTC to satoshis
    return amountSatoshis >= expectedAmount;
  } catch (error) {
    console.error('Failed to verify Bitcoin transaction:', error);
    return false;
  }
}
```

### ICP Canister Interaction

```typescript
import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory } from './declarations/bitcoin_lottery.did.js';

// Initialize ICP agent
const agent = new HttpAgent({ host: 'http://localhost:8000' });
const canisterId = 'rrkah-fqaaa-aaaaa-aaaaq-cai'; // Local canister ID

// Create actor to interact with canister
const actor = Actor.createActor(idlFactory, {
  agent,
  canisterId,
});

// Create lottery
async function createLottery(
  name: string,
  description: string,
  ticketPriceSatoshis: number,
  maxTickets: number,
  durationHours: number
) {
  try {
    const result = await actor.create_lottery({
      name,
      description,
      ticket_price_satoshis: BigInt(ticketPriceSatoshis),
      max_tickets: maxTickets,
      duration_hours: durationHours,
    });
    
    if (result.success) {
      return result.lottery_id;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Failed to create lottery:', error);
    throw error;
  }
}

// Purchase lottery ticket
async function purchaseTicket(
  lotteryId: number,
  btcTransactionId: string,
  btcAmountSatoshis: number
) {
  try {
    const result = await actor.purchase_ticket({
      lottery_id: BigInt(lotteryId),
      btc_transaction_id: btcTransactionId,
      btc_amount_satoshis: BigInt(btcAmountSatoshis),
    });
    
    if (result.success) {
      return result.ticket_id;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Failed to purchase ticket:', error);
    throw error;
  }
}

// Draw lottery winner
async function drawWinner(lotteryId: number) {
  try {
    const result = await actor.draw_winner(BigInt(lotteryId));
    
    if (result.success) {
      return result.winner;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Failed to draw winner:', error);
    throw error;
  }
}
```

## Testing Strategy

### Unit Tests for Canister

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_create_lottery() {
        let request = CreateLotteryRequest {
            name: "Test Lottery".to_string(),
            description: "A test lottery".to_string(),
            ticket_price_satoshis: 10000,
            max_tickets: 100,
            duration_hours: 24,
        };
        
        let response = create_lottery(request);
        assert!(response.success);
        assert!(response.lottery_id.is_some());
    }
    
    #[test]
    fn test_purchase_ticket() {
        // First create a lottery
        let create_request = CreateLotteryRequest {
            name: "Test Lottery".to_string(),
            description: "A test lottery".to_string(),
            ticket_price_satoshis: 10000,
            max_tickets: 100,
            duration_hours: 24,
        };
        
        let create_response = create_lottery(create_request);
        let lottery_id = create_response.lottery_id.unwrap();
        
        // Then purchase a ticket
        let purchase_request = PurchaseTicketRequest {
            lottery_id,
            btc_transaction_id: "test_tx_id".to_string(),
            btc_amount_satoshis: 10000,
        };
        
        let purchase_response = purchase_ticket(purchase_request);
        assert!(purchase_response.success);
        assert!(purchase_response.ticket_id.is_some());
    }
}
```

### Integration Tests

```typescript
// Integration tests for frontend
describe('Bitcoin Lottery Integration', () => {
  test('should create lottery and purchase ticket', async () => {
    // Create lottery
    const lotteryId = await createLottery(
      'Test Lottery',
      'A test lottery',
      10000, // 10,000 satoshis
      100,
      24
    );
    
    expect(lotteryId).toBeDefined();
    
    // Connect to Bitcoin wallet
    const btcAddress = await connectBitcoinWallet();
    expect(btcAddress).toBeDefined();
    
    // Create Bitcoin transaction
    const txId = await createBitcoinTransaction(
      'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', // Test recipient address
      10000
    );
    
    expect(txId).toBeDefined();
    
    // Purchase ticket
    const ticketId = await purchaseTicket(
      Number(lotteryId),
      txId!,
      10000
    );
    
    expect(ticketId).toBeDefined();
  });
});
```

## Deployment

### Local Development

```bash
# Install dfx
sh -ci "$(curl -fsSL https://sdk.dfinity.org/install.sh)"

# Start local replica
dfx start --background

# Deploy canister
dfx deploy

# Stop local replica
dfx stop
```

### Mainnet Deployment

```bash
# Deploy to mainnet
dfx deploy --network ic

# Get canister status
dfx canister status bitcoin_lottery --network ic

# Manage cycles
dfx canister deposit-cycles 1000000000000 bitcoin_lottery --network ic
```

## Security Considerations

1. **Bitcoin Transaction Verification**: Always verify Bitcoin transactions on-chain before accepting them
2. **Randomness**: Use cryptographic randomness for winner selection, not simple modulo operations
3. **Cycles Management**: Monitor and manage cycles to ensure canister remains operational
4. **Access Control**: Implement proper access control for administrative functions
5. **Input Validation**: Validate all inputs to prevent injection attacks
6. **Error Handling**: Implement comprehensive error handling to prevent unexpected behavior