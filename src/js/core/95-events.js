/* Events: one delegated click handler, data import and notes */
document.addEventListener('click', e => {
  const lbA = e.target.closest('a[data-lb]'); if(lbA && !LITE){ e.preventDefault(); return lbOpen(lbA); }
  const lbM = e.target.closest('[data-lbmap]'); if(lbM && !LITE){ return lbMap(lbM.dataset.lbmap); }
  const lbT = e.target.closest('[data-lbthrow]'); if(lbT && !LITE){ const [m,i]=lbT.dataset.lbthrow.split('|'); return lbThrow(m,+i); }
  const lbX = e.target.closest('[data-lbclose]'); if(lbX){ return lbClose(); }
  const lbG = e.target.closest('[data-lbgo]'); if(lbG){ return lbGo(+lbG.dataset.lbgo); }
  const t = e.target.closest('button,tr,th,input,[data-tab]'); if(!t) return;
  if(t.dataset.learn){ state.learn.on = t.dataset.learn==='1'; state.learn.map = null; render(); return window.scrollTo(0,0); }
  if(t.dataset.lpath){ state.learn.path = t.dataset.lpath; return render(); }
  if(t.dataset.lmap){ state.learn.map = t.dataset.lmap; render(); return window.scrollTo(0,0); }
  if(t.dataset.copy){ copyText(t.dataset.copy).then(ok=>{ const o=t.textContent; t.textContent = ok?'Copiato!':'Non copiato: selezionalo a mano'; setTimeout(()=>{t.textContent=o},1600); }); return; }
  if(t.dataset.lback){ state.learn.map = null; render(); return window.scrollTo(0,0); }
  if(t.dataset.tab){ state.learn.on = false; return setTab(t.dataset.tab); }
  if(t.closest('#fSide')){ state.fSide = t.dataset.v; return render(); }
  if(t.closest('#fRes')){ state.fRes = t.dataset.v; return render(); }
  if(t.closest('#mode')){ state.mode = t.dataset.v; return render(); }
  if(t.id==='btnImp'||t.id==='btnImp2') return $('#imp').click();
  if(t.dataset.ecat!==undefined){ state.eCat = t.dataset.ecat; state.ePlace = null; state.eShown = 10; return render(); }
  if(t.dataset.eplace!==undefined){ state.ePlace = state.ePlace===t.dataset.eplace ? null : t.dataset.eplace; state.eShown = 10; return render(); }
  if(t.dataset.emore){ state.eShown += 10; return render(); }
  if(t.dataset.gomatch){ state.tab='partite'; state.sel = t.dataset.gomatch; state.selView='err'; state.focusDeath = t.dataset.gofocus||null; return render(); }
  if(t.dataset.trend){ state.trend = t.dataset.trend; return render(); }
  if(LITE && (t.dataset.gotoMap||t.dataset.match||t.id==='btnImp')) return;
  if(t.dataset.gotoMap){ state.mapSel = t.dataset.gotoMap; return setTab('mappe'); }
  if(t.dataset.map){ state.mapSel = t.dataset.map; return render(); }
  if(t.dataset.hedit){ state.hEdit = !state.hEdit; return render(); }
  if(t.dataset.hreset){ state.fKind='all'; state.fMap='all'; state.fRes='all'; state.hFrom=''; state.hTo=''; return render(); }
  if(t.dataset.hauto){ OV.order = []; OV.dates = {}; for(const m of state.matches) if(m.played0!==undefined){ m.played = m.played0; } ovSave(); state.matches.sort(cmpM); return render(); }
  if(t.dataset.mv){ const [d,id] = t.dataset.mv.split('|'), i = state.matches.findIndex(x=>x.id===id), j = i + (+d);
    if(i>=0 && j>=0 && j<state.matches.length){ const a = state.matches; [a[i],a[j]] = [a[j],a[i]]; OV.order = a.map(x=>x.id); ovSave(); } return render(); }
  if(t.dataset.sort){ const k = t.dataset.sort; if(state.sortKey===k) state.sortDir*=-1; else {state.sortKey=k; state.sortDir=(k==='map'||k==='idx')?1:-1;} return render(); }
  if(t.dataset.match){ state.sel = t.dataset.match; state.selView='analisi'; state.openRound=null; return render(); }
  if(t.dataset.back){ state.sel = null; return render(); }
  if(t.dataset.rclip!==undefined){ RP.clip = +t.dataset.rclip; RP.t = 0; RP.sel = -1; return render(); }
  if(t.closest('#mview')){ state.selView = t.dataset.v; return render(); }
  if(t.dataset.round){ const r=+t.dataset.round; state.openRound = state.openRound===r?null:r; return render(); }
  if(t.dataset.layer){ state.layers[t.dataset.layer] = t.checked; return render(); }
  if(t.dataset.kind){ state.uKinds[t.dataset.kind] = t.checked; return render(); }
  if(t.id==='uref'){ state.uRef = t.checked; return render(); }
});
document.addEventListener('change', e => {
  const id = e.target.id;
  if(id==='fMap' || id==='hMap'){ state.fMap = e.target.value; state.sel=null; render(); }
  if(id==='fKind' || id==='hKind'){ state.fKind = e.target.value; state.sel=null; render(); }
  if(id==='hRes'){ state.fRes = e.target.value; render(); }
  if(id==='hFrom'){ state.hFrom = e.target.value; render(); }
  if(id==='hTo'){ state.hTo = e.target.value; render(); }
  if(e.target.dataset.dateid){ const m = state.matches.find(x=>x.id===e.target.dataset.dateid), v = e.target.value;
    if(m){ m.played0 = m.played0 || m.played || ''; const t = (m.played||'').slice(10) || 'T12:00:00'; if(v){ m.played = v+t; OV.dates[m.id] = m.played; } else { m.played = m.played0; delete OV.dates[m.id]; }
      OV.order = []; state.matches.sort(cmpM); ovSave(); render(); } }
  if(e.target.id==='imp') importFile(e.target.files[0]);
});
function importFile(f){
  if(!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try{
      const j = JSON.parse(rd.result);
      if(!j.matches) throw new Error('File non valido.');
      if(!SID) SID = j.steamid;
      if(j.steamid !== SID) throw new Error('Il file non è un export valido per questo SteamID.');
      const ids = new Set(state.matches.flatMap(m=>[m.id,m.fp,m.valve_id].filter(Boolean))); let add = 0;
      for(const m of j.matches) if(!ids.has(m.id) && !(m.fp && ids.has(m.fp)) && !(m.valve_id && ids.has(m.valve_id))){ state.matches.push(m); add++; }
      state.matches.sort(cmpM);
      const lv = new Set(state.lite.map(l=>l.valve_id));
      for(const l of (j.lite||[])) if(!lv.has(l.valve_id)){ state.lite.push(l); add++; }
      const fv = new Set(state.matches.map(m=>m.valve_id).filter(Boolean));
      state.lite = state.lite.filter(l => !fv.has(l.valve_id)).sort((a,b)=>String(a.played).localeCompare(String(b.played)));
      render(); alert_(add ? `Aggiunte ${add} partite.` : 'Nessuna partita nuova nel file.');
    }catch(err){ alert_('Importazione non riuscita: ' + err.message); }
  };
  rd.readAsText(f);
}
function alert_(msg){
  const n = document.createElement('div'); n.className='note'; n.textContent = msg; n.setAttribute('role','status');
  $('#main').prepend(n); setTimeout(()=>n.remove(), 6000);
}

// "Cerca demo" button: only inside the desktop app (pywebview exposes the api); forces a scan for new demos now
(() => {
  const b = document.getElementById('scanBtn'); if(!b) return;
  const api = () => window.pywebview && window.pywebview.api && window.pywebview.api.refresh ? window.pywebview.api : null;
  const show = () => { if(api()) b.hidden = false; };
  window.addEventListener('pywebviewready', show); show(); setTimeout(show, 1500); setTimeout(show, 4000);
  b.addEventListener('click', async () => {
    const a = api(); if(!a || b.disabled) return;
    const label = '⟳ Cerca demo'; b.disabled = true; b.textContent = 'Cerco…';
    try{
      await a.refresh();
      for(let i = 0; i < 900; i++){
        await new Promise(r => setTimeout(r, 1000));
        const s = await a.status();
        if(!s.busy){ b.textContent = s.news ? 'Demo nuove trovate' : 'Nessuna demo nuova'; break; }
        b.textContent = String(s.text || 'Cerco…').slice(0, 30);
      }
    }catch(e){ b.textContent = 'Errore'; }
    setTimeout(() => { b.textContent = label; b.disabled = false; }, 3000);
  });
})();
