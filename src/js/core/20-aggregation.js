/* Aggregation: per-match and per-filter totals, rates and rating estimate */
function agg(ms, side='all'){
  const A = {n:ms.length, mw:0, R:0, rw:0, k:0, d:0, a:0, dmg:0, surv:0, kast:0, hs:0, ok:0, od:0, tk:0, trD:0,
             mk:[0,0,0,0,0,0], clA:0, clW:0, pas:0};
  for(const m of ms){
    if(m.result==='W') A.mw++;
    const rows = m.rounds.filter(r => sideOk(side, r));
    for(const r of rows){
      A.R++; A.rw += r.won?1:0; A.k += r.k; A.d += r.d; A.a += r.a; A.dmg += r.dmg;
      A.surv += r.survived?1:0;
      if(r.k>0 || r.a>0 || r.survived || r.traded) A.kast++;
      if(r.d>0 && r.traded) A.trD++;
      A.mk[Math.min(r.k,5)]++;
      if(r.survived && r.k===0 && r.dmg<25 && !r.won) A.pas++;
    }
    for(const e of m.me.kills) if(sideOk(side,e)){ if(e.hs) A.hs++; if(e.open) A.ok++; }
    for(const e of m.me.deaths) if(sideOk(side,e)){ if(e.open) A.od++; }
    const p = me(m);
    A.tk += side==='all' ? p.trade_kills : p.side[side].trade_kills;
    const rs = new Map(m.rounds.map(r => [r.r, r.side]));
    for(const c of m.me.clutches){ if(side==='all' || rs.get(c.r)===side){ A.clA++; if(c.won) A.clW++; } }
  }
  const R = Math.max(1, A.R);
  A.kd = A.k / Math.max(1, A.d);
  A.adr = A.dmg / R;
  A.kastP = A.kast / R;
  A.hsP = A.k ? A.hs / A.k : NaN;
  A.okP = (A.ok + A.od) ? A.ok / (A.ok + A.od) : NaN;
  A.rwP = A.rw / R;
  A.survP = A.surv / R;
  A.trP = A.d ? A.trD / A.d : NaN;
  const kr = (A.k/R)/0.679, sr = ((R-A.d)/R)/0.317;
  const rmk = (A.mk[1] + 4*A.mk[2] + 9*A.mk[3] + 16*A.mk[4] + 25*A.mk[5]) / R / 1.277;
  A.rating = A.R ? (kr + 0.7*sr + rmk)/2.7 : NaN;
  return A;
}
function utilAgg(ms, side='all'){
  const U = {smoke:0, flash:0, he:0, molotov:0, ef:0, eft:0, tf:0, tft:0, fa:0, heD:0, moD:0, tDmg:0, R:0, thrown:{smoke:0,flash:0,he:0,molotov:0}};
  for(const m of ms){
    const p = me(m);
    U.R += m.rounds.filter(r => sideOk(side, r)).length;
    for(const u of m.me.util) if(sideOk(side,u)) U.thrown[u.kind]++;
    U.ef += p.enemies_flashed; U.eft += p.enemy_flash_time; U.tf += p.team_flashed; U.tft += p.team_flash_time;
    U.fa += p.flash_assists; U.heD += p.dmg_he; U.moD += p.dmg_molotov; U.tDmg += p.team_damage;
    U.flashAll = (U.flashAll||0) + p.thrown_flash;
  }
  return U;
}
function econ(ms, side='all'){
  const T = {Pistol:[], Eco:[], Force:[], Full:[]};
  for(const m of ms) for(const r of m.rounds){
    if(!sideOk(side,r)) continue;
    const t = (r.r===1 || r.r===13) ? 'Pistol' : r.equip<1500 ? 'Eco' : r.equip<4000 ? 'Force' : 'Full';
    T[t].push(r);
  }
  return T;
}

