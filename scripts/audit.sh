#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SRC_DIR="$ROOT_DIR/personal-learning"

for required in SKILL.md VERSION.md TEACHING-HANDOFF.md data/learner-profile.md \
  references/pipeline.md references/learning-state.md references/mastery-scale.md references/modes.md \
  references/next-action.md references/knowledge-summary.md \
  assets/learning-state-template.md assets/knowledge-map-template.md assets/log-template.md \
  assets/material-index-template.md assets/knowledge-summary-template.html \
  assets/knowledge-summary-cards-template.json scripts/build_summary.py; do
  test -f "$SRC_DIR/$required" || { echo "Missing required source file: $required" >&2; exit 1; }
done

found_project=0
for project_dir in "$SRC_DIR"/data/projects/*; do
  test -d "$project_dir" || continue
  found_project=1
  for file in state.md knowledge-map.md log.md material-index.md; do
    test -f "$project_dir/$file" || { echo "Missing $file in $(basename "$project_dir")" >&2; exit 1; }
  done
done
test "$found_project" -eq 1 || { echo "No project directories found" >&2; exit 1; }

# Knowledge maps hold structure only. Prefer ripgrep; fall back to POSIX grep when rg is not installed.
MARKER_RE='^([[:space:]]*[-*] |[[:space:]]*[0-9]+[.)] )\[[?A-Z0-9+]+\]'
if command -v rg >/dev/null 2>&1; then
  search() { rg -n "$MARKER_RE" "$@"; }
else
  search() { grep -nE "$MARKER_RE" "$@"; }
fi
if search "$SRC_DIR"/data/projects/*/knowledge-map.md; then
  echo "Knowledge maps must not contain mastery/status markers" >&2
  exit 1
fi

python3 "$ROOT_DIR/scripts/audit_state.py" --source "$SRC_DIR"
echo "Audit passed: source structure, project files, knowledge-summary mode and public-file privacy are consistent."
