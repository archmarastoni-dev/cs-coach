/* Utilities: global state, formatting helpers, DOM shortcuts */
let SID = DATA.steamid || null;
const LITE = !!DATA.lite_view, PROFILE = DATA.profile || null;
/* manual corrections (date and order of the matches), kept in this browser only */
const OV = (() => { let o = {}; try{ o = JSON.parse(localStorage.getItem('csc_ov')||'{}') || {}; }catch(e){} o.dates = o.dates || {}; o.order = o.order || []; return o; })();
const ovSave = () => { try{ localStorage.setItem('csc_ov', JSON.stringify(OV)); }catch(e){} };
for(const m of DATA.matches) if(OV.dates[m.id]){ m.played0 = m.played0 || m.played || ''; m.played = OV.dates[m.id]; }
const cmpAuto = (a,b) => (a.played && b.played) ? a.played.localeCompare(b.played) : (a.patch-b.patch) || String(a.added||'').localeCompare(String(b.added||''));
const cmpM = (a,b) => { const ia = OV.order.indexOf(a.id), ib = OV.order.indexOf(b.id);
  if(ia>=0 && ib>=0) return ia-ib; if(ia>=0) return -1; if(ib>=0) return 1; return cmpAuto(a,b); };
const kindOf = m => m.kind || (/faceit/i.test(m.server||'') ? 'FACEIT' : /esea/i.test(m.server||'') ? 'ESEA' : /^valve/i.test(m.server||'') ? 'Valve' : 'Altro');
const dShort = s => s ? s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(2,4) : '';
const $ = (s, r=document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const f1 = (v,d=1) => (isFinite(v) ? v.toFixed(d) : '–');
const pc = v => isFinite(v) ? Math.round(v*100)+'%' : '–';
const MAPN = {de_dust2:'Dust II',de_mirage:'Mirage',de_inferno:'Inferno',de_nuke:'Nuke',de_overpass:'Overpass',de_ancient:'Ancient',de_anubis:'Anubis',de_vertigo:'Vertigo',de_train:'Train',de_cache:'Cache'};
const mapName = m => MAPN[m] || m;
const WN = {ak47:'AK-47',m4a1:'M4A1-S / M4A4',awp:'AWP',hkp2000:'USP-S / P2000',glock:'Glock-18',deagle:'Desert Eagle',galilar:'Galil AR',famas:'FAMAS',mac10:'MAC-10',mp9:'MP9',mp7:'MP7',p250:'P250',fiveseven:'Five-SeveN',tec9:'Tec-9',ssg08:'SSG 08',aug:'AUG',sg556:'SG 553',nova:'Nova',xm1014:'XM1014',ump45:'UMP-45',bizon:'PP-Bizon',p90:'P90',cz75a:'CZ75-Auto',elite:'Dual Berettas',revolver:'R8',knife:'Coltello',hegrenade:'Granata HE',inferno:'Molotov/Incendiaria',molotov:'Molotov/Incendiaria'};
const wname = w => WN[w] || w;
const sum = (a,f=x=>x) => a.reduce((s,x)=>s+f(x),0);
const KIND = {smoke:'Smoke',flash:'Flash',he:'HE',molotov:'Molotov'};
const KCOL = {smoke:'#9aa7b8',flash:'#e8c53a',he:'#f08a3c',molotov:'#e5484d'};

const state = {
  matches: DATA.matches.slice().sort(cmpM), lite: (DATA.lite||[]).slice(),
  tab: 'panoramica', mode: 'base',
  fMap: 'all', fSide: 'all', fRes: 'all', fKind: 'all', hFrom: '', hTo: '', hEdit: false,
  sel: null, selView: 'analisi', openRound: null,
  trend: 'rating', sortKey: 'idx', sortDir: -1,
  eCat: 'all', ePlace: null, eShown: 10,
  mapSel: null, layers: {kills:true, deaths:true, heat:false},
  uKinds: {smoke:true, flash:false, he:false, molotov:false}, uRef: false,
  learn: {on:false, path:'team', map:null}
};
const me = m => m.players.find(p => p.sid === SID);
const idxOf = m => state.matches.indexOf(m) + 1;

function filtered(){
  return state.matches.filter(m =>
    (state.fMap==='all' || m.map===state.fMap) &&
    (state.fKind==='all' || kindOf(m)===state.fKind) &&
    (state.fRes==='all' || m.result===state.fRes));
}
const sideOk = (side, row) => side==='all' || row.side===side;

