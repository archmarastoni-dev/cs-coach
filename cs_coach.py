#!/usr/bin/env python3
"""
CS Coach - analizza in automatico le demo di una cartella e aggiorna la dashboard locale.

Cosa fa, ogni volta che lo lanci:
  1. cerca demo nuove nelle cartelle indicate (.dem, .dem.bz2, .dem.gz, .dem.zst)
  2. le analizza e aggiunge le partite al tuo archivio (cs_data.json)
  3. con --delete cancella la demo dopo averla analizzata (l'archivio resta, il PC no)
  4. rigenera la dashboard cs_coach.html, che apri con un doppio clic: non serve CS aperto

Esempi (Windows, da Prompt dei comandi nella cartella dello script):
  python cs_coach.py --delete
  python cs_coach.py --delete --watch              (resta in attesa e analizza le demo appena arrivano)
  python cs_coach.py --folder "D:\\altre demo" --folder "D:\\Programmi D\\Steam\\...\\replays"

Installazione una tantum:   pip install demoparser2 pandas      (e, per i file .zst: pip install zstandard)
Servono nella stessa cartella: cs_parser.py e dashboard_template.html
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
EXTS = (".dem", ".dem.bz2", ".dem.gz", ".dem.zst")


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
                sys.exit(f"L'archivio {path.name} è di un altro SteamID ({db.get('steamid')}). Usa un altro --db.")
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
        log("ATTENZIONE: dashboard_template.html non trovato accanto allo script, dashboard non aggiornata.")
        return
    public = {k: v for k, v in db.items() if k != "processed"}
    blob = json.dumps(public, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = tpl.read_text(encoding="utf-8")
    html, n = re.subn(r"/\*DATA_START\*/.*?/\*DATA_END\*/", lambda m: "/*DATA_START*/" + blob + "/*DATA_END*/", html, count=1, flags=re.S)
    if n != 1:
        log("ATTENZIONE: il modello della dashboard non ha i marcatori attesi.")
        return
    tmp = html_path.with_suffix(".tmp")
    tmp.write_text(html, encoding="utf-8")
    os.replace(tmp, html_path)


def is_settled(p):
    """True se il file non sta più crescendo (download finito)."""
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
            log(f"Cartella non trovata: {f}")
            continue
        for x in sorted(p.iterdir()):
            if x.is_file() and x.name.lower().endswith(EXTS):
                out.append(x)
    return out


def decompress(src, tmpdir):
    name = src.name
    low = name.lower()
    dst = Path(tmpdir) / (name.rsplit(".", 1)[0] if not low.endswith(".dem") else name)
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
            raise RuntimeError("Per i file .zst installa: pip install zstandard")
        with open(src, "rb") as a, open(dst, "wb") as b:
            zstandard.ZstdDecompressor().copy_stream(a, b)
    else:
        return src
    return dst


def needs_context(db, src):
    """True se la partita e' in archivio ma senza il dettaglio delle morti (analizzata con la versione vecchia)."""
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
        if (key in db["processed"] and not redo) or key in failed:
            if delete and key in db["processed"]:
                try:
                    src.unlink()
                    log(f"Eliminata (già analizzata): {src.name}")
                except OSError as e:
                    log(f"Non riesco a eliminare {src.name}: {e}")
            continue
        if not is_settled(src):
            log(f"Download ancora in corso, salto per ora: {src.name}")
            continue
        log(f"Analizzo {src.name} ...")
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
                    log(f"  .info non leggibile ({e}), uso la data del file.")
            known = {x.get("fp") for x in db["matches"]} | {x["id"] for x in db["matches"]} | {x.get("valve_id") for x in db["matches"]}
            if redo:
                old = next(x for x in db["matches"] if x.get("id") == m["id"])
                for k in ("played", "valve_id", "added"):
                    if old.get(k) and not m.get(k):
                        m[k] = old[k]
                db["matches"][db["matches"].index(old)] = m
                log("  aggiornata con il dettaglio delle morti.")
                new += 1
            elif m["fp"] in known or m["id"] in known or (m.get("valve_id") and m["valve_id"] in known):
                log("  già presente nell'archivio (stessa partita), non la aggiungo.")
            else:
                db["matches"].append(m)
                db["matches"].sort(key=lambda x: (x.get("played", ""), x["patch"], x.get("added", "")))
                if m.get("valve_id"):
                    db["lite"] = [l for l in db["lite"] if l.get("valve_id") != m["valve_id"]]
                new += 1
                s = m["score"]
                log(f"  {m['map']} {s['us']}-{s['them']} aggiunta all'archivio.")
            if key not in db["processed"]:
                db["processed"].append(key)
            save_db(db_path, db)
            write_html(db, html_path)
            if delete:
                try:
                    src.unlink()
                    log("  demo eliminata dal disco.")
                except OSError as e:
                    log(f"  non riesco a eliminare la demo: {e}")
        except SystemExit as e:
            log(f"  saltata: {e}")
            db["processed"].append(key)       # demo di un altro giocatore: non riprovare
            save_db(db_path, db)
        except Exception as e:
            log(f"  ERRORE: {e}. La demo resta dov'è.")
            failed.add(key)
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)
    # partite di cui esiste solo il .info (demo non scaricata): salvo il tabellone Valve
    have = {x.get("valve_id") for x in db["matches"]} | {x.get("valve_id") for x in db["lite"]}
    for f in folders:
        p = Path(f)
        if not p.is_dir():
            continue
        for ip in sorted(p.glob("*.dem.info")):
            stem = ip.name[: -len(".dem.info")]
            if any((p / (stem + e)).exists() for e in EXTS):
                continue                        # la demo c'è: la analizza il ciclo sopra
            try:
                lite = lite_from_info(ip, db["steamid"])
            except Exception as e:
                log(f"  .info non leggibile: {ip.name} ({e})")
                continue
            if not lite or lite["valve_id"] in have:
                continue
            db["lite"].append(lite)
            db["lite"].sort(key=lambda x: x.get("played", ""))
            have.add(lite["valve_id"])
            new += 1
            s = lite["score"]
            log(f"Partita senza demo aggiunta dal tabellone: {lite['played'][:10]} {s['us']}-{s['them']} ({lite['k']}/{lite['a']}/{lite['d']}).")
            save_db(db_path, db)
            write_html(db, html_path)
    return new


def main():
    ap = argparse.ArgumentParser(description="Analizza le demo CS2 di una cartella e aggiorna la dashboard locale.")
    ap.add_argument("--folder", action="append", help="cartella con le demo (si può ripetere). Predefinita: la cartella replays di CS2")
    ap.add_argument("--steamid", default=None, help="il tuo SteamID64 (predefinito: quello già nell'archivio)")
    ap.add_argument("--db", default=str(HERE / "cs_data.json"), help="archivio delle partite")
    ap.add_argument("--html", default=str(HERE / "cs_coach.html"), help="dashboard da generare")
    ap.add_argument("--delete", action="store_true", help="elimina ogni demo dopo averla analizzata")
    ap.add_argument("--watch", action="store_true", help="resta in esecuzione e controlla la cartella ogni --interval secondi")
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
    log(f"Archivio: {db_path} ({len(db['matches'])} con demo, {len(db['lite'])} solo tabellone). Cartelle: {', '.join(folders)}")
    n = process(folders, db, db_path, html_path, a.delete, failed)
    write_html(db, html_path)      # sempre: cosi' la dashboard segue anche gli aggiornamenti del modello
    log(f"Fatto: {n} partite nuove. Dashboard: {html_path}")
    while a.watch:
        try:
            time.sleep(a.interval)
            n = process(folders, db, db_path, html_path, a.delete, failed)
            if n:
                log(f"{n} partite nuove. Dashboard aggiornata: {html_path}")
        except KeyboardInterrupt:
            break


if __name__ == "__main__":
    main()
