# CS Coach

A Windows desktop app that analyzes your own Counter-Strike 2 matches (Premier, FACEIT, Competitive) from the demo files. It opens in its own window, reads new demos automatically, and shows interactive statistics, death-by-death advice, map heatmaps and a round-by-round economy review. Everything runs locally: nothing is uploaded anywhere.

> The interface and the coaching texts are currently in Italian. The project documentation is in English.

## Features

- Per-match and overall statistics (rating estimate, ADR, K/D, KAST, headshot %, opening duels, trades, clutches).
- Map views with kills, deaths and heatmaps, zoom and pan, and a table of the zones where fights happen most.
- Context-aware death analysis: what happened in the 12 seconds before and 6 seconds after each death, nearby teammates, trade chances, and utility advice.
- Economy review per match: buy type (pistol, eco, semi/force, full buy), loss-bonus streak, unspent money, force-buy chains, anti-eco play, and, for demos parsed with this version, the exact weapon, armor and grenades bought each round.
- Optional auto-delete of each demo after it has been parsed, so your disk stays clean while your stats are kept.

## Download and use

1. Download `CSCoach-Windows.zip` from the **Releases** page and unzip it anywhere.
2. Run `CSCoach.exe`. On first launch it asks for your **SteamID64** (17 digits, see steamid.io), the **demo folder** (usually the `replays` folder inside the CS2 install) and whether to delete demos after analysis.
3. From then on it parses new demos by itself and checks again every two minutes.

Your data stays in the same folder (`cs_data.json`). To uninstall, delete the folder.

## Run from source

Requires Python 3.10–3.13 (`demoparser2` does not support newer versions yet).

```
pip install -r requirements.txt
python cs_coach_app.py
```

Command line (no window):

```
python cs_coach.py --steamid YOUR_STEAMID64 --folder "C:\path\to\demos"
```

To build the executable yourself, run `Crea_App.bat` (PyInstaller), or use the GitHub Actions workflow in `.github/workflows/build.yml`.

## Disclaimer

This is an unofficial, fan-made tool. It is not affiliated with, endorsed by or sponsored by Valve Corporation. Counter-Strike and CS2 are trademarks of Valve.

The executable is **not code-signed**, so Windows SmartScreen may warn you ("unrecognized app") and some antivirus programs may flag programs built with PyInstaller by mistake. You can always read the source code here and build the app yourself.

**Use it at your own risk.** By downloading, opening or installing any file from this repository you accept that you are solely responsible for what you run on your computer. The software is provided "as is", without warranty of any kind (see the license).

Ratings, KAST and reference values are estimates based on public formulas, not official data. Coaching advice follows public guides and is a suggestion, not a guarantee of results.

## License

Released under the [MIT License](LICENSE).

## Optional: real map geometry (line of sight and cover)

If `awpy` is installed (`pip install awpy`, included in `requirements.txt`), new demos are also analysed with the real collision geometry of the map: how long you were in the enemy's line of sight, how many enemies could see you, whether a teammate could see the enemy, and whether a one-to-two-meter step would have broken the line of sight. The map data (about 50 MB) is downloaded automatically on first use. Without `awpy` everything else still works. Smokes, doors and bullet penetration are not modelled. The prebuilt executable does not bundle `awpy`; run `Avvia_CS_Coach.bat` or `cs_coach.py` to use this feature.
