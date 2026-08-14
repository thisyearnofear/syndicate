#!/usr/bin/env bash
#
# rotate_wallet.sh — safely rotate a wallet private key stored in env files.
#
# Prevents the "overwrote a funded wallet's key" accident:
#   1. Reads the current key for VAR_NAME from the env file (never printed).
#   2. Derives its address and checks native + ERC-20 balances on-chain.
#   3. REFUSES to overwrite if any balance is above the dust threshold,
#      unless --force is given.
#   4. Backs up each env file it touches (mode 0600) before rewriting.
#   5. Generates a fresh key (or takes --new-key) and rewrites the variable
#      in BOTH .env.local (canonical) and .env (backup mirror) when present.
#
# Usage:
#   scripts/rotate_wallet.sh BASE_MAINNET_WALLET_KEY
#   scripts/rotate_wallet.sh BASE_MAINNET_WALLET_KEY --env .env.local \
#       --rpc-var BASE_MAINNET_ALCHEMY_RPC_URL \
#       --token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
#       --force
#
# Requirements: bash, awk, python3, jq, foundry `cast`.
# The private key is never printed; it is passed to subprocesses via env vars.

set -euo pipefail

ENV_FILE=".env.local"
RPC_VAR="BASE_MAINNET_ALCHEMY_RPC_URL"
RPC_URL=""
TOKENS=()
NATIVE_THRESHOLD="0.0001"
TOKEN_THRESHOLD="0"
NEW_KEY=""
FORCE=0
VAR_NAME=""

usage() {
  sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)          ENV_FILE="$2"; shift 2 ;;
    --rpc-var)      RPC_VAR="$2"; shift 2 ;;
    --rpc)          RPC_URL="$2"; shift 2 ;;
    --token)        TOKENS+=("$2"); shift 2 ;;
    --threshold)    NATIVE_THRESHOLD="$2"; shift 2 ;;
    --token-threshold) TOKEN_THRESHOLD="$2"; shift 2 ;;
    --new-key)      NEW_KEY="$2"; shift 2 ;;
    --force)        FORCE=1; shift ;;
    -h|--help)      usage; exit 0 ;;
    -*)             echo "Unknown option: $1" >&2; usage; exit 1 ;;
    *)              VAR_NAME="$1"; shift ;;
  esac
done

if [[ -z "$VAR_NAME" ]]; then
  echo "Error: VAR_NAME is required (e.g. BASE_MAINNET_WALLET_KEY)." >&2
  usage
  exit 1
fi

for cmd in cast python3 jq awk; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Error: '$cmd' is required but not found." >&2; exit 1; }
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: env file '$ENV_FILE' not found." >&2
  exit 1
fi

read_env() {
  # $1 = file, $2 = key name; prints the raw value (quotes stripped).
  python3 - "$1" "$2" <<'PY'
import re, sys
path, key = sys.argv[1], sys.argv[2]
try:
    content = open(path).read()
except FileNotFoundError:
    sys.exit(0)
m = re.search(rf'^[ \t]*{re.escape(key)}=(.*)$', content, re.M)
if not m:
    sys.exit(0)
v = m.group(1).strip()
if len(v) >= 2 and v[0] == v[-1] and v[0] in ('"', "'"):
    v = v[1:-1]
print(v, end='')
PY
}

# --- Resolve RPC URL ---------------------------------------------------------
if [[ -z "$RPC_URL" ]]; then
  RPC_URL="$(read_env "$ENV_FILE" "$RPC_VAR")"
fi
if [[ -z "$RPC_URL" && -f ".env" ]]; then
  RPC_URL="$(read_env ".env" "$RPC_VAR")"
fi
if [[ -z "$RPC_URL" ]]; then
  echo "Error: no RPC URL. Pass --rpc <url> or set $RPC_VAR in $ENV_FILE." >&2
  exit 1
fi

# --- Read old key + derive address (key never leaves env vars) ---------------
OLD_KEY="$(read_env "$ENV_FILE" "$VAR_NAME")"
OLD_ADDRESS=""
if [[ -n "$OLD_KEY" ]]; then
  OLD_ADDRESS="$(OLD_KEY="$OLD_KEY" python3 - <<'PY'
import os, subprocess
r = subprocess.run(
    ["cast", "wallet", "address", "--private-key", os.environ["OLD_KEY"]],
    capture_output=True, text=True,
)
print(r.stdout.strip(), end='')
PY
)"
  if [[ -z "$OLD_ADDRESS" ]]; then
    echo "Error: could not derive address for the existing $VAR_NAME key." >&2
    exit 1
  fi
fi

# --- Balance checks ----------------------------------------------------------
blocked=0

gt() { # gt <value> <threshold> -> exit 0 if value > threshold
  awk -v a="$1" -v t="$2" 'BEGIN { exit !(a + 0 > t + 0) }'
}

if [[ -n "$OLD_ADDRESS" ]]; then
  echo "Existing key for $VAR_NAME -> $OLD_ADDRESS"
  echo "RPC: $RPC_URL"

  NATIVE="$(cast balance --ether "$OLD_ADDRESS" --rpc-url "$RPC_URL" 2>/dev/null || echo 'error')"
  if [[ "$NATIVE" == "error" || -z "$NATIVE" ]]; then
    echo "WARNING: could not fetch native balance (RPC error). Treating as non-zero for safety."
    NATIVE="1"
  fi
  echo "  native balance: $NATIVE (threshold: $NATIVE_THRESHOLD)"
  if gt "$NATIVE" "$NATIVE_THRESHOLD"; then blocked=1; fi

  for token in ${TOKENS[@]+"${TOKENS[@]}"}; do
    RAW="$(cast call "$token" 'balanceOf(address)(uint256)' "$OLD_ADDRESS" --rpc-url "$RPC_URL" 2>/dev/null | awk '{print $1}')" || RAW="error"
    if [[ "$RAW" == "error" || -z "$RAW" ]]; then
      echo "  token $token: balance check FAILED — treating as non-zero for safety."
      RAW="1"
    fi
    echo "  token $token raw balance: $RAW (threshold raw: $TOKEN_THRESHOLD)"
    if gt "$RAW" "$TOKEN_THRESHOLD"; then blocked=1; fi
  done
else
  echo "No existing value for $VAR_NAME in $ENV_FILE — nothing to check."
fi

if [[ "$blocked" -eq 1 && "$FORCE" -ne 1 ]]; then
  cat >&2 <<MSG

REFUSING to overwrite $VAR_NAME: the current wallet still holds funds.

First sweep the remaining funds out of $OLD_ADDRESS (or recover its key from
your own backup), then re-run. If you truly want to abandon those funds,
re-run with --force.
MSG
  exit 2
fi
if [[ "$blocked" -eq 1 && "$FORCE" -eq 1 ]]; then
  echo "WARNING: --force given; proceeding despite non-zero balances on $OLD_ADDRESS."
fi

# --- New key -----------------------------------------------------------------
if [[ -z "$NEW_KEY" ]]; then
  NEW_JSON="$(cast wallet new --json)"
  NEW_KEY="$(printf '%s' "$NEW_JSON" | jq -r '.[0].private_key')"
  NEW_ADDRESS="$(printf '%s' "$NEW_JSON" | jq -r '.[0].address')"
  if [[ -z "$NEW_KEY" || "$NEW_KEY" == "null" ]]; then
    echo "Error: failed to generate a new wallet." >&2
    exit 1
  fi
else
  NEW_ADDRESS="$(NEW_KEY="$NEW_KEY" python3 - <<'PY'
import os, subprocess
r = subprocess.run(
    ["cast", "wallet", "address", "--private-key", os.environ["NEW_KEY"]],
    capture_output=True, text=True,
)
print(r.stdout.strip(), end='')
PY
)"
  if [[ -z "$NEW_ADDRESS" ]]; then
    echo "Error: --new-key does not look like a valid private key." >&2
    exit 1
  fi
fi

# --- Write to env files (key passed via env, never argv) ---------------------
# Primary target plus the mirror copy (.env <-> .env.local) when it exists.
TARGETS=("$ENV_FILE")
if [[ "$ENV_FILE" == ".env.local" && -f ".env" ]]; then
  TARGETS+=(".env")
elif [[ "$ENV_FILE" == ".env" && -f ".env.local" ]]; then
  TARGETS+=(".env.local")
fi

for TARGET in "${TARGETS[@]}"; do
  BACKUP="${TARGET}.bak.$(date +%Y%m%dT%H%M%S)"
  cp -p "$TARGET" "$BACKUP"
  chmod 600 "$BACKUP" 2>/dev/null || true
  echo "Backup written: $BACKUP (mode 600, gitignored via .env*)"

  NEW_KEY="$NEW_KEY" VAR_NAME="$VAR_NAME" ENV_FILE="$TARGET" python3 - <<'PY'
import os, re, tempfile

path = os.environ["ENV_FILE"]
var = os.environ["VAR_NAME"]
new = os.environ["NEW_KEY"]

with open(path) as f:
    content = f.read()

line = f'{var}="{new}"'
pattern = re.compile(rf'^[ \t]*{re.escape(var)}=.*$', re.M)
if pattern.search(content):
    content = pattern.sub(line, content, count=1)
else:
    if content and not content.endswith("\n"):
        content += "\n"
    content += line + "\n"

fd, tmp = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(path)) or ".")
with os.fdopen(fd, "w") as f:
    f.write(content)
os.chmod(tmp, 0o600)
os.replace(tmp, path)
PY
done

echo "Rotated $VAR_NAME in: ${TARGETS[*]}"
echo "New public address: $NEW_ADDRESS"
echo "Old address:      ${OLD_ADDRESS:-<none>}"
echo "Private key stored in ${TARGETS[*]} only (never printed, never committed)."
