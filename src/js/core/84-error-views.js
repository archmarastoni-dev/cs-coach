/* ---- how to throw flashes and smokes (Mistakes tab) ---- */
function medianOf(a){ if(!a.length) return NaN; const s=a.slice().sort((x,y)=>x-y), h=s.length>>1; return s.length%2?s[h]:(s[h-1]+s[h])/2; }
function modeOf(a){ const c={}; let b=null; for(const x of a){ if(!x) continue; c[x]=(c[x]||0)+1; if(b===null||c[x]>c[b]) b=x; } return b; }
/* Collapsible blocks: native <details>, no re-render needed. foldCard() turns an existing card (<h2> + body) into one. */
function foldCard(html, open=false){
  const m = html.match(/^\s*<div class="card"><h2>([\s\S]*?)<\/h2>([\s\S]*)<\/div>\s*$/); if(!m) return html;
  return `<details class="fold card"${open?' open':''}><summary><span class="ft">${m[1]}</span></summary><div class="fb">${m[2]}</div></details>`;
}
function utilSpots(L){
  const g = new Map();
  for(const it of L){
    const e = it.e, c = e.c, u = c.ut;
    if(!(u.flash||u.smoke||u.he||u.molotov)) continue;
    const key = it.m.map+'|'+e.side+'|'+(c.pl||'?');
    const o = g.get(key)||{map:it.m.map, side:e.side, pl:c.pl||'?', kp:'?', kps:[], n:0, fl:0, sm:0, mo:0, he:0, d:[], w:[], fa:[], xf:0};
    o.n++; o.kps.push(c.kp||''); if(u.flash) o.fl++; if(u.smoke) o.sm++; if(u.molotov) o.mo++; if(u.he) o.he++;
    o.d.push(e.dist); o.w.push(e.w); o.fa.push(c.fa);
    const pa = posAnalysis(e); if(pa && pa.tags.includes('crossfire')) o.xf++;
    g.set(key,o);
  }
  const out = [...g.values()].filter(o=>o.n>=2).sort((a,b)=>b.n-a.n || b.fl-a.fl).slice(0,6);
  for(const o of out) o.kp = modeOf(o.kps) || '?';
  return out;
}
function throwAdvice(s){
  const d = medianOf(s.d), w = modeOf(s.w), long = d>=25 || /awp|ssg|scar|g3sg1/i.test(w||''), out = [];
  const kp = s.kp!=='?'?s.kp:'il punto da cui arriva l\'avversario', pl = s.pl!=='?'?s.pl:'la tua posizione';
  if(s.fl){
    if(d<=12) out.push({k:'Flash', t:`Distanza tipica ${f1(d,0)} m: usa una pop flash corta. Tasto destro (lancio basso), contro un muro vicino all'angolo in modo che scoppi dentro la visuale dell'avversario a ${kp}, e affacciati subito allo scoppio.`});
    else if(d<=25) out.push({k:'Flash', t:`Distanza tipica ${f1(d,0)} m: usa una flash media (premi insieme i due tasti), fatta rimbalzare sopra o dietro l'angolo così scoppia su ${kp}; affacciati nel momento in cui scoppia, non prima.`});
    else out.push({k:'Flash', t:`Distanza tipica ${f1(d,0)} m: una flash lunga (tasto sinistro, lancio alto sopra ${kp}) è possibile ma facile da girare; a questa distanza di solito è meglio una smoke che tagli la linea.`});
  }
  if(s.sm){
    if(long) out.push({k:'Smoke', t:`Avversari a ${f1(d,0)} m${/awp|ssg/i.test(w||'')?' con arma da cecchino':''}: una smoke su ${kp} taglia la linea di tiro lunga mentre attraversi o ti riposizioni. È una lineup fissa: impara quella standard di questa mappa e ripetila 10 volte in una mappa di pratica.`});
    else if(s.xf>=Math.ceil(s.n/2)) out.push({k:'Smoke', t:`Qui eri spesso esposto a più angoli insieme: una smoke su uno dei due angoli (${kp} o quello opposto) ti lascia un solo duello da gestire.`});
    else if(d<10) out.push({k:'Molotov / HE', t:`Distanza ravvicinata (${f1(d,0)} m): la smoke serve poco, meglio una molotov o una HE su ${kp} per costringere l'avversario a lasciare l'angolo prima di aprirlo.`});
    else out.push({k:'Smoke', t:`Una smoke su ${kp} da ${pl} toglie la visuale all'avversario e ti dà il tempo di far arrivare un compagno.`});
  }
  if(s.mo||s.he) out.push({k:'Molotov / HE', t:`Avevi ancora ${s.mo?'una molotov':'una HE'}: gettala su ${kp} prima di entrare in ${pl}, così l'avversario deve spostarsi o prende danno prima del duello.`});
  return out;
}
function utilCoach(ms, L){
  const side = state.fSide, U = utilAgg(ms, side);
  const fl = ms.flatMap(m=>m.me.util.filter(u=>u.kind==='flash'&&u.en!==undefined&&sideOk(side,u)));
  const sm = ms.flatMap(m=>m.me.util.filter(u=>u.kind==='smoke'&&u.ne!==undefined&&sideOk(side,u)));
  const nF = U.flashAll||0;
  const per = nF ? U.ef/nF : NaN, tpf = nF ? U.tf/nF : NaN;
  const deathsU = L.filter(it=>{const u=it.e.c.ut; return u.flash||u.smoke||u.he||u.molotov;});
  const VAL = {flash:200, smoke:300, he:300};
  const val = it=>{const u=it.e.c.ut; return u.flash*VAL.flash + u.smoke*VAL.smoke + u.he*VAL.he + u.molotov*(it.e.side==='CT'?500:400);};
  const lost = deathsU.reduce((a,it)=>a+val(it),0);
  const tips = [];
  if(nF>=10 && per<0.6) tips.push(`Accechi in media ${f1(per,2)} nemici per flash (riferimento tipico degli utenti Leetify: 0,6-0,9). Lancia le flash dove i nemici stanno guardando e fai rimbalzare la granata in modo che scoppi nella loro visuale, non dopo che si sono girati.`);
  if(nF>=10 && tpf>=0.3) tips.push(`Accechi ${f1(tpf,2)} compagni per flash: avvisa prima di lanciare ("flash in ...") e non lanciare attraverso le zone dove i compagni stanno entrando.`);
  if(L.length>=8 && deathsU.length/L.length>=0.4) tips.push(`In ${deathsU.length} morti su ${L.length} (${pc(deathsU.length/L.length)}) avevi ancora utility: in media circa ${Math.round(lost/deathsU.length/10)*10} $ di granate ancora in tasca a ogni morte. Prima di ogni contatto lancia la prima flash o smoke che hai in mano.`);
  if(sm.length>=5){ const gd = sm.filter(u=>u.ne>=1).length; if(gd/sm.length<0.5) tips.push(`Solo il ${pc(gd/sm.length)} delle tue smoke aveva un nemico entro ~15 m dal punto di scoppio (metrica Leetify): molte vengono lanciate senza che nessuno stia arrivando. Tienile per l'execute o per tagliare un push che stai sentendo.`); }
  const spots = utilSpots(L);
  const spotHtml = spots.map((s,i)=>{
    const adv = throwAdvice(s);
    const tags = `<span class="tg">${s.n} ${s.n===1?'morte':'morti'}</span>${s.fl?`<span class="tg warm">flash ${s.fl}</span>`:''}${s.sm?`<span class="tg">smoke ${s.sm}</span>`:''}`;
    return `<details class="acc"${i===0?' open':''}><summary><span class="side ${s.side}">${s.side}</span><span class="at">${esc(mapName(s.map))} · in ${esc(s.pl)}</span>${s.kp!=='?'&&s.kp!==s.pl?`<span class="am">di solito ti uccide chi è a ${esc(s.kp)}</span>`:''}<span class="ar">${tags}</span></summary>
      <div class="ab">${adv.map(a=>`<div class="arow"><b>${esc(a.k)}</b><p>${esc(a.t)}</p></div>`).join('')}</div></details>`;
  }).join('');
  const flN = fl.length;
  const kpis = [
    nF ? kpi('Nemici accecati per flash', f1(per,2), `${U.ef} su ${nF} flash (≥1 s) · tipico 0,6-0,9`, per>=0.6?'up':'down') : '',
    nF ? kpi('Compagni accecati per flash', f1(tpf,2), `${U.tf} in totale`, tpf<=0.25?'up':'down') : '',
    flN>=5 ? kpi('Flash che portano una kill', pc(fl.filter(u=>u.fk).length/flN), `su ${flN} flash analizzate`, fl.filter(u=>u.fk).length/flN>=0.1?'up':'mid') : '',
    flN>=5 ? kpi('Flash a vuoto', pc(fl.filter(u=>u.en===0).length/flN), 'nessun nemico accecato', fl.filter(u=>u.en===0).length/flN<=0.4?'up':'down') : '',
    sm.length>=5 ? kpi('Smoke con nemici vicini', pc(sm.filter(u=>u.ne>=1).length/sm.length), `su ${sm.length} smoke`, '') : '',
    L.length ? kpi('Morti con utility in tasca', pc(deathsU.length/L.length), `${deathsU.length} su ${L.length}`, deathsU.length/L.length<=0.25?'up':'down') : ''
  ].join('');
  return `<div class="card"><h2>Flash e smoke: come lanciarle</h2>
    <div class="sub">Gli analisti guardano l'utility come un lavoro per un compagno (togliere una visuale, spostare un difensore, sostenere un duello, aprire la strada alla bomba) e non come granate sparse. Qui i tuoi numeri e, per i punti dove muori con utility in tasca, come usarla.</div>
    <div class="grid kpis" style="margin-top:10px">${kpis}</div>
    ${tips.length?`<div class="sbox"><h3 style="margin:0 0 4px">Cosa dicono i numeri</h3><ul style="margin:0;padding-left:20px">${tips.map(t=>`<li style="margin:4px 0">${esc(t)}</li>`).join('')}</ul></div>`:''}
    ${!flN?`<p class="sub" style="margin-top:8px">I dettagli per ogni flash (nemici accecati, kill dopo la flash) e per ogni smoke si registrano solo per le demo nuove.</p>`:''}
    <div class="sbox"><h3 style="margin:0 0 2px">Dove muori con utility in tasca</h3>
    <div class="sub">Raggruppo le morti per mappa, lato e posizione in cui sei morto. Le indicazioni sono principi ricavati da distanza, arma e numero di avversari; il punto esatto di lancio (lineup) va imparato con una mappa di pratica.</div>
    ${spotHtml ? `<div class="accbar"><button type="button" class="lnk" data-acc="open">Apri tutto</button> · <button type="button" class="lnk" data-acc="close">Chiudi tutto</button></div><div class="accs">${spotHtml}</div>` : '<p class="sub">Servono almeno qualche morte con utility ancora in tasca.</p>'}</div>
    <details class="acc fold2"><summary><span class="at">Tecnica di lancio</span><span class="am">come lanciare flash e smoke, allenamento</span></summary><div class="ab">
    <ul style="margin:6px 0 0;padding-left:20px">
      <li style="margin:4px 0"><b>Tasto sinistro</b> = lancio lungo, <b>destro</b> = lancio corto basso, <b>entrambi</b> = distanza media. Correre in avanti aumenta la distanza, indietro la riduce; da fermo il lancio è più ripetibile.</li>
      <li style="margin:4px 0"><b>Jump throw</b>: tieni premuto il tasto sinistro, salta e rilascia mentre sali. Il bind a tasto unico non funziona più sui server ufficiali, si fa a mano.</li>
      <li style="margin:4px 0"><b>Pop flash</b>: scoppia appena entra nella visuale del nemico, quindi non gli dà il tempo di girarsi. Se è per un compagno avvisalo ("flash in ...") e fallo uscire nel momento dello scoppio; se è per te lanciala poco prima di uscire. Una flash serve a chi segue: se nessuno la sfrutta, è sprecata.</li>
      <li style="margin:4px 0"><b>Smoke</b>: dura circa 20 s e reagisce a HE e proiettili. Una molotov viene spenta da una smoke. Dopo il piazzamento tieni una smoke o una flash per il retake.</li>
      <li style="margin:4px 0"><b>Priorità di acquisto</b> a soldi limitati: smoke, una flash, molotov, seconda flash, HE.</li>
      <li style="margin:4px 0"><b>Allenamento</b>: in una mappa offline con <code>sv_cheats 1</code> usa <code>cl_grenadepreview 1</code> (traiettoria) e <code>sv_rethrow_last_grenade</code> (ripeti l'ultimo lancio). Ripeti ogni lineup 10 volte.</li>
    </ul>
    <p class="srcs">Fonti: ${srcLinks(['grenade','pop','gloss','proexec'])}</p></div></details></div>`;
}
/* Viewer: opens one death large (map + 4 frames) and lets you go to the next/previous one without closing it */
let DV = {list:[], i:0}; const DV_IDX = new Map();
function dvShow(){
  let el = document.getElementById('dv'); if(!el){ el = document.createElement('div'); el.id='dv'; document.body.appendChild(el); }
  const it = DV.list[DV.i], n = DV.list.length, {m,e,rev} = it, c = e.c;
  const causes = rev.filter(r=>r.id!=='ok').map(r=>ECAT[r.id]).filter(Boolean).join(', ') || 'nessuna causa evidente';
  el.innerHTML = `<div class="dv-bg" data-dvclose="1"></div><div class="dv-box">
    <div class="dv-top"><button class="btn" data-dvgo="-1" ${n>1?'':'disabled'}>‹ Prima</button><div class="dv-t"><b>${mapName(m.map)} · round ${e.r} · ${e.side==='T'?'T':'CT'}</b><span>${esc(c.pl||'?')} · ucciso da ${esc(e.killer)} (${esc(wname(e.w))}, ${f1(e.dist,0)} m) · ${causes}</span></div><span class="dv-n">${DV.i+1} di ${n}</span><button class="btn" data-dvgo="1" ${n>1?'':'disabled'}>Dopo ›</button><button class="btn" data-dvclose="1" aria-label="Chiudi">Chiudi ✕</button></div>
    <div class="dv-body"><div class="dv-main">${deathRadar(m,e)}<div class="leg"><span><i style="background:#ffd34d"></i>Tu (✕) e la tua scia</span><span><i style="background:#4aa3ff"></i>Compagni</span><span><i style="background:#ff5c5c"></i>Avversari</span></div></div>
    <div class="dv-fr">${framesStrip(m,e)||'<div class="sub">Fotogrammi non disponibili per questa morte.</div>'}</div></div>
    <div class="dv-hint">Frecce ← → per scorrere, Esc per chiudere</div></div>`;
  el.style.display='flex';
}
function dvOpen(i){ const L = DV.cur || []; if(!L.length || i<0) return; DV.list = L; DV.i = Math.min(i, L.length-1); dvShow(); }
function dvClose(){ const el=document.getElementById('dv'); if(el) el.style.display='none'; }
function dvGo(d){ DV.i = (DV.i + d + DV.list.length) % DV.list.length; dvShow(); const b=document.querySelector('#dv .dv-body'); if(b) b.scrollTop=0; }
document.addEventListener('keydown', e => {
  const el=document.getElementById('dv'); if(!el || el.style.display==='none') return;
  if(e.key==='Escape') dvClose(); else if(e.key==='ArrowRight') dvGo(1); else if(e.key==='ArrowLeft') dvGo(-1);
});
function deathCard(it){
  const {m,e,rev} = it, c = e.c;
  const bad = rev.some(r=>r.sev==='alta'), tag = e.traded ? 'tradata' : 'non tradata';
  return `<div class="card" id="d-${m.id}-${e.r}-${e.tick}"><div class="dcard"><div class="dleft"><div class="dstick"><div class="dzoom" data-dv="${DV_IDX.get(e)??-1}" title="Clicca per ingrandire e scorrere le morti">${deathRadar(m,e)}<span class="dzbtn">Ingrandisci e scorri ›</span></div>
      <div class="leg"><span><i style="background:#ffd34d"></i>Tu (✕) e la tua scia negli ultimi 4 s</span><span><i style="background:#4aa3ff"></i>Compagni</span><span><i style="background:#ff5c5c"></i>Avversari (bordo bianco = chi ti ha ucciso)</span></div></div></div>
    <div class="dright"><div class="dhead"><h3>${mapName(m.map)} · round ${e.r} · ${e.t} s · ${e.side==='T'?'T':'CT'}</h3>
      <div class="sub">${esc(c.pl||'?')} · ${pathTxt(c)} ucciso da ${esc(e.killer)} (${esc(wname(e.w))}${e.hs?', headshot':''}, ${f1(e.dist,0)} m) · morte ${tag} · ${c.ma} ${c.ma===1?'compagno':'compagni'} e ${c.fa} ${c.fa===1?'avversario':'avversari'} ancora vivi</div></div>
      ${recentBlock(e)}
      ${posBlock(e)}
      ${it.rev.map(r=>`<div class="iss ${SEV[r.sev]}"><h4>${esc(r.title)}</h4><p>${esc(r.why)}</p><p class="fix"><b>Cosa fare:</b> ${esc(r.fix)}</p></div>`).join('')}
      <div class="iss ok" style="--ic:#4aa3ff"><h4>Tattica consigliata per un round simile</h4>${tactics(e,rev).map(t=>`<p>• ${esc(t)}</p>`).join('')}<p class="srcs">Fonti: ${srcLinks([...new Set(rev.flatMap(r=>SRC_BY[r.id]||[]))])||'vedi elenco in fondo alla pagina'}</p></div></div></div>${framesStrip(m,e)}</div>`;
}
function timingBars(ms){
  const BIN = 15, N = 8, kills = Array(N).fill(0), deaths = Array(N).fill(0);
  for(const m of ms){
    for(const e of m.me.kills) if(sideOk(state.fSide,e)) kills[Math.min(N-1,Math.floor(e.t/BIN))]++;
    for(const e of m.me.deaths) if(sideOk(state.fSide,e) && !e.teamkill) deaths[Math.min(N-1,Math.floor(e.t/BIN))]++;
  }
  const mx = Math.max(1,...kills,...deaths);
  const cols = kills.map((k,i)=>`<div class="col"><div class="b" style="height:${k/mx*100}%;background:#2bd47d" ${tipAttr(`${i*BIN}-${(i+1)*BIN} s · ${k} kill`)}></div><div class="b" style="height:${deaths[i]/mx*100}%;background:#ff5c5c" ${tipAttr(`${i*BIN}-${(i+1)*BIN} s · ${deaths[i]} morti`)}></div></div>`).join('');
  const labs = kills.map((_,i)=>`<span>${i*BIN}${i===N-1?'+':''}</span>`).join('');
  const D = sum(deaths), K = sum(kills);
  const early = D ? (deaths[0]+deaths[1])/D : NaN, earlyK = K ? (kills[0]+kills[1])/K : NaN;
  return `<div class="card"><h2>Timing: quando muori e quando uccidi</h2><div class="sub">Secondi dall'inizio del round (dopo il freeze time), a gruppi di 15 s. Verde = kill, rosso = morti.</div>
    <div class="bars">${cols}</div><div class="barlab">${labs}</div>
    <p class="sub" style="margin-top:10px">${D?`Il ${pc(early)} delle tue morti arriva nei primi 30 s (${pc(earlyK)} delle kill). `:''}${early>0.5?'Muori troppo presto: aspetta i compagni e usa utility prima del contatto.':early<0.25&&D>=6?'Giochi soprattutto a round avanzato: attenzione ai finali in inferiorità.':'La distribuzione è equilibrata.'}</p></div>`;
}
function placeTable(L){
  const g = new Map();
  for(const it of L){ const k = it.m.map+'|'+it.e.c.pl; const o = g.get(k)||{map:it.m.map,pl:it.e.c.pl,n:0,tr:0}; o.n++; if(it.e.traded) o.tr++; g.set(k,o); }
  const rows = [...g.values()].sort((a,b)=>b.n-a.n).slice(0,8);
  if(!rows.length) return '';
  return `<div class="card"><h2>Dove muori più spesso</h2><div class="sub">Nomi dei punti presi direttamente dalla mappa di gioco. Clicca una riga per vedere solo quelle morti.</div>
    <table><thead><tr><th>Punto</th><th>Mappa</th><th>Morti</th><th>Tradate</th></tr></thead><tbody>${rows.map(r=>`<tr data-eplace="${esc(r.map+'|'+r.pl)}" style="cursor:pointer${state.ePlace===r.map+'|'+r.pl?';background:rgba(74,163,255,.12)':''}"><td>${esc(r.pl||'?')}</td><td>${mapName(r.map)}</td><td>${r.n}</td><td>${r.tr}/${r.n}</td></tr>`).join('')}</tbody></table></div>`;
}
function stackBar(parts){
  const tot = sum(parts, p=>p[1]) || 1;
  return `<div style="display:flex;height:22px;border-radius:6px;overflow:hidden;gap:2px;margin:6px 0">${parts.map(p=>p[1]?`<div style="flex:${p[1]};background:${p[2]};min-width:3px" ${tipAttr(`${p[0]}: ${p[1]} (${pc(p[1]/tot)})`)}></div>`:'').join('')}</div>
  <div class="leg">${parts.map(p=>`<span><i style="background:${p[2]}"></i>${p[0]} ${pc(p[1]/tot)}</span>`).join('')}</div>`;
}
function aimSection(ms){
  const B = ['st','sl','mv'], sh = {st:[0,0],sl:[0,0],mv:[0,0]}, fs = {st:[0,0],sl:[0,0],mv:[0,0]};
  let nm = 0; const K = [], D = [];
  for(const m of ms){
    const mv = m.me.mov;
    if(mv){ nm++; for(const b of B){ sh[b][0]+=mv.all[b][0]; sh[b][1]+=mv.all[b][1]; fs[b][0]+=mv.first[b][0]; fs[b][1]+=mv.first[b][1]; } }
    for(const e of m.me.kills) if(e.a && e.a.e0!=null && sideOk(state.fSide,e)) K.push(e.a);
    for(const e of m.me.deaths) if(e.a && e.a.e0!=null && !e.teamkill && sideOk(state.fSide,e)) D.push(e.a);
  }
  if(!nm && !K.length && !D.length) return `<div class="card"><h2>Mira e movimento</h2><div class="sub">Questi dati si calcolano solo dalle demo analizzate dopo questo aggiornamento. Appena ne analizzi una compaiono qui.</div></div>`;
  const tot = sum(B, b=>sh[b][0]), ft = sum(B, b=>fs[b][0]);
  const hp = d => d[0] ? pc(d[1]/d[0]) : '–';
  const tips = [];
  const stP = tot ? sh.st[0]/tot : NaN, mvP = tot ? sh.mv[0]/tot : NaN, fm = ft ? fs.mv[0]/ft : NaN;
  if(tot>=100 && mvP>0.25) tips.push(`Spari in movimento nel ${pc(mvP)} dei colpi e centri il ${hp(sh.mv)} contro il ${hp(sh.st)} da fermo. Fermati (counter-strafe: tocca il tasto opposto) prima di premere il grilletto: in CS2 la precisione cala molto in movimento.`);
  if(ft>=20 && fm>0.35) tips.push(`Il primo colpo del duello parte in movimento nel ${pc(fm)} dei casi, ed è quello che decide. Rallenta un attimo prima del contatto.`);
  const far = K.filter(a=>a.e0>15).length, near = K.filter(a=>a.e0<=5).length;
  if(K.length>=8 && far/K.length>0.35) tips.push(`Nel ${pc(far/K.length)} delle tue kill il mirino partiva a più di 15° dal bersaglio: devi fare un flick lungo. Tieni il mirino più vicino agli angoli dove compare il nemico.`);
  const Kh = K.filter(a=>a.e1!=null && a.e1<=30), low = Kh.filter(a=>a.dp>4).length, high = Kh.filter(a=>a.dp<-4).length;
  if(Kh.length>=8 && low/Kh.length>0.3) tips.push(`Nel ${pc(low/Kh.length)} dei duelli vinti il primo colpo partiva sotto la testa. Alza il mirino all'altezza della testa mentre ti sposti.`);
  if(Kh.length>=8 && high/Kh.length>0.3) tips.push(`Nel ${pc(high/Kh.length)} dei duelli il primo colpo partiva sopra la testa: abbassa un poco il mirino.`);
  const away = D.filter(a=>a.e0>40).length, ready = D.filter(a=>a.e0<=15).length;
  if(D.length>=8 && away/D.length>0.4) tips.push(`Nel ${pc(away/D.length)} delle morti guardavi altrove (oltre 40°) quando l'avversario ha iniziato a sparare: controlla gli angoli prima di entrare e fai pre-aim.`);
  const kk = (lab,val,ref,cls='')=>kpi(lab,val,ref,cls);
  return `<div class="card"><h2>Mira e movimento</h2>
    <div class="sub">Calcolati sugli spari e sui duelli delle demo analizzate dopo questo aggiornamento (${nm} ${nm===1?'partita':'partite'}). I valori sono stime: posizione della testa e movimento sono ricavati dalle coordinate della demo.</div>
    <div class="grid kpis" style="margin-top:10px">
      ${tot?kk('Colpi da fermo', pc(stP), 'fino a ~45 u/s · centrati '+hp(sh.st), stP>=0.5?'up':'down'):''}
      ${tot?kk('Colpi in movimento', pc(mvP), 'oltre 110 u/s · centrati '+hp(sh.mv), mvP<=0.2?'up':'down'):''}
      ${ft?kk('Primo colpo in movimento', pc(fm), 'su '+ft+' primi colpi', fm<=0.25?'up':'down'):''}
      ${K.length?kk('Mirino già sul bersaglio', pc(near/K.length), 'entro 5° prima del colpo · '+K.length+' kill', near/K.length>=0.4?'up':'mid'):''}
      ${D.length?kk('Guardavi altrove', pc(away/D.length), 'oltre 40° quando ti hanno sparato · '+D.length+' morti', away/D.length<=0.25?'up':'down'):''}
    </div>
    ${tot?`<h3 style="margin:14px 0 2px">Come spari</h3><div class="sub">Tutti i tuoi colpi (cecchini esclusi) in base alla velocità. Tra parentesi la percentuale centrata.</div>${stackBar([['Fermo ('+hp(sh.st)+')',sh.st[0],'#2bd47d'],['Camminando ('+hp(sh.sl)+')',sh.sl[0],'#e8c53a'],['In movimento ('+hp(sh.mv)+')',sh.mv[0],'#ff5c5c']])}`:''}
    ${K.length?`<h3 style="margin:14px 0 2px">Dove si trovava il mirino nelle tue kill</h3><div class="sub">Angolo tra il mirino e la testa del nemico, un quarto di secondo prima del primo colpo.</div>${stackBar([['Entro 5°',near,'#2bd47d'],['5-15°',K.filter(a=>a.e0>5&&a.e0<=15).length,'#e8c53a'],['Oltre 15°',far,'#ff5c5c']])}
      ${Kh.length>=5?`<div class="sub" style="margin-top:8px">Altezza al primo colpo: ${stackBar([['Sulla testa',Kh.length-low-high,'#2bd47d'],['Troppo in basso',low,'#e8c53a'],['Troppo in alto',high,'#9aa7b8']])}</div>`:''}`:''}
    ${D.length?`<h3 style="margin:14px 0 2px">Dove guardavi quando ti hanno sparato</h3><div class="sub">Angolo tra il tuo mirino e l'avversario quando ha iniziato a sparare.</div>${stackBar([['Già su di lui (≤15°)',ready,'#2bd47d'],['Mirino lontano (15-40°)',D.length-ready-away,'#e8c53a'],['Guardavi altrove (>40°)',away,'#ff5c5c']])}`:''}
    ${tips.length?`<h3 style="margin:14px 0 4px">Cosa dicono i numeri</h3><ul style="margin:0;padding-left:20px">${tips.map(t=>`<li style="margin:4px 0">${esc(t)}</li>`).join('')}</ul>`:`<p class="sub" style="margin-top:12px">Nessun problema marcato nei numeri disponibili.</p>`}</div>`;
}
const FOCUS = {isolato:'Resta vicino ai compagni nei duelli', notrade:'Peekate insieme per poter tradare', util:'Usa flash e smoke prima di entrare', flash:'Non fare peek da accecato', entry:'Entra solo con supporto', corsa:'Rallenta prima degli angoli', mira:'Pre-aim: mirino già sull\'angolo', presto:'Non farti vedere troppo presto', dopokill:'Cambia posizione dopo una kill'};
function trendCard(ms, L, top){
  if(!top.length) return '';
  const order = ms.slice().sort((a,b)=>cmpM(b,a)).map(m=>m.id), recent = new Set(order.slice(0,5));
  const R = L.filter(it=>recent.has(it.m.id)), O = L.filter(it=>!recent.has(it.m.id));
  const k = top[0], share = A => A.length ? A.filter(it=>it.rev.some(r=>r.id===k)).length/A.length : NaN;
  let txt = '';
  if(R.length>=6 && O.length>=6){
    const r = share(R), o = share(O), d = r-o;
    txt = d<=-0.08 ? `Nelle ultime 5 partite questa causa è scesa dal ${pc(o)} al ${pc(r)} delle morti: il lavoro sta funzionando.` : d>=0.08 ? `Nelle ultime 5 partite è salita dal ${pc(o)} al ${pc(r)}: è il punto su cui insistere.` : `Nelle ultime 5 partite è stabile (${pc(r)} contro ${pc(o)} prima).`;
  } else txt = 'Servono almeno 6 morti analizzate nelle ultime 5 partite e 6 prima per vedere l\'andamento.';
  return `<div class="card"><h2>Il tuo obiettivo per le prossime 5 partite</h2>
    <div class="sub">Chi fa demo review in modo strutturato sceglie un solo schema che si ripete (almeno tre morti simili) e lavora su quello per cinque partite, invece di cercare di correggere tutto.</div>
    <p style="margin:10px 0 4px;font-size:1.05em"><b>${esc(FOCUS[k])}</b> <span class="sub" style="display:inline">(${ECAT[k]}: ${pc(share(L))} delle tue morti)</span></p>
    <p class="sub" style="margin:0">${esc(DRILL[k]||'')}</p>
    <p style="margin:8px 0 0">${esc(txt)}</p>
    <p class="srcs">Fonti: ${srcLinks(['review'])}</p></div>`;
}
function viewErrori(ms){
  if(!ms.length) return '<div class="empty">Nessuna partita con questi filtri.</div>';
  const L = deathList(ms);
  if(!L.length) return `<div class="empty">Queste partite non hanno il dettaglio delle morti (servono le demo). Scarica le demo e rilancia l'aggiornamento.</div>`;
  const cnt = {}; for(const it of L) for(const id of new Set(it.rev.map(r=>r.id))) cnt[id] = (cnt[id]||0)+1;
  const order = ['isolato','notrade','util','flash','entry','corsa','mira','presto','dopokill','scontro','ok'].filter(k=>cnt[k]);
  const top = order.filter(k=>k!=='ok'&&k!=='scontro').sort((a,b)=>cnt[b]-cnt[a]).slice(0,3);
  let vis = state.eCat==='all' ? L : L.filter(it=>it.rev.some(r=>r.id===state.eCat));
  if(state.ePlace) vis = vis.filter(it=>it.m.map+'|'+it.e.c.pl===state.ePlace);
  const miss = ms.filter(m=>m.me.deaths.length && !m.me.deaths.some(e=>e.c)).length;
  const missNote = miss ? `<div class="note">${miss} ${miss===1?'partita non ha':'partite non hanno'} il dettaglio delle morti perché ${miss===1?'è stata analizzata':'sono state analizzate'} prima di questa funzione e la demo è già stata cancellata. Contano solo le demo da ora in poi.</div>` : '';
  const aim = aimSection(ms);
  const note = missNote + (L.length<20 ? `<div class="note">Analizzate ${L.length} morti di ${ms.length} ${ms.length===1?'partita':'partite'}: sono indizi, non verdetti. Il quadro diventa solido dopo qualche partita in più.</div>` : '');
  return `${note}
  <div class="card"><h2>Cosa ti costa più round</h2><div class="sub">Su ${L.length} morti analizzate. Una morte può avere più cause.</div>
    ${top.length?`<div class="causes">${top.map((k,i)=>`<div class="cause"><div class="ch"><b>${i+1} · ${ECAT[k]}</b><span class="cv">${pc(cnt[k]/L.length)}</span></div><div class="bar"><i style="width:${Math.min(100,cnt[k]/L.length*100)}%;background:var(--warn)"></i></div><div class="sub">${cnt[k]} morti su ${L.length}. ${esc(FOCUS[k])}.${i?`<br>${esc(DRILL[k]||'')}`:''}</div></div>`).join('')}</div>`:'<p class="sub">Nessun segnale ricorrente.</p>'}
    <details class="mini"><summary>Come leggere questi dati</summary><div class="sub">${cnt.scontro||0} morti su ${L.length} (${pc((cnt.scontro||0)/L.length)}) sono avvenute in pieno scontro: kill appena fatta o compagno caduto vicino, non conteggiate come errori di reazione. I segnali sono regole sui dati della demo: valuta sempre se nel contesto del round avevano senso.</div></details>
    <div class="fbar2"><label>Causa <select id="eCatSel"><option value="all">Tutte (${L.length})</option>${order.map(k=>`<option value="${k}" ${state.eCat===k?'selected':''}>${ECAT[k]} (${cnt[k]})</option>`).join('')}</select></label>
      ${state.ePlace?`<button type="button" class="fchip" data-eplace="${esc(state.ePlace)}" title="Togli il filtro">Punto: ${esc(state.ePlace.split('|')[1]||'?')} ✕</button>`:''}</div></div>
  ${trendCard(ms, L, top)}
  ${utilCoach(ms, L)}
  ${aim}
  ${foldCard(posSummary(L), true)}
  ${foldCard(workshopCard(ms,cnt,L))}
  <div class="grid g2">${timingBars(ms)}${placeTable(L)}</div>
  <h2 style="margin:22px 0 4px">Le singole morti</h2>
  <div class="sub" style="margin-bottom:8px">Il dettaglio di ogni morte (mappa, fotogrammi, cosa fare) è dentro la singola partita, nel tab "Errori". Clicca una riga per aprirla direttamente.</div>
  ${vis.length?`<div class="card"><div class="scroll"><table class="timeline"><thead><tr><th>Partita</th><th>Mappa</th><th>Round</th><th>Lato</th><th>Dove</th><th>Cause</th></tr></thead><tbody>${vis.slice(0,state.eShown).map(it=>`<tr class="click" data-gomatch="${it.m.id}" data-gofocus="d-${it.m.id}-${it.e.r}-${it.e.tick}"><td>#${idxOf(it.m)}</td><td>${mapName(it.m.map)}</td><td>${it.e.r}</td><td><span class="side ${it.e.side}">${it.e.side}</span></td><td style="text-align:left">${esc(it.e.c.pl||'?')}</td><td style="text-align:left;white-space:normal">${it.rev.filter(r=>r.id!=='ok').map(r=>ECAT[r.id]).join(', ')||'nessuna evidente'}</td></tr>`).join('')}</tbody></table></div></div>`:'<div class="empty">Nessuna morte con questo filtro.</div>'}
  ${vis.length>state.eShown?`<p style="text-align:center"><button class="btn" data-emore="1">Mostra altre (${vis.length-state.eShown})</button></p>`:''}
  ${foldCard(sourcesCard())}`;
}

