import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import "@near-wallet-selector/modal-ui/styles.css";
import { Suspense } from "react";
import { ToastProvider } from "@/shared/components/ui/Toast";
import DynamicNavigationHeader from "@/components/DynamicNavigationHeader";
// Client component wrapper imports for dynamic loading
import ClientProvidersWrapper from "@/components/ClientProvidersWrapper";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const inter = Inter({ subsets: ["latin"] });

// Next.js 16: Use ClientProvidersWrapper which handles ssr:false internally
// This pattern is required because ssr:false is no longer allowed in Server Components


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

              // === REACT ERROR #321 DIAGNOSTIC ===
              // Detect duplicate React instances and log exactly which module causes it
              (function() {
                var reactInstances = [];
                var origDefineProperty = Object.defineProperty;

                // Intercept all scripts to track which chunk loads React
                var origCreateElement = null;
                var chunkSources = {};

                // Monitor __REACT_DEVTOOLS_GLOBAL_HOOK__ for multiple renderers
                var hookCheckInterval = setInterval(function() {
                  var hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
                  if (hook && hook.renderers && hook.renderers.size > 0) {
                    var renderers = [];
                    hook.renderers.forEach(function(v, k) {
                      renderers.push({ id: k, name: v.name, version: v.version });
                    });
                    if (renderers.length > 1) {
                      console.error('[REACT-321-DIAG] DUPLICATE REACT DETECTED! Renderers:', JSON.stringify(renderers));
                    } else {
                      console.log('[REACT-321-DIAG] Single renderer detected:', JSON.stringify(renderers));
                    }
                    clearInterval(hookCheckInterval);
                  }
                }, 100);

                // After 10 seconds, report what we found
                setTimeout(function() {
                  clearInterval(hookCheckInterval);
                }, 10000);

                // Intercept Error #321 to capture the full stack
                var origError = window.Error;
                window.addEventListener('error', function(event) {
                  var msg = event.error && event.error.message;
                  if (msg && (msg.includes('321') || msg.includes('Invalid hook call') || msg.includes('minified react error'))) {
                    console.error('[REACT-321-DIAG] ERROR #321 CAUGHT!');
                    console.error('[REACT-321-DIAG] Full message:', msg);
                    console.error('[REACT-321-DIAG] Full stack:', event.error.stack);
                    console.error('[REACT-321-DIAG] Source file:', event.filename, 'line:', event.lineno);
                  }
                });

                // Log all script loads to identify which chunk is the React duplicate
                var observer = new MutationObserver(function(mutations) {
                  mutations.forEach(function(m) {
                    m.addedNodes.forEach(function(node) {
                      if (node.tagName === 'SCRIPT' && node.src) {
                        console.log('[REACT-321-DIAG] Script loaded:', node.src.split('/').pop());
                      }
                    });
                  });
                });
                observer.observe(document.documentElement, { childList: true, subtree: true });
              })();
            `,
          }}
        />
        <ToastProvider>
          <ClientProvidersWrapper>
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
           </ClientProvidersWrapper>
        </ToastProvider>
      </body>
    </html>
  );
}
