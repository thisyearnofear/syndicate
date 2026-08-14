import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Season of Tickets — Tontine Pot | Syndicate",
  description:
    "The squad pot for the season. Pool real Megapot entries with your crew, watch the ladder, and Call the Pot.",
};

export default function SeasonLayout({ children }: { children: React.ReactNode }) {
  return children;
}
