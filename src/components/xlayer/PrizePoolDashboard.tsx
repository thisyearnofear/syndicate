"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Beaker,
  Bot,
  ChevronDown,
  Clock3,
  ExternalLink,
  LockKeyhole,
  Radio,
  Receipt,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import { isAddress, type Address } from "viem";
import { useBalance, useReadContract, useSwitchChain } from "wagmi";
import { useUnifiedWallet } from "@/hooks/useUnifiedWallet";
import { XLayerAgentPanel } from "@/components/xlayer/XLayerAgentPanel";
import { XLayerGuidedFlow } from "@/components/xlayer/XLayerGuidedFlow";
import { XLayerPoolStage } from "@/components/xlayer/XLayerPoolStage";
import { PageShell, PageHeader, ShellSection } from "@/components/layout/PageShell";
import { honestyChipFor } from "@/config/capabilities";
import {
  XLAYER_HOOK_ABI,
  XLAYER_HOOK_IS_CONFIGURED,
  XLAYER_MAINNET_CHAIN_ID,
  XLAYER_POOL_MANAGER_ADDRESS,
  XLAYER_PRIZE_POOL_HOOK_ADDRESS,
  XLAYER_PRIZE_POOL_ROUTER_ADDRESS,
  XLAYER_TESTNET_CHAIN_ID,
  XLAYER_TESTNET_EXPLORER_URL,
  XLAYER_TESTNET_USDC_ADDRESS,
  formatXLayerShareOdds,
  xLayerExplorerAddress,
} from "@/config/xlayer";

const CONFIGURED_HOOK_ADDRESS = XLAYER_PRIZE_POOL_HOOK_ADDRESS as Address;
const hasConfiguredHook = XLAYER_HOOK_IS_CONFIGURED && isAddress(CONFIGURED_HOOK_ADDRESS);
const hasConfiguredToken = isAddress(XLAYER_TESTNET_USDC_ADDRESS);

/** Pool state self-refreshes so visitors watch epochs resolve live. */
const POLL_MS = 12_000;

const shorten = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;

function AddressRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] py-3 last:border-0 last:pb-0 sm:items-center sm:gap-4">
      <span className="shrink-0 text-xs text-slate-500">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 max-w-[65%] items-center justify-end gap-1.5 break-all text-right font-mono text-xs text-cyan-300 transition hover:text-cyan-200 touch-manipulation sm:min-h-0 sm:max-w-none"
        >
          {value}
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      ) : (
        <span className="max-w-[65%] break-all text-right font-mono text-xs text-slate-300 sm:max-w-none">
          {value}
        </span>
      )}
    </div>
  );
}

/**
 * Disclosure — reference material behind one tap, styled as hairline
 * sections (editorial), not cards. Default closed; the grid-rows trick
 * animates height without layout work beyond the opened section.
 */
function Disclosure({
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-white/[0.08] py-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-1 text-left transition hover:bg-white/[0.03] touch-manipulation"
      >
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{title}</p>
          <p className="mt-1 text-sm font-semibold text-white">{subtitle}</p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </section>
  );
}

export function PrizePoolDashboard() {
  const { address, chainId, connect, switchChain } = useUnifiedWallet();
  const { switchChainAsync } = useSwitchChain();
  const evmAddress = address && isAddress(address) ? (address as Address) : undefined;
  const canReadHook = hasConfiguredHook;
  const activeOnXLayer = chainId === XLAYER_TESTNET_CHAIN_ID;

  const { data: potBalance } = useReadContract({
    address: CONFIGURED_HOOK_ADDRESS,
    abi: XLAYER_HOOK_ABI,
    functionName: "potBalance",
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: canReadHook, refetchInterval: POLL_MS },
  });
  const { data: totalShares } = useReadContract({
    address: CONFIGURED_HOOK_ADDRESS,
    abi: XLAYER_HOOK_ABI,
    functionName: "totalShares",
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: canReadHook, refetchInterval: POLL_MS },
  });
  const { data: minPotForDraw } = useReadContract({
    address: CONFIGURED_HOOK_ADDRESS,
    abi: XLAYER_HOOK_ABI,
    functionName: "minPotForDraw",
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: canReadHook, refetchInterval: POLL_MS },
  });
  const { data: drawCooldown } = useReadContract({
    address: CONFIGURED_HOOK_ADDRESS,
    abi: XLAYER_HOOK_ABI,
    functionName: "drawCooldown",
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: canReadHook, refetchInterval: POLL_MS },
  });
  const { data: surchargeBps } = useReadContract({
    address: CONFIGURED_HOOK_ADDRESS,
    abi: XLAYER_HOOK_ABI,
    functionName: "surchargeBps",
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: canReadHook, refetchInterval: POLL_MS },
  });
  const { data: surchargeEnabled } = useReadContract({
    address: CONFIGURED_HOOK_ADDRESS,
    abi: XLAYER_HOOK_ABI,
    functionName: "surchargeEnabled",
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: canReadHook, refetchInterval: POLL_MS },
  });
  const { data: draw } = useReadContract({
    address: CONFIGURED_HOOK_ADDRESS,
    abi: XLAYER_HOOK_ABI,
    functionName: "draw",
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: canReadHook, refetchInterval: POLL_MS },
  });
  const { data: userShares } = useReadContract({
    address: CONFIGURED_HOOK_ADDRESS,
    abi: XLAYER_HOOK_ABI,
    functionName: "shares",
    args: evmAddress ? [evmAddress] : undefined,
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: canReadHook && Boolean(evmAddress), refetchInterval: POLL_MS },
  });
  const { data: userPrincipal } = useReadContract({
    address: CONFIGURED_HOOK_ADDRESS,
    abi: XLAYER_HOOK_ABI,
    functionName: "principal",
    args: evmAddress ? [evmAddress] : undefined,
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: canReadHook && Boolean(evmAddress), refetchInterval: POLL_MS },
  });
  const { data: tokenBalance } = useBalance({
    address: evmAddress,
    token: hasConfiguredToken ? XLAYER_TESTNET_USDC_ADDRESS : undefined,
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: hasConfiguredToken && Boolean(evmAddress), refetchInterval: POLL_MS },
  });
  const { data: nativeBalance } = useBalance({
    address: evmAddress,
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: Boolean(evmAddress), refetchInterval: POLL_MS },
  });

  const drawState = draw as readonly [
    boolean,
    boolean,
    boolean,
    boolean,
    bigint,
    bigint,
    bigint,
    bigint,
    Address,
    bigint,
  ] | undefined;
  const shareOdds = useMemo(
    () => formatXLayerShareOdds(userShares, totalShares),
    [totalShares, userShares],
  );

  const handleConnect = async () => {
    await connect("evm", { chainId: XLAYER_TESTNET_CHAIN_ID });
  };

  const handleSwitch = async () => {
    try {
      await switchChainAsync({ chainId: XLAYER_TESTNET_CHAIN_ID });
    } catch {
      await switchChain(XLAYER_TESTNET_CHAIN_ID);
    }
  };

  const drawOpen = Boolean(drawState?.[0]);
  const drawResolved = Boolean(drawState?.[1]);
  const drawClaimed = Boolean(drawState?.[2]);

  return (
    <PageShell width="wide" accent="experimental" surface="lab" className="overflow-x-hidden pb-mobile-cta sm:pb-0">
      <Link href="/" className="inline-flex -mb-2 text-sm font-medium text-gray-500 transition-colors hover:text-white">
        ← Back to product home (Base)
      </Link>

      <PageHeader
        title="The DEX is the lottery."
        supportingLine="Swap fees feed the pot. Principal stays redeemable. An agent runs the draws — you approve, receipts prove it."
        accent="experimental"
        variant="lab"
        eyebrow="Agent Pool · X Layer"
        badge={(() => {
          const chip = honestyChipFor("xlayer_prize_pool");
          return chip ? { label: chip.label, tone: chip.tone } : { label: "Testnet", tone: "amber" as const };
        })()}
      />

      <ShellSection className="space-y-6">
          {!hasConfiguredHook && (
            <div className="flex gap-4 rounded-2xl border border-cyan-400/20 bg-cyan-300/[0.06] p-5">
              <div className="mt-0.5 rounded-lg bg-cyan-300/10 p-2 text-cyan-200"><Sparkles className="h-4 w-4" /></div>
              <div>
                <p className="font-semibold text-cyan-100">Testnet deployment slot is ready</p>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-cyan-100/60">
                  Contract addresses are not configured in this environment yet. The dashboard is intentionally read-only until the hook, router, PoolManager, and testnet token addresses are supplied.
                </p>
                <a href="https://github.com/thisyearnofear/syndicate/blob/main/docs/X_LAYER.md" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
                  View deployment notes <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {/* Bento composition: the pool stage + the path in on the left,
              the agent deck + public audit timeline on the right. */}
          <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-start">
            <div className="space-y-6">
              <XLayerPoolStage
                potBalance={potBalance}
                minPotForDraw={minPotForDraw}
                totalShares={totalShares}
                drawCooldown={drawCooldown}
                surchargeBps={typeof surchargeBps === "number" ? surchargeBps : surchargeBps !== undefined ? Number(surchargeBps) : undefined}
                drawState={drawState}
                evmAddress={evmAddress}
                userShares={userShares}
                userPrincipal={userPrincipal}
                shareOdds={shareOdds}
              />

              <XLayerGuidedFlow
                isConnected={Boolean(evmAddress)}
                onConnect={handleConnect}
                activeOnXLayer={activeOnXLayer}
                onSwitch={handleSwitch}
                nativeBalance={nativeBalance ? Number(nativeBalance.formatted) : null}
                usdcBalance={evmAddress && tokenBalance ? Number(tokenBalance.formatted) : null}
                userShares={userShares}
                drawOpen={drawOpen}
                drawResolved={drawResolved}
                drawClaimed={drawClaimed}
              />
            </div>

            <div className="space-y-6">
              <div id="xlayer-agent-panel" className="scroll-mt-24">
                <XLayerAgentPanel
                  potBalance={potBalance}
                  totalShares={totalShares}
                  minPot={minPotForDraw}
                  drawCooldown={drawCooldown}
                  surchargeBps={typeof surchargeBps === "number" ? surchargeBps : surchargeBps !== undefined ? Number(surchargeBps) : undefined}
                  surchargeEnabled={surchargeEnabled}
                  drawState={drawState}
                />
              </div>

              {/* Reference material — hairline accordions, not cards. */}
              <div>
          <Disclosure title="How this pool runs" subtitle="An AI agent is the treasurer of this pool.">
            <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <p className="text-sm leading-6 text-slate-300/80">
                It watches the pot, plans draw operations through a permissioned tool registry, and gets human
                approval before anything executes. Every money claim is verified against an on-chain receipt
                before the UI reports it — pending is never shown as success, here or on Base.
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/10 p-3">
                  <Bot className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
                  <div>
                    <p className="text-sm font-semibold text-white">Agent, not chatbot</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-400">Tool registry, human-in-the-loop gating on draw execution, and a persisted session transcript.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/10 p-3">
                  <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
                  <div>
                    <p className="text-sm font-semibold text-white">Receipts, not promises</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-400">Deposits, draws, and claims link to explorer receipts. Explicit failure states, never fabricated hashes.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/10 p-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
                  <div>
                    <p className="text-sm font-semibold text-white">No-loss by design</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-400">The pot is funded by swap surcharges; depositor principal stays redeemable between draws.</p>
                  </div>
                </div>
              </div>
            </div>
          </Disclosure>

          <Disclosure title="Mainnet commitment" subtitle="Testnet today. Mainnet when randomness is real.">
            <div className="mt-4 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <p className="max-w-2xl text-sm leading-6 text-slate-400">
                  Chainlink VRF and Pyth Entropy are not available on X Layer, so the randomness path was designed,
                  not deferred. The hook launches on mainnet ({XLAYER_MAINNET_CHAIN_ID}) only once winner selection
                  is publicly verifiable.
                </p>
                <a href="https://github.com/thisyearnofear/syndicate/blob/main/docs/X_LAYER.md#randomness-decision" target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
                  Full randomness design <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2 text-amber-200"><Beaker className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.18em]">Today · testnet</span></div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Draws resolve through a disclosed demo oracle, operator-signed and labeled everywhere it appears.
                    It controls testnet funds only, never real value.
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2 text-cyan-200"><Radio className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.18em]">Production design · drand</span></div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    League of Entropy beacon with a permissionless relay: threshold-signed rounds and publicly
                    reproducible winner math. EIP-2537 (BLS12-381) precompiles are probe-verified on testnet{" "}
                    {XLAYER_TESTNET_CHAIN_ID} (2026-08-11), so drand signatures verify fully on-chain.
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2 text-emerald-200"><LockKeyhole className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.18em]">Launch gate</span></div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Mainnet ships with precompile-verified drand, or an independently reviewed bonded-relay fallback.
                    The demo oracle never graduates to real value.
                  </p>
                </div>
              </div>
            </div>
          </Disclosure>

          <Disclosure title="Deployment registry" subtitle="Contracts and network">
            <div className="mt-4">
              <div className="mb-2 flex justify-end">
                <a href={XLAYER_TESTNET_EXPLORER_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-300 hover:text-cyan-200">Open explorer <ExternalLink className="h-3 w-3" /></a>
              </div>
              <div className="grid gap-x-8 gap-y-1 md:grid-cols-2">
                <AddressRow label="Network" value={`X Layer Testnet (${XLAYER_TESTNET_CHAIN_ID})`} />
                <AddressRow label="Mainnet status" value={`Gated on verifiable randomness (${XLAYER_MAINNET_CHAIN_ID}) — see above`} />
                <AddressRow label="Hook" value={hasConfiguredHook ? shorten(XLAYER_PRIZE_POOL_HOOK_ADDRESS) : "Not configured"} href={hasConfiguredHook ? xLayerExplorerAddress(XLAYER_PRIZE_POOL_HOOK_ADDRESS) : undefined} />
                <AddressRow label="Swap router" value={isAddress(XLAYER_PRIZE_POOL_ROUTER_ADDRESS) ? shorten(XLAYER_PRIZE_POOL_ROUTER_ADDRESS) : "Not configured"} href={isAddress(XLAYER_PRIZE_POOL_ROUTER_ADDRESS) ? xLayerExplorerAddress(XLAYER_PRIZE_POOL_ROUTER_ADDRESS) : undefined} />
                <AddressRow label="PoolManager" value={isAddress(XLAYER_POOL_MANAGER_ADDRESS) ? shorten(XLAYER_POOL_MANAGER_ADDRESS) : "Not configured"} href={isAddress(XLAYER_POOL_MANAGER_ADDRESS) ? xLayerExplorerAddress(XLAYER_POOL_MANAGER_ADDRESS) : undefined} />
                <AddressRow label="Your token balance" value={tokenBalance ? `${Number(tokenBalance.formatted).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC` : "—"} />
              </div>
            </div>
          </Disclosure>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-white/[0.06] pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-2"><Clock3 className="h-3.5 w-3.5" /> Testnet demo · no real-value draws</span>
            <span className="inline-flex items-center gap-2"><Trophy className="h-3.5 w-3.5" /> One no-loss mechanism, two engines · Base is the live home, X Layer is the DEX-native one</span>
          </div>
      </ShellSection>
    </PageShell>
  );
}
