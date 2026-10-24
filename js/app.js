/* ============ App bootstrap ============ */
function boot(){
  Store.load();
  if(!Store.state.lang) Store.state.lang='en';
  // seed timelines for existing requests so history looks complete
  Store.state.requests.forEach(r=>{
    r.timeline = r.timeline || [];
    if(!r.timeline.length){
      const push=(ts,text,kind)=>r.timeline.push({ts,text,kind:kind||'done',by:S.user(r.createdBy)?S.user(r.createdBy).name:'System'});
      push(r.created, T('reqCreated')+' '+r.id, 'info');
      if(r.status!=='draft'){ push(r.submittedAt||r.created, T('submitted'), 'info'); }
      if(['pending_admin'].includes(r.status)) push(r.created, T('routeAdmin'), 'info');
      if(['pending_client'].includes(r.status)) push(r.created, T('routeClient'), 'info');
      if(['approved_admin','pending_stock','ready_issue','partial_issued','issued','delivered'].includes(r.status)&&r.authority==='admin_delegated')
        push(r.created, `${T('approveUnder')} · ${inr(r.estCost)}`, 'done');
      if(['approved_client','pending_stock','ready_issue','partial_issued','issued','delivered'].includes(r.status)&&r.authority==='client')
        push(r.created, `${T('approvedBy')} Anita Sharma`, 'done');
      if(r.status==='rejected') push(r.created, `${T('rejected')} — ${r.rejectReason}`, 'bad');
      if(r.status==='cancelled') push(r.created, T('cancelReq'), 'bad');
      if(['ready_issue','partial_issued','issued','delivered'].includes(r.status)) push(r.created, T('reservedOk'), 'done');
      if(r.issuedQty>0) push(r.created, `${T('issuedOk')} ${qtyFmt(r.issuedQty)} ${S.material(r.materialId).unit} · ${inr(r.issuedQty*r.unitPrice)}`, 'done');
      if(r.status==='delivered') push(r.created, T('deliveryDone'), 'done');
      if(r.status==='pending_purchase') push(r.created, T('insufficient')+' → '+T('status.pending_purchase'), 'bad');
    }
  });
  Store.persist();
  render();
}
// Android back button handling (Capacitor) + browser back
window.addEventListener('popstate',()=>{ if(sheetOpen){closeSheet();} else {back();} });
document.addEventListener('backbutton', ()=>{ if(sheetOpen) closeSheet(); else back(); }, false); // Capacitor event
/* notification permission requested from Profile screen only */
boot();
