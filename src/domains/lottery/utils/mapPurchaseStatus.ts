import type { TrackerStatus } from '@/domains/participation/types';

export function mapPurchaseStatusToTracker(status?: string | null): TrackerStatus {
  if (!status) return 'idle';
  if (status === 'confirmed_stacks' || status === 'broadcasting') return 'confirmed_source';
  if (status === 'bridging') return 'bridging';
  if (status === 'purchasing') return 'purchasing';
  if (status === 'complete') return 'complete';
  if (status === 'error') return 'error';
  return 'idle';
}
