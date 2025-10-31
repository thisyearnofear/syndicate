import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { WalletProvider } from "@/context/WalletContext";
import "@rainbow-me/rainbowkit/styles.css";
import { Providers } from "@/components/Providers";
import { ToastProvider } from "@/shared/components/ui/Toast";
import NavigationHeader from "@/components/NavigationHeader";

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
          <Providers>
            <WalletProvider>
              <NavigationHeader />
              {children}
            </WalletProvider>
          </Providers>
        </ToastProvider>
      </body>
    </html>
  );
}
