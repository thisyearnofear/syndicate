import "./globals.css";
import type { Metadata, Viewport } from "next";
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
  title: "Syndicate — $1 to play, your deposit back forever",
  description: "Daily no-loss lottery on Base. Buy tickets directly or deposit and let yield enter every draw for you. Non-custodial, provably fair, open-source.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#050b14",
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
              <footer className="relative z-10 border-t border-white/10 bg-slate-950/80 backdrop-blur-md">
                <div className="max-w-5xl mx-auto px-6 py-10">
                  {/* Closing hook */}
                  <div className="text-center mb-10">
                    <p className="text-sm text-gray-400">
                      Draws run daily at 17:00 UTC.{' '}
                      <Link href="/" className="text-brand-400 hover:text-white transition-colors font-medium">
                        Enter the next one &rarr;
                      </Link>
                    </p>
                  </div>

                  {/* Two-column links */}
                  <div className="grid grid-cols-2 gap-8 max-w-md mx-auto text-center">
                    <div className="space-y-2">
                      <Link href="/" className="block text-sm text-gray-500 hover:text-white transition-colors">Play</Link>
                      <Link href="/vaults" className="block text-sm text-gray-500 hover:text-white transition-colors">Grow</Link>
                      <Link href="/coordinate" className="block text-sm text-gray-500 hover:text-white transition-colors">Coordinate</Link>
                      <a href="https://docs.megapot.io" target="_blank" rel="noopener noreferrer" className="block text-sm text-gray-500 hover:text-white transition-colors">Docs</a>
                    </div>
                    <div className="space-y-2">
                      <a href="https://warpcast.com/~/channel/syndicate" target="_blank" rel="noopener noreferrer" className="block text-sm text-gray-500 hover:text-white transition-colors">Farcaster</a>
                      <a href="https://twitter.com/syndicate" target="_blank" rel="noopener noreferrer" className="block text-sm text-gray-500 hover:text-white transition-colors">Twitter</a>
                      <a href="https://discord.gg/syndicate" target="_blank" rel="noopener noreferrer" className="block text-sm text-gray-500 hover:text-white transition-colors">Discord</a>
                      <a href="https://github.com/thisyearnofear/syndicate" target="_blank" rel="noopener noreferrer" className="block text-sm text-gray-500 hover:text-white transition-colors">GitHub</a>
                    </div>
                  </div>

                  {/* Bottom line */}
                  <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
                    <span>Non-custodial · Open-source · Base-native</span>
                    <span>
                      <a href="https://docs.megapot.io/terms-of-service" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">Terms</a>
                      {' · '}
                      <a href="https://docs.megapot.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">Privacy</a>
                    </span>
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
