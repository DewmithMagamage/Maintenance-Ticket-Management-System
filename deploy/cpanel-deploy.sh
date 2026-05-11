#!/usr/bin/env bash
set -euo pipefail

echo "[cpanel-deploy] Starting deployment tasks..."

# cPanel runs this from the checked-out repository root.
if [[ ! -f "package.json" || ! -d "server" || ! -d "client" ]]; then
  echo "[cpanel-deploy] ERROR: Repository root not detected."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[cpanel-deploy] ERROR: npm is not available in PATH for this deploy user."
  echo "[cpanel-deploy] Install Node.js via cPanel Setup Node.js App first."
  exit 1
fi

echo "[cpanel-deploy] npm version: $(npm -v)"
echo "[cpanel-deploy] Installing dependencies..."
npm run install:all

echo "[cpanel-deploy] Building frontend and copying to server/public..."
npm run build:cpanel

echo "[cpanel-deploy] Done. Restart the Node.js app from cPanel if not auto-restarted."
