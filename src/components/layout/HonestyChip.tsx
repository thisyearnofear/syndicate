'use client';

/**
 * Quiet capability chip. Live surfaces stay unlabeled.
 * Labels come from honestyChip() — Paused, Testnet, Preview, Partial, Soon.
 */

import {
  honestyChip,
  honestyChipFor,
  type CapabilityId,
  type CapabilityStatus,
  type HonestyChipSpec,
} from '@/config/capabilities';

const TONES: Record<HonestyChipSpec['tone'], string> = {
  amber: 'border-amber-400/30 text-amber-300/80',
  gray: 'border-white/15 text-gray-400',
};

export function HonestyChip({
  status,
  capability,
  className = '',
}: {
  status?: CapabilityStatus;
  capability?: CapabilityId;
  className?: string;
}) {
  const spec =
    status != null ? honestyChip(status) : capability ? honestyChipFor(capability) : null;
  if (!spec) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TONES[spec.tone]} ${className}`}
    >
      {spec.label}
    </span>
  );
}
