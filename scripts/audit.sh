#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SRC_DIR="$ROOT_DIR/personal-learning"

for required in SKILL.md VERSION.md TEACHING-HANDOFF.md data/learner-profile.md assets/learning-state-template.md assets/knowledge-map-template.md assets/log-template.md assets/material-index-template.md; do
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

if rg -n '^([[:space:]]*[-*] |[[:space:]]*[0-9]+[.)] )\[[?A-Z0-9+]+\]' "$SRC_DIR"/data/projects/*/knowledge-map.md; then
  echo "Knowledge maps must not contain mastery/status markers" >&2
  exit 1
fi

python3 "$ROOT_DIR/scripts/audit_state.py" --source "$SRC_DIR"
echo "Audit passed: source structure and project files are consistent."
