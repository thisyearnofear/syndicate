import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import "@near-wallet-selector/modal-ui/styles.css";
import { ToastProvider } from "@/shared/components/ui/Toast";
import NavigationHeader from "@/components/NavigationHeader";
import ClientProviders from "@/components/ClientProviders";
import Link from "next/link";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Syndicate - Private Vaults, Yield-Powered Participation, Public Play",
  description: "Coordinate capital privately, let yield generate participation automatically, or access public play directly on Base through Syndicate.",
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
            <NavigationHeader />
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
                        Private vaults, yield-powered participation, and public play on Base.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Product</h4>
                      <div className="space-y-2">
                        <Link href="/" className="block text-sm text-gray-500 hover:text-white transition-colors">Home</Link>
                        <Link href="/syndicates" className="block text-sm text-gray-500 hover:text-white transition-colors">Syndicates</Link>
                        <Link href="/vaults" className="block text-sm text-gray-500 hover:text-white transition-colors">Vaults</Link>
                        <Link href="/bridge" className="block text-sm text-gray-500 hover:text-white transition-colors">Bridge</Link>
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
                    <p className="text-xs text-gray-600">Base-native execution with Fhenix privacy mode and multi-chain funding rails</p>
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
