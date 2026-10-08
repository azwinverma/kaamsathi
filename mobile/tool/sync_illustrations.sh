#!/usr/bin/env bash
# Refreshes mobile/assets/illustrations/ from the shared kit in
# design/illustrations/. Only files already present here are copied (the app
# bundles just the scenes it uses); pass extra filenames to add new ones:
#
#   tool/sync_illustrations.sh                 # refresh what is bundled
#   tool/sync_illustrations.sh hvac-gauge.svg  # also start bundling a scene
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
src="$here/../design/illustrations"
dst="$here/assets/illustrations"
mkdir -p "$dst"

names=()
for f in "$dst"/*.svg; do [ -e "$f" ] && names+=("$(basename "$f")"); done
names+=("$@")

for n in "${names[@]}"; do
  if [ ! -f "$src/$n" ]; then
    echo "missing in design/illustrations: $n" >&2
    exit 1
  fi
  cp "$src/$n" "$dst/$n"
  echo "synced $n"
done
