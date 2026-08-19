"use client";

/**
 * PAGE SHELL + PAGE HEADER — the only way a page opens (docs/DESIGN.md).
 *
 * PageShell: four surfaces, two widths, entrance stagger. Pages must not
 * define their own page-level background — navigation should feel like
 * turning pages of one book, not switching apps.
 *
 * Surfaces (docs/DESIGN.md "The surfaces"):
 *   - `default` — cool slate ground for every utility/money page. Quiet.
 *   - `arena`   — warm ink + brass ground for the game layer (/season)
 *   - `lab`     — cool CRT / control-room ground for Agent Pool (/xlayer)
 *   - `grow`    — the yield domain; licensed ambient bloom (yield accrues,
 *                 a still page says the opposite)
 *
 * PageHeader: domain-accented title + one supporting line + hairline +
 * optional eyebrow + optional actions. Titles follow the ladder (Play /
 * Grow / Coordinate) or name the object on secondary pages.
 *
 * Motion budget: exactly two fades (header at 0ms, content at 120ms).
 * Everything else animates only in response to data/state — except the
 * arena's ambient layer, the one documented exception.
 */

import { type ReactNode, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import {
  ACCENTS,
  DOMAIN_ACCENT,
  DOMAIN_SURFACE,
  SURFACES,
  type DesignAccent,
  type DesignSurface,
} from "@/config/design";
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
  /** Page ground. Auto-derived from route when omitted; defaults to `default`. */
  surface?: DesignSurface;
}

export function PageShell({
  children,
  width = "content",
  className = "",
  accent,
  surface,
}: PageShellProps) {
  const pathname = usePathname();
  // Derive accent + surface from route when not explicitly passed, so every
  // page gets its domain ground and glow without any per-page wiring.
  const slug = pathname ? pathname.replace(/^\/+/, "").split("/")[0] : "";
  const resolvedAccent: DesignAccent = accent ?? DOMAIN_ACCENT[slug] ?? "neutral";
  const resolvedSurface: DesignSurface = surface ?? DOMAIN_SURFACE[slug] ?? "default";
  const glow = ACCENTS[resolvedAccent].glow;
  const ground = SURFACES[resolvedSurface];

  return (
    <div
      data-surface={resolvedSurface}
      className={`relative min-h-screen ${ground.background} text-white`}
    >
      {/* Ambient accent glows — decorative only, never intercepts input.
          Fixed + overflow-hidden so blobs never cause scroll or clip sticky headers. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {ground.ambientGlow && (
          <>
            <div className={`absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full blur-3xl ${glow.top}`} />
            <div className={`absolute -bottom-40 -right-32 h-[32rem] w-[32rem] rounded-full blur-3xl ${glow.bottom}`} />
          </>
        )}
        {/* Licensed ambient layers, defined once in globals.css; all stop
            under prefers-reduced-motion. */}
        {resolvedSurface === "arena" && <span className="arena-hatch" />}
        {resolvedSurface === "lab" && <span className="lab-grid" />}
        {ground.ambientEmbers && <ArenaEmbers />}
        {ground.ambientScan && <LabScan />}
        {ground.ambientBloom && <span aria-hidden className="grow-bloom" />}
      </div>
      <div className={`relative z-10 container mx-auto px-4 ${WIDTHS[width]} py-8 md:py-10 space-y-8 ${className}`}>
        {children}
      </div>
    </div>
  );
}

/**
 * The arena's licensed ambient layer: nine slow brass motes. Fixed count and
 * fixed offsets keep it deterministic (no hydration mismatch, no rAF loop);
 * `ember-drift` is disabled wholesale under prefers-reduced-motion.
 */
const EMBERS = [
  { left: "8%", delay: "0s", duration: "26s", size: 2 },
  { left: "19%", delay: "6s", duration: "34s", size: 1 },
  { left: "31%", delay: "13s", duration: "29s", size: 3 },
  { left: "44%", delay: "3s", duration: "38s", size: 1 },
  { left: "56%", delay: "18s", duration: "24s", size: 2 },
  { left: "67%", delay: "9s", duration: "32s", size: 1 },
  { left: "78%", delay: "22s", duration: "36s", size: 2 },
  { left: "88%", delay: "2s", duration: "28s", size: 1 },
  { left: "95%", delay: "15s", duration: "31s", size: 2 },
] as const;

function ArenaEmbers() {
  return (
    <span aria-hidden className="arena-embers">
      {EMBERS.map((e) => (
        <span
          key={e.left}
          className="arena-ember"
          style={{
            left: e.left,
            width: e.size,
            height: e.size,
            animationDelay: e.delay,
            animationDuration: e.duration,
          }}
        />
      ))}
    </span>
  );
}

function LabScan() {
  return <span aria-hidden className="lab-scanline" />;
}

const entrance = (delayMs: number): CSSProperties => ({ animationDelay: `${delayMs}ms` });

interface PageHeaderProps {
  title: string;
  supportingLine: string;
  accent?: DesignAccent;
  /** Status chip next to the title, e.g. "Testnet", "Partial" (honesty contract) */
  badge?: { label: string; tone?: "amber" | "emerald" | "violet" | "gray" | "arena" };
  /** Round-orb state prefix, for state-bearing pages */
  orb?: RoundOrbState;
  /**
   * Small-caps line above the title. Arena surfaces use it to place the
   * game in its period ("Anno 1653 · A tontine, made honest").
   */
  eyebrow?: string;
  /** Type register. `arena` sets the display serif; default is Inter. */
  variant?: "default" | "arena" | "lab";
  /** Right-aligned actions (buttons, tabs) */
  children?: ReactNode;
}

export function PageHeader({
  title,
  supportingLine,
  accent = "neutral",
  badge,
  orb,
  eyebrow,
  variant = "default",
  children,
}: PageHeaderProps) {
  const a = ACCENTS[accent];
  const arena = variant === "arena";
  const lab = variant === "lab";
  return (
    <header className="animate-fade-in-up" style={entrance(0)}>
      {eyebrow && (
        <p
          className={`mb-2 text-[10px] font-bold uppercase tracking-[0.32em] ${a.badge} ${
            arena ? "font-display tracking-[0.28em]" : lab ? "font-mono tracking-[0.28em]" : ""
          }`}
        >
          {eyebrow}
        </p>
      )}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {orb && <RoundOrb state={orb} size={14} />}
          <h1
            className={
              arena
                ? `font-display text-4xl md:text-5xl font-bold tracking-tight leading-[1.05] ${a.gradientText}`
                : lab
                  ? `font-mono text-3xl md:text-4xl font-semibold tracking-tight leading-[1.1] ${a.gradientText}`
                  : `text-3xl md:text-4xl font-black tracking-tight ${a.gradientText}`
            }
          >
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
      <p className={`mt-2 text-sm md:text-base ${arena ? "text-[#d8c9ae]/75" : lab ? "text-cyan-100/55" : "text-gray-400"} max-w-xl`}>
        {supportingLine}
      </p>
      <div
        aria-hidden
        className={
          arena
            ? `mt-4 ledger-rule w-40`
            : `mt-4 h-px w-24 bg-gradient-to-r ${a.hairline}`
        }
      />
    </header>
  );
}

const BADGE_TONES = {
  amber: "border-amber-400/30 text-amber-300/80",
  emerald: "border-emerald-400/30 text-emerald-300/80",
  violet: "border-violet-400/30 text-violet-300/80",
  gray: "border-white/15 text-gray-400",
  arena: "border-[#c9a227]/40 text-[#e3c887]/85 bg-[#c9a227]/[0.07]",
} as const;

/** Content wrapper applying the standard 120ms entrance delay. */
export function ShellSection({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`animate-fade-in-up ${className}`} style={entrance(120)}>
      {children}
    </section>
  );
}
