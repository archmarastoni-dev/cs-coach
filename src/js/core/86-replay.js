/* 2D replay of the key moments of a match (clips are recorded by the parser: positions of all players at a few samples per second) */
const RP = {clip:0, t:0, playing:false, speed:1, sel:-1, whole:false, raf:0, last:0};
const RP_COL = ['#ffd34d', '#4aa3ff', '#ff5c5c'];                 // me, teammate, enemy
function rpMatch(){ return state.matches.find(x => x.id === state.sel); }
function viewReplay(m){
  const R = m.replays || [];
  if(!R.length) return `<div class="card"><h2>Replay dei momenti chiave</h2><div class="empty">Per questa partita non c'è nessun replay. Le registrazioni si creano quando la demo viene analizzata con l'ultima versione di CS Coach: le partite già in archivio non le hanno, perché le demo sono state cancellate dopo l'analisi.</div></div>`;
  if(RP.clip >= R.length) RP.clip = 0;
  const chips = R.map((c,i) => `<button data-rclip="${i}" aria-pressed="${RP.clip===i}">Round ${c.r} · ${esc(c.why)}</button>`).join('');
  return `<div class="card"><h2>Replay dei momenti chiave</h2>
    <div class="sub">Animazione 2D dei tuoi momenti più importanti (multi-kill, clutch, primi duelli, morti). Giallo = tu, blu = compagni, rosso = avversari; i coni mostrano dove guarda ognuno. Clicca un giocatore per seguirlo, clicca sul fondo per togliere la selezione.</div>
    <div class="chips" id="rpchips">${chips}</div>
    <div class="rp" id="rp"><div class="rp-stage"><div class="rp-svg"></div><div class="rp-feed"></div>
      <button type="button" class="rp-fs" title="Schermo intero" aria-label="Schermo intero">⛶</button></div>
      <div class="rp-bar"><button type="button" class="btn rp-play">▶</button><input type="range" class="rp-seek" min="0" max="1000" value="0" aria-label="Posizione"><span class="rp-time"></span>
        <select class="rp-speed" aria-label="Velocità"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select>
        <label class="rp-whole"><input type="checkbox"> mappa intera</label></div></div></div>`;
}
function rpClip(){ const m = rpMatch(); return m && m.replays ? [m, m.replays[RP.clip]] : [null, null]; }
function rpFit(m, c){
  const pt = ptFn(m.map, [[0,0],[1,1]]);
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const p of c.ps) for(let i=0;i<p.f.length;i+=4){ if(!p.f[i] && !p.f[i+1]) continue; const [u,v] = pt(p.f[i], p.f[i+1]); x0=Math.min(x0,u); x1=Math.max(x1,u); y0=Math.min(y0,v); y1=Math.max(y1,v); }
  if(x0>x1) return '0 0 1000 1000';
  const sz = Math.min(1000, Math.max(x1-x0, y1-y0, 280) + 200), cx = (x0+x1)/2, cy = (y0+y1)/2;
  const vx = Math.max(0, Math.min(1000-sz, cx-sz/2)), vy = Math.max(0, Math.min(1000-sz, cy-sz/2));
  return [vx,vy,sz,sz].map(n=>+n.toFixed(1)).join(' ');
}
function rpBuild(root){
  const [m, c] = rpClip(); if(!c) return;
  const vb = RP.whole ? '0 0 1000 1000' : rpFit(m, c);
  root.querySelector('.rp-svg').innerHTML = radarSVG(m.map, ['<g class="rpl"></g>'], {vb}).replace('class="radar"', 'class="radar rp-radar"');
  const seek = root.querySelector('.rp-seek'); seek.max = Math.round(c.dur*100); seek.value = Math.round(RP.t*100);
  rpDraw(root);
}
function rpAng(a, b, f){ let d = ((b-a+540)%360)-180; return a + d*f; }
function rpDraw(root){
  const [m, c] = rpClip(); if(!c) return;
  const svg = root.querySelector('svg.rp-radar'); if(!svg) return;
  const g = svg.querySelector('.rpl'), pt = ptFn(m.map, [[0,0],[1,1]]);
  const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number), k = Math.max(vb[2]/1000, 0.3), R = v => +(v*k).toFixed(1);
  const u2r = (MAPS[m.map] ? MAPS[m.map].scale : 5) * 1.024;
  const t = Math.min(RP.t, c.dur), fi = t*c.hz, i0 = Math.min(Math.floor(fi), c.ps[0].f.length/4-1), i1 = Math.min(i0+1, c.ps[0].f.length/4-1), fr = fi-i0;
  const parts = [];
  // utility effects
  for(const u of c.u){
    const age = t-u.t; if(age < 0) continue;
    const [x,y] = pt(u.x,u.y);
    if(u.k==='smoke' && age<18) parts.push(`<circle cx="${x}" cy="${y}" r="${(140/u2r*Math.min(1,0.35+age/0.8)).toFixed(1)}" fill="#cfd6df" fill-opacity="${age>16?(.55*(18-age)/2).toFixed(2):.55}" stroke="#fff" stroke-opacity=".5" stroke-width="${R(2)}"/>`);
    else if(u.k==='molotov' && age<7) parts.push(`<circle cx="${x}" cy="${y}" r="${(120/u2r).toFixed(1)}" fill="#ff6a2b" fill-opacity=".45" stroke="#ffb27a" stroke-width="${R(2)}"/>`);
    else if(u.k==='flash' && age<0.5) parts.push(`<circle cx="${x}" cy="${y}" r="${(40/u2r+age*260/u2r).toFixed(1)}" fill="#fff" fill-opacity="${(.7*(1-age/0.5)).toFixed(2)}"/>`);
    else if(u.k==='he' && age<0.6) parts.push(`<circle cx="${x}" cy="${y}" r="${(60/u2r+age*300/u2r).toFixed(1)}" fill="#ff9d2b" fill-opacity="${(.6*(1-age/0.6)).toFixed(2)}"/>`);
  }
  // who is alive: dead after their death event
  const pos = c.ps.map((p,i) => {
    const a = p.f.slice(i0*4, i0*4+4), b = p.f.slice(i1*4, i1*4+4);
    const dead = c.k.some(e => e.v===i && e.t <= t);
    const hp = dead ? 0 : (a[3] > 0 ? a[3] : 1);
    return {x: a[0]+(b[0]-a[0])*fr, y: a[1]+(b[1]-a[1])*fr, yaw: rpAng(a[2], b[2], fr), alive: !dead && a[3] > 0, dead, hp, n: p.n, tm: p.tm};
  });
  // kill lines
  for(const e of c.k){
    const age = t-e.t; if(age < 0 || age > 1.4 || e.a < 0) continue;
    const A = pos[e.a], V = pos[e.v]; const [ax,ay] = pt(A.x,A.y), [vx,vy] = pt(V.x,V.y);
    parts.push(`<line x1="${ax}" y1="${ay}" x2="${vx}" y2="${vy}" stroke="${RP_COL[A.tm]}" stroke-width="${R(4)}" stroke-opacity="${(1-age/1.4).toFixed(2)}" stroke-linecap="round"/>`);
  }
  const dim = RP.sel >= 0;
  pos.forEach((p,i) => {
    const [x,y] = pt(p.x,p.y), col = RP_COL[p.tm], isSel = i===RP.sel, op = dim && !isSel ? .25 : 1;
    if(p.dead || !p.alive){
      parts.push(`<g opacity="${op}" data-p="${i}"><path d="M${x-R(8)} ${y-R(8)}L${x+R(8)} ${y+R(8)}M${x+R(8)} ${y-R(8)}L${x-R(8)} ${y+R(8)}" stroke="${col}" stroke-width="${R(4)}" stroke-linecap="round" stroke-opacity=".7"/><circle cx="${x}" cy="${y}" r="${R(18)}" fill="transparent"/></g>`);
      return;
    }
    const rad = p.yaw*Math.PI/180, [x2,y2] = pt(p.x+Math.cos(rad)*100, p.y+Math.sin(rad)*100), ang = Math.atan2(y2-y, x2-x), L = R(isSel?110:80), w = 0.6;
    parts.push(`<g opacity="${op}" data-p="${i}"><polygon points="${x},${y} ${(x+Math.cos(ang-w)*L).toFixed(1)},${(y+Math.sin(ang-w)*L).toFixed(1)} ${(x+Math.cos(ang+w)*L).toFixed(1)},${(y+Math.sin(ang+w)*L).toFixed(1)}" fill="${col}" fill-opacity="${isSel?.35:.22}"/>
      <circle cx="${x}" cy="${y}" r="${R(isSel?13:10)}" fill="${col}" stroke="${isSel||p.tm===0?'#fff':'#000'}" stroke-width="${R(isSel?3.5:2)}"/><circle cx="${x}" cy="${y}" r="${R(24)}" fill="transparent"/>
      ${p.tm===0||isSel?`<text x="${x+R(15)}" y="${y-R(13)}" fill="#fff" font-size="${R(20)}" stroke="#000" stroke-width="${R(4)}" paint-order="stroke" font-weight="600">${esc(p.n)}</text>`:''}</g>`);
  });
  g.innerHTML = parts.join('');
  // text feed (kills and bomb)
  const feed = [];
  for(const e of c.k){ if(t >= e.t && t-e.t < 4) feed.push(`<div><b style="color:${RP_COL[(pos[e.a]||{tm:2}).tm]}">${esc(e.a>=0?c.ps[e.a].n:'mondo')}</b> ✕ <b style="color:${RP_COL[c.ps[e.v].tm]}">${esc(c.ps[e.v].n)}</b> <span class="sub">${esc(wname(e.w))}${e.hs?' · testa':''}</span></div>`); }
  for(const b of c.b){ if(t >= b.t && t-b.t < 4) feed.push(`<div>💣 Bomba ${b.k==='plant'?'piazzata':'disinnescata'}</div>`); }
  root.querySelector('.rp-feed').innerHTML = feed.join('');
  root.querySelector('.rp-time').textContent = `${t.toFixed(1)} / ${c.dur.toFixed(1)} s · round ${c.r}, da ${c.t0} s dall'inizio`;
  const seek = root.querySelector('.rp-seek'); if(document.activeElement !== seek) seek.value = Math.round(t*100);
  root.querySelector('.rp-play').textContent = RP.playing ? '❚❚' : '▶';
}
function rpTick(ts){
  const root = document.getElementById('rp');
  if(!root || !RP.playing){ RP.raf = 0; return; }
  const [, c] = rpClip(); if(!c){ RP.raf = 0; return; }
  const dt = RP.last ? (ts-RP.last)/1000 : 0; RP.last = ts;
  RP.t += dt*RP.speed;
  if(RP.t >= c.dur){ RP.t = c.dur; RP.playing = false; }
  rpDraw(root);
  RP.raf = RP.playing ? requestAnimationFrame(rpTick) : 0;
}
function rpPlay(on){
  RP.playing = on; RP.last = 0;
  const [, c] = rpClip();
  if(on && c && RP.t >= c.dur) RP.t = 0;
  if(on && !RP.raf) RP.raf = requestAnimationFrame(rpTick);
  const root = document.getElementById('rp'); if(root) rpDraw(root);
}
function initReplay(){
  const root = document.getElementById('rp'); if(!root) return;
  RP.playing = false; RP.raf = 0;
  rpBuild(root);
  root.addEventListener('click', e => {
    if(e.target.closest('.rp-play')) return rpPlay(!RP.playing);
    if(e.target.closest('.rp-fs')){ root.classList.toggle('rp-full'); return; }
    if(e.target.closest('.rp-bar') || e.target.closest('.rp-feed')) return;
    const p = e.target.closest('[data-p]');
    RP.sel = p ? (+p.dataset.p === RP.sel ? -1 : +p.dataset.p) : -1;
    rpDraw(root);
  });
  root.querySelector('.rp-seek').addEventListener('input', e => { RP.t = +e.target.value/100; rpDraw(root); });
  root.querySelector('.rp-speed').addEventListener('change', e => { RP.speed = +e.target.value; });
  root.querySelector('.rp-whole input').addEventListener('change', e => { RP.whole = e.target.checked; rpBuild(root); });
  root.querySelector('.rp-speed').value = String(RP.speed);
  root.querySelector('.rp-whole input').checked = RP.whole;
}
document.addEventListener('keydown', e => { if(e.key==='Escape'){ const r = document.getElementById('rp'); if(r) r.classList.remove('rp-full'); } });
