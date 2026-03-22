// ===========================================================
// Syndicate Lottery — TON Payment Receiver Contract (Tact)
// ===========================================================
//
// ARCHITECTURE: On-Chain Accumulator + Payment Channels
//
// Accumulator Pattern:
//   1. User sends TON/USDT → contract stores purchase in map
//   2. Contract emits lightweight PurchaseConfirmed (for UI)
//   3. Keeper calls triggerBatchBridge() → emits BatchBridgeReady
//      with all pending purchases → relayer bridges batch total
//
// Payment Channel (agentic flow):
//   1. User opens channel with deposit
//   2. Agent signs off-chain updates (ticket purchases)
//   3. settleChannel() → reconciles on-chain → bridges
//
// Compile: npx blueprint build lottery
// Deploy:  npx blueprint run lottery --testnet

import "@stdlib/deploy";

// ===========================================================
// MESSAGES
// ===========================================================

message PurchaseTickets {
    queryId: Int as uint64;
    baseAddress: Address; // user's Base/EVM address represented as TON address
    ticketCount: Int as uint16;
}

message JettonPurchaseData {
    baseAddress: Address;
    ticketCount: Int as uint16;
}

message TriggerBatch {
    queryId: Int as uint64;
}

message OpenChannel {
    queryId: Int as uint64;
}

message SettleChannel {
    queryId: Int as uint64;
    ticketCount: Int as uint16;
    baseAddress: Address;
}

message CloseChannel {
    queryId: Int as uint64;
}

message SetBridgeFee {
    queryId: Int as uint64;
    newFee: Int as coins;
}

message SetBatchInterval {
    queryId: Int as uint64;
    newInterval: Int as uint32;
}

message AdminWithdraw {
    queryId: Int as uint64;
    destination: Address;
    amount: Int as coins;
}

message(0x7362d09c) JettonTransferNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    sender: Address;
    forwardPayload: Cell as remaining;
}

// ===========================================================
// EVENTS
// ===========================================================

event PurchaseConfirmed {
    purchaseId: Int as uint64;
    sender: Address;
    amount: Int as coins;
    ticketCount: Int as uint16;
}

event BatchBridgeReady {
    startId: Int as uint64;
    endId: Int as uint64;
    purchaseCount: Int as uint32;
}

event ChannelOpened {
    user: Address;
    deposit: Int as coins;
}

event ChannelSettled {
    purchaseId: Int as uint64;
    user: Address;
    amount: Int as coins;
    ticketCount: Int as uint16;
}

event ChannelClosed {
    user: Address;
    refund: Int as coins;
}

// ===========================================================
// STRUCTS
// ===========================================================

struct Purchase {
    sender: Address;
    amount: Int as coins;
    ticketCount: Int as uint16;
    tokenType: Int as uint8; // 0=TON, 1=USDT
    timestamp: Int as uint32;
}

struct PaymentChannel {
    user: Address;
    balance: Int as coins;
    totalDeposited: Int as coins;
    totalSpent: Int as coins;
    purchaseCount: Int as uint16;
    openedAt: Int as uint32;
    lastUpdate: Int as uint32;
    isActive: Bool;
}

struct ContractInfo {
    bridgeFee: Int as coins;
    totalPurchases: Int as uint64;
    pendingForBatch: Int as uint64;
    totalChannels: Int as uint64;
}

// ===========================================================
// CONTRACT
// ===========================================================

contract SyndicateLotteryTON with Deployable {
    // Admin
    owner: Address;
    bridgeOperator: Address;

    // Config
    bridgeFee: Int as coins;
    batchInterval: Int as uint32; // min seconds between batches
    isPaused: Bool;

    // State
    nextPurchaseId: Int as uint64;
    totalPurchases: Int as uint64;
    batchStartId: Int as uint64;     // first un-bridged purchase
    lastBatchTime: Int as uint32;
    totalChannels: Int as uint64;

    // Storage
    purchases: map<Int as uint64, Purchase>;
    channels: map<Address, PaymentChannel>;

    // ===========================================================
    // INIT
    // ===========================================================

    init(owner: Address, bridgeOperator: Address, bridgeFee: Int) {
        self.owner = owner;
        self.bridgeOperator = bridgeOperator;
        self.bridgeFee = bridgeFee;
        self.batchInterval = 300; // 5 minutes default
        self.isPaused = false;
        self.nextPurchaseId = 0;
        self.totalPurchases = 0;
        self.batchStartId = 0;
        self.lastBatchTime = 0;
        self.totalChannels = 0;
    }

    // ===========================================================
    // PURCHASE: Direct TON
    // ===========================================================

    receive(msg: PurchaseTickets) {
        require(!self.isPaused, "Contract is paused");
        require(msg.ticketCount > 0, "Ticket count must be > 0");
        require(msg.ticketCount <= 100, "Max 100 tickets per purchase");

        let required = msg.ticketCount * 1_000_000 + self.bridgeFee;
        require(context().value >= required, "Insufficient TON");

        let net = context().value - self.bridgeFee;
        let ts = now();

        self.purchases.set(self.nextPurchaseId, Purchase{
            sender: context().sender,
            amount: net,
            ticketCount: msg.ticketCount,
            tokenType: 0,
            timestamp: ts
        });

        emit(PurchaseConfirmed{
            purchaseId: self.nextPurchaseId,
            sender: context().sender,
            amount: net,
            ticketCount: msg.ticketCount
        });

        self.nextPurchaseId = self.nextPurchaseId + 1;
        self.totalPurchases = self.totalPurchases + 1;
    }

    // ===========================================================
    // PURCHASE: USDT Jetton
    // ===========================================================

    receive(msg: JettonTransferNotification) {
        require(!self.isPaused, "Contract is paused");

        let ticketCount: Int;
        if (msg.forwardPayload.asSlice().empty() == false) {
            let data = JettonPurchaseData.fromCell(msg.forwardPayload);
            ticketCount = data.ticketCount;
        } else {
            ticketCount = 1;
        }

        require(ticketCount > 0, "Ticket count must be > 0");
        require(ticketCount <= 100, "Max 100 tickets per purchase");
        let ts = now();

        self.purchases.set(self.nextPurchaseId, Purchase{
            sender: msg.sender,
            amount: msg.amount,
            ticketCount: ticketCount,
            tokenType: 1,
            timestamp: ts
        });

        emit(PurchaseConfirmed{
            purchaseId: self.nextPurchaseId,
            sender: msg.sender,
            amount: msg.amount,
            ticketCount: ticketCount
        });

        self.nextPurchaseId = self.nextPurchaseId + 1;
        self.totalPurchases = self.totalPurchases + 1;
    }

    // ===========================================================
    // BATCH: Trigger batch bridge (permissionless)
    // ===========================================================

    receive(msg: TriggerBatch) {
        let elapsed = now() - self.lastBatchTime;
        let isAuth = (context().sender == self.owner) | (context().sender == self.bridgeOperator);

        require((elapsed >= self.batchInterval) | isAuth, "Too early for batch");

        let pending = self.nextPurchaseId - self.batchStartId;
        if (pending > 0) {
            emit(BatchBridgeReady{
                startId: self.batchStartId,
                endId: self.nextPurchaseId,
                purchaseCount: pending
            });

            self.lastBatchTime = now();
            self.batchStartId = self.nextPurchaseId;
        }
    }

    // ===========================================================
    // CHANNEL: Open payment channel
    // ===========================================================

    receive(msg: OpenChannel) {
        require(context().value >= 10_000_000, "Min deposit 10 TON");

        let existing = self.channels.get(context().sender);
        if (existing != null) {
            require(!existing.isActive, "Already has active channel");
        }

        let ts = now();
        self.channels.set(context().sender, PaymentChannel{
            user: context().sender,
            balance: context().value,
            totalDeposited: context().value,
            totalSpent: 0,
            purchaseCount: 0,
            openedAt: ts,
            lastUpdate: ts,
            isActive: true
        });

        self.totalChannels = self.totalChannels + 1;

        emit(ChannelOpened{user: context().sender, deposit: context().value});
    }

    // ===========================================================
    // CHANNEL: Settle (agent purchases via channel)
    // ===========================================================

    receive(msg: SettleChannel) {
        require(!self.isPaused, "Contract is paused");
        require(msg.ticketCount > 0, "Ticket count must be > 0");
        require(msg.ticketCount <= 100, "Max 100 tickets per purchase");

        let ch = self.channels.get(context().sender);
        require(ch != null, "No channel found");
        require(ch.isActive, "Channel not active");

        let cost = msg.ticketCount * 1_000_000;
        require(ch.balance >= cost, "Insufficient channel balance");

        // Update channel
        self.channels.set(context().sender, PaymentChannel{
            user: ch.user,
            balance: ch.balance - cost,
            totalDeposited: ch.totalDeposited,
            totalSpent: ch.totalSpent + cost,
            purchaseCount: ch.purchaseCount + msg.ticketCount,
            openedAt: ch.openedAt,
            lastUpdate: now(),
            isActive: true
        });

        // Store purchase
        self.purchases.set(self.nextPurchaseId, Purchase{
            sender: context().sender,
            amount: cost,
            ticketCount: msg.ticketCount,
            tokenType: 1,
            timestamp: now()
        });

        emit(ChannelSettled{
            purchaseId: self.nextPurchaseId,
            user: context().sender,
            amount: cost,
            ticketCount: msg.ticketCount
        });

        self.nextPurchaseId = self.nextPurchaseId + 1;
        self.totalPurchases = self.totalPurchases + 1;
    }

    // ===========================================================
    // CHANNEL: Close (refund remaining)
    // ===========================================================

    receive(msg: CloseChannel) {
        let ch = self.channels.get(context().sender);
        require(ch != null, "No channel found");
        require(ch.isActive, "Channel not active");
        require(ch.balance > 0, "No balance to refund");

        let refund = ch.balance;

        // Mark inactive
        self.channels.set(context().sender, PaymentChannel{
            user: ch.user,
            balance: 0,
            totalDeposited: ch.totalDeposited,
            totalSpent: ch.totalSpent,
            purchaseCount: ch.purchaseCount,
            openedAt: ch.openedAt,
            lastUpdate: now(),
            isActive: false
        });

        send(SendParameters{
            to: context().sender,
            value: refund,
            mode: SendIgnoreErrors
        });

        emit(ChannelClosed{user: context().sender, refund: refund});
    }

    // ===========================================================
    // ADMIN
    // ===========================================================

    receive(msg: SetBridgeFee) {
        require(context().sender == self.owner, "Owner only");
        self.bridgeFee = msg.newFee;
    }

    receive(msg: SetBatchInterval) {
        require(context().sender == self.owner, "Owner only");
        self.batchInterval = msg.newInterval;
    }

    receive(msg: AdminWithdraw) {
        require(context().sender == self.owner, "Owner only");
        send(SendParameters{
            to: msg.destination,
            value: msg.amount,
            mode: SendIgnoreErrors
        });
    }

    // ===========================================================
    // GET METHODS
    // ===========================================================

    get fun contractInfo(): ContractInfo {
        let pending = self.nextPurchaseId - self.batchStartId;
        return ContractInfo{
            bridgeFee: self.bridgeFee,
            totalPurchases: self.totalPurchases,
            pendingForBatch: pending,
            totalChannels: self.totalChannels
        };
    }

    get fun batchStatus(): BatchStatus {
        return BatchStatus{
            pendingCount: self.nextPurchaseId - self.batchStartId,
            startId: self.batchStartId,
            endId: self.nextPurchaseId,
            lastBatchTime: self.lastBatchTime,
            batchInterval: self.batchInterval
        };
    }

    get fun getChannel(user: Address): PaymentChannel? {
        return self.channels.get(user);
    }

    get fun getPurchase(id: Int as uint64): Purchase? {
        return self.purchases.get(id);
    }
}

struct BatchStatus {
    pendingCount: Int as uint64;
    startId: Int as uint64;
    endId: Int as uint64;
    lastBatchTime: Int as uint32;
    batchInterval: Int as uint32;
}
