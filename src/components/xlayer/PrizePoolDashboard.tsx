"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Beaker,
  Bot,
  CircleAlert,
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
  Wifi,
  Loader,
} from "lucide-react";
import { isAddress, type Address, formatUnits } from "viem";
import { useBalance, useReadContract, useSwitchChain } from "wagmi";
import { Button } from "@/shared/components/ui/Button";
import {
  CompactCard,
  CompactGrid,
} from "@/shared/components/premium/CompactLayout";
import { useUnifiedWallet } from "@/hooks/useUnifiedWallet";
import { useCapability } from "@/hooks/useCapability";
import { useXLayerJoin, useXLayerDeposit } from "@/services/xlayer";
import { XLayerAgentPanel } from "@/components/xlayer/XLayerAgentPanel";
import { XLayerDemoLoopGuide } from "@/components/xlayer/XLayerDemoLoopGuide";
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
  XLAYER_FAUCET_URL,
  formatXLayerShareOdds,
  xLayerExplorerAddress,
} from "@/config/xlayer";

const CONFIGURED_HOOK_ADDRESS = XLAYER_PRIZE_POOL_HOOK_ADDRESS as Address;
const hasConfiguredHook = XLAYER_HOOK_IS_CONFIGURED && isAddress(CONFIGURED_HOOK_ADDRESS);
const hasConfiguredToken = isAddress(XLAYER_TESTNET_USDC_ADDRESS);

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
  const { address, isConnected, walletType, chainId, connect, switchChain } = useUnifiedWallet();
  const { switchChainAsync } = useSwitchChain();
  const evmAddress = address && isAddress(address) ? (address as Address) : undefined;
  const canReadHook = hasConfiguredHook;
  const activeOnXLayer = chainId === XLAYER_TESTNET_CHAIN_ID;

  const { data: potBalance, refetch: refetchPot } = useReadContract({
    address: CONFIGURED_HOOK_ADDRESS,
    abi: XLAYER_HOOK_ABI,
    functionName: "potBalance",
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: canReadHook },
  });
  const { data: totalShares, refetch: refetchShares } = useReadContract({
    address: CONFIGURED_HOOK_ADDRESS,
    abi: XLAYER_HOOK_ABI,
    functionName: "totalShares",
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: canReadHook },
  });
  const { data: minPotForDraw } = useReadContract({
    address: CONFIGURED_HOOK_ADDRESS,
    abi: XLAYER_HOOK_ABI,
    functionName: "minPotForDraw",
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: canReadHook },
  });
  const { data: drawCooldown } = useReadContract({
    address: CONFIGURED_HOOK_ADDRESS,
    abi: XLAYER_HOOK_ABI,
    functionName: "drawCooldown",
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: canReadHook },
  });
  const { data: surchargeBps } = useReadContract({
    address: CONFIGURED_HOOK_ADDRESS,
    abi: XLAYER_HOOK_ABI,
    functionName: "surchargeBps",
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: canReadHook },
  });
  const { data: surchargeEnabled } = useReadContract({
    address: CONFIGURED_HOOK_ADDRESS,
    abi: XLAYER_HOOK_ABI,
    functionName: "surchargeEnabled",
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: canReadHook },
  });
  const { data: draw, refetch: refetchDraw } = useReadContract({
    address: CONFIGURED_HOOK_ADDRESS,
    abi: XLAYER_HOOK_ABI,
    functionName: "draw",
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: canReadHook },
  });
  const { data: userShares } = useReadContract({
    address: CONFIGURED_HOOK_ADDRESS,
    abi: XLAYER_HOOK_ABI,
    functionName: "shares",
    args: evmAddress ? [evmAddress] : undefined,
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: canReadHook && Boolean(evmAddress) },
  });
  const { data: userPrincipal } = useReadContract({
    address: CONFIGURED_HOOK_ADDRESS,
    abi: XLAYER_HOOK_ABI,
    functionName: "principal",
    args: evmAddress ? [evmAddress] : undefined,
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: canReadHook && Boolean(evmAddress) },
  });
  const { data: tokenBalance } = useBalance({
    address: evmAddress,
    token: hasConfiguredToken ? XLAYER_TESTNET_USDC_ADDRESS : undefined,
    chainId: XLAYER_TESTNET_CHAIN_ID,
    query: { enabled: hasConfiguredToken && Boolean(evmAddress) },
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
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs text-slate-500">Chain {XLAYER_TESTNET_CHAIN_ID} · Live on testnet since Aug 9, 2026</span>
          <div className="w-full max-w-none rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl sm:max-w-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${activeOnXLayer ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-300/15 text-amber-200"}`}>
                  {activeOnXLayer ? <Wifi className="h-5 w-5" /> : <CircleAlert className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Wallet network</p>
                  <p className="mt-1 truncate text-sm font-semibold text-white">{activeOnXLayer ? "Ready on X Layer" : chainId ? `Chain ${chainId}` : "Not connected"}</p>
                </div>
              </div>
              {isConnected ? (
                <button type="button" onClick={handleSwitch} className="min-h-11 shrink-0 px-2 text-xs font-semibold text-cyan-300 transition hover:text-cyan-200 touch-manipulation">
                  Switch
                </button>
              ) : (
                <Button variant="glass" size="sm" className="min-h-11 touch-manipulation" onClick={handleConnect}>
                  Connect
                </Button>
              )}
            </div>
            <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs leading-5 text-slate-500">
              {walletType === "evm" && evmAddress ? `Connected ${shorten(evmAddress)}` : "Connect an EVM wallet to preview your share."}
            </p>
            {activeOnXLayer && (
              <a href={XLAYER_FAUCET_URL} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 transition hover:text-cyan-200">
                Get testnet OKB + USDC from the X Layer faucet <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </PageHeader>

      <ShellSection className="space-y-6">
          {/* Product story: what this pool is and who runs it, before any pool stats. */}
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

          {/* Demo loop + write surfaces (capability-gated) */}
          <XLayerDemoLoopGuide
            potBalanceUsdc={potBalance !== undefined ? Number(formatUnits(potBalance, 6)) : 0}
            minPotUsdc={minPotForDraw !== undefined ? Number(formatUnits(minPotForDraw, 6)) : 0}
            totalShares={totalShares !== undefined ? Number(formatUnits(totalShares, 6)) : 0}
            drawOpen={Boolean(drawState?.[0])}
            drawResolved={Boolean(drawState?.[1])}
            drawClaimed={Boolean(drawState?.[2])}
          />
          <DepositPrincipalSection usdcBalance={evmAddress && tokenBalance ? Number(tokenBalance.formatted) : null} />
          <JoinPoolSection usdcBalance={evmAddress && tokenBalance ? Number(tokenBalance.formatted) : null} />

          <XLayerAgentPanel
            potBalance={potBalance}
            totalShares={totalShares}
            minPot={minPotForDraw}
            drawCooldown={drawCooldown}
            surchargeBps={typeof surchargeBps === "number" ? surchargeBps : surchargeBps !== undefined ? Number(surchargeBps) : undefined}
            surchargeEnabled={surchargeEnabled}
            drawState={drawState}
          />

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

// ─── Testnet funding hint ─────────────────────────────────────────────────────
//
// The stranger journey dies here if it dies anywhere: a freshly connected wallet
// has no testnet OKB (gas) or USDC_TEST. The official OKX faucet issues both, so
// every write surface shows the balance and the funding path inline rather than
// letting the first transaction revert with an RPC error.

function TestnetFundsHint({ balance, accentClass }: { balance: number; accentClass: string }) {
  return (
    <p className="mb-3 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
      <span>
        Balance: {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC_TEST
      </span>
      <span aria-hidden>·</span>
      <a href={XLAYER_FAUCET_URL} target="_blank" rel="noreferrer" className={`inline-flex min-h-11 items-center gap-1 font-semibold transition touch-manipulation sm:min-h-0 ${accentClass}`}>
        {balance <= 0 ? "Claim testnet OKB + USDC" : "Top up at the X Layer faucet"}
        <ExternalLink className="h-3 w-3" />
      </a>
    </p>
  );
}

// ─── Deposit principal (capability-gated) ─────────────────────────────────────

function DepositPrincipalSection({ usdcBalance }: { usdcBalance: number | null }) {
  const { canWrite, message } = useCapability('xlayer_prize_pool');
  const { deposit, execution, isActive, isSuccess, isError, reset } = useXLayerDeposit();
  const [amount, setAmount] = useState('5');
  const [error, setError] = useState<string | null>(null);

  if (!canWrite) return null;

  const handleDeposit = async () => {
    setError(null);
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      setError('Enter a valid USDC amount');
      return;
    }
    if (usdcBalance !== null && parsed > usdcBalance) {
      setError('Not enough testnet USDC — claim USDC_TEST from the X Layer faucet below.');
      return;
    }
    const result = await deposit({ amountUsdc: amount });
    if (!result.success && result.error) setError(result.error);
  };

  return (
    <CompactCard variant="glass" padding="lg" hover={false} className="border-cyan-400/20 bg-cyan-500/[0.05]">
      <div className="flex items-center gap-2 text-cyan-300 mb-4">
        <LockKeyhole className="h-4 w-4" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Deposit principal</span>
        <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300 font-semibold">Testnet</span>
      </div>

      {isSuccess ? (
        <div className="text-center py-4">
          <p className="text-white font-semibold">Principal deposited</p>
          <p className="text-xs text-slate-400 mt-1">Shares are active for draw eligibility. Pot still needs surcharge or fundPot.</p>
          <Button variant="glass" size="sm" className="mt-4" onClick={reset}>Deposit again</Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-300 mb-4">
            Lossless path: USDC becomes shares. Your principal stays redeemable between epochs.
          </p>
          {message && <p className="text-xs text-amber-300/80 mb-3">{message}</p>}
          {usdcBalance !== null && (
            <TestnetFundsHint balance={usdcBalance} accentClass="text-cyan-300 hover:text-cyan-200" />
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-slate-400">Amount (USDC)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isActive}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-base text-white focus:border-cyan-400/50 focus:outline-none disabled:opacity-50 sm:py-2 sm:text-sm"
                placeholder="5.00"
              />
            </div>
            <Button
              variant="default"
              size="sm"
              className="min-h-12 w-full bg-gradient-to-r from-cyan-500 to-blue-600 px-6 text-white touch-manipulation sm:min-h-11 sm:w-auto"
              onClick={handleDeposit}
              disabled={isActive}
            >
              {isActive ? (
                <><Loader className="mr-1.5 h-3 w-3 animate-spin" />Depositing…</>
              ) : (
                'Deposit'
              )}
            </Button>
          </div>
          {error && <p className="text-xs text-red-400 mt-2" role="alert">{error}</p>}
          {isError && execution.status === 'failed' && !execution.error.userCancelled && (
            <Button variant="ghost" size="sm" className="mt-3 text-xs text-red-300" onClick={() => { reset(); setError(null); }}>
              Try again
            </Button>
          )}
        </>
      )}
    </CompactCard>
  );
}

// ─── Join via swap (capability-gated) ─────────────────────────────────────────

function JoinPoolSection({ usdcBalance }: { usdcBalance: number | null }) {
  const { canWrite, message } = useCapability('xlayer_prize_pool');
  const { join, execution, isActive, isSuccess, isError, reset } = useXLayerJoin();
  const [amount, setAmount] = useState('10');
  const [joinError, setJoinError] = useState<string | null>(null);

  // Hidden entirely when writes are disabled
  if (!canWrite) return null;

  const handleJoin = async () => {
    setJoinError(null);
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      setJoinError('Enter a valid USDC amount');
      return;
    }
    if (usdcBalance !== null && parsed > usdcBalance) {
      setJoinError('Not enough testnet USDC — claim USDC_TEST from the X Layer faucet below.');
      return;
    }
    const result = await join({ amountUsdc: amount });
    if (!result.success && result.error) {
      setJoinError(result.error);
    }
  };

  return (
    <CompactCard variant="glass" padding="lg" hover={false} className="border-emerald-400/20 bg-emerald-500/[0.05]">
      <div className="flex items-center gap-2 text-emerald-300 mb-4">
        <Sparkles className="h-4 w-4" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Join via swap</span>
        <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300 font-semibold">Testnet</span>
      </div>

      {isSuccess ? (
        <div className="text-center py-4">
          <p className="text-white font-semibold">Joined via swap</p>
          <p className="text-xs text-slate-400 mt-1">Shares + surcharge contribution confirmed.</p>
          <Button variant="glass" size="sm" className="mt-4" onClick={reset}>Swap again</Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-300 mb-4">
            Route a USDC swap through the prize-pool router. Surcharge accrues to the pot; you receive shares.
          </p>
          {message && (
            <p className="text-xs text-amber-300/80 mb-3">{message}</p>
          )}
          {usdcBalance !== null && (
            <TestnetFundsHint balance={usdcBalance} accentClass="text-emerald-300 hover:text-emerald-200" />
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-slate-400">Amount (USDC)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isActive}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-base text-white focus:border-emerald-400/50 focus:outline-none disabled:opacity-50 sm:py-2 sm:text-sm"
                placeholder="10.00"
              />
            </div>
            <Button
              variant="default"
              size="sm"
              className="min-h-12 w-full bg-gradient-to-r from-emerald-500 to-teal-600 px-6 text-white touch-manipulation hover:from-emerald-600 hover:to-teal-700 sm:min-h-11 sm:w-auto"
              onClick={handleJoin}
              disabled={isActive}
            >
              {isActive ? (
                <><Loader className="mr-1.5 h-3 w-3 animate-spin" />Joining...</>
              ) : (
                'Join via swap'
              )}
            </Button>
          </div>
          {joinError && (
            <p className="text-xs text-red-400 mt-2" role="alert">{joinError}</p>
          )}
          {isError && execution.status === 'failed' && !execution.error.userCancelled && (
            <div className="mt-3 flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-xs text-red-300" onClick={() => { reset(); setJoinError(null); }}>
                Try Again
              </Button>
            </div>
          )}
        </>
      )}
    </CompactCard>
  );
}
