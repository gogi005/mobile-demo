/* ============ Actions: routing, approvals, inventory ops, notifications ============ */

/* --- notification engine: role-scoped store + in-app toast + optional native API --- */
function notify(role, type, title, body, link){
  Store.state.notifications.push({id:'N'+Date.now()+Math.random().toString(36).slice(2,5), role, type, title, body, link:link||null, ts:new Date().toISOString(), read:false});
  Store.persist();
  if(Store.state.session && S.me() && S.me().role===role) toast(type,title,body); // live toast for current role
}
const TYPE_ICON={action:'🔔',info:'ℹ️',alert:'⚠️',success:'✅',warning:'🟠'};
function toast(type,title,body){
  const box=document.getElementById('toasts'); if(!box) return;
  const cls={action:'action',info:'',alert:'danger',success:'success',warning:'warn'}[type]||'';
  const el=document.createElement('div'); el.className='toast '+cls;
  el.innerHTML=`<div class="ti">${TYPE_ICON[type]||'🔔'}</div><div><b>${esc(title)}</b><span>${esc(body)}</span></div>`;
  box.appendChild(el);
  setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),350)},4200);
  // Try native Notification API (Android Chrome / Capacitor WebView may allow)
  try{
    if('Notification' in window && Notification.permission==='granted'){
      new Notification(title,{body, icon:'icons/icon.png', tag:'buildmate'});
    }
  }catch(e){/* simulated only */}
}
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function addTimeline(r, textKey, opts){
  const o = opts||{};
  r.timeline = r.timeline || [];
  r.timeline.push({ts:new Date().toISOString(), text:textKey, kind:o.kind||'done', by:o.by||(S.me()?S.me().name:'System')});
}

/* --- SMART APPROVAL ROUTING ---
   Rules (per project ApprovalRule config):
   1. Within admin remaining delegated authority -> Pending Admin Authority Approval
      (client gets information-only notification).
   2. Exceeds remaining authority -> Pending Client Approval.
   3. High-criticality material -> Client approval IF project rule requireClientForCritical=true.
   4. Critical priority -> notify everyone immediately (handled in submitRequest).
   5. Insufficient project remaining budget -> Client + Accounts review.
   Returns {status, route, reasons[]} */
function decideRoute(r){
  const m=S.material(r.materialId), p=S.project(r.projectId);
  const rem=S.authRem(p.id), reasons=[]; let status='pending_admin', route='admin';
  const rule = Object.assign({requireClientForCritical:false}, p.approvalRule||{});
  if(rule.requireClientForCritical && m.crit==='high'){ status='pending_client'; route='client'; reasons.push(T('routeCritical')); }
  else if(r.estCost > rem){ status='pending_client'; route='client'; reasons.push(T('routeClient')); }
  else reasons.push(T('routeAdmin'));
  if(S.budgetRem(p.id) < r.estCost){ status='pending_client'; route='client'; reasons.push(T('routeBudget')); }
  return {status, route, reasons};
}

/* --- submit request (from draft or new) --- */
function submitRequest(r){
  const d=decideRoute(r);
  r.status=d.status; r.route=d.route; r.submittedAt=new Date().toISOString();
  addTimeline(r, T('submitted')+' · '+d.reasons.join(' · '), {kind:'info'});
  const mat=S.material(r.materialId), pn=S.projName(r.projectId);
  const itemDesc=`${S.matShort(r.materialId)} ${qtyFmt(r.qty)} ${mat.unit}`;
  notify('worker','success',T('reqCreated')+' '+r.id, `${itemDesc} · ${pn}. ${d.reasons[0]}`, r.id);
  if(d.status==='pending_admin'){
    notify('admin','action',`${T('newReqFor')} ${itemDesc}`, `${inr(r.estCost)} — ${T('needsReview')} (${T('pendingAdminAppr')}).`, r.id);
    notify('accounts','info',`New estimated commitment: ${inr(r.estCost)}`, `${S.matShort(r.materialId)}, ${pn}.`, r.id);
    notify('client','info',`Information only: ${itemDesc}`, `Requested for ${pn}. Admin is handling under delegated authority.`, r.id);
  } else {
    notify('client','action',`Action required: ${itemDesc}`, `${inr(r.estCost)} ${T('needsReview')}.`, r.id);
    notify('admin','info','Request routed to client', `${r.id} · ${itemDesc} — ${d.reasons.join(' ')}`, r.id);
    notify('accounts','warning',`High-value request alert: ${inr(r.estCost)}`, `${r.id} pending client approval (${pn}).`, r.id);
    if(r.priority==='critical'){
      notify('client','alert','CRITICAL priority request', `${r.id} · ${itemDesc} needed urgently.`, r.id);
      notify('admin','alert','CRITICAL priority request', `${r.id} · ${itemDesc}`, r.id);
    }
  }
  Store.persist(); render();
  return d;
}

/* --- admin approves under delegated authority --- */
function adminApprove(reqId){
  const r=S.request(reqId), me=S.me(), p=S.project(r.projectId);
  if(me.role!=='admin') { toast('alert',T('unauthorized'),''); return false; }
  if(r.status!=='pending_admin'){ toast('warn','Not in your queue',''); return false; }
  if(r.estCost > S.authRem(p.id)){ toast('danger','Authority insufficient','Reduce limit or route to client.'); return false; }
  p.adminUsed += r.estCost;                       // consume delegated authority
  r.status='approved_admin'; r.approvedBy=me.id; r.authority='admin_delegated';
  addTimeline(r, `${T('approveUnder')} · ${inr(r.estCost)} · ${T('remaining')}: ${inr(S.authRem(p.id))}`, {kind:'done'});
  r.status='pending_stock';                        // straight to stock verification
  addTimeline(r, T('pendingStockVerif'), {kind:'info'});
  const mat=S.material(r.materialId);
  notify('client','info',`Information only: ${S.matShort(r.materialId)} ${qtyFmt(r.qty)} ${mat.unit} approved`, `${r.id} approved by Admin under delegated authority (${inr(r.estCost)}).`, r.id);
  notify('accounts','success',`Commitment confirmed: ${inr(r.estCost)}`, `${r.id} approved under admin authority.`, r.id);
  notify('worker','success',`${r.id} approved by Admin`, `${T('approvedBy')} ${me.name}. Next: stock verification.`, r.id);
  notify('admin','info',`${r.id} → ${T('pendingStockVerif')}`, 'Verify and reserve stock next.', r.id);
  Store.persist(); render(); return true;
}

/* --- client decision --- */
function clientDecide(reqId, decision, comment){
  const r=S.request(reqId), me=S.me();
  if(me.role!=='client'){ toast('alert',T('unauthorized'),''); return false; }
  if(decision==='reject'){
    if(!comment || comment.trim().length<5){ toast('danger',T('valRejectReason'),''); return false; }
    r.status='rejected'; r.rejectReason=comment.trim();
    addTimeline(r, `${T('rejected')} — ${comment.trim()}`, {kind:'bad'});
    notify('worker','alert',`${r.id} rejected`, comment.trim(), r.id);
    notify('admin','info',`${r.id} rejected by client`, comment.trim(), r.id);
    notify('accounts','info',`Commitment released: ${r.id}`, `${inr(r.estCost)} no longer committed.`, r.id);
  } else {
    r.status='approved_client'; r.approvedBy=me.id; r.authority='client';
    addTimeline(r, `${T('approvedBy')} ${me.name}${comment?' — '+comment.trim():''}`, {kind:'done'});
    r.status='pending_stock';
    addTimeline(r, T('pendingStockVerif'), {kind:'info'});
    notify('worker','success',`${r.id} approved by Client`, `${T('approvedBy')} ${me.name}.`, r.id);
    notify('admin','action',`${T('pendingStockVerif')}: ${r.id}`, `Client-approved ${S.matShort(r.materialId)} ${qtyFmt(r.qty)} — verify & reserve stock.`, r.id);
    notify('accounts','success',`Client commitment: ${inr(r.estCost)}`, `${r.id} approved by ${me.name}.`, r.id);
  }
  Store.persist(); render(); return true;
}

/* --- client override of delegated authority (audited) --- */
function clientOverrideApprove(reqId, decision, comment){
  const r=S.request(reqId), me=S.me();
  addTimeline(r, `${T('override')} → ${decision==='reject'?T('reject'):T('approve')}`, {kind: decision==='reject'?'bad':'info'});
  notify('admin','alert',T('overrideLogged'), `${me.name} overrode delegated authority on ${r.id}.`, r.id);
  return clientDecide(reqId, decision, comment);
}

/* --- stock verification / reservation --- */
function verifyReserve(reqId){
  const r=S.request(reqId), me=S.me();
  if(me.role!=='admin'){ toast('alert',T('unauthorized'),''); return false; }
  if(!['pending_stock'].includes(r.status)){ toast('warn','Not in verification queue',''); return false; }
  const st=S.stock(r.materialId);
  const need=r.qty - r.issuedQty;
  const freeAvail = +(st.avail - st.res).toFixed(2); // unreserved portion
  if(freeAvail >= need){
    r.reservedQty = +(r.reservedQty + need).toFixed(2);
    mvAdd(r.materialId,'reservation',need,0,+need,r.projectId,r.id,'Reserved for '+r.id);
    r.status='ready_issue'; addTimeline(r, T('reservedOk')+` (${qtyFmt(need)} ${st.unit})`,{kind:'done'});
    notify('admin','success',`${r.id} → ${T('readyForIssue')}`, `${qtyFmt(need)} ${st.unit} reserved.`, r.id);
    notify('worker','info',`${r.id} stock verified`, `${T('readyForIssue')}.`, r.id);
  } else {
    // Flow C: insufficient stock → purchase path. Reserve what IS available (partial), rest awaits purchase.
    if(freeAvail>0){
      r.reservedQty=+(r.reservedQty+freeAvail).toFixed(2);
      mvAdd(r.materialId,'reservation',freeAvail,0,+freeAvail,r.projectId,r.id,'Partial reservation — balance awaiting purchase');
    }
    r.status='pending_purchase';
    addTimeline(r, `${T('insufficient')}: need ${qtyFmt(need)} ${st.unit}, free available ${qtyFmt(Math.max(0,freeAvail))}. Purchase initiated.`,{kind:'bad'});
    notify('accounts','warning',`Purchase requirement: ${r.id}`, `${S.matShort(r.materialId)} ${qtyFmt(need)} ${st.unit} short (est. ${inr(need*r.unitPrice)}).`, r.id);
    notify('admin','alert',T('insufficient'), `${r.id} → ${T('pendingPurchase')||'Pending Purchase'}. Awaiting stock receipt.`, r.id);
    notify('worker','warning',`${r.id}: ${T('insufficient')}`, `${T('insufficientMsg')}`, r.id);
    notify('client','info',`${r.id} awaiting purchase`, `${S.matShort(r.materialId)} stock insufficient; procurement underway.`, r.id);
  }
  Store.persist(); render(); return true;
}

/* --- material issue (full/partial) --- */
function issueMaterial(reqId, q){
  const r=S.request(reqId), me=S.me();
  if(me.role!=='admin'){ toast('alert',T('unauthorized'),''); return false; }
  if(!['ready_issue','partial_issued'].includes(r.status)){ toast('warn','Request not ready for issue',''); return false; }
  const st=S.stock(r.materialId);
  const remaining=+(r.qty-r.issuedQty).toFixed(2);
  q=+q;
  if(!(q>0)){ toast('danger',T('positiveQty'),''); return false; }
  if(q>remaining || q>r.reservedQty || q>st.avail){ toast('danger',T('cannotIssueMore'),`max ${qtyFmt(Math.min(remaining,r.reservedQty,st.avail))} ${st.unit}`); return false; }
  r.issuedQty=+(r.issuedQty+q).toFixed(2); r.reservedQty=+(r.reservedQty-q).toFixed(2);
  mvAdd(r.materialId,'issue',q,-q,-q,r.projectId,r.id,'Material issued to site', q*r.unitPrice);
  const value=q*r.unitPrice;
  if(r.issuedQty>=r.qty){ r.status='issued'; addTimeline(r, `${T('issuedOk')} ${qtyFmt(r.issuedQty)} ${st.unit} · ${inr(value)}`,{kind:'done'}); }
  else { r.status='partial_issued'; addTimeline(r, `${T('partialOk')} ${qtyFmt(q)}/${qtyFmt(r.qty)} ${st.unit} · ${inr(value)}`,{kind:'info'}); }
  notify('worker','success',`Material issued: ${qtyFmt(q)} ${st.unit} ${S.matShort(r.materialId)}`, `${r.id} — received at site.`, r.id);
  notify('accounts','info',`Actual issued value updated: ${inr(value)}`, `${r.id} · ${S.matShort(r.materialId)} ${qtyFmt(q)} ${st.unit}.`, r.id);
  notify('client','info',`Information: material issued`, `${qtyFmt(q)} ${st.unit} ${S.matShort(r.materialId)} against ${r.id} (${r.authority==='admin_delegated'?'delegated approval':'client approval'}).`, r.id);
  Store.persist(); render(); return true;
}

/* --- mark delivered --- */
function markDelivered(reqId){
  const r=S.request(reqId);
  if(!['issued'].includes(r.status)){ toast('warn','Only fully issued requests can be delivered',''); return false; }
  r.status='delivered'; addTimeline(r, T('deliveryDone'),{kind:'done'});
  notify('worker','success',`${r.id} delivered`, `${S.matShort(r.materialId)} received at site.`, r.id);
  notify('client','info',`${r.id} delivered`, `${inr(r.issuedQty*r.unitPrice)} material delivered to ${S.projName(r.projectId)}.`, r.id);
  Store.persist(); render(); return true;
}

/* --- cancel (worker, before approval/issue) --- */
function cancelRequest(reqId){
  const r=S.request(reqId), me=S.me();
  if(me.role!=='worker' || r.createdBy!==me.id){ toast('alert',T('unauthorized'),''); return false; }
  if(['issued','partial_issued','delivered','closed'].includes(r.status)){ toast('warn','Cannot cancel after issue begins',''); return false; }
  // release reservations if any
  if(r.reservedQty>0){ mvAdd(r.materialId,'release',r.reservedQty,0,-r.reservedQty,r.projectId,r.id,'Reservation released on cancellation'); r.reservedQty=0; }
  r.status='cancelled'; addTimeline(r, `${T('cancelReq')} — ${me.name}`,{kind:'bad'});
  notify('admin','info',`${r.id} cancelled`, `${S.matShort(r.materialId)} ${qtyFmt(r.qty)} ${S.material(r.materialId).unit}.`, r.id);
  notify('accounts','info',`Commitment released: ${r.id}`, `${inr(r.estCost)} removed from commitments.`, r.id);
  notify('client','info',`${r.id} cancelled`, 'Request withdrawn by site supervisor.', r.id);
  Store.persist(); render(); return true;
}

/* --- save draft / edit own draft --- */
function saveDraft(fields){
  const me=S.me();
  const id = fields.id || ('REQ-'+(Store.state.counters.req++));
  const est=+(fields.qty*fields.unitPrice).toFixed(2);
  let r=S.request(id);
  if(r){ Object.assign(r, fields, {estCost:est}); }
  else{
    r=Object.assign({id, issuedQty:0,reservedQty:0,rejectReason:'',photo:null,gps:'',notes:''}, fields,
      {created:new Date().toISOString(), createdBy:me.id, status:'draft', route:null, estCost:est, timeline:[]});
    Store.state.requests.unshift(r);
  }
  addTimeline(r, T('savedDraft'), {kind:'info'});
  Store.persist(); return r;
}

/* --- inventory operations --- */
function mvAdd(mid,type,q,aD,rD,pid,reqId,note,val){
  Store.state.movements.push({id:'MOV-'+Date.now()+Math.floor(Math.random()*900), ts:new Date().toISOString(),
    materialId:mid, type, qty:q, availDelta:aD, resDelta:rD, projectId:pid||null, requestId:reqId||null,
    userId:S.me().id, note:note||'', valueImpact: val!=null?val: Math.abs(aD)*S.material(mid).cost});
}
function recordReceipt(mid,q,note,supplier){
  q=+q; if(!(q>0)){ toast('danger',T('positiveQty'),''); return false; }
  mvAdd(mid,'receipt',q,q,0,null,null,note||'Stock receipt');
  if(supplier) S.material(mid).supplier=supplier;
  notify('admin','success',`${T('recordReceipt')}: ${S.matShort(mid)} +${qtyFmt(q)}`, note||'', mid);
  notify('accounts','info',`Stock receipt recorded`, `${S.matShort(mid)} ${qtyFmt(q)} ${S.material(mid).unit} received.`, mid);
  // Flow C continuation: any pending_purchase request for this material becomes ready if stock now sufficient
  Store.state.requests.filter(r=>r.status==='pending_purchase'&&r.materialId===mid).forEach(r=>{
    const st=S.stock(mid); const need=r.qty-r.issuedQty; const free=+(st.avail-st.res).toFixed(2);
    if(free>0){
      const res=Math.min(free,need);
      r.reservedQty=+(r.reservedQty+res).toFixed(2);
      mvAdd(mid,'reservation',res,0,res,r.projectId,r.id,'Reserved after fresh receipt');
      if(r.reservedQty>=need){ r.status='ready_issue'; addTimeline(r, `${T('insufficient')} resolved — ${T('readyForIssue')}`,{kind:'done'}); }
      else addTimeline(r, `Balance received partially — reserved ${qtyFmt(res)} ${st.unit} more`, 'info');
      if(r.status==='ready_issue'){
        notify('worker','success',`${r.id} ready for issue`, `Fresh stock received; ${qtyFmt(r.reservedQty)} ${st.unit} reserved.`, r.id);
        notify('admin','action',`${r.id} → ${T('readyForIssue')}`, 'Issue material now.', r.id);
        notify('accounts','info',`Purchase fulfilled: ${r.id}`, `${S.matShort(mid)} now available for issue.`, r.id);
      }
    }
  });
  Store.persist(); render(); return true;
}
function adjustStock(mid,q,reason){
  q=+q; if(!q){ toast('danger',T('positiveQty'),''); return false; }
  if(q<0 && (!reason||reason.trim().length<5)){ toast('danger',T('adjReason'),''); return false; }
  const st=S.stock(mid);
  if(st.avail+q<0){ toast('danger',T('wouldNegate'),''); return false; }
  if(st.avail+q<st.res){ toast('danger',T('belowReserved'),''); return false; }
  mvAdd(mid,'adjustment',Math.abs(q),q,0,null,null,reason||'Manual adjustment');
  notify('admin','info',`${T('adjustStock')}: ${S.matShort(mid)} ${q>0?'+':''}${qtyFmt(q)}`, reason||'', mid);
  notify('accounts', q<0?'warning':'info', `${q<0?'Loss':'Gain'} adjustment: ${inr(Math.abs(q)*st.cost)}`, `${S.matShort(mid)} ${reason||''}`, mid);
  Store.persist(); render(); return true;
}
/* --- Flow E: return / damage report --- */
function reportReturnDamage(mid,q,kind,note){
  q=+q; if(!(q>0)){ toast('danger',T('positiveQty'),''); return false; }
  const st=S.stock(mid);
  if(kind==='damage' && q>st.avail){ toast('danger',T('wouldNegate'),''); return false; }
  mvAdd(mid,kind,q, kind==='return'?q:-q, 0, null, null, note|| (kind==='return'?T('returnReport'):T('damageReport')));
  const val=q*st.cost;
  notify('accounts', kind==='return'?'success':'alert', kind==='return'?`Credit: material returned ${inr(val)}`:`Write-off loss: ${inr(val)}`, `${S.matShort(mid)} ${qtyFmt(q)} ${st.unit}. ${note||''}`, mid);
  notify('admin','info', kind==='return'?T('returnReport'):T('damageReport'), `${S.matShort(mid)} ${qtyFmt(q)} ${st.unit}`, mid);
  Store.persist(); render(); return true;
}
/* --- purchase entry (Accounts/Admin) --- */
function addPurchase(f){
  const amount=+(f.qty*f.unitCost).toFixed(2);
  const id='PUR-'+(500+Store.state.purchases.length+1)+'-'+Math.floor(Math.random()*90+10);
  Store.state.purchases.unshift(Object.assign({id, amount}, f));
  notify('accounts','info',`Purchase invoice recorded: ${f.invoice}`, `${inr(amount)} · ${f.supplier} · ${S.projName(f.projectId)}`, id);
  notify('client','info',`Project purchase update`, `${inr(amount)} recorded for ${S.projName(f.projectId)} (${f.status==='pending'?T('pending'):T('paid')}).`, f.projectId);
  if(f.status==='pending') notify('accounts','alert',`Pending invoice ${f.invoice}`, `${inr(f.amount)} payable to ${f.supplier}.`, id);
  Store.persist(); render(); return true;
}
function markPurchasePaid(id){
  const p=Store.state.purchases.find(x=>x.id===id); if(!p) return;
  p.status='paid';
  notify('accounts','success',`Invoice paid: ${p.invoice}`, `${inr(p.amount)} → ${p.supplier}.`, p.id);
  Store.persist(); render();
}
/* --- notifications helpers --- */
function markAllRead(role){ Store.state.notifications.forEach(n=>{ if(n.role===role) n.read=true; }); Store.persist(); render(); }
function markRead(id){ const n=Store.state.notifications.find(x=>x.id===id); if(n){n.read=true; Store.persist();} }
function askNotifPermission(){
  if('Notification' in window){
    Notification.requestPermission().then(p=> toast(p==='granted'?'success':'info', T('notifPerm'), p==='granted'?'Native notifications enabled':'Continuing with in-app simulation.'));
  } else toast('info',T('notifPerm'),'Not supported here — using in-app simulation.');
}
