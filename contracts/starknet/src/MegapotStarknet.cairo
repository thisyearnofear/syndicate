//! Megapot Starknet Contract
//! 
//! Enables Starknet users to:
//! - Track lottery ticket holdings on Starknet
//! - Authorize auto-purchases (x402-style permissions)
//! - Claim winnings directly to Starknet
//!
//! This contract bridges the Base lottery experience to Starknet.

#[starknet::interface]
trait IExternalFunctions<TContractState> {
    fn deposit_winnings(ref self: TContractState, user: starknet::ContractAddress, amount: u128);
}

#[starknet::interface]
trait IMegapotStarknet<TContractState> {
    // === Ticket Management ===
    fn get_ticket_count(self: @TContractState, user: starknet::ContractAddress, round_id: u64) -> u32;
    fn get_total_tickets(self: @TContractState, round_id: u64) -> u32;
    
    // === Auto-Purchase Authorization (x402-style) ===
    fn authorize_auto_purchase(
        ref self: TContractState,
        max_tickets_per_round: u32,
        max_total_tickets: u32,
        valid_until: u64,
    );
    fn revoke_authorization(ref self: TContractState);
    fn get_authorization(self: @TContractState, user: starknet::ContractAddress) -> Authorization;
    
    // === Winnings ===
    fn claim_winnings(ref self: TContractState, round_id: u64, amount: u128);
    fn get_winnings(self: @TContractState, user: starknet::ContractAddress) -> u128;
    
    // === Admin ===
    fn register_tickets(ref self: TContractState, user: starknet::ContractAddress, round_id: u64, count: u32);
    fn set_minter(ref self: TContractState, minter: starknet::ContractAddress);
}

#[derive(Drop, starknet::Store, Serde)]
struct Authorization {
    is_authorized: bool,
    max_tickets_per_round: u32,
    max_total_tickets: u32,
    valid_until: u64,
    authorized_at: u64,
}

#[starknet::contract]
mod MegapotStarknet {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };

    #[storage]
    struct Storage {
        // Ticket tracking: user -> round_id -> ticket count
        tickets: Map<(ContractAddress, u64), u32>,
        // Total tickets per round
        total_tickets: Map<u64, u32>,
        // Pending winnings per user
        winnings: Map<ContractAddress, u128>,
        // Auto-purchase authorizations
        authorizations: Map<ContractAddress, super::Authorization>,
        // Contract owner
        owner: ContractAddress,
        // Authorized minter (Syndicate backend)
        minter: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        TicketsRegistered: TicketsRegistered,
        AuthorizationCreated: AuthorizationCreated,
        AuthorizationRevoked: AuthorizationRevoked,
        WinningsClaimed: WinningsClaimed,
        WinningsDeposited: WinningsDeposited,
    }

    #[derive(Drop, starknet::Event)]
    struct TicketsRegistered {
        user: ContractAddress,
        round_id: u64,
        count: u32,
        total_for_round: u32,
    }

    #[derive(Drop, starknet::Event)]
    struct AuthorizationCreated {
        user: ContractAddress,
        max_tickets_per_round: u32,
        max_total_tickets: u32,
        valid_until: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct AuthorizationRevoked {
        user: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct WinningsClaimed {
        user: ContractAddress,
        round_id: u64,
        amount: u128,
    }

    #[derive(Drop, starknet::Event)]
    struct WinningsDeposited {
        user: ContractAddress,
        amount: u128,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
        self.minter.write(owner);
    }

    #[abi(embed_v0)]
    impl MegapotStarknetImpl of super::IMegapotStarknet<ContractState> {
        fn get_ticket_count(
            self: @ContractState, 
            user: ContractAddress, 
            round_id: u64
        ) -> u32 {
            self.tickets.entry((user, round_id)).read()
        }

        fn get_total_tickets(self: @ContractState, round_id: u64) -> u32 {
            self.total_tickets.entry(round_id).read()
        }

        fn authorize_auto_purchase(
            ref self: ContractState,
            max_tickets_per_round: u32,
            max_total_tickets: u32,
            valid_until: u64,
        ) {
            let caller = get_caller_address();
            let now = get_block_timestamp();
            
            assert(valid_until > now, 'Invalid expiry');
            
            self.authorizations.entry(caller).write(
                super::Authorization {
                    is_authorized: true,
                    max_tickets_per_round,
                    max_total_tickets,
                    valid_until,
                    authorized_at: now,
                }
            );

            self.emit(Event::AuthorizationCreated(AuthorizationCreated {
                user: caller,
                max_tickets_per_round,
                max_total_tickets,
                valid_until,
            }));
        }

        fn revoke_authorization(ref self: ContractState) {
            let caller = get_caller_address();
            self.authorizations.entry(caller).write(
                super::Authorization {
                    is_authorized: false,
                    max_tickets_per_round: 0,
                    max_total_tickets: 0,
                    valid_until: 0,
                    authorized_at: 0,
                }
            );

            self.emit(Event::AuthorizationRevoked(AuthorizationRevoked { user: caller }));
        }

        fn get_authorization(self: @ContractState, user: ContractAddress) -> super::Authorization {
            self.authorizations.entry(user).read()
        }

        fn claim_winnings(ref self: ContractState, round_id: u64, amount: u128) {
            let caller = get_caller_address();
            let pending = self.winnings.entry(caller).read();
            
            assert(pending >= amount, 'Insufficient winnings');
            
            self.winnings.entry(caller).write(pending - amount);
            
            // In production: transfer ETH/STRK to user
            // For now, just emit event - would integrate with token bridge
            
            self.emit(Event::WinningsClaimed(WinningsClaimed {
                user: caller,
                round_id,
                amount,
            }));
        }

        fn get_winnings(self: @ContractState, user: ContractAddress) -> u128 {
            self.winnings.entry(user).read()
        }

        fn register_tickets(
            ref self: ContractState, 
            user: ContractAddress, 
            round_id: u64, 
            count: u32
        ) {
            // Only authorized minter can register tickets
            assert(get_caller_address() == self.minter.read(), 'Unauthorized minter');
            
            let current = self.tickets.entry((user, round_id)).read();
            self.tickets.entry((user, round_id)).write(current + count);
            
            let total = self.total_tickets.entry(round_id).read();
            self.total_tickets.entry(round_id).write(total + count);
            
            self.emit(Event::TicketsRegistered(TicketsRegistered {
                user,
                round_id,
                count,
                total_for_round: total + count,
            }));
        }

        fn set_minter(ref self: ContractState, minter: ContractAddress) {
            assert(get_caller_address() == self.owner.read(), 'Only owner');
            self.minter.write(minter);
        }
    }

    /// External function to deposit winnings (called by admin)
    #[external(v0)]
    impl ExternalImpl of super::IExternalFunctions<ContractState> {
        fn deposit_winnings(ref self: ContractState, user: ContractAddress, amount: u128) {
            assert(get_caller_address() == self.owner.read(), 'Only owner');
            
            let current = self.winnings.entry(user).read();
            self.winnings.entry(user).write(current + amount);
            
            self.emit(Event::WinningsDeposited(WinningsDeposited { user, amount }));
        }
    }
}
