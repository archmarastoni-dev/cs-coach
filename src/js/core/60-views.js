/* Views: tabs (overview, matches, maps, utility, weapons, coach) */
const TABS = LITE ? [['panoramica','Panoramica']] : [['panoramica','Panoramica'],['partite','Partite'],['mappe','Mappe'],['utility','Utility e smoke'],['errori','Errori e fix'],['armi','Armi e mira'],['coach','Coach']];

function renderChrome(){
  if(LITE){ $('#strip').innerHTML = `<span class="who">${DATA.title||''} · ${state.matches.length} partite recenti</span>`; $('#filters').innerHTML=''; $('#tabs').style.display='none'; document.querySelector('.hact').style.display='none'; return; }
  $('#tabs').style.display = state.learn.on ? 'none' : '';
  const who = (state.matches[0] && me(state.matches[0]) ? me(state.matches[0]).name : '') + ' · ' + state.matches.length + (state.matches.length===1?' partita':' partite');
  const maps = [...new Set(state.matches.map(m=>m.map))], kinds = [...new Set(state.matches.map(kindOf))];
  $('#filters').innerHTML = `
    <div class="fg"><span class="fl">Mappa</span><select id="fMap"><option value="all">Tutte</option>${maps.map(m=>`<option value="${m}" ${state.fMap===m?'selected':''}>${mapName(m)}</option>`).join('')}</select></div>
    ${kinds.length>1?`<div class="fg"><span class="fl">Tipo</span><select id="fKind"><option value="all">Tutti</option>${kinds.map(k=>`<option value="${k}" ${state.fKind===k?'selected':''}>${k}</option>`).join('')}</select></div>`:''}
    <div class="fg"><span class="fl">Lato</span><span class="seg" id="fSide">${['all','CT','T'].map(s=>`<button data-v="${s}" aria-pressed="${state.fSide===s}">${s==='all'?'Tutti':s}</button>`).join('')}</span></div>
    <div class="fg"><span class="fl">Esito</span><span class="seg" id="fRes">${[['all','Tutti'],['W','Vinte'],['L','Perse']].map(([s,t])=>`<button data-v="${s}" aria-pressed="${state.fRes===s}">${t}</button>`).join('')}</span></div>
    <div class="fg"><span class="fl">Dati</span><span class="seg" id="mode">${[['base','Base'],['adv','Avanzati']].map(([s,t])=>`<button data-v="${s}" aria-pressed="${state.mode===s}">${t}</button>`).join('')}</span></div>`;
  const act = [['fMap', state.fMap!=='all' ? 'Mappa: '+mapName(state.fMap) : ''], ['fKind', state.fKind!=='all' ? 'Tipo: '+state.fKind : ''], ['fSide', state.fSide!=='all' ? 'Lato: '+state.fSide : ''], ['fRes', state.fRes!=='all' ? (state.fRes==='W'?'Solo vinte':'Solo perse') : '']].filter(x=>x[1]);
  $('#strip').innerHTML = `<span class="who">${who}</span>${act.map(([k,t])=>`<button type="button" class="fchip" data-clr="${k}" title="Togli questo filtro">${t} ✕</button>`).join('')}`;
  $('#fDot').hidden = !act.length; $('#fBtn').firstChild.textContent = act.length ? 'Filtri · '+act.length : 'Filtri';
  $('#moreItems').innerHTML = `<button type="button" class="mitem" id="btnImp">Importa dati…</button><button type="button" class="mitem" data-learn="${state.learn.on?0:1}">${state.learn.on?'← Torna all\'analisi':'E-learning'}</button>`;
  $('#tabs').innerHTML = TABS.map(([k,t])=>`<button role="tab" data-tab="${k}" aria-selected="${state.tab===k}">${t}</button>`).join('');
}

function kpi(lab, val, ref, cls='', trend=''){
  return `<div class="card kpi"><div class="lab">${lab}</div><div class="val ${cls}">${val}</div><div class="ref">${trend}${ref||'&nbsp;'}</div></div>`;
}
/* Trend arrow on a KPI card: the last 5 matches against the ones before them (needs at least 3 older matches). */
function trendOf(ms, side, fn, dec, unit=''){
  if(ms.length < 8) return '';
  const a = fn(agg(ms.slice(-5), side)), b = fn(agg(ms.slice(0,-5), side)), d = a - b;
  if(!isFinite(d)) return '';
  const q = Math.pow(10, -dec) / 2, flat = Math.abs(d) < q;
  const cls = flat ? 'flat' : d > 0 ? 'up' : 'down';
  return `<span class="trend ${cls}" ${tipAttr('Ultime 5 partite: '+a.toFixed(dec)+unit+' · prima: '+b.toFixed(dec)+unit)}>${flat?'▬':d>0?'▲':'▼'} ${Math.abs(d).toFixed(dec)}${unit}</span>`;
}

function trendSVG(ms, side, key){
  const defs = {rating:['Rating',a=>a.rating,2], adr:['ADR',a=>a.adr,1], kd:['K/D',a=>a.kd,2], kastP:['KAST %',a=>a.kastP*100,0], hsP:['HS %',a=>a.hsP*100,0], okP:['Opening win %',a=>a.okP*100,0]};
  const [lab, fn, dec] = defs[key];
  const pts = ms.map(m => ({m, v: fn(agg([m], side))})).filter(p => isFinite(p.v));
  if(!pts.length) return '<div class="empty">Nessun dato</div>';
  const W=720,H=220,pl=44,pr=24,pt=14,pb=28;
  const vs = pts.map(p=>p.v); let lo=Math.min(...vs), hi=Math.max(...vs); if(lo===hi){lo-=1;hi+=1;} const pad=(hi-lo)*.15; lo-=pad; hi+=pad;
  const X = i => pl + (pts.length===1 ? (W-pl-pr)/2 : i*(W-pl-pr)/(pts.length-1));
  const Y = v => pt + (1-(v-lo)/(hi-lo))*(H-pt-pb);
  const avg = vs.reduce((a,b)=>a+b,0)/vs.length;
  let g=''; for(let i=0;i<=3;i++){ const v=lo+(hi-lo)*i/3; g+=`<line x1="${pl}" x2="${W-pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${pl-6}" y="${Y(v)+4}" text-anchor="end" fill="var(--ink-3)" font-size="11">${v.toFixed(dec)}</text>`; }
  const step = Math.max(1, Math.ceil(pts.length/12));
  const path = pts.map((p,i)=>`${i?'L':'M'}${X(i)} ${Y(p.v)}`).join('');
  // running average from the first match to each match: it moves around the fixed total average (dashed) and shows the historical drift
  const N = pts.length >= 8 ? 3 : 0, RN = Math.min(10, Math.max(3, Math.floor(pts.length/2)));
  let maSvg = '', chip = '';
  if(N){
    let acc = 0; const ma = vs.map((v,i)=>{ acc += v; return i < N-1 ? null : acc/(i+1); });
    const ix = ma.map((v,i)=>v==null?null:i).filter(i=>i!=null), i0 = ix[0], i1 = ix[ix.length-1];
    maSvg = `<path d="${ix.map((i,j)=>`${j?'L':'M'}${X(i)} ${Y(ma[i])}`).join('')}" fill="none" stroke="var(--warn)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${X(i1)}" cy="${Y(ma[i1])}" r="6" fill="var(--warn)" stroke="var(--surface)" stroke-width="2"/>`;
    const rec = vs.slice(-RN).reduce((a,b)=>a+b,0)/RN, d = rec - avg, flat = Math.abs(d) < Math.pow(10,-dec)/2;
    chip = `<div class="tchip"><span class="chip ${flat?'flat':d>0?'up':'down'}">${flat?'▬ in linea con la media':(d>0?'▲ ':'▼ ')+Math.abs(d).toFixed(dec)+(d>0?' sopra':' sotto')+' la media totale'}</span><span class="sub" style="margin-left:8px">ultime ${RN} partite: ${rec.toFixed(dec)} · media totale: ${avg.toFixed(dec)}</span></div>`;
  }
  const dots = pts.map((p,i)=>{ const win = p.m.result==='W', tip = tipAttr('#'+idxOf(p.m)+' '+mapName(p.m.map)+' · '+p.m.score.us+'-'+p.m.score.them+' · '+lab+' '+p.v.toFixed(dec));
    return (win ? `<circle cx="${X(i)}" cy="${Y(p.v)}" r="5.5" fill="var(--good)" ${tip}/>` : `<circle cx="${X(i)}" cy="${Y(p.v)}" r="4.5" fill="var(--surface)" stroke="var(--bad)" stroke-width="2.2" ${tip}/>`)
    + (i%step===0||i===pts.length-1?`<text x="${X(i)}" y="${H-8}" text-anchor="middle" fill="var(--ink-3)" font-size="11.5">#${idxOf(p.m)}</text>`:''); }).join('');
  return `${chip}<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Andamento ${lab}">${g}
    <line x1="${pl}" x2="${W-pr}" y1="${Y(avg)}" y2="${Y(avg)}" stroke="var(--ink-2)" stroke-width="1.6" stroke-dasharray="6 4"/>
    <path d="${path}" fill="none" stroke="var(--line)" stroke-width="1.5"/>${dots}${maSvg}</svg>
    <div class="legend"><span><svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="var(--good)"/></svg> Vinta</span><span><svg width="12" height="12"><circle cx="6" cy="6" r="4" fill="none" stroke="var(--bad)" stroke-width="2"/></svg> Persa</span>${N?`<span><svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke="var(--warn)" stroke-width="3"/></svg> Media da inizio a oggi (si muove)</span>`:''}<span><svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke="var(--ink-3)" stroke-dasharray="4 3"/></svg> Media totale ${avg.toFixed(dec)} (fissa)</span></div>`;
}

function profileCard(){
  if(!LITE || !PROFILE) return '';
  const P = PROFILE, F = P.faceit, R = P.premier;
  const box = (lab, val, sub) => `<div class="card kpi"><div class="lab">${lab}</div><div class="val">${val}</div><div class="ref">${sub||'&nbsp;'}</div></div>`;
  return `<div class="grid kpis">
    ${F&&F.elo&&F.elo!=='?'?box('FACEIT', `Lv ${esc(String(F.level))} · ${esc(String(F.elo))}`, `ELO · agg. ${esc(F.updated||'')} · <a href="https://www.faceit.com/en/players/${encodeURIComponent(F.nick||'')}" target="_blank" rel="noopener noreferrer">profilo</a>`):''}
    ${R?box('Premier', esc(String(R.rating)), `rating · agg. ${esc(R.updated||'')}`):''}
  </div>`;
}
function viewPanoramica(ms){
  const side = state.fSide, A = agg(ms, side), U = utilAgg(ms, side);
  const adv = state.mode==='adv';
  const k = [
    kpi('Rating (stima)', f1(A.rating,2), 'rif. '+REF.rating.toFixed(2), cmpClass(A.rating,REF.rating), trendOf(ms,side,a=>a.rating,2)),
    kpi('K/D', f1(A.kd,2), `${A.k} kill · ${A.d} morti`, cmpClass(A.kd,REF.kd), trendOf(ms,side,a=>a.kd,2)),
    kpi('ADR', f1(A.adr,0), 'rif. '+REF.adr, cmpClass(A.adr,REF.adr), trendOf(ms,side,a=>a.adr,0)),
    kpi('KAST', pc(A.kastP), 'rif. '+pc(REF.kastP), cmpClass(A.kastP,REF.kastP), trendOf(ms,side,a=>a.kastP*100,0,' pt')),
    kpi('HS %', pc(A.hsP), 'rif. '+pc(REF.hsP), cmpClass(A.hsP,REF.hsP), trendOf(ms,side,a=>a.hsP*100,0,' pt')),
    kpi('Partite vinte', `${A.mw}/${A.n}`, side==='all'?'':'(esito partita)'),
    kpi('Round vinti', pc(A.rwP), `${A.rw} su ${A.R}`, cmpClass(A.rwP,REF.rwP), trendOf(ms,side,a=>a.rwP*100,0,' pt'))
  ];
  if(adv) k.push(
    kpi('Duelli d\'apertura', pc(A.okP), `${A.ok} vinti · ${A.od} persi`, cmpClass(A.okP,REF.okP)),
    kpi('Morti tradate', pc(A.trP), `${A.trD} su ${A.d} · rif. ${pc(REF.trP)}`, cmpClass(A.trP,REF.trP)),
    kpi('Trade kill', A.tk, 'kill dopo la morte di un compagno'),
    kpi('Clutch', `${A.clW}/${A.clA}`, 'vinti / tentati'),
    kpi('Round con 3+ kill', A.mk[3]+A.mk[4]+A.mk[5], `2K: ${A.mk[2]} · 3K: ${A.mk[3]} · 4K+: ${A.mk[4]+A.mk[5]}`),
    kpi('Sopravvivenza', pc(A.survP), 'round chiusi vivo'),
    kpi('Nemici accecati', U.ef, `${f1(U.eft,0)} s totali · ${U.fa} assist flash`),
    kpi('Danni utility', f1(U.heD+U.moD,0), `HE ${f1(U.heD,0)} · molotov ${f1(U.moD,0)}`)
  );
  // per map
  const maps = [...new Set(ms.map(m=>m.map))];
  const mrows = maps.map(mp => { const mm = ms.filter(m=>m.map===mp), a = agg(mm, side), c = agg(mm,'CT'), t = agg(mm,'T');
    return `<tr class="${LITE?'':'click'}" data-goto-map="${mp}"><td>${mapName(mp)}</td><td>${mm.length}</td><td>${a.mw}-${a.n-a.mw}</td><td>${f1(a.rating,2)}</td><td>${f1(a.adr,0)}</td><td>${f1(a.kd,2)}</td><td>${pc(c.rwP)}</td><td>${pc(t.rwP)}</td></tr>`; }).join('');
  // side
  const sd = ['CT','T'].map(s => { const a = agg(ms,s); return `<tr><td><span class="side ${s}">${s}</span></td><td>${a.R}</td><td>${pc(a.rwP)}</td><td>${f1(a.kd,2)}</td><td>${f1(a.adr,0)}</td><td>${pc(a.kastP)}</td><td>${pc(a.okP)}</td></tr>`; }).join('');
  // economy
  let ecoHTML = '';
  if(adv){
    const E = econ(ms, side);
    ecoHTML = `<div class="card"><h2>Prestazione per tipo di buy</h2><div class="sub">Classificato dal valore dell'equipaggiamento a inizio round: pistol (round 1 e 13), eco sotto 1500, force 1500-3999, full buy da 4000.</div>
      <div class="scroll"><table><thead><tr><th>Buy</th><th>Round</th><th>Vinti</th><th>K/D</th><th>ADR</th></tr></thead><tbody>${Object.entries(E).map(([n,rs])=>{
        const k=sum(rs,r=>r.k), d=sum(rs,r=>r.d), dm=sum(rs,r=>r.dmg); return `<tr><td>${n}</td><td>${rs.length}</td><td>${pc(sum(rs,r=>r.won?1:0)/Math.max(1,rs.length))}</td><td>${f1(k/Math.max(1,d),2)}</td><td>${f1(dm/Math.max(1,rs.length),0)}</td></tr>`;}).join('')}</tbody></table></div></div>`;
    // timing
    const bk = [[0,15],[15,30],[30,45],[45,60],[60,999]], kc = bk.map(()=>0), dc = bk.map(()=>0);
    for(const m of ms){ for(const e of m.me.kills) if(sideOk(side,e)) kc[bk.findIndex(b=>e.t>=b[0]&&e.t<b[1])]++; for(const e of m.me.deaths) if(sideOk(side,e)&&!e.teamkill) dc[bk.findIndex(b=>e.t>=b[0]&&e.t<b[1])]++; }
    const mx = Math.max(1,...kc,...dc);
    ecoHTML += `<div class="card"><h2>Quando fai kill e quando muori</h2><div class="sub">Secondi dall'inizio del round (dopo il freeze time).</div>
      <div class="legend"><span><span class="dot" style="background:var(--good)"></span> Kill</span><span><span class="dot" style="background:var(--bad)"></span> Morti</span></div>
      ${bk.map((b,i)=>`<div class="hrow"><span>${b[0]}${b[1]>=999?'+':'-'+b[1]} s</span><div><div class="bar" ${tipAttr(kc[i]+' kill')}><i style="width:${kc[i]/mx*100}%;background:var(--good)"></i></div><div class="bar" style="margin-top:3px" ${tipAttr(dc[i]+' morti')}><i style="width:${dc[i]/mx*100}%;background:var(--bad)"></i></div></div><span class="n">${kc[i]} / ${dc[i]}</span></div>`).join('')}</div>`;
  }
  return `${profileCard()}<div class="grid kpis">${k.join('')}</div>${liteNote()}
  <div class="grid g21">
    <div class="card"><h2>Andamento partita per partita</h2><div class="sub">Ogni punto è una partita. La linea oro è la media delle ultime 15: se scende, stai peggiorando.</div>
      <div class="chips" id="trendChips">${[['rating','Rating'],['adr','ADR'],['kd','K/D'],['kastP','KAST'],['hsP','HS %'],['okP','Duelli apertura']].map(([k2,t])=>`<button data-trend="${k2}" aria-pressed="${state.trend===k2}">${t}</button>`).join('')}</div>
      ${trendSVG(ms, side, state.trend)}</div>
    <div class="card"><h2>CT contro T</h2><div class="sub">Il lato è sempre quello che giocavi in quel round.</div>
      <div class="scroll"><table><thead><tr><th>Lato</th><th>Round</th><th>Vinti</th><th>K/D</th><th>ADR</th><th>KAST</th><th>Apertura</th></tr></thead><tbody>${sd}</tbody></table></div></div>
  </div>
  <div class="card"><h2>Mappa per mappa</h2><div class="sub">${LITE?'Risultati sulle ultime partite.':'Clicca una mappa per vedere dove uccidi e dove muori.'}</div>
    <div class="scroll"><table><thead><tr><th>Mappa</th><th>Partite</th><th>V-P</th><th>Rating</th><th>ADR</th><th>K/D</th><th>Round vinti CT</th><th>Round vinti T</th></tr></thead><tbody>${mrows}</tbody></table></div></div>
  ${adv ? `<div class="grid g2">${ecoHTML}</div>` : ''}
  <div class="note">Rating, KAST e riferimenti sono stime: il rating usa la formula pubblica HLTV 1.0, i riferimenti (K/D 1.00, ADR 75, KAST 70%, HS 45%) sono valori indicativi di un giocatore medio, non dati ufficiali. Con poche partite le medie cambiano molto.</div>`;
}

function liteCard(){
  if(!state.lite.length || state.fMap!=='all' || state.fKind!=='all') return '';
  const L = state.lite.filter(l => (state.fRes==='all' || l.result===state.fRes) && (!state.hFrom || (l.played||'').slice(0,10) >= state.hFrom) && (!state.hTo || (l.played||'').slice(0,10) <= state.hTo));
  const rows = L.map(l => `<tr><td>${dShort(l.played)}</td><td><span class="pill ${l.result}">${l.score.us}-${l.score.them}</span></td><td>${l.k}</td><td>${l.a}</td><td>${l.d}</td><td>${f1(l.k/Math.max(1,l.d),2)}</td><td>${pc(l.k?l.hs/l.k:NaN)}</td><td>${l.mvp}</td><td>${f1(l.rating,2)}</td><td>${Math.round(l.duration/60)} min</td></tr>`).join('');
  return `<div class="card"><h2>Partite senza demo</h2><div class="sub">Dati dal tabellone salvato da CS2 (file .info): risultato, kill, assist, morti, headshot e MVP. Mancano mappa, ADR, smoke e posizioni, perché servono i dati della demo. Il rating è una stima senza ADR.</div>
    <div class="scroll"><table><thead><tr><th>Data</th><th>Score</th><th>K</th><th>A</th><th>D</th><th>K/D</th><th>HS%</th><th>MVP</th><th>Rating</th><th>Durata</th></tr></thead><tbody>${rows}</tbody></table></div>${L.length?'':'<div class="empty">Nessuna partita con questi filtri.</div>'}</div>`;
}
function liteNote(){
  if(LITE || !state.lite.length) return '';
  const all = [...state.matches.map(m => ({res:m.result, k:me(m).kills, d:me(m).deaths})), ...state.lite.map(l => ({res:l.result, k:l.k, d:l.d}))];
  const w = all.filter(x=>x.res==='W').length, k = sum(all,x=>x.k), d = sum(all,x=>x.d);
  return `<div class="note">Contando anche le partite senza demo il tuo storico è di ${all.length} partite: ${w} vinte, ${all.length-w} perse, K/D ${f1(k/Math.max(1,d),2)}. I numeri qui sotto usano solo le ${state.matches.length} con demo. Le altre sono nella scheda Partite.</div>`;
}
function viewPartite(ms){
  if(state.sel){
    const m = state.matches.find(x=>x.id===state.sel);
    if(m) return viewMatch(m);
    state.sel = null;
  }
  const side = state.fSide, adv = state.mode==='adv';
  const inRange = m => { const d = (m.played||'').slice(0,10); return (!state.hFrom || (d && d >= state.hFrom)) && (!state.hTo || (d && d <= state.hTo)); };
  const total = ms.length; ms = ms.filter(inRange);
  const rows = ms.map(m => { const a = agg([m], side), u = utilAgg([m], side);
    return {m, played: m.played||'', idx: idxOf(m), kind: kindOf(m), map: mapName(m.map), res: m.score.us - m.score.them, rating: a.rating, kd: a.kd, k: a.k, d: a.d, a: a.a, adr: a.adr, hs: a.hsP, kast: a.kastP, ok: a.okP, tr: a.trP, cl: a.clW, ef: u.ef}; });
  const key = state.sortKey, dir = state.sortDir;
  rows.sort((x,y) => (x[key] > y[key] ? 1 : x[key] < y[key] ? -1 : 0) * dir);
  const ed = state.hEdit, up = (state.sortKey==='idx' && state.sortDir>0) ? -1 : 1;   // direction of the # for the row above
  const cols = [['idx','#'],['played','Data'],['kind','Tipo'],['map','Mappa'],['res','Score'],['rating','Rating'],['k','K'],['a','A'],['d','D'],['kd','K/D'],['adr','ADR'],['hs','HS%'],['kast','KAST']];
  if(adv) cols.push(['ok','Apertura'],['tr','Trade'],['cl','Clutch'],['ef','Flash']);
  const head = cols.map(([k,t])=>!k?`<th>${t}</th>`:`<th class="sortable" data-sort="${k}" ${key===k?`aria-sort="${dir>0?'ascending':'descending'}"`:''}>${t}${key===k?(dir>0?' ▲':' ▼'):''}</th>`).join('');
  if(ed) cols.push(['','Ordine']);
  const body = rows.map(r => `<tr class="click" data-match="${r.m.id}"><td>${r.idx}</td><td>${ed?`<input type="date" class="hdate" data-dateid="${r.m.id}" value="${(r.played||'').slice(0,10)}">`:dShort(r.played)}</td><td><span class="kind k-${r.kind}">${r.kind}</span></td><td>${r.map}</td><td><span class="pill ${r.m.result}">${r.m.score.us}-${r.m.score.them}</span>${suspect(r.m)?` <span class="warnb" ${tipAttr(suspect(r.m))} >⚠</span>`:''}</td><td>${f1(r.rating,2)}</td><td>${r.k}</td><td>${r.a}</td><td>${r.d}</td><td>${f1(r.kd,2)}</td><td>${f1(r.adr,0)}</td><td>${pc(r.hs)}</td><td>${pc(r.kast)}</td>${adv?`<td>${pc(r.ok)}</td><td>${pc(r.tr)}</td><td>${r.cl}</td><td>${r.ef}</td>`:''}${ed?`<td class="nowrap"><button class="btn mv" data-mv="${up}|${r.m.id}" title="Sposta in alto di una posizione">▲</button> <button class="btn mv" data-mv="${-up}|${r.m.id}" title="Sposta in basso di una posizione">▼</button></td>`:''}</tr>`).join('');
  const kinds = [...new Set(state.matches.map(kindOf))], maps = [...new Set(state.matches.map(m=>m.map))];
  const filt = state.fKind!=='all' || state.fMap!=='all' || state.fRes!=='all' || state.hFrom || state.hTo;
  const bar = `<div class="hbar">
    <label>Tipo <select id="hKind"><option value="all">Tutti</option>${kinds.map(k=>`<option value="${k}" ${state.fKind===k?'selected':''}>${k}</option>`).join('')}</select></label>
    <label>Mappa <select id="hMap"><option value="all">Tutte</option>${maps.map(m=>`<option value="${m}" ${state.fMap===m?'selected':''}>${mapName(m)}</option>`).join('')}</select></label>
    <label>Esito <select id="hRes">${[['all','Tutti'],['W','Vinte'],['L','Perse']].map(([v,t])=>`<option value="${v}" ${state.fRes===v?'selected':''}>${t}</option>`).join('')}</select></label>
    <label>Dal <input type="date" id="hFrom" value="${state.hFrom}"></label>
    <label>Al <input type="date" id="hTo" value="${state.hTo}"></label>
    ${filt?'<button class="btn" data-hreset="1">Azzera filtri</button>':''}
    <span class="hcount">${rows.length} di ${state.matches.length} partite</span>
    <button class="btn ${ed?'on':''}" data-hedit="1" aria-pressed="${ed}">${ed?'Fine modifica':'Modifica numero e data'}</button>
  </div>${ed?`<div class="note">Modifica attiva: con ▲ e ▼ sposti una partita in alto o in basso di una posizione (cambia il numero #). Se correggi una data, le partite si riordinano per data. Le modifiche restano in questo programma sul tuo computer. <button class="btn" data-hauto="1">Ripristina ordine automatico</button></div>`:''}`;
  return `<div class="card"><h2>Storico partite</h2><div class="sub">Clicca una partita per scoreboard, round per round e mappa. Clicca un'intestazione per cambiare l'ordine della tabella. Il numero # segue la data; se manca il file .info la data non è disponibile e l'ordine è approssimativo: in quel caso usa "Modifica numero e data".</div>
    ${bar}
    <div class="scroll"><table><thead><tr>${head}</tr></thead><tbody>${body || ''}</tbody></table></div>${rows.length?'':'<div class="empty">Nessuna partita con questi filtri.</div>'}</div>${liteCard()}`;
}


function matchAnalysis(m){
  const me = m.players.find(p=>p.sid===SID); if(!me) return '<div class="empty">Giocatore non trovato nella partita.</div>';
  const mates = m.players.filter(p=>p.mine_team), foes = m.players.filter(p=>!p.mine_team), sc = m.score, R = me.rounds||1;
  const adr = p=>p.damage/p.rounds, kastP = p=>p.kast/p.rounds, hsP = p=>p.kills?p.hs/p.kills:NaN;
  const others = state.matches.filter(x=>x!==m).map(x=>x.players.find(p=>p.sid===SID)).filter(Boolean);
  const base = f => { const a = others.map(f).filter(isFinite); return a.length ? sum(a)/a.length : NaN; };
  const mt = mates.filter(p=>p!==me), avgM = f => mt.length ? sum(mt,f)/mt.length : NaN, avgF = f => sum(foes,f)/Math.max(1,foes.length);
  const rank = f => 1 + mates.filter(p=>f(p)>f(me)).length;
  const good = [], bad = [], info = [];
  const G = (t,d)=>good.push({t,d}), B = (t,d,id)=>bad.push({t,d,id});
  const bl = (f,fmt) => { const b = base(f); return isFinite(b) ? ` (tua media nelle altre ${others.length} partite: ${fmt(b)})` : ''; };
  /* result and team */
  const won = m.result==='W';
  /* rating / impact */
  if(me.rating>=1.1) G('Rating alto', `${f1(me.rating,2)}, ${rank(p=>p.rating)}° della tua squadra (media compagni ${f1(avgM(p=>p.rating),2)}).`);
  else if(me.rating<0.9) B('Rating basso', `${f1(me.rating,2)}, ${rank(p=>p.rating)}° della tua squadra (media compagni ${f1(avgM(p=>p.rating),2)}).`);
  else info.push(`Rating ${f1(me.rating,2)}, ${rank(p=>p.rating)}° su ${mates.length} nella tua squadra.`);
  const a = adr(me), am = avgM(adr);
  if(a>=am*1.1) G('Danni per round sopra i compagni', `ADR ${f1(a,0)} contro ${f1(am,0)} dei compagni${bl(adr,x=>f1(x,0))}.`);
  else if(a<=am*0.9) B('Pochi danni per round', `ADR ${f1(a,0)} contro ${f1(am,0)} dei compagni${bl(adr,x=>f1(x,0))}. Stai facendo meno danni del resto della squadra.`,'mira');
  const k = kastP(me);
  if(k>=0.7) G('Round in cui hai contribuito (KAST)', `${pc(k)} dei round con una kill, un assist, sopravvivenza o trade${bl(kastP,pc)}.`);
  else if(k<0.55) B('Poco contributo nei round (KAST)', `Solo ${pc(k)} dei round con kill, assist, sopravvivenza o trade${bl(kastP,pc)}.`,'notrade');
  info.push(`K/A/D ${me.kills}/${me.assists}/${me.deaths} (${me.kills-me.deaths>0?'+':''}${me.kills-me.deaths}), HS ${pc(hsP(me))}${bl(hsP,pc)}.`);
  /* side */
  for(const s of ['CT','T']){
    const sd = me.side && me.side[s], n = sc[s.toLowerCase()+'_rounds'], w = sc[s.toLowerCase()+'_won'];
    if(!sd || !n) continue;
    const kd = sd.deaths ? sd.kills/sd.deaths : sd.kills;
    info.push(`Lato ${s}: la squadra ha vinto ${w} round su ${n}; tu ${sd.kills} kill e ${sd.deaths} morti (K/D ${f1(kd,2)}). Il risultato dei round dipende da tutta la squadra, non solo da te.`);
    if(kd>=1.3 && sd.kills>=5) G(`Buon K/D da ${s}`, `${sd.kills} kill e ${sd.deaths} morti.`);
    else if(kd<=0.7 && sd.deaths>=5) B(`K/D basso da ${s}`, `${sd.kills} kill e ${sd.deaths} morti.`);
  }
  /* openings and trades */
  const ok = me.opening_kills, od = me.opening_deaths;
  if(ok+od>=2){ if(ok>od) G('Duelli di apertura vinti', `${ok} aperture vinte e ${od} perse.`); else if(od>ok) B('Duelli di apertura persi', `${ok} aperture vinte e ${od} perse: primo morto del round ${od} volte.`,'entry'); }
  const tr = me.deaths ? me.deaths_traded/me.deaths : NaN;
  if(me.deaths>=5){ if(tr<0.25) B('Morti quasi mai tradate', `Solo ${me.deaths_traded} morti su ${me.deaths} (${pc(tr)}) sono state vendicate da un compagno (tuo riferimento: ~25-30%).`,'notrade'); else if(tr>=0.4) G('Morti tradate', `${me.deaths_traded} morti su ${me.deaths} (${pc(tr)}) vendicate da un compagno.`); }
  if(me.trade_kills>=2) G('Hai tradato i compagni', `${me.trade_kills} trade kill.`);
  if(me.clutch_att>0){ if(me.clutch_won>0) G('Clutch', `${me.clutch_won} vinti su ${me.clutch_att}.`); else B('Clutch persi', `0 vinti su ${me.clutch_att} (${m.me.clutches.map(c=>`round ${c.r} 1v${c.vs}`).join(', ')}): ricorda di giocare il tempo e di isolare un duello per volta.`); }
  if(me.mk3+me.mk4+me.mk5>=1) G('Multikill', `${me.mk2} doppiette, ${me.mk3} triple, ${me.mk4} quadruple, ${me.mk5} ace.`);
  /* utility */
  const tf = me.thrown_flash, ef = me.enemies_flashed;
  if(tf>=2){ if(ef/tf>=1.5) G('Flash efficaci', `${ef} nemici accecati con ${tf} flash (${f1(me.enemy_flash_time,1)} s totali).`); else if(ef<tf) B('Flash poco efficaci', `${ef} nemici accecati con ${tf} flash; hai accecato ${me.team_flashed} compagni (${f1(me.team_flash_time,1)} s).`,'util'); }
  if(me.team_flashed>ef && me.team_flashed>=3) B('Hai accecato i compagni', `${me.team_flashed} volte (${f1(me.team_flash_time,1)} s) contro ${ef} nemici.`,'util');
  if(me.team_damage>=40) B('Danni ai compagni', `${f1(me.team_damage,0)} danni a compagni.`);
  info.push(`Utility lanciate: ${me.thrown_smoke} smoke, ${me.thrown_flash} flash, ${me.thrown_he} HE, ${me.thrown_molotov} molotov; danni da HE+molotov ${f1(me.dmg_he+me.dmg_molotov,0)}.`);
  /* weapons */
  for(const w of m.me.weapons.filter(w=>w.shots>=60).slice(0,2)){
    const acc = w.hits/w.shots, all = state.matches.flatMap(x=>x.me.weapons.filter(y=>y.w===w.w)), s = sum(all,y=>y.shots), h = sum(all,y=>y.hits), ref = s>w.shots+60 ? (h-w.hits)/(s-w.shots) : NaN;
    const txt = `${wname(w.w)}: ${w.hits}/${w.shots} colpi a segno (${pc(acc)}), ${w.kills} kill, ${w.hs_hits} in testa.`;
    if(isFinite(ref)){ if(acc>=ref*1.2) G(`Precisione alta con ${wname(w.w)}`, `${txt} Tua media nelle altre partite: ${pc(ref)}.`); else if(acc<=ref*0.8) B(`Precisione bassa con ${wname(w.w)}`, `${txt} Tua media nelle altre partite: ${pc(ref)}.`,'corsa'); else info.push(txt); }
    else info.push(txt);
  }
  /* movement */
  const mv = m.me.mov;
  if(mv){ const tot = sum(['st','sl','mv'],b=>mv.all[b][0]), stP = tot?mv.all.st[0]/tot:NaN, mvP = tot?mv.all.mv[0]/tot:NaN;
    if(tot>=60){ if(mvP>0.25) B('Spari troppo in movimento', `${pc(mvP)} dei colpi in movimento (centrati ${mv.all.mv[0]?pc(mv.all.mv[1]/mv.all.mv[0]):'–'}) contro ${pc(stP)} da fermo (centrati ${mv.all.st[0]?pc(mv.all.st[1]/mv.all.st[0]):'–'}).`,'corsa'); else if(stP>=0.5) G('Spari da fermo', `${pc(stP)} dei colpi da fermo (centrati ${mv.all.st[0]?pc(mv.all.st[1]/mv.all.st[0]):'–'}).`); } }
  /* economy */
  const rs = m.rounds, adv = rs.filter(r=>r.team_equip>=r.enemy_equip*1.3 && r.r!==1 && r.r!==13), dis = rs.filter(r=>r.team_equip*1.3<=r.enemy_equip && r.r!==1 && r.r!==13);
  const advL = adv.filter(r=>!r.won), disW = dis.filter(r=>r.won);
  if(advL.length>=2) B('Round persi con vantaggio economico', `Round ${advL.map(r=>r.r).join(', ')}: la squadra aveva almeno il 30% di equipaggiamento in più e ha perso (${adv.length-advL.length} vinti su ${adv.length} con vantaggio).`);
  if(disW.length>=1) G('Round vinti in svantaggio economico', `Round ${disW.map(r=>r.r).join(', ')} (${disW.length} su ${dis.length}).`);
  /* survival and deaths */
  const lostAlive = rs.filter(r=>!r.won && r.survived);
  if(lostAlive.length) info.push(`Hai finito vivo ${lostAlive.length} round persi (${lostAlive.map(r=>r.r).join(', ')}): controlla se erano salvataggi voluti o se potevi aiutare.`);
  const D = m.me.deaths.filter(e=>!e.teamkill), early = D.filter(e=>e.t<30);
  if(D.length>=5 && early.length/D.length>0.5) B('Muori troppo presto', `${early.length} morti su ${D.length} nei primi 30 s del round.`,'presto');
  /* causes of death */
  const withC = D.filter(e=>e.c), rev = withC.map(e=>({e, rev:reviewDeath(e)}));
  const nFight = rev.filter(x=>x.rev.some(r=>r.id==='scontro')).length; if(withC.length) info.push(`In ${nFight} morti su ${withC.length} eri in pieno scontro (kill appena fatta o compagno caduto vicino): non sono conteggiate come errori di reazione.`);
  const cnt = {}; for(const x of rev) for(const id of new Set(x.rev.map(r=>r.id))) cnt[id] = (cnt[id]||0)+1;
  const causes = Object.keys(cnt).filter(k=>k!=='ok'&&k!=='scontro').sort((a,b)=>cnt[b]-cnt[a]).slice(0,3);
  for(const id of causes) if(id!=='scontro' && cnt[id]>=2 && !bad.some(b=>b.id===id)) B(ECAT[id], `${cnt[id]} morti su ${withC.length} analizzate in questa partita.`, id);
  /* data check */
  const chk = [];
  const tk = m.me.deaths.filter(e=>e.teamkill).length;
  const row = (lab, a, b) => chk.push(`<tr><td>${lab}</td><td>${a}</td><td>${b}</td><td>${a===b?'<span class="up">✓</span>':'<span class="down">⚠ differenza</span>'}</td></tr>`);
  row('Kill: eventi registrati / scoreboard', m.me.kills.length, me.kills);
  row('Morti: eventi registrati / scoreboard', m.me.deaths.length, me.deaths);
  row('Kill: somma dei round / scoreboard', sum(rs,r=>r.k), me.kills);
  row('Morti: somma dei round / scoreboard', sum(rs,r=>r.d), me.deaths);
  row('Round giocati / punteggio', rs.length, sc.us+sc.them);
  row('Danni: somma dei round / scoreboard', Math.round(sum(rs,r=>r.dmg)), Math.round(me.damage));
  const ctxN = m.me.deaths.filter(e=>e.c).length;
  const tbl = rev.length ? `<div class="scroll"><table><thead><tr><th>Round</th><th>Lato</th><th>Tempo</th><th>Punto</th><th>Killer</th><th>Arma · dist.</th><th>Tradata</th><th>Segnali</th></tr></thead><tbody>${rev.map(({e,rev:rv})=>`<tr><td>${e.r}</td><td>${e.side}</td><td>${e.t} s</td><td>${esc(e.c.pl||'?')}</td><td>${esc(e.killer)}</td><td>${esc(wname(e.w))} · ${f1(e.dist,0)} m</td><td>${e.traded?'sì':'no'}</td><td style="text-align:left;white-space:normal">${rv.map(r=>esc(r.title)).join('; ')}</td></tr>`).join('')}</tbody></table></div>` : `<div class="sub">Il dettaglio delle morti non è disponibile per questa partita (la demo era già stata cancellata prima dell'analisi di contesto).</div>`;
  const li = a => a.map(x=>`<li style="margin:6px 0"><b>${esc(x.t)}.</b> ${esc(x.d)}</li>`).join('');
  const prior = bad.slice(0,3).map(b=>b.id && DRILL[b.id] ? `<li style="margin:6px 0"><b>${esc(b.t)}:</b> ${esc(DRILL[b.id])}</li>` : `<li style="margin:6px 0"><b>${esc(b.t)}:</b> riguarda i round indicati nella scheda "Round per round" e cerca la causa.</li>`).join('');
  return `<div class="card"><h2>Analisi della partita</h2>
    <div class="sub">${won?'Vittoria':m.result==='D'?'Pareggio':'Sconfitta'} ${sc.us}-${sc.them} su ${mapName(m.map)}. Confronto con i compagni della stessa partita, con i nemici e con la tua media nelle altre ${others.length} partite. Le soglie sono regole di questo tool, non standard ufficiali.</div>
    <div class="grid kpis" style="margin-top:10px">${kpi('Rating',f1(me.rating,2),'nemici '+f1(avgF(p=>p.rating),2))}${kpi('ADR',f1(adr(me),0),'nemici '+f1(avgF(adr),0))}${kpi('KAST',pc(kastP(me)),'nemici '+pc(avgF(kastP)))}${kpi('K/D',f1(me.deaths?me.kills/me.deaths:me.kills,2),me.kills+' kill / '+me.deaths+' morti')}${kpi('Aperture',ok+'-'+od,'vinte-perse')}</div></div>
  <div class="grid g2">
    <div class="card"><h2>Cosa è andato bene</h2>${good.length?`<ul style="margin:6px 0 0;padding-left:20px">${li(good)}</ul>`:'<p class="sub">Nessun punto di forza netto nei dati di questa partita.</p>'}</div>
    <div class="card"><h2>Cosa hai sbagliato</h2>${bad.length?`<ul style="margin:6px 0 0;padding-left:20px">${li(bad)}</ul>`:'<p class="sub">Nessun errore marcato nei dati.</p>'}</div></div>
  ${prior?`<div class="card"><h2>Su cosa lavorare dopo questa partita</h2><ul style="margin:6px 0 0;padding-left:20px">${prior}</ul></div>`:''}
  <div class="card"><h2>Altri dati della partita</h2><ul style="margin:6px 0 0;padding-left:20px">${info.map(x=>`<li style="margin:4px 0">${esc(x)}</li>`).join('')}</ul></div>
  <div class="card"><h2>Le tue morti, una per una</h2><div class="sub">Il dettaglio con mappa e tattica è nella scheda "Errori e fix".</div>${tbl}</div>
  <div class="card"><h2>Verifica dei dati</h2><div class="sub">Controllo che le diverse fonti dentro la demo diano gli stessi numeri${tk?` (${tk} morti da fuoco amico incluse negli eventi)`:''}. Dettaglio contesto morti: ${ctxN}/${m.me.deaths.length}.</div>
    <table><thead><tr><th>Controllo</th><th>Valore A</th><th>Valore B</th><th>Esito</th></tr></thead><tbody>${chk.join('')}</tbody></table></div>`;
}
