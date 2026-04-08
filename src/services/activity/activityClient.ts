import type { BridgeActivityRecord } from '@/utils/bridgeStateManager';
import type { VaultDepositActivityRecord } from '@/utils/vaultActivityManager';

export async function persistBridgeActivityRecord(record: BridgeActivityRecord): Promise<void> {
  await fetch('/api/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: record.id,
      walletAddress: record.sourceAddress || record.destinationAddress,
      eventType: 'bridge',
      protocol: record.protocol,
      amount: record.amount,
      txHash: record.sourceTxHash,
      sourceChain: record.sourceChain,
      destinationChain: record.destinationChain,
      sourceAddress: record.sourceAddress,
      destinationAddress: record.destinationAddress,
      status: record.status,
      error: record.error,
      targetStrategy: record.targetStrategy,
      linkedVaultProtocol: record.linkedVaultProtocol,
      linkedDepositTxHash: record.linkedDepositTxHash,
      metadata: {
        bridgeId: record.bridgeId,
        redirectUrl: record.redirectUrl,
        destinationTxHash: record.destinationTxHash,
      },
      createdAt: record.timestamp,
      updatedAt: record.updatedAt,
    }),
  });
}

export async function persistVaultDepositActivityRecord(record: VaultDepositActivityRecord): Promise<void> {
  await fetch('/api/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: record.id,
      walletAddress: record.walletAddress,
      eventType: 'vault_deposit',
      protocol: record.protocol,
      amount: record.amount,
      txHash: record.txHash,
      bridgeActivityId: record.bridgeActivityId,
      createdAt: record.timestamp,
      updatedAt: record.timestamp,
    }),
  });
}
