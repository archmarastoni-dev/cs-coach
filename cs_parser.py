#!/usr/bin/env python3
"""
CS2 demo parser -> JSON for the "CS Coach" dashboard.

Usage:
    pip install demoparser2 pandas
    python cs_parser.py --steamid YOUR_STEAMID64 --out cs_data.json  demo1.dem demo2.dem ...

The produced JSON is loaded into the dashboard with the "Importa dati" (import) button.
Several runs can be merged: the dashboard recognises matches already present (field id).
"""
import argparse
import hashlib
import json
import math
import os
import sys
from collections import defaultdict

import pandas as pd
try:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cs_geo as _geo
except Exception:
    _geo = None
from demoparser2 import DemoParser

TICKRATE = 64
TRADE_WINDOW = int(5 * TICKRATE)        # 5 seconds for trades
GRENADES = {
    "weapon_smokegrenade": "smoke",
    "weapon_flashbang": "flash",
    "weapon_hegrenade": "he",
    "weapon_molotov": "molotov",
    "weapon_incgrenade": "molotov",
}
GRENADE_DMG = {"hegrenade": "he", "inferno": "molotov"}
HIT_GROUPS = {"head": "Testa", "neck": "Collo", "chest": "Petto", "stomach": "Stomaco", "left_arm": "Braccia", "right_arm": "Braccia", "left_leg": "Gambe", "right_leg": "Gambe", "generic": "Altro"}


WEAPON_ALIAS = {"m4a1_silencer": "m4a1", "usp_silencer": "hkp2000", "knife_t": "knife", "incgrenade": "molotov"}


EVENT_COLS = {
    "bomb_planted": ["tick", "user_steamid", "site"],
    "bomb_defused": ["tick", "user_steamid", "site"],
}


def read_event(p, name, **kw):
    """parse_event that always returns a DataFrame (demoparser2 returns [] when an event never fires)."""
    import pandas as pd
    res = p.parse_event(name, **kw)
    if isinstance(res, pd.DataFrame):
        return res
    cols = EVENT_COLS.get(name, ["tick", "user_steamid", "attacker_steamid", "assister_steamid"])
    return pd.DataFrame(res) if res else pd.DataFrame(columns=cols)


PROJECTILES = {"CSmokeGrenadeProjectile": "smoke", "CFlashbangProjectile": "flash",
               "CHEGrenadeProjectile": "he", "CMolotovProjectile": "molotov"}


def _projectiles(p):
    """One row per thrown grenade: thrower, first/last tick in the air and landing point, per kind."""
    import pandas as pd
    try:
        g = p.parse_grenades()
    except Exception:
        return {}
    if not isinstance(g, pd.DataFrame) or g.empty:
        return {}
    g = g[g["grenade_type"].isin(PROJECTILES) & g["x"].notna()]
    out = {}
    for typ, kind in PROJECTILES.items():
        d = g[g["grenade_type"] == typ].sort_values("tick")
        if d.empty:
            continue
        a = d.groupby("grenade_entity_id").agg(sid=("steamid", "first"), t0=("tick", "min"), t1=("tick", "max"),
                                               x1=("x", "last"), y1=("y", "last")).reset_index()
        a = a.rename(columns={"grenade_entity_id": "eid"})
        a["sid"] = a["sid"].apply(sid)
        out[kind] = a
    return out


REPLAY_HZ = 4              # samples per second in a replay clip
REPLAY_MAX_CLIPS = 8
REPLAY_MAX_SECONDS = 18
UTIL_LIFE = {"smoke": 18, "molotov": 7, "flash": 1, "he": 1}     # seconds the effect stays on the map


def build_replays(p, me_id, kills, deaths, clutches, team_of, names, freeze_end, end_tick, by_round_deaths, util_rows, plants, defuses):
    """Short 2D replay clips of my key moments: positions of all 10 players at REPLAY_HZ plus kills and utility."""
    import pandas as pd
    clutch_rounds = {c["r"]: c for c in clutches}
    per_round = defaultdict(list)
    for e in kills:
        per_round[e["r"]].append(("k", e))
    for e in deaths:
        if not e.get("teamkill"):
            per_round[e["r"]].append(("d", e))
    cands = []
    for r, evs in per_round.items():
        nk = sum(1 for t, _ in evs if t == "k")
        score, why = 0, []
        if nk >= 3:
            score += 100 + 10 * nk; why.append(f"{nk} kill")
        elif nk == 2:
            score += 40; why.append("2 kill")
        if any(t == "k" and e["open"] for t, e in evs):
            score += 60; why.append("primo duello vinto")
        c = clutch_rounds.get(r)
        if c:
            score += 50 + (25 if c["won"] else 0); why.append(f"clutch 1v{c['vs']} {'vinto' if c['won'] else 'perso'}")
        dd = [e for t, e in evs if t == "d"]
        if dd and dd[0]["open"]:
            score += 30; why.append("morto per primo")
        elif dd:
            score += 10; why.append("morto")
        if score:
            cands.append((score, r, " · ".join(why), evs))
    cands.sort(key=lambda x: -x[0])
    chosen = sorted(cands[:REPLAY_MAX_CLIPS], key=lambda x: x[1])
    if not chosen:
        return []
    step = int(TICKRATE / REPLAY_HZ)
    plan = []
    all_ticks = set()
    for score, r, why, evs in chosen:
        ticks = [int(e["tick"]) for _, e in evs]
        t_a = max(freeze_end[r], min(ticks) - 6 * TICKRATE)
        t_b = min(end_tick[r], max(ticks) + 3 * TICKRATE, t_a + REPLAY_MAX_SECONDS * TICKRATE)
        grid = list(range(int(t_a), int(t_b) + 1, step))
        plan.append((r, why, t_a, t_b, grid))
        all_ticks.update(grid)
    df = p.parse_ticks(["X", "Y", "yaw", "health", "team_num"], ticks=sorted(all_ticks))
    df["steamid"] = df["steamid"].apply(sid)
    out = []
    for r, why, t_a, t_b, grid in plan:
        teams = team_of[r]
        my_team = teams.get(me_id)
        sub = df[(df["tick"] >= t_a) & (df["tick"] <= t_b) & (df["steamid"].isin(teams))]
        ids = sorted(teams, key=lambda s_: (s_ != me_id, teams[s_] != my_team, names.get(s_, "")))
        idx = {s_: i for i, s_ in enumerate(ids)}
        frames = {s_: [] for s_ in ids}
        by_tick = {t: g.set_index("steamid") for t, g in sub.groupby("tick")}
        last = {}
        for t in grid:
            g = by_tick.get(t)
            for s_ in ids:
                row = g.loc[s_] if g is not None and s_ in g.index else None
                if row is not None and row["X"] == row["X"]:
                    last[s_] = [int(row["X"]), int(row["Y"]), int(row["yaw"]) if row["yaw"] == row["yaw"] else 0,
                                int(row["health"]) if row["health"] == row["health"] else 0]
                frames[s_].append(last.get(s_, [0, 0, 0, 0]))
        ks = []
        for d in by_round_deaths.get(r, []):
            if t_a <= int(d.tick) <= t_b:
                a, v = sid(d.attacker_steamid), sid(d.user_steamid)
                if v in idx:
                    ks.append({"t": rnd((int(d.tick) - t_a) / TICKRATE, 2), "a": idx.get(a, -1), "v": idx[v],
                               "w": wn(nz(d.weapon, "")), "hs": bool(d.headshot)})
        us = []
        for u in util_rows:
            life = UTIL_LIFE.get(u["kind"], 1)
            if u["r"] == r and t_a - life * TICKRATE <= u["tick"] <= t_b:
                us.append({"t": rnd((u["tick"] - t_a) / TICKRATE, 2), "k": u["kind"], "x": int(u["lx"]), "y": int(u["ly"]), "p": idx.get(u["sid"], -1)})
        bomb = []
        for name_, dfb in (("plant", plants), ("defuse", defuses)):
            for row in dfb.itertuples(index=False):
                if t_a <= int(row.tick) <= t_b:
                    bomb.append({"t": rnd((int(row.tick) - t_a) / TICKRATE, 2), "k": name_})
        out.append({
            "r": r, "why": why, "side": side_name(my_team), "hz": REPLAY_HZ, "t0": rnd((t_a - freeze_end[r]) / TICKRATE, 1),
            "dur": rnd((t_b - t_a) / TICKRATE, 1),
            "ps": [{"n": names.get(s_, str(s_)), "tm": 0 if s_ == me_id else (1 if teams[s_] == my_team else 2), "f": [v for fr in frames[s_] for v in fr]} for s_ in ids],
            "k": ks, "u": us, "b": bomb,
        })
    return out


def wn(w):
    w = str(w or "").replace("weapon_", "")
    return WEAPON_ALIAS.get(w, w)


def nz(v, default=0):
    if v is None:
        return default
    try:
        if isinstance(v, float) and math.isnan(v):
            return default
    except Exception:
        pass
    return v


def sid(v):
    """steamid come stringa ('' se mancante / mondo)."""
    v = nz(v, 0)
    try:
        v = int(v)
    except Exception:
        return ""
    return str(v) if v else ""


def rnd(v, n=1):
    return round(float(v), n)


def half_of(r):
    """Side-swap period of a round: 1 and 2 are the regulation halves (MR12); every overtime half is 3 rounds."""
    return 1 if r <= 12 else 2 if r <= 24 else 3 + (r - 25) // 3


def match_complete(wins, losses):
    """True if the match reached a decision: 13 rounds in regulation, then +3 per overtime (16, 19, ...).
    A tie after an overtime counts as finished too. A match that stops earlier was cut short (forfeit, crash)."""
    hi, lo = max(wins, losses), min(wins, losses)
    if hi <= 12:
        return False
    if hi == 13 and lo <= 11:
        return True
    if hi >= 16 and (hi - 16) % 3 == 0 and hi - lo >= 2:
        return True
    return wins == losses and wins >= 15 and (wins - 15) % 3 == 0     # tie after an overtime


def side_name(team_num):
    try:
        return {2: "T", 3: "CT"}.get(int(team_num), "?")
    except (TypeError, ValueError):
        return "?"                           # team unknown (e.g. spectator, coach, bot)


def _norm_item(x):
    return "".join(ch for ch in str(x).lower() if ch.isalnum())


BUY_PROPS = ["armor_value", "has_helmet", "has_defuser", "inventory", "cash_spent_this_round", "start_balance", "balance", "current_equip_value", "team_num"]


def collect_buys(p, rounds, freeze_end, end_tick):
    """What each player holds at the end of the buy phase (freeze end + 22 s, the useful buying time).
    Returns {round: {sid: {inv[], ar, hel, kit, st, sp, mo, eq}}}. Returns {} if anything is unavailable."""
    out = defaultdict(dict)
    try:
        late = {r: min(freeze_end[r] + int(22 * TICKRATE), max(freeze_end[r], end_tick[r] - 1)) for r in rounds}
        ticks = sorted(set(late.values()))
        df = p.parse_ticks(BUY_PROPS, ticks=ticks)
        df["steamid"] = df["steamid"].apply(sid)
        t2r = {tk: r for r, tk in late.items()}
        for row in df.itertuples(index=False):
            r = t2r.get(int(row.tick))
            if r is None or not row.steamid or int(nz(getattr(row, "team_num", 0))) not in (2, 3):
                continue
            inv = getattr(row, "inventory", None)
            inv = [] if inv is None or (isinstance(inv, float)) else [_norm_item(i) for i in list(inv)]
            out[r][row.steamid] = {
                "inv": inv, "ar": int(nz(getattr(row, "armor_value", 0))), "hel": bool(nz(getattr(row, "has_helmet", 0))),
                "kit": bool(nz(getattr(row, "has_defuser", 0))), "st": int(nz(getattr(row, "start_balance", 0))),
                "sp": int(nz(getattr(row, "cash_spent_this_round", 0))), "mo": int(nz(getattr(row, "balance", 0))),
                "eq": int(nz(getattr(row, "current_equip_value", 0))), "tn": int(nz(row.team_num)),
            }
    except Exception as e:  # different library versions: the basic economy stays valid
        print("  (buy detail unavailable:", repr(e)[:90], ")")
        return {}
    return out


def detect_kind(p, server):
    """Match type: FACEIT / ESEA / Premier / Competitiva / Wingman (from the server name or the scoreboard rank type)."""
    sv = (server or "").lower()
    if "faceit" in sv:
        return "FACEIT"
    if "esea" in sv:
        return "ESEA"
    try:
        d = p.parse_ticks(["comp_rank_type"], ticks=[20000])
        vals = [int(v) for v in d["comp_rank_type"].tolist() if v == v]
        t = max(set(vals), key=vals.count) if vals else None
        return {11: "Premier", 12: "Competitiva", 7: "Wingman"}.get(t, "Altro")
    except Exception:
        return "Altro"


def parse_demo(path, me_id):
    p = DemoParser(path)
    header = p.parse_header()
    map_name = header.get("map_name", "unknown")

    # ---------------------------------------------------------------- round structure
    rs = read_event(p, "round_start").sort_values("tick")
    fe = read_event(p, "round_freeze_end").sort_values("tick")
    re_ = read_event(p, "round_end").sort_values("tick")
    re_ = re_[re_["round"].notna()]
    try:
        match_start = int(read_event(p, "begin_new_match")["tick"].max())
    except Exception:
        match_start = None
    played = re_[re_["winner"].notna()]                       # real round ends (the tick-1 placeholder has no winner)
    if match_start is not None and (played["tick"] < match_start).any():
        # A round was played before the match restart: the FACEIT/ESL knife round that decides the sides.
        # The engine's round counter restarts after it, so numbers cannot be paired between events.
        # Drop the knife round and number the real rounds in order of their end tick.
        start_tick, end_tick, winner, reason = {}, {}, {}, {}
        rs_ticks = sorted(int(t) for t in rs["tick"])
        prev_end = int(played[played["tick"] < match_start]["tick"].max())
        real = played[played["tick"] > match_start]
        for n, row in enumerate(real.itertuples(index=False), 1):
            et = int(row.tick)
            cand = [t for t in rs_ticks if prev_end < t < et]
            start_tick[n] = cand[-1] if cand else prev_end
            end_tick[n], winner[n], reason[n] = et, row.winner, row.reason
            prev_end = et
    else:
        rs = rs.drop_duplicates("round")
        start_tick = dict(zip(rs["round"].astype(int), rs["tick"].astype(int)))
        end_tick = dict(zip(re_["round"].astype(int), re_["tick"].astype(int)))
        winner = dict(zip(re_["round"].astype(int), re_["winner"]))
        reason = dict(zip(re_["round"].astype(int), re_["reason"]))
    rounds = sorted(r for r in end_tick if r in start_tick)
    # freeze_end per round: first freeze_end after round_start
    fe_ticks = sorted(fe["tick"].astype(int).tolist())
    freeze_end = {}
    for r in rounds:
        cand = [t for t in fe_ticks if t >= start_tick[r]]
        freeze_end[r] = cand[0] if cand else start_tick[r]

    starts = [start_tick[r] for r in rounds]

    def round_of(tick):
        # an event after round_end (e.g. a kill after the defuse) counts for that round,
        # as on the Valve scoreboard: it applies until the next round starts
        for i, r in enumerate(rounds):
            nxt = starts[i + 1] if i + 1 < len(rounds) else 10 ** 12
            if starts[i] <= tick < nxt:
                return r
        return None

    # ---------------------------------------------------------------- team / economy per round
    tdf = p.parse_ticks(["team_num", "current_equip_value", "balance"], ticks=[freeze_end[r] for r in rounds])
    tdf["steamid"] = tdf["steamid"].apply(sid)
    team_of = defaultdict(dict)     # round -> sid -> team_num
    equip = defaultdict(dict)
    money = defaultdict(dict)
    names = {}
    tick_to_round = {freeze_end[r]: r for r in rounds}
    for row in tdf.itertuples(index=False):
        r = tick_to_round.get(int(row.tick))
        if r is None or not row.steamid or int(nz(row.team_num)) not in (2, 3):
            continue
        team_of[r][row.steamid] = int(row.team_num)
        equip[r][row.steamid] = int(nz(row.current_equip_value))
        money[r][row.steamid] = int(nz(row.balance))
        names[row.steamid] = row.name
    if me_id not in names:
        raise SystemExit(f"[{os.path.basename(path)}] SteamID {me_id} not present in the demo.")
    buys = collect_buys(p, rounds, freeze_end, end_tick)

    # ---------------------------------------------------------------- events
    deaths = read_event(p, "player_death", player=["X", "Y", "Z"])
    hurts = read_event(p, "player_hurt")
    blinds = read_event(p, "player_blind")
    fires = read_event(p, "weapon_fire")
    det = {
        "smoke": read_event(p, "smokegrenade_detonate"),
        "flash": read_event(p, "flashbang_detonate"),
        "he": read_event(p, "hegrenade_detonate"),
        "molotov": read_event(p, "inferno_startburn"),
    }
    plants = read_event(p, "bomb_planted")
    defuses = read_event(p, "bomb_defused")

    for df in (deaths, hurts, blinds, fires):
        for col in ("attacker_steamid", "user_steamid", "assister_steamid"):
            if col in df.columns:
                df[col] = df[col].apply(sid)
    for d in det.values():
        d["user_steamid"] = d["user_steamid"].apply(sid)
    plants["user_steamid"] = plants["user_steamid"].apply(sid)
    defuses["user_steamid"] = defuses["user_steamid"].apply(sid)

    deaths = deaths.sort_values("tick")
    deaths["round"] = deaths["tick"].apply(round_of)
    deaths = deaths[deaths["round"].notna()].copy()
    deaths["round"] = deaths["round"].astype(int)
    hurts["round"] = hurts["tick"].apply(round_of)
    hurts = hurts[hurts["round"].notna()].copy()
    hurts["round"] = hurts["round"].astype(int)
    blinds["round"] = blinds["tick"].apply(round_of)
    blinds = blinds[blinds["round"].notna()].copy()
    blinds["round"] = blinds["round"].astype(int)
    fires["round"] = fires["tick"].apply(round_of)
    fires = fires[fires["round"].notna()].copy()
    fires["round"] = fires["round"].astype(int)

    players = sorted(names)

    # per-player stats structure
    def blank():
        return defaultdict(float)
    S = {s: blank() for s in players}
    side_stats = {s: {"CT": blank(), "T": blank()} for s in players}
    rounds_played = defaultdict(int)
    per_round_me = []

    # ---------------------------------------------------------------- trade detection
    death_rows = list(deaths.itertuples(index=False))
    by_round_deaths = defaultdict(list)
    for d in death_rows:
        by_round_deaths[d.round].append(d)

    traded_victims = set()       # (round, tick, victim)
    trade_kills = defaultdict(int)
    for r, lst in by_round_deaths.items():
        for i, d in enumerate(lst):
            v, k = d.user_steamid, d.attacker_steamid
            if not k or k == v:
                continue
            tv = team_of[r].get(v)
            tk = team_of[r].get(k)
            if tv is None or tk is None or tv == tk:
                continue
            for d2 in lst[i + 1:]:
                if d2.tick - d.tick > TRADE_WINDOW:
                    break
                if d2.user_steamid == k and d2.attacker_steamid and team_of[r].get(d2.attacker_steamid) == tv:
                    traded_victims.add((r, int(d.tick), v))
                    trade_kills[d2.attacker_steamid] += 1
                    S[d2.attacker_steamid]["trade_kills"] += 1
                    side_stats[d2.attacker_steamid][side_name(tv)]["trade_kills"] += 1
                    break

    # ---------------------------------------------------------------- per-round loop
    me_kills_ev, me_deaths_ev = [], []
    clutch_list = []
    for r in rounds:
        t0 = freeze_end[r]
        teams = team_of[r]
        rd_deaths = by_round_deaths.get(r, [])
        rd_hurts = hurts[hurts["round"] == r]
        win_side = winner.get(r)             # 'CT' / 'T'
        kills_in_round = defaultdict(int)
        involved = defaultdict(lambda: {"k": 0, "a": 0, "d": 0, "tr": 0})
        alive = {s for s in teams}
        first_done = False
        clutch_state = {}

        for s in teams:
            sn = side_name(teams[s])
            rounds_played[s] += 1
            S[s]["rounds"] += 1
            side_stats[s][sn]["rounds"] += 1
            if win_side == sn:
                S[s]["rounds_won"] += 1
                side_stats[s][sn]["rounds_won"] += 1

        for d in rd_deaths:
            v, k, a = d.user_steamid, d.attacker_steamid, d.assister_steamid
            if not v or v not in teams:
                continue                     # victim is not a tracked player this round (bot, coach, rejoin)
            tv = teams.get(v)
            tk = teams.get(k) if k else None
            tsec = (int(d.tick) - t0) / TICKRATE
            is_tk = bool(k) and k != v and tk is not None and tk == tv
            is_suicide = (not k) or k == v
            if v in S:
                S[v]["deaths"] += 1
                side_stats[v][side_name(tv)]["deaths"] += 1
                involved[v]["d"] += 1
                if (r, int(d.tick), v) in traded_victims:
                    involved[v]["tr"] += 1
                    S[v]["deaths_traded"] += 1
            if not is_suicide and not is_tk and k in S and tk is not None:
                kills_in_round[k] += 1
                S[k]["kills"] += 1
                side_stats[k][side_name(tk)]["kills"] += 1
                involved[k]["k"] += 1
                if d.headshot:
                    S[k]["hs"] += 1
                    side_stats[k][side_name(tk)]["hs"] += 1
                if getattr(d, "thrusmoke", False):
                    S[k]["smoke_kills"] += 1
                if getattr(d, "penetrated", 0):
                    S[k]["wallbangs"] += 1
                if getattr(d, "noscope", False):
                    S[k]["noscopes"] += 1
                if getattr(d, "attackerblind", False):
                    S[k]["blind_kills"] += 1
                if not first_done:
                    S[k]["opening_kills"] += 1
                    side_stats[k][side_name(tk)]["opening_kills"] += 1
                    S[v]["opening_deaths"] += 1
                    side_stats[v][side_name(tv)]["opening_deaths"] += 1
            if a and a in S and a != v and teams.get(a) is not None and teams.get(a) != tv:
                S[a]["assists"] += 1
                involved[a]["a"] += 1
                if getattr(d, "assistedflash", False):
                    S[a]["flash_assists"] += 1
            first_done = True
            alive.discard(v)

            # clutch tracking (after the death)
            for team in (2, 3):
                mates = [s for s in alive if teams.get(s) == team]
                foes = [s for s in alive if teams.get(s) not in (None, team)]
                if len(mates) == 1 and len(foes) >= 1 and team not in clutch_state:
                    clutch_state[team] = (mates[0], len(foes))

            # events with coordinates for me
            if not is_suicide and not is_tk:
                base = {
                    "r": r, "t": rnd(tsec), "tick": int(d.tick), "ksid": k, "vsid": v, "w": wn(nz(d.weapon, "")), "hs": bool(d.headshot),
                    "dist": rnd(nz(d.distance), 1), "ax": rnd(nz(d.attacker_X), 0), "ay": rnd(nz(d.attacker_Y), 0),
                    "vx": rnd(nz(d.user_X), 0), "vy": rnd(nz(d.user_Y), 0),
                    "wb": bool(nz(d.penetrated, 0)), "sm": bool(nz(d.thrusmoke, False)),
                    "blind": bool(nz(d.attackerblind, False)), "air": bool(nz(d.attackerinair, False)),
                    "ns": bool(nz(d.noscope, False)),
                    "open": d is rd_deaths[0],
                    "side": side_name(tk),
                }
                if k == me_id:
                    me_kills_ev.append({**base, "victim": names.get(v, v)})
                if v == me_id:
                    me_deaths_ev.append({**base, "killer": names.get(k, k), "traded": (r, int(d.tick), v) in traded_victims,
                                          "side": side_name(tv)})
            elif v == me_id:
                me_deaths_ev.append({
                    "r": r, "t": rnd(tsec), "tick": int(d.tick), "ksid": "", "w": wn(nz(d.weapon, "")), "hs": False, "dist": 0,
                    "ax": 0, "ay": 0, "vx": rnd(nz(d.user_X), 0), "vy": rnd(nz(d.user_Y), 0), "wb": False, "sm": False,
                    "blind": False, "air": False, "ns": False, "open": d is rd_deaths[0],
                    "side": side_name(tv), "killer": "(compagno/mondo)", "traded": False, "teamkill": True,
                })

        # multi-kill, KAST, clutch result
        for s in teams:
            n = kills_in_round[s]
            if n >= 2:
                S[s][f"mk{min(n,5)}"] += 1
            inv = involved[s]
            survived = s in alive
            if inv["k"] or inv["a"] or survived or inv["tr"]:
                S[s]["kast"] += 1
                side_stats[s][side_name(teams[s])]["kast"] += 1
            if survived:
                S[s]["survived"] += 1
        for team, (pl, vs) in clutch_state.items():
            won = (win_side == side_name(team)) and (pl in alive)
            S[pl][f"clutch_att_{vs if vs < 5 else 5}"] += 1
            S[pl]["clutch_att"] += 1
            if won:
                S[pl][f"clutch_won_{vs if vs < 5 else 5}"] += 1
                S[pl]["clutch_won"] += 1
            if pl == me_id:
                clutch_list.append({"r": r, "vs": vs, "won": bool(won)})

        # round damage
        r_dmg = defaultdict(float)
        for h in rd_hurts.itertuples(index=False):
            a, v = h.attacker_steamid, h.user_steamid
            if not a or a == v or a not in S:
                continue
            ta, tv = teams.get(a), teams.get(v)
            if ta is None or tv is None:
                continue
            dm = float(nz(h.dmg_health))
            w = str(nz(h.weapon, ""))
            if ta == tv:
                S[a]["team_damage"] += dm
                continue
            r_dmg[a] += dm
            S[a]["damage"] += dm
            side_stats[a][side_name(ta)]["damage"] += dm
            if w in GRENADE_DMG:
                S[a][f"dmg_{GRENADE_DMG[w]}"] += dm

        # round row for me
        if me_id in teams:
            me_side = side_name(teams[me_id])
            invm = involved[me_id]
            per_round_me.append({
                "r": r, "side": me_side, "won": win_side == me_side, "reason": reason.get(r, ""),
                "k": kills_in_round[me_id], "a": invm["a"], "d": invm["d"], "dmg": rnd(r_dmg[me_id], 0),
                "survived": me_id in alive, "traded": bool(invm["tr"]),
                "equip": equip[r].get(me_id, 0), "money": money[r].get(me_id, 0),
                "team_equip": int(sum(v for s, v in equip[r].items() if teams.get(s) == teams[me_id])),
                "enemy_equip": int(sum(v for s, v in equip[r].items() if teams.get(s) != teams[me_id])),
                "len": rnd((end_tick[r] - freeze_end[r]) / TICKRATE),
                "half": half_of(r),
                "ot": r > 24,
            })
            bm = buys.get(r, {}).get(me_id)
            if bm:
                tmn = teams[me_id]
                per_round_me[-1]["buy"] = {
                    "inv": bm["inv"], "ar": bm["ar"], "hel": bm["hel"], "kit": bm["kit"], "st": bm["st"], "sp": bm["sp"], "mo": bm["mo"],
                    "tm": [[v["eq"], v["mo"]] for s2, v in buys[r].items() if s2 != me_id and v["tn"] == tmn],
                    "en": [v["eq"] for s2, v in buys[r].items() if v["tn"] != tmn],
                }

    # ---------------------------------------------------------------- flash / blind
    for b in blinds.itertuples(index=False):
        a, v, r = b.attacker_steamid, b.user_steamid, b.round
        if not a or a not in S or v not in S or a == v:
            continue
        ta, tv = team_of[r].get(a), team_of[r].get(v)
        if ta is None or tv is None:
            continue
        dur = float(nz(b.blind_duration))
        if ta == tv:
            S[a]["team_flashed"] += 1
            S[a]["team_flash_time"] += dur
        elif dur >= 1.0:
            S[a]["enemies_flashed"] += 1
            S[a]["enemy_flash_time"] += dur

    # ---------------------------------------------------------------- utility (throws with origin/landing)
    # Projectile entities (parse_grenades) give the exact throw tick and the exact landing point of every
    # grenade, so each detonation can be tied to the right throw even when several were in the air at once.
    proj = _projectiles(p)
    used = set()
    util_rows = []
    for kind, df in det.items():
        df = df.sort_values("tick")
        pk = proj.get(kind)
        for e in df.itertuples(index=False):
            if e.user_steamid not in S:
                continue
            r = round_of(int(e.tick))
            if r is None:
                continue
            ft = None
            if pk is not None:
                c = pk[(pk["sid"] == e.user_steamid) & (pk["t1"] >= e.tick - 4 * TICKRATE) & (pk["t0"] <= e.tick)]
                c = c[~c["eid"].isin(used)]
                if len(c):
                    dist = ((c["x1"] - float(e.x)) ** 2 + (c["y1"] - float(e.y)) ** 2) ** 0.5
                    j = dist.idxmin()
                    if dist[j] <= 250:                         # the landing must coincide with the detonation
                        used.add(int(c.loc[j, "eid"]))
                        ft = int(c.loc[j, "t0"])
            S[e.user_steamid][f"thrown_{kind}"] += 1
            teams = team_of[r]
            sd = side_name(teams.get(e.user_steamid, 0))
            util_rows.append({"sid": e.user_steamid, "kind": kind, "r": r, "side": sd,
                               "t": rnd((int(e.tick) - freeze_end[r]) / TICKRATE),
                               "lx": rnd(e.x, 0), "ly": rnd(e.y, 0), "lz": rnd(e.z, 0), "fire_tick": ft, "tick": int(e.tick)})
    # throw position (only for me)
    me_util = [u for u in util_rows if u["sid"] == me_id]
    ticks_needed = sorted({u["fire_tick"] for u in me_util if u["fire_tick"]})
    pos = {}
    if ticks_needed:
        pdf = p.parse_ticks(["X", "Y", "Z", "pitch", "yaw"], ticks=ticks_needed)
        pdf["steamid"] = pdf["steamid"].apply(sid)
        pdf = pdf[pdf["steamid"] == me_id]
        for row in pdf.itertuples(index=False):
            pos[int(row.tick)] = (rnd(row.X, 0), rnd(row.Y, 0), rnd(row.pitch, 1), rnd(row.yaw, 1))
    # outcome of my throws: flashes (enemies/teammates blinded, follow-up kills) and smokes (nearby enemies)
    try:
        _utility_outcomes(p, me_id, me_util, blinds, deaths, team_of, round_of)
    except Exception:
        pass
    me_util_out = []
    for u in me_util:
        o = {k: v for k, v in u.items() if k not in ("sid", "fire_tick", "tick")}
        if u["fire_tick"] and u["fire_tick"] in pos:
            o["ox"], o["oy"], o["pitch"], o["yaw"] = pos[u["fire_tick"]]
            o["fly"] = rnd((u["tick"] - u["fire_tick"]) / TICKRATE, 1)
        me_util_out.append(o)
    # every smoke landing (reference: where other players put them)
    smoke_ref = [{"side": u["side"], "lx": u["lx"], "ly": u["ly"], "t": u["t"], "me": u["sid"] == me_id}
                 for u in util_rows if u["kind"] == "smoke"]

    # ---------------------------------------------------------------- weapons (shots / hits / kills)
    shots = defaultdict(int)
    for f in fires.itertuples(index=False):
        if f.user_steamid == me_id and f.weapon not in GRENADES and wn(f.weapon) not in ("knife", "taser", "c4"):
            shots[wn(f.weapon)] += 1
    weap = defaultdict(lambda: {"shots": 0, "hits": 0, "hs_hits": 0, "dmg": 0.0, "kills": 0, "hs_kills": 0})
    for w, n in shots.items():
        weap[w]["shots"] = n
    hit_zone = defaultdict(int)
    for h in hurts.itertuples(index=False):
        if h.attacker_steamid != me_id or h.user_steamid == me_id:
            continue
        r = h.round
        if team_of[r].get(me_id) == team_of[r].get(h.user_steamid):
            continue
        w = wn(nz(h.weapon, ""))
        if w in GRENADE_DMG or w in ("knife", "world", "taser", "planted_c4"):
            continue
        weap[w]["hits"] += 1
        weap[w]["dmg"] += float(nz(h.dmg_health))
        hg = str(nz(h.hitgroup, "generic"))
        if hg == "head":
            weap[w]["hs_hits"] += 1
        hit_zone[HIT_GROUPS.get(hg, "Altro")] += 1
    for k in me_kills_ev:
        weap[k["w"]]["kills"] += 1
        if k["hs"]:
            weap[k["w"]]["hs_kills"] += 1
    weapons = [{"w": w, **{kk: (rnd(vv, 0) if kk == "dmg" else vv) for kk, vv in d.items()}} for w, d in weap.items()
               if d["shots"] or d["kills"] or d["hits"]]
    weapons.sort(key=lambda x: -(x["kills"] * 1000 + x["shots"]))

    # bomb
    plant_me = int((plants["user_steamid"] == me_id).sum())
    defuse_me = int((defuses["user_steamid"] == me_id).sum())

    # ---------------------------------------------------------------- score
    me_wins = sum(1 for x in per_round_me if x["won"])
    me_loss = sum(1 for x in per_round_me if not x["won"])
    ct_w = sum(1 for x in per_round_me if x["side"] == "CT" and x["won"])
    ct_n = sum(1 for x in per_round_me if x["side"] == "CT")
    t_w = sum(1 for x in per_round_me if x["side"] == "T" and x["won"])
    t_n = sum(1 for x in per_round_me if x["side"] == "T")
    result = "W" if me_wins > me_loss else ("L" if me_wins < me_loss else "D")
    complete = match_complete(me_wins, me_loss)

    # ---------------------------------------------------------------- players
    def player_out(s):
        st = dict(S[s])
        n = max(1, st.get("rounds", 0))
        rounds_n = n
        k, d, a = st.get("kills", 0), st.get("deaths", 0), st.get("assists", 0)
        # HLTV rating 1.0 (approssimato)
        # rounds with 1 kill count 1 (not tracked here) -> standard approximation: use total kills as a proxy
        kill_rating = (k / rounds_n) / 0.679
        surv_rating = ((rounds_n - d) / rounds_n) / 0.317
        # rounds with N kills: derive rounds with 1 kill = kills - sum(N*count_N)
        multi_kills = st.get("mk2", 0) * 2 + st.get("mk3", 0) * 3 + st.get("mk4", 0) * 4 + st.get("mk5", 0) * 5
        one_k = max(0, k - multi_kills)
        rmk = (one_k + 4 * st.get("mk2", 0) + 9 * st.get("mk3", 0) + 16 * st.get("mk4", 0) + 25 * st.get("mk5", 0)) / rounds_n / 1.277
        rating = (kill_rating + 0.7 * surv_rating + rmk) / 2.7
        out = {
            "sid": s, "name": names[s], "team": side_name(team_of[rounds[0]].get(s, 0)) if team_of[rounds[0]].get(s) else "?",
            "mine_team": team_of[rounds[0]].get(s) == team_of[rounds[0]].get(me_id) if rounds else False,
            "rating": rnd(rating, 2),
        }
        for key in ["rounds", "rounds_won", "kills", "deaths", "assists", "hs", "damage", "kast", "survived", "opening_kills",
                    "opening_deaths", "trade_kills", "deaths_traded", "mk2", "mk3", "mk4", "mk5", "clutch_att", "clutch_won",
                    "flash_assists", "enemies_flashed", "enemy_flash_time", "team_flashed", "team_flash_time", "dmg_he",
                    "dmg_molotov", "team_damage", "smoke_kills", "wallbangs", "noscopes", "blind_kills", "thrown_smoke",
                    "thrown_flash", "thrown_he", "thrown_molotov"]:
            v = st.get(key, 0)
            out[key] = rnd(v, 1) if isinstance(v, float) and key in ("enemy_flash_time", "team_flash_time") else int(round(v))
        out["side"] = {sd: {kk: int(round(vv)) for kk, vv in side_stats[s][sd].items()} for sd in ("CT", "T")}
        for c in range(1, 6):
            out[f"clutch_att_{c}"] = int(st.get(f"clutch_att_{c}", 0))
            out[f"clutch_won_{c}"] = int(st.get(f"clutch_won_{c}", 0))
        return out

    plist = [player_out(s) for s in players]
    plist.sort(key=lambda x: (-int(x["mine_team"]), -x["rating"]))

    match_id = hashlib.sha1(f"{os.path.basename(path)}".encode()).hexdigest()[:10]
    # match fingerprint: the same match downloaded under different names gets the same fingerprint
    fp = hashlib.sha1((map_name + "|" + ",".join(sorted(players)) + f"|{me_wins}-{me_loss}|{header.get('patch_version','')}").encode()).hexdigest()[:12]
    # exact identity of this demo: map, the ten players and the raw tick of every round end do not depend on how the demo was read
    sig = hashlib.sha1((map_name + "|" + ",".join(sorted(players)) + "|" + ",".join(str(int(t)) for t in sorted(read_event(p, "round_end")["tick"]))).encode()).hexdigest()[:16]
    me_p = next(x for x in plist if x["sid"] == me_id)
    try:
        ptk = {int(r): int(t) for r, t in zip(plants["round"], plants["tick"]) if r == r} if "round" in plants.columns else {}
        death_context(p, me_id, [e for e in me_deaths_ev if not e.get("teamkill")], team_of, names, ptk, by_round_deaths, det, round_of, map_name, util_rows)
    except Exception as ex:   # the context is an extra: it must never block the analysis
        print(f"  [warning] death context not computed: {ex}")
    mov = None
    try:
        mov = aim_analysis(p, me_id, fires, hurts, me_kills_ev, me_deaths_ev)
    except Exception as ex:
        print(f"  [warning] aim analysis not computed: {ex}")

    replays = []
    try:
        replays = build_replays(p, me_id, me_kills_ev, me_deaths_ev, clutch_list, team_of, names, freeze_end, end_tick,
                                by_round_deaths, util_rows, plants, defuses)
    except Exception as ex:   # an extra: it must never block the analysis
        print(f"  [warning] replays not computed: {ex}")

    return {
        "id": match_id,
        "fp": fp,
        "sig": sig,
        "file": os.path.basename(path),
        "map": map_name,
        "patch": int(header.get("patch_version", 0) or 0),
        "server": header.get("server_name", ""),
        "kind": detect_kind(p, header.get("server_name", "")),
        "score": {"us": me_wins, "them": me_loss, "ct_won": ct_w, "ct_rounds": ct_n, "t_won": t_w, "t_rounds": t_n},
        "result": result,
        "complete": bool(complete),
        "rounds": per_round_me,
        "players": plist,
        "me": {
            "sid": me_id, "name": names[me_id],
            "kills": me_kills_ev, "deaths": me_deaths_ev, "util": me_util_out, "clutches": clutch_list,
            "weapons": weapons, "hit_zones": dict(hit_zone), "plants": plant_me, "defuses": defuse_me, "mov": mov,
        },
        "smoke_ref": smoke_ref,
        "replays": replays,
    }


UTIL_INV = {"Flashbang": "flash", "Smoke Grenade": "smoke", "HE Grenade": "he", "Molotov": "molotov",
            "Incendiary Grenade": "molotov", "Decoy Grenade": "decoy"}


def _look(r):
    """View direction (degrees), pitch and whether crouching; empty if the library does not provide them."""
    out = {}
    try:
        yw = getattr(r, "yaw", None)
        if yw is not None and yw == yw:
            out["yw"] = round(float(yw), 1)
            pt = getattr(r, "pitch", None)
            if pt is not None and pt == pt:
                out["pt"] = round(float(pt), 1)
        dk = getattr(r, "ducking", None)
        if dk is not None and dk == dk:
            out["cr"] = bool(dk)
    except Exception:
        pass
    return out


def _utility_outcomes(p, me_id, me_util, blinds, deaths, team_of, round_of):
    """Adds to each of my flashes its outcome (en, tm, bd, fk, sf) and to each of my smokes the number of nearby enemies (ne)."""
    flashes = [u for u in me_util if u["kind"] == "flash" and u.get("tick")]
    for u in flashes:
        r, t0 = u["r"], u["tick"]
        en = tm = fk = 0
        bd = 0.0
        sf = 0.0
        tms = team_of.get(r, {})
        mine = tms.get(me_id)
        hit = []
        for b in blinds.itertuples(index=False):
            if b.attacker_steamid != me_id or abs(int(b.tick) - t0) > 4:
                continue
            dur = float(nz(b.blind_duration))
            v = b.user_steamid
            if v == me_id:
                sf = max(sf, dur)
            elif tms.get(v) == mine:
                if dur >= 1.1:
                    tm += 1
            elif dur >= 1.1:
                en += 1
                bd = max(bd, dur)
                hit.append((v, int(b.tick), dur))
        for v, tk, dur in hit:
            for d in deaths.itertuples(index=False):
                if d.user_steamid == v and tk <= int(d.tick) <= tk + int(dur * TICKRATE) and tms.get(d.attacker_steamid) == mine:
                    fk += 1
                    break
        u["en"], u["tm"], u["bd"], u["fk"], u["sf"] = en, tm, round(bd, 1), fk, round(sf, 1)
    smokes = [u for u in me_util if u["kind"] == "smoke" and u.get("tick")]
    if smokes:
        df = p.parse_ticks(["X", "Y", "team_num", "health"], ticks=sorted({u["tick"] for u in smokes}))
        df["steamid"] = df["steamid"].apply(sid)
        for u in smokes:
            tms = team_of.get(u["r"], {})
            mine = tms.get(me_id)
            sub = df[df["tick"] == u["tick"]]
            ne = 0
            for row in sub.itertuples(index=False):
                if row.steamid == me_id or nz(row.health) <= 0:
                    continue
                if tms.get(row.steamid, int(nz(row.team_num))) == mine:
                    continue
                if math.hypot(float(row.X) - u["lx"], float(row.Y) - u["ly"]) <= 800:
                    ne += 1
            u["ne"] = ne


def death_context(p, me_id, evs, team_of, names, plant_tick, by_round_deaths=None, det=None, round_of=None, map_name=None, util_rows=None):
    """For each of my deaths, stores the context: everyone's positions, trail, nearby teammates, leftover utility.
    Mistake classification happens in the dashboard, so it can change without re-reading the demos."""
    if not evs:
        return
    STEP = 32  # half a second
    need = set()
    for e in evs:
        base = max(1, e["tick"] - 1)
        for k in range(0, 9):
            need.add(max(1, base - k * STEP))
    base_props = ["X", "Y", "Z", "team_num", "health", "last_place_name", "inventory", "flash_duration",
                  "active_weapon_name"]
    try:   # view direction and crouching: if the library lacks them, carry on without
        df = p.parse_ticks(base_props + ["yaw", "pitch", "ducking"], ticks=sorted(need))
    except Exception:
        df = p.parse_ticks(base_props, ticks=sorted(need))
    df["steamid"] = df["steamid"].apply(sid)
    by_tick = {}
    for row in df.itertuples(index=False):
        by_tick.setdefault(int(row.tick), {})[row.steamid] = row

    def alive_at(t):
        return {s: r for s, r in by_tick.get(t, {}).items() if nz(r.health) > 0 and int(nz(r.team_num)) in (2, 3)}

    for e in evs:
        base = max(1, e["tick"] - 1)
        snap = alive_at(base)
        mine = snap.get(me_id)
        if mine is None:
            # dead a moment before the tick: use the previous one
            for k in range(1, 4):
                snap = alive_at(max(1, base - k * 8)) if (base - k * 8) in by_tick else snap
            mine = snap.get(me_id)
        if mine is None:
            continue
        myteam = int(nz(mine.team_num))
        mates = [(s, r) for s, r in snap.items() if s != me_id and int(nz(r.team_num)) == myteam]
        foes = [(s, r) for s, r in snap.items() if int(nz(r.team_num)) not in (myteam,)]
        mx, my = float(mine.X), float(mine.Y)

        def dist(r):
            return math.hypot(float(r.X) - mx, float(r.Y) - my)
        near = min(mates, key=lambda sr: dist(sr[1])) if mates else None
        # trail
        trail = []
        trail3 = []
        for k in range(8, -1, -1):
            r = alive_at(max(1, base - k * STEP)).get(me_id)
            if r is not None:
                trail.append([int(float(r.X)), int(float(r.Y))])
                trail3.append((float(r.X), float(r.Y), float(r.Z)))
        speed = 0.0
        prev = alive_at(max(1, base - STEP)).get(me_id)
        if prev is not None:
            speed = math.hypot(mx - float(prev.X), my - float(prev.Y)) / (STEP / TICKRATE)
        ut = {"flash": 0, "smoke": 0, "he": 0, "molotov": 0}
        for it in (list(mine.inventory) if mine.inventory is not None else []):
            kk = UTIL_INV.get(str(it))
            if kk in ut:
                ut[kk] += 1
        fl = max(float(nz(mine.flash_duration)), float(nz((alive_at(max(1, base - 16)).get(me_id) or mine).flash_duration)))
        pos = []
        for s, r in snap.items():
            tm = "me" if s == me_id else ("mate" if int(nz(r.team_num)) == myteam else "foe")
            pos.append({"n": str(names.get(s, s))[:14], "x": int(float(r.X)), "y": int(float(r.Y)), "tm": tm,
                        "k": s == e.get("ksid"), "pl": str(nz(r.last_place_name, "")), "w": wn(str(nz(r.active_weapon_name, "")).lower().replace("-", "").replace(" ", "")),
                        **_look(r)})
        kr = snap.get(e.get("ksid")) if e.get("ksid") else None
        pt = plant_tick.get(e["r"])
        e["c"] = {
            "pl": str(nz(mine.last_place_name, "")), "kp": str(nz(kr.last_place_name, "")) if kr is not None else "",
            "tr": trail, "sp": int(speed), "md": int(dist(near[1])) if near else None,
            "mn": str(names.get(near[0], ""))[:14] if near else "", "ma": len(mates), "fa": len([1 for s, r in foes]) ,
            "ut": ut, "fl": round(fl, 1), "pb": bool(pt and e["tick"] > pt), "pos": pos,
        }
        # frames: every living player at 3, 2, 1 and 0 seconds before the death (+ active utility)
        try:
            fr = []
            for kk in (6, 4, 2, 0):
                sn = alive_at(max(1, base - kk * STEP))
                if not sn:
                    continue
                fr.append({"dt": -kk * 0.5, "p": [[int(float(r.X)), int(float(r.Y)),
                           0 if s == me_id else (1 if int(nz(r.team_num)) == myteam else 2),
                           int(nz(_look(r).get("yw"), -1)) if _look(r) else -1, 1 if s == e.get("ksid") else 0] for s, r in sn.items()]})
            ug = []
            mt = team_of.get(e["r"], {}).get(me_id)
            for u in (util_rows or []):
                if u["r"] != e["r"] or u["kind"] not in ("smoke", "flash", "he", "molotov"):
                    continue
                dtu = u["t"] - e["t"]
                if -20 <= dtu <= 1:
                    ug.append({"k": u["kind"], "x": int(u["lx"]), "y": int(u["ly"]), "dt": round(dtu, 1),
                               "tm": 1 if team_of.get(e["r"], {}).get(u["sid"]) == mt else 2, "me": 1 if u["sid"] == me_id else 0})
            if fr:
                e["c"]["fr"] = fr
                e["c"]["ug"] = ug
        except Exception:
            pass
        # real map geometry (optional: needs awpy and the map data)
        if map_name and _geo is not None:
            try:
                kr3 = (float(kr.X), float(kr.Y), float(kr.Z)) if kr is not None else None
                g = _geo.analyse_death(map_name, (mx, my, float(mine.Z)), kr3,
                                       [(float(r.X), float(r.Y), float(r.Z)) for s, r in foes],
                                       [(float(r.X), float(r.Y), float(r.Z)) for s, r in mates], trail3)
                if g:
                    e["c"]["geo"] = g
            except Exception:
                pass
        # recent events (last 12 s of the same round): everyone's deaths and thrown utility
        try:
            rec = []
            W = int(12 * TICKRATE)
            rr = e["r"]
            tm_of = team_of.get(rr, {})
            def who(s):
                if s == me_id:
                    return "me"
                return "mate" if tm_of.get(s) == tm_of.get(me_id) else "foe"
            AFTER = int(6 * TICKRATE)
            for d in (by_round_deaths or {}).get(rr, []):
                dtk = int(d.tick)
                if dtk == e["tick"] and d.user_steamid == me_id:
                    continue
                if (dtk < e["tick"] and e["tick"] - dtk <= W) or (dtk > e["tick"] and dtk - e["tick"] <= AFTER):
                    v, k = d.user_steamid, d.attacker_steamid
                    rec.append({"s": round((e["tick"] - dtk) / TICKRATE, 1), "k": "d",
                                "ax": int(nz(getattr(d, "attacker_X", 0))), "ay": int(nz(getattr(d, "attacker_Y", 0))), "v": str(names.get(v, v))[:14], "vt": who(v),
                                "a": str(names.get(k, k))[:14] if k else "", "at": who(k) if k else "", "w": wn(str(nz(getattr(d, "weapon", ""), "")).lower()),
                                "hs": bool(nz(getattr(d, "headshot", False), False)), "x": int(nz(getattr(d, "user_X", 0))), "y": int(nz(getattr(d, "user_Y", 0)))})
            for kind, dfu in (det or {}).items():
                for u in dfu.itertuples(index=False):
                    utk = int(u.tick)
                    if utk <= e["tick"] and e["tick"] - utk <= W and round_of and round_of(utk) == rr:
                        rec.append({"s": round((e["tick"] - utk) / TICKRATE, 1), "k": "u", "u": kind, "ut": who(u.user_steamid),
                                    "x": int(nz(getattr(u, "x", 0))), "y": int(nz(getattr(u, "y", 0)))})
            rec.sort(key=lambda z: -z["s"])
            e["c"]["ev"] = rec
            # who was around me 3 seconds earlier (positions and team)
            snap3 = alive_at(max(1, base - 6 * STEP))
            e["c"]["p3"] = [{"n": str(names.get(s, s))[:14], "x": int(float(r.X)), "y": int(float(r.Y)),
                             "tm": "me" if s == me_id else ("mate" if int(nz(r.team_num)) == myteam else "foe")} for s, r in snap3.items()]
        except Exception:
            e["c"]["ev"] = []


SNIPERS = ("awp", "ssg08", "scar20", "g3sg1")
NOT_GUNS = ("knife", "taser", "c4", "decoy", "flashbang", "hegrenade", "smokegrenade", "molotov", "inferno")


def _aim_err(me, en):
    """Angle (degrees) between where I look and the enemy's head; dpit>0 = crosshair below the head."""
    ez = float(me.Z) + (46.0 if nz(me.ducking, False) else 64.0)
    hz = float(en.Z) + (44.0 if nz(en.ducking, False) else 62.0)
    dx, dy, dz = float(en.X) - float(me.X), float(en.Y) - float(me.Y), hz - ez
    yaw_t = math.degrees(math.atan2(dy, dx))
    pit_t = -math.degrees(math.atan2(dz, math.hypot(dx, dy)))
    dyaw = (float(me.yaw) - yaw_t + 180.0) % 360.0 - 180.0
    dpit = float(me.pitch) - pit_t
    return math.hypot(dyaw, dpit), dyaw, dpit


def aim_analysis(p, me_id, fires, hurts, kills_ev, deaths_ev):
    """Movement while shooting + crosshair placement. Stores 'a' inside kills and deaths, returns the shot statistics."""
    import bisect
    mine = fires[fires["user_steamid"] == me_id].sort_values("tick")
    shots = [(int(r.tick), wn(r.weapon)) for r in mine.itertuples(index=False)
             if wn(r.weapon) not in NOT_GUNS and r.weapon not in GRENADES]
    need = set()
    for t, w in shots:
        need.update((t, max(1, t - 8)))
    ev_plan = []
    allf = fires.sort_values("tick")
    for kind, evs in (("k", kills_ev), ("d", deaths_ev)):
        for e in evs:
            if e.get("teamkill"):
                continue
            shooter = me_id if kind == "k" else e.get("ksid")
            target = e.get("vsid") if kind == "k" else me_id
            if not shooter or not target:
                continue
            win = allf[(allf["user_steamid"] == shooter) & (allf["tick"] <= e["tick"]) & (allf["tick"] >= e["tick"] - 64)]
            if kind == "k":
                win = win[win["weapon"].apply(wn) == e["w"]]
            if not len(win):
                continue
            tf = int(win.iloc[0]["tick"])
            ev_plan.append((e, kind, shooter, target, tf))
            need.update((tf, max(1, tf - 16), max(1, tf - 8), max(1, tf - 24)))
    if not need:
        return None
    df = p.parse_ticks(["X", "Y", "Z", "pitch", "yaw", "ducking"], ticks=sorted(need))
    df["steamid"] = df["steamid"].apply(sid)
    rows = {}
    for r in df.itertuples(index=False):
        rows.setdefault(int(r.tick), {})[r.steamid] = r

    def speed(s, t):
        a, b = rows.get(t, {}).get(s), rows.get(max(1, t - 8), {}).get(s)
        if a is None or b is None:
            return None
        return math.hypot(float(a.X) - float(b.X), float(a.Y) - float(b.Y)) / (8.0 / TICKRATE)

    hurt_t = defaultdict(list)
    for h in hurts[hurts["attacker_steamid"] == me_id].itertuples(index=False):
        hurt_t[wn(h.weapon)].append(int(h.tick))
    for v in hurt_t.values():
        v.sort()

    def bin_of(v):
        return "st" if v <= 45 else ("sl" if v <= 110 else "mv")
    blank = lambda: {"st": [0, 0], "sl": [0, 0], "mv": [0, 0]}
    A, F, W = blank(), blank(), defaultdict(blank)
    prev_t, prev_w = -10 ** 9, ""
    for t, w in shots:
        sp = speed(me_id, t)
        first = (t - prev_t > 32) or w != prev_w
        prev_t, prev_w = t, w
        if sp is None or w in SNIPERS:
            continue
        ht = hurt_t.get(w, [])
        i = bisect.bisect_left(ht, t)
        hit = 1 if (i < len(ht) and ht[i] - t <= 20) else 0
        b = bin_of(sp)
        for D in ([A, W[w]] + ([F] if first else [])):
            D[b][0] += 1
            D[b][1] += hit

    for e, kind, shooter, target, tf in ev_plan:
        # "placement" is measured a moment before the first shot; the error at the shot says how far off you started
        out = {}
        for key, tt in (("e0", max(1, tf - 16)), ("e1", tf)):
            m_, t_ = rows.get(tt, {}).get(me_id), rows.get(tt, {}).get(target if kind == "k" else shooter)
            if m_ is None or t_ is None:
                continue
            er, dy, dp = _aim_err(m_, t_)
            out[key] = round(er, 1)
            if key == "e1":
                out["dp"] = round(dp, 1)
                out["dy"] = round(dy, 1)
        sp = speed(me_id, tf)
        if sp is not None:
            out["s"] = int(sp)
        if out:
            out["k"] = kind
            e["a"] = out
    return {"all": A, "first": F, "w": {w: d for w, d in W.items() if sum(x[0] for x in d.values()) >= 25}}


# ====================================================================== Valve .info files
# Next to every demo (match730_....dem) CS2 saves a .dem.info file with the match scoreboard
# and the real date. It also covers matches whose demo you did NOT download.
import struct
import datetime as _dt

STEAM_BASE = 76561197960265728


def _varint(b, i):
    r = s = 0
    while True:
        c = b[i]
        i += 1
        r |= (c & 0x7F) << s
        s += 7
        if c < 0x80:
            return r, i


def _pb(b):
    i, out = 0, []
    while i < len(b):
        k, i = _varint(b, i)
        f, w = k >> 3, k & 7
        if w == 0:
            v, i = _varint(b, i)
        elif w == 1:
            v = struct.unpack("<Q", b[i:i + 8])[0]
            i += 8
        elif w == 5:
            v = struct.unpack("<I", b[i:i + 4])[0]
            i += 4
        elif w == 2:
            n, i = _varint(b, i)
            v = b[i:i + n]
            i += n
        else:
            raise ValueError("invalid protobuf")
        out.append((f, w, v))
    return out


def read_info(path):
    """Reads a .dem.info file. Returns {valve_id, time, rounds:[{acc:[...], f:{field:[values]}}]}."""
    top = _pb(open(path, "rb").read())
    d = {f: v for f, w, v in top if w != 2}
    rounds = []
    for f, w, v in top:
        if f == 5 and w == 2:
            acc, arrs = [], {}
            for ff, ww, vv in _pb(v):
                if ff == 2 and ww == 2:
                    acc = [x[2] for x in _pb(vv) if x[0] == 1]
                elif ww == 0:
                    arrs.setdefault(ff, []).append(vv)
            rounds.append({"acc": acc, "f": arrs})
    return {"valve_id": str(d.get(1, "")), "time": d.get(2), "rounds": rounds}


def info_played(info):
    return _dt.datetime.fromtimestamp(info["time"]).isoformat(timespec="minutes") if info.get("time") else ""


def lite_from_info(path, me_id):
    """'Scoreboard-only' match derived from the .info (no demo). None if you are not in it."""
    info = read_info(path)
    rr = info["rounds"]
    if not rr:
        return None
    last = rr[-1]
    acc = last["acc"]
    me_acc = int(me_id) - STEAM_BASE
    if me_acc not in acc:
        return None
    ix = acc.index(me_acc)
    f = last["f"]
    first_team = ix < 5
    sc = f.get(12, [0, 0])
    us, them = (sc[0], sc[1]) if first_team else (sc[1], sc[0])
    win_team = (f.get(11) or [0])[0]            # 1 = the first team won, 2 = the second
    result = "W" if win_team == (1 if first_team else 2) else "L" if win_team else "D"
    n = len(rr)

    def col(k):
        return f.get(k, [0] * len(acc))

    # kills per round from the cumulative values (round by round)
    prev, mk = 0, [0] * 6
    for r in rr:
        cur = r["f"].get(5, [0] * len(acc))[ix]
        k = max(0, cur - prev)
        prev = cur
        mk[min(k, 5)] += 1
    K, A, D = col(5)[ix], col(6)[ix], col(7)[ix]
    kr = (K / n) / 0.679
    sr = ((n - D) / n) / 0.317
    rmk = (mk[1] + 4 * mk[2] + 9 * mk[3] + 16 * mk[4] + 25 * mk[5]) / n / 1.277
    players = []
    for j in range(len(acc)):
        players.append({"me": j == ix, "mine_team": (j < 5) == first_team, "k": col(5)[j], "a": col(6)[j], "d": col(7)[j],
                        "score": col(8)[j], "hs": col(17)[j], "mvp": col(21)[j]})
    return {
        "id": "i" + info["valve_id"][-10:], "valve_id": info["valve_id"], "source": "info",
        "played": info_played(info), "rounds": n, "duration": (f.get(15) or [0])[0],
        "score": {"us": us, "them": them}, "result": result,
        "k": K, "a": A, "d": D, "hs": col(17)[ix], "mvp": col(21)[ix], "pts": col(8)[ix],
        "mk": mk, "rating": rnd((kr + 0.7 * sr + rmk) / 2.7, 2), "players": players,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("demos", nargs="+")
    ap.add_argument("--steamid", required=True, help="il tuo SteamID64")
    ap.add_argument("--out", default="cs_data.json")
    args = ap.parse_args()
    matches = []
    for d in args.demos:
        print("Parsing", d, file=sys.stderr)
        try:
            m = parse_demo(d, args.steamid)
            m["added"] = _dt.datetime.fromtimestamp(os.path.getmtime(d)).isoformat(timespec="seconds")
            ip = d + ".info"
            if os.path.exists(ip):
                inf = read_info(ip)
                m["valve_id"], m["played"] = inf["valve_id"], info_played(inf)
            matches.append(m)
        except SystemExit as e:
            print(e, file=sys.stderr)
    matches.sort(key=lambda m: (m.get("played", ""), m["patch"], m.get("added", "")))
    out = {"version": 1, "steamid": args.steamid, "matches": matches}
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Written {args.out}: {len(matches)} matches", file=sys.stderr)


if __name__ == "__main__":
    main()
