/* E-learning: entry views (home, map page). Static content (Italian) lives in data/learn/*.js */
Object.assign(SRC, LEARN_SOURCES);

function learnData(mapId){
  const mm = state.matches.filter(m=>m.map===mapId);
  if(!mm.length) return '';
  const a = agg(mm,'all'), c = agg(mm,'CT'), t = agg(mm,'T');
  return `<div class="card"><h2>I tuoi dati su ${mapName(mapId)}</h2><div class="sub">Dalle tue partite caricate.</div>
    <div class="kpis"><div><b>${mm.length}</b><span>partite</span></div><div><b>${a.mw}-${a.n-a.mw}</b><span>vinte-perse</span></div><div><b>${pc(c.rwP)}</b><span>round vinti CT</span></div><div><b>${pc(t.rwP)}</b><span>round vinti T</span></div></div></div>`;
}
const lrnList = (items, cls='') => `<ul class="lrn-list ${cls}">${items.map(x=>`<li>${typeof x==='string'?esc(x):`<b>${esc(x[0])}.</b> ${esc(x[1])}`}</li>`).join('')}</ul>`;

function learnPathCard(p){
  const P = LEARN_PATHS[p];
  return `<div class="card"><h2>${esc(P.titolo)}</h2><div class="sub">${esc(P.sotto)}</div>
   <div class="lrn-mods">${P.moduli.map(m=>`<details class="lrn-mod"><summary>${esc(m[0])}</summary>${lrnList(m[1])}</details>`).join('')}</div>
   <p class="srcs">Fonti: ${srcLinks(P.fonti)}</p></div>`;
}
function learnHome(){
  const path = state.learn.path;
  const mapsCards = LEARN_MAPS.map(L=>`<button class="lrn-map" data-lmap="${L.id}">
      <svg viewBox="0 0 1000 1000" aria-hidden="true">${RADARS[L.id]?`<image href="${RADARS[L.id]}" x="0" y="0" width="1000" height="1000"/>`:''}</svg>
      <span class="n">${mapName(L.id)}${L.nuova?' <i class="pill D">nuova nel pool</i>':''}</span><span class="t">${esc(L.tag)}</span></button>`).join('');
  return `<div class="card"><h2>E-learning</h2>
    <div class="sub">Mappe del pool attuale (Active Duty): Ancient, Anubis, Cache, Dust II, Inferno, Mirage, Nuke. Scegli il tuo mondo: giocare in squadra e giocare in solo sono due modi diversi di imparare.</div>
    <div class="seg" id="lpath">${[['team','Team (5 che parlano)'],['solo','SoloQ (con sconosciuti)']].map(([v,l])=>`<button data-lpath="${v}" aria-pressed="${path===v}">${l}</button>`).join('')}</div></div>
    ${learnPathCard(path)}
    ${learnOverview()}
    <div class="card"><h2>Mappe</h2><div class="sub">Strategie, utility, posizioni e suggerimenti per il percorso scelto.</div><div class="lrn-maps">${mapsCards}</div></div>
    <div class="card"><h2>Moduli comuni</h2><div class="lrn-mods">${LEARN_GENERAL.map(m=>`<details class="lrn-mod"><summary>${esc(m[0])}</summary>${lrnList(m[1])}</details>`).join('')}</div>
    <p class="srcs">Fonti: ${srcLinks(LEARN_GEN_SRC)}</p></div>`;
}
function learnMap(id){
  const L = LEARN_MAPS.find(x=>x.id===id); if(!L) return learnHome();
  const path = state.learn.path, team = path==='team';
  const radar = RADARS[id] ? `<svg viewBox="0 0 1000 1000" class="lrn-radar"><image href="${RADARS[id]}" x="0" y="0" width="1000" height="1000"/></svg>` : '';
  const srcKeys = ['csdb_'+L.slug].concat(L.lineups?['lu_'+L.slug]:[],['lrn_yprac','lrn_grenade']);
  const own = [
   ['Come si decide il round', lrnList(L.decide)],
   ['Dove si pianta', lrnList(L.plants)],
   ['Duelli chiave', lrnList(L.duels)]
  ];
  const sidePaths = team ? [
   ['Strategie in attacco (T)', lrnList(L.T)],
   ['Strategie in difesa (CT)', lrnList(L.CT)],
   ['Utility e tempi', lrnList(L.util)],
   ['Suggerimenti di squadra', lrnList(L.team)]
  ] : [
   ['Giocate semplici in solo', lrnList(L.solo)],
   ['Utility che puoi lanciare tu', lrnList(L.util)],
   ['Sull\'attacco: la scelta più sicura', lrnList(L.T.slice(0,2))],
   ['In difesa: la scelta più sicura', lrnList(L.CT.slice(0,1))]
  ];
  return `<button class="btn" data-lback="1">← Tutte le mappe</button>
  <div class="card"><h2>${mapName(id)}</h2><div class="sub">${esc(L.tag)} · percorso ${team?'Team':'SoloQ'}</div>
    <div class="seg" id="lpath">${[['team','Team'],['solo','SoloQ']].map(([v,l])=>`<button data-lpath="${v}" aria-pressed="${path===v}">${l}</button>`).join('')}</div>
    <div class="lrn-top">${radar}<p>${esc(L.resume)}</p></div></div>
  ${learnCallouts(id)}
${learnData(id)}
  ${learnAnalysis(id)}
  <div class="card"><h2>La mappa</h2>${own.map(([h,b])=>`<h3>${h}</h3>${b}`).join('')}</div>
  <div class="card"><h2>${team?'Per la squadra':'Per te in solo'}</h2>${sidePaths.map(([h,b])=>`<h3>${h}</h3>${b}`).join('')}</div>
  ${learnShots(id)}
  ${learnOfficial(id)}
  ${learnVideos(id)}
  <div class="card"><h2>Esercitati</h2><p>${L.lineups?'Le lineup esatte delle smoke e delle flash sono nelle pagine dedicate (nessuna coordinata inventata qui): provale in una mappa di allenamento e ripetile finché riescono sempre.':'Per questa mappa non esiste ancora una libreria di lineup nella fonte usata: allenati su una mappa pratica con infinite utility e annota i lanci che funzionano.'}</p>
  <p class="srcs">Fonti: ${srcLinks(srcKeys)}</p>${learnMoreSources(id)}</div>`;
}
function viewLearn(){ return state.learn.map ? learnMap(state.learn.map) : learnHome(); }

