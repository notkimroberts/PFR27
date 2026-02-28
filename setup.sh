#!/usr/bin/env bash
# setup.sh – Install dependencies and register the cron job.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECKER="$SCRIPT_DIR/check_availability.ts"
LOG="$HOME/.brazilianroom_check.log"

echo "=== Brazilian Room Availability Checker | Setup ==="
echo ""

# ── 1. Verify Bun is installed ────────────────────────────────────────────────
BUN="$(command -v bun || true)"
if [ -z "$BUN" ]; then
    echo "ERROR: bun is not installed or not on PATH."
    echo "Install it from https://bun.sh/ or run:"
    echo "  curl -fsSL https://bun.sh/install | bash"
    exit 1
fi
echo "Using Bun: $BUN ($("$BUN" --version))"

# ── 2. Install dependencies ───────────────────────────────────────────────────
echo "Installing dependencies …"
cd "$SCRIPT_DIR"
"$BUN" install

# ── 3. Make script executable ─────────────────────────────────────────────────
chmod +x "$CHECKER"

# ── 4. Register cron job (every 30 minutes) ───────────────────────────────────
# Bun is typically installed at ~/.bun/bin/bun; include it in the cron PATH so
# the script is found in cron's restricted environment.
CRON_LINE="*/10 * * * * $HOME/.asdf/installs/bun/1.3.2/bin/bun run $CHECKER >> $LOG 2>&1"

if crontab -l 2>/dev/null | grep -qF "$CHECKER"; then
    echo "Cron job already registered. Skipping."
else
    ( crontab -l 2>/dev/null; echo "$CRON_LINE" ) | crontab -
    echo "Cron job registered."
fi

# ── Done ───────────────────────────────────────────────────────────────────────
echo ""
echo "Setup complete!"
echo ""
echo "  Schedule : every 10 minutes"
echo "  Log file : $LOG"
echo ""
echo "Run the checker manually right now:"
echo "  bun run $CHECKER"
echo ""
echo "View current cron jobs:"
echo "  crontab -l"
echo ""
echo "Remove the cron job:"
echo "  crontab -l | grep -v check_availability | crontab -"
echo ""
echo "NOTE: macOS desktop notifications from cron:"
echo "  If notifications do not appear, open System Settings → Privacy &"
echo "  Security → Full Disk Access and add /usr/sbin/cron, then run:"
echo "  System Settings → Notifications → Terminal (or your shell)"
echo "  and make sure notifications are allowed."
