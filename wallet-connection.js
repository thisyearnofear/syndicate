// Proper Stacks Connect Implementation with Error Handling
import { openContractCall, openSTXTransfer, showConnect } from '@stacks/connect';
import { AppConfig, UserSession } from '@stacks/auth';

// Configuration
const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

// Enhanced connection function with debugging
export async function connectToLeatherWallet() {
  console.log('Initiating Leather wallet connection...');
  
  return new Promise((resolve, reject) => {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        throw new Error('This function must be called in a browser environment');
      }
      
      // Check for existing session
      if (userSession.isUserSignedIn()) {
        console.log('User already signed in');
        resolve({
          authenticated: true,
          userData: userSession.loadUserData()
        });
        return;
      }
      
      // Attempt connection
      showConnect({
        appDetails: {
          name: 'Syndicate App',
          icon: window.location.origin + '/favicon.ico',
        },
        redirectTo: '/',
        onFinish: (data) => {
          console.log('Wallet connection successful:', data);
          // Handle successful connection
          try {
            // Validate that we received addresses
            if (data && data.addresses && data.addresses.length > 0) {
              console.log('Valid addresses received:', data.addresses);
              // Store user data or proceed with app logic
              resolve({
                authenticated: true,
                userData: data
              });
            } else {
              console.error('No addresses found in connection response');
              reject(new Error('No Stacks addresses found in wallet response'));
            }
          } catch (validationError) {
            console.error('Error validating connection data:', validationError);
            reject(validationError);
          }
        },
        onCancel: () => {
          console.log('Wallet connection cancelled by user');
          resolve({
            authenticated: false,
            error: 'User cancelled connection'
          });
        }
      });
      
    } catch (error) {
      console.error('Exception during wallet connection:', error);
      
      // Provide specific error messages based on error type
      if (error.message && error.message.includes('No Stacks address')) {
        console.log('Known issue: No Stacks address found. Suggesting troubleshooting steps...');
        resolve({
          authenticated: false,
          error: 'No Stacks address found. Please check your Leather wallet configuration.',
          troubleshooting: [
            '1. Verify you have a Stacks account in your Leather wallet',
            '2. Check that your wallet is unlocked',
            '3. Try refreshing your browser',
            '4. Disable other wallet extensions temporarily',
            '5. Restart your browser completely'
          ]
        });
      }
      
      resolve({
        authenticated: false,
        error: error.message || 'Failed to connect to Leather wallet'
      });
    }
  });
}

// Function to get current wallet status
export function getWalletStatus() {
  try {
    // Check for available providers
    const providers = {
      stacks: !!window.StacksProvider,
      leather: !!window.LeatherProvider,
      hiro: !!window.HiroWalletProvider
    };
    
    // Check user session status
    const sessionStatus = {
      isUserSignedIn: userSession.isUserSignedIn(),
      isSignInPending: userSession.isSignInPending()
    };
    
    return {
      providers,
      sessionStatus,
      hasProviders: Object.values(providers).some(Boolean)
    };
  } catch (error) {
    console.error('Error getting wallet status:', error);
    return {
      error: error.message
    };
  }
}

// Export for use in your application
export { userSession };

// Example usage:
// import { connectToLeatherWallet, getWalletStatus } from './wallet-connection';
//
// // Check current status
// const status = getWalletStatus();
// console.log('Wallet status:', status);
//
// // Connect to wallet
// connectToLeatherWallet()
//   .then(result => {
//     if (result.authenticated) {
//       console.log('Successfully connected to wallet');
//     } else {
//       console.log('Connection failed:', result.error);
//       if (result.troubleshooting) {
//         console.log('Troubleshooting steps:', result.troubleshooting);
//       }
//     }
//   });