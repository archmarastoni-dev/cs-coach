#!/usr/bin/env python3
"""CS Coach - desktop app: own window, picks up new demos by itself, no browser needed."""
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

FROZEN = getattr(sys, "frozen", False)
try:
    SCRIPT = str(Path(__file__).resolve())
except NameError:
    SCRIPT = str(Path(sys.argv[0]).resolve()) if sys.argv and sys.argv[0] else ""
_SRC = Path(SCRIPT).parent if SCRIPT else Path.cwd()
BUNDLE = Path(sys._MEIPASS) if hasattr(sys, "_MEIPASS") else _SRC                # bundled files (template, parser)
APPDIR = Path(sys.executable).resolve().parent if FROZEN else _SRC


def _writable(d):
    try:
        t = d / ".w"
        t.write_text("x")
        t.unlink()
        return True
    except OSError:
        return False


# data lives next to the program (portable); if that folder is read-only, use %APPDATA%
DATA = APPDIR if _writable(APPDIR) else Path(os.environ.get("APPDATA", str(Path.home()))) / "CSCoach"
DATA.mkdir(parents=True, exist_ok=True)
CFG, DB, HTML, LOGF = DATA / "config.json", DATA / "cs_data.json", DATA / "cs_coach.html", DATA / "cs_coach.log"

_lf = open(LOGF, "a", encoding="utf-8", buffering=1)
sys.stdout = sys.stderr = _lf                       # windowed app without a console: everything goes to the log file
print("=== avvio", time.strftime("%Y-%m-%d %H:%M:%S"), "pid", os.getpid(), "frozen", FROZEN, "python", sys.version.split()[0],
      "\n    script", SCRIPT, "\n    bundle", BUNDLE, "\n    dati", DATA, "\n    html", HTML, "args", sys.argv[1:])
sys.path.insert(0, str(BUNDLE))
import cs_coach                                     # noqa: E402

cs_coach.HERE = BUNDLE                              # bundled dashboard_template.html
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
    """First-run setup: SteamID64 and demo folder (simple dialogs)."""
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


def do_update(cfg):
    """Look for new demos, parse them and rebuild the dashboard. Returns the number of new matches."""
    db = cs_coach.load_db(DB, cfg["steamid"])
    if not db.get("steamid"):
        db["steamid"] = cfg["steamid"]
    n = cs_coach.process(cfg["folders"], db, DB, HTML, cfg.get("delete", False), set())
    cs_coach.write_html(db, HTML)
    return n


def child_update():
    """Runs in a separate low-priority process (see update): parsing a demo is heavy and must never freeze the window."""
    cfg = load_cfg()
    if not cfg:
        return 1
    cfg.setdefault("folders", [])
    try:
        return 10 if do_update(cfg) else 0
    except SystemExit as e:
        print(e)
        return 0
    except Exception as e:
        import traceback
        print("ERROR", repr(e), traceback.format_exc())
        return 1


def update(cfg):
    """Parse new demos in a child process (so the window stays responsive). Returns True if there are new matches."""
    if STATE["busy"]:
        return 0
    STATE["busy"] = True
    try:
        say("Controllo le demo…")
        n = None
        try:
            cmd = [sys.executable] + ([] if FROZEN else [SCRIPT]) + ["--update"]
            flags = (0x00004000 | 0x08000000) if os.name == "nt" else 0      # BELOW_NORMAL_PRIORITY_CLASS | CREATE_NO_WINDOW
            r = subprocess.run(cmd, creationflags=flags, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if r.returncode in (0, 10):
                n = 1 if r.returncode == 10 else 0
            else:
                print("child process failed, code", r.returncode, "- working in this process instead")
        except Exception as e:
            print("cannot start the child process (" + repr(e) + ") - working in this process instead")
        if n is None:                                   # fallback: same work inside the app
            n = 1 if do_update(cfg) else 0
        say("Pronto: ci sono partite nuove" if n else "Pronto")
        return n
    except Exception as e:
        import traceback
        print("ERROR", repr(e), traceback.format_exc())
        say("Errore: " + str(e)[:120])
        return 0
    finally:
        STATE["busy"] = False


def show_dashboard():
    w = STATE["win"]
    for _ in range(20):                                 # the file may be replaced a moment ago: wait for it
        if HTML.exists():
            break
        time.sleep(0.25)
    else:
        say("Dashboard non trovata: guarda il registro attività (menu CS Coach)")
        print("show_dashboard: file mancante", HTML)
        return
    STATE["splash"] = False
    print("carico", HTML.as_uri())
    w.load_url(HTML.as_uri() + "?app=1")        # "?app=1": the dashboard then manages its own back/forward history


def set_icon():
    """Window / taskbar icon (Windows): the icon file is bundled next to the program."""
    ico = BUNDLE / "icona_statistiche.ico"
    try:
        import System.Drawing as SD                      # provided by pythonnet, which pywebview uses on Windows
        STATE["win"].native.Icon = SD.Icon(str(ico))
    except Exception as e:
        print("icon not set:", repr(e))


def worker(cfg):
  try:
    _worker(cfg)
  except Exception:
    import traceback
    print("ERROR worker", traceback.format_exc())
    say("Errore interno: guarda cs_coach.log")


def _worker(cfg):
    n = update(cfg)
    if HTML.exists():
        show_dashboard()
    else:
        say("Dashboard non creata: guarda cs_coach.log")
    while True:
        time.sleep(INTERVAL)
        if update(cfg):
            show_dashboard()


_LOCK = None


def single_instance():
    """Only one app at a time: two copies would write the same dashboard/archive/log and collide."""
    global _LOCK
    import socket
    try:
        _LOCK = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        _LOCK.bind(("127.0.0.1", 47931))
        return True
    except OSError:
        return False


def main():
    import webview
    if not single_instance():
        print("un'altra copia di CS Coach è già aperta: esco")
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(0, "CS Coach è già aperto (guarda la barra delle applicazioni o chiudi le copie dal Gestione attività).", "CS Coach", 0x40)
        except Exception:
            pass
        return
    cfg = load_cfg() or first_run()
    cfg.setdefault("folders", [])
    win = webview.create_window("CS Coach", html=SPLASH, width=1320, height=860, min_size=(900, 600))
    STATE["win"] = win
    win.events.shown += set_icon

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
    if "--update" in sys.argv:
        sys.exit(child_update())
    main()
