import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import "@near-wallet-selector/modal-ui/styles.css";
import { ToastProvider } from "@/shared/components/ui/Toast";
import dynamic from "next/dynamic";
import DynamicNavigationHeader from "@/components/DynamicNavigationHeader";

const inter = Inter({ subsets: ["latin"] });

// Dynamically import client-side providers to prevent SSR issues
const ClientProviders = dynamic(
  () => import("@/components/ClientProviders"),
  { ssr: false }
);


export const metadata: Metadata = {
  title: "Syndicate - Cross-Chain Lottery Platform",
  description: "Social lottery coordination with cross-chain functionality",
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
            {children}
          </ClientProviders>
        </ToastProvider>
      </body>
    </html>
  );
}
