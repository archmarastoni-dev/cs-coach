/* Economy review: buy types, loss-bonus streaks, force-buy chains, anti-eco, drops */
const RIFLE = new Set(['ak47','m4a1','m4a1_silencer','m4a4','galilar','famas','aug','sg556']);
const SMGW = new Set(['mp9','mac10','mp7','mp5sd','ump45','bizon']);
const tierOf = (avg, pistol) => pistol ? 'Pistol' : avg < 1500 ? 'Eco' : avg < 3800 ? 'Semi/Force' : 'Full buy';
const WLONG = {ak47:'AK-47',m4a1:'M4A1',m4a1silencer:'M4A1-S',m4a4:'M4A4',galilar:'Galil',famas:'FAMAS',aug:'AUG',sg556:'SG 553',awp:'AWP',ssg08:'SSG 08',scar20:'SCAR-20',g3sg1:'G3SG1',mp9:'MP9',mac10:'MAC-10',mp7:'MP7',mp5sd:'MP5-SD',ump45:'UMP-45',bizon:'PP-Bizon',p90:'P90',nova:'Nova',xm1014:'XM1014',mag7:'MAG-7',sawedoff:'Sawed-Off',negev:'Negev',m249:'M249',deagle:'Deagle',p250:'P250',fiveseven:'Five-SeveN',tec9:'Tec-9',cz75a:'CZ75',elite:'Dual Berettas',revolver:'R8',glock:'Glock',hkp2000:'P2000',usps:'USP-S',uspsilencer:'USP-S'};
const PRIMARY = new Set(['ak47','m4a1','m4a1silencer','m4a4','galilar','famas','aug','sg556','awp','ssg08','scar20','g3sg1','mp9','mac10','mp7','mp5sd','ump45','bizon','p90','nova','xm1014','mag7','sawedoff','negev','m249']);
const SMG_ONLY = new Set(['mp9','mac10','mp7','mp5sd','ump45','bizon','p90','nova','xm1014','mag7','sawedoff']);
const RIF_ONLY = new Set(['ak47','m4a1','m4a1silencer','m4a4','galilar','famas','aug','sg556']);
function buyInfo(b){
  if(!b) return null;
  const inv = b.inv||[], prim = inv.find(i=>PRIMARY.has(i)), pist = inv.filter(i=>WLONG[i]&&!PRIMARY.has(i));
  const g = {fl:inv.filter(i=>i==='flashbang').length, sm:inv.filter(i=>i==='smokegrenade').length, he:inv.filter(i=>i==='hegrenade').length, mo:inv.filter(i=>i==='molotov'||i==='incgrenade').length};
  const ng = g.fl+g.sm+g.he+g.mo;
  const arm = b.ar>0 ? (b.hel?'giubbotto+elmetto':'solo giubbotto') : 'nessuna armatura';
  const parts = [prim?WLONG[prim]:(pist[0]?WLONG[pist[0]]+' (pistola)':'solo coltello'), arm, ...(b.kit?['kit']:[]), ng?`${ng} granate (${[g.fl&&g.fl+' flash',g.sm&&'smoke',g.he&&'HE',g.mo&&'molotov'].filter(Boolean).join(', ')})`:'nessuna granata'];
  return {prim, ng, g, arm, hasArm:b.ar>0, txt:parts.join(' · '), st:b.st, sp:b.sp, mo:b.mo};
}
function econMatch(m){
  const rs = m.rounds.slice().sort((a,b)=>a.r-b.r), out = [];
  let meter = 1, prevHalf = null;
  for(let i=0;i<rs.length;i++){
    const r = rs[i];
    if(r.half !== prevHalf){ meter = 1; prevHalf = r.half; }          // the streak restarts at half time
    const pistol = (r.r===1 || r.r===13);
    const nT = Math.max(1, m.players.filter(p=>p.mine_team).length) , nE = Math.max(1, m.players.filter(p=>!p.mine_team).length);
    const tAvg = r.team_equip/nT, eAvg = r.enemy_equip/nE, oAvg = nT>1 ? (r.team_equip - r.equip)/(nT-1) : 0;
    const x = {r, i, pistol, meter, bonus: 1400+500*meter, tAvg, eAvg, oAvg, tier: tierOf(tAvg,pistol), eTier: tierOf(eAvg,pistol), flags: []};
    // unspent money (at the end of the buy phase) while teammates are short
    if(!pistol && r.money >= 2700 && oAvg < 3000) x.flags.push({id:'drop', bad:true});
    if(!pistol && r.equip >= 3800 && oAvg < 2000) x.flags.push({id:'lone', bad:true});
    if(!pistol && r.equip < 1500 && oAvg >= 3800 && r.money >= 3000) x.flags.push({id:'broke_rich', bad:true});
    const bi = buyInfo(r.buy); x.bi = bi;
    if(bi){
      const tm = r.buy.tm||[];
      if(!pistol && bi.prim && !bi.hasArm && bi.sp>=2000) x.flags.push({id:'noarmor', bad:true});
      if(!pistol && x.tier==='Full buy' && bi.prim && RIF_ONLY.has(bi.prim) && bi.ng===0) x.flags.push({id:'noutil', bad:true});
      if(!pistol && bi.prim==='awp' && x.tier!=='Full buy') x.flags.push({id:'awpeco', bad:true});
      if(tm.length){
        const short = tm.filter(([eq,mo])=>eq<2000).length;
        x.short = short; x.mateMoney = tm.map(a=>a[1]);
        const idx = x.flags.findIndex(f=>f.id==='drop'||f.id==='lone');
        if(idx>=0 && x.flags[idx].id==='drop' && short===0) x.flags.splice(idx,1);       // nobody is short: no drop to make
        if(!pistol && bi.mo>=2700 && short>=1 && !x.flags.some(f=>f.id==='drop')) x.flags.push({id:'drop', bad:true});
      }
    }
    out.push(x);
    meter = r.won ? Math.max(0, meter-1) : Math.min(4, meter+1);
  }
  // sequences
  for(let i=1;i<out.length;i++){
    const a = out[i-1], b = out[i];
    if(!a.pistol && !b.pistol && a.tier==='Semi/Force' && b.tier==='Semi/Force' && !a.r.won && !b.r.won && a.r.half===b.r.half) b.flags.push({id:'forcechain', bad:true});
    if(!a.r.won && a.bonus>=2900 && b.tier==='Semi/Force' && !b.pistol && b.r.half===a.r.half && !b.r.won) b.flags.push({id:'forcehigh', bad:true, pb:a.bonus});
    if(a.r.half===b.r.half && !a.r.won && a.tier==='Eco' && b.tier==='Full buy' && b.r.won) b.flags.push({id:'ecook', bad:false});
  }
  // anti-eco: enemies on eco and we are not
  for(const x of out){
    const r = x.r;
    if(!x.pistol && x.eTier==='Eco' && x.tier!=='Eco'){
      const ks = m.me.kills.filter(e=>e.r===r.r), rifk = ks.filter(e=>RIFLE.has(e.w)).length, smgk = ks.filter(e=>SMGW.has(e.w)).length;
      x.anti = {rifk, smgk, n: ks.length};
      if(rifk) x.flags.push({id:'antieco_rifle', bad:true, n:rifk});
    }
    if(!r.won && r.survived && r.equip>=3000) x.flags.push({id:'saved', bad:false});
    if(x.eTier==='Full buy' && x.tier==='Eco' && r.won) x.flags.push({id:'ecowin', bad:false});
    if(x.eTier==='Eco' && x.tier!=='Eco' && !x.pistol && !r.won) x.flags.push({id:'antieco_lost', bad:true});
  }
  return out;
}
const ECOTXT = {
  drop:  x => x.short!=null ? `Avevi ${x.bi.mo}$ non spesi e ${x.short} compagni sotto 2000$ di equipaggiamento: potevi fare drop di un'arma.` : `Avevi ${x.r.money}$ non spesi mentre i compagni avevano in media circa ${Math.round(x.oAvg)}$ di equipaggiamento.`,
  lone:  x => `Hai fatto un full buy (${x.r.equip}$) con compagni a circa ${Math.round(x.oAvg)}$: un fucile da solo vince raramente il round.`,
  broke_rich: x => `Squadra in full buy (compagni circa ${Math.round(x.oAvg)}$) e tu con ${x.r.money}$ in tasca e solo ${x.r.equip}$ di equipaggiamento.`,
  forcechain: x => `Seconda force di fila persa: due round a spendere tutto senza ottenere il full buy.`,
  forcehigh: x => `Force dopo una sconfitta che aveva già dato ${x.pb}$ di loss bonus: risparmiando un round il full buy era più vicino.`,
  ecook: x => `Dopo un eco hai vinto il full buy successivo: il risparmio ha pagato.`,
  antieco_rifle: x => `Contro un eco hai ucciso con il fucile ${x.n} volte (300$ a kill): con un SMG sarebbero stati 600$ a kill.`,
  antieco_lost: x => `Round perso contro una squadra in eco: è il più costoso dal punto di vista dell'economia (regala armi e bonus).`,
  saved: x => `Round perso ma sei sopravvissuto con ${x.r.equip}$ di equipaggiamento: arma salvata per il round dopo.`,
  noarmor: x => `Hai comprato l'arma (${x.bi.txt.split(' · ')[0]}) senza armatura: l'armatura va comprata per prima in ogni round di acquisto.`,
  noutil: x => `Full buy senza nessuna granata: smoke e flash servono per entrare o difendere con il trade.`,
  awpeco: x => `AWP in un round non da full buy: rende solo 100$ a kill e se la perdi regali 4750$.`,
  ecowin: x => `Round vinto in eco contro un full buy nemico: ottima resa economica (armi nemiche e blocco del loss bonus).`
};
function econSummary(m){
  const E = econMatch(m), T = {}, cnt = {};
  for(const x of E){ const k = x.tier; (T[k] = T[k]||{n:0,w:0}); T[k].n++; if(x.r.won) T[k].w++; for(const f of x.flags) cnt[f.id] = (cnt[f.id]||0)+1; }
  const lost = E.filter(x=>!x.r.won), rich = sum(lost, x=>x.r.money);
  const maxStreak = (()=>{ let c=0,mx=0; for(const x of E){ c = x.r.won?0:c+1; mx=Math.max(mx,c); } return mx; })();
  const anti = E.filter(x=>x.anti), antiW = anti.filter(x=>x.r.won).length;
  return {E, T, cnt, rich, maxStreak, anti, antiW};
}
function econCards(m){
  const S = econSummary(m), {E,T,cnt} = S;
  const good = [], bad = [], info = [];
  const rl = id => E.filter(x=>x.flags.some(f=>f.id===id)).map(x=>x.r.r).join(', ');
  const tr = k => T[k] ? `${T[k].w}/${T[k].n}` : '–';
  if(cnt.drop) bad.push(['Soldi non spesi mentre la squadra era corta', `Round ${rl('drop')}: avevi 2700$ o più a fine acquisti e i compagni erano sotto i 3000$ di media. I soldi in tasca valgono zero se perdi: compra o dai un'arma a chi è corto (drop).`, ['eco2','eco4','eco5']]);
  if(cnt.noarmor) bad.push(['Arma senza armatura', `Round ${rl('noarmor')}: hai comprato l'arma ma non l'armatura. La regola dei coach è armatura prima di tutto: senza, ti uccidono con meno colpi e il nemico incassa lo stesso.`, ['eco2']]);
  if(cnt.noutil) bad.push(['Full buy senza granate', `Round ${rl('noutil')}: nessuna utility con un full buy. Almeno una smoke e una flash.`, ['eco1','eco2']]);
  if(cnt.awpeco) bad.push(['AWP in round non pieno', `Round ${rl('awpeco')}: l'AWP costa 4750$ e rende solo 100$ per kill.`, ['eco2']]);
  if(cnt.lone) bad.push(['Full buy da solo', `Round ${rl('lone')}: ti sei equipaggiato a pieno con la squadra in eco o semi-eco. Con la squadra sotto i 2000$ di media allinea l'acquisto agli altri o fai drop.`, ['eco2']]);
  if(cnt.forcechain) bad.push(['Force di fila senza risultato', `Round ${rl('forcechain')}: due semi-buy o force consecutive, entrambe perse. Dopo la prima sconfitta il caso migliore era un eco per tornare a un full buy.`, ['eco2','eco3']]);
  if(cnt.forcehigh) bad.push(['Force con loss bonus alto', `Round ${rl('forcehigh')}: dopo una sconfitta il bonus era già a 2900$ o più e la squadra ha forzato; con un eco il full buy per tutti sarebbe stato più vicino (conta anche quanto avevano i compagni, che qui non è visibile).`, ['eco2','eco3']]);
  if(S.anti.length){
    const rifk = sum(S.anti, x=>x.anti.rifk), smgk = sum(S.anti, x=>x.anti.smgk);
    if(rifk) bad.push(['Fucile contro eco', `In ${S.anti.length} round contro squadre in eco hai fatto ${rifk} kill con il fucile (300$) e ${smgk} con SMG (600$). Contro un eco un SMG uccide altrettanto bene e rende il doppio per kill (+${rifk*300}$ in questa partita).`, ['eco1','eco2']]);
    info.push(`Round contro squadre in eco: ${S.antiW} vinti su ${S.anti.length}. Perderli è la causa più costosa di economia: regalano armi e bonus.`);
  }
  if(cnt.antieco_lost) bad.push(['Round persi contro un eco', `Round ${rl('antieco_lost')}: contro un eco non serve forzare i duelli, servono spazio e trade; muori e regali un'arma.`, ['eco1','eco2']]);
  if(cnt.saved) good.push(['Armi salvate', `Round ${rl('saved')}: sei sopravvissuto con equipaggiamento da full buy a round perso, così il round dopo parti già con l'arma.`, ['eco5']]);
  if(cnt.ecowin) good.push(['Eco vinti contro un full buy', `Round ${rl('ecowin')}.`, ['eco1']]);
  if(cnt.ecook) good.push(['Eco che hanno pagato', `Round ${rl('ecook')}: dopo un eco hai vinto il full buy.`, ['eco1']]);
  const p = E.filter(x=>x.pistol);
  for(const x of p){ const nx = E[x.i+1]; if(nx && nx.r.half===x.r.half){ (x.r.won ? good : info).push(x.r.won ? ['Pistol vinto', `Round ${x.r.r} vinto. Round ${nx.r.r} (${nx.tier}, nemici ${nx.eTier}): ${nx.r.won?'vinto, hai convertito il vantaggio':'perso: il pistol vinto va convertito con una buona anti-eco'}.`, ['eco1','eco3']] : `Pistol perso (round ${x.r.r}): il round dopo la squadra era ${nx.tier}${nx.tier==='Eco'?' (scelta corretta con il loss bonus in crescita)':''}, esito ${nx.r.won?'vinto':'perso'}.`); } }
  if(S.maxStreak>=4) info.push(`Striscia massima di round persi: ${S.maxStreak}. Con 5 sconfitte il bonus arriva al massimo (3400$): i round dopo sono pieni, il problema è non vincere quelli a bonus basso.`);
  const li = a => a.map(([h,b,s])=>`<div class="iss ${a===good?'ok':'media'}"><h4>${h}</h4><p>${b}</p><p class="sub">Fonti: ${(s||[]).map(k=>`<a href="${SRC[k][1]}" target="_blank" rel="noopener noreferrer">${esc(SRC[k][0].split(' (')[0])}</a>`).join(' · ')}</p></div>`).join('');
  const tiers = ['Pistol','Eco','Semi/Force','Full buy'].map(k=>`<tr><td>${k}</td><td>${T[k]?T[k].n:0}</td><td>${T[k]?pc(T[k].w/T[k].n):'–'}</td></tr>`).join('');
  const rows = E.map(x=>{ const r = x.r, fl = x.flags.map(f=>`<span class="pill ${f.bad?'L':'W'}" title="${esc(ECOTXT[f.id](Object.assign({n:f.n},x)))}">${({drop:'soldi non spesi',noarmor:'senza armatura',noutil:'senza utility',awpeco:'AWP in eco',lone:'full da solo',broke_rich:'sotto-equipaggiato',forcechain:'force di fila',forcehigh:'force con bonus alto',ecook:'eco ok',antieco_rifle:'fucile vs eco',antieco_lost:'perso vs eco',saved:'arma salvata',ecowin:'eco vinto'})[f.id]}</span>`).join(' ');
    return `<tr><td>${r.r}</td><td><span class="side ${r.side}">${r.side}</span></td><td><span class="pill ${r.won?'W':'L'}">${r.won?'Vinto':'Perso'}</span></td><td>${x.tier}<div class="sub" style="margin:0">media ${Math.round(x.tAvg)}$ · tu ${r.equip}$</div></td><td>${x.eTier}<div class="sub" style="margin:0">media ${Math.round(x.eAvg)}$</div></td><td style="text-align:left;white-space:normal;max-width:260px">${x.bi?esc(x.bi.txt)+`<div class="sub" style="margin:0">partivi con ${x.bi.st}$, speso ${x.bi.sp}$${x.short!=null?` · compagni sotto 2000$: ${x.short}`:''}</div>`:'<span class="sub">non registrato</span>'}</td><td>${x.bi?x.bi.mo:r.money}$</td><td>${x.bonus}$</td><td style="text-align:left;white-space:normal">${fl}</td></tr>`; }).join('');
  return `<div class="card"><h2>Economia della partita</h2><div class="sub">Il valore è quello a inizio round (dopo gli acquisti). Eco sotto 1500$ di media a giocatore, semi/force fino a 3800$, full buy sopra. Sono soglie indicative del tool ricavate dalle guide sotto: il dettaglio di cosa hai comprato (armi, armatura, granate) compare solo per le partite analizzate con la versione nuova del programma, per le altre vedi “non registrato”.</div>
    <div class="grid g2"><div><table><thead><tr><th>Tipo di buy (squadra)</th><th>Round</th><th>Vinti</th></tr></thead><tbody>${tiers}</tbody></table></div>
    <div><p>• Soldi rimasti in tasca a fine acquisti, sommati sui round persi: <b>${S.rich}$</b></p><p>• Striscia massima di sconfitte: <b>${S.maxStreak}</b></p><p>• Anti-eco: <b>${S.antiW}/${S.anti.length}</b> vinti</p></div></div></div>
    ${bad.length?`<div class="card"><h2>Cosa migliorare nell'economia</h2>${li(bad)}</div>`:''}
    ${good.length?`<div class="card"><h2>Cosa è andato bene</h2>${li(good)}</div>`:''}
    ${info.length?`<div class="card"><h2>Altre note</h2>${info.map(s=>`<p>• ${s}</p>`).join('')}</div>`:''}
    <div class="card"><h2>Round per round</h2><div class="sub">Passa sopra le etichette per il dettaglio. Il loss bonus è quello che avresti incassato perdendo quel round (parte da 1900$, sale di 500$ a sconfitta fino a 3400$, scende di 500$ a vittoria, riparte a metà partita).</div>
      <div class="scroll"><table class="timeline"><thead><tr><th>#</th><th>Lato</th><th>Esito</th><th>Noi</th><th>Loro</th><th>Cosa hai comprato</th><th>Tuoi $ a fine acquisti</th><th>Loss bonus</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table></div></div>
    <div class="card"><h2>Come si ragiona sull'economia (fonti)</h2><ul style="margin:6px 0 0;padding-left:20px">
      <li>Ogni giocatore parte con 800$, massimo 16000$. Vittoria 3250$ (3500$ con bomba esplosa o disinnescata); sconfitta da 1400$ a 3400$ in base alla striscia; T che piantano e perdono incassano un bonus.</li>
      <li>Kill: 300$ fucile e pistola, 600$ SMG, 900$ pompa, 100$ AWP, 1500$ coltello: contro un eco conviene un SMG.</li>
      <li>Regole pratiche: sotto 2000$ si risparmia, da circa 4000$ si fa full buy; il force ha senso a fine tempo, a un round dal match point o contro nemici deboli. Non comprare da solo un full se due compagni sono in eco, e fai drop se hai soldi in più.</li>
      <li>Cosa guardano gli analisti: vittorie ai pistol e conversione del round dopo, resa per tipo di acquisto (eco, semi/force, full), sincronia degli acquisti, soldi non spesi nei round persi e valore economico dei round vinti da eco.</li></ul>
      <p class="sub">Alcune guide divergono su soglie esatte (il full buy va da 4000$ a 5300$ a seconda della fonte e della squadra) e una afferma che i soldi restano a metà partita: nei tuoi dati il round 13 parte con equipaggiamento da pistol, quindi qui trattato come ripartenza.</p></div>`;
}
function viewMatch(m){
  const sc = m.score, partial = !m.complete ? `<div class="note">Questa partita sembra incompleta (nessuna squadra ha raggiunto 13 round): potrebbe essere finita per resa o abbandono.</div>` : '';
  const tabs = [['analisi','Analisi'],['err','Errori'],['eco','Economia'],['score','Scoreboard'],['rounds','Round per round'],['map','Mappa']];
  let body = '';
  if(state.selView==='analisi'){
    body = matchAnalysis(m);
  } else if(state.selView==='err'){
    body = matchErrors(m);
  } else if(state.selView==='eco'){
    body = econCards(m);
  } else if(state.selView==='score'){
    const adv = state.mode==='adv';
    const mk = list => list.map(p => `<tr class="${p.sid===SID?'me':''}"><td>${esc(p.name)}</td><td>${f1(p.rating,2)}</td><td>${p.kills}</td><td>${p.assists}</td><td>${p.deaths}</td><td>${p.kills-p.deaths>0?'+':''}${p.kills-p.deaths}</td><td>${f1(p.damage/p.rounds,0)}</td><td>${pc(p.kast/p.rounds)}</td><td>${pc(p.kills?p.hs/p.kills:NaN)}</td>${adv?`<td>${p.opening_kills}-${p.opening_deaths}</td><td>${p.trade_kills}</td><td>${p.clutch_won}/${p.clutch_att}</td><td>${p.enemies_flashed}</td><td>${p.thrown_smoke}</td><td>${f1(p.dmg_he+p.dmg_molotov,0)}</td>`:''}</tr>`).join('');
    const hd = `<tr><th>Giocatore</th><th>Rating</th><th>K</th><th>A</th><th>D</th><th>+/-</th><th>ADR</th><th>KAST</th><th>HS%</th>${adv?'<th>Apertura</th><th>Trade</th><th>Clutch</th><th>Flash</th><th>Smoke</th><th>Danni util.</th>':''}</tr>`;
    body = `<div class="card"><h2>La tua squadra · ${sc.us}</h2><div class="scroll"><table><thead>${hd}</thead><tbody>${mk(m.players.filter(p=>p.mine_team))}</tbody></table></div></div>
            <div class="card"><h2>Avversari · ${sc.them}</h2><div class="scroll"><table><thead>${hd}</thead><tbody>${mk(m.players.filter(p=>!p.mine_team))}</tbody></table></div></div>`;
  } else if(state.selView==='rounds'){
    const rows = m.rounds.filter(r=>sideOk(state.fSide,r)).map(r => {
      const evs = [...m.me.kills.filter(e=>e.r===r.r).map(e=>({t:e.t, s:`<b class="up">Kill</b> ${wname(e.w)}${e.hs?' (testa)':''} su ${esc(e.victim)} · ${f1(e.dist,0)} m`})),
                   ...m.me.deaths.filter(e=>e.r===r.r).map(e=>({t:e.t, s:`<b class="down">Morte</b> da ${esc(e.killer)} con ${wname(e.w)} · ${f1(e.dist,0)} m · ${e.traded?'tradato':'non tradato'}`})),
                   ...m.me.util.filter(u=>u.r===r.r).map(u=>({t:u.t, s:`${KIND[u.kind]} lanciata`}))].sort((a,b)=>a.t-b.t);
      const buy = (r.r===1||r.r===13)?'Pistol':r.equip<1500?'Eco':r.equip<4000?'Force':'Full';
      return `<tr class="click" data-round="${r.r}"><td>${r.r}</td><td><span class="side ${r.side}">${r.side}</span></td><td><span class="pill ${r.won?'W':'L'}">${r.won?'Vinto':'Perso'}</span></td><td>${r.k}/${r.a}/${r.d}</td><td>${r.dmg}</td><td>${buy} (${r.equip}$)</td><td>${r.team_equip}$ / ${r.enemy_equip}$</td><td>${r.survived?'Vivo':'Morto'}${r.traded?' · tradato':''}</td><td>${r.len} s</td></tr>
        ${state.openRound===r.r?`<tr><td colspan="9" style="text-align:left;white-space:normal"><ul class="ev-list">${evs.map(e=>`<li>${e.t.toFixed(1)} s · ${e.s}</li>`).join('')||'<li>Nessun evento registrato</li>'}</ul></td></tr>`:''}`; }).join('');
    body = `<div class="card"><h2>Round per round</h2><div class="sub">K/A/D sono i tuoi. Equip squadra e nemici sono la somma a inizio round. Clicca un round per la sequenza.</div>
      <div class="scroll"><table class="timeline"><thead><tr><th>#</th><th>Lato</th><th>Esito</th><th>K/A/D</th><th>Danni</th><th>Buy</th><th>Equip (noi / loro)</th><th>Stato</th><th>Durata</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  } else {
    body = mapCard(m.map, [m], state.fSide, 'm');
  }
  return `<button class="btn back" data-back="1">← Tutte le partite</button>
    <div class="card"><div class="top-row"><div><h2>#${idxOf(m)} ${mapName(m.map)} <span class="pill ${m.result}">${sc.us}-${sc.them}</span></h2>
      <div class="sub">${m.played?dShort(m.played)+' · ':''}CT: ${sc.ct_won}/${sc.ct_rounds} round vinti · T: ${sc.t_won}/${sc.t_rounds} round vinti · demo ${esc(m.file.slice(0,34))}…</div></div>
      <div class="seg" id="mview">${tabs.map(([k,t])=>`<button data-v="${k}" aria-pressed="${state.selView===k}">${t}</button>`).join('')}</div></div></div>
    ${partial}${body}`;
}

/* reusable map card */
function mapCard(map, ms, side, id){
  const L = state.layers;
  const sc = mapScene(map, ms, side, L);
  const cells = zoneList(sc.pts, sc.pt);
  const grid = [];
  for(let i=0;i<=10;i++){ grid.push(`<line x1="${i*100}" y1="0" x2="${i*100}" y2="1000" stroke="#fff" stroke-opacity=".18" stroke-width="1"/><line x1="0" y1="${i*100}" x2="1000" y2="${i*100}" stroke="#fff" stroke-opacity=".18" stroke-width="1"/>`); }
  for(let i=0;i<10;i++){ grid.push(`<text x="${i*100+50}" y="22" fill="#ffd54a" font-size="22" text-anchor="middle" font-weight="700" stroke="#000" stroke-width="3" paint-order="stroke">${i+1}</text><text x="12" y="${i*100+58}" fill="#ffd54a" font-size="22" font-weight="700" stroke="#000" stroke-width="3" paint-order="stroke">${i+1}</text>`); }
  for(const c of cells) grid.push(`<rect class="zc" data-zr="${c.cx}-${c.cy}" x="${c.cx*100}" y="${c.cy*100}" width="100" height="100" fill="#ffd54a" fill-opacity="0" stroke="#ffd54a" stroke-opacity="0" stroke-width="4" pointer-events="none"/>`);
  const svg = radarSVG(map, [...sc.sh, ...grid]);
  const kc = sc.kills.length, dc = sc.deaths.length;
  const zones = cells.map(c => {
    const kd = c.d ? c.k/c.d : c.k;
    const nm = Object.entries(c.names).sort((a,b)=>b[1]-a[1])[0];
    return `<tr class="click" data-zc="${c.cx}-${c.cy}"><td><b>Quadrato ${c.cx+1}-${c.cy+1}</b>${nm?`<div class="sub" style="margin:0">dove sei morto: ${esc(nm[0])}</div>`:''}</td><td>${c.k}</td><td>${c.d}</td><td class="${kd>=1?'up':'down'}">${f1(kd,2)}</td></tr>`; }).join('');
  return `<div class="card"><div class="top-row"><div><h2>${mapName(map)}</h2><div class="sub">${ms.length} ${ms.length===1?'partita':'partite'} · ${kc} kill e ${dc} morti${side==='all'?'':' (lato '+side+')'}</div></div>
    <div class="legend" data-layers="${id}">
      <label><input type="checkbox" data-layer="kills" ${L.kills?'checked':''}><span class="dot" style="background:#2bd47d"></span> Tue kill (dove eri)</label>
      <label><input type="checkbox" data-layer="deaths" ${L.deaths?'checked':''}><span style="color:#ff5c5c;font-weight:700">✕</span> Tue morti (linea dal killer)</label>
      <label><input type="checkbox" data-layer="heat" ${L.heat?'checked':''}> Mappa di calore</label></div></div>
    <div class="maprow"><div>${svg}</div>
      <div><h3>Zone con più scontri</h3><div class="sub">Come leggerla: la mappa ha una griglia 10×10 con i numeri in giallo sui bordi. "Quadrato 7-3" = colonna 7 (da sinistra) e riga 3 (dall'alto). Passa il mouse (o clicca) su una riga per vedere il quadrato sulla mappa. <b>Kill</b> = quante volte hai ucciso mentre eri in quel quadrato, <b>Morti</b> = quante volte sei morto lì, <b>K/D</b> = kill diviso morti: sotto 1 (rosso) è una zona dove perdi più scontri di quanti ne vinci.</div>
      ${cells.length?`<table><thead><tr><th>Zona</th><th>Kill</th><th>Morti</th><th>K/D</th></tr></thead><tbody>${zones}</tbody></table>`:'<div class="empty">Servono almeno 2 scontri nella stessa zona.</div>'}
      <p class="sub" style="margin-top:12px">Passa sopra un punto per vedere round, arma e distanza. Verde = dove eri quando hai ucciso, rosso = dove sei morto.</p></div></div></div>`;
}

function viewMappe(ms){
  const maps = [...new Set(ms.map(m=>m.map))];
  if(!maps.length) return '<div class="empty">Nessuna partita con questi filtri.</div>';
  if(!state.mapSel || !maps.includes(state.mapSel)) state.mapSel = maps[0];
  const mm = ms.filter(m=>m.map===state.mapSel);
  const a = agg(mm, state.fSide);
  return `<div class="chips" id="mapChips">${maps.map(mp=>`<button data-map="${mp}" aria-pressed="${state.mapSel===mp}">${mapName(mp)}</button>`).join('')}</div>
    <div class="grid kpis">${kpi('Partite',`${a.mw}-${a.n-a.mw}`,'vinte-perse')}${kpi('Rating',f1(a.rating,2),'')}${kpi('K/D',f1(a.kd,2),'')}${kpi('ADR',f1(a.adr,0),'')}${kpi('Round vinti',pc(a.rwP),'')}${kpi('Duelli apertura',pc(a.okP),'')}</div>
    ${mapCard(state.mapSel, mm, state.fSide, 'map')}`;
}

/* ---- utility ---- */
function lineups(utils, kind){
  const groups = [];
  for(const u of utils.filter(u=>u.kind===kind && u.ox!==undefined)){
    let g = groups.find(g => g.side===u.side && Math.hypot(g.lx-u.lx, g.ly-u.ly) < 180);
    if(!g){ g = {side:u.side, lx:u.lx, ly:u.ly, items:[]}; groups.push(g); }
    g.items.push(u);
  }
  return groups.map(g => {
    const ox = g.items.reduce((s,u)=>s+u.ox,0)/g.items.length, oy = g.items.reduce((s,u)=>s+u.oy,0)/g.items.length;
    const spread = g.items.reduce((s,u)=>s+Math.hypot(u.ox-ox,u.oy-oy),0)/g.items.length;
    const tavg = g.items.reduce((s,u)=>s+u.t,0)/g.items.length;
    return {...g, ox, oy, spread, tavg, n:g.items.length};
  }).sort((a,b)=>b.n-a.n);
}
function viewUtility(ms){
  const maps = [...new Set(ms.map(m=>m.map))];
  if(!maps.length) return '<div class="empty">Nessuna partita con questi filtri.</div>';
  if(!state.mapSel || !maps.includes(state.mapSel)) state.mapSel = maps[0];
  const map = state.mapSel, mm = ms.filter(m=>m.map===map), side = state.fSide;
  const utils = mm.flatMap(m => m.me.util.filter(u=>sideOk(side,u)).map(u=>({...u, mid:m.id})));
  const refs = state.uRef ? mm.flatMap(m => m.smoke_ref.filter(s=>!s.me && sideOk(side,s))) : [];
  const pts = [...utils.map(u=>[u.lx,u.ly]), ...utils.filter(u=>u.ox!==undefined).map(u=>[u.ox,u.oy]), ...refs.map(r=>[r.lx,r.ly])];
  const pt = ptFn(map, pts.length?pts:[[0,0],[1,1]]);
  const sh = [];
  for(const r of refs){ const [u,v]=pt(r.lx,r.ly); sh.push(`<circle cx="${u}" cy="${v}" r="9" fill="#9aa7b8" fill-opacity=".35" stroke="#fff" stroke-opacity=".5" ${tipAttr('Smoke di un altro giocatore · '+r.side+' · '+r.t+' s')}/>`); }
  for(const u of utils){
    if(!state.uKinds[u.kind]) continue;
    const [lx,ly]=pt(u.lx,u.ly); const c = KCOL[u.kind]; const rad = u.kind==='smoke'?15:9;
    let line=''; if(u.ox!==undefined){ const [ox,oy]=pt(u.ox,u.oy); line = `<line x1="${ox}" y1="${oy}" x2="${lx}" y2="${ly}" stroke="${c}" stroke-opacity=".7" stroke-width="2" stroke-dasharray="7 5"/><circle cx="${ox}" cy="${oy}" r="5" fill="#fff" stroke="#000"/>`; }
    sh.push(`${line}<circle cx="${lx}" cy="${ly}" r="${rad}" fill="${c}" fill-opacity=".55" stroke="#fff" stroke-width="2" ${tipAttr(KIND[u.kind]+' · round '+u.r+' · '+u.side+' · a '+u.t+' s'+(u.pitch!==undefined?' · mira '+u.pitch+'° / '+u.yaw+'°':''))}/>`);
  }
  const U = utilAgg(mm, side);
  const fl = U.flashAll||0;
  const smokeGroups = lineups(utils, 'smoke').filter(g=>g.n>=1).slice(0,8);
  const glist = smokeGroups.map(g => {
    const cons = g.n>=2 ? (g.spread < 60 ? '<span class="up">molto ripetibile</span>' : g.spread < 150 ? '<span class="mid">abbastanza ripetibile</span>' : '<span class="down">poco ripetibile</span>') : 'un solo lancio';
    return `<tr><td><span class="side ${g.side}">${g.side}</span></td><td>${g.n}</td><td>${f1(g.tavg,0)} s</td><td>${f1(g.spread,0)}</td><td style="text-align:left;white-space:normal">${cons}</td></tr>`; }).join('');
  const per = k => f1(U.thrown[k]/Math.max(1,U.R)*mm.length*0+U.thrown[k]/Math.max(1,U.R),2);
  return `<div class="chips" id="mapChips">${maps.map(mp=>`<button data-map="${mp}" aria-pressed="${state.mapSel===mp}">${mapName(mp)}</button>`).join('')}</div>
  <div class="grid kpis">
    ${kpi('Smoke / round', per('smoke'), U.thrown.smoke+' lanciate')}
    ${kpi('Flash / round', per('flash'), U.thrown.flash+' lanciate')}
    ${kpi('Flash efficaci', fl? f1(U.ef/fl,2):'–', `${U.ef} nemici accecati (≥1 s) su ${fl} flash`)}
    ${kpi('Compagni accecati', U.tf, f1(U.tft,1)+' s totali', U.tf>=4?'down':'')}
    ${kpi('Danni HE', f1(U.heD,0), U.thrown.he+' lanciate')}
    ${kpi('Danni molotov', f1(U.moD,0), U.thrown.molotov+' lanciate')}
  </div>
  <div class="card"><div class="top-row"><div><h2>Granate su ${mapName(map)}</h2><div class="sub">Pallino bianco = dove eri quando l'hai lanciata, cerchio colorato = dove è arrivata. I valori flash e danni sono su tutti i round.</div></div>
    <div class="legend" id="ukinds">${Object.keys(KIND).map(k=>`<label><input type="checkbox" data-kind="${k}" ${state.uKinds[k]?'checked':''}><span class="dot" style="background:${KCOL[k]}"></span> ${KIND[k]}</label>`).join('')}<label><input type="checkbox" id="uref" ${state.uRef?'checked':''}> Smoke degli altri giocatori</label></div></div>
    <div class="maprow"><div>${radarSVG(map, sh)}</div>
    <div><h3>Le tue smoke ripetute</h3><div class="sub">Lanci con arrivo vicino (entro ~180 unità) raggruppati. Dispersione = distanza media in unità di gioco tra i punti da cui lanci: sotto 60 vuol dire che usi sempre la stessa lineup.</div>
      ${glist?`<table><thead><tr><th>Lato</th><th>Lanci</th><th>Tempo medio</th><th>Dispersione</th><th></th></tr></thead><tbody>${glist}</tbody></table>`:'<div class="empty">Nessuna smoke lanciata con questi filtri.</div>'}
      <p class="sub" style="margin-top:10px">Confronta con le smoke degli altri giocatori (opzione sopra): se le tue finiscono in punti isolati, probabilmente non sono lineup standard.</p></div></div></div>`;
}

/* ---- weapons ---- */
function viewArmi(ms){
  const side = state.fSide;
  const W = {}, HZ = {};
  const dk = [0,0,0,0], dd = [0,0,0,0], bins = [[0,10],[10,20],[20,30],[30,999]];
  const fl = {wb:0, sm:0, blind:0, air:0, ns:0};
  for(const m of ms){
    for(const w of m.me.weapons){ const o = W[w.w] = W[w.w] || {shots:0,hits:0,hs_hits:0,dmg:0,kills:0,hs_kills:0}; for(const k in o) o[k]+=w[k]; }
    for(const [z,n] of Object.entries(m.me.hit_zones)) HZ[z] = (HZ[z]||0)+n;
    for(const e of m.me.kills) if(sideOk(side,e)){ dk[bins.findIndex(b=>e.dist>=b[0]&&e.dist<b[1])]++; for(const k of Object.keys(fl)) if(e[k]) fl[k]++; }
    for(const e of m.me.deaths) if(sideOk(side,e)&&!e.teamkill) dd[bins.findIndex(b=>e.dist>=b[0]&&e.dist<b[1])]++;
  }
  const wr = Object.entries(W).filter(([w,o])=>w!=='knife').sort((a,b)=>b[1].kills*1000+b[1].shots - (a[1].kills*1000+a[1].shots));
  const tb = wr.map(([w,o]) => `<tr><td>${wname(w)}</td><td>${o.shots}</td><td>${o.hits}</td><td>${pc(o.hits/Math.max(1,o.shots))}</td><td>${pc(o.hs_hits/Math.max(1,o.hits))}</td><td>${f1(o.dmg/Math.max(1,o.hits),0)}</td><td>${o.kills}</td></tr>`).join('');
  const tot = sum(Object.values(HZ));
  const hz = Object.entries(HZ).sort((a,b)=>b[1]-a[1]).map(([z,n])=>`<div class="hrow"><span>${z}</span><div class="bar"><i style="width:${n/Math.max(1,tot)*100}%"></i></div><span class="n">${pc(n/Math.max(1,tot))} · ${n}</span></div>`).join('');
  const mx = Math.max(1,...dk,...dd);
  const dist = bins.map((b,i)=>`<div class="hrow"><span>${b[0]}${b[1]>=999?'+':'-'+b[1]} m</span><div><div class="bar" ${tipAttr(dk[i]+' kill')}><i style="width:${dk[i]/mx*100}%;background:var(--good)"></i></div><div class="bar" style="margin-top:3px" ${tipAttr(dd[i]+' morti')}><i style="width:${dd[i]/mx*100}%;background:var(--bad)"></i></div></div><span class="n">${dk[i]} / ${dd[i]}</span></div>`).join('');
  return `<div class="grid g2">
    <div class="card"><h2>Armi</h2><div class="sub">Colpi sparati, colpi a segno e kill per arma. I colpi a segno non contano granate né coltello.</div>
      <div class="scroll"><table><thead><tr><th>Arma</th><th>Colpi</th><th>A segno</th><th>Precisione</th><th>Testa</th><th>Danno/colpo</th><th>Kill</th></tr></thead><tbody>${tb}</tbody></table></div></div>
    <div class="card"><h2>Dove colpisci</h2><div class="sub">Distribuzione dei colpi a segno per zona del corpo.</div>${hz||'<div class="empty">Nessun dato</div>'}</div>
    <div class="card"><h2>Distanza dei duelli</h2><div class="sub">Verde = kill, rosso = morti, per distanza in metri.</div>${dist}</div>
    <div class="card"><h2>Tipi di kill</h2><div class="sub">Quante delle tue kill rientrano in queste categorie.</div>
      <table><tbody><tr><td>Attraverso una smoke</td><td>${fl.sm}</td></tr><tr><td>Wallbang</td><td>${fl.wb}</td></tr><tr><td>Mentre eri accecato</td><td>${fl.blind}</td></tr><tr><td>In aria</td><td>${fl.air}</td></tr><tr><td>No scope</td><td>${fl.ns}</td></tr></tbody></table></div>
  </div>`;
}

/* ---- coach ---- */
function viewCoach(ms){
  const list = insights(ms, state.fSide);
  const A = agg(ms, state.fSide);
  const label = {alta:'Priorità alta', media:'Da migliorare', ok:'Punto di forza', info:'Nota'};
  const focus = list.filter(i=>i.sev==='alta'||i.sev==='media').slice(0,3);
  return `${A.n < 15 ? `<div class="note">Hai caricato ${A.n} ${A.n===1?'partita':'partite'}: i consigli si basano su pochi dati e vanno letti come indizi. Dalle 15-20 partite diventano molto più affidabili.</div>`:''}
  ${focus.length?`<div class="card"><h2>Su cosa lavorare adesso</h2><div class="sub">Le tre cose più utili da correggere nelle prossime partite.</div><ol style="margin:0;padding-left:20px">${focus.map(f=>`<li style="margin:4px 0"><b>${esc(f.title)}</b>. ${esc(f.tip)}</li>`).join('')}</ol></div>`:''}
  <div class="grid g2">${list.map(i=>`<div class="ins ${i.sev}"><div class="stripe"></div><div><div class="tag">${label[i.sev]}</div><h3>${esc(i.title)}</h3><p>${esc(i.ev)}</p><p class="ev">${esc(i.tip)}</p></div></div>`).join('')}</div>
  <div class="card"><h2>Come aggiungere altre partite</h2><div class="sub">La pagina non può leggere i file .dem direttamente, quindi le demo si convertono una volta sul tuo computer.</div>
    <ol style="padding-left:20px;margin:0"><li>Scarica la demo da Premier o FACEIT (o con CS Demo Manager).</li><li>Installa Python e le librerie: <code>pip install demoparser2 pandas</code></li><li>Lancia lo script <code>cs_parser.py</code> sulle demo:</li></ol>
    <pre>python cs_parser.py --steamid ${SID} --out cs_data.json demo1.dem demo2.dem demo3.dem</pre>
    <p class="sub">4. Premi <b>Importa dati</b> in alto e scegli <code>cs_data.json</code>. Le partite già presenti non vengono duplicate.</p></div>`;
}

