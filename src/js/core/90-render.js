/* Render: welcome screen, main render() and tab switching */
function welcome(){
  return `<div class="card"><h2>Benvenuto in CS Coach</h2><div class="sub">Analizza le tue partite di CS2 (Premier, FACEIT, Competitivo) a partire dalle demo. Tutto resta sul tuo computer: la pagina non carica nulla online.</div>
  <ol style="padding-left:20px;margin:0">
    <li>Installa <b>Python 3</b> e le librerie: <code>pip install demoparser2 pandas</code></li>
    <li>Scarica <code>cs_coach.py</code> e <code>cs_parser.py</code> (te li dà chi ti ha passato questa pagina) in una cartella.</li>
    <li>Metti le demo <code>.dem</code> in una cartella e lancia:</li></ol>
  <pre>python cs_coach.py --steamid IL_TUO_STEAMID64 --folder "C:\\percorso\\demo"</pre>
  <p class="sub">Il tuo SteamID64 è il numero lungo di 17 cifre (lo trovi su steamid.io). Lo script crea <code>cs_data.json</code>.</p>
  <ol start="4" style="padding-left:20px;margin:0"><li>Qui sopra premi <b>Importa dati</b> e scegli <code>cs_data.json</code>.</li></ol>
  <p style="margin-top:14px"><button class="btn" id="btnImp2">Importa dati</button></p></div>`;
}
/* Navigation history: every change of view (tab, match, match section, learn page) is a history entry,
   so the mouse "back" button / Alt+Left returns to the previous view, and the scroll position is restored. */
const NAV = {key:'', init:false, restoring:false, leaveY:0, depth:0, max:0, lastGo:0};
const APP_MODE = /[?&]app=1/.test(location.search);
function navSnap(){ return {tab:state.tab, sel:state.sel, selView:state.selView, mapSel:state.mapSel, learn:{on:state.learn.on, path:state.learn.path, map:state.learn.map}}; }
function navSync(){
  if(NAV.restoring) return;
  const snap = navSnap(), key = JSON.stringify(snap);
  if(key === NAV.key) return;
  try{
    if(NAV.key) history.replaceState(Object.assign({}, history.state, {y: NAV.leaveY}), '');   // remember where we were scrolled
    const url = '#'+state.tab;
    if(NAV.init){ NAV.depth++; NAV.max = NAV.depth; history.pushState(Object.assign({y:0, i:NAV.depth}, snap), '', url); }
    else {
      NAV.init = true;
      if(APP_MODE){ history.replaceState({sentinel:true}, ''); history.pushState(Object.assign({y:0, i:0}, snap), '', url); }   // sentinel: the start-up splash can not be reached
      else history.replaceState(Object.assign({y:0, i:0}, snap), '', url);
    }
  }catch(e){}
  NAV.key = key;
  navButtons();
}
function navButtons(){
  const b = document.getElementById('navBack'), f = document.getElementById('navFwd');
  if(b) b.disabled = NAV.depth <= 0; if(f) f.disabled = NAV.depth >= NAV.max;
}
function navGo(d){      // one step back (-1) or forward (+1); ignores a second call within 300 ms (the browser may also handle the mouse button)
  const t = Date.now(); if(t - NAV.lastGo < 300) return; NAV.lastGo = t;
  if(d < 0 ? NAV.depth > 0 : NAV.depth < NAV.max) history.go(d);
}
document.addEventListener('click', e => { if(e.target.closest('#navBack')) navGo(-1); else if(e.target.closest('#navFwd')) navGo(1); });
function mouseNav(e){ if(e.button === 3){ e.preventDefault(); navGo(-1); } else if(e.button === 4){ e.preventDefault(); navGo(1); } }
document.addEventListener('mouseup', mouseNav); document.addEventListener('auxclick', mouseNav);
document.addEventListener('keydown', e => { if(e.altKey && e.key === 'ArrowLeft'){ e.preventDefault(); navGo(-1); } else if(e.altKey && e.key === 'ArrowRight'){ e.preventDefault(); navGo(1); } });
window.addEventListener('popstate', e => {
  const s = e.state;
  if(!s) return;
  if(s.sentinel){ history.go(1); return; }
  NAV.restoring = true;
  state.tab = s.tab; state.sel = s.sel; state.selView = s.selView; state.mapSel = s.mapSel;
  Object.assign(state.learn, s.learn);
  NAV.depth = s.i || 0;
  render();
  NAV.key = JSON.stringify(navSnap());
  NAV.restoring = false;
  navButtons();
  window.scrollTo(0, s.y || 0);
});
/* remembers the scroll position of each view, so going back from a map or from E-learning returns to the same spot */
const SCROLL_MEM = {};
function keepScroll(change){ SCROLL_MEM[JSON.stringify(navSnap())] = window.scrollY; change(); render(); window.scrollTo(0, SCROLL_MEM[JSON.stringify(navSnap())] || 0); }
function render(){
  NAV.leaveY = window.scrollY;
  renderChrome();
  const ms = filtered();
  let html = '';
  if(state.learn.on && !LITE) html = viewLearn();
  else if(!state.matches.length) html = welcome();
  else if(state.tab==='panoramica') html = ms.length ? viewPanoramica(ms) : '<div class="empty">Nessuna partita con questi filtri.</div>';
  else if(state.tab==='partite') html = viewPartite(ms);
  else if(state.tab==='mappe') html = viewMappe(ms);
  else if(state.tab==='utility') html = viewUtility(ms);
  else if(state.tab==='errori') html = viewErrori(ms);
  else if(state.tab==='armi') html = ms.length ? viewArmi(ms) : '<div class="empty">Nessuna partita con questi filtri.</div>';
  else html = ms.length ? viewCoach(ms) : '<div class="empty">Nessuna partita con questi filtri.</div>';
  $('#main').innerHTML = html;
  initZoom();
  initReplay();
  navSync();
  const hh = document.querySelector('header.top'); if(hh) { document.documentElement.style.setProperty('--hh', hh.offsetHeight+'px'); const ms_ = document.querySelector('.mstick'); document.documentElement.style.setProperty('--sh', (hh.offsetHeight + (ms_ ? ms_.offsetHeight + 14 : 0) + 12)+'px'); }
  if(state.focusDeath){ const el = document.getElementById(state.focusDeath); state.focusDeath = null; if(el) el.scrollIntoView({block:'start'}); }
}
function setTab(t){ state.tab = t; state.sel = null; render(); window.scrollTo(0,0); }
