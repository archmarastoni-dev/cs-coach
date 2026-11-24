/* ===== Videos with chapters (deep links to the exact minute) and official Valve lineups (with setpos) ===== */
const _YT = 'https://www.youtube.com/watch?v=';
const _YTT = 'https://i.ytimg.com/vi/';
const VKIND = {tutto:'smoke, molotov e flash', smoke:'smoke', flash:'flash', molotov:'molotov', spawn:'smoke istantanee dallo spawn'};
function ytDate(d){ const m=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic']; const p=d.split('-'); return m[+p[1]-1]+' '+p[0]; }
function ytTime(s){ const m=Math.floor(s/60), r=s%60; return m+':'+String(r).padStart(2,'0'); }
function learnVideos(id){
  const V = LEARN_VIDEOS[id]; if(!V) return '';
  const cache = id==='de_cache';
  const card = (v) => {
    const [vid, ch, date, what, kind, marks] = v;
    const old = cache && date < '2026-08-03';
    return `<div class="lrn-vid">
      <a class="lrn-thumb" href="${_YT+vid}" target="_blank" rel="noopener noreferrer"><img loading="lazy" referrerpolicy="no-referrer" src="${_YTT+vid}/mqdefault.jpg" alt="${esc(what)}" onerror="this.style.display='none'"></a>
      <div class="lrn-vbody"><h4>${esc(what)}</h4>
        <div class="lrn-vmeta">${esc(ch)} · ${ytDate(date)} · ${VKIND[kind]||''}${old?' <i class="pill D">prima della patch del 3 agosto</i>':''}</div>
        ${marks.length?`<div class="lrn-marks">${marks.map(([n,t])=>`<a href="${_YT+vid}&t=${t}s" target="_blank" rel="noopener noreferrer">${esc(n)} <span>${ytTime(t)}</span></a>`).join('')}</div>`:'<div class="lrn-vmeta">Senza capitoli: guarda il video intero.</div>'}
      </div></div>`;
  };
  const note = cache
    ? 'Cache è stata cambiata più volte dopo l\'uscita (patch del 3 agosto sulla geometria): preferisci i video dell\'ultimo periodo e prova sempre il lancio in una mappa di allenamento.'
    : 'Clicca un nome per aprire YouTube proprio al minuto di quella granata. Controlla la data: se la mappa è stata aggiornata dopo il video, prova il lancio in una mappa di allenamento.';
  return `<div class="card"><h2>Video: smoke, flash e molotov</h2><div class="sub">Guide su YouTube, con il minuto esatto di ogni granata. Le smoke "istantanee dallo spawn" sono quelle che si lanciano subito a inizio round.</div>
    <p class="${cache?'lrn-warn':''}">${esc(note)}</p>
    <div class="lrn-vids">${V.map(card).join('')}</div>
    <p class="srcs">I video restano su YouTube (i link aprono YouTube). Le anteprime sono caricate da YouTube e servono internet. Titoli e capitoli sono dei rispettivi canali.</p></div>`;
}
function copyText(t){
  try{ if(navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(()=>true,()=>false); }catch(e){}
  try{ const a=document.createElement('textarea'); a.value=t; a.style.position='fixed'; a.style.opacity='0'; document.body.appendChild(a); a.select(); const ok=document.execCommand('copy'); a.remove(); return Promise.resolve(ok); }catch(e){ return Promise.resolve(false); }
}
function learnOfficial(id){
  const O = LEARN_OFFICIAL[id]; if(!O) return '';
  const TH = {f:'da fermo, clic sinistro', j:'salto + lancio (jump throw), clic sinistro', '?':'la fonte indica sia da fermo sia salto: prova tutti e due'};
  const row = (o,i) => { const [name, kind, th, st, am, sp] = o; const tm = throwSvg(id, sp, false); return `<div class="lrn-off">${tm?`<div class="lrn-thr" data-lbthrow="${id}|${i}" title="Clicca per ingrandire">${tm}</div>`:''}<div class="lrn-offt">
      <h4>${esc(name)}${kind==='molotov'?' <i class="pill D">molotov</i>':''}</h4>
      <div class="lrn-what"><b>Dove stare:</b> ${esc(st)} <b>Dove mirare:</b> ${esc(am)} <span>Lancio: ${esc(TH[th]||'')}.</span></div>
      <div class="lrn-cmd"><code>${esc(sp)}</code><button class="btn" data-copy="${esc(sp)}">Copia</button></div></div></div>`; };
  const SA = SRC.shot_sa;
  return `<div class="card"><h2>Lineup ufficiali di Valve (con comando per allenarti)</h2>
    <div class="sub">Sono le guide granate che Valve include nel gioco. Per ognuna: una mappa con il punto da cui lanciare (pallino verde) e la direzione in cui mirare (freccia), il testo di dove stare e dove mirare, e una riga <b>setpos</b> che ti porta sul punto di lancio. Clicca la mappa per ingrandirla.</div>
    <details class="lrn-mod"><summary>Come usare la riga setpos</summary><ol class="lrn-how"><li>Apri la mappa da solo, con i bot (o su un tuo server).</li><li>Premi il tasto della console e scrivi <code>sv_cheats 1</code>.</li><li>Premi "Copia" qui sotto, incolla la riga nella console e premi Invio: ti ritrovi sul punto di lancio, già girato verso il punto di mira.</li><li>Lancia come indicato (da fermo o con il salto).</li></ol></details>
    <div class="lrn-offs">${O.map(row).join('')}</div>
    <p class="srcs">Fonte: <a href="https://www.steamanalyst.com/lineups/${id.replace('de_','').replace('dust2','dust2')}" target="_blank" rel="noopener noreferrer">${esc(SA[0])}</a> (testi tradotti e riassunti da me; le coordinate sono quelle originali). ${id==='de_cache'?'Dopo la patch del 3 agosto potrebbe servire un controllo: se la granata non cade giusta, confronta con i video recenti.':''}</p></div>`;
}
function learnMoreSources(id){
  const base = ['x_refrag','x_tracker'];
  const per = {de_mirage:['x_sk_mirage'], de_dust2:['x_sk_dust2'], de_nuke:['x_sk_nuke'], de_ancient:['x_sk_ancient','x_dot_ancient'], de_cache:['x_dig_cache']};
  const keys = base.concat(per[id]||[]);
  return `<p class="srcs">Altre guide con immagini (trovate nella ricerca, non le ho controllate una per una): ${srcLinks(keys)}</p>`;
}

