"use client";

/**
 * PAGE SHELL + PAGE HEADER — the only way a page opens (docs/DESIGN.md).
 *
 * PageShell: one background, two widths, entrance stagger. Pages must not
 * define their own page-level background — navigation should feel like
 * turning pages of one book, not switching apps.
 *
 * PageHeader: domain-accented title + one supporting line + hairline +
 * optional actions. Titles follow the ladder (Play / Grow / Coordinate)
 * or name the object on secondary pages (Bridge, Settings, Portfolio).
 *
 * Motion budget: exactly two fades (header at 0ms, content at 120ms).
 * Everything else animates only in response to data/state.
 */

import { type ReactNode, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { ACCENTS, DOMAIN_ACCENT, type DesignAccent } from "@/config/design";
import { RoundOrb, type RoundOrbState } from "@/components/motion/RoundOrb";

const WIDTHS = {
  /** Text/form flows, settings, receipts */
  content: "max-w-4xl",
  /** Grids and dashboards */
  wide: "max-w-6xl",
} as const;

interface PageShellProps {
  children: ReactNode;
  width?: keyof typeof WIDTHS;
  /** Extra classes for the inner container (e.g. pb for footers) */
  className?: string;
  /** Accent for the ambient background glow. Auto-derived from route when omitted. */
  accent?: DesignAccent;
}

export function PageShell({ children, width = "content", className = "", accent }: PageShellProps) {
  const pathname = usePathname();
  // Derive accent from route when not explicitly passed, so every page gets
  // its domain-colored ambient glow without any per-page wiring.
  const slug = pathname ? pathname.replace(/^\/+/, "").split("/")[0] : "";
  const resolvedAccent: DesignAccent = accent ?? DOMAIN_ACCENT[slug] ?? "neutral";
  const glow = ACCENTS[resolvedAccent].glow;

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 text-white">
      {/* Ambient accent glows — decorative only, never intercepts input.
          Fixed + overflow-hidden so blobs never cause scroll or clip sticky headers. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className={`absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full blur-3xl ${glow.top}`} />
        <div className={`absolute -bottom-40 -right-32 h-[32rem] w-[32rem] rounded-full blur-3xl ${glow.bottom}`} />
      </div>
      <div className={`relative z-10 container mx-auto px-4 ${WIDTHS[width]} py-8 md:py-10 space-y-8 ${className}`}>
        {children}
      </div>
    </div>
  );
}

const entrance = (delayMs: number): CSSProperties => ({ animationDelay: `${delayMs}ms` });

interface PageHeaderProps {
  title: string;
  supportingLine: string;
  accent?: DesignAccent;
  /** Status chip next to the title, e.g. "Testnet", "Partial" (honesty contract) */
  badge?: { label: string; tone?: "amber" | "emerald" | "violet" | "gray" };
  /** Round-orb state prefix, for state-bearing pages */
  orb?: RoundOrbState;
  /** Right-aligned actions (buttons, tabs) */
  children?: ReactNode;
}

export function PageHeader({
  title,
  supportingLine,
  accent = "neutral",
  badge,
  orb,
  children,
}: PageHeaderProps) {
  const a = ACCENTS[accent];
  return (
    <header className="animate-fade-in-up" style={entrance(0)}>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {orb && <RoundOrb state={orb} size={14} />}
          <h1 className={`text-3xl md:text-4xl font-black tracking-tight ${a.gradientText}`}>
            {title}
          </h1>
          {badge && (
            <span
              className={`text-[11px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                BADGE_TONES[badge.tone ?? "gray"]
              }`}
            >
              {badge.label}
            </span>
          )}
        </div>
        {children && <div className="flex items-center gap-3">{children}</div>}
      </div>
      <p className={`mt-2 text-sm md:text-base text-gray-400 max-w-xl`}>{supportingLine}</p>
      <div aria-hidden className={`mt-4 h-px w-24 bg-gradient-to-r ${a.hairline}`} />
    </header>
  );
}

const BADGE_TONES = {
  amber: "border-amber-400/30 text-amber-300/80",
  emerald: "border-emerald-400/30 text-emerald-300/80",
  violet: "border-violet-400/30 text-violet-300/80",
  gray: "border-white/15 text-gray-400",
} as const;

/** Content wrapper applying the standard 120ms entrance delay. */
export function ShellSection({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`animate-fade-in-up ${className}`} style={entrance(120)}>
      {children}
    </section>
  );
}
