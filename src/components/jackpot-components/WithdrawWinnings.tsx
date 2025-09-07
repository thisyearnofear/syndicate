"use client";

import { CONTRACT_ADDRESS } from '@/lib/constants';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

interface WithdrawWinningsProps {
  winningsAvailable: number;
}

export function WithdrawWinnings({ winningsAvailable }: WithdrawWinningsProps) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleWithdraw = async () => {
    try {
      writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: [
          'function withdrawWinnings() external',
        ],
        functionName: 'withdrawWinnings',
      });
    } catch (error) {
      console.error('Error withdrawing winnings:', error);
    }
  };

  return (
    <div className="bg-gradient-to-r from-green-900 to-emerald-900 rounded-xl shadow-lg border border-green-700">
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-2">
            🎉 Congratulations!
          </h2>
          <p className="text-green-200 mb-4">
            You have winnings available to withdraw
          </p>
          
          <div className="bg-green-800/50 rounded-lg p-4 mb-4">
            <p className="text-2xl font-bold text-white">
              ${(winningsAvailable / 10 ** 6).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} USDC
            </p>
          </div>
          
          <button
            onClick={handleWithdraw}
            disabled={isPending || isConfirming}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            {isPending || isConfirming ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {isPending ? 'Confirming...' : 'Processing...'}
              </span>
            ) : (
              'Withdraw Winnings'
            )}
          </button>
          
          {isSuccess && (
            <p className="text-green-200 text-sm mt-2">
              ✅ Withdrawal successful!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
