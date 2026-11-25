/* ---- death frames (newer demos) ---- */
const UT_DUR = {smoke:18, molotov:7, flash:1.2, he:0.7};
const UT_COL = {smoke:'#c9d1da', flash:'#fff36b', he:'#ff8a3d', molotov:'#ff5a1f'};
function framesStrip(m, e){
  const c = e.c; if(!c || !c.fr || !c.fr.length) return '';
  const map = m.map, ug = c.ug||[];
  const raw = c.fr.flatMap(f=>f.p.map(p=>[p[0],p[1]])).concat(ug.map(u=>[u.x,u.y]));
  const pt = ptFn(map, raw), P = raw.map(p=>pt(p[0],p[1]));
  const x0=Math.min(...P.map(p=>p[0])), x1=Math.max(...P.map(p=>p[0])), y0=Math.min(...P.map(p=>p[1])), y1=Math.max(...P.map(p=>p[1]));
  const sz = Math.max(x1-x0, y1-y0, 300) + 160, cx=(x0+x1)/2, cy=(y0+y1)/2;
  const vb = [Math.max(0,Math.min(1000-sz,cx-sz/2)), Math.max(0,Math.min(1000-sz,cy-sz/2)), Math.min(sz,1000), Math.min(sz,1000)];
  const k = vb[2]/1000, R = v => +(v*Math.max(k,0.28)).toFixed(1);
  const meP = c.pos && c.pos.find(p=>p.tm==='me'), lm = lvlOf(map, meP ? meP.z : e.vz);
  const figs = c.fr.map(f=>{
    const sh = [];
    for(const u of ug){
      const a = f.dt - u.dt; if(a<0 || a>(UT_DUR[u.k]||1)) continue;
      if(lm>=0 && u.z!=null && lvlOf(map,u.z)!==lm) continue;
      const [ux,uy] = pt(u.x,u.y), col = UT_COL[u.k];
      const rad = u.k==='smoke' ? 140/ ( (MAPS[map]?MAPS[map].scale:5)*1.024) : u.k==='molotov' ? 120/((MAPS[map]?MAPS[map].scale:5)*1.024) : 60/((MAPS[map]?MAPS[map].scale:5)*1.024);
      sh.push(`<circle cx="${ux.toFixed(1)}" cy="${uy.toFixed(1)}" r="${Math.max(rad,R(10)).toFixed(1)}" fill="${col}" fill-opacity="${u.k==='smoke'?.55:.4}" stroke="${col}" stroke-width="${R(2)}" ${tipAttr(({smoke:'Smoke',flash:'Flash',he:'HE',molotov:'Molotov'})[u.k]+(u.me?' (tua)':u.tm===1?' (compagno)':' (avversario)'))}/>`);
    }
    for(const p of f.p){
      if(lm>=0 && p[5]!=null && lvlOf(map,p[5])!==lm) continue;
      const [u,v] = pt(p[0],p[1]);
      const col = p[2]===0 ? '#ffd34d' : p[2]===1 ? '#4aa3ff' : '#ff5c5c';
      if(p[3]>=0){
        const rad = p[3]*Math.PI/180, [u2,v2] = pt(p[0]+Math.cos(rad)*100, p[1]+Math.sin(rad)*100);
        const ang = Math.atan2(v2-v, u2-u), L = R(70), w = 0.7;
        const a1=[u+Math.cos(ang-w)*L, v+Math.sin(ang-w)*L], a2=[u+Math.cos(ang+w)*L, v+Math.sin(ang+w)*L];
        sh.push(`<polygon points="${u.toFixed(1)},${v.toFixed(1)} ${a1[0].toFixed(1)},${a1[1].toFixed(1)} ${a2[0].toFixed(1)},${a2[1].toFixed(1)}" fill="${col}" fill-opacity=".22"/>`);
      }
      if(p[2]===0 && f.dt===0) sh.push(`<path d="M${u-R(10)} ${v-R(10)}L${u+R(10)} ${v+R(10)}M${u+R(10)} ${v-R(10)}L${u-R(10)} ${v+R(10)}" stroke="#ffd34d" stroke-width="${R(6)}" stroke-linecap="round"/>`);
      else sh.push(`<circle cx="${u.toFixed(1)}" cy="${v.toFixed(1)}" r="${R(p[4]?10:8)}" fill="${col}" stroke="${p[4]?'#fff':'#000'}" stroke-width="${R(p[4]?3.5:2)}"/>`);
    }
    return `<figure style="margin:0"><div style="border-radius:8px;overflow:hidden">${radarSVG(map, lm>=0 ? sh.map(x=>tg(x,lm)) : sh, {vb: vb.map(v=>+v.toFixed(1)).join(' ')})}</div><figcaption class="sub" style="text-align:center;margin-top:4px">${f.dt===0?'Alla morte':'−'+Math.abs(f.dt)+' s'}${lm>=0?' · '+LEVELS[map].names[lm]:''}</figcaption></figure>`;
  }).join('');
  return `<div style="margin-top:14px"><h3 style="margin:0 0 4px">Come si è sviluppata la situazione (da −3 s alla morte)</h3>
    <div class="sub">Quattro fotogrammi dalla mappa 2D. Pallino = giocatore vivo, ✕ = morto (nell'ultimo fotogramma sei tu). Giallo = tu, blu = compagni, rosso = avversari (bordo bianco = chi ti ha ucciso). I coni mostrano dove guardava ognuno. Cerchi: smoke (grigio), flash (giallo), HE (arancio), molotov (rosso).</div>
    <div class="frames">${figs}</div></div>`;
}

/* ---- mistakes inside a single match ---- */
function matchErrors(m){
  const side = state.fSide;
  const all = m.me.deaths.filter(e=>!e.teamkill && sideOk(side,e));
  const L = all.filter(e=>e.c).map(e=>({m,e,rev:reviewDeath(e)}));
  if(!all.length) return '<div class="empty">Nessuna morte in questa partita con i filtri scelti.</div>';
  if(!L.length) return '<div class="empty">Per questa partita non c\'è il dettaglio delle morti: è stata analizzata prima di questa funzione e la demo non c\'è più.</div>';
  const cnt = {}; for(const it of L) for(const id of new Set(it.rev.map(r=>r.id))) cnt[id] = (cnt[id]||0)+1;
  const top = Object.keys(cnt).filter(k=>k!=='ok'&&k!=='scontro').sort((a,b)=>cnt[b]-cnt[a]).slice(0,3);
  const noFr = L.filter(it=>!it.e.c.fr).length;
  const fl = m.me.util.filter(u=>u.kind==='flash'&&u.en!==undefined);
  const flTab = fl.length ? `<div class="card"><h2>Le tue flash in questa partita</h2><div class="sub">Per ogni flash: quanti nemici sono stati accecati (≥1,1 s), se hai accecato compagni o te stesso, e se un avversario accecato è stato ucciso subito dopo.</div><div class="scroll"><table><thead><tr><th>Round</th><th>Lato</th><th>Nemici accecati</th><th>Compagni</th><th>Tu</th><th>Kill dopo la flash</th><th>Giudizio</th></tr></thead><tbody>${fl.map(u=>`<tr><td>${u.r}</td><td><span class="side ${u.side}">${u.side}</span></td><td>${u.en}${u.bd?` (fino a ${u.bd} s)`:''}</td><td class="${u.tm?'down':''}">${u.tm}</td><td class="${u.sf>=1?'down':''}">${u.sf?u.sf+' s':'–'}</td><td>${u.fk?'<b class="up">sì</b>':'no'}</td><td style="text-align:left;white-space:normal">${u.en===0?'<span class="down">nessun nemico accecato: lancio sprecato</span>':u.fk?'<span class="up">ha portato una kill</span>':u.tm?'<span class="mid">hai accecato un compagno</span>':'<span class="mid">ha accecato ma senza kill</span>'}</td></tr>`).join('')}</tbody></table></div></div>` : '';
  return `${noFr?`<div class="note">${noFr===L.length?'Per questa partita non ci sono i fotogrammi':'Per '+noFr+' morti non ci sono i fotogrammi'}: si registrano solo per le demo analizzate dopo questo aggiornamento. Resta la mappa con la posizione di tutti al momento della morte.</div>`:''}
  <div class="card"><h2>Errori di questa partita</h2><div class="sub">${L.length} morti analizzate${top.length?'. Cause principali qui: '+top.map(k=>`<b>${ECAT[k]}</b> (${cnt[k]})`).join(', '):''}. Una morte può avere più cause; l'analisi su tutte le partite è nel tab "Errori e fix".</div></div>
  ${flTab}
  ${(DV.cur = L.slice(), L.forEach((x,i)=>DV_IDX.set(x.e,i)), '')}${L.map(it=>deathCard(it)).join('')}`;
}

