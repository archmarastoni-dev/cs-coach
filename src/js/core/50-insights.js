/* Coach insights: rule-based strengths / weaknesses computed from the aggregates */
function insights(ms, side){
  const out = [];
  const A = agg(ms, side), U = utilAgg(ms, side);
  const add = (sev, title, ev, tip) => out.push({sev, title, ev, tip});
  if(A.R < 15) return [{sev:'info', title:'Servono più round', ev:`Con ${A.R} round i numeri sono troppo ballerini.`, tip:'Aggiungi altre demo.'}];
  if(A.ok + A.od >= 4){
    if(A.okP < .42) add('alta', 'Perdi troppi duelli d\'apertura', `Vinci ${A.ok} su ${A.ok+A.od} primi scontri (${pc(A.okP)}).`, 'Non fare il primo peek da solo: usa una flash o un compagno vicino, oppure cambia angolo dopo il primo contatto. In soloq, prendi info (suoni, utility) prima di dare il peek.');
    else if(A.okP > .55) add('ok', 'Buoni duelli d\'apertura', `Vinci ${A.ok} su ${A.ok+A.od} primi scontri (${pc(A.okP)}).`, 'Continua a prenderti il primo contatto quando hai supporto.');
  }
  if(A.d >= 8){
    if(A.trP < .22) add('alta', 'Muori spesso senza trade', `Solo ${pc(A.trP)} delle tue morti viene vendicata entro 5 secondi.`, 'Gioca più vicino a un compagno (ma non nello stesso spot) e non morire in posizioni isolate. In soloq comunica dove vai o segui chi fa il push.');
    else if(A.trP > .4) add('ok', 'Ottime trade sulle tue morti', `${pc(A.trP)} delle tue morti viene vendicata.`, 'Stai giocando vicino ai compagni.');
  }
  let early = 0, deathsN = 0;
  for(const m of ms) for(const e of m.me.deaths) if(sideOk(side,e) && !e.teamkill){ deathsN++; if(e.t < 20) early++; }
  if(deathsN >= 8 && early/deathsN > .4) add('media', 'Muori troppo presto nel round', `${pc(early/deathsN)} delle morti avviene nei primi 20 secondi.`, 'Rallenta l\'apertura: aspetta le smoke/flash della squadra prima di impegnare un duello, o usa più tempo per raccogliere info.');
  if(A.pas >= 3) add('media', 'Round passivi', `${A.pas} round in cui sei vivo a fine round con 0 kill e meno di 25 danni, e la squadra perde.`, 'Quando resti vivo a fine round sei stato troppo lontano dall\'azione: partecipa al fight o lancia utility per aiutare.');
  const fl = U.flashAll || 0;
  if(fl >= 6){
    const per = U.ef / fl;
    if(per < .6) add('media', 'Flash poco efficaci', `${U.ef} nemici accecati con ${fl} flash (${f1(per,2)} a flash).`, 'Impara 2-3 popflash per mappa e coordina il peek: la flash deve esplodere prima che esci.');
    if(U.tf >= 4) add('media', 'Accechi i compagni', `${U.tf} compagni accecati (${f1(U.tft,1)} secondi totali).`, 'Controlla la direzione di lancio e avvisa quando lanci.');
  }
  if(U.tDmg >= 40) add('media', 'Danni ai compagni', `${f1(U.tDmg,0)} danni inflitti ai compagni.`, 'Attenzione a HE/molotov vicino ai compagni e agli spray con i compagni in linea.');
  const perRound = (U.thrown.smoke + U.thrown.flash + U.thrown.he + U.thrown.molotov) / Math.max(1,U.R);
  if(perRound < .9) add('media', 'Poca utility per round', `${f1(perRound,2)} granate a round (riferimento: almeno ~1).`, 'Compra e usa le granate ogni round: una smoke o una flash in più cambia più round di un fucile migliore.');
  let shots=0,hits=0,hsHits=0;
  for(const m of ms) for(const w of m.me.weapons) if(['ak47','m4a1','galilar','famas','aug','sg556'].includes(w.w)){ shots+=w.shots; hits+=w.hits; hsHits+=w.hs_hits; }
  if(shots >= 150){
    const acc = hits/shots;
    if(acc < .15) add('media', 'Precisione bassa con i fucili', `${pc(acc)} dei colpi va a segno (${hits} su ${shots}).`, 'Spara a raffiche corte, fermati prima di sparare e non spruzzare a lunga distanza.');
    if(hits >= 25 && hsHits/hits < .22) add('media', 'Posizione del mirino troppo bassa', `Solo ${pc(hsHits/hits)} dei colpi a segno va alla testa.`, 'Tieni il mirino all\'altezza della testa mentre ti muovi e precontrolla gli angoli (crosshair placement).');
    else if(hits >= 25 && hsHits/hits > .38) add('ok', 'Buon controllo della testa', `${pc(hsHits/hits)} dei colpi a segno va alla testa.`, 'Tieni questo livello.');
  }
  if(A.clA >= 3 && A.clW === 0) add('media', 'Clutch tutti persi', `0 clutch vinti su ${A.clA}.`, 'Nei 1vX evita di cercare subito il fight: usa il tempo, fai rumore in un posto e attacca da un altro angolo.');
  const ct = agg(ms,'CT'), tt = agg(ms,'T');
  if(side==='all' && ct.R >= 20 && tt.R >= 20 && Math.abs(ct.kd - tt.kd) > .35)
    add('info', ct.kd > tt.kd ? 'Più forte in difesa (CT)' : 'Più forte in attacco (T)', `K/D ${f1(ct.kd,2)} in CT contro ${f1(tt.kd,2)} in T.`, `Dedica più pratica al lato ${ct.kd > tt.kd ? 'T' : 'CT'}.`);
  // recurring death zones
  const byMap = {};
  for(const m of ms) (byMap[m.map] = byMap[m.map] || []).push(m);
  for(const [map, mm] of Object.entries(byMap)){
    const sc = mapScene(map, mm, side, {kills:false,deaths:false,heat:false});
    const cells = zoneCells(sc.pts).filter(c => c.d >= 3 && c.d > c.k * 1.5);
    for(const c of cells.slice(0,2))
      add('media', `Zona pericolosa su ${mapName(map)}`, `${c.d} morti e ${c.k} kill nella stessa area (riquadro ${c.cx+1}-${c.cy+1} della mappa${c.l>=0&&LEVELS[map]?', '+LEVELS[map].names[c.l].toLowerCase():''}).`, 'Cambia posizione o tempi quando passi di qui: guarda la tab Mappe per capire da dove ti uccidono.');
  }
  if(A.adr >= REF.adr*1.08) add('ok', 'Danni a round sopra la media', `${f1(A.adr)} ADR (riferimento ${REF.adr}).`, 'Ottimo impatto: concentrati su sopravvivenza e trade per convertirlo in vittorie.');
  if(A.kastP < .6) add('alta', 'Poca costanza (KAST basso)', `Contribuisci o sopravvivi solo nel ${pc(A.kastP)} dei round (riferimento ${pc(REF.kastP)}).`, 'Punta a ottenere almeno un kill, un assist, la sopravvivenza o una trade in più round: gioca meno rischioso nei round già decisi.');
  const order = {alta:0, media:1, info:2, ok:3};
  return out.sort((a,b) => order[a.sev]-order[b.sev]);
}

