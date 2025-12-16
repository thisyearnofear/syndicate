"use client";

import { Circle, ArrowRightLeft, Ticket, PartyPopper, Wallet, Hourglass, CircleCheckBig as CheckCircle } from 'lucide-react';
import { cn } from "@/lib/utils"; // Assuming a utility for class names

export type TrackerStatus = 
  | 'idle'
  | 'broadcasting'
  | 'confirmed_stacks'
  | 'bridging'
  | 'purchasing'
  | 'complete'
  | 'error';

interface CrossChainTrackerProps {
  status: TrackerStatus;
  stacksTxId?: string;
  baseTxId?: string;
  error?: string | null;
}

const steps = [
  { id: 'confirmed_stacks', title: 'Transaction Sent', icon: Wallet, description: 'Your request has been sent to the Stacks network.' },
  { id: 'bridging', title: 'Bridging to Base', icon: ArrowRightLeft, description: 'Your funds are crossing the bridge. This may take a few minutes.' },
  { id: 'purchasing', title: 'Purchasing Tickets', icon: Ticket, description: 'Finalizing your purchase on the Base network.' },
  { id: 'complete', title: 'Success!', icon: PartyPopper, description: 'Your tickets are in your wallet!' },
];

export function CrossChainTracker({ status, stacksTxId, baseTxId, error }: CrossChainTrackerProps) {
  const getStepStatus = (stepId: string): 'complete' | 'in_progress' | 'pending' => {
    const stepIndex = steps.findIndex(s => s.id === stepId);
    const currentStatusIndex = steps.findIndex(s => s.id === status)
    
    // A more robust way to map tracker status to step index
    let effectiveStatusIndex = -1;
    if (status === 'broadcasting' || status === 'confirmed_stacks') effectiveStatusIndex = 0;
    else if (status === 'bridging') effectiveStatusIndex = 1;
    else if (status === 'purchasing') effectiveStatusIndex = 2;
    else if (status === 'complete') effectiveStatusIndex = 3;


    if (stepIndex < effectiveStatusIndex) {
      return 'complete';
    }
    if (stepIndex === effectiveStatusIndex) {
      return 'in_progress';
    }
    return 'pending';
  };
  
  const StacksExplorerLink = stacksTxId ? `https://explorer.stacks.co/txid/${stacksTxId}?chain=mainnet` : '#';

  return (
    <div className="p-6 glass-premium rounded-3xl border border-white/20 max-w-md mx-auto animate-scale-in">
        <h2 className="text-2xl font-bold text-center text-white mb-2">🌉 Purchase in Progress</h2>
        <p className="text-center text-gray-400 mb-6">Our robots are working their cross-chain magic...</p>

        <div className="space-y-4">
            {steps.map((step, index) => {
                const stepStatus = getStepStatus(step.id);
                const Icon = step.icon;

                return (
                    <div key={step.id} className="flex items-start">
                        <div className="flex flex-col items-center mr-4">
                            <div className={cn(
                                "flex items-center justify-center w-10 h-10 rounded-full border-2",
                                stepStatus === 'complete' && "bg-green-500 border-green-500 text-white",
                                stepStatus === 'in_progress' && "bg-blue-500 border-blue-500 text-white animate-pulse",
                                stepStatus === 'pending' && "bg-gray-700 border-gray-600 text-gray-400"
                            )}>
                                {stepStatus === 'complete' ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                            </div>
                            {index < steps.length - 1 && (
                                <div className={cn(
                                    "w-0.5 h-12 mt-2",
                                    stepStatus === 'complete' ? "bg-green-500" : "bg-gray-600"
                                )}></div>
                            )}
                        </div>
                        <div className="pt-1.5">
                            <h3 className={cn(
                                "font-semibold",
                                stepStatus !== 'pending' ? "text-white" : "text-gray-400"
                            )}>{step.title}</h3>
                            <p className={cn(
                                "text-sm",
                                stepStatus !== 'pending' ? "text-gray-300" : "text-gray-500"
                            )}>{step.description}</p>
                            {step.id === 'confirmed_stacks' && stacksTxId && (
                                <a href={StacksExplorerLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline mt-1 block">
                                    View on Stacks Explorer
                                </a>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
        
        {status === 'error' && (
            <div className="mt-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-center">
                <h3 className="text-lg font-bold text-red-400">❌ An Error Occurred</h3>
                <p className="text-red-300 mt-1">{error || "An unknown error occurred. Please try again."}</p>
            </div>
        )}

        {status === 'complete' && (
            <div className="mt-6 text-center">
                 <button className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 px-6 rounded-xl hover:from-green-600 hover:to-emerald-700 transition-colors shadow-lg hover:shadow-green-500/30 border border-green-400/30">
                    🎟️ View My Tickets
                </button>
            </div>
        )}
    </div>
  );
}