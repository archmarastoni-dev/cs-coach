/* E-learning: smoke screenshots from online guides plus written instructions (data/learn/shots.js) */
function learnShots(id){
  const S = LEARN_SHOTS[id]; if(!S) return '';
  const src = S.src ? SRC[S.src] : null;
  const fig = (it) => {
    const [name, what, imgs, how, spawn] = it;
    return `<div class="lrn-shot"><h4>${esc(name)}${spawn?' <i class="pill D">subito dallo spawn</i>':''}</h4><div class="lrn-what">${esc(what)} <span>${esc(how)}</span></div>
      <div class="lrn-imgs">${imgs.map((u,i)=>`<a href="${u}" data-lb="${esc(name)}" target="_blank" rel="noopener noreferrer"><img loading="lazy" referrerpolicy="no-referrer" src="${u}" alt="${esc(name)}, immagine ${i+1}" onerror="this.parentNode.outerHTML='<span class=&quot;lrn-broken&quot;>Immagine non disponibile: apri la fonte.</span>'"></a>`).join('')}</div></div>`;
  };
  const body = S.items.length ? `<div class="lrn-shots">${S.items.map(fig).join('')}</div>` : '';
  const from = src ? `<p class="srcs">Immagini caricate da: <a href="${src[1]}" target="_blank" rel="noopener noreferrer">${esc(src[0])}</a>. Clicca un\'immagine per aprirla a grandezza intera. Le immagini restano sul sito della fonte e servono internet; ${S.date?'sono di '+S.date+'.':'sono del 2023, quindi controlla il lancio in una mappa di allenamento.'}</p>` : '';
  const ex = (S.extra||[]).length ? `<p class="srcs">Vedi anche: ${srcLinks(S.extra)}</p>` : '';
  return `<div class="card"><h2>Dove tirare le smoke</h2><div class="sub">Screenshot dalle guide online e istruzioni scritte. Per il punto di lancio esatto sulla mappa guarda anche i lineup ufficiali più sotto.</div>${S.note?`<p>${esc(S.note)}</p>`:''}${S.warn?`<p class="lrn-warn">${esc(S.warn)}</p>`:''}${body}${from}${ex}</div>`;
}
