/* E-learning: callout map per map (community callout names from CSDB), drawn as SVG over the radar */
function calloutSvg(id, big, extra){
  const r = RADARS[id], C = LEARN_CALLOUTS[id] || [];
  if(!r) return '';
  const fs = big ? 17 : 14, rad = big ? 6 : 5, sw = big ? 4 : 3;
  const pins = C.map(([n,x,y]) => {
    const X = x*10, Y = y*10, left = x > 78;
    return `<g class="co-pin"><circle cx="${X}" cy="${Y}" r="${rad}" fill="#e5484d" stroke="#fff" stroke-width="1.5"/><text x="${X+(left?-(rad+4):(rad+4))}" y="${Y+fs*0.35}" font-size="${fs}" text-anchor="${left?'end':'start'}" fill="#fff" stroke="#111" stroke-width="${sw}" paint-order="stroke" font-weight="600">${esc(n)}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 1000 1000" class="lrn-cmap-svg" role="img" aria-label="Mappa con i callout di ${esc(mapName(id))}"><image href="${r}" x="0" y="0" width="1000" height="1000"/>${pins}${extra||''}</svg>`;
}
function learnCallouts(id){
  if(!RADARS[id] || !(LEARN_CALLOUTS[id]||[]).length) return '';
  const n = LEARN_CALLOUTS[id].length;
  return `<div class="card"><h2>Mappa dei callout</h2><div class="sub">I ${n} punti principali con il nome che si usa in chat vocale. Clicca la mappa per aprirla grande qui nell'app.</div>
    <div class="lrn-cmap" data-lbmap="${id}" title="Clicca per ingrandire">${calloutSvg(id,false)}</div>
    <p class="srcs">Non esiste un elenco ufficiale Valve con le posizioni: sono i nomi standard usati dalla community, come li riporta ${srcLinks(['co_csdb'])} (la pagina di ogni mappa ne ha anche di più dettagliati). ${id==='de_nuke'?'Nuke ha due piani sovrapposti: i punti vicini (per esempio Heaven e Hell) sono uno sopra l\'altro. ':''}Il tuo lato e il tuo spawn ti dicono da dove guardarla.</p></div>`;
}
function lbMap(id){
  let el = document.getElementById('lb');
  if(!el){ el = document.createElement('div'); el.id='lb'; document.body.appendChild(el); }
  LB.list = []; 
  el.innerHTML = `<div class="lb-bg" data-lbclose="1"></div><figure class="lb-fig"><div class="lb-map">${calloutSvg(id,true)}</div><figcaption>${esc(mapName(id))}: callout</figcaption></figure><button class="lb-x" data-lbclose="1" aria-label="Chiudi">✕</button>`;
  el.style.display='flex';
}

