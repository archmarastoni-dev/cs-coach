#!/usr/bin/env python3
"""Builds the single-file dashboard from the sources in src/.

    python tools/build_dashboard.py                  # writes dashboard_template.html (empty data)
    python tools/build_dashboard.py --sample cs_data.json --out preview.html   # preview with real data

How it works: src/index.html is a normal HTML page. Every local <link rel="stylesheet" href="...">
and <script src="..."> in it is replaced by the file content, inline. Remote links (fonts) are kept.
Elements marked data-only="full" are skipped in the lightweight build (build(full=False)).
The placeholders in src/js/core/00-bootstrap.js are filled with the radar calibration and images,
and the archive is embedded between the /*DATA_START*/ and /*DATA_END*/ markers (empty here;
cs_coach.write_html() replaces it with the real archive).
"""
import argparse
import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EMPTY_DB = {"version": 1, "steamid": None, "matches": []}      # what the shipped template contains
SRC = ROOT / "src"

LINK_RE = re.compile(r'<link rel="stylesheet" href="(?!https?:)([^"]+)"([^>]*)>')
SCRIPT_RE = re.compile(r'<script src="([^"]+)"([^>]*)></script>')
DATA_RE = re.compile(r"/\*DATA_START\*/null/\*DATA_END\*/")


def _read(rel):
    return (SRC / rel).read_text(encoding="utf-8").rstrip("\n")


def _radars():
    """Radar images as data URIs, keyed by map id (file name without extension)."""
    out = {}
    for f in sorted((SRC / "assets" / "radar").glob("*.webp")):
        out[f.stem] = "data:image/webp;base64," + base64.b64encode(f.read_bytes()).decode()
    return out


def build(data=None, full=True, with_radars=True):
    """Returns the dashboard HTML with `data` (dict) embedded; the empty archive when None."""
    html = (SRC / "index.html").read_text(encoding="utf-8")
    html = re.sub(r"<!--.*?-->\n?", "", html, flags=re.S)           # drop the authoring comments

    def link(m):
        return "" if ("full" in m.group(2) and not full) else "<style>\n%s\n</style>" % _read(m.group(1))

    def script(m):
        return "" if ("full" in m.group(2) and not full) else "<script>\n%s\n</script>" % _read(m.group(1))

    html = LINK_RE.sub(link, html)
    html = SCRIPT_RE.sub(script, html)
    html = html.replace("/*__MAPS__*/null", _read("data/maps.json"))
    html = html.replace("/*__RADARS__*/null", json.dumps(_radars() if with_radars else {}))
    payload = json.dumps(EMPTY_DB if data is None else data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = DATA_RE.sub(lambda _m: "/*DATA_START*/" + payload + "/*DATA_END*/", html)
    return re.sub(r"\n{3,}", "\n\n", html)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(ROOT / "dashboard_template.html"), help="output file")
    ap.add_argument("--sample", help="optional cs_data.json to embed (for a local preview)")
    args = ap.parse_args()
    data = json.loads(Path(args.sample).read_text(encoding="utf-8")) if args.sample else None
    out = build(data)
    Path(args.out).write_text(out, encoding="utf-8")
    print("Wrote %s (%d KB)" % (args.out, len(out) // 1024))


if __name__ == "__main__":
    main()
