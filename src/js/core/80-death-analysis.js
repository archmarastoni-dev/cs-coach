/* Mistakes: analysis of every death (classification runs here, so it can change without re-parsing demos) */
const U_M = 52.5;                       // game units per metre

function recentOf(e){
  const m = state.matches.find(x=>x.me.deaths.includes(e)), c = e.c || {}, lines = [], myKills = [];
  if(!m) return {lines, myKills, full:false};
  const me_ = (c.pos||[]).find(p=>p.tm==='me');
  const dm = (x,y) => me_ && x!=null ? Math.round(Math.hypot(x-me_.x, y-me_.y)/U_M) : null;
  for(const k of m.me.kills) if(k.r===e.r && k.t<e.t && e.t-k.t<=12) myKills.push({dt:+(e.t-k.t).toFixed(1), victim:k.victim, w:k.w, ax:k.ax, ay:k.ay});
  const full = Array.isArray(c.ev);
  const tm = s => s>0.049 ? `−${Math.round(s)} s` : s<-0.049 ? `+${Math.round(-s)} s` : '0 s';
  const items = [];
  let tradeOf = null;
  if(full){
    const ev = c.ev;
    ev.forEach(x=>{
      if(x.k==='d'){
        const where = x.x!=null && me_ ? ` · a ${dm(x.x,x.y)} m da te` : '';
        let s;
        if(x.vt==='mate') s = `${x.v} (compagno) ucciso da ${x.a||'?'}${x.w?' ('+wname(x.w)+')':''}${where}`;
        else if(x.vt==='foe' && x.at==='me'){ const tr = ev.find(y=>y.k==='d' && y.vt==='mate' && y.a===x.v && y.s>x.s); if(tr) tradeOf = tradeOf || tr; s = `hai ucciso ${x.v}${x.w?' ('+wname(x.w)+(x.hs?', testa':'')+')':''}${tr?` → trade di ${tr.v}`:''}`; }
        else if(x.vt==='foe' && x.at==='mate'){ const tr = ev.find(y=>y.k==='d' && y.vt==='me' && y.a===x.v); s = `${x.a} (compagno) ha ucciso ${x.v}${where}${x.s<0&&x.v===e.killer?' → ti ha vendicato':''}`; }
        else s = `${x.v} ucciso${x.a?' da '+x.a:''}`;
        items.push({s:x.s, t:s});
      } else if(x.k==='u'){
        const who = x.ut==='foe' ? 'un avversario ha lanciato' : x.ut==='mate' ? 'un compagno ha lanciato' : 'hai lanciato';
        items.push({s:x.s, t:`${who} ${(KIND[x.u]||x.u).toLowerCase()}`});
      }
    });
    items.push({s:0, t:`<b>sei stato ucciso da ${e.killer}</b> (${wname(e.w)})`, raw:true});
  } else {
    for(const k of myKills) items.push({s:k.dt, t:`hai ucciso ${k.victim}`});
    for(const u of m.me.util) if(u.r===e.r && u.t<=e.t && e.t-u.t<=12) items.push({s:e.t-u.t, t:`hai lanciato ${(KIND[u.kind]||u.kind).toLowerCase()}`});
    if(items.length) items.push({s:0, t:`<b>sei stato ucciso da ${e.killer}</b> (${wname(e.w)})`, raw:true});
  }
  items.sort((a,b)=>b.s-a.s).forEach(x=>lines.push({h:`${tm(x.s)} · ${x.raw?x.t:esc(x.t)}`}));
  return {lines, myKills, full, tradeOf};
}
/* fight context: who was around me shortly before and after */
function fightOf(e){
  const rc = recentOf(e), c = e.c || {}, ev = Array.isArray(c.ev) ? c.ev : [];
  const me_ = (c.pos||[]).find(p=>p.tm==='me'), lk = rc.myKills.length ? rc.myKills[rc.myKills.length-1] : null;
  const near = (x,y,r) => me_ && x!=null && Math.hypot(x-me_.x, y-me_.y) < r;
  const f = {rc, lk, chain: rc.myKills.filter(k=>k.dt<=8).length, busy: !!(lk && lk.dt<=3), notes:[], md3:null};
  f.mateDeath = ev.find(x=>x.k==='d' && x.vt==='mate' && x.s<=8 && x.s>=-6 && near(x.x,x.y,1300)) || null;
  f.mateKills = ev.filter(x=>x.k==='d' && x.vt==='foe' && x.at==='mate' && x.s<=8 && x.s>=-6 && (near(x.x,x.y,1300) || near(x.ax,x.ay,1300)));
  f.tradedBy = ev.find(x=>x.k==='d' && x.vt==='foe' && x.at==='mate' && x.s<0 && x.s>=-6 && x.v===e.killer) || null;
  const me3 = (c.p3||[]).find(p=>p.tm==='me');
  if(me3){ const d = (c.p3||[]).filter(p=>p.tm==='mate').map(p=>Math.hypot(p.x-me3.x,p.y-me3.y)); if(d.length) f.md3 = Math.min(...d); }
  f.inFight = f.busy || (lk && lk.dt<=5) || !!f.mateDeath || f.mateKills.length>0 || !!f.tradedBy;
  const sec = x => Math.abs(Math.round(x));
  if(f.chain>=1 && lk) f.notes.push(`Venivi da ${f.chain} ${f.chain===1?'kill':'kill di fila'} (l'ultima ${sec(lk.dt)} s prima): eri già in uno scontro attivo.`);
  if(f.mateDeath) f.notes.push(`Il compagno ${f.mateDeath.v} era caduto ${sec(f.mateDeath.s)} s ${f.mateDeath.s>0?'prima':'dopo'} a ${Math.round(Math.hypot(f.mateDeath.x-me_.x,f.mateDeath.y-me_.y)/U_M)} m da te: scontro di gruppo.`);
  if(f.mateKills.length) f.notes.push(`${[...new Set(f.mateKills.map(x=>x.a))].join(', ')} ${new Set(f.mateKills.map(x=>x.a)).size>1?'hanno':'ha'} fatto kill nella tua zona nei secondi vicini alla tua morte.`);
  if(f.tradedBy) f.notes.push(`${f.tradedBy.a} ti ha vendicato dopo ${sec(f.tradedBy.s)} s: il trade c'è stato.`);
  if(f.md3!=null) f.notes.push(`3 s prima il compagno più vicino era a ${Math.round(f.md3/U_M)} m.`);
  return f;
}
function utilAdvice(e){
  const c = e.c, out = [], me_ = c.pos.find(p=>p.tm==='me'), ki = c.pos.find(p=>p.k);
  if(!me_ || !ki) return out;
  const kp = ki.pl || 'il punto da cui è arrivato', mp = c.pl || 'dove eri', d = Math.round(Math.hypot(ki.x-me_.x, ki.y-me_.y)/U_M);
  const grp = c.pos.filter(p=>p.tm==='foe' && Math.hypot(p.x-ki.x, p.y-ki.y)<800).length;
  if(c.ut.flash) out.push(`Flash: lanciala verso ${kp} (circa ${d} m da te) in modo che esploda prima del contatto, poi affacciati da ${mp} subito dopo lo scoppio.`);
  if(c.ut.molotov) out.push(grp>=2 ? `Molotov su ${kp}: ${grp} avversari arrivavano vicini tra loro, il fuoco li rallenta e ti dà il tempo di ritirarti o di far arrivare i compagni.` : `Molotov su ${kp}: costringe l'avversario a lasciare l'angolo prima che tu lo apra.`);
  if(c.ut.he) out.push(grp>=2 ? `HE su ${kp}: gli avversari erano raggruppati (${grp} entro ~15 m) e una granata sul punto d'ingresso fa danno a più di uno.` : `HE su ${kp} per fare danno prima del peek.`);
  if(c.ut.smoke) out.push(`Smoke tra te e ${kp}: taglia la linea di tiro e ti fa guadagnare tempo per un compagno o per ritirarti.`);
  return out;
}
const SEV = {alta:'', media:'mid', ok:'ok'};
function reviewDeath(e){
  const c = e.c, out = [];
  if(!c) return out;
  const mt = c.md==null ? null : Math.round(c.md/U_M);
  const util = c.ut.flash + c.ut.smoke + c.ut.he + c.ut.molotov;
  const utilTxt = [c.ut.flash?c.ut.flash+' flash':'', c.ut.smoke?c.ut.smoke+' smoke':'', c.ut.he?c.ut.he+' HE':'', c.ut.molotov?c.ut.molotov+' molotov':''].filter(Boolean).join(', ');
  const add = (id, sev, title, why, fix) => out.push({id, sev, title, why, fix});
  const f = fightOf(e), rc = f.rc, lk = f.lk;
  const fresh = f.inFight ? ` Eri in uno scontro: ${f.notes.slice(0,2).join(' ')}` : '';
  const isolated = c.md>1100 && !(f.md3!=null && f.md3<=1100) && !f.mateDeath && !f.mateKills.length;
  if(c.ma>=1 && !e.traded && !f.tradedBy){
    if(isolated) add('isolato','alta','Morto isolato', `Il compagno più vicino (${c.mn||'?'}) era a circa ${mt} m (soglia di questo tool: oltre ~21 m): nessuno poteva rispondere subito.${fresh}`,
      'Una morte si "paga" solo se un compagno può vendicarla subito. Prima del contatto resta abbastanza vicino da poter rispondere (la distanza giusta dipende dall\'angolo); se la squadra è lontana, raccogli informazioni e aspetta invece di prendere il duello da solo.');
    else add('notrade','media','Morte non tradata con compagno vicino', `${c.mn||'Un compagno'} era a ${mt} m ma nessuno ha ucciso chi ti ha eliminato entro 5 secondi.${f.md3!=null?` (3 s prima il più vicino era a ${Math.round(f.md3/U_M)} m)`:''}${fresh}`,
      'Chi è dietro deve avere il mirino già sull\'angolo da cui sparerà il nemico e partire appena il primo cade: il trade riesce se il secondo è pronto a rispondere entro circa un secondo, non se aspetta di vedere cosa succede.');
  }
  if(util>=1 && (c.ut.flash>=1 || util>=2)) add('util', e.open?'alta':'media','Morto con utility ancora in tasca', `Avevi ancora ${utilTxt}.`,
    'Prima di un peek o di un\'entrata in zona contesa lancia utility. ' + (utilAdvice(e).join(' ') || 'Una flash (anche su te stesso, "pop flash") prima del peek, una molotov o una HE sui punti dove di solito si nasconde l\'avversario, una smoke per togliere la visuale di un angolo pericoloso.'));
  if(lk && lk.dt>4 && lk.dt<=12 && c.fa>=1 && !f.mateDeath){
    const same = c.tr.length && lk.ax!=null ? Math.hypot(c.tr[c.tr.length-1][0]-lk.ax, c.tr[c.tr.length-1][1]-lk.ay) < 350 : false;
    if(same) add('dopokill', 'media', 'Morto dopo una tua kill, nello stesso punto', `Avevi ucciso ${lk.victim} ${Math.round(lk.dt)} s prima${rc.tradeOf?` (era un trade: avevi vendicato ${rc.tradeOf.v||'un compagno'})`:''} e eri ancora nella stessa zona; ${e.killer} ha preso il contatto dopo.`,
      'C\'era tempo (più di 4 s) per cambiare posizione: dopo una kill, se gli avversari sono ancora in spinta, fai un passo indietro, cambia angolo o fatti coprire da un compagno.');
  }
  if(f.inFight && (f.busy || (lk && lk.dt<=4) || f.mateDeath || f.tradedBy)){
    add('scontro','ok','In pieno scontro: non era una svista', `${f.notes.slice(0,3).join(' ')} Non c\'era il tempo di spostarsi o di controllare un altro angolo.`,
      'Il margine di miglioramento sta prima del fight: iniziarlo con una flash o con un compagno già puntato sul tuo angolo, e arrivarci con la posizione giusta (vedi gli altri segnali e la tattica).');
  }
  if(c.fl>=0.5) add('flash','alta','Morto mentre eri accecato', `Eri accecato (${c.fl} s) quando sei stato ucciso.`,
    'Se sei accecato o senti una flash nemica non fare peek: torna dietro l\'angolo e lascia sprecare la loro utility. Se la prevedi, apri l\'angolo solo dopo che è esplosa.');
  if(e.open && e.side==='T' && !e.traded) add('entry','alta','Primo duello del round perso senza supporto', `Primo morto del round (${e.t} s) e il compagno più vicino non ha vendicato la tua morte.`,
    'Chi prende il primo contatto non è per forza in errore, ma deve avere un supporto: una flash (tua o di un compagno) e un compagno pronto a seguirlo. Senza questi, rinuncia all\'entry e gioca un default.');
  if(c.sp>=180 && e.w!=='knife' && !f.busy) add('corsa','media','Stavi correndo', `Velocità al momento della morte: ${c.sp} unità/s (da fermo preciso sotto ~45).`,
    'In CS2 la precisione cala molto in movimento: prima di sparare fermati con il counter-strafe (tocca il tasto opposto alla direzione in cui vai) e poi premi il grilletto. Rallenta (shift) prima di aprire un angolo.');
  if(e.side==='T' && e.t<20 && !c.pb) add('presto','media','Morto molto presto', `Sei morto dopo ${e.t} s, quando il resto del team di solito non è ancora in posizione.`,
    'Morire per primo non è sempre un errore (a volte è il prezzo dell\'entry), lo diventa quando arrivi da solo, in anticipo e senza utility. Se non era un rush deciso, aspetta il resto del team.');
  if(e.a && e.a.e0!=null && e.a.e0>40 && !f.busy) add('mira','media','Guardavi altrove', `Quando ${e.killer} ha iniziato a sparare il tuo mirino era a circa ${Math.round(e.a.e0)}° da lui.`,
    'Tieni il mirino all\'altezza della testa nel punto in cui apparirà il nemico (l\'altezza cambia con distanza, scale e scatole) e fai pre-aim sugli angoli comuni prima di aprirli, uno alla volta.');
  if(!out.length) add('ok','ok','Nessun errore evidente nei dati', 'Posizione, compagni e utility non mostrano anomalie: probabilmente un duello perso di mira o di tempismo.', 'Guarda la distanza e l\'arma dell\'avversario nella scheda per capire se hai scelto bene l\'angolo.');
  return out;
}
const ECAT = {isolato:'Isolato', notrade:'Senza trade', util:'Utility non usata', flash:'Accecato', entry:'Entry senza supporto', corsa:'In corsa', mira:'Mirino altrove', presto:'Troppo presto', dopokill:'Dopo una kill', scontro:'In pieno scontro', ok:'Nessun errore'};
function deathList(ms){
  const L = [];
  for(const m of ms.slice().sort((a,b)=>cmpM(b,a))) for(const e of m.me.deaths) if(e.c && !e.teamkill && sideOk(state.fSide,e)) L.push({m,e,rev:reviewDeath(e)});
  return L;
}
function deathRadar(m, e){
  const c = e.c, map = m.map;
  const raw = c.pos.map(p=>[p.x,p.y]).concat(c.tr);
  const pt = ptFn(map, raw);
  const P = raw.map(p=>pt(p[0],p[1]));
  let x0=Math.min(...P.map(p=>p[0])), x1=Math.max(...P.map(p=>p[0])), y0=Math.min(...P.map(p=>p[1])), y1=Math.max(...P.map(p=>p[1]));
  const sz = Math.max(x1-x0, y1-y0, 260) + 140, cx=(x0+x1)/2, cy=(y0+y1)/2;
  const vb = [Math.max(0,Math.min(1000-sz,cx-sz/2)), Math.max(0,Math.min(1000-sz,cy-sz/2)), Math.min(sz,1000), Math.min(sz,1000)];
  const k = vb[2]/1000, R = v => +(v*Math.max(k,0.28)).toFixed(1);
  const sh = [];
  const me_ = c.pos.find(p=>p.tm==='me'), ki = c.pos.find(p=>p.k);
  if(c.tr.length>1){
    const pts = c.tr.map(p=>pt(p[0],p[1]).map(v=>v.toFixed(1)).join(',')).join(' ');
    sh.push(`<polyline points="${pts}" fill="none" stroke="#ffd34d" stroke-width="${R(5)}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".85" stroke-dasharray="${R(10)} ${R(7)}"/>`);
  }
  if(me_ && ki){ const a=pt(me_.x,me_.y), b=pt(ki.x,ki.y); sh.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#ff5c5c" stroke-width="${R(3)}" stroke-dasharray="${R(8)} ${R(6)}" stroke-opacity=".8"/>`); }
  for(const p of c.pos){
    const [u,v] = pt(p.x,p.y);
    const col = p.tm==='me' ? '#ffd34d' : p.tm==='mate' ? '#4aa3ff' : '#ff5c5c';
    const lab = p.tm==='me' ? 'Tu' : esc(p.n);
    const info = `${p.tm==='me'?'Tu (morto qui)':p.tm==='mate'?'Compagno':'Avversario'} · ${esc(p.n)}${p.pl?' · '+esc(p.pl):''}${p.w?' · '+esc(wname(p.w)):''}`;
    if(p.tm==='me') sh.push(`<path d="M${u-R(11)} ${v-R(11)}L${u+R(11)} ${v+R(11)}M${u+R(11)} ${v-R(11)}L${u-R(11)} ${v+R(11)}" stroke="#ffd34d" stroke-width="${R(6)}" stroke-linecap="round" ${tipAttr(info)}/>`);
    else sh.push(`<circle cx="${u}" cy="${v}" r="${R(p.k?11:9)}" fill="${col}" stroke="${p.k?'#fff':'#000'}" stroke-width="${R(p.k?3.5:2)}" ${tipAttr(info+(p.k?' · ti ha ucciso':''))}/>`);
    if(p.tm==='me' || p.k || (p.tm==='mate' && p.n===c.mn)) sh.push(`<text x="${u+R(14)}" y="${v-R(12)}" fill="#fff" font-size="${R(20)}" stroke="#000" stroke-width="${R(4)}" paint-order="stroke" font-weight="600">${lab}</text>`);
  }
  return radarSVG(map, sh, {vb: vb.map(v=>+v.toFixed(1)).join(' ')});
}
function pathTxt(c){
  let d = 0; for(let i=1;i<c.tr.length;i++) d += Math.hypot(c.tr[i][0]-c.tr[i-1][0], c.tr[i][1]-c.tr[i-1][1]);
  return c.tr.length>1 ? `percorsi ${Math.round(d/U_M)} m negli ultimi 4 s, velocità finale ${c.sp} u/s ·` : '';
}
function tactics(e, rev){
  const c = e.c, ids = new Set(rev.map(r=>r.id)), T = e.side==='T', pl = c.pl || 'quel punto';
  const util = [c.ut.flash?'flash':'', c.ut.smoke?'smoke':'', c.ut.he?'HE':'', c.ut.molotov?'molotov':''].filter(Boolean).join(' / ');
  const out = [];
  if(c.pb) out.push(T ? 'Con la bomba piazzata il tempo lavora per te: resta in una posizione sicura, preferibilmente in crossfire con un compagno, e fai venire il nemico da te invece di cercare la kill.'
                      : 'Con la bomba piazzata non entrare da solo: coordina il defuse con i compagni, liberate gli angoli con molotov/HE e poi entrate insieme (il primo contatto da solo svela agli avversari dove sono gli altri).');
  else if(c.ma===0 && c.fa>=2) out.push('Eri l\'ultimo vivo contro più avversari: gioca il tempo, raccogli informazioni e prendi un solo duello alla volta; se il round è perso, salva l\'arma.');
  else if(c.ma>=c.fa && !e.traded && (ids.has('isolato')||ids.has('notrade')||ids.has('entry'))) out.push(`Avevi superiorità numerica (${c.ma} compagni vs ${c.fa} avversari): non serviva forzare il duello. Aspetta i compagni e prendi il contatto insieme.`);
  if(ids.has('isolato')||ids.has('notrade')) out.push(T ? `Prima di prendere ${pl} entra con un compagno che abbia il mirino pronto sul tuo stesso angolo: il primo apre il duello, il secondo risponde entro circa un secondo. Se sei solo, rallenta e lascia l'entrata a chi ha l'utility.`
      : `Gioca ${pl} in crossfire: un compagno copre l'angolo da cui ti sparano e, dopo il primo contatto, torni verso di lui invece di allungare il duello da solo. Se i compagni sono lontani, cedi un po' di spazio e aspetta.`);
  if(ids.has('entry')) out.push('Fai l\'entry solo con una flash (tua o di un compagno): entra subito dopo che è esplosa e fatti seguire da chi viene dopo di te. Senza utility, rinuncia all\'entry e gioca un default.');
  if(ids.has('util')) out.push(`Prima del contatto in ${pl} usa ${util}: pop flash prima del peek, molotov o HE sui punti dove si nasconde l'avversario, smoke per togliere la visuale a un angolo pericoloso.`);
  if(ids.has('flash')) out.push('Contro avversari con flash disponibili gioca dietro l\'angolo e fai peek solo dopo che la flash è esplosa; un piccolo jiggle (affaccio rapido) fa sprecare la loro utility.');
  if(ids.has('corsa')||ids.has('mira')) out.push('Prima di un angolo rallenta, tieni il mirino all\'altezza della testa e apri l\'angolo un poco alla volta (shoulder/jiggle peek) invece di un peek largo: vedi un avversario per volta e spari da fermo con il counter-strafe.');
  if(ids.has('scontro')) out.unshift('Eri in pieno scontro: la tattica è preparare il fight, non reagire dopo. Entra con una flash o con un compagno che copra il tuo angolo, e fai il trade tenendo il mirino già sul punto da cui sparerà il prossimo avversario.');
  if(ids.has('dopokill')) out.push('Dopo una kill o un trade non restare sullo stesso angolo se ci sono ancora avversari in spinta: arretra o cambia posizione, così il prossimo avversario non trova il mirino già puntato su di te.');
  if(ids.has('presto')) out.push('Nei primi secondi tieni il default e raccogli informazioni: il primo contatto deve arrivare dopo l\'utility del team, non prima.');
  if(ids.has('ok') && !out.length) out.push('Nessun errore tattico evidente: rivedi distanza, arma e angolo dell\'avversario. Se perdi spesso lo stesso duello, cambia angolo o distanza prima di cambiare mira.');
  return out.slice(0,3);
}
const DRILL = {
  isolato:'Per 10 partite, prima di ogni peek guarda dove sono i compagni: se il più vicino è oltre ~20 m, aspetta. Obiettivo: ridurre le morti isolate.',
  notrade:'Dopo che un compagno entra, conta 1-2 e seguilo con il mirino già sull\'angolo. Con un amico prova il duo: uno apre il duello, l\'altro fa il trade.',
  util:'Regola: non muori con una flash in tasca. Prima di ogni contatto lancia flash o smoke. Per imparare le traiettorie usa la sezione Utility di Yprac Hub (Workshop).',
  flash:'Quando senti una flash nemica, torna dietro l\'angolo e gira lo sguardo; apri l\'angolo solo dopo che è esplosa.',
  entry:'Entra solo dopo una flash. Se nessuno la lancia, chiedila o lasciala fare a un altro e fai da secondo.',
  corsa:'Drill del muro: in una mappa di allenamento (es. Aim Botz) muoviti A/D davanti a un bersaglio, fai counter-strafe e spara un solo colpo; controlla che i colpi vadano dove miri. Poi ripeti con bot che si muovono.',
  mira:'Cammina la mappa in una mappa prefire (es. Yprac Hub, modalità Prefire) tenendo il mirino sempre all\'altezza della testa, poi ripeti sui punti dove muori più spesso.',
  presto:'Nei primi 30 secondi da T non prendere contatti da solo: aspetta l\'utility e i compagni.',
  dopokill:'Dopo ogni kill (o trade) fai un passo indietro o cambia angolo prima del prossimo contatto: l\'avversario successivo ha già il mirino sul tuo punto.'
};
const SRC = {
  eco1:['Guida all\'economia di CS2 (Esports Insider, gen 2026)','https://esportsinsider.com/cs2-economy-guide'],
  eco2:['Soglie di acquisto e trappola del force buy (Switchblade Gaming)','https://www.switchbladegaming.com/cs2/economy-guide/'],
  eco3:['Come leggere l\'economia: loss bonus e tipi di buy (Hotspawn)','https://www.hotspawn.com/counter-strike/guide/how-to-read-the-economy-in-cs2'],
  eco4:['The Ultimate CS2 Economy Guide (ProSettings)','https://prosettings.net/blog/cs2-economy-guide/'],
  eco5:['CS2 economy tips: managing money (Dignitas)','https://dignitas.gg/articles/cs2-economy-tips-managing-money-for-competitive-wins'],
  gloss:['Glossario delle statistiche Leetify: flash, utility, trade','https://leetify.com/blog/leetify-stats-glossary'],
  proexec:['Dieci concetti di utility negli execute professionistici (Gaming.net)','https://www.gaming.net/cs2-utility-concepts-behind-professional-site-executes/'],
  review:['Come fare demo review: cinque categorie di errore e pattern ripetuti (GuildOrder)','https://guildorder.com/games/csgo/guides/demo-review-workflow'],
  cross:['Guida al crosshair placement (CSDB)','https://csdb.gg/guide-to-crosshair-placement/'],
  crossmore:['Crosshair placement oltre il "head level" (SCL)','https://scl.gg/article/93'],
  aim:['Come mirare in CS2: ordine delle abilità (CSDB)','https://csdb.gg/how-to-aim-in-cs2/'],
  cs:['Counter-strafing in CS2 (Winio)','https://winio.ai/blog/articles/how-to-counter-strafe-in-cs2'],
  mov:['Movement mechanics guide (CSDB)','https://csdb.gg/guides/movement-guide/'],
  adv:['Meccaniche avanzate: shoulder/jiggle peek (CSDB)','https://csdb.gg/guides/advanced-mechanics-guide/'],
  trade:['Trade kill per livello FACEIT (Refrag)','https://refrag.gg/blog/three-stats-that-separate-level-10-faceit-cs2'],
  xfire:['Crossfire e teamplay (Refrag)','https://refrag.gg/blog/what-is-a-crossfire-cs2-teamplay-fundamentals'],
  retake:['Retake: evita il primo contatto da solo (Refrag)','https://refrag.gg/blog/reclaim-control-5-tips-to-improve-your-retakes-in-cs2'],
  dying:['Come non morire per primo (Boostroom)','https://boostroom.com/blog/how-to-stop-dying-first-in-cs2-positioning-timing-guide'],
  space:['Teamwork: ruoli, trade e utility (GameTree)','https://gametree.me/?p=14153'],
  grenade:['Guida alle granate (CSDB)','https://csdb.gg/guides/grenade-guide/'],
  pop:['Guida alle nades: pop flash prima del peek (CS2.ad)','https://cs2.ad/blog/cs2-nades'],
  peek:['Sparare, peek e movimento (SteamAnalyst)','https://www.steamanalyst.com/guides/cs2-shooting-peeking-movement-guide'],
  ws:['Migliori mappe Workshop CS2 (CSDB)','https://csdb.gg/workshop-maps/'],
  peeker:['Peeker\'s advantage: dopo un contatto cambia posizione (CSDB)','https://csdb.gg/the-cs2-peekers-advantage'],
  entry:['Errori tipici dell\'entry: espandersi dopo la prima kill (Refrag)','https://refrag.gg/blog/4-of-the-worst-cs2-entry-fragging-mistakes-that-you-probably-make/'],
  ctutil:['Utility in difesa: molotov/HE e smoke contro i rush (BuyBoosting)','https://buyboosting.com/blog/mastering-utility-in-counter-strike-2-strategic-grenade-usage-for-competitive-play/'],
  pre:['Mappe prefire consigliate (Lis-Skins)','https://lis-skins.com/blog/best-prefire-training-maps-in-cs2/']
};
const SRC_BY = {isolato:['trade','retake','dying'], notrade:['trade','xfire','space'], util:['grenade','pop','ctutil'], flash:['grenade','peek'], entry:['dying','grenade'],
  corsa:['cs','mov','adv'], mira:['cross','crossmore'], presto:['dying'], dopokill:['peeker','entry'], scontro:['trade','xfire'], ok:[]};
const srcLinks = keys => keys.filter(k=>SRC[k]).map(k=>`<a href="${SRC[k][1]}" target="_blank" rel="noopener noreferrer">${esc(SRC[k][0])}</a>`).join(' · ');
/* Workshop maps */
const WSID = id => `https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`;
const WSQ = q => `https://steamcommunity.com/workshop/browse/?appid=730&searchtext=${encodeURIComponent(q)}`;
const WORKSHOP = {
  mov:{t:'Fermarsi prima di sparare (counter-strafe) e movimento', items:[
    {n:'Aim Botz', by:'uLLeticaL', id:3070244462, w:'Bot che si muovono, kevlar regolabile e "wall peek": ci alleni lo stop-e-spara contro bersagli in movimento.'},
    {n:'Yprac Hub (modalità Bot Arena)', by:'Yesber', id:3070715607, w:'Bot procedurali per flick, tracking e acquisizione del bersaglio, in una sola mappa.'}]},
  cross:{t:'Mirino all\'altezza della testa e pre-aim', items:[
    {n:'Yprac Hub (modalità Prefire, 64+ percorsi)', by:'Yesber', id:3070715607, w:'Percorsi di peek e pre-aim su tutte le mappe del pool: ripassa gli angoli dove muori più spesso.'},
    {n:'Aim Botz', by:'uLLeticaL', id:3070244462, w:'Per tenere il mirino già sul bersaglio mentre ti muovi.'}]},
  util:{t:'Utility prima del contatto (flash, smoke, molotov)', items:[
    {n:'Yprac Hub (modalità Utility, 1400+ lineup)', by:'Yesber', id:3070715607, w:'Smoke, flash, molotov e HE per mappa: impara quelle dei punti dove muori più spesso.'}]},
  team:{t:'Giocare vicino ai compagni e rotazioni', items:[
    {n:'Yprac Hub (modalità Shortcuts, 110+ percorsi)', by:'Yesber', id:3070715607, w:'Percorsi di rotazione su ogni mappa, per non arrivare in ritardo o da solo.'}],
    note:'Il trade si allena soprattutto con un compagno (duo o premade): non esiste una mappa Workshop che lo sostituisca.'},
  aim:{t:'Mira generale e spray', items:[
    {n:'Fast Aim / Reflex Training', by:'yolokas', id:3070758981, w:'Bot che attraversano un varco: allena i riflessi.'},
    {n:'training_aim_csgo2', by:'R.I.P 3.0 (originale kataS)', id:3356732599, w:'Bersagli personalizzabili per flick e tracking.'},
    {n:'Recoil Master', by:'uLLeticaL', id:3100869952, w:'Schemi di rinculo di molte armi, da seguire con la "ghost hair" sul muro.'},
    {n:'CS2: 1v1 AIM MAP', by:'Pvt. Sardinky', id:3101654056, w:'Duelli 1v1 contro amici o bot.'}]}
};
const PREFIRE_MAP = {de_dust2:[['5E_Prac_Dust2_Prefire',3244203953],['Dust 2 Prefire',3295650711]], de_mirage:[['5E_Prac_Mirage_Prefire',3232466864],['Mirage Prefire',3267302800]]};
function workshopCard(ms, cnt, L){
  const G = {isolato:'team',notrade:'team',presto:'team',util:'util',flash:'util',entry:'util',corsa:'mov',mira:'cross'};
  const ranked = Object.keys(cnt).filter(k=>G[k]).sort((a,b)=>cnt[b]-cnt[a]);
  const groups = []; for(const k of ranked){ const g=G[k]; if(!groups.includes(g)) groups.push(g); }
  for(const g of ['cross','mov']) if(groups.length<3 && !groups.includes(g)) groups.push(g);
  groups.length = Math.min(groups.length,3);
  const WHY = {mov:`In movimento spari ${cnt.corsa?cnt.corsa+' volte nelle morti analizzate':'spesso'}.`, cross:cnt.mira?`${cnt.mira} morti con il mirino lontano dall'avversario.`:'Utile in ogni caso: è l\'abitudine che rende di più.', util:`${(cnt.util||0)+(cnt.flash||0)+(cnt.entry||0)} morti legate a utility o entry.`, team:`${(cnt.isolato||0)+(cnt.notrade||0)+(cnt.presto||0)} morti isolate, non tradate o troppo presto.`};
  const maps = {}; for(const it of L) maps[it.m.map] = (maps[it.m.map]||0)+1;
  const topMaps = Object.entries(maps).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);
  const card = g => { const W = WORKSHOP[g]; return `<div class="ws"><h4>${esc(W.t)}</h4><p class="sub">${esc(WHY[g]||'')}</p>
    ${W.items.map(i=>`<p>• <a href="${WSID(i.id)}" target="_blank" rel="noopener noreferrer"><b>${esc(i.n)}</b></a> (${esc(i.by)}): ${esc(i.w)} <a class="sub" href="${WSQ(i.n.replace(/ \(.*/,''))}" target="_blank" rel="noopener noreferrer">[cerca nel Workshop]</a></p>`).join('')}
    ${W.note?`<p class="sub">${esc(W.note)}</p>`:''}</div>`; };
  return `<div class="card"><h2>Mappe Workshop consigliate per i tuoi punti deboli</h2>
    <div class="sub">Scelte in base a quello che emerge dalle tue morti. I titoli e gli autori sono confermati da elenchi di terze parti (CSDB, Lis-Skins); le pagine Steam possono non aprirsi senza accesso a Steam, in quel caso usa "cerca nel Workshop" con il nome della mappa.</div>
    ${groups.map(card).join('')}
    ${topMaps.length?`<div class="ws"><h4>Prefire sulle mappe dove muori di più</h4>${topMaps.map(m=>`<p>• <b>${esc(mapName(m))}</b> (${maps[m]} morti): ${(PREFIRE_MAP[m]||[]).map(x=>`<a href="${WSID(x[1])}" target="_blank" rel="noopener noreferrer">${esc(x[0])}</a>`).join(', ')||`<a href="${WSQ(mapName(m)+' prefire')}" target="_blank" rel="noopener noreferrer">cerca "${esc(mapName(m))} prefire" nel Workshop</a>`}</p>`).join('')}</div>`:''}
    ${card('aim')}
    <div class="srcs">Fonti: ${srcLinks(['ws','pre'])}</div></div>`;
}
function sourcesCard(){
  return `<div class="card"><h2>Fonti dei consigli</h2><div class="sub">I consigli del coach si basano su queste guide. Le soglie numeriche usate per classificare le morti (es. 21 m per "isolato", 15° e 40° per il mirino, 45 e 110 unità/s per il movimento) sono scelte di questo tool, non regole ufficiali.</div>
    <ul style="margin:6px 0 0;padding-left:20px">${Object.values(SRC).map(s=>`<li><a href="${s[1]}" target="_blank" rel="noopener noreferrer">${esc(s[0])}</a></li>`).join('')}</ul></div>`;
}
function recentBlock(e){
  const f = fightOf(e), rc = f.rc;
  const body = rc.lines.length ? rc.lines.map(l=>`<p>• ${l.h}</p>`).join('') : `<p class="sub">${rc.full?'Nessun evento nei secondi attorno alla morte: il contatto è arrivato dopo una fase calma.':'Dettaglio non disponibile per questa partita (demo già cancellata prima di questa funzione): non ci sono tue azioni registrate negli ultimi 12 secondi.'}</p>`;
  const notes = f.notes.length ? `<p><b>Lettura:</b> ${f.notes.map(esc).join(' ')}</p>` : '';
  return `<div class="iss ok" style="border-color:#9aa7b8"><h4>Cosa è successo prima e dopo (da −12 s a +6 s)</h4>${body}${notes}${!rc.full&&rc.lines.length?'<p class="sub">Qui compaiono solo le tue azioni: i dati di compagni e avversari esistono solo per le demo analizzate dopo questo aggiornamento.</p>':''}</div>`;
}
function posAnalysis(e){
  const c = e.c; if(!c || !c.pos) return null;
  const me_ = c.pos.find(p=>p.tm==='me'), ki = c.pos.find(p=>p.k);
  if(!me_ || !ki) return null;
  const tr = c.tr||[], ang = (a,b)=>Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
  const dif = (a,b)=>{let d=Math.abs(a-b)%360; return d>180?360-d:d;};
  const dist = (a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const R = {lines:[], peek:'', tags:[]};
  // 1) peek type from the trail
  const sp = c.sp||0;
  let dk0=null, dk1=null, rev=false, path=0;
  if(tr.length>=3){
    const n = tr.length, a = tr[Math.max(0,n-3)], b = tr[n-1];
    dk0 = Math.hypot(a[0]-ki.x,a[1]-ki.y); dk1 = Math.hypot(b[0]-ki.x,b[1]-ki.y);
    for(let i=1;i<n;i++) path += Math.hypot(tr[i][0]-tr[i-1][0],tr[i][1]-tr[i-1][1]);
    let last=null;
    for(let i=1;i<n;i++){ const dx=tr[i][0]-tr[i-1][0], dy=tr[i][1]-tr[i-1][1]; if(Math.hypot(dx,dy)<80) continue; const a2=Math.atan2(dy,dx)*180/Math.PI; if(last!=null && dif(a2,last)>120) rev=true; last=a2; }
  }
  const avg = tr.length>1 ? path/((tr.length-1)*0.5) : sp;
  const adv = dk0!=null ? dk0-dk1 : 0;
  if(tr.length<3) R.peek='n/d';
  else if(rev){ R.peek='jiggle'; R.lines.push('Peek: hai cambiato direzione di colpo negli ultimi secondi (jiggle o affaccio e ritorno). Tecnica giusta contro uno sniper o per far sprecare utility, ma se ti è costata la vita l\'avversario aveva già il mirino sul punto di rientro.'); }
  else if(avg<45){ R.peek='fermo'; R.lines.push('Peek: eri fermo (tenevi l\'angolo). Hai atteso l\'avversario: va bene se il tuo mirino era già sul punto giusto e se un compagno poteva coprirti.'); }
  else if(adv>=150 && sp>110){ R.peek='avanzata'; R.lines.push(`Peek: stavi avanzando verso ${esc(e.killer)} (ti sei avvicinato di ${Math.round(adv/U_M)} m in 1 s) a ${sp} u/s. È un peek largo: l'avversario, già fermo, vede prima e spara da fermo.`); }
  else if(adv<=-150){ R.peek='ritirata'; R.lines.push(`Peek: ti stavi allontanando da ${esc(e.killer)} (ritirata di ${Math.round(-adv/U_M)} m in 1 s). Ti ha colpito mentre ti ritiravi: spesso conviene rompere la linea di tiro invece di correre in rettilineo.`); }
  else { R.peek='laterale'; R.lines.push(`Peek: movimento laterale/di riposizionamento a ${sp} u/s, senza avvicinarti o allontanarti dall'avversario.`); }
  // 2) opponents: exposure and crossfire
  const foes = c.pos.filter(p=>p.tm==='foe'), fd = foes.map(p=>({p, d:dist(me_,p), b:ang(me_,p)})).sort((a,b)=>a.d-b.d);
  const close = fd.filter(x=>x.d<=2500);
  let xf = false;
  for(let i=0;i<close.length&&!xf;i++) for(let j=i+1;j<close.length;j++) if(dif(close[i].b,close[j].b)>50){ xf=true; break; }
  if(xf){ R.tags.push('crossfire'); R.lines.push(`Avversari: ${close.length} nemici entro ${Math.round(2500/U_M)} m da angolazioni diverse (oltre 50° tra loro): eri esposto in crossfire, non potevi guardare tutti gli angoli.`); }
  else if(close.length>=2) R.lines.push(`Avversari: ${close.length} nemici vicini ma dalla stessa direzione: uno solo alla volta poteva sparare, il duello era gestibile con utility o con un compagno già puntato.`);
  else if(foes.length>=2 && !close.length) R.lines.push('Avversari: nessun altro nemico vicino, il duello era 1 contro 1 a distanza.');
  // 3) teammates
  const mates = c.pos.filter(p=>p.tm==='mate').map(p=>({p,d:dist(me_,p),b:ang(me_,p),dk:dist(p,ki)})).sort((a,b)=>a.d-b.d);
  const kb = ang(me_,ki), myDk = dist(me_,ki);
  if(!mates.length) R.lines.push('Compagni: eri l\'ultimo vivo della squadra.');
  else {
    const n0 = mates[0], off = dif(n0.b,kb), md = Math.round(n0.d/U_M);
    const where = off<30?'dietro di te, sulla stessa linea di tiro (può solo seguirti, non crea crossfire)':off<=110?'di lato (angolo utile per un crossfire)':'dal lato opposto all\'avversario (non vedeva il tuo duello)';
    R.lines.push(`Compagni: il più vicino (${esc(n0.p.n)}) era a ${md} m, ${where}.`);
    const ahead = mates.filter(m=>m.dk<myDk-100).length;
    if(!ahead && mates.length) { R.tags.push('piuavanti'); R.lines.push('Eri il giocatore più avanti verso l\'avversario: hai preso il contatto per primo, senza nessuno più avanti a farti da scudo.'); }
    const cl = mates.filter(m=>m.d<=350).length;
    if(cl>=2) R.lines.push(`Eri raggruppato con ${cl} compagni (entro ~7 m): una sola granata o uno spray vi prende tutti, meglio distanziarsi.`);
    if(off>=30&&off<=110&&n0.d<=1300&&!e.traded) R.lines.push('Il compagno era in posizione per il trade ma non l\'ha fatto: probabilmente stava guardando altrove o è arrivato in ritardo.');
  }
  // 4) view data (newer demos)
  if(me_.yw!=null && ki.yw!=null){
    const toMe = ang(ki,me_), toKi = ang(me_,ki);
    const kErr = dif(ki.yw,toMe), mErr = dif(me_.yw,toKi);
    R.lines.push(`Mirino al momento della morte: ${Math.round(mErr)}° dall'avversario; lui aveva il mirino a ${Math.round(kErr)}° da te${kErr<=15?' (ti stava già puntando: pre-aim sul tuo angolo)':''}.`);
    if(me_.cr) R.lines.push('Eri accovacciato quando sei morto.');
  }
  // 5) real map geometry (demos parsed with awpy)
  const g = c.geo;
  if(g){
    R.geo = g;
    if(g.exp>=1.5) { R.tags.push('espostolungo'); R.lines.push(`Linea di tiro: eri visibile dalla posizione di ${esc(e.killer)} da almeno ${g.exp} s prima di morire: sei rimasto troppo a lungo nella sua linea (mappa reale).`); }
    else if(g.exp<=0.5) R.lines.push(`Linea di tiro: sei entrato nella sua linea di tiro solo ora (peek rapido): ${esc(e.killer)} era già in posizione e ti aspettava.`);
    else R.lines.push(`Linea di tiro: eri esposto a ${esc(e.killer)} da circa ${g.exp} s.`);
    if(g.fv>=2){ R.tags.push('piunemici'); R.lines.push(`Nemici con linea di tiro su di te: ${g.fv} (mappa reale): più avversari potevano sparare nello stesso momento.`); }
    if(g.mk===0 && c.ma>=1){ R.tags.push('nessunacopertura'); R.lines.push('Compagni: nessuno aveva linea di tiro sul punto dove stava l\'avversario, quindi nessuno poteva coprirti o vendicarti subito.'); }
    else if(g.mk>=1) R.lines.push(`Compagni: ${g.mk} avevano linea di tiro sull'avversario (potevano coprirti o vendicarti).`);
    if(g.cov){ R.tags.push('copertura'); const d=g.cov.d; const dirT = Math.abs(d)===180?'indietro':Math.abs(d)<=90?(d>0?'di lato (sinistra)':'di lato (destra)'):(d>0?'indietro a sinistra':'indietro a destra'); R.lines.push(`Copertura vicina: bastava un passo di ${g.cov.m} m ${dirT} per uscire dalla sua linea di tiro.`); }
    else R.lines.push('Copertura vicina: nessun punto entro ~2,4 m spezzava la sua linea di tiro: eri in uno spazio aperto.');
  }
  return R;
}
function posSummary(L){
  const A = L.map(it=>posAnalysis(it.e)).filter(Boolean); if(A.length<5) return '';
  const n = A.length, cnt = k=>A.filter(r=>r.peek===k).length, tg = k=>A.filter(r=>r.tags.includes(k)).length;
  const items = [['Avanzata verso il nemico',cnt('avanzata'),'#ff5c5c'],['Fermo ad un angolo',cnt('fermo'),'#4aa3ff'],['Cambio direzione (strafe/jiggle)',cnt('jiggle'),'#e8c53a'],['Ritirata',cnt('ritirata'),'#9aa7b8'],['Laterale',cnt('laterale'),'#2bd47d']].filter(x=>x[1]);
  const pm = (k)=>pc(k/n);
  const adv = cnt('avanzata'), xf = tg('crossfire'), fw = tg('piuavanti');
  const tips = [];
  if(adv/n>=0.3) tips.push(`Nel ${pm(adv)} delle morti stavi avanzando verso l'avversario: apri gli angoli con shoulder peek e utility invece di un peek largo.`);
  if(xf/n>=0.25) tips.push(`Nel ${pm(xf)} dei casi avevi nemici da più angolazioni (crossfire): evita posizioni in cui più angoli ti vedono e fatti coprire.`);
  if(fw/n>=0.4) tips.push(`Nel ${pm(fw)} dei casi eri il più avanti della squadra: aspetta che un compagno sia accanto prima di prendere il contatto.`);
  const G = A.filter(r=>r.geo), gn = G.length;
  if(gn>=5){ const ex=G.filter(r=>r.tags.includes('espostolungo')).length, cv=G.filter(r=>r.tags.includes('copertura')).length, nc=G.filter(r=>r.tags.includes('nessunacopertura')).length;
    if(ex/gn>=0.3) tips.push(`Con la mappa reale: nel ${pc(ex/gn)} delle morti eri nella linea di tiro dell'avversario da almeno 1,5 s.`);
    if(cv/gn>=0.3) tips.push(`Nel ${pc(cv/gn)} delle morti bastava un passo di 1-2 m per spezzare la sua linea: usa di più gli angoli e i ripari vicini.`);
    if(nc/gn>=0.3) tips.push(`Nel ${pc(nc/gn)} dei casi nessun compagno vedeva l'avversario: nessuna copertura per il trade.`); }
  return `<div class="card"><h2>Peek e posizionamento alla morte</h2><div class="sub">Su ${n} morti analizzate: come ti muovevi, dove erano avversari e compagni.</div>${stackBar(items)}${tips.length?`<ul style="margin:10px 0 0;padding-left:20px">${tips.map(x=>`<li style="margin:4px 0">${esc(x)}</li>`).join('')}</ul>`:''}<p class="sub" style="margin-top:8px">${gn>=5?`Geometria reale disponibile per ${gn} morti.`:'Limite: la geometria reale della mappa è disponibile solo per le demo analizzate con awpy.'}</p></div>`;
}
function posBlock(e){
  const R = posAnalysis(e); if(!R) return '';
  return `<div class="iss ok" style="border-color:#c58bff"><h4>Peek e posizionamento</h4>${R.lines.map(l=>`<p>• ${l}</p>`).join('')}<p class="sub">${R.geo?'Linee di tiro e coperture calcolate con la geometria reale della mappa (solo muri e oggetti fissi, non smoke né porte).':'Linee di tiro e coperture reali richiedono la geometria della mappa (installa awpy, vedi LEGGIMI): qui le conclusioni usano solo le posizioni.'}</p></div>`;
}
