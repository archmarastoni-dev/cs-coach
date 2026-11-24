/* ===== Where to throw from: throw position and direction drawn on the radar from the official setpos coordinates ===== */
function parseSetpos(sp){ const m = /setpos\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+);setang\s+(-?[\d.]+)\s+(-?[\d.]+)/.exec(sp||''); return m ? {x:+m[1], y:+m[2], pitch:+m[4], yaw:+m[5]} : null; }
function throwGeom(id, sp){
  const c = MAPS[id], p = parseSetpos(sp); if(!c || !p) return null;
  const px = (p.x - c.pos_x)/c.scale/1024*1000, py = (c.pos_y - p.y)/c.scale/1024*1000;
  const a = p.yaw*Math.PI/180; return {px, py, dx: Math.cos(a), dy: -Math.sin(a)};
}
function throwMarks(g, big){
  const L = big ? 90 : 70, w = big ? 5 : 6, ex = g.px + g.dx*L, ey = g.py + g.dy*L;
  const hx = (k)=> ex - g.dx*18 + (-g.dy)*k, hy = (k)=> ey - g.dy*18 + (g.dx)*k;
  return `<line x1="${g.px}" y1="${g.py}" x2="${ex}" y2="${ey}" stroke="#fff" stroke-width="${w+3}" stroke-linecap="round"/><line x1="${g.px}" y1="${g.py}" x2="${ex}" y2="${ey}" stroke="#22c55e" stroke-width="${w}" stroke-linecap="round"/>
    <polygon points="${ex+g.dx*10},${ey+g.dy*10} ${hx(9)},${hy(9)} ${hx(-9)},${hy(-9)}" fill="#22c55e" stroke="#fff" stroke-width="2"/>
    <circle cx="${g.px}" cy="${g.py}" r="${big?11:12}" fill="#22c55e" stroke="#fff" stroke-width="3"/>`;
}
function throwSvg(id, sp, big){
  const g = throwGeom(id, sp), r = RADARS[id]; if(!g || !r) return '';
  if(big) return calloutSvg(id, true, throwMarks(g, true));
  const S = 330, vx = Math.max(0, Math.min(1000-S, g.px - S/2)), vy = Math.max(0, Math.min(1000-S, g.py - S/2));
  const pins = (LEARN_CALLOUTS[id]||[]).filter(([n,x,y]) => x*10>=vx && x*10<=vx+S && y*10>=vy && y*10<=vy+S).map(([n,x,y]) => `<text x="${x*10}" y="${y*10}" font-size="15" text-anchor="middle" fill="#fff" stroke="#111" stroke-width="3.5" paint-order="stroke" font-weight="600">${esc(n)}</text>`).join('');
  return `<svg viewBox="${vx} ${vy} ${S} ${S}" class="lrn-thr-svg" role="img" aria-label="Punto di lancio sulla mappa"><image href="${r}" x="0" y="0" width="1000" height="1000"/>${pins}${throwMarks(g,false)}</svg>`;
}
function lbThrow(id, i){
  const o = (LEARN_OFFICIAL[id]||[])[i]; if(!o) return;
  let el = document.getElementById('lb');
  if(!el){ el = document.createElement('div'); el.id='lb'; document.body.appendChild(el); }
  LB.list = [];
  el.innerHTML = `<div class="lb-bg" data-lbclose="1"></div><figure class="lb-fig"><div class="lb-map">${throwSvg(id, o[5], true)}</div><figcaption>${esc(o[0])}: pallino verde = dove stare, freccia = direzione in cui mirare</figcaption></figure><button class="lb-x" data-lbclose="1" aria-label="Chiudi">✕</button>`;
  el.style.display='flex';
}

