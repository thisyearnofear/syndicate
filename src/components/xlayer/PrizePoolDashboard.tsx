"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Beaker,
  Bot,
  Clock3,
  ExternalLink,
  Gauge,
  LockKeyhole,
  Radio,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import { isAddress, type Address, formatUnits } from "viem";
import { useBalance, useReadContract, useSwitchChain } from "wagmi";
import { Button } from "@/shared/components/ui/Button";
import {
  CompactCard,
  CompactGrid,
} from "@/shared/components/premium/CompactLayout";
import { useUnifiedWallet } from "@/hooks/useUnifiedWallet";
import { XLayerAgentPanel } from "@/components/xlayer/XLayerAgentPanel";
import { XLayerGuidedFlow } from "@/components/xlayer/XLayerGuidedFlow";
import { XLayerOperatorRunReplay } from "@/components/xlayer/XLayerOperatorRunReplay";
import { PageShell, PageHeader, ShellSection } from "@/components/layout/PageShell";
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

const formatUsdc = (value: bigint | undefined) => {
  if (value === undefined) return "—";
  return Number(formatUnits(value, 6)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDuration = (value: bigint | undefined) => {
  if (value === undefined) return "—";
  const seconds = Number(value);
  if (seconds === 0) return "Immediate";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86_400)}d`;
};

const shorten = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  accent: string;
}) {
  return (
    <CompactCard
      variant="glass"
      padding="md"
      hover={false}
      className="group relative overflow-hidden border-white/[0.08] bg-slate-950/50"
    >
      <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl ${accent}`} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.06] p-2.5 text-slate-300 transition group-hover:border-cyan-400/30 group-hover:text-cyan-200">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </CompactCard>
  );
}

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

export function PrizePoolDashboard() {
  const { address, chainId, connect, switchChain } = useUnifiedWallet();
  const { switchChainAsync } = useSwitchChain();
  const evmAddress = address && isAddress(address) ? (address as Address) : undefined;
  const canReadHook = hasConfiguredHook;
  const activeOnXLayer = chainId === XLAYER_TESTNET_CHAIN_ID;

  const { data: potBalance, refetch: refetchPot } = useReadContract({
    address: CONFIGURED_HOOK_ADDRESS,
    abi: XLAYER_HOOK_ABI,
    functionName: "potBalance",
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: canReadHook, refetchInterval: POLL_MS },
  });
  const { data: totalShares, refetch: refetchShares } = useReadContract({
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
  const { data: draw, refetch: refetchDraw } = useReadContract({
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

  const refresh = async () => {
    await Promise.all([refetchPot(), refetchShares(), refetchDraw()]);
  };

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

  const drawLabel = !drawState
    ? "Awaiting deployment"
    : drawState[0]
      ? "Randomness pending"
      : drawState[1] && !drawState[2]
        ? "Prize ready to claim"
        : drawState[3]
          ? "Draw cancelled"
          : "Open for entries";

  return (
    <PageShell width="wide" className="overflow-x-hidden pb-mobile-cta sm:pb-0">
      <Link href="/" className="inline-flex -mb-2 text-sm font-medium text-gray-500 transition-colors hover:text-white">
        ← Back to product home (Base)
      </Link>

      <PageHeader
        title="The DEX is the lottery."
        supportingLine="Swap fees feed a shared prize pot. Depositors keep their principal, while their share determines their chance of winning the next epoch."
        accent="experimental"
        badge={{ label: "X Layer Testnet", tone: "amber" }}
      >
        <span className="text-xs text-slate-500">
          Chain {XLAYER_TESTNET_CHAIN_ID} · Live on testnet since Aug 9, 2026 · auto-refreshing
        </span>
      </PageHeader>

      <ShellSection className="space-y-6">
          {/* The guided path comes first — strangers should be acting, not reading. */}
          <XLayerGuidedFlow
            isConnected={Boolean(evmAddress)}
            onConnect={handleConnect}
            activeOnXLayer={activeOnXLayer}
            onSwitch={handleSwitch}
            nativeBalance={nativeBalance ? Number(nativeBalance.formatted) : null}
            usdcBalance={evmAddress && tokenBalance ? Number(tokenBalance.formatted) : null}
            userShares={userShares}
            drawOpen={Boolean(drawState?.[0])}
            drawResolved={Boolean(drawState?.[1])}
            drawClaimed={Boolean(drawState?.[2])}
          />

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

          <CompactGrid columns={4} gap="sm" className="lg:grid-cols-4">
            <MetricCard label="Prize pot" value={formatUsdc(potBalance)} detail={minPotForDraw ? `Draw threshold ${formatUsdc(minPotForDraw)} USDC` : "USDC currently available"} icon={Trophy} accent="bg-cyan-400/20" />
            <MetricCard label="Total shares" value={formatUsdc(totalShares)} detail="Snapshot weight pool" icon={Activity} accent="bg-blue-400/20" />
            <MetricCard label="Your odds" value={shareOdds} detail={userShares ? `${formatUsdc(userShares)} shares` : "Connect to calculate"} icon={Gauge} accent="bg-indigo-400/20" />
            <MetricCard label="Surcharge" value={surchargeBps !== undefined ? `${Number(surchargeBps) / 100}%` : "—"} detail={surchargeEnabled ? "Active on routed swaps" : "Awaiting configuration"} icon={Sparkles} accent="bg-amber-400/20" />
          </CompactGrid>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <CompactCard variant="glass" padding="lg" hover={false} className="border-white/[0.08] bg-slate-950/60">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-cyan-300"><Activity className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.2em]">Epoch monitor</span></div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">{drawState ? `Epoch ${drawState[4].toString()}` : "No live epoch yet"}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{drawLabel}. The draw freezes share weights before randomness resolves.</p>
                </div>
                <Button variant="glass" size="sm" className="min-h-11 w-full touch-manipulation sm:w-auto" onClick={refresh} disabled={!canReadHook}>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
                </Button>
              </div>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"><p className="text-[10px] uppercase tracking-widest text-slate-500">Snapshot pot</p><p className="mt-2 text-lg font-semibold text-white">{formatUsdc(drawState?.[7])}</p></div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"><p className="text-[10px] uppercase tracking-widest text-slate-500">Snapshot shares</p><p className="mt-2 text-lg font-semibold text-white">{formatUsdc(drawState?.[6])}</p></div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"><p className="text-[10px] uppercase tracking-widest text-slate-500">Draw cooldown</p><p className="mt-2 text-lg font-semibold text-white">{formatDuration(drawCooldown)}</p></div>
              </div>
            </CompactCard>

            <CompactCard variant="premium" padding="lg" hover={false} className="border-indigo-300/15 bg-gradient-to-br from-indigo-500/[0.12] to-cyan-400/[0.05]">
              <div className="flex items-center gap-2 text-indigo-200"><ShieldCheck className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.2em]">Lossless design</span></div>
              <h2 className="mt-4 text-xl font-semibold text-white">Principal stays yours.</h2>
              <p className="mt-3 text-sm leading-6 text-indigo-100/65">Your deposit creates shares and draw weight. The prize pot is funded by swap surcharges, not by consuming depositor principal.</p>
              <div className="mt-6 flex items-center gap-3 rounded-xl border border-white/10 bg-black/10 p-3"><LockKeyhole className="h-4 w-4 text-cyan-200" /><span className="text-xs text-indigo-100/70">{userPrincipal ? `${formatUsdc(userPrincipal)} USDC principal tracked` : "Connect to view your principal"}</span></div>
            </CompactCard>
          </div>

          {/* The agent is the headline — surfaced before any static section. */}
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

          {/* Public audit trail: latest server-side operator run, no wallet needed. */}
          <XLayerOperatorRunReplay />

          {/* Product story: what this pool is and who runs it. */}
          <CompactCard variant="premium" padding="lg" hover={false} className="border-cyan-300/20 bg-gradient-to-br from-cyan-500/[0.12] to-indigo-500/[0.06]">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <div className="flex items-center gap-2 text-cyan-300">
                  <Bot className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">How this pool runs</span>
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight text-white">An AI agent is the treasurer of this pool.</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300/80">
                  It watches the pot, plans draw operations through a permissioned tool registry, and gets human
                  approval before anything executes. Every money claim it makes is verified against an on-chain
                  receipt before the UI reports it — pending is never shown as success, here or on Base.
                </p>
              </div>
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
          </CompactCard>

          {/* Mainnet commitment: the randomness gate, stated on-page for judges. */}
          <CompactCard variant="glass" padding="lg" hover={false} className="border-white/[0.08] bg-slate-950/50">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Mainnet commitment</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Testnet today. Mainnet when randomness is real.</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Chainlink VRF and Pyth Entropy are not available on X Layer, so the randomness path was designed,
                  not deferred. The hook launches on mainnet ({XLAYER_MAINNET_CHAIN_ID}) only once winner selection
                  is publicly verifiable.
                </p>
              </div>
              <a href="https://github.com/thisyearnofear/syndicate/blob/main/docs/X_LAYER.md#randomness-decision" target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
                Full randomness design <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
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
          </CompactCard>

          <CompactCard variant="glass" padding="lg" hover={false} className="border-white/[0.08] bg-slate-950/50">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Deployment registry</p><h2 className="mt-2 text-xl font-semibold text-white">Contracts and network</h2></div>
              <a href={XLAYER_TESTNET_EXPLORER_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-300 hover:text-cyan-200">Open explorer <ExternalLink className="h-3 w-3" /></a>
            </div>
            <div className="mt-5 grid gap-x-8 gap-y-1 md:grid-cols-2">
              <AddressRow label="Network" value={`X Layer Testnet (${XLAYER_TESTNET_CHAIN_ID})`} />
              <AddressRow label="Mainnet status" value={`Gated on verifiable randomness (${XLAYER_MAINNET_CHAIN_ID}) — see above`} />
              <AddressRow label="Hook" value={hasConfiguredHook ? shorten(XLAYER_PRIZE_POOL_HOOK_ADDRESS) : "Not configured"} href={hasConfiguredHook ? xLayerExplorerAddress(XLAYER_PRIZE_POOL_HOOK_ADDRESS) : undefined} />
              <AddressRow label="Swap router" value={isAddress(XLAYER_PRIZE_POOL_ROUTER_ADDRESS) ? shorten(XLAYER_PRIZE_POOL_ROUTER_ADDRESS) : "Not configured"} href={isAddress(XLAYER_PRIZE_POOL_ROUTER_ADDRESS) ? xLayerExplorerAddress(XLAYER_PRIZE_POOL_ROUTER_ADDRESS) : undefined} />
              <AddressRow label="PoolManager" value={isAddress(XLAYER_POOL_MANAGER_ADDRESS) ? shorten(XLAYER_POOL_MANAGER_ADDRESS) : "Not configured"} href={isAddress(XLAYER_POOL_MANAGER_ADDRESS) ? xLayerExplorerAddress(XLAYER_POOL_MANAGER_ADDRESS) : undefined} />
              <AddressRow label="Your token balance" value={tokenBalance ? `${Number(tokenBalance.formatted).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC` : "—"} />
            </div>
          </CompactCard>

          <div className="flex flex-col gap-4 border-t border-white/[0.06] pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-2"><Clock3 className="h-3.5 w-3.5" /> Testnet demo · no real-value draws</span>
            <span>One no-loss mechanism, two engines · Base is the live home, X Layer is the DEX-native one</span>
          </div>

          <div className="grid gap-3 border-t border-white/[0.06] pt-5 sm:grid-cols-3">
            <Link href="/" className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-400/30 hover:bg-white/[0.06]">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Play</span>
              <span className="mt-2 block text-sm font-semibold text-white">Buy Megapot tickets</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">Use the live Base experience.</span>
            </Link>
            <Link href="/vaults" className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-400/30 hover:bg-white/[0.06]">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Grow</span>
              <span className="mt-2 block text-sm font-semibold text-white">Explore yield strategies</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">Let yield fund participation.</span>
            </Link>
            <Link href="/coordinate" className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-400/30 hover:bg-white/[0.06]">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Coordinate</span>
              <span className="mt-2 block text-sm font-semibold text-white">Join a syndicate</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">Pool capital with other participants.</span>
            </Link>
          </div>
      </ShellSection>
    </PageShell>
  );
}
