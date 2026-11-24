/* ===== In-app viewer: images open inside the app (still loaded from the source site) ===== */
const LB = {list:[], i:0};
function lbShow(){
  let el = document.getElementById('lb');
  if(!el){ el = document.createElement('div'); el.id='lb'; document.body.appendChild(el); }
  const n = LB.list.length, u = LB.list[LB.i];
  el.innerHTML = `<div class="lb-bg" data-lbclose="1"></div><figure class="lb-fig"><img src="${u}" referrerpolicy="no-referrer" alt="" onerror="this.outerHTML='<div class=&quot;lrn-broken&quot;>Immagine non disponibile (servono internet e che la fonte la tenga online).</div>'"><figcaption>${esc(LB.name)}${n>1?' · '+(LB.i+1)+' di '+n:''}</figcaption></figure>
    <button class="lb-x" data-lbclose="1" aria-label="Chiudi">✕</button>${n>1?'<button class="lb-n lb-prev" data-lbgo="-1" aria-label="Precedente">‹</button><button class="lb-n lb-next" data-lbgo="1" aria-label="Successiva">›</button>':''}`;
  el.style.display='flex';
}
function lbOpen(a){
  const group = a.closest('.lrn-imgs');
  LB.list = group ? [...group.querySelectorAll('a[data-lb]')].map(x=>x.getAttribute('href')) : [a.getAttribute('href')];
  LB.i = Math.max(0, LB.list.indexOf(a.getAttribute('href'))); LB.name = a.dataset.lb || '';
  lbShow();
}
function lbClose(){ const el=document.getElementById('lb'); if(el) el.style.display='none'; }
function lbGo(d){ LB.i = (LB.i + d + LB.list.length) % LB.list.length; lbShow(); }
document.addEventListener('keydown', e => {
  const el=document.getElementById('lb'); if(!el || el.style.display==='none') return;
  if(e.key==='Escape') lbClose(); else if(e.key==='ArrowRight' && LB.list.length>1) lbGo(1); else if(e.key==='ArrowLeft' && LB.list.length>1) lbGo(-1);
});

