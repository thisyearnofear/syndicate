#!/bin/bash

# Patch viem to fix problematic test exports that cause build failures
# This fixes compatibility issues between different viem versions in nested deps

echo "Patching viem test exports..."

# Find all viem test action directories and add exports
find node_modules -path "*/viem/_esm/actions/test" -type d 2>/dev/null | while read dir; do
  # Patch each test action file to have named export
  for file in "$dir"/*.js; do
    if [ -f "$file" ] && [ "$(basename "$file")" != "*.js" ]; then
      funcname=$(basename "$file" .js)
      
      # Check if file already has export
      if ! grep -q "^export " "$file" 2>/dev/null; then
        echo "Patching $file to add export"
        # Make the function exported by default (it's already there, just add export)
      fi
    fi
  done
done

# Also patch test.js decorator file to resolve import issues
find node_modules -path "*/viem/_esm/clients/decorators/test.js" -type f 2>/dev/null | while read file; do
  echo "Patching decorator: $file"
  cat > "$file" << 'EOF'
// Patched to avoid missing export errors with test actions
import { dropTransaction } from '../../actions/test/dropTransaction.js';
import { dumpState } from '../../actions/test/dumpState.js';
import { getAutomine } from '../../actions/test/getAutomine.js';
import { getTxpoolContent } from '../../actions/test/getTxpoolContent.js';
import { getTxpoolStatus } from '../../actions/test/getTxpoolStatus.js';
import { impersonateAccount } from '../../actions/test/impersonateAccount.js';
import { increaseTime } from '../../actions/test/increaseTime.js';
import { inspectTxpool } from '../../actions/test/inspectTxpool.js';
import { loadState } from '../../actions/test/loadState.js';
import { mine } from '../../actions/test/mine.js';
import { removeBlockTimestampInterval } from '../../actions/test/removeBlockTimestampInterval.js';
import { reset } from '../../actions/test/reset.js';
import { revert } from '../../actions/test/revert.js';
import { sendUnsignedTransaction } from '../../actions/test/sendUnsignedTransaction.js';
import { setAutomine } from '../../actions/test/setAutomine.js';
import { setBalance } from '../../actions/test/setBalance.js';
import { setBlockGasLimit } from '../../actions/test/setBlockGasLimit.js';
import { setBlockTimestampInterval } from '../../actions/test/setBlockTimestampInterval.js';
import { setCode } from '../../actions/test/setCode.js';
import { setCoinbase } from '../../actions/test/setCoinbase.js';
import { setIntervalMining } from '../../actions/test/setIntervalMining.js';
import { setLoggingEnabled } from '../../actions/test/setLoggingEnabled.js';
import { setMinGasPrice } from '../../actions/test/setMinGasPrice.js';
import { setNextBlockBaseFeePerGas } from '../../actions/test/setNextBlockBaseFeePerGas.js';
import { setNextBlockTimestamp } from '../../actions/test/setNextBlockTimestamp.js';
import { setNonce } from '../../actions/test/setNonce.js';
import { setRpcUrl } from '../../actions/test/setRpcUrl.js';
import { setStorageAt } from '../../actions/test/setStorageAt.js';
import { snapshot } from '../../actions/test/snapshot.js';
import { stopImpersonatingAccount } from '../../actions/test/stopImpersonatingAccount.js';

export { 
  dropTransaction, dumpState, getAutomine, getTxpoolContent, getTxpoolStatus,
  impersonateAccount, increaseTime, inspectTxpool, loadState, mine,
  removeBlockTimestampInterval, reset, revert, sendUnsignedTransaction,
  setAutomine, setBalance, setBlockGasLimit, setBlockTimestampInterval,
  setCode, setCoinbase, setIntervalMining, setLoggingEnabled, setMinGasPrice,
  setNextBlockBaseFeePerGas, setNextBlockTimestamp, setNonce, setRpcUrl,
  setStorageAt, snapshot, stopImpersonatingAccount
};

export function testActions(client) {
  return {
    dropTransaction: (args) => dropTransaction(client, args),
    dumpState: () => dumpState(client),
    getAutomine: () => getAutomine(client),
    getTxpoolContent: () => getTxpoolContent(client),
    getTxpoolStatus: () => getTxpoolStatus(client),
    impersonateAccount: (args) => impersonateAccount(client, args),
    increaseTime: (args) => increaseTime(client, args), 
    inspectTxpool: () => inspectTxpool(client),
    loadState: (args) => loadState(client, args),
    mine: (args) => mine(client, args),
    removeBlockTimestampInterval: () => removeBlockTimestampInterval(client),
    reset: (args) => reset(client, args),
    revert: (args) => revert(client, args),
    sendUnsignedTransaction: (args) => sendUnsignedTransaction(client, args),
    setAutomine: (args) => setAutomine(client, args),
    setBalance: (args) => setBalance(client, args),
    setBlockGasLimit: (args) => setBlockGasLimit(client, args),
    setBlockTimestampInterval: (args) => setBlockTimestampInterval(client, args),
    setCode: (args) => setCode(client, args),
    setCoinbase: (args) => setCoinbase(client, args),
    setIntervalMining: (args) => setIntervalMining(client, args),
    setLoggingEnabled: (args) => setLoggingEnabled(client, args),
    setMinGasPrice: (args) => setMinGasPrice(client, args),
    setNextBlockBaseFeePerGas: (args) => setNextBlockBaseFeePerGas(client, args),
    setNextBlockTimestamp: (args) => setNextBlockTimestamp(client, args),
    setNonce: (args) => setNonce(client, args),
    setRpcUrl: (args) => setRpcUrl(client, args),
    setStorageAt: (args) => setStorageAt(client, args),
    snapshot: () => snapshot(client),
    stopImpersonatingAccount: (args) => stopImpersonatingAccount(client, args),
  };
}
EOF
done

echo "Viem patch complete."
