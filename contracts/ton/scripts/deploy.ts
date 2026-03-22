// ===========================================================
// Deployment Script for Syndicate Lottery TON Contract
// ===========================================================
//
// Usage:
//   npx blueprint run lottery --testnet   (TON testnet)
//   npx blueprint run lottery --mainnet   (TON mainnet)
//
// Requires:
//   TON_MNEMONIC — deployer wallet mnemonic (24 words)
//   TON_NETWORK  — "testnet" or "mainnet"

import { toNano, beginCell, Address } from '@ton/core';
import { Lottery, PurchaseTickets } from '../wrappers/Lottery';
import { compile, NetworkProvider, sleep } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const owner = provider.sender().address!;
    const bridgeOperator = owner; // Initially, owner is also the bridge operator
    const bridgeFee = toNano('0.01'); // 0.01 TON bridge fee

    console.log('Deploying SyndicateLotteryTON...');
    console.log('  Owner:', owner.toString());
    console.log('  Bridge operator:', bridgeOperator.toString());
    console.log('  Bridge fee:', bridgeFee.toString(), 'nanoTON');

    const lottery = provider.open(
        Lottery.createFromConfig(
            {
                owner,
                bridgeOperator,
                bridgeFee,
            },
            await compile('Lottery')
        )
    );

    await lottery.sendDeploy(provider.sender(), toNano('0.05'));

    console.log('Waiting for deployment...');
    await sleep(15000); // Wait for TON block confirmation

    console.log('Contract deployed at:', lottery.address.toString());

    // Verify deployment
    try {
        const data = await lottery.getContractData();
        console.log('  Purchase count:', data.totalPurchases.toString());
        console.log('  Bridge fee:', data.bridgeFee.toString());
        console.log('  Paused:', data.isPaused);
    } catch (e) {
        console.warn('Could not verify deployment:', e);
    }

    // Output for .env
    console.log('\n--- Add to .env ---');
    console.log(`TON_LOTTERY_CONTRACT=${lottery.address.toString()}`);
}
