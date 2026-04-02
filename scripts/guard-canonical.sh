#!/usr/bin/env bash

set -euo pipefail

if ! command -v rg >/dev/null 2>&1; then
  echo "guard:canonical requires ripgrep (rg) to be installed."
  exit 1
fi

failures=0

check_forbidden() {
  local pattern="$1"
  local label="$2"
  shift 2
  local paths=("$@")

  local output
  output="$(rg -n -U --pcre2 "$pattern" "${paths[@]}" || true)"
  if [[ -n "$output" ]]; then
    echo "Forbidden pattern detected: $label"
    echo "$output"
    echo
    failures=1
  fi
}

RUNTIME_PATHS=(
  "apps/platform/src/app/arcade"
  "apps/platform/src/app/controller"
  "apps/platform/src/app/play"
  "apps/platform/src/components/arcade"
  "games/air-capture/src"
  "packages/create-airjam/templates/pong/src"
)

DOC_PATHS=(
  "apps/platform/src/app/docs"
  "apps/platform/src/components/docs"
  "packages/create-airjam/templates/pong/airjam-docs"
  "packages/sdk/README.md"
  "packages/create-airjam/templates/pong/README.md"
)

check_forbidden \
  'import\s*{[^}]*\bAirJamProvider\b[^}]*}\s*from\s*["'\'']@air-jam/sdk["'\'']' \
  "unscoped AirJamProvider imports in runtime code" \
  "${RUNTIME_PATHS[@]}"

check_forbidden \
  '\bstate\.actions\.' \
  "non-canonical state.actions dispatch usage" \
  "${RUNTIME_PATHS[@]}"

check_forbidden \
  '\bonChildClose\s*:' \
  "deprecated onChildClose host option usage" \
  "${RUNTIME_PATHS[@]}"

check_forbidden \
  '\bisChildMode\b' \
  "deprecated isChildMode usage" \
  "${RUNTIME_PATHS[@]}"

check_forbidden \
  '\bforceConnect\s*:' \
  "deprecated forceConnect option usage" \
  "${RUNTIME_PATHS[@]}"

check_forbidden \
  '<HostSessionProvider[^>]*(serverUrl|appId|maxPlayers|publicHost|input)\s*=' \
  "inline HostSessionProvider runtime config props (use canonical session-config module)" \
  "${RUNTIME_PATHS[@]}"

check_forbidden \
  '<ControllerSessionProvider[^>]*(serverUrl|appId|maxPlayers|publicHost|input)\s*=' \
  "inline ControllerSessionProvider runtime config props (use canonical session-config module)" \
  "${RUNTIME_PATHS[@]}"

check_forbidden \
  'postMessage\([^,]+,\s*["'\'']\*["'\'']' \
  "wildcard postMessage targetOrigin usage" \
  "apps/platform/src/components/arcade" \
  "packages/sdk/src"

check_forbidden \
  '\bsendInput\s*\(' \
  "raw sendInput usage (use useInputWriter + useControllerTick)" \
  "${RUNTIME_PATHS[@]}" \
  "${DOC_PATHS[@]}"

check_forbidden \
  'VITE_AIR_JAM_API_KEY|NEXT_PUBLIC_AIR_JAM_API_KEY|AJ_CONFIG_LEGACY_API_KEY_ENV' \
  "legacy API key env names/diagnostics must not appear in canonical code/docs after the appId rename" \
  "packages/sdk/src" \
  "${DOC_PATHS[@]}" \
  "README.md"

check_forbidden \
  '\bactorRole\b' \
  "non-canonical action context key actorRole (use ctx.role)" \
  "packages/sdk/src" \
  "${DOC_PATHS[@]}"

check_forbidden \
  'actions\.[A-Za-z0-9_]+\(\s*\{[^)]*\b(vector|direction|action|ability|timestamp)\s*:' \
  "input-like payload dispatched through state actions in docs/examples" \
  "${DOC_PATHS[@]}"

if [[ "$failures" -ne 0 ]]; then
  echo "Canonical guard failed."
  exit 1
fi

echo "Canonical guard passed."
