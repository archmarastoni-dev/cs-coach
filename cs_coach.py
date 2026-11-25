#!/usr/bin/env python3
"""
CS Coach - automatically parses the demos in a folder and refreshes the local dashboard.

Each time you run it:
  1. looks for new demos in the given folders (.dem, .dem.bz2, .dem.gz, .dem.zst)
  2. parses them and adds the matches to your archive (cs_data.json)
  3. with --delete, removes each demo once parsed (the archive stays, the disk space is freed)
  4. regenerates the dashboard cs_coach.html, which you open with a double click (CS does not need to be running)

Examples (Windows, from a Command Prompt in the script folder):
  python cs_coach.py --delete
  python cs_coach.py --delete --watch              (keeps running and parses demos as they arrive)
  python cs_coach.py --folder "D:\\other demos" --folder "D:\\Steam\\...\\replays"

One-time setup:   pip install demoparser2 pandas      (and, for .zst files: pip install zstandard)
Needed in the same folder: cs_parser.py and dashboard_template.html
"""
import argparse
import bz2
import datetime as dt
import gzip
import json
import os
import re
import shutil
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
try:
    sys.stdout.reconfigure(errors="replace")
    sys.stderr.reconfigure(errors="replace")
except Exception:
    pass

DEFAULT_FOLDER = "."
DEFAULT_STEAMID = ""
EXTS = (".dem", ".dem.bz2", ".dem.gz", ".dem.zst", "_dem.bz2", "_dem.gz", "_dem.zst", "-dem.zst", "-dem.bz2", "-dem.gz")   # the "_dem" spelling appears when a site or upload renames the dot


def log(msg):
    print(time.strftime("%H:%M:%S"), msg, flush=True)


def load_db(path, steamid):
    if path.exists():
        try:
            db = json.loads(path.read_text(encoding="utf-8"))
            db.setdefault("matches", [])
            db.setdefault("processed", [])
            db.setdefault("lite", [])
            if steamid and db.get("steamid") not in (None, steamid):
                sys.exit(f"The archive {path.name} belongs to another SteamID ({db.get('steamid')}). Use a different --db.")
            db.setdefault("steamid", steamid)
            return db
        except Exception as e:
            sys.exit(f"Impossibile leggere {path}: {e}")
    return {"version": 1, "steamid": steamid, "matches": [], "lite": [], "processed": []}


def save_db(path, db):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(db, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(tmp, path)


def write_html(db, html_path):
    tpl = HERE / "dashboard_template.html"
    if not tpl.exists():
        log("WARNING: dashboard_template.html not found next to the script, dashboard not updated.")
        return
    public = {k: v for k, v in db.items() if k != "processed"}
    blob = json.dumps(public, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = tpl.read_text(encoding="utf-8")
    html, n = re.subn(r"/\*DATA_START\*/.*?/\*DATA_END\*/", lambda m: "/*DATA_START*/" + blob + "/*DATA_END*/", html, count=1, flags=re.S)
    if n != 1:
        log("WARNING: the dashboard template does not contain the expected markers.")
        return
    tmp = html_path.with_suffix(".tmp")
    tmp.write_text(html, encoding="utf-8")
    os.replace(tmp, html_path)


def is_settled(p):
    """True if the file is no longer growing (download finished)."""
    try:
        s1 = p.stat()
        if time.time() - s1.st_mtime < 15:
            return False
        time.sleep(1.5)
        return p.stat().st_size == s1.st_size
    except OSError:
        return False


def find_demos(folders):
    out = []
    for f in folders:
        p = Path(f)
        if not p.is_dir():
            log(f"Folder not found: {f}")
            continue
        for x in sorted(p.iterdir()):
            if x.is_file() and x.name.lower().endswith(EXTS):
                out.append(x)
    return out


def decompress(src, tmpdir):
    name = src.name
    low = name.lower()
    dst = Path(tmpdir) / ("demo.dem" if not low.endswith(".dem") else name)
    if low.endswith(".bz2"):
        with bz2.open(src, "rb") as a, open(dst, "wb") as b:
            shutil.copyfileobj(a, b, 1 << 20)
    elif low.endswith(".gz"):
        with gzip.open(src, "rb") as a, open(dst, "wb") as b:
            shutil.copyfileobj(a, b, 1 << 20)
    elif low.endswith(".zst"):
        try:
            import zstandard
        except ImportError:
            raise RuntimeError("For .zst files install: pip install zstandard")
        with open(src, "rb") as a, open(dst, "wb") as b:
            zstandard.ZstdDecompressor().copy_stream(a, b)
    else:
        return src
    return dst


def needs_context(db, src):
    """True if the match is archived but lacks the per-death detail (parsed by an older version)."""
    mid = __import__("hashlib").sha1(src.name.split(".dem")[0].encode()).hexdigest()[:10]
    for x in db["matches"]:
        if x.get("id") == mid:
            ds = [e for e in x["me"]["deaths"] if not e.get("teamkill")]
            no_buy = not any("buy" in r for r in x.get("rounds", []))
            return (bool(ds) and not any(("c" in e and "ev" in e["c"]) for e in ds)) or no_buy
    return False


def process(folders, db, db_path, html_path, delete, failed):
    from cs_parser import parse_demo, read_info, info_played, lite_from_info
    new = 0
    for src in find_demos(folders):
        key = f"{src.name}|{src.stat().st_size}"
        redo = key in db["processed"] and key not in failed and needs_context(db, src)
        # with --delete a demo that shows up again was put back on purpose (e.g. to re-read it): parse it again
        if (key in db["processed"] and not redo and not delete) or key in failed:
            if delete and key in db["processed"]:
                try:
                    src.unlink()
                    log(f"Deleted (already parsed): {src.name}")
                except OSError as e:
                    log(f"Cannot delete {src.name}: {e}")
            continue
        if not is_settled(src):
            log(f"Download still in progress, skipping for now: {src.name}")
            continue
        log(f"Parsing {src.name} ...")
        tmpdir = tempfile.mkdtemp(prefix="cscoach_")
        try:
            demo = decompress(src, tmpdir)
            m = parse_demo(str(demo), db["steamid"])
            m["id"] = __import__("hashlib").sha1(src.name.split(".dem")[0].encode()).hexdigest()[:10]
            m["file"] = src.name
            m["added"] = dt.datetime.fromtimestamp(src.stat().st_mtime).isoformat(timespec="seconds")
            ip = src.with_name(src.name.split(".dem")[0] + ".dem.info")
            if ip.exists():
                try:
                    inf = read_info(ip)
                    m["valve_id"], m["played"] = inf["valve_id"], info_played(inf)
                except Exception as e:
                    log(f"  .info unreadable ({e}), using the file date.")
            # The same match is recognised ONLY by exact identity: same demo file name, same Valve match id (.info),
            # or same content signature (map + players + raw round-end ticks). Similar matches (same map, same score) are NOT enough.
            def same(x):
                return (x.get("id") == m["id"] or (m.get("valve_id") and x.get("valve_id") == m["valve_id"])
                        or (m.get("sig") and x.get("sig") == m["sig"]))
            olds = [x for x in db["matches"] if same(x)]
            if olds:
                for k in ("played", "valve_id", "added"):
                    for old in olds:
                        if old.get(k) and not m.get(k):
                            m[k] = old[k]
                pos = db["matches"].index(olds[0])
                db["matches"] = [x for x in db["matches"] if not same(x)]
                db["matches"].insert(min(pos, len(db["matches"])), m)
                n_old = len(olds)
                log(f"  already in the archive (exactly the same demo): replaced the old reading{'s' if n_old>1 else ''} with the new one ({m['map']} {m['score']['us']}-{m['score']['them']}).")
            else:
                twin = next((x for x in db["matches"] if x.get("fp") == m["fp"]), None)
                if twin:
                    log("  note: another archived match has the same map, players and score, but it is not provably the same demo: kept both.")
                db["matches"].append(m)
                log(f"  {m['map']} {m['score']['us']}-{m['score']['them']} added to the archive.")
            db["matches"].sort(key=lambda x: (x.get("played") or x.get("added", ""), x["patch"]))
            if m.get("valve_id"):
                db["lite"] = [l for l in db["lite"] if l.get("valve_id") != m["valve_id"]]
            new += 1
            if key not in db["processed"]:
                db["processed"].append(key)
            save_db(db_path, db)
            write_html(db, html_path)
            if delete:
                try:
                    src.unlink()
                    log("  demo deleted from disk.")
                except OSError as e:
                    log(f"  cannot delete the demo: {e}")
                    failed.add(key)
        except SystemExit as e:
            log(f"  skipped: {e}")
            db["processed"].append(key)       # demo of another player: do not retry
            save_db(db_path, db)
        except Exception as e:
            import traceback
            log(f"  ERROR: {e}. The demo is left where it is.")
            log("  " + traceback.format_exc().strip().replace("\n", "\n  "))
            failed.add(key)
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)
    # matches that only have a .info file (demo not downloaded): store the Valve scoreboard
    have = {x.get("valve_id") for x in db["matches"]} | {x.get("valve_id") for x in db["lite"]}
    for f in folders:
        p = Path(f)
        if not p.is_dir():
            continue
        for ip in sorted(p.glob("*.dem.info")):
            stem = ip.name[: -len(".dem.info")]
            if any((p / (stem + e)).exists() for e in EXTS):
                continue                        # the demo exists: the loop above handles it
            try:
                lite = lite_from_info(ip, db["steamid"])
            except Exception as e:
                log(f"  .info unreadable: {ip.name} ({e})")
                continue
            if not lite or lite["valve_id"] in have:
                continue
            db["lite"].append(lite)
            db["lite"].sort(key=lambda x: x.get("played", ""))
            have.add(lite["valve_id"])
            new += 1
            s = lite["score"]
            log(f"Match without a demo added from the scoreboard: {lite['played'][:10]} {s['us']}-{s['them']} ({lite['k']}/{lite['a']}/{lite['d']}).")
            save_db(db_path, db)
            write_html(db, html_path)
    return new


def main():
    ap = argparse.ArgumentParser(description="Analizza le demo CS2 di una cartella e aggiorna la dashboard locale.")
    ap.add_argument("--folder", action="append", help="folder with demos (repeatable). Default: the CS2 replays folder")
    ap.add_argument("--steamid", default=None, help="your SteamID64 (default: the one already in the archive)")
    ap.add_argument("--db", default=str(HERE / "cs_data.json"), help="match archive")
    ap.add_argument("--html", default=str(HERE / "cs_coach.html"), help="dashboard file to generate")
    ap.add_argument("--delete", action="store_true", help="delete each demo after parsing it")
    ap.add_argument("--watch", action="store_true", help="keep running and check the folder every --interval seconds")
    ap.add_argument("--interval", type=int, default=120)
    a = ap.parse_args()

    db_path, html_path = Path(a.db), Path(a.html)
    db = load_db(db_path, a.steamid)
    if not db.get("steamid"):
        db["steamid"] = DEFAULT_STEAMID
    if not db["steamid"]:
        sys.exit("Manca lo SteamID. Esempio: python cs_coach.py --steamid 7656119XXXXXXXXXX --folder \"C:\\demo\"")
    folders = a.folder or [DEFAULT_FOLDER]
    failed = set()
    log(f"Archive: {db_path} ({len(db['matches'])} with demo, {len(db['lite'])} scoreboard only). Folders: {', '.join(folders)}")
    n = process(folders, db, db_path, html_path, a.delete, failed)
    write_html(db, html_path)      # always: keeps the dashboard in sync with template updates
    log(f"Done: {n} new matches. Dashboard: {html_path}")
    while a.watch:
        try:
            time.sleep(a.interval)
            n = process(folders, db, db_path, html_path, a.delete, failed)
            if n:
                log(f"{n} new matches. Dashboard updated: {html_path}")
        except KeyboardInterrupt:
            break


if __name__ == "__main__":
    main()
