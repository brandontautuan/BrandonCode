#!/usr/bin/env bash
# Opens a new Terminal.app window, cds to the project directory, and starts the BrandonCode CLI (dev).
# Used by voice wake (wake_listen.py) or can be run manually / from Shortcuts.
#
# If BRANDONCODE_WAKE_CWD is set (wake_listen.py sets it to the listener's cwd), that directory is used.
# Otherwise falls back to this repo's root next to scripts/.
#
# Writes a tiny shell script to /tmp and tells Terminal to exec it. Embedding the full
# command inside AppleScript "do script" breaks on escaped characters (see osascript -2741).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CMD="${BRANDONCODE_WAKE_CMD:-npm run dev}"
CD_TARGET="${BRANDONCODE_WAKE_CWD:-$REPO_ROOT}"
if [[ ! -d "$CD_TARGET" ]]; then
  CD_TARGET="$REPO_ROOT"
fi

# Stable path so we never delete before Terminal reads it (no race with mktemp+rm).
WRAPPER="/tmp/brandoncode-wake-launch-${UID:-$$}.sh"

{
  echo '#!/bin/bash'
  echo 'set -euo pipefail'
  printf 'cd %q\n' "$CD_TARGET"
  echo "echo 'BrandonCode starting'"
  printf '%s\n' "$CMD"
} >"$WRAPPER"
chmod 700 "$WRAPPER"

# Short path only inside AppleScript — avoids -2741 from embedding printf %q shell commands.
osascript <<EOF
tell application "Terminal"
    activate
    do script "exec /bin/bash $(printf %q "$WRAPPER")"
end tell
EOF
