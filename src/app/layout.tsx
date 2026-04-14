import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import "@near-wallet-selector/modal-ui/styles.css";
import { ToastProvider } from "@/shared/components/ui/Toast";
import dynamic from "next/dynamic";
import DynamicNavigationHeader from "@/components/DynamicNavigationHeader";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const inter = Inter({ subsets: ["latin"] });

// Dynamically import client-side providers to prevent SSR issues
const ClientProviders = dynamic(
  () => import("@/components/ClientProviders"),
  { ssr: false }
);


export const metadata: Metadata = {
  title: "Syndicate - Win Prizes, Never Lose Your Deposit",
  description: "Deposit USDC, earn yield, and play the lottery for free. Your principal stays 100% yours. Cross-chain. Cause-driven.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (!window.setImmediate) {
                window.setImmediate = function(callback, ...args) {
                  return window.setTimeout(callback, 0, ...args);
                };
                window.clearImmediate = window.clearTimeout;
              }
            `,
          }}
        />
        <ToastProvider>
          <ClientProviders>
            <DynamicNavigationHeader />
            <div className="flex flex-col min-h-screen">
              <div className="flex-1">
                {children}
              </div>
              <footer className="relative z-10 border-t border-white/10 bg-slate-950/50 backdrop-blur-md">
                <div className="max-w-6xl mx-auto px-6 py-10">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                          <span className="text-white font-bold text-xs">S</span>
                        </div>
                        <span className="font-bold text-white">Syndicate</span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Social lottery coordination. Cross-chain. Cause-driven.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Product</h4>
                      <div className="space-y-2">
                        <a href="/" className="block text-sm text-gray-500 hover:text-white transition-colors">Home</a>
                        <a href="/syndicates" className="block text-sm text-gray-500 hover:text-white transition-colors">Syndicates</a>
                        <a href="/vaults" className="block text-sm text-gray-500 hover:text-white transition-colors">Vaults</a>
                        <a href="/bridge" className="block text-sm text-gray-500 hover:text-white transition-colors">Bridge</a>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Resources</h4>
                      <div className="space-y-2">
                        <a href="https://docs.megapot.io" target="_blank" rel="noopener noreferrer" className="block text-sm text-gray-500 hover:text-white transition-colors">Documentation</a>
                        <a href="https://docs.megapot.io/terms-of-service" target="_blank" rel="noopener noreferrer" className="block text-sm text-gray-500 hover:text-white transition-colors">Terms of Service</a>
                        <a href="https://docs.megapot.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="block text-sm text-gray-500 hover:text-white transition-colors">Privacy Policy</a>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Community</h4>
                      <div className="space-y-2">
                        <a href="https://warpcast.com/~/channel/syndicate" target="_blank" rel="noopener noreferrer" className="block text-sm text-gray-500 hover:text-white transition-colors">Farcaster</a>
                        <a href="https://twitter.com/syndicate" target="_blank" rel="noopener noreferrer" className="block text-sm text-gray-500 hover:text-white transition-colors">Twitter</a>
                        <a href="https://discord.gg/syndicate" target="_blank" rel="noopener noreferrer" className="block text-sm text-gray-500 hover:text-white transition-colors">Discord</a>
                        <a href="https://github.com/thisyearnofear/syndicate" target="_blank" rel="noopener noreferrer" className="block text-sm text-gray-500 hover:text-white transition-colors">GitHub</a>
                      </div>
                    </div>
                  </div>
                  <div className="pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-gray-600">Built on Base, Solana, Stacks, NEAR & Starknet</p>
                    <p className="text-xs text-gray-600">Smart contracts are open-source on <a href="https://github.com/thisyearnofear/syndicate" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors underline">GitHub</a></p>
                  </div>
                </div>
              </footer>
            </div>
          </ClientProviders>
        </ToastProvider>
      </body>
    </html>
  );
}
