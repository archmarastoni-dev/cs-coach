/* map zoom, pan, click-to-highlight and full-screen view */
const ZS = {};
function tipOf(it){ const t = it.querySelector('[data-tip]'); return t ? t.dataset.tip : ''; }
function setupMap(svg, key, opts={}){
  const wrap = svg.parentNode;
  const v0 = svg.getAttribute('viewBox').trim().split(/\s+/).map(Number);
  const saved = ZS[key];
  let v = (saved && saved.o.join()===v0.join()) ? saved.v.slice() : v0.slice();
  const set = () => { svg.setAttribute('viewBox', v.map(n=>+n.toFixed(2)).join(' ')); ZS[key] = {o:v0, v:v.slice()}; };
  const clamp = () => { v[2] = v[3] = Math.min(1000, Math.max(40, v[2])); v[0] = Math.min(1000-v[2], Math.max(0, v[0])); v[1] = Math.min(1000-v[3], Math.max(0, v[1])); };
  const geo = () => { const r = svg.getBoundingClientRect(), s = Math.min(r.width/v[2], r.height/v[3]); return {r, s, ox:(r.width-v[2]*s)/2, oy:(r.height-v[3]*s)/2}; };
  const zoomAt = (f, cx, cy) => { const nw = Math.min(1000, Math.max(40, v[2]*f)), k = nw/v[2]; v[0] = cx-(cx-v[0])*k; v[1] = cy-(cy-v[1])*k; v[2] = v[3] = nw; clamp(); set(); };
  const centre = () => [v[0]+v[2]/2, v[1]+v[3]/2];
  const reset = () => { v = v0.slice(); set(); };
  svg.addEventListener('wheel', ev => {
    ev.preventDefault();
    const g = geo(), cx = v[0]+(ev.clientX-g.r.left-g.ox)/g.s, cy = v[1]+(ev.clientY-g.r.top-g.oy)/g.s;
    zoomAt(ev.deltaY<0 ? 0.8 : 1.25, cx, cy);
  }, {passive:false});
  let drag = null, moved = false;
  svg.addEventListener('pointerdown', ev => { if(ev.button!==0) return; moved = false; drag = {x:ev.clientX, y:ev.clientY, v:v.slice(), on:false, id:ev.pointerId}; });
  svg.addEventListener('pointermove', ev => {
    if(!drag) return;
    const dx = ev.clientX-drag.x, dy = ev.clientY-drag.y;
    if(!drag.on){ if(Math.hypot(dx,dy)<4) return; drag.on = true; svg.classList.add('grab'); try{ svg.setPointerCapture(drag.id); }catch(e){} tip.style.display='none'; }
    const s = geo().s; v[0] = drag.v[0]-dx/s; v[1] = drag.v[1]-dy/s; clamp(); set();
  });
  const end = () => { moved = !!(drag && drag.on); drag = null; svg.classList.remove('grab'); };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  svg.addEventListener('dblclick', reset);

  // click an element to highlight it, click another one (or the empty map) to change or clear the selection
  const info = document.createElement('div'); info.className = 'zsel'; wrap.appendChild(info);
  const select = it => {
    svg.querySelectorAll('.it.is-sel').forEach(e => e.classList.remove('is-sel'));
    svg.classList.toggle('has-sel', !!it);
    if(it){ it.classList.add('is-sel'); it.parentNode.appendChild(it); }   // bring it in front
    info.textContent = it ? tipOf(it) : ''; info.style.display = it && info.textContent ? 'block' : 'none';
  };
  svg.addEventListener('click', ev => {
    if(moved){ moved = false; return; }
    select(ev.target.closest ? ev.target.closest('.it') : null);
  });
  const pre = svg.querySelector('.it.is-sel'); if(pre) select(pre); else info.style.display = 'none';

  const ctl = document.createElement('div'); ctl.className = 'zctl';
  ctl.innerHTML = '<button type="button" aria-label="Ingrandisci" title="Ingrandisci">+</button><button type="button" aria-label="Riduci" title="Riduci">−</button><button type="button" aria-label="Ripristina vista" title="Ripristina vista">⟲</button>' + (opts.fs ? '' : '<button type="button" aria-label="Schermo intero" title="Schermo intero">⛶</button>');
  const [bi, bo, br, bf] = ctl.children;
  bi.onclick = () => { const c = centre(); zoomAt(0.7, c[0], c[1]); };
  bo.onclick = () => { const c = centre(); zoomAt(1.43, c[0], c[1]); };
  br.onclick = reset;
  if(bf) bf.onclick = () => openFullscreen(svg, v);
  wrap.appendChild(ctl);
  const h = document.createElement('div'); h.className = 'zhint'; h.textContent = 'Rotellina: zoom · trascina: sposta · clic su un elemento: evidenzia · doppio clic: reset'; wrap.appendChild(h);
  set();
}
function fsCaption(svg, card){
  const head = card && card.querySelector('.dhead,.dv-t'), fig = svg.closest('figure'), lvc = svg.closest('.lvcol'), flr = lvc && lvc.querySelector('.lvt') ? ' · ' + lvc.querySelector('.lvt').textContent : '';
  const what = fig ? (fig.querySelector('figcaption') ? 'Fotogramma: ' + fig.querySelector('figcaption').textContent.trim() : 'Fotogramma') : (card && card.querySelector('.dcard') || card && card.querySelector('.dv-main') ? 'Posizioni al momento della morte' : '');
  const inDeath = card && (card.querySelector('.dcard') || card.querySelector('.dv-main'));
  return '<b>' + (head ? esc(head.innerText.split('\n')[0]) : '') + '</b>' + (what ? ' · ' + esc(what) : '') + esc(flr) +
    (inDeath ? '<br><span>Pallino = giocatore vivo · ✕ = morto · giallo = tu, blu = compagni, rosso = avversari · bordo bianco = chi ti ha ucciso · coni = dove guardavano · cerchi = smoke/flash/HE/molotov</span>' : '');
}
function openFullscreen(src, view){
  closeFullscreen();
  const card = src.closest('.dv-box, .card');
  const grp = card && (card.querySelector('.dcard') || card.querySelector('.dv-main')) ? [...card.querySelectorAll('svg.radar')].filter(x=>!x.classList.contains('rp-radar')) : [src];
  const items = grp.map(x => ({svg:x, view: x===src ? view : x.getAttribute('viewBox').trim().split(/\s+/).map(Number), cap: fsCaption(x, card)}));
  let i = Math.max(0, grp.indexOf(src));
  const el = document.createElement('div'); el.id = 'fsmap';
  const box = document.createElement('div'); box.className = 'fs-box zwrap';
  const cap = document.createElement('div'); cap.className = 'fs-cap';
  el.appendChild(box); el.appendChild(cap);
  const x = document.createElement('button'); x.className = 'fs-x'; x.type = 'button'; x.setAttribute('aria-label','Chiudi'); x.textContent = '✕'; x.onclick = closeFullscreen; el.appendChild(x);
  const show = () => {
    const it = items[i]; box.innerHTML = '';
    const svg = it.svg.cloneNode(true);
    svg.setAttribute('viewBox', it.view.map(n=>+n.toFixed(2)).join(' '));
    svg.querySelectorAll('.zctl,.zhint,.zsel').forEach(e => e.remove());
    box.appendChild(svg); delete ZS['fs']; setupMap(svg, 'fs', {fs:true});
    cap.innerHTML = it.cap + (items.length>1 ? `<div class="fs-n">${i+1} di ${items.length} · frecce ← → per scorrere</div>` : '');
  };
  if(items.length > 1){
    for(const [d, t] of [[-1,'‹'],[1,'›']]){
      const b = document.createElement('button'); b.type='button'; b.className = 'fs-nav ' + (d<0?'fs-prev':'fs-next'); b.textContent = t; b.setAttribute('aria-label', d<0?'Precedente':'Successiva');
      b.onclick = ev => { ev.stopPropagation(); i = (i + d + items.length) % items.length; show(); }; el.appendChild(b);
    }
    el.fsGo = d => { i = (i + d + items.length) % items.length; show(); };
  }
  el.addEventListener('click', e => { if(e.target === el) closeFullscreen(); });
  document.body.appendChild(el); show();
}
function closeFullscreen(){ const e = document.getElementById('fsmap'); if(e) e.remove(); }
document.addEventListener('keydown', e => { const f = document.getElementById('fsmap'); if(!f) return; if(e.key==='Escape') closeFullscreen(); else if(f.fsGo && e.key==='ArrowRight'){ e.stopPropagation(); f.fsGo(1); } else if(f.fsGo && e.key==='ArrowLeft'){ e.stopPropagation(); f.fsGo(-1); } }, true);
function initZoom(){
  document.querySelectorAll('svg.radar').forEach((svg, idx) => {
    if(svg.parentNode.classList.contains('zwrap') || svg.classList.contains('rp-radar')) return;
    const wrap = document.createElement('div'); wrap.className = 'zwrap';
    svg.parentNode.insertBefore(wrap, svg); wrap.appendChild(svg);
    if(svg.closest('.frames')){
      // small snapshot maps: only the full-screen button
      const ctl = document.createElement('div'); ctl.className = 'zctl';
      ctl.innerHTML = '<button type="button" aria-label="Schermo intero" title="Schermo intero">⛶</button>';
      ctl.firstChild.onclick = () => openFullscreen(svg, svg.getAttribute('viewBox').trim().split(/\s+/).map(Number));
      wrap.appendChild(ctl);
      return;
    }
    setupMap(svg, state.tab+':'+idx);
  });
}
/* tooltip */
const tip = $('#tip');
function zcShow(tr, on){ const card = tr.closest('.card'); if(!card) return; card.querySelectorAll('rect.zc').forEach(r=>{ const hit = r.dataset.zr===tr.dataset.zc; r.setAttribute('fill-opacity', on&&hit?'.28':'0'); r.setAttribute('stroke-opacity', on&&hit?'1':'0'); }); }
document.addEventListener('mouseover', e => { const z = e.target.closest('tr[data-zc]'); if(z) zcShow(z,true); });
document.addEventListener('mouseout', e => { const z = e.target.closest('tr[data-zc]'); if(z && !z.contains(e.relatedTarget)) zcShow(z,false); });
document.addEventListener('mouseover', e => { const t = e.target.closest('[data-tip]'); if(t){ tip.textContent = t.dataset.tip; tip.style.display='block'; } else tip.style.display='none'; });
document.addEventListener('mousemove', e => { if(tip.style.display==='block'){ tip.style.left = Math.min(e.clientX+14, innerWidth-300)+'px'; tip.style.top = (e.clientY+14)+'px'; } });

const h0 = location.hash.slice(1); if(TABS.some(t=>t[0]===h0)) state.tab = h0;
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if(TABS.some(t=>t[0]===h) && h!==state.tab){ state.tab=h; state.sel=null; render(); } });
render();
