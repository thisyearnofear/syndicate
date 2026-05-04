# Chain Architecture Brief

## Purpose
Define a single, coherent mental model for how Syndicate uses chains in the product.

This brief is the source of truth for product copy, UX decisions, and judge-facing explanations.

## Core Model

### Base = Execution Layer
Base is where Syndicate executes core product flows:
- vault deposits
- yield strategies
- syndicate coordination
- settlement and downstream actions

User-facing implication:
- Base is the product’s operational home.

## Fhenix = Privacy Layer
Fhenix powers the private vault mode of the Base-native product.

It should be described to users as:
- private vaults powered by Fhenix
- privacy-native syndicate coordination
- selective disclosure on top of Base execution

It should **not** be treated in product language as just another equal chain alongside Base, Solana, or Stacks.

User-facing implication:
- Base executes
- Fhenix adds privacy

## Solana = Funding Rail
Solana is a source ecosystem for bringing users and funds into the Base-native product.

User-facing implication:
- fund from Solana
- settle on Base
- optionally use private vault flows after funding lands

## Stacks = Funding Rail
Stacks is a secondary, more advanced funding rail into the Base-native system.

It is important strategically, but should not be given the same product prominence as Base or Fhenix in first-run UX.

User-facing implication:
- fund from Stacks
- settle on Base
- continue into public or private strategies

## Recommended Product Hierarchy

### Tier 1: Core product rails
- Base
- Fhenix

### Tier 2: Funding rails
- Solana
- Stacks
- NEAR
- Ethereum
- Starknet

## UX Rules

### Always say
- Base is the execution layer
- Fhenix powers private vault mode
- external chains fund or route into the Base-native experience

### Avoid saying
- all supported chains are equal product homes
- Fhenix is just another chain option
- bridging exists only for tickets

## Copy Rules

### Good examples
- Fund on Base from Solana or Stacks
- Continue into a Base-native vault
- Private vaults powered by Fhenix
- Selective disclosure on top of Base execution

### Bad examples
- Bridge to Base for ticket purchases
- Multi-chain everywhere
- Fhenix as a peer alternative to Base in top-level product messaging

## Strategic Summary
Syndicate is best understood as a **Base-native product with a Fhenix privacy layer and multi-chain funding rails**.

That is the clearest and most defensible representation of the current system.

