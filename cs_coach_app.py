#!/usr/bin/env python3
"""CS Coach - applicazione desktop: finestra propria, aggiorna da sola le demo, nessun browser."""
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

FROZEN = getattr(sys, "frozen", False)
BUNDLE = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))      # file incorporati (modello, parser)
APPDIR = Path(sys.executable).resolve().parent if FROZEN else Path(__file__).resolve().parent


def _writable(d):
    try:
        t = d / ".w"
        t.write_text("x")
        t.unlink()
        return True
    except OSError:
        return False


# dati accanto al programma (cosi' porti tutto dove vuoi); se la cartella e' protetta, in %APPDATA%
DATA = APPDIR if _writable(APPDIR) else Path(os.environ.get("APPDATA", str(Path.home()))) / "CSCoach"
DATA.mkdir(parents=True, exist_ok=True)
CFG, DB, HTML, LOGF = DATA / "config.json", DATA / "cs_data.json", DATA / "cs_coach.html", DATA / "cs_coach.log"

_lf = open(LOGF, "a", encoding="utf-8", buffering=1)
sys.stdout = sys.stderr = _lf                       # finestra senza console: tutto nel file di log
sys.path.insert(0, str(BUNDLE))
import cs_coach                                     # noqa: E402

cs_coach.HERE = BUNDLE                              # modello dashboard_template.html incorporato
INTERVAL = 120
STATE = {"win": None, "status": "", "busy": False, "splash": True}

SPLASH = """<!doctype html><meta charset=utf-8><body style="margin:0;display:grid;place-items:center;height:100vh;
background:#0f1720;color:#e6edf3;font:16px Segoe UI,system-ui,sans-serif"><div style="text-align:center;max-width:560px;padding:20px">
<div style="font-size:34px;font-weight:700;letter-spacing:.04em">CS COACH</div>
<div id=s style="margin-top:14px;opacity:.8">Avvio…</div></div>"""


def say(msg):
    STATE["status"] = msg
    w = STATE["win"]
    if w and STATE["splash"]:
        try:
            w.evaluate_js("document.getElementById('s').textContent=" + json.dumps(msg))
        except Exception:
            pass


_orig_log = cs_coach.log
def _log(msg):
    _orig_log(msg)
    say(str(msg).strip()[:160])
cs_coach.log = _log


def load_cfg():
    if CFG.exists():
        try:
            return json.loads(CFG.read_text(encoding="utf-8"))
        except Exception:
            pass
    return None


def guess_replays():
    cands = []
    for drive in "CDEFG":
        for base in (r"Program Files (x86)\Steam", r"Program Files\Steam", r"Steam", r"SteamLibrary", r"Programmi D\Steam"):
            cands.append(Path(f"{drive}:\\") / base / "steamapps" / "common" / "Counter-Strike Global Offensive" / "game" / "csgo" / "replays")
    return next((str(c) for c in cands if c.is_dir()), "")


def first_run():
    """Prima configurazione: SteamID64 e cartella demo (finestre semplici)."""
    import tkinter as tk
    from tkinter import filedialog, messagebox, simpledialog
    root = tk.Tk()
    root.withdraw()
    sid = ""
    if DB.exists():
        try:
            sid = json.loads(DB.read_text(encoding="utf-8")).get("steamid") or ""
        except Exception:
            pass
    while not (sid.isdigit() and len(sid) == 17):
        sid = (simpledialog.askstring("CS Coach", "Il tuo SteamID64 (17 cifre, lo trovi su steamid.io):", parent=root) or "").strip()
        if not sid:
            sys.exit(0)
    messagebox.showinfo("CS Coach", "Ora scegli la cartella dove arrivano le demo (di solito 'replays' dentro la cartella di CS2).")
    folder = filedialog.askdirectory(title="Cartella delle demo", initialdir=guess_replays() or str(Path.home()))
    if not folder:
        sys.exit(0)
    delete = messagebox.askyesno("CS Coach", "Cancellare ogni demo dopo l'analisi?\n(Le statistiche restano, si libera spazio sul disco.)")
    root.destroy()
    cfg = {"steamid": sid, "folders": [folder], "delete": bool(delete)}
    CFG.write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding="utf-8")
    return cfg


def update(cfg):
    """Cerca demo nuove, le analizza, rigenera la dashboard. Ritorna il numero di partite nuove."""
    if STATE["busy"]:
        return 0
    STATE["busy"] = True
    try:
        db = cs_coach.load_db(DB, cfg["steamid"])
        if not db.get("steamid"):
            db["steamid"] = cfg["steamid"]
        n = cs_coach.process(cfg["folders"], db, DB, HTML, cfg.get("delete", False), set())
        cs_coach.write_html(db, HTML)
        say(f"Pronto: {n} partite nuove" if n else "Pronto")
        return n
    except SystemExit as e:
        say(str(e))
        return 0
    except Exception as e:
        print("ERRORE", repr(e))
        say("Errore: " + str(e)[:120])
        return 0
    finally:
        STATE["busy"] = False


def show_dashboard():
    w = STATE["win"]
    STATE["splash"] = False
    w.load_url(HTML.as_uri())


def worker(cfg):
    n = update(cfg)
    if HTML.exists():
        show_dashboard()
    else:
        say("Dashboard non creata: guarda cs_coach.log")
    while True:
        time.sleep(INTERVAL)
        if update(cfg):
            show_dashboard()


def main():
    import webview
    cfg = load_cfg() or first_run()
    cfg.setdefault("folders", [])
    win = webview.create_window("CS Coach", html=SPLASH, width=1320, height=860, min_size=(900, 600))
    STATE["win"] = win

    def refresh_now():
        threading.Thread(target=lambda: (update(cfg) , show_dashboard()), daemon=True).start()

    def open_cfg():
        try:
            os.startfile(str(CFG))
        except Exception:
            subprocess.Popen(["notepad", str(CFG)])

    def open_log():
        try:
            os.startfile(str(LOGF))
        except Exception:
            subprocess.Popen(["notepad", str(LOGF)])

    from webview.menu import Menu, MenuAction
    menu = [Menu("CS Coach", [MenuAction("Aggiorna ora", refresh_now),
                              MenuAction("Impostazioni (cartella demo, SteamID)", open_cfg),
                              MenuAction("Registro attività", open_log)])]
    webview.start(lambda: worker(cfg), menu=menu)


if __name__ == "__main__":
    main()
