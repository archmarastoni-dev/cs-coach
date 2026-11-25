/* E-learning: callout map per map (community callout names from CSDB), drawn as SVG over the radar */
function calloutSvg(id, big, extra){
  const r = RADARS[id], all = LEARN_CALLOUTS[id] || [];
  if(!r) return '';
  // The small card shows the most important names (the list is ordered by importance); the big view shows all of them.
  const C = big ? all : all.slice(0, 26);
  const fs = big ? 15 : 13, rad = big ? 5 : 4.5, sw = big ? 4 : 3.5;
  const placed = [];                                   // label boxes already used, to avoid overlaps
  const hit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  const pins = C.map(([n,x,y]) => {
    const X = x*10, Y = y*10, w = n.length*fs*0.58 + 4, h = fs + 2;
    // candidate label positions: right, left, above, below
    const cand = [
      {t:'start', lx:X+rad+4, ly:Y+fs*0.35, box:[X+rad+3, Y-h/2, X+rad+3+w, Y+h/2]},
      {t:'end',   lx:X-rad-4, ly:Y+fs*0.35, box:[X-rad-3-w, Y-h/2, X-rad-3, Y+h/2]},
      {t:'middle',lx:X,       ly:Y-rad-5,   box:[X-w/2, Y-rad-5-h, X+w/2, Y-rad-5]},
      {t:'middle',lx:X,       ly:Y+rad+fs,  box:[X-w/2, Y+rad+2, X+w/2, Y+rad+2+h]}
    ].filter(c => c.box[0] >= 0 && c.box[2] <= 1000 && c.box[1] >= 0 && c.box[3] <= 1000);
    const pick = cand.find(c => !placed.some(b => hit(b, c.box))) || cand[0];
    if(pick) placed.push(pick.box);
    return `<g class="co-pin"><circle cx="${X}" cy="${Y}" r="${rad}" fill="#e5484d" stroke="#fff" stroke-width="1.5"/>${pick?`<text x="${pick.lx}" y="${pick.ly}" font-size="${fs}" text-anchor="${pick.t}" fill="#fff" stroke="#111" stroke-width="${sw}" paint-order="stroke" font-weight="600">${esc(n)}</text>`:''}</g>`;
  }).join('');
  return `<svg viewBox="0 0 1000 1000" class="lrn-cmap-svg" role="img" aria-label="Mappa con i callout di ${esc(mapName(id))}"><image href="${r}" x="0" y="0" width="1000" height="1000"/>${pins}${extra||''}</svg>`;
}
function learnCallouts(id){
  if(!RADARS[id] || !(LEARN_CALLOUTS[id]||[]).length) return '';
  const n = LEARN_CALLOUTS[id].length;
  return `<div class="card"><h2>Mappa dei callout</h2><div class="sub">I ${n} punti principali con il nome che si usa in chat vocale. Clicca la mappa per aprirla grande qui nell'app.</div>
    <div class="lrn-cmap" data-lbmap="${id}" title="Clicca per ingrandire">${calloutSvg(id,false)}</div>
    <p class="srcs">Non esiste un elenco ufficiale Valve con le posizioni: sono i nomi che usa la community, nell'ordine di importanza, come li elenca ${srcLinks(['co_csdb'])}. Le posizioni coincidono con i nomi di luogo che il gioco stesso scrive nelle demo (controllati su Dust 2, Ancient e Cache). Nella mappa grande ci sono tutti i nomi, in quella piccola i principali. ${id==='de_nuke'?'Nuke ha due piani sovrapposti: i punti vicini (per esempio Heaven e Hell) sono uno sopra l\'altro. ':''}Il tuo lato e il tuo spawn ti dicono da dove guardarla.</p></div>`;
}
function lbMap(id){
  let el = document.getElementById('lb');
  if(!el){ el = document.createElement('div'); el.id='lb'; document.body.appendChild(el); }
  LB.list = []; 
  el.innerHTML = `<div class="lb-bg" data-lbclose="1"></div><figure class="lb-fig"><div class="lb-map">${calloutSvg(id,true)}</div><figcaption>${esc(mapName(id))}: callout</figcaption></figure><button class="lb-x" data-lbclose="1" aria-label="Chiudi">✕</button>`;
  el.style.display='flex';
}

