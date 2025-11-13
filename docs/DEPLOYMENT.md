# Octant v2 USDC Vault & Strategy Deployment Guide

This guide walks you through deploying and wiring a minimal ERC-4626 USDC vault and an Octant Tokenized Strategy so you can run end-to-end tests on Ethereum mainnet (via your Tenderly fork) and Base for ticket purchases.

## Overview

- Goal: Have concrete contract addresses for an ERC-4626 USDC vault, its strategy, and donation/distribution wiring so the app can deposit, lock, withdraw, and convert yield to tickets/causes.
- Network setup: Use your Tenderly mainnet fork (chain ID `8`) for origin operations (USDC vault deposit/withdraw and CCTP burn), and Base for ticket purchases.
- Asset: `USDC` on Ethereum mainnet (`0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`).

## Prerequisites

- MetaMask configured for your Tenderly mainnet fork:
  - `Network Name`: Tenderly Mainnet Fork
  - `RPC URL`: your fork RPC (e.g., `https://virtual.mainnet.eu.rpc.tenderly.co/<id>`)
  - `Chain ID`: `8`
  - `Currency Symbol`: `ETH`
- Environment variable set in your app: `NEXT_PUBLIC_TENDERLY_MAINNET_FORK_RPC` pointing to the same RPC.
- A deployer wallet with test ETH and USDC on the fork:
  - Fund ETH in the fork via Tenderly.
  - For USDC, use Tenderly to mint or impersonate a holder to transfer to your wallet (fork-only).
- Tooling: `Foundry` or `Hardhat` with Node.js `>=18`.

## Components To Deploy

- ERC-4626 USDC Vault
  - Minimal tokenized vault holding `USDC` (`6` decimals) for deposits/withdrawals.
  - Must expose ERC-4626 methods: `deposit(uint256,address)`, `withdraw(uint256,address,address)`, `redeem(uint256,address,address)`, `totalAssets()`, `asset()`.
- Octant Tokenized Strategy (Optional for MVP)
  - If using Octant’s Yield Donating Tokenized Strategy, set a donation address where yield shares accrue.
  - Alternatively, for first tests, you can operate directly against the ERC-4626 vault and bypass strategy creation.
- Donation/Distribution Address
  - A simple EOA to receive donation shares or funds; can be replaced later with `PaymentSplitter` or Splits.xyz.

## Option A: Use an Existing ERC-4626 Vault (Fastest)

- Recommendation: Yearn V3 ERC-4626 USDC vault (e.g., `yvUSDC-1` or `ysUSDC`). Yearn V3 vaults are ERC-4626 compliant.
- Caveat: You must confirm the specific vault address for Ethereum mainnet V3. If you prefer this route, share the exact Yearn V3 USDC vault address and we will wire it to config and test deposits on the fork.

## Option B: Deploy a Minimal ERC-4626 USDC Vault (Deterministic)

Deploy your own vault so you fully control behavior and parameters. Below is a reference pattern using OpenZeppelin `IERC4626` interface.

### Reference Contract (Simplified ERC-4626)

> Note: Use audited implementations where possible (e.g., Yearn V3 Tokenized Strategy or OZ reference). The snippet below is illustrative.

```
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

contract SimpleUSDCVault is ERC20 {
    IERC20 public immutable assetToken; // USDC

    constructor(address _usdc) ERC20("Simple USDC Vault", "sUSDCV") {
        assetToken = IERC20(_usdc);
    }

    // Minimal deposit/withdraw API compatible with ERC-4626 expectations
    function asset() external view returns (address) { return address(assetToken); }
    function totalAssets() external view returns (uint256) { return assetToken.balanceOf(address(this)); }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        require(assets > 0, "assets=0");
        // Pull USDC from sender
        require(assetToken.transferFrom(msg.sender, address(this), assets));
        // Mint 1:1 shares for demo (real vaults use pricing functions)
        shares = assets * 1e12; // normalize USDC 6d to 18d shares for demo
        _mint(receiver, shares);
        return shares;
    }

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
        require(assets > 0, "assets=0");
        // Burn shares 1:1
        shares = assets * 1e12;
        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }
        _burn(owner, shares);
        require(assetToken.transfer(receiver, assets));
        return shares;
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        require(shares > 0, "shares=0");
        assets = shares / 1e12;
        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }
        _burn(owner, shares);
        require(assetToken.transfer(receiver, assets));
        return assets;
    }
}
```

### Deployment Steps (Foundry)

- Initialize a new Foundry project or use your existing contracts repo.
- Add OpenZeppelin:
  - `forge install OpenZeppelin/openzeppelin-contracts`
- Create `SimpleUSDCVault.sol` with the reference code above and compile:
  - `forge build`
- Set RPC to your Tenderly fork and deploy:
  - `forge create --rpc-url <FORK_RPC> --private-key <PK> src/SimpleUSDCVault.sol:SimpleUSDCVault --constructor-args 0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`
- Record deployed vault address: `VAULT_ADDRESS`.

### Post-Deploy Setup

- Approve the vault to spend USDC for your wallet:
  - From your app’s signer, call `USDC.approve(VAULT_ADDRESS, amount)`.
- Test deposit/withdraw using the app or directly:
  - `vault.deposit(amount, receiver)`
  - `vault.withdraw(amount, receiver, owner)`

## Option C: Octant Tokenized Strategy

If integrating Octant’s Tokenized Strategy for yield-donation flows:

- Use Octant factory or strategy creation API. Based on the ABI in `src/abis/OctantV2.json`, relevant functions include:
  - `createStrategy(address _compounderVault, string _name, address _management, address _keeper, address _emergencyAdmin, address _donationAddress, bool _enableBurning, address _tokenizedStrategyAddress)`
  - `deposit(uint256 assets, address receiver)`
  - `withdraw(uint256 assets, address receiver, address owner)`

### Strategy Parameters

- `_compounderVault`: `VAULT_ADDRESS` (your ERC-4626 USDC vault)
- `_name`: e.g., `"Octant USDC Strategy"`
- `_management`: your EOA for admin ops
- `_keeper`: EOA or bot for routine ops
- `_emergencyAdmin`: EOA for emergency stops
- `_donationAddress`: EOA or `PaymentSplitter`/Splits.xyz address
- `_enableBurning`: `true` if donation shares auto-burn on conversion (optional)
- `_tokenizedStrategyAddress`: address of the TokenizedStrategy implementation (Octant provided)

Record returned strategy address: `STRATEGY_ADDRESS`.

## CCTP Bridge Context (Ethereum → Base)

- Origin burns must happen on Ethereum (your Tenderly fork emulates mainnet): ensure your wallet is connected to the fork when calling USDC bridge burns.
- Your app already includes network switching to the Tenderly fork via `NEXT_PUBLIC_TENDERLY_MAINNET_FORK_RPC`.

## Application Wiring

- Update `src/config/octantConfig.ts`:
  - `OCTANT_CONFIG.vaults.ethereumUsdcVault = "<VAULT_ADDRESS>"`
  - `OCTANT_CONFIG.useMockVault = false`
- Ensure your UI resolves the vault from config (already implemented) and calls ERC-4626 methods via `octantVaultService`.
- Keep the 5-minute lock logic for UX gating as needed.

## Testing Checklist

- Wallet on Tenderly fork network (chain `8`).
- USDC balance in your wallet (fork-only).
- Approve and deposit USDC to the vault.
- Observe lock and balances in the dashboard.
- Withdraw after lock duration.
- Bridge USDC to Base and purchase tickets.

## Troubleshooting

- Missing approvals: Call `USDC.approve(VAULT_ADDRESS, amount)` before deposit.
- Decimals mismatch: USDC is `6` decimals; shares often use `18`. Ensure your vault math normalizes conversion.
- Provider issues: Confirm `NEXT_PUBLIC_TENDERLY_MAINNET_FORK_RPC` and MetaMask network settings.
- Strategy creation: Ensure factory/implementation addresses are correct if using Octant Tokenized Strategy.

## Final Notes

- For production, prefer audited ERC-4626 implementations (e.g., Yearn V3 Tokenized Strategy) and audited donation/distribution modules.
- Share any preferred existing ERC-4626 USDC vault address, and we’ll configure it immediately to skip custom deployment.