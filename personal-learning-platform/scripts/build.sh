#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run db:generate
npm run build
npm run validate
