#!/usr/bin/env python3
"""Build the single-file ISOM 3770 gap-check exam."""
from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
DIST = ROOT / "dist"
FINAL = ROOT.parent / "ISOM3770_Midterm_GapCheck.html"


def main() -> None:
    bank = json.loads((SRC / "bank.json").read_text(encoding="utf-8"))
    if len(bank) != 100:
        raise SystemExit(f"expected 100 questions, found {len(bank)}")
    styles = (SRC / "styles.css").read_text(encoding="utf-8")
    app = (SRC / "app.js").read_text(encoding="utf-8")
    template = (SRC / "template.html").read_text(encoding="utf-8")

    bank_json = json.dumps(bank, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = (
        template.replace("/*__STYLES__*/", styles)
        .replace("/*__BANK__*/", bank_json)
        .replace("/*__APP__*/", app)
    )

    DIST.mkdir(parents=True, exist_ok=True)
    dist_file = DIST / "ISOM3770_Midterm_GapCheck.html"
    dist_file.write_text(html, encoding="utf-8")
    shutil.copyfile(dist_file, FINAL)

    digest = hashlib.sha256(html.encode("utf-8")).hexdigest()
    print(f"built {dist_file}")
    print(f"copied {FINAL}")
    print(f"{len(html):,} bytes · {len(bank)} questions · sha256 {digest[:16]}…")


if __name__ == "__main__":
    main()
