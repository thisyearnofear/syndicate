/**
 * AUTOMATION HUB — the Settings surface for every recurring/automated purchase
 * path. Rebuilt on the system's dark register, and honest by construction:
 *
 *   - Only real surfaces render: the permissioned autopilot (when a policy is
 *     active), the Base agent advisory strip (when capability reads are on),
 *     the strategy config modal (permission-gated, fails closed), and the
 *     Virtuals ACP task manager (live capability).
 *   - The fabricated "AI reasoning terminal", invented agents (NEAR Nomad,
 *     Stacks Sentinel), and light-theme cards are gone (docs/DESIGN.md rule 7:
 *     nothing pending/simulated may read as finished, and honesty is never
 *     chrome).
 */

"use client";

import { useState, type ComponentType } from "react";
import { Bot, Zap, Coins, ShieldCheck, Brain } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { AutoPurchaseModal } from "@/components/modal/AutoPurchaseModal";
import { VirtualsAgentPanel } from "@/components/settings/VirtualsAgentPanel";
import { AUTOMATION_MODE_META } from "@/config/automationModes";
import { getCapability } from "@/config/capabilities";
import { PermissionedAutopilotPanel } from "@/components/automation/PermissionedAutopilotPanel";
import { BaseAgentPanel } from "@/components/automation/BaseAgentPanel";

type HubStrategy = "scheduled" | "autonomous" | "no-loss" | "yield-autopilot";

const PATH_ACCENTS = {
  amber: {
    tile: "bg-amber-400/15 text-amber-300",
    chip: "bg-amber-400/10 text-amber-300 border-amber-400/30",
  },
  emerald: {
    tile: "bg-emerald-400/15 text-emerald-300",
    chip: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
  },
  cyan: {
    tile: "bg-cyan-400/15 text-cyan-300",
    chip: "bg-cyan-400/10 text-cyan-300 border-cyan-400/30",
  },
  violet: {
    tile: "bg-violet-400/15 text-violet-300",
    chip: "bg-violet-400/10 text-violet-300 border-violet-400/30",
  },
} as const;

export function AutoPurchaseSettings() {
  const [showModal, setShowModal] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<HubStrategy>("scheduled");
  const [showVirtualsPanel, setShowVirtualsPanel] = useState(false);
  const erc7715Writes = getCapability("automation_erc7715").writesEnabled;

  const openStrategy = (strategy: HubStrategy) => {
    setSelectedStrategy(strategy);
    setShowModal(true);
  };

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Bot className="w-5 h-5 text-amber-300" />
          Automation
        </h2>
        <p className="text-sm text-gray-400 mt-1 max-w-xl">
          Recurring entries, agent-run purchases, and permissioned autopilot — managed from one place.
        </p>
      </div>

      {/* Real policy / execution surfaces — each self-hides when it has nothing
          real to show (no active policy, capability reads off). */}
      <PermissionedAutopilotPanel />
      <BaseAgentPanel />

      {/* Automation paths — all open the real, permission-gated config flow. */}
      <div>
        <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-amber-300" />
          Automation paths
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <PathCard
            icon={Zap}
            title={AUTOMATION_MODE_META.scheduled.title}
            description={AUTOMATION_MODE_META.scheduled.shortDescription}
            label={AUTOMATION_MODE_META.scheduled.hubLabel}
            cta="Set up"
            accent="amber"
            onClick={() => openStrategy("scheduled")}
          />
          <PathCard
            icon={Coins}
            title={AUTOMATION_MODE_META["no-loss"].title}
            description={AUTOMATION_MODE_META["no-loss"].shortDescription}
            label={AUTOMATION_MODE_META["no-loss"].hubLabel}
            cta="Explore"
            accent="emerald"
            onClick={() => openStrategy("no-loss")}
          />
          {erc7715Writes && (
            <PathCard
              icon={ShieldCheck}
              title={AUTOMATION_MODE_META["yield-autopilot"].title}
              description={AUTOMATION_MODE_META["yield-autopilot"].shortDescription}
              label={AUTOMATION_MODE_META["yield-autopilot"].hubLabel}
              cta="Configure"
              accent="cyan"
              onClick={() => openStrategy("yield-autopilot")}
            />
          )}
          <PathCard
            icon={Brain}
            title="Syndicate Strategist (Virtuals)"
            description="An AI strategist reviews yield and buys tickets on schedule — kill switch and auto-pause included."
            label="Agent tasks"
            cta="Manage tasks"
            accent="violet"
            onClick={() => setShowVirtualsPanel(true)}
          />
        </div>
      </div>

      {/* Strategy config modal — the real permission-gated flow (fails closed) */}
      <AutoPurchaseModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        initialStrategy={selectedStrategy}
        onSuccess={() => setShowModal(false)}
      />

      {/* Virtuals ACP task management */}
      <VirtualsAgentPanel open={showVirtualsPanel} onOpenChange={setShowVirtualsPanel} />
    </div>
  );
}

function PathCard({
  icon: Icon,
  title,
  description,
  label,
  cta,
  accent,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  label: string;
  cta: string;
  accent: keyof typeof PATH_ACCENTS;
  onClick: () => void;
}) {
  const a = PATH_ACCENTS[accent];
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.05]">
      <div className={`w-10 h-10 rounded-lg ${a.tile} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <h4 className="font-bold text-white text-sm">{title}</h4>
      <p className="text-xs text-gray-400 mt-1 mb-3 leading-relaxed">{description}</p>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${a.chip}`}>{label}</span>
        <Button size="sm" variant="outline" onClick={onClick}>
          {cta}
        </Button>
      </div>
    </div>
  );
}
