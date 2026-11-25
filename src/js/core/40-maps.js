/* Maps / radar: world -> radar coordinates, heatmaps, map cards */
function ptFn(map, extra){
  const c = MAPS[map];
  if(c) return (x,y) => [ (x - c.pos_x)/c.scale/1024*1000, (c.pos_y - y)/c.scale/1024*1000 ];
  // fallback: normalise on the available points
  const xs = extra.map(p=>p[0]), ys = extra.map(p=>p[1]);
  const x0=Math.min(...xs), x1=Math.max(...xs), y0=Math.min(...ys), y1=Math.max(...ys);
  const s = Math.max(x1-x0, y1-y0, 1) * 1.1;
  return (x,y) => [ 50 + (x-x0)/s*900, 950 - (y-y0)/s*900 ];
}
/* Maps with two floors (Nuke): the radar has an upper and a lower image; a point belongs to the lower one below the height z.
   A shape can be tagged {s:'<svg…>', l:level} (level 0 = main floor, 1 = lower floor, -1 = unknown): when at least one shape of a map with
   floors has a known level, radarSVG draws one map per floor (only floors that have something unless opts.both). */
const LEVELS = {de_nuke:{z:-495, names:['Piano principale · A e outside','Interrato · B']}};
const lvlOf = (map, z) => (LEVELS[map] && z != null && isFinite(z)) ? (z < LEVELS[map].z ? 1 : 0) : -1;
const tg = (s, l) => ({s, l});
function radarOne(map, level, shapes, opts){
  const key = level === 1 && RADARS[map+'_lower'] ? map+'_lower' : map;
  const img = RADARS[key] ? `<image href="${RADARS[key]}" x="0" y="0" width="1000" height="1000" opacity=".95"/>` :
    `<rect width="1000" height="1000" fill="#10161d"/><text x="500" y="40" fill="#7c8795" text-anchor="middle" font-size="22">Radar non disponibile per ${esc(map)}</text>`;
  return `<svg class="radar" viewBox="${opts.vb||'0 0 1000 1000'}" role="img" aria-label="Mappa ${esc(mapName(map))}${level>=0&&LEVELS[map]?' · '+LEVELS[map].names[level]:''}">
    <defs><radialGradient id="hotk"><stop offset="0" stop-color="#2bd47d" stop-opacity=".55"/><stop offset="1" stop-color="#2bd47d" stop-opacity="0"/></radialGradient>
    <radialGradient id="hotd"><stop offset="0" stop-color="#ff4b4b" stop-opacity=".6"/><stop offset="1" stop-color="#ff4b4b" stop-opacity="0"/></radialGradient></defs>
    ${img}${shapes.join('')}</svg>`;
}
function radarSVG(map, shapes, opts={}){
  const L = LEVELS[map], str = x => typeof x === 'string' ? x : x.s;
  if(L && shapes.some(x => typeof x === 'object' && x.l >= 0)){
    const lv = [0,1].filter(l => opts.both || shapes.some(x => typeof x === 'object' && x.l === l));
    const cols = lv.map(l => `<div class="lvcol"><div class="lvt">${L.names[l]}</div>${radarOne(map, l, shapes.filter(x => typeof x === 'string' || x.l === l || (x.l < 0 && l === 0)).map(str), opts)}</div>`);
    return `<div class="lvpair">${cols.join('')}</div>`;
  }
  return radarOne(map, 0, shapes.map(str), opts);
}
const tipAttr = t => `data-tip="${esc(t)}"`;
function killTip(e, label){
  return `R${e.r} · ${e.t}s · ${wname(e.w)}${e.hs?' · headshot':''}${e.wb?' · wallbang':''}${e.sm?' · attraverso smoke':''}${e.blind?' · eri accecato':''} · ${f1(e.dist,0)} m · ${label}`;
}
function zoneCells(pts){
  const g = new Map();
  for(const p of pts){
    const cx = Math.max(0,Math.min(9,Math.floor(p.u/100))), cy = Math.max(0,Math.min(9,Math.floor(p.v/100)));
    const l = p.l == null ? -1 : p.l, key = cx+','+cy+','+l; const c = g.get(key) || {cx,cy,l,k:0,d:0,names:{}}; if(p.type==='k') c.k++; else { c.d++; if(p.pl) c.names[p.pl] = (c.names[p.pl]||0)+1; } g.set(key,c);
  }
  return [...g.values()];
}
function mapScene(map, ms, side, L){
  const kills = [], deaths = [];
  for(const m of ms) for(const e of m.me.kills) if(sideOk(side,e)) kills.push(e);
  for(const m of ms) for(const e of m.me.deaths) if(sideOk(side,e) && !e.teamkill) deaths.push(e);
  const all = [...kills.map(e=>[e.ax,e.ay]), ...deaths.map(e=>[e.vx,e.vy])];
  const pt = ptFn(map, all.length?all:[[0,0],[1,1]]);
  const sh = [], pts = [];
  if(L.heat){
    for(const e of kills){ const [u,v]=pt(e.ax,e.ay); sh.push(tg(`<circle cx="${u}" cy="${v}" r="55" fill="url(#hotk)"/>`, lvlOf(map,e.az))); }
    for(const e of deaths){ const [u,v]=pt(e.vx,e.vy); sh.push(tg(`<circle cx="${u}" cy="${v}" r="55" fill="url(#hotd)"/>`, lvlOf(map,e.vz))); }
  }
  for(const e of kills){
    const [u,v]=pt(e.ax,e.ay), [u2,v2]=pt(e.vx,e.vy); pts.push({u,v,type:'k',l:lvlOf(map,e.az)});
    if(L.kills) sh.push(tg(`<g class="it"><line x1="${u}" y1="${v}" x2="${u2}" y2="${v2}" stroke="#2bd47d" stroke-opacity=".45" stroke-width="2"/>
      <circle cx="${u}" cy="${v}" r="7" fill="#2bd47d" stroke="#000" stroke-width="1.5" ${tipAttr(killTip(e,'uccisione di '+e.victim))}/><circle cx="${u2}" cy="${v2}" r="4" fill="#2bd47d" fill-opacity=".6"/></g>`, lvlOf(map,e.az)));
  }
  for(const e of deaths){
    const [u,v]=pt(e.vx,e.vy), [u2,v2]=pt(e.ax,e.ay); pts.push({u,v,type:'d', pl: e.c && e.c.pl, l:lvlOf(map,e.vz)});
    if(L.deaths) sh.push(tg(`<g class="it"><line x1="${u2}" y1="${v2}" x2="${u}" y2="${v}" stroke="#ff5c5c" stroke-opacity=".4" stroke-width="2" stroke-dasharray="6 4"/>
      <circle cx="${u2}" cy="${v2}" r="4" fill="#ff5c5c" fill-opacity=".6"/><path d="M${u-7} ${v-7}L${u+7} ${v+7}M${u+7} ${v-7}L${u-7} ${v+7}" stroke="#ff5c5c" stroke-width="4" stroke-linecap="round" ${tipAttr(killTip(e,'ucciso da '+e.killer)+(e.traded?' · tradato':' · non tradato'))}/></g>`, lvlOf(map,e.vz)));
  }
  return {pt, sh, pts, kills, deaths};
}
function zoneList(pts, pt){
  const cells = zoneCells(pts).filter(c => c.k + c.d >= 2).sort((a,b) => (b.d - a.d) || (b.k - a.k)).slice(0,6);
  return cells;
}

