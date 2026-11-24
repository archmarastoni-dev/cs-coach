"""Optional geometry analysis (lines of sight and cover) built on awpy.
If awpy or the map data is missing, every function returns None and the rest of the tool works unchanged."""
import math

EYE = 64.0  # eye height above the ground (standing), in game units
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
    """me/killer: (x,y,z); foes/mates: lists of (x,y,z) alive at death; trail: [(x,y,z)] every 0.5 s (last = death).
    Returns a compact dict, or None."""
    vc = _checker(map_name)
    if vc is None or me is None or killer is None:
        return None
    ke, me_e = _eye(killer), _eye(me)
    out = {"los": los(vc, ke, me_e)}
    # how long the killer (at their final position) could see you along your trail
    exp = 0
    for p in reversed(trail or []):
        v = los(vc, ke, _eye(p))
        if v: exp += 1
        else: break
    out["exp"] = round(exp * 0.5, 1)           # seconds of continuous exposure to the killer's position
    # enemies with a line of sight on you, teammates with a line on the killer / on you
    out["fv"] = sum(1 for f in foes if los(vc, _eye(f), me_e))
    out["mk"] = sum(1 for m in mates if los(vc, _eye(m), ke))
    out["mv"] = sum(1 for m in mates if los(vc, _eye(m), me_e))
    # nearby cover: a step (1.2 m, 2.4 m) in several directions that breaks the line to the killer
    dx, dy = killer[0] - me[0], killer[1] - me[1]
    base = math.atan2(dy, dx)
    best = None
    for dist in (63, 126):
        for deg in (90, -90, 135, -135, 180, 45, -45):
            a = base + math.radians(deg)
            q = (me[0] + dist * math.cos(a), me[1] + dist * math.sin(a), me[2])
            # the spot must be walkable: accept it only if the segment me->q (knee height) is clear
            if not los(vc, (me[0], me[1], me[2] + 30), (q[0], q[1], q[2] + 30)):
                continue
            if los(vc, ke, _eye(q)) is False:
                if best is None or dist < best[0]:
                    best = (dist, deg)
        if best: break
    out["cov"] = None if best is None else {"m": round(best[0] / 52.5, 1), "d": best[1]}
    return out
