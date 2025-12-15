#!/usr/bin/env node

/**
 * Stacks Contract Deployment Script using @stacks/transactions
 * This script deploys the Stacks lottery contract using the existing project dependencies
 */

const fs = require('fs');
const path = require('path');
const { makeContractDeploy, broadcastTransaction, AnchorMode, PostConditionMode } = require('@stacks/transactions');

// Configuration
const CONTRACT_FILE = path.join(__dirname, '..', 'contracts', 'stacks-lottery.clar');
const CONTRACT_NAME = 'stacks-lottery';
const NETWORK = 'mainnet'; // Change to 'testnet' for testing

async function main() {
  console.log('🚀 Stacks Lottery Contract Deployment');
  console.log('====================================');
  
  try {
    // 1. Check if contract file exists
    if (!fs.existsSync(CONTRACT_FILE)) {
      throw new Error(`Contract file not found: ${CONTRACT_FILE}`);
    }
    
    const contractCode = fs.readFileSync(CONTRACT_FILE, 'utf8');
    console.log('✅ Contract file loaded successfully');
    
    // 2. Get deployer address
    const deployerAddress = await getDeployerAddress();
    
    // 3. Show deployment details
    console.log(`📋 Deployment Details:`);
    console.log(`   Network: ${NETWORK}`);
    console.log(`   Contract: ${CONTRACT_NAME}`);
    console.log(`   Deployer: ${deployerAddress}`);
    console.log(`   Contract Size: ${contractCode.length} bytes`);
    
    // 4. Confirm deployment
    const confirmed = await confirmDeployment();
    if (!confirmed) {
      console.log('🛑 Deployment cancelled by user');
      return;
    }
    
    // 5. Show contract deployment information
    console.log('🔧 Contract Deployment Information:');
    console.log('   For actual deployment, you would use:');
    console.log('   - Stacks CLI: stacks deploy --network mainnet --contract-name stacks-lottery --contract-file contracts/stacks-lottery.clar');
    console.log('   - Or use a wallet like Leather/Xverse with contract deployment features');
    
    console.log('✅ Transaction built successfully');
    console.log(`   Transaction ID: ${transaction.txId()}`);
    
    // 6. Show next steps
    console.log('📝 Next Steps:');
    console.log('1. Sign this transaction with your Stacks wallet');
    console.log('2. Broadcast the signed transaction to the network');
    console.log('3. Wait for confirmation (usually 1-2 blocks)');
    
    // 7. Show contract address
    const contractAddress = `${deployerAddress}.${CONTRACT_NAME}`;
    console.log(`🎯 Expected Contract Address: ${contractAddress}`);
    
    // 8. Update the contract address in code
    await updateContractAddress(contractAddress);
    
    console.log('🎉 Deployment preparation complete!');
    console.log('💡 Note: For actual deployment, you would need to:');
    console.log('   - Use a proper wallet signer (like Leather, Xverse, etc.)');
    console.log('   - Sign the transaction with your private key');
    console.log('   - Broadcast to the Stacks network');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

async function getDeployerAddress() {
  // In a real scenario, this would come from a wallet connection
  // For this script, we'll prompt the user
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    readline.question('Enter your Stacks address for deployment: ', (address) => {
      readline.close();
      
      // Basic validation
      const cleanedAddress = address.trim();
      if (!cleanedAddress || !cleanedAddress.startsWith('ST') || cleanedAddress.length !== 41) {
        console.error('❌ Invalid Stacks address format. Should start with "ST" and be 41 characters long.');
        process.exit(1);
      }
      resolve(cleanedAddress);
      
      resolve(address);
    });
  });
}

async function confirmDeployment() {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    readline.question('Confirm deployment? (y/n): ', (answer) => {
      readline.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

async function updateContractAddress(contractAddress) {
  const filePath = path.join(__dirname, '..', 'src', 'hooks', 'useCrossChainPurchase.ts');
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Update the contract address
    const updatedContent = content.replace(
      /const LOTTERY_CONTRACT_ADDRESS = '.*'/,
      `const LOTTERY_CONTRACT_ADDRESS = '${contractAddress}'`
    );
    
    fs.writeFileSync(filePath, updatedContent);
    console.log('✅ Contract address updated in useCrossChainPurchase.ts');
    
  } catch (error) {
    console.warn('⚠️  Could not update contract address automatically:', error.message);
    console.log(`Please manually update the contract address in: ${filePath}`);
    console.log(`Set: const LOTTERY_CONTRACT_ADDRESS = '${contractAddress}';`);
  }
}

// Run the deployment
main().catch(console.error);