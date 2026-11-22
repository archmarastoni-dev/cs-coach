# CS Coach

Analizza le tue partite di CS2 (Premier, FACEIT, Competitivo) a partire dalle demo, in un'app per Windows con finestra propria. Tutto resta sul tuo PC: non viene inviato nulla online.

## Come usarla
1. Scarica `CSCoach-Windows.zip` dalla sezione **Releases** e decomprimila dove vuoi.
2. Apri `CSCoach.exe`. Al primo avvio chiede il tuo **SteamID64** (17 cifre, lo trovi su steamid.io), la **cartella delle demo** (di solito `replays` dentro la cartella di CS2) e se cancellare le demo dopo l'analisi.
3. Da lì in poi analizza da sola le demo nuove e ricontrolla ogni 2 minuti.

I tuoi dati restano nella stessa cartella (`cs_data.json`). Per disinstallare basta cancellare la cartella.

Windows può avvisare "app non riconosciuta" perché l'exe non è firmato: *Ulteriori informazioni → Esegui comunque*.

## Per sviluppatori
Serve Python 3.10–3.13. `pip install -r requirements.txt` e `python cs_coach_app.py`. L'exe si costruisce con GitHub Actions (vedi `.github/workflows/build.yml`) o con `Crea_App.bat`.

Rating, KAST e riferimenti sono stime basate su formule pubbliche, non dati ufficiali.
