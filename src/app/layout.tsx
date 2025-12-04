import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import "@near-wallet-selector/modal-ui/styles.css";
import { ToastProvider } from "@/shared/components/ui/Toast";
import ClientProviders from "@/components/ClientProviders";
import DynamicNavigationHeader from "@/components/DynamicNavigationHeader";

const inter = Inter({ subsets: ["latin"] });

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
