#!/bin/bash

# Patch viem to remove problematic test exports that cause build failures

# Find and patch all viem _esm/index.js files to remove testActions export
find node_modules/.pnpm -path "*viem*/_esm/index.js" -type f 2>/dev/null | while read file; do
  sed -i.bak "s/export { testActions, } from '\.\/clients\/decorators\/test\.js';//g" "$file" 2>/dev/null || true
  sed -i.bak "s/export.*createTestClient.*//g" "$file" 2>/dev/null || true
done

# Find and patch all viem _cjs/index.js files
find node_modules/.pnpm -path "*viem*/_cjs/index.js" -type f 2>/dev/null | while read file; do
  sed -i.bak "s/exports\.testActions = .*//" "$file" 2>/dev/null || true
done

# Find and patch all viem _esm/actions/index.js files to remove test action exports
find node_modules/.pnpm -path "*viem*/_esm/actions/index.js" -type f 2>/dev/null | while read file; do
  sed -i.bak "/from.*'\.\/test\//d; /dumpState\|getAutomine\|getTxpool/d" "$file" 2>/dev/null || true
done

# Clean up backup files
find node_modules/.pnpm -name "*.bak" -type f -delete 2>/dev/null || true
