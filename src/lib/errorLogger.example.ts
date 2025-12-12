/*
 * Error Logger Usage Examples
 * Shows how to integrate error logging throughout the application
 */

// import { errorLogger, logError } from './errorLogger';

// // Example 1: Basic error logging
// try {
//   // Some operation that might fail
//   const result = riskyOperation();
// } catch (error) {
//   logError(error, {
//     component: 'TicketPurchase',
//     action: 'purchaseTicket',
//   });
// }

// // Example 2: Wallet connection error
// try {
//   await connectWallet('MetaMask');
// } catch (error) {
//   logError(error, {
//     walletType: 'MetaMask',
//     network: 'Ethereum',
//     action: 'connectWallet',
//     userAddress: '0x...',
//   });
// }

// // Example 3: Bridge operation error
// try {
//   await bridgeUSDC('Ethereum', 'Base', '10', 'CCTP');
// } catch (error) {
//   logError(error, {
//     sourceChain: 'Ethereum',
//     destinationChain: 'Base',
//     amount: '10 USDC',
//     protocol: 'CCTP',
//     transactionHash: '0x...',
//     action: 'bridgeUSDC',
//   });
// }

// // Example 4: Using scoped logger for a component
// /*
// export function WalletConnectionComponent() {
//   const walletLogger = errorLogger.createScopedLogger('WalletConnection');

//   const handleConnect = async () => {
//     try {
//       await connectWallet('Phantom');
//     } catch (error) {
//       walletLogger.logError(error, {
//         walletType: 'Phantom',
//         action: 'connect',
//       });
//     }
//   };

//   return (
//     <button onClick={handleConnect}>Connect Wallet</button>
//   );
// }
// */

// // Example 5: API error handling
// async function fetchTicketData() {
//   try {
//     const response = await fetch('/api/tickets');
//     if (!response.ok) {
//       throw new Error(`API request failed: ${response.status}`);
//     }
//     return await response.json();
//   } catch (error) {
//     logError(error, {
//       endpoint: '/api/tickets',
//       method: 'GET',
//       component: 'TicketData',
//     });
//     throw error; // Re-throw for component to handle
//   }
// }

// // Example 6: Transaction monitoring
// async function monitorBridgeTransaction(txHash: string) {
//   try {
//     const result = await waitForAttestation(txHash);
    
//     if (!result) {
//       throw new Error('Attestation timeout');
//     }
    
//     return result;
//   } catch (error) {
//     logError(error, {
//       transactionHash: txHash,
//       protocol: 'CCTP',
//       action: 'waitForAttestation',
//       timeout: '300000', // 5 minutes
//     });
    
//     // Trigger fallback
//     return fallbackToWormhole(txHash);
//   }
// }

// // Example 7: Network error handling
// async function switchNetwork(networkName: string) {
//   try {
//     await window.ethereum.request({
//       method: 'wallet_switchEthereumChain',
//       params: [{ chainId: getChainId(networkName) }],
//     });
//   } catch (error) {
//     logError(error, {
//       network: networkName,
//       currentChainId: window.ethereum.chainId,
//       targetChainId: getChainId(networkName),
//       action: 'switchNetwork',
//       walletType: 'MetaMask',
//     });
    
//     // Handle specific error types
//     if (error.code === 4902) {
//       // User rejected request
//       throw new Error('Network switch rejected by user');
//     } else if (error.code === 4100) {
//       // Chain not added, try to add it
//       await addNetwork(networkName);
//     }
//   }
// }

// // Example 8: Balance query error
// async function getWalletBalance(address: string, token: string) {
//   try {
//     const balance = await queryTokenBalance(address, token);
//     return balance;
//   } catch (error) {
//     logError(error, {
//       address,
//       token,
//       network: 'Ethereum',
//       action: 'getBalance',
//       walletType: 'MetaMask',
//     });
    
//     // Return cached balance if available
//     return getCachedBalance(address, token);
//   }
// }

// // Example 9: Comprehensive error context
// function handleBridgeError(error: Error, bridgeContext: {
//   sourceChain: string;
//   destinationChain: string;
//   amount: string;
//   protocol: string;
//   transactionHash?: string;
//   userAddress: string;
// }) {
//   logError(error, {
//     ...bridgeContext,
//     action: 'bridgeTokens',
//     timestamp: new Date().toISOString(),
//     userAgent: navigator.userAgent,
//     pageUrl: window.location.href,
//     // Add any other relevant context
//     bridgeStep: 'attestation',
//     retryCount: 0,
//     fallbackAvailable: true,
//   });

//   // You could also add error-specific handling here
//   if (error.message.includes('timeout')) {
//     console.warn('Bridge timeout, suggesting fallback to user');
//     // Show fallback option to user
//   }
// }

// // Example 10: Error boundary integration
// export class ErrorBoundary extends React.Component {
//   componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
//     logError(error, {
//       component: this.constructor.name,
//       errorInfo,
//       reactVersion: React.version,
//       pageUrl: window.location.href,
//     });
//   }

//   render() {
//     // ... error boundary implementation
//   }
// }

// // Example 11: Async operation with timeout
// async function fetchWithTimeout(url: string, timeout: number) {
//   const controller = new AbortController();
//   const timeoutId = setTimeout(() => controller.abort(), timeout);

//   try {
//     const response = await fetch(url, { signal: controller.signal });
//     clearTimeout(timeoutId);
//     return await response.json();
//   } catch (error) {
//     clearTimeout(timeoutId);
    
//     logError(error, {
//       url,
//       timeout,
//       action: 'fetchWithTimeout',
//       isTimeout: error.name === 'AbortError',
//     });
    
//     throw error;
//   }
// }

// // Example 12: Batch error logging for multiple operations
// async function processMultipleTransactions(transactions: Array<{ hash: string }>) {
//   const results = [];
  
//   for (const tx of transactions) {
//     try {
//       const result = await processTransaction(tx.hash);
//       results.push({ success: true, result });
//     } catch (error) {
//       logError(error, {
//         transactionHash: tx.hash,
//         action: 'processTransaction',
//         batchSize: transactions.length,
//         currentIndex: transactions.indexOf(tx),
//       });
      
//       results.push({ success: false, error: error.message });
//     }
//   }
  
//   return results;
// }

// // Example 13: Error logging with performance metrics
// async function measureOperationPerformance<T>(name: string, operation: () => Promise<T>) {
//   const startTime = performance.now();
  
//   try {
//     const result = await operation();
//     const duration = performance.now() - startTime;
    
//     console.log(`⏱️ ${name} completed in ${duration}ms`);
    
//     return result;
//   } catch (error) {
//     const duration = performance.now() - startTime;
    
//     logError(error, {
//       operation: name,
//       duration,
//       performance: 'slow',
//       action: 'measurePerformance',
//     });
    
//     throw error;
//   }
// }

// // Example 14: Error logging middleware for API calls
// function createApiClient(baseUrl: string) {
//   return {
//     async get(endpoint: string) {
//       try {
//         const response = await fetch(`${baseUrl}${endpoint}`);
//         if (!response.ok) {
//           throw new Error(`API Error: ${response.status}`);
//         }
//         return await response.json();
//       } catch (error) {
//         logError(error, {
//           endpoint,
//           baseUrl,
//           method: 'GET',
//           action: 'apiRequest',
//         });
//         throw error;
//       }
//     },
    
//     async post(endpoint: string, data: any) {
//       try {
//         const response = await fetch(`${baseUrl}${endpoint}`, {
//           method: 'POST',
//           body: JSON.stringify(data),
//           headers: { 'Content-Type': 'application/json' },
//         });
        
//         if (!response.ok) {
//           throw new Error(`API Error: ${response.status}`);
//         }
        
//         return await response.json();
//       } catch (error) {
//         logError(error, {
//           endpoint,
//           baseUrl,
//           method: 'POST',
//           dataSize: JSON.stringify(data).length,
//           action: 'apiRequest',
//         });
//         throw error;
//       }
//     }
//   };
// }

// // Example 15: Error logging for web3 operations
// async function callContractMethod(contract: any, method: string, args: any[]) {
//   try {
//     const result = await contract[method](...args);
//     return result;
//   } catch (error) {
//     logError(error, {
//       contractAddress: contract.address,
//       method,
//       args,
//       network: await getCurrentNetwork(),
//       walletAddress: await getCurrentWalletAddress(),
//       action: 'callContractMethod',
//     });
//     throw error;
//   }
// }

// // Usage examples throughout the app:
// // - Wallet connection components
// // - Bridge operation components  
// // - Ticket purchase flows
// // - API service layers
// // - Transaction monitoring
// // - Network switching
// // - Balance queries
// // - Error boundaries
// // - Performance monitoring
// // - Batch operations
// // - Web3 contract calls
