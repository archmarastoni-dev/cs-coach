/* ===== Analysis of the player's own matches against the main strats of each map =====
   Compares thrown utility (landing zones, origins and angles), death positions and movement with the key utility per map
   (data/learn/analysis-zones.js) and the official Valve lineups (data/learn/official-lineups.js). */
function anPct(id,x,y){ const c=MAPS[id]; return [(x-c.pos_x)/c.scale/1024*100,(c.pos_y-y)/c.scale/1024*100]; }
function anNear(id,x,y,maxd=9){
  if(!MAPS[id]||!LEARN_CALLOUTS[id]) return null;
  const [px,py]=anPct(id,x,y); let b=null;
  for(const [n,cx,cy] of LEARN_CALLOUTS[id]){ const d=Math.hypot(cx-px,cy-py); if(!b||d<b[0]) b=[d,n]; }
  return b&&b[0]<maxd?b[1]:'fuori dalle zone note';
}
const anMed = a => { if(!a.length) return null; const s=[...a].sort((x,y)=>x-y), m=s.length>>1; return s.length%2?s[m]:(s[m-1]+s[m])/2; };
const anSp = (n,w,pl)=> n===1?'1 '+w:n+' '+(pl||(w==='round'?'round':w==='partita'?'partite':w+'s'));
function anLineups(id, utils){
  const out=[];
  (LEARN_OFFICIAL[id]||[]).forEach((L,i)=>{
    const m=/setpos (\S+) (\S+) (\S+);setang (\S+) (\S+)/.exec(L[5]||''); if(!m) return;
    const [x,y,,p,yw]=m.slice(1).map(Number); let st='mai';
    for(const u of utils){ if(u.ox==null||u.kind!==L[1]) continue;
      const d=Math.hypot(u.ox-x,u.oy-y), dy=Math.abs((u.yaw-yw+540)%360-180), dp=Math.abs(u.pitch-p);
      if(d<120&&dy<12&&dp<12){ st='usata'; break; }
      if(d<260&&dy<20) st='vicina'; }
    out.push({name:L[0],kind:L[1],st,i});
  });
  return out;
}
function learnAnalysis(id){
  const mm = (state.matches||[]).filter(m=>m.map===id && m.me);
  if(!mm.length) return '';
  const nM = mm.length;
  const rnds = {T:0,CT:0};
  mm.forEach(m=>(m.rounds||[]).forEach(r=>{ if(rnds[r.side]!=null) rnds[r.side]++; }));
  const utils = mm.flatMap(m=>(m.me.util||[]).map(u=>({...u,_m:m.id})));
  const deaths = mm.flatMap(m=>(m.me.deaths||[]).map(d=>({...d,_m:m.id})));
  const kills = mm.flatMap(m=>(m.me.kills||[]).map(d=>({...d,_m:m.id})));
  const KIND={smoke:'smoke',molotov:'molotov',flash:'flash',he:'HE'};
  // 1) utility per side and coverage of the key zones
  const sideBlocks = ['T','CT'].map(side=>{
    const nr=rnds[side]; if(!nr) return '';
    const us = utils.filter(u=>u.side===side);
    const per = k=>{ const n=us.filter(u=>u.kind===k).length; return (n/nr).toFixed(1); };
    const tmed = k=>{ const v=anMed(us.filter(u=>u.kind===k).map(u=>u.t)); return v==null?'–':Math.round(v)+' s'; };
    const zones = (AN_ZONES[id]&&AN_ZONES[id][side]||[]).map(([lab,kind,zs])=>{
      const roundsHit = new Set(), tot = us.filter(u=>u.kind===kind);
      let n=0;
      tot.forEach(u=>{ const z=anNear(id,u.lx,u.ly); if(zs.includes(z)){ roundsHit.add(u._m+':'+u.r); n++; } });
      const pctv = Math.round(100*roundsHit.size/nr);
      return `<tr><td>${esc(lab)}</td><td class="num">${n}</td><td class="num">${roundsHit.size}/${nr}</td><td><span class="an-bar"><i style="width:${Math.min(100,pctv*1.6)}%"></i></span> ${pctv}%</td></tr>`;
    }).join('');
    const land = k=>{ const c={}; us.filter(u=>u.kind===k).forEach(u=>{ const z=anNear(id,u.lx,u.ly)||'?'; c[z]=(c[z]||0)+1; });
      return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([z,n])=>`${esc(z)} ×${n}`).join(', ')||'–'; };
    return `<h3>Da ${side==='T'?'attaccante (T)':'difensore (CT)'} · ${anSp(nr,'round')}</h3>
     <div class="an-kpis">${['smoke','molotov','flash','he'].map(k=>`<div><b>${per(k)}</b><span>${KIND[k]} / round<br>mediana a ${tmed(k)}</span></div>`).join('')}</div>
     ${zones?`<table class="an-tbl"><thead><tr><th>Utility chiave della strat</th><th>Lanci</th><th>Round</th><th>Frequenza</th></tr></thead><tbody>${zones}</tbody></table>`:''}
     <p class="an-land"><b>Dove cadono di solito.</b> Smoke: ${land('smoke')}. Molotov: ${land('molotov')}.</p>`;
  }).join('');
  // 2) standard Valve lineups
  const lu = anLineups(id, utils.filter(u=>u.kind==='smoke'||u.kind==='molotov'));
  const used = lu.filter(x=>x.st==='usata').length, near = lu.filter(x=>x.st==='vicina').length;
  const luHtml = lu.length?`<h3>Lanci standard (Valve)</h3>
    <p class="an-note">Confronto la posizione e la direzione di ogni tua smoke/molotov con i ${lu.length} lanci ufficiali di questa mappa. <b>Usata</b> = stessa posizione (±2,3 m) e stessa mira (±12°); <b>vicina</b> = posizione e direzione simili ma non precise. Hai usato ${used}, vicine ${near}, mai ${lu.length-used-near}.</p>
    <div class="an-lu">${lu.map(x=>`<span class="an-lu-i ${x.st}" title="${x.st}">${esc(x.name)} · ${x.st}</span>`).join('')}</div>`:'';
  // 3) position and movement
  const dC = deaths.filter(d=>d.c), nd = dC.length;
  const pctOf = (n,d)=> d?Math.round(100*n/d)+'%':'–';
  const iso = dC.filter(d=>d.c&&d.c.md!=null&&d.c.md>800).length;
  const unused = dC.filter(d=>d.c&&d.c.ut&&(d.c.ut.flash+d.c.ut.smoke+d.c.ut.he+d.c.ut.molotov)>0).length;
  const movN = dC.filter(d=>d.c&&d.c.sp>110).length;
  const flashed = dC.filter(d=>d.c&&d.c.fl>0.3).length;
  const openD = deaths.filter(d=>d.open).length, openK = kills.filter(k=>k.open).length;
  const dz = {}; deaths.forEach(d=>{ if(d.vx==null) return; const z=anNear(id,d.vx,d.vy,12); if(z){ const k=d.side+' · '+z; dz[k]=(dz[k]||0)+1; } });
  const dzTop = Object.entries(dz).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const mv = {st:[0,0],sl:[0,0],mv:[0,0]};
  mm.forEach(m=>{ const a=m.me.mov&&m.me.mov.all; if(a) for(const k in mv){ mv[k][0]+=a[k][0]; mv[k][1]+=a[k][1]; } });
  const sh = mv.st[0]+mv.sl[0]+mv.mv[0];
  const hr = k=>mv[k][0]?Math.round(100*mv[k][1]/mv[k][0])+'%':'–';
  const movHtml = `<h3>Posizione e movimento</h3>${nd<deaths.length?`<p class="an-note">Il contesto della morte (distanza dai compagni, velocità, utility) c'è per ${nd} morti su ${deaths.length}: le partite più vecchie non lo avevano. Ricaricale con il parser aggiornato per completare il quadro.</p>`:''}
    <div class="an-kpis"><div><b>${pctOf(iso,nd)}</b><span>morti lontano dai compagni (&gt;15 m)</span></div><div><b>${pctOf(unused,nd)}</b><span>morti con utility ancora in tasca</span></div><div><b>${pctOf(movN,nd)}</b><span>morti mentre correvi</span></div><div><b>${pctOf(flashed,nd)}</b><span>morti da accecato</span></div></div>
    <p class="an-land"><b>Duello d'apertura.</b> Prime morti: ${openD} · prime kill: ${openK} in ${anSp(rnds.T+rnds.CT,'round')}. <b>Dove muori di più:</b> ${dzTop.length?dzTop.map(([k,n])=>`${esc(k)} ×${n}`).join(', '):'–'}.</p>
    <p class="an-land"><b>Mira e movimento (fucili).</b> Colpi fermo: ${hr('st')} a segno (${mv.st[0]}), camminando piano: ${hr('sl')} (${mv.sl[0]}), correndo: ${hr('mv')} (${mv.mv[0]}). Spari mentre corri: ${sh?Math.round(100*mv.mv[0]/sh):0}%.</p>`;
  // 4) what to fix (simple rules)
  const tips=[];
  { const side='T', nr=rnds.T, z0=(AN_ZONES[id]&&AN_ZONES[id].T||[])[0];
    if(z0&&nr>=8){ const hit=new Set(); utils.filter(u=>u.side===side&&u.kind===z0[1]).forEach(u=>{ if(z0[2].includes(anNear(id,u.lx,u.ly))) hit.add(u._m+':'+u.r); });
      if(hit.size/nr<0.15) tips.push(`Da T lanci raramente «${z0[0]}» (${hit.size} round su ${nr}). È l'utility che apre di più il round su questa mappa: provala di più, almeno nei round di default.`); } }
  if(nd>=8){
    if(iso/nd>0.4) tips.push(`Muori spesso lontano dai compagni (${pctOf(iso,nd)}): resta a distanza di trade, così il compagno ti vendica subito.`);
    if(unused/nd>0.5) tips.push(`In ${pctOf(unused,nd)} delle morti avevi ancora granate in tasca: usale prima del contatto (flash per il peek, smoke per tagliare).`);
    if(movN/nd>0.45) tips.push(`Il ${pctOf(movN,nd)} delle volte muori mentre corri: fermati un attimo prima di aprire lo scontro, la mira precisa richiede di essere fermi.`);
    if(openD>openK*1.3 && openD>=4) tips.push(`Perdi più duelli d'apertura di quanti ne vinci (${openD} contro ${openK}): evita di essere il primo a spingere senza flash o compagno dietro.`);
  }
  if(sh>200 && mv.mv[0]/sh>0.2 && mv.mv[0] && mv.st[0] && (mv.mv[1]/mv.mv[0]) < 0.85*(mv.st[1]/mv.st[0])) tips.push(`Spari ${Math.round(100*mv.mv[0]/sh)}% dei colpi correndo, con ${hr('mv')} a segno contro ${hr('st')} da fermo: stop e poi spara.`);
  if(lu.length && used===0) tips.push(`Nessuna tua granata coincide con i ${lu.length} lanci standard di questa mappa: impararne 2 o 3 (vedi «Lanci ufficiali») ti dà round più puliti.`);
  const vids = (LEARN_VIDEOS[id]||[]).slice(0,2).map(v=>`<a href="https://www.youtube.com/watch?v=${esc(v[0])}" target="_blank" rel="noopener">${esc(v[3])} (${esc(v[1])})</a>`).join(' · ');
  const tipHtml = `<h3>Cosa correggere per primo</h3>${tips.length?`<ul class="lrn-list">${tips.slice(0,5).map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:'<p class="an-note">Nessuna debolezza netta emerge da queste partite: continua a giocare e ricarica i dati.</p>'}${vids?`<p class="an-note">Per ripassare le utility di questa mappa: ${vids}</p>`:''}`;
  const small = nM<3?`<p class="lrn-warn">Campione piccolo (${anSp(nM,'partita')}): considera i numeri come indizi, non come verità.</p>`:'';
  return `<div class="card an"><h2>Le tue partite contro le strat · ${mapName(id)}</h2>
    <div class="sub">Partite analizzate: ${nM}. Zone di lancio classificate con i callout della mappa; i confronti sono con le strat descritte più sotto.</div>${small}
    ${sideBlocks}${luHtml}${movHtml}${tipHtml}
    <p class="an-note">Per approfondire: <a href="https://boostroom.com/blog/how-to-stop-dying-first-in-cs2-positioning-timing-guide" target="_blank" rel="noopener">come smettere di morire per primo (posizione e timing)</a> · <a href="https://www.ggrecon.com/guides/counter-strike-2-beginners-guide-tips-and-tricks/" target="_blank" rel="noopener">trade e utility prima del peek (GGRecon)</a> · <a href="https://refrag.gg/blog/4-of-the-worst-cs2-entry-fragging-mistakes-that-you-probably-make/" target="_blank" rel="noopener">errori da entry fragger (Refrag)</a></p>
    <p class="an-note">Limiti: le demo non vengono conservate, quindi l'analisi usa solo ciò che il parser ha salvato (lanci, kill, morti, velocità). Non sa quale strat stessi giocando né cosa chiedesse il tuo team: la «frequenza» dice quanto spesso fai quella cosa, non se era giusta in quel round.</p></div>`;
}

function learnOverview(){
  const rows = LEARN_MAPS.map(L=>{
    const mm=(state.matches||[]).filter(m=>m.map===L.id&&m.me); if(!mm.length) return '';
    const d=mm.flatMap(m=>(m.me.deaths||[]).filter(x=>x.c)); const n=d.length;
    const p=f=>n?Math.round(100*d.filter(f).length/n)+'%':'–';
    const ut=mm.flatMap(m=>m.me.util||[]); const nr=mm.reduce((a,m)=>a+(m.rounds||[]).length,0);
    const a=agg(mm,'all');
    return `<tr><td><button class="btn" data-lmap="${L.id}">${mapName(L.id)}</button></td><td class="num">${mm.length}</td><td class="num">${a.mw}-${a.n-a.mw}</td><td class="num">${nr?(ut.length/nr).toFixed(1):'–'}</td><td class="num">${p(x=>x.c.md!=null&&x.c.md>800)}</td><td class="num">${p(x=>(x.c.ut.flash+x.c.ut.smoke+x.c.ut.he+x.c.ut.molotov)>0)}</td><td class="num">${p(x=>x.c.sp>110)}</td></tr>`;
  }).join('');
  if(!rows) return '';
  return `<div class="card an"><h2>Il tuo quadro generale</h2><div class="sub">Dalle tue partite caricate, mappa per mappa. Apri una mappa per l'analisi completa contro le sue strat.</div>
   <table class="an-tbl"><thead><tr><th>Mappa</th><th>Partite</th><th>V-P</th><th>Granate / round</th><th>Morti lontano dai compagni</th><th>Morti con utility in tasca</th><th>Morti correndo</th></tr></thead><tbody>${rows}</tbody></table>
   <p class="an-note">Le percentuali usano solo le morti con contesto salvato dal parser. Con poche partite per mappa sono indizi, non verità.</p></div>`;
}

