import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionAccountProvider } from "@/providers/SessionAccountProvider";
import { PermissionProvider } from "@/providers/PermissionProvider";
import { CrossChainProvider } from "@/providers/CrossChainProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Syndicate - Social Lottery Coordination",
  description: "Pool resources with your community for lottery participation and cause-based impact on Base and Avalanche",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-full font-sans antialiased flex flex-col`}
      >
        <div className="flex-1">
          <main>
            <CrossChainProvider>
              <PermissionProvider>
                <SessionAccountProvider>{children}</SessionAccountProvider>
              </PermissionProvider>
            </CrossChainProvider>
          </main>
        </div>
      </body>
    </html>
  );
}
