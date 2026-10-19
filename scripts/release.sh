#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
"$ROOT_DIR/scripts/audit.sh"

TEMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/personal-learning-release.XXXXXX")
TEMP_PACKAGE="$TEMP_DIR/package.zip"
trap 'rm -rf "$TEMP_DIR"' EXIT
(cd "$ROOT_DIR" && zip -qr "$TEMP_PACKAGE" personal-learning)
unzip -t "$TEMP_PACKAGE" >/dev/null
cp "$TEMP_PACKAGE" "$ROOT_DIR/personal-learning-skill.zip"
mkdir -p "$ROOT_DIR/dist"
cp "$TEMP_PACKAGE" "$ROOT_DIR/dist/personal-learning.zip"
python3 "$ROOT_DIR/scripts/verify_release.py"
echo "Released $(sed -n '3p' "$ROOT_DIR/personal-learning/VERSION.md")"
