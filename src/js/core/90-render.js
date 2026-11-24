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
function render(){
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
  if(state.focusDeath){ const el = document.getElementById(state.focusDeath); state.focusDeath = null; if(el) el.scrollIntoView({block:'start'}); }
}
function setTab(t){ state.tab = t; state.sel = null; try{ history.replaceState(null,'','#'+t); }catch(e){} render(); window.scrollTo(0,0); }
