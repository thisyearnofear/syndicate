#[starknet::interface]
trait IPrivateTicketCommitment<TContractState> {
    fn commit(ref self: TContractState, commitment: felt252);
    fn reveal(ref self: TContractState, commitment_id: u64, preimage: felt252);
    fn has_commitment(self: @TContractState, commitment_id: u64) -> bool;
    fn total_commitments(self: @TContractState) -> u64;
    fn get_commitment(self: @TContractState, commitment_id: u64) -> felt252;
    fn is_revealed(self: @TContractState, commitment_id: u64) -> bool;
}

trait Ownable<TContractState> {
    fn owner(self: @TContractState) -> starknet::ContractAddress;
    fn transfer_ownership(ref self: TContractState, new_owner: starknet::ContractAddress);
}

#[starknet::contract]
mod PrivateTicketCommitment {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use super::Ownable;

    #[storage]
    struct Storage {
        commitments: Map<u64, felt252>,
        preimages: Map<u64, felt252>,
        revealed: Map<u64, bool>,
        next_id: u64,
        owner: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        CommitmentCreated: CommitmentCreated,
        CommitmentRevealed: CommitmentRevealed,
    }

    #[derive(Drop, starknet::Event)]
    struct CommitmentCreated {
        commitment_id: u64,
        commitment_hash: felt252,
        caller: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct CommitmentRevealed {
        commitment_id: u64,
        preimage: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
    }

    #[abi(embed_v0)]
    impl PrivateTicketCommitmentImpl of super::IPrivateTicketCommitment<ContractState> {
        fn commit(ref self: ContractState, commitment: felt252) {
            let commitment_id = self.next_id.read();
            self.next_id.write(commitment_id + 1);
            self.commitments.entry(commitment_id).write(commitment);
            self.revealed.entry(commitment_id).write(false);

            self.emit(Event::CommitmentCreated(CommitmentCreated {
                commitment_id,
                commitment_hash: commitment,
                caller: get_caller_address(),
            }));
        }

        fn reveal(ref self: ContractState, commitment_id: u64, preimage: felt252) {
            assert(!self.revealed.entry(commitment_id).read(), 'Already revealed');
            assert(self.commitments.entry(commitment_id).read() != 0, 'Invalid commitment');

            // Simplified: preimage stored directly for demo
            // In production, would verify hash(preimage) == commitment
            self.preimages.entry(commitment_id).write(preimage);
            self.revealed.entry(commitment_id).write(true);

            self.emit(Event::CommitmentRevealed(CommitmentRevealed {
                commitment_id,
                preimage,
            }));
        }

        fn has_commitment(self: @ContractState, commitment_id: u64) -> bool {
            self.commitments.entry(commitment_id).read() != 0
        }

        fn total_commitments(self: @ContractState) -> u64 {
            self.next_id.read()
        }

        fn get_commitment(self: @ContractState, commitment_id: u64) -> felt252 {
            self.commitments.entry(commitment_id).read()
        }

        fn is_revealed(self: @ContractState, commitment_id: u64) -> bool {
            self.revealed.entry(commitment_id).read()
        }
    }

    #[abi(per_item)]
    impl Ownership of Ownable<ContractState> {
        fn owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }

        fn transfer_ownership(ref self: ContractState, new_owner: ContractAddress) {
            assert(get_caller_address() == self.owner.read(), 'Unauthorized');
            self.owner.write(new_owner);
        }
    }
}

mod MegapotStarknet;

