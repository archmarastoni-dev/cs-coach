/* Indicative reference values used to colour stats (rough public benchmarks, not official data) */
const REF = {rating:1.0, kd:1.0, adr:75, kastP:.70, hsP:.45, okP:.50, trP:.25, rwP:.50};
function cmpClass(v, ref, inv=false){
  if(!isFinite(v)) return '';
  const r = v/ref; const good = inv ? r<=0.92 : r>=1.08; const bad = inv ? r>=1.08 : r<=0.92;
  return good ? 'up' : bad ? 'down' : 'mid';
}

