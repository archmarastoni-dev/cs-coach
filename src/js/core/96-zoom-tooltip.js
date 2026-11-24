/* map zoom and pan */
const ZS = {};
function initZoom(){
  document.querySelectorAll('svg.radar').forEach((svg, idx) => {
    if(svg.parentNode.classList.contains('zwrap') || svg.closest('.frames')) return;
    const wrap = document.createElement('div'); wrap.className = 'zwrap';
    svg.parentNode.insertBefore(wrap, svg); wrap.appendChild(svg);
    const v0 = svg.getAttribute('viewBox').trim().split(/\s+/).map(Number);
    const key = state.tab+':'+idx, saved = ZS[key];
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
    let drag = null;
    svg.addEventListener('pointerdown', ev => { if(ev.button!==0) return; drag = {x:ev.clientX, y:ev.clientY, v:v.slice(), on:false, id:ev.pointerId}; });
    svg.addEventListener('pointermove', ev => {
      if(!drag) return;
      const dx = ev.clientX-drag.x, dy = ev.clientY-drag.y;
      if(!drag.on){ if(Math.hypot(dx,dy)<4) return; drag.on = true; svg.classList.add('grab'); try{ svg.setPointerCapture(drag.id); }catch(e){} tip.style.display='none'; }
      const s = geo().s; v[0] = drag.v[0]-dx/s; v[1] = drag.v[1]-dy/s; clamp(); set();
    });
    const end = () => { drag = null; svg.classList.remove('grab'); };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
    svg.addEventListener('dblclick', reset);
    const ctl = document.createElement('div'); ctl.className = 'zctl';
    ctl.innerHTML = '<button type="button" aria-label="Ingrandisci" title="Ingrandisci">+</button><button type="button" aria-label="Riduci" title="Riduci">−</button><button type="button" aria-label="Ripristina vista" title="Ripristina vista">⟲</button>';
    const [bi, bo, br] = ctl.children;
    bi.onclick = () => { const c = centre(); zoomAt(0.7, c[0], c[1]); };
    bo.onclick = () => { const c = centre(); zoomAt(1.43, c[0], c[1]); };
    br.onclick = reset;
    wrap.appendChild(ctl);
    const h = document.createElement('div'); h.className = 'zhint'; h.textContent = 'Rotellina: zoom · trascina: sposta · doppio clic: reset'; wrap.appendChild(h);
    set();
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
