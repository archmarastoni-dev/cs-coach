"""Analisi geometrica opzionale (linee di tiro e coperture) basata su awpy.
Se awpy o i dati di mappa mancano, ogni funzione restituisce None e il resto del tool funziona uguale."""
import math

EYE = 64.0  # altezza occhi da terra (stand), unita' di gioco
_VC = {}

def _checker(map_name):
    if map_name in _VC:
        return _VC[map_name]
    vc = None
    try:
        from awpy import VisibilityChecker
        vc = VisibilityChecker(map_name)
    except Exception:
        vc = None
    _VC[map_name] = vc
    return vc

def available(map_name):
    return _checker(map_name) is not None

def _eye(p, crouch=False):
    return (p[0], p[1], p[2] + (46.0 if crouch else EYE))

def los(vc, a, b):
    try:
        return bool(vc.is_visible(a, b))
    except Exception:
        return None

def analyse_death(map_name, me, killer, foes, mates, trail):
    """me/killer: (x,y,z); foes/mates: liste di (x,y,z) vivi alla morte; trail: [(x,y,z)] ogni 0.5 s (ultimo = morte).
    Ritorna un dict compatto o None."""
    vc = _checker(map_name)
    if vc is None or me is None or killer is None:
        return None
    ke, me_e = _eye(killer), _eye(me)
    out = {"los": los(vc, ke, me_e)}
    # per quanto tempo il killer (nella posizione finale) ti vedeva lungo la scia
    exp = 0
    for p in reversed(trail or []):
        v = los(vc, ke, _eye(p))
        if v: exp += 1
        else: break
    out["exp"] = round(exp * 0.5, 1)           # secondi di esposizione continua alla posizione del killer
    # nemici con linea di tiro su di te, compagni con linea sul killer / su di te
    out["fv"] = sum(1 for f in foes if los(vc, _eye(f), me_e))
    out["mk"] = sum(1 for m in mates if los(vc, _eye(m), ke))
    out["mv"] = sum(1 for m in mates if los(vc, _eye(m), me_e))
    # copertura vicina: un passo (1.2 m, 2.4 m) in 6 direzioni che spezza la linea col killer
    dx, dy = killer[0] - me[0], killer[1] - me[1]
    base = math.atan2(dy, dx)
    best = None
    for dist in (63, 126):
        for deg in (90, -90, 135, -135, 180, 45, -45):
            a = base + math.radians(deg)
            q = (me[0] + dist * math.cos(a), me[1] + dist * math.sin(a), me[2])
            # il punto deve essere camminabile: lo accettiamo se il tratto me->q (altezza ginocchio) e' libero
            if not los(vc, (me[0], me[1], me[2] + 30), (q[0], q[1], q[2] + 30)):
                continue
            if los(vc, ke, _eye(q)) is False:
                if best is None or dist < best[0]:
                    best = (dist, deg)
        if best: break
    out["cov"] = None if best is None else {"m": round(best[0] / 52.5, 1), "d": best[1]}
    return out
