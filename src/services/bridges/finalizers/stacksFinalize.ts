import { ethers } from 'ethers';
import { CONTRACTS, LOTTERY, CHAINS } from '@/config';
import { getCrossChainPurchaseByStacksTxId } from '@/lib/db/repositories/crossChainPurchaseRepository';
import { upsertPurchaseStatus } from '@/lib/db/repositories/purchaseStatusRepository';

export async function finalizeStacksPurchase(stacksTxId: string, recipientBaseAddress: string) {
  const proxyAddress = CONTRACTS.autoPurchaseProxy;
  const signerKey = process.env.AUTO_PURCHASE_SIGNER_KEY;
  if (!proxyAddress || proxyAddress === '0x0000000000000000000000000000000000000000') {
    throw new Error('AutoPurchaseProxy not configured');
  }
  if (!signerKey) {
    throw new Error('AUTO_PURCHASE_SIGNER_KEY missing');
  }

  const purchase = await getCrossChainPurchaseByStacksTxId(stacksTxId);
  if (!purchase || !purchase.ticketCount || !recipientBaseAddress) {
    throw new Error('Missing purchase data');
  }
  const amountWei = BigInt(purchase.ticketCount) * LOTTERY.ticketPriceWei;

  const provider = new ethers.JsonRpcProvider(CHAINS.base.rpcUrl);

  // Optional fast path: detect recent USDC transfers to proxy
  try {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 1500);
    const transferTopic = ethers.id('Transfer(address,address,uint256)');
    const toTopic = ethers.zeroPadValue(proxyAddress, 32);
    await provider.getLogs({
      address: CONTRACTS.usdc,
      topics: [transferTopic, null, toTopic],
      fromBlock,
      toBlock: currentBlock,
    });
  } catch {
    // Non-fatal
  }

  // Check USDC balance at proxy (safe path)
  const usdc = new ethers.Contract(CONTRACTS.usdc, ['function balanceOf(address) view returns (uint256)'], provider);
  const balance: bigint = await usdc.balanceOf(proxyAddress);
  if (balance < amountWei) {
    throw new Error('USDC not yet delivered to proxy');
  }

  // Execute bridged purchase
  const wallet = new ethers.Wallet(signerKey, provider);
  const proxyIface = new ethers.Interface([
    'function executeBridgedPurchase(uint256 amount, address recipient, address referrer, bytes32 bridgeId) external',
  ]);
  const proxy = new ethers.Contract(proxyAddress, proxyIface.fragments, wallet);
  const bridgeId = ethers.keccak256(ethers.toUtf8Bytes(`stacks-${stacksTxId}`));
  const tx = await proxy.executeBridgedPurchase(amountWei, recipientBaseAddress, LOTTERY.referrerAddress, bridgeId, { gasLimit: 300000 });
  const rc = await tx.wait();

  await upsertPurchaseStatus({
    sourceTxId: stacksTxId,
    sourceChain: 'stacks',
    status: 'complete',
    baseTxId: rc?.hash || null,
    bridgeId,
    recipientBaseAddress,
  });

  return { success: true, txHash: rc?.hash || tx.hash };
}
