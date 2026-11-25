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
/* tables: header stays visible while scrolling, with a short explanation under each column name */
const TH_HINT = {'noi':'tipo di buy del tuo team (media soldi · tuoi)','loro':'tipo di buy degli avversari','cosa hai comprato':'armi, armatura e granate','tuoi $ a fine acquisti':'soldi che ti restano dopo gli acquisti','loss bonus':'bonus se perdi questo round','note':'segnali sulla spesa','esito':'round vinto o perso','dove':'zona della mappa in cui sei morto','cause':'perché sei morto (segnali dalla demo)','partita':'numero della partita','colpi':'proiettili sparati','a segno':'colpi che hanno preso un nemico','precisione':'a segno ÷ sparati','testa':'% dei colpi a segno alla testa','danno/colpo':'danno medio per colpo a segno','kill':'uccisioni','adr':'danno medio per round','kast':'% round con kill, assist, sopravvissuto o tradato','apertura':'% duelli d\'apertura vinti','v-p':'partite vinte – perse','rating':'stima del rating','round vinti ct':'% round vinti in difesa','round vinti t':'% round vinti in attacco','score':'punteggio finale','mvp':'volte miglior giocatore del round','hs%':'% kill con headshot','durata':'durata della partita','killer':'chi ti ha ucciso','arma · dist.':'arma e distanza in metri','tradata':'un compagno ti ha vendicato subito','segnali':'cosa non ha funzionato','tempo':'secondi dall\'inizio del round','punto':'nome della zona sulla mappa','morti':'volte che sei morto qui','tradate':'morti vendicate da un compagno / totale','nemici accecati':'avversari accecati almeno 1,1 s','compagni':'compagni accecati da te','tu':'secondi in cui ti sei accecato da solo','kill dopo la flash':'un accecato è stato ucciso subito dopo','giudizio':'valutazione della flash','tempo medio':'secondi medi dall\'inizio del round','dispersione':'quanto cambia il punto di lancio','k/a/d':'kill / assist / morti','danni':'danni inflitti','equip (noi / loro)':'valore equipaggiamento tuo team / avversari','stato':'esito dell\'analisi','lanci':'numero di lanci','zona':'zona della mappa','k/d':'kill ÷ morti','buy':'tipo di acquisto','tipo di buy (squadra)':'pistol, eco, force o full buy','a':'assist','k':'kill','d':'morti'};
function setThTop(){ const h = document.querySelector('header.top'), m = document.querySelector('.mstick'); document.documentElement.style.setProperty('--th', ((h ? h.offsetHeight : 57) + (m ? m.offsetHeight : 0)) + 'px'); }
window.addEventListener('resize', setThTop);
function initTables(){
  setThTop();
  document.querySelectorAll('#main th').forEach(th => {
    if(th.querySelector('.th-h')) return;
    const k = th.textContent.trim().toLowerCase(), h = TH_HINT[k];
    if(!h) return;
    th.title = th.textContent.trim() + ': ' + h;
    th.insertAdjacentHTML('beforeend', '<span class="th-h">' + h + '</span>');
  });
  document.querySelectorAll('#main .scroll').forEach(sc => { if(sc.scrollWidth > sc.clientWidth + 2) sc.classList.add('hs'); });
}
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
  initTables();
  navSync();
  const hh = document.querySelector('header.top'); if(hh) { document.documentElement.style.setProperty('--hh', hh.offsetHeight+'px'); const ms_ = document.querySelector('.mstick'); document.documentElement.style.setProperty('--sh', (hh.offsetHeight + (ms_ ? ms_.offsetHeight + 14 : 0) + 12)+'px'); }
  if(state.focusDeath){ const el = document.getElementById(state.focusDeath); state.focusDeath = null; if(el) el.scrollIntoView({block:'start'}); }
}
function setTab(t){ state.tab = t; state.sel = null; render(); window.scrollTo(0,0); }
