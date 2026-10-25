/* ============ Views: dashboards, requests, approvals, inventory, accounts, reports, profile ============ */

/* ================= WORKER HOME ================= */
Views.home=function(){
  const me=S.me();
  return ({worker:homeWorker, client:homeClient, admin:homeAdmin, accounts:homeAccounts})[me.role]();
};
function homeWorker(){
  const rs=S.myRequests();
  const drafts=rs.filter(r=>r.status==='draft');
  const pending=rs.filter(r=>['submitted','pending_admin','pending_client','pending_stock'].includes(r.status));
  const approved=rs.filter(r=>['approved_admin','approved_client','ready_issue','partial_issued'].includes(r.status));
  const rejected=rs.filter(r=>r.status==='rejected');
  const issued=rs.filter(r=>['issued','delivered'].includes(r.status)).slice(0,3);
  return {title:T('appName'), html:`
    <div class="card" style="background:linear-gradient(135deg,#f59e0b,#f97316);color:#1e293b">
      <div class="bold" style="font-size:18px">${T('hello')}, ${S.me().name.split(' ')[0]} 👷</div>
      <div class="small" style="opacity:.85">${S.me().title} · ${Store.state.lang==='hi'?'डेमो डेटा • काल्पनिक':'Demo data • fictional'}</div>
      <button class="btn big dark" style="margin-top:12px" onclick="goTab('newreq')">➕ ${T('createRequest')}</button>
    </div>
    <div class="grid2 section">
      <div class="stat clickable" onclick="go('requests',{f:'draft'})"><div class="v">${drafts.length}</div><div class="l">${T('draft')}</div></div>
      <div class="stat clickable" onclick="go('requests',{f:'pending'})"><div class="v" style="color:var(--amber)">${pending.length}</div><div class="l">${T('pendingApproval')}</div></div>
      <div class="stat clickable" onclick="go('requests',{f:'approved'})"><div class="v" style="color:var(--green)">${approved.length}</div><div class="l">${T('approvedReqs')}</div></div>
      <div class="stat clickable" onclick="go('requests',{f:'rejected'})"><div class="v warn">${rejected.length}</div><div class="l">${T('rejectedReqs')}</div></div>
    </div>
    <div class="section"><h2>${T('myRequests')} <button class="link" onclick="go('requests')">${T('viewAll')}</button></h2>
      ${rs.slice(0,4).map(r=>reqCard(r)).join('')||emptyState('📋',T('emptyReqs'),T('emptyReqsHint'))}
    </div>
    <div class="section"><h2>${T('recentlyIssued')}</h2>
      ${issued.map(r=>`<div class="item clickable" onclick="openReq('${r.id}')"><div class="ic">✅</div><div class="grow">
        <div class="t">${esc(S.matShort(r.materialId))} · ${qtyFmt(r.issuedQty)}</div>
        <div class="s">${esc(S.projName(r.projectId))} · ${r.id}</div></div>${statusPill(r.status)}</div>`).join('')||`<p class="muted">—</p>`}
    </div>`};
}

/* ================= CLIENT HOME ================= */
function homeClient(){
  const need=Store.state.requests.filter(r=>r.status==='pending_client');
  const info=Store.state.requests.filter(r=>r.route==='admin'&&['pending_admin','approved_admin','pending_stock','ready_issue','partial_issued','issued','delivered'].includes(r.status));
  const pendCost=need.reduce((s,r)=>s+r.estCost,0);
  return {title:T('appName'), html:`
    <div class="card" style="background:linear-gradient(135deg,#1e293b,#334155);color:#fff">
      <div class="row spread"><div><div class="small" style="color:#cbd5e1">${T('needsMyApproval')}</div>
      <div style="font-size:30px;font-weight:800">${need.length}</div></div>
      <div style="text-align:right"><div class="small" style="color:#cbd5e1">${T('pendingEstCost')}</div>
      <div class="num" style="font-size:20px;font-weight:800;color:var(--accent)">${inr(pendCost)}</div></div></div>
      <button class="btn big primary" style="margin-top:12px" onclick="goTab('approvals')">${T('approve')} / ${T('reject')} →</button>
    </div>
    <div class="section"><h2>${T('infoOnly')} (${info.length})</h2>
      ${info.slice(0,3).map(r=>`<div class="item clickable" onclick="openReq('${r.id}')"><div class="ic">ℹ️</div><div class="grow">
        <div class="t">${esc(S.matShort(r.materialId))} · ${qtyFmt(r.qty)} ${S.material(r.materialId).unit}</div>
        <div class="s">${esc(S.projName(r.projectId))} · ${inr(r.estCost)} · ${r.id}</div></div>${statusPill(r.status)}</div>`).join('')
        ||emptyState('📭',T('emptyInfo'),'')}
      <p class="alert info">ℹ️ ${T('noActionDelegated')}</p>
    </div>
    <div class="section"><h2>${T('budgetUtil')}</h2>
      ${Store.state.projects.map(p=>{const used=S.projIssued(p.id)+S.projCommitted(p.id);return `<div class="card" style="padding:12px;margin-bottom:8px">
        <div class="row spread small bold"><span>${esc(S.projName(p.id))}</span><span class="num">${Math.round(100*used/p.budget)}%</span></div>
        ${progBar(used,p.budget,'blue')}
        <div class="row spread muted" style="margin-top:4px"><span class="num">${inr(used)} ${T('usedBudget')}</span><span class="num">${inr(p.budget)}</span></div></div>`;}).join('')}
    </div>
    <div class="section"><h2>${T('recentDecisions')}</h2><div class="card">
      ${Store.state.requests.filter(r=>r.approvedBy||r.status==='rejected').slice(-4).reverse().map(r=>`<div class="mthr clickable" onclick="openReq('${r.id}')">
        <span class="small">${r.id} · ${esc(S.matShort(r.materialId))}</span>${statusPill(r.status)}</div>`).join('')||'<p class="muted">—</p>'}
    </div></div>`};
}

/* ================= ADMIN HOME ================= */
function homeAdmin(){
  const pTot=Store.state.projects.reduce((s,p)=>s+p.adminLimit,0), pUsed=Store.state.projects.reduce((s,p)=>s+p.adminUsed,0);
  const q1=Store.state.requests.filter(r=>r.status==='pending_admin');
  const q2=Store.state.requests.filter(r=>r.status==='pending_stock');
  const q3=Store.state.requests.filter(r=>['ready_issue','partial_issued'].includes(r.status));
  const low=S.lowStock();
  const mvs=[...Store.state.movements].sort((a,b)=>b.ts.localeCompare(a.ts)).slice(0,5);
  return {title:T('appName'), html:`
    <div class="card">
      <div class="row spread"><b>${T('myAuthority')}</b><span class="pill p-blue">${T('demo')}</span></div>
      ${progBar(pUsed,pTot)}
      <div class="row spread" style="margin-top:8px">
        <div><div class="muted">${T('limit')}</div><div class="bold num">${inr(pTot)}</div></div>
        <div><div class="muted">${T('used')}</div><div class="bold num" style="color:var(--amber)">${inr(pUsed)}</div></div>
        <div><div class="muted">${T('remaining')}</div><div class="bold num" style="color:var(--green)">${inr(pTot-pUsed)}</div></div>
      </div>
      <div class="small muted" style="margin-top:6px">${Store.state.projects.map(p=>`${S.projName(p.id).split(' ')[0]}: ${inr(S.authRem(p.id))}`).join(' · ')}</div>
    </div>
    <div class="grid3 section">
      <div class="stat clickable" onclick="go('adminQueue')"><div class="v" style="color:var(--amber)">${q1.length}</div><div class="l">${T('pendingAdminAppr')}</div></div>
      <div class="stat clickable" onclick="go('verifyQueue')"><div class="v" style="color:var(--blue)">${q2.length}</div><div class="l">${T('pendingStockVerif')}</div></div>
      <div class="stat clickable" onclick="goTab('issue')"><div class="v" style="color:var(--green)">${q3.length}</div><div class="l">${T('readyForIssue')}</div></div>
    </div>
    <div class="grid2 section">
      <button class="btn outline" onclick="go('verifyQueue')">🔎 ${T('verifyStock')}</button>
      <button class="btn outline" onclick="goTab('issue')">🚚 ${T('issueMaterial')}</button>
      <button class="btn outline" onclick="go('inventory')">📥 ${T('recordReceipt')}</button>
      <button class="btn outline" onclick="go('inventory')">⚖️ ${T('adjustStock')}</button>
    </div>
    ${low.length?`<div class="alert danger">⚠️ ${T('lowStockAlert')}: ${low.map(m=>esc(m.name)+' ('+qtyFmt(S.stock(m.id).avail)+'/'+qtyFmt(m.low)+')').join(', ')}. <button class="link" onclick="go('inventory')">${T('viewAll')}</button></div>`:''}
    <div class="grid2 section">
      <div class="stat"><div class="v">${Store.state.materials.length}</div><div class="l">${T('totalItems')}</div></div>
      <div class="stat warn"><div class="v">${low.length}</div><div class="l">${T('lowStockItems')}</div></div>
    </div>
    <div class="section"><h2>${T('recentMovements')} <button class="link" onclick="go('movements')">${T('seeAll')}</button></h2>
      <div class="card divide">${mvs.map(mvRow).join('')}</div></div>`};
}
function mvRow(m){
  const cls={receipt:'p-green',reservation:'p-blue',release:'p-grey',issue:'p-dgreen',adjustment:'p-amber',return:'p-indigo',damage:'p-red'}[m.type];
  return `<div class="mthr clickable" onclick="go('material',{id:'${m.materialId}'})">
    <div class="grow"><div class="small bold">${esc(S.matShort(m.materialId))} <span class="pill ${cls}">${T('mtype.'+m.type)}</span></div>
    <div class="muted">${timeAgo(m.ts)} · ${m.note?esc(m.note):''}${m.requestId?' · '+m.requestId:''}</div></div>
    <div class="right"><div class="bold num">${m.availDelta>0?'+':''}${qtyFmt(m.availDelta)} ${S.material(m.materialId).unit}</div>
    <div class="muted num">${inr(m.valueImpact)}</div></div></div>`;
}

/* ================= ACCOUNTS HOME ================= */
function homeAccounts(){
  const purch=S.purchTotal(), pend=S.pendingInvoiceTotal(), comm=S.committedAll(), issued=S.issuedValueAll();
  return {title:T('appName'), html:`
    <div class="grid2 section">
      <div class="stat"><div class="v num" style="color:var(--blue)">${inr(purch)}</div><div class="l">${T('totalPurchases')}</div></div>
      <div class="stat warn"><div class="v num">${inr(pend)}</div><div class="l">${T('pendingInvoices')}</div></div>
      <div class="stat"><div class="v num" style="color:var(--amber)">${inr(comm)}</div><div class="l">${T('committedCost')}</div></div>
      <div class="stat ok"><div class="v num">${inr(issued)}</div><div class="l">${T('issuedValue')}</div></div>
    </div>
    <div class="alert info">ℹ️ ${Store.state.lang==='hi'?'खरीद और वितरण प्रविष्टियाँ अलग-अलग रखी जाती हैं (डबल काउंटिंग से बचने हेतु)।':'Purchase entries and issuance entries are tracked separately to avoid double-counting.'}</div>
    <div class="section"><h2>${T('projectExpenses')} <button class="link" onclick="go('reports')">${T('viewReports')}</button></h2>
      ${Store.state.projects.map(p=>`<div class="card" style="padding:12px;margin-bottom:8px" onclick="go('project',{id:'${p.id}'})">
        <div class="row spread"><b class="small">${esc(S.projName(p.id))}</b><span class="muted">${T('status.'+p.status)}</span></div>
        <div class="row spread small" style="margin-top:6px"><span>${T('issuedVal')}</span><b class="num">${inr(S.projIssued(p.id))}</b></div>
        <div class="row spread small"><span>${T('purchTotal')}</span><b class="num">${inr(S.purchTotal(p.id))}</b></div>
        <div class="row spread small"><span>${T('committedCost')}</span><b class="num" style="color:var(--amber)">${inr(S.projCommitted(p.id))}</b></div>
        ${progBar(S.projIssued(p.id)+S.projCommitted(p.id),p.budget,'green')}
      </div>`).join('')}
    </div>
    <div class="section"><h2>${T('monthlySummary')}</h2><div class="card bar-chart">
      ${S.monthlyExpenses().map(([k,v])=>{const [y,m]=k.split('-');return `<div class="brow"><div class="bl">${T('monthNames')[+m-1]} ${y}</div><div class="bt"><i style="width:${Math.round(100*v/Math.max(...S.monthlyExpenses().map(x=>x[1])))}%;background:var(--blue)"></i></div><div class="bv num">${inr(v)}</div></div>`;}).join('')}
    </div></div>`};
}

/* ================= REQUESTS LIST (worker + all roles) ================= */
let reqFilters={q:'',status:'',project:'',priority:''};
function setReqF(k,v){ reqFilters[k]=v; render(); }
Views.requests=function(params){
  const me=S.me();
  if(params&&params.f){ // quick preset from dashboard
    reqFilters.status = params.f==='draft'?'draft':params.f==='pending'?'.pending':params.f==='approved'?'.approved':params.f==='rejected'?'.rejected':reqFilters.status;
  }
  let list = me.role==='worker' ? S.myRequests() : [...Store.state.requests].sort((a,b)=>b.created.localeCompare(a.created));
  const f=reqFilters;
  if(f.q) list=list.filter(r=>(r.id+' '+S.material(r.materialId).name+' '+S.project(r.projectId).name+' '+r.reason).toLowerCase().includes(f.q.toLowerCase()));
  if(f.status==='.pending') list=list.filter(r=>['submitted','pending_admin','pending_client','pending_stock'].includes(r.status));
  else if(f.status==='.approved') list=list.filter(r=>['approved_admin','approved_client','ready_issue','partial_issued','issued','delivered'].includes(r.status));
  else if(f.status==='.rejected') list=list.filter(r=>r.status==='rejected');
  else if(f.status) list=list.filter(r=>r.status===f.status);
  if(f.project) list=list.filter(r=>r.projectId===f.project);
  if(f.priority) list=list.filter(r=>r.priority===f.priority);
  const statuses=['draft','pending_admin','pending_client','pending_stock','ready_issue','partial_issued','issued','delivered','rejected','cancelled','pending_purchase'];
  return {title:T('navRequests'), html:`
    <div class="searchbar"><span class="si">🔍</span><input placeholder="${T('search')}" value="${esc(f.q)}" onchange="setReqF('q',this.value)"></div>
    <div class="chips" style="margin-bottom:10px">
      <select style="width:auto;padding:9px 12px;border-radius:22px;font-size:13px;font-weight:600" onchange="setReqF('status',this.value)">
        <option value="">${T('allStatuses')}</option>${statuses.map(s=>`<option value="${s}" ${f.status===s?'selected':''}>${T('status.'+s)}</option>`).join('')}</select>
      <select style="width:auto;padding:9px 12px;border-radius:22px;font-size:13px;font-weight:600" onchange="setReqF('project',this.value)">
        <option value="">${T('allProjects')}</option>${Store.state.projects.map(p=>`<option value="${p.id}" ${f.project===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select>
      <select style="width:auto;padding:9px 12px;border-radius:22px;font-size:13px;font-weight:600" onchange="setReqF('priority',this.value)">
        <option value="">${T('allPriorities')}</option>${['normal','urgent','critical'].map(p=>`<option value="${p}" ${f.priority===p?'selected':''}>${T('priority.'+p)}</option>`).join('')}</select>
    </div>
    ${list.length?list.map(r=>reqCard(r)).join(''):emptyState('📋',T('emptyReqs'),me.role==='worker'?T('emptyReqsHint'):'',`<button class="btn primary sm" onclick="goTab('newreq')">➕ ${T('createRequest')}</button>`)}
    ${me.role!=='worker'?`<p class="muted" style="text-align:center;margin-top:8px">${Store.state.lang==='hi'?'डेमो: सभी अनुरोध दिखाए जा रहे हैं':'Demo: viewing all requests'}</p>`:''}`};
};

/* ================= CREATE REQUEST FORM ================= */
let form={projectId:'',materialId:'',qty:1,unitPrice:0,reason:'',requiredBy:'',priority:'normal',notes:'',photo:null,gps:false,draftId:null};
function setForm(k,v){ form[k]=v;
  if(k==='materialId'&&v){ const m=S.material(v); form.unitPrice=m.cost; }
  Route.params._errs={};
  render(); }
function stepQty(d){ form.qty=Math.max(0,+((+form.qty||0)+d)); render(); }
Views.newreq=function(params){
  const initDone = Route.params.__init;
  if(!initDone && !params.editId){ formReset(); Route.params.__init=true; }
  if(initDone) { /* keep current form */ }
  else if(params.editId){
    const r=S.request(params.editId);
    form={projectId:r.projectId,materialId:r.materialId,qty:r.qty,unitPrice:r.unitPrice,reason:r.reason,requiredBy:r.requiredBy.slice(0,10),priority:r.priority,notes:r.notes,photo:r.photo,gps:r.gps,draftId:r.id};
    Route.params.__init=true;
  }
  const est=+(form.qty*form.unitPrice)||0;
  const chips=['M-01','M-02','M-03','M-04','M-06','M-07','M-12'];
  const err=Route.params._errs||{};
  const fld=(k,label,input)=>`<div class="field ${err[k]?'bad':''}"><label>${label}</label>${input}<div class="err">${err[k]||''}</div></div>`;
  return {title:form.draftId?T('req')+' '+form.draftId:T('createRequest'), html:`
    ${fld('projectId',T('selectProject'),`<select onchange="setForm('projectId',this.value)">
      <option value="">—</option>${Store.state.projects.map(p=>`<option value="${p.id}" ${form.projectId===p.id?'selected':''}>${esc(p.name)} · ${esc(p.loc)} (${T('status.'+p.status)})</option>`).join('')}</select>`)}
    <div class="section"><h2>${T('material')}</h2><div class="chips">
      ${chips.map(mid=>`<button class="chip ${form.materialId===mid?'on':''}" onclick="setForm('materialId','${mid}')">${matIcon(mid)} ${esc(Store.state.lang==='hi'?S.material(mid).hi:S.material(mid).name.split(' ').slice(0,2).join(' '))}</button>`).join('')}
    </div></div>
    ${fld('materialId',T('material')+':',`<select onchange="setForm('materialId',this.value)">
      <option value="">—</option>${Store.state.materials.map(m=>`<option value="${m.id}" ${form.materialId===m.id?'selected':''}>${esc(m.name)} · ${inr(m.cost)}/${m.unit}</option>`).join('')}</select>`)}
    ${form.materialId?`<p class="hint">${T('category')}: ${S.material(form.materialId).cat} · ${T('perUnit')}: ${inr(S.material(form.materialId).cost)} · ${critPill(S.material(form.materialId).crit)}</p>`:''}
    ${fld('qty',T('quantity')+` (${form.materialId?S.material(form.materialId).unit:''})`,
      `<div class="stepper"><button onclick="stepQty(-1)">−</button><input type="number" inputmode="decimal" min="0" value="${form.qty}" onchange="setForm('qty',this.value)"><button onclick="stepQty(1)">+</button></div>`)}
    ${fld('unitPrice',T('unitPrice'),`<input type="number" inputmode="decimal" min="0" value="${form.unitPrice}" onchange="setForm('unitPrice',this.value)">`)}
    <div class="totalbox"><div><div class="small" style="color:#cbd5e1">${T('estTotal')}</div><div class="amt num">${inr(est)}</div></div>
      <div class="small" style="color:#cbd5e1;text-align:right">${qtyFmt(form.qty)} × ${inr(form.unitPrice)}</div></div>
    ${fld('reason',T('reason'),`<textarea rows="3" placeholder="${T('fCement')}…" onchange="setForm('reason',this.value)">${esc(form.reason)}</textarea>`)}
    ${fld('requiredBy',T('requiredBy'),`<input type="date" value="${form.requiredBy}" onchange="setForm('requiredBy',this.value)">`)}
    ${fld('priority',T('priority.normal')+' / '+T('priority.urgent')+' / '+T('priority.critical'),
      `<div class="row">${['normal','urgent','critical'].map(p=>`<button class="chip grow ${form.priority===p?'on':''}" onclick="setForm('priority','${p}')">${T('priority.'+p)}</button>`).join('')}</div>`)}
    ${fld('notes',T('notes'),`<textarea rows="2" onchange="setForm('notes',this.value)">${esc(form.notes)}</textarea>`)}
    <div class="field"><label>${T('photo')}</label>
      <input type="file" accept="image/*" onchange="attachPhoto(this)">
      ${form.photo?`<p class="hint">📎 ${esc(form.photo)} — ${Store.state.lang==='hi'?'डेमो में केवल फ़ाइल मेटाडेटा सुरक्षित रहता है':'demo stores file metadata/preview only'}</p>`:''}
    </div>
    <div class="field"><label class="row clickable" style="font-weight:600"><input type="checkbox" style="width:auto" ${form.gps?'checked':''} onchange="setForm('gps',this.checked)"> 📍 ${T('gps')}</label></div>
    ${est>0?routePreview(est):''}
    <div class="stack">
      <button class="btn big outline" onclick="saveAsDraft()">💾 ${T('saveDraft')}</button>
      <button class="btn big primary" onclick="submitNewReq()">📨 ${T('submitReq')}</button>
    </div>`};
};
function routePreview(est){
  if(!form.projectId||!form.materialId) return '';
  const tmp={materialId:form.materialId, projectId:form.projectId, estCost:est, qty:form.qty, unitPrice:form.unitPrice, priority:form.priority};
  const d=decideRoute(tmp);
  return `<div class="alert ${d.status==='pending_admin'?'ok':'warn'}">🧭 ${d.reasons.join(' · ')} → ${T('status.'+d.status)}</div>`;
}
function attachPhoto(inp){ if(inp.files&&inp.files[0]){ form.photo=inp.files[0].name; render(); } }
function validateForm(){
  const e={};
  if(!form.projectId) e.projectId=T('valProject');
  if(!form.materialId) e.materialId=T('valMaterial');
  if(!(+form.qty>0)) e.qty=T('valQty');
  if(!form.reason||form.reason.trim().length<10) e.reason=T('valReason');
  if(!form.requiredBy) e.requiredBy=T('valDate');
  if(!(+form.unitPrice>=0)||form.unitPrice===''||isNaN(+form.unitPrice)) e.unitPrice=T('valPrice');
  return e;
}
function saveAsDraft(){
  const e=validateForm(); delete e.reason; delete e.requiredBy; // draft needs less
  if(e.projectId||e.materialId){ Route.params._errs=e; render(); toast('warn',Object.values(e)[0],''); return; }
  const rr=saveDraft({...form, qty:+form.qty, unitPrice:+form.unitPrice, requiredBy:form.requiredBy||new Date(Date.now()+7*DAY).toISOString().slice(0,10)});
  formReset(); toast('success',T('savedDraft')+' · '+rr.id,''); goTab('requests');
}
function submitNewReq(){
  const e=validateForm();
  if(Object.keys(e).length){ Route.params._errs=e; render(); window.scrollTo(0,0); toast('danger',Object.values(e)[0],''); return; }
  Route.params._errs={};
  const r=saveDraft({...form, qty:+form.qty, unitPrice:+form.unitPrice});
  formReset();
  withLoading('submitting',800,()=>{ submitRequest(r); toast('success',T('submitted')+' — '+r.id, ''); go('request',{id:r.id}); });
}
function formReset(){ form={projectId:'',materialId:'',qty:1,unitPrice:0,reason:'',requiredBy:'',priority:'normal',notes:'',photo:null,gps:false,draftId:null}; Route.params={}; }

/* ================= REQUEST DETAILS + TIMELINE ================= */
Views.request=function(params){
  const r=S.request(params.id); if(!r) return {title:T('req'),html:emptyState('❓','Not found','')};
  const me=S.me(), st=S.stock(r.materialId), mat=S.material(r.materialId);
  const remaining=+(r.qty-r.issuedQty).toFixed(2);
  let actions='';
  if(me.role==='client'&&r.status==='pending_client'){
    actions=`<div class="row"><button id="cl-appr" class="btn grow green" onclick="decisionModal('${r.id}','approve')">✅ ${T('approve')}</button>
             <button id="cl-rej" class="btn grow red" onclick="decisionModal('${r.id}','reject')">✖ ${T('reject')}</button></div>`;
  } else if(me.role==='client'&&r.status==='pending_admin'){
    actions=`<div class="alert info">ℹ️ ${T('noActionDelegated')}</div>
      <button class="btn sm outline" onclick="decisionModal('${r.id}','approve',true)">⚠️ ${T('override')}</button>`;
  } else if(me.role==='admin'&&r.status==='pending_admin'){
    actions=`<button id="ad-open" class="btn big primary" onclick="adminApproveModal('${r.id}')">🛡️ ${T('approveUnder')}</button>`;
  } else if(me.role==='admin'&&r.status==='pending_stock'){
    actions=`<button id="verify-btn" class="btn big dark" onclick="doVerify('${r.id}')">🔎 ${T('reserveStock')}</button>`;
  } else if(me.role==='admin'&&['ready_issue','partial_issued'].includes(r.status)){
    actions=`<button id="issue-btn" class="btn big green" onclick="issueModal('${r.id}')">🚚 ${T('issueMaterial')}</button>`;
  } else if(me.role==='admin'&&r.status==='issued'){
    actions=`<div class="stack"><button class="btn big outline" onclick="markDelivered('${r.id}')">📬 ${T('deliveryDone')}</button>
      <button class="btn big dark" onclick="go('inventory')">⚖️ ${T('adjustStock')} / ${Store.state.lang==='hi'?'वापसी':'Return'}</button></div>`;
  } else if(me.role==='worker'&&r.createdBy===me.id&&['draft'].includes(r.status)){
    actions=`<div class="row"><button class="btn grow outline" onclick="editDraft('${r.id}')">✏️ ${Store.state.lang==='hi'?'संपादित करें':'Edit'}</button>
             <button class="btn grow primary" onclick="submitDraft('${r.id}')">📨 ${T('submitReq')}</button></div>`;
  } else if(me.role==='worker'&&r.createdBy===me.id&&['issued','partial_issued','delivered'].includes(r.status)){
    actions=`<button class="btn big outline" onclick="retDmgModal('${r.materialId}','return')">↩️ ${Store.state.lang==='hi'?'अतिरिक्त सामग्री वापस करें':'Return excess material'}</button>`;
  } else if(me.role==='worker'&&r.createdBy===me.id&&!['issued','partial_issued','delivered','closed','cancelled','rejected'].includes(r.status)){
    actions=`<button class="btn big outline" onclick="confirmDialog(T('cancelReq'),T('cancelConfirm'),()=>cancelRequest('${r.id}'),T('cancelReq'),true)">🚫 ${T('cancelReq')}</button>`;
  }
  const tl=(r.timeline||[]).map(ev=>`<div class="ev ${ev.kind}"><div class="tt">${esc(ev.text)}</div><div class="tm">${dt(ev.ts)} · ${esc(ev.by)}</div></div>`).join('');
  return {title:r.id, html:`
    <div class="card">
      <div class="row spread"><h2>${esc(S.matName(r.materialId))}</h2>${statusPill(r.status)}</div>
      <div class="row" style="gap:6px;margin-top:6px">${prioPill(r.priority)}${critPill(mat.crit)}<span class="pill p-grey">${r.id}</span></div>
      <div style="margin-top:10px">
        ${kv(T('selectProject'),esc(S.projName(r.projectId)))}
        ${kv(T('quantity'),qtyFmt(r.qty)+' '+mat.unit)}
        ${kv(T('unitPrice'),inr(r.unitPrice)+' / '+mat.unit)}
        ${kv(T('estTotal'),inr(r.estCost))}
        ${kv(T('requiredBy'),dOnly(r.requiredBy))}
        ${kv(T('createdBy'),esc(S.user(r.createdBy)?S.user(r.createdBy).name:'—'))}
        ${kv(T('created'),dt(r.created))}
        ${r.approvedBy?kv(T('approvedBy'),esc(S.user(r.approvedBy).name)):''}
        ${r.authority?kv(T('authorityUsed'),r.authority==='admin_delegated'?(Store.state.lang==='hi'?'एडमिन प्रत्यायोजित':'Admin delegated'):(Store.state.lang==='hi'?'क्लाइंट':'Client')):''}
        ${kv(T('issuedQty'),qtyFmt(r.issuedQty)+' / '+qtyFmt(r.qty)+' '+mat.unit)}
        ${kv(T('remainingQty'),qtyFmt(remaining)+' '+mat.unit)}
        ${r.rejectReason?`<div class="alert danger" style="margin-top:10px">✖ ${T('rejectionReason')}: ${esc(r.rejectReason)}</div>`:''}
        ${r.notes?kv(T('notes'),esc(r.notes)):''}
        ${r.photo?kv(T('photo'),'📎 '+esc(r.photo)):''}
        ${r.gps?kv(T('gps'),'📍 12.9716° N, 77.5946° E (simulated)'):''}
      </div>
      ${remaining>0&&r.issuedQty>0?`<div style="margin-top:8px">${progBar(r.issuedQty,r.qty,'green')}</div>`:''}
    </div>
    ${actions?`<div class="section">${actions}</div>`:''}
    <div class="section"><h2>${T('timeline')}</h2><div class="tl card">${tl||'<p class="muted">—</p>'}</div></div>`};
};
function editDraft(id){ Route.stack=[]; Route.view='newreq'; Route.params={editId:id,__init:true}; render(); }
/* openReq is defined in shell.js */
function submitDraft(id){ const r=S.request(id); withLoading('submitting',700,()=>{ submitRequest(r); toast('success',T('submitted'),id+' — '+r.id); go('request',{id}); }); }

/* ---------- decision modal (client) ---------- */
function decisionModal(reqId, decision, override){
  const r=S.request(reqId), mat=S.material(r.materialId);
  openSheet(`
    <h2>${decision==='approve'?'✅ '+T('approve'):'✖ '+T('reject')} · ${reqId}</h2>
    ${override?`<div class="alert danger">⚠️ ${T('overrideWarn')}</div>`:''}
    <div class="card" style="background:var(--bg);box-shadow:none">
      ${kv(T('material'),esc(S.matName(r.materialId)))}
      ${kv(T('quantity'),qtyFmt(r.qty)+' '+mat.unit)}
      ${kv(T('selectProject'),esc(S.projName(r.projectId)))}
      ${kv(T('estTotal'),inr(r.estCost))}
      ${kv(T('reason'),esc(r.reason))}
      ${kv(T('requiredBy'),dOnly(r.requiredBy))}
    </div>
    <div class="field"><label>${decision==='approve'?T('approveComment'):T('rejectReason')}</label>
      <textarea id="dc-comment" rows="3" placeholder="${decision==='reject'?(Store.state.lang==='hi'?'कारण अनिवार्य है…':'Reason is mandatory…'):(Store.state.lang==='hi'?'टिप्पणी…':'Optional comment…')}"></textarea></div>
    <button id="dc-go" class="btn big ${decision==='approve'?'green':'red'}" onclick="withLoading('approving',600,()=>{const ok=${override?`clientOverrideApprove('${reqId}','${decision}',document.getElementById('dc-comment').value)`:`clientDecide('${reqId}','${decision}',document.getElementById('dc-comment').value)`};if(ok)closeSheet();else render();})">
      ${decision==='approve'?T('approve'):T('reject')}</button>
    <button class="btn big outline" style="margin-top:8px" onclick="closeSheet()">${T('cancel')}</button>`);
}

/* ---------- admin approve modal ---------- */
function adminApproveModal(reqId){
  const r=S.request(reqId), p=S.project(r.projectId), rem=S.authRem(p.id);
  const after=rem-r.estCost, near = r.estCost > rem*0.7;
  openSheet(`
    <h2>🛡️ ${T('approveUnder')}</h2>
    <div class="card" style="background:var(--bg);box-shadow:none">
      ${kv(T('req'),r.id+' · '+esc(S.matShort(r.materialId))+' '+qtyFmt(r.qty)+' '+S.material(r.materialId).unit)}
      ${kv(T('amount'),inr(r.estCost))}
      ${kv(T('myAuthority')+' — '+T('remaining')+' ('+T('before')+')',inr(rem))}
      ${kv(T('remaining')+' ('+T('after')+')',`<span style="color:${after<0?'var(--red)':'var(--green)'}">${inr(after)}</span>`)}
    </div>
    ${near?`<div class="alert warn">⚠️ ${T('warnNearLimit')}</div>`:''}
    ${after<0?`<div class="alert danger">✖ Authority insufficient — ${T('routeClient')}</div>`:''}
    <button id="aa-confirm" class="btn big primary" ${after<0?'disabled':''} onclick="withLoading('approving',600,()=>{if(adminApprove('${reqId}'))closeSheet();else render();})">🛡️ ${T('approveUnder')}</button>
    <button class="btn big outline" style="margin-top:8px" onclick="closeSheet()">${T('cancel')}</button>`);
}

/* ---------- verify & issue ---------- */
function doVerify(reqId){ withLoading('approving',600,()=>{ verifyReserve(reqId); toast('success',T('reservedOk'),reqId); }); }
function issueModal(reqId){
  const r=S.request(reqId), st=S.stock(r.materialId), remaining=+(r.qty-r.issuedQty).toFixed(2);
  const max=Math.min(remaining,r.reservedQty,st.avail);
  openSheet(`
    <h2>🚚 ${T('issueMaterial')} · ${reqId}</h2>
    <div class="card" style="background:var(--bg);box-shadow:none">
      ${kv(T('stockReq'),qtyFmt(r.qty)+' '+st.unit)}
      ${kv(T('issuedQty'),qtyFmt(r.issuedQty)+' '+st.unit)}
      ${kv(T('stockRem'),qtyFmt(remaining)+' '+st.unit)}
      ${kv(T('stockRes'),qtyFmt(r.reservedQty)+' '+st.unit)}
      ${kv(T('stockAvail'),qtyFmt(st.avail)+' '+st.unit)}
    </div>
    <div class="field"><label>${T('issueQty')} (max ${qtyFmt(max)} ${st.unit})</label>
      <div class="stepper"><button onclick="chgIss(-1)">−</button><input id="iss-q" type="number" inputmode="decimal" value="${Math.max(0,+(+max).toFixed(2))}" max="${max}"><button onclick="chgIss(1)">+</button></div>
      <div class="hint">${T('cannotIssueMore')}</div></div>
    <button class="btn big green" onclick="withLoading('issuing',600,()=>{if(issueMaterial('${reqId}',document.getElementById('iss-q').value))closeSheet();else render();})">✔ ${T('issueMaterial')}</button>
    <button class="btn big outline" style="margin-top:8px" onclick="closeSheet()">${T('cancel')}</button>`);
  window.chgIss=d=>{const i=document.getElementById('iss-q'); i.value=Math.max(0,Math.min(max,+((+i.value||0)+d))); };
}

/* ================= CLIENT APPROVALS INBOX (action + info tabs) ================= */
let apprTab='action';
function setApprTab(t){ apprTab=t; render(); }
Views.approvals=function(){
  const act=Store.state.requests.filter(r=>r.status==='pending_client');
  const info=Store.state.requests.filter(r=>r.route==='admin'&&['pending_admin','approved_admin','pending_stock','ready_issue','partial_issued','issued','delivered'].includes(r.status));
  return {title:T('navApprovals'), html:`
    <div class="tabbar"><button class="${apprTab==='action'?'on':''}" onclick="setApprTab('action')">🔔 ${T('actionReq')} (${act.length})</button>
    <button class="${apprTab==='info'?'on':''}" onclick="setApprTab('info')">ℹ️ ${T('infoOnly')} (${info.length})</button></div>
    ${apprTab==='action'
      ? (act.length?act.map(r=>reqCard(r)).join(''):emptyState('✅',T('emptyAppr'),T('emptyApprHint')))
      : (info.length?info.map(r=>reqCard(r)).join(''):emptyState('📭',T('emptyInfo'),''))+`<div class="alert info">ℹ️ ${T('noActionDelegated')}</div>`}`};
};

/* ================= PROJECTS ================= */
Views.projects=function(){
  return {title:T('navProjects'), html: Store.state.projects.map(p=>{
    const reqs=Store.state.requests.filter(r=>r.projectId===p.id);
    const pend=reqs.filter(r=>['pending_admin','pending_client','pending_stock'].includes(r.status)).length;
    return `<div class="card clickable" onclick="go('project',{id:'${p.id}'})">
      <div class="row spread"><b>${esc(S.projName(p.id))}</b><span class="pill ${p.status==='active'?'p-green':'p-grey'}">${T('status.'+p.status)}</span></div>
      <div class="muted">📍 ${esc(p.loc)} · ${T('projectManager')}: ${esc(p.pm)}</div>
      <div style="margin-top:8px">${progBar(S.projIssued(p.id)+S.projCommitted(p.id),p.budget)}</div>
      <div class="row spread muted" style="margin-top:4px"><span class="num">${inr(S.projIssued(p.id)+S.projCommitted(p.id))} / ${inr(p.budget)}</span><span>${reqs.length} ${T('reqCount')} · ${pend} ${T('pendingCount')}</span></div>
    </div>`;}).join('')};
};
Views.project=function(params){
  const p=S.project(params.id); if(!p) return {title:'',html:''};
  const reqs=Store.state.requests.filter(r=>r.projectId===p.id);
  const purs=Store.state.purchases.filter(x=>x.projectId===p.id);
  return {title:esc(S.projName(p.id)), html:`
    <div class="card">
      <div class="row spread"><h2>${esc(S.projName(p.id))}</h2><span class="pill ${p.status==='active'?'p-green':'p-grey'}">${T('status.'+p.status)}</span></div>
      <div class="muted">📍 ${esc(p.loc)}</div>
      <div style="margin-top:8px">
        ${kv(T('projectManager'),esc(p.pm))} ${kv(T('clientOwner'),esc(p.client))}
        ${kv(T('matBudget'),inr(p.budget))} ${kv(T('usedBudget'),inr(S.projIssued(p.id)))}
        ${kv(T('limit')+' ('+T('admin')+')',inr(p.adminLimit))} ${kv(T('used'),inr(p.adminUsed))}
        ${kv(T('remaining'),inr(S.authRem(p.id)))}
        ${kv(T('reqCount'),reqs.length)} ${kv(T('purchTotal'),inr(purs.reduce((s,x)=>s+x.amount,0)))}
        ${kv(T('issuedVal'),inr(S.projIssued(p.id)))}
      </div>
    </div>
    <div class="section"><h2>${T('myRequests')}</h2>${reqs.map(r=>reqCard(r)).join('')||'<p class="muted">—</p>'}</div>`};
};

/* ================= ADMIN QUEUES ================= */
Views.adminQueue=function(){
  const q=Store.state.requests.filter(r=>r.status==='pending_admin');
  return {title:T('pendingAdminAppr'), html:`
    <div class="alert info">🛡️ ${T('myAuthority')}: ${Store.state.projects.map(p=>esc(S.projName(p.id).split(' ')[0])+' '+inr(S.authRem(p.id))).join(' · ')}</div>
    ${q.length?q.map(r=>reqCard(r)).join(''):emptyState('✅',T('emptyAppr'),T('emptyApprHint'))}`};
};
Views.verifyQueue=function(){
  const q=Store.state.requests.filter(r=>r.status==='pending_stock');
  return {title:T('pendingStockVerif'), html:`
    ${q.length?q.map(r=>{const st=S.stock(r.materialId);const free=+(st.avail-st.res).toFixed(2);const enough=free>=r.qty-r.issuedQty;
      return `<div class="item"><div class="ic">${matIcon(r.materialId)}</div><div class="grow">
        <div class="row spread"><b>${r.id} · ${esc(S.matShort(r.materialId))}</b>${enough?'<span class="pill p-green">✔</span>':'<span class="pill p-red">'+T('insufficient')+'</span>'}</div>
        <div class="s">${esc(S.projName(r.projectId))} · ${T('stockReq')} ${qtyFmt(r.qty-r.issuedQty)} ${st.unit} · ${T('stockAvail')} (free) ${qtyFmt(Math.max(0,free))} ${st.unit}</div>
        <div class="row" style="margin-top:8px"><button class="btn sm dark grow" onclick="doVerify('${r.id}')">🔎 ${T('reserveStock')}</button>
        <button class="btn sm outline" onclick="openReq('${r.id}')">${T('requestDetails')}</button></div>
      </div></div>`;}).join(''):emptyState('🔎',T('emptyStock'),'')}`};
};
Views.issue=function(){
  const q=Store.state.requests.filter(r=>['ready_issue','partial_issued'].includes(r.status));
  const recent=Store.state.requests.filter(r=>['issued','delivered'].includes(r.status)).slice(0,4);
  return {title:T('navIssue'), html:`
    <div class="section"><h2>${T('readyForIssue')} (${q.length})</h2>
    ${q.length?q.map(r=>{const st=S.stock(r.materialId);
      return `<div class="item"><div class="ic">🚚</div><div class="grow">
        <div class="row spread"><b>${r.id} · ${esc(S.matShort(r.materialId))}</b>${statusPill(r.status)}</div>
        <div class="s">${esc(S.projName(r.projectId))} · ${T('stockRes')} ${qtyFmt(r.reservedQty)} · ${T('issuedQty')} ${qtyFmt(r.issuedQty)}/${qtyFmt(r.qty)} ${st.unit}</div>
        <div class="row" style="margin-top:8px"><button class="btn sm green grow" onclick="issueModal('${r.id}')">🚚 ${T('issueMaterial')}</button>
        <button class="btn sm outline" onclick="openReq('${r.id}')">…</button></div></div></div>`;}).join(''):emptyState('🚚',T('emptyIssue'),'')}</div>
    <div class="section"><h2>${T('recentlyIssued')}</h2>${recent.map(r=>reqCard(r)).join('')}</div>`};
};

/* ================= INVENTORY ================= */
let invQ={q:'',cat:'',lowOnly:false,sort:'name'};
function setInvF(k,v){ invQ[k]=v; render(); }
Views.inventory=function(){
  const cats=[...new Set(Store.state.materials.map(m=>m.cat))];
  let ms=Store.state.materials.filter(m=>{
    const s=S.stock(m.id);
    if(invQ.q && !(m.name+m.hi+m.sku+m.cat+m.supplier).toLowerCase().includes(invQ.q.toLowerCase())) return false;
    if(invQ.cat && m.cat!==invQ.cat) return false;
    if(invQ.lowOnly && s.avail>=m.low) return false;
    return true;
  });
  ms.sort((a,b)=> invQ.sort==='avail' ? S.stock(a.id).avail-S.stock(b.id).avail : a.name.localeCompare(b.name));
  return {title:T('navInventory'), html:`
    <div class="searchbar"><span class="si">🔍</span><input placeholder="${T('search')}" value="${esc(invQ.q)}" onchange="setInvF('q',this.value)"></div>
    <div class="chips" style="margin-bottom:10px">
      <button class="chip ${!invQ.cat?'on':''}" onclick="setInvF('cat','')">${T('allStatuses')}</button>
      ${cats.map(c=>`<button class="chip ${invQ.cat===c?'on':''}" onclick="setInvF('cat','${c}')">${c}</button>`).join('')}
      <button class="chip ${invQ.lowOnly?'on':''}" style="${invQ.lowOnly?'background:var(--red);border-color:var(--red);color:#fff':''}" onclick="setInvF('lowOnly',${!invQ.lowOnly})">⚠️ ${T('lowStockItems')}</button>
      <select style="width:auto;padding:9px 12px;border-radius:22px;font-size:13px;font-weight:600" onchange="setInvF('sort',this.value)">
        <option value="name" ${invQ.sort==='name'?'selected':''}>A→Z</option><option value="avail" ${invQ.sort==='avail'?'selected':''}>${T('stockAvail')}↑</option></select>
    </div>
    ${ms.length?ms.map(m=>{const s=S.stock(m.id); const low=s.avail<m.low;
      return `<div class="item clickable" onclick="go('material',{id:'${m.id}'})"><div class="ic">${matIcon(m.id)}</div>
      <div class="grow"><div class="row spread"><b style="font-size:14px">${esc(Store.state.lang==='hi'?m.hi:m.name)}</b><span class="num small">${inr(m.cost)}</span></div>
      <div class="s">${m.sku} · ${m.cat} · ${esc(m.supplier)}</div>
      <div class="row" style="margin-top:6px;gap:6px;flex-wrap:wrap">
        <span class="pill ${low?'p-red':'p-green'}">${T('stockAvail')} ${qtyFmt(s.avail)} ${m.unit}${low?' ⚠':''}</span>
        <span class="pill p-blue">${T('stockRes')} ${qtyFmt(s.res)}</span>${critPill(m.crit)}</div>
      </div></div>`;}).join(''):emptyState('📦',T('emptyInv'),'')}
    <div class="grid2 section" style="margin-top:14px">
      <button class="btn primary" onclick="receiptModal()">📥 ${T('recordReceipt')}</button>
      <button class="btn outline" onclick="adjustModal()">⚖️ ${T('adjustStock')}</button>
    </div>`};
};
Views.material=function(params){
  const m=S.material(params.id); if(!m) return {title:'',html:''};
  const s=S.stock(m.id);
  const mvs=Store.state.movements.filter(x=>x.materialId===m.id).sort((a,b)=>b.ts.localeCompare(a.ts));
  const reqs=Store.state.requests.filter(r=>r.materialId===m.id).slice(0,5);
  return {title:esc(Store.state.lang==='hi'?m.hi:m.name), html:`
    <div class="card">
      <div class="row spread"><h2>${esc(m.name)}</h2>${critPill(m.crit)}</div>
      <div class="muted">${esc(m.hi)} · ${m.sku} · ${m.cat}</div>
      <div class="grid3" style="margin-top:12px">
        <div class="stat"><div class="v num ${s.avail<m.low?'warn':''}">${qtyFmt(s.avail)}</div><div class="l">${T('stockAvail')} (${m.unit})</div></div>
        <div class="stat"><div class="v num">${qtyFmt(s.res)}</div><div class="l">${T('stockRes')}</div></div>
        <div class="stat"><div class="v num">${qtyFmt(S.issuedTotal(m.id))}</div><div class="l">${T('stockIss')}</div></div>
      </div>
      <div style="margin-top:10px">${kv(T('perUnit'),inr(m.cost))}${kv(T('lowStockAlert'),qtyFmt(m.low)+' '+m.unit)}${kv(T('supplier'),esc(m.supplier))}</div>
      ${s.avail<m.low?`<div class="alert danger" style="margin-top:10px">⚠️ ${T('lowStockAlert')}: ${qtyFmt(s.avail)} &lt; ${qtyFmt(m.low)} ${m.unit}</div>`:''}
    </div>
    ${S.me().role==='admin'?`<div class="grid2 section">
      <button class="btn primary sm" onclick="receiptModal('${m.id}')">📥 ${T('recordReceipt')}</button>
      <button class="btn outline sm" onclick="adjustModal('${m.id}')">⚖️ ${T('adjustStock')}</button>
      <button class="btn outline sm" onclick="retDmgModal('${m.id}','return')">↩️ ${T('mtype.return')}</button>
      <button class="btn outline sm" onclick="retDmgModal('${m.id}','damage')">💥 ${T('mtype.damage')}</button>
    </div>`:''}
    <div class="section"><h2>${T('recentMovements')}</h2><div class="card divide">
      ${mvs.length?mvs.map(mvRow).join(''):emptyState('〰',T('emptyAdj'),'')}
    </div></div>
    <div class="section"><h2>${T('myRequests')}</h2>${reqs.map(r=>reqCard(r)).join('')||'<p class="muted">—</p>'}</div>`};
};
Views.movements=function(){
  const mvs=[...Store.state.movements].sort((a,b)=>b.ts.localeCompare(a.ts));
  return {title:T('recentMovements'), html:`<div class="card divide">${mvs.map(mvRow).join('')}</div>`};
};

/* ---------- receipt / adjust / return modals ---------- */
function receiptModal(pre){
  openSheet(`<h2>📥 ${T('recordReceipt')}</h2>
    <div class="field"><label>${T('material')}</label><select id="rc-mat">${Store.state.materials.map(m=>`<option value="${m.id}" ${pre===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div>
    <div class="field"><label>${T('receiptQty')}</label><input id="rc-q" type="number" inputmode="numeric" min="1" placeholder="0"></div>
    <div class="field"><label>${T('supplier')} (${T('optional')})</label><input id="rc-sup" placeholder="${Store.state.lang==='hi'?'आपूर्तिकर्ता':'Supplier'}"></div>
    <div class="field"><label>${T('receiptNote')}</label><input id="rc-note" placeholder="${Store.state.lang==='hi'?'टिप्पणी':'Note'}"></div>
    <button class="btn big primary" onclick="withLoading('loading',500,()=>{if(recordReceipt(document.getElementById('rc-mat').value,document.getElementById('rc-q').value,document.getElementById('rc-note').value,document.getElementById('rc-sup').value)){toast('success',T('confirm'),'✅');closeSheet()}})">✔ ${T('confirm')}</button>
    <button class="btn big outline" style="margin-top:8px" onclick="closeSheet()">${T('cancel')}</button>`);
}
function adjustModal(pre){
  openSheet(`<h2>⚖️ ${T('adjustStock')}</h2>
    <div class="field"><label>${T('material')}</label><select id="ad-mat">${Store.state.materials.map(m=>`<option value="${m.id}" ${pre===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div>
    <div class="field"><label>${T('adjustmentQty')}</label><input id="ad-q" type="number" inputmode="numeric" placeholder="+10 / -5"></div>
    <div class="field"><label>${T('adjReason')}</label><textarea id="ad-r" rows="2"></textarea></div>
    <button class="btn big primary" onclick="withLoading('loading',500,()=>{if(adjustStock(document.getElementById('ad-mat').value,document.getElementById('ad-q').value,document.getElementById('ad-r').value))closeSheet()})">✔ ${T('confirm')}</button>
    <button class="btn big outline" style="margin-top:8px" onclick="closeSheet()">${T('cancel')}</button>`);
}
function retDmgModal(mid,kind){
  openSheet(`<h2>${kind==='return'?'↩️ '+T('mtype.return'):'💥 '+T('mtype.damage')} · ${esc(S.material(mid).name)}</h2>
    <div class="field"><label>${T('quantity')}</label><input id="rd-q" type="number" inputmode="numeric" min="1"></div>
    <div class="field"><label>${T('note')}</label><input id="rd-n"></div>
    <button class="btn big ${kind==='return'?'green':'red'}" onclick="withLoading('loading',500,()=>{if(reportReturnDamage('${mid}',document.getElementById('rd-q').value,'${kind}',document.getElementById('rd-n').value)){toast('success',kind==='return'?T('returnReport'):T('damageReport'),'');closeSheet()}})">✔ ${T('confirm')}</button>
    <button class="btn big outline" style="margin-top:8px" onclick="closeSheet()">${T('cancel')}</button>`);
}

/* ================= ACCOUNTS: EXPENSES & PURCHASES ================= */
let expTab='issuance';
function setExpTab(t){expTab=t;render();}
Views.expenses=function(){
  const issuedRows=Store.state.requests.filter(r=>r.issuedQty>0);
  const committed=Store.state.requests.filter(r=>['pending_admin','pending_client','approved_admin','approved_client','pending_stock','ready_issue','partial_issued'].includes(r.status));
  return {title:T('navExpenses'), html:`
    <div class="tabbar">${[['issuance',T('issuedValue')],['purchase',T('totalPurchases')],['commit',T('committedCost')]].map(([k,l])=>`<button class="${expTab===k?'on':''}" onclick="setExpTab('${k}')">${l}</button>`).join('')}</div>
    ${expTab==='issuance'?`
      <div class="alert info">ℹ️ ${Store.state.lang==='hi'?'वितरण प्रविष्टियाँ स्टॉक इश्यू से आती हैं — खरीद से अलग (डबल काउंटिंग नहीं)।':'Issuance entries come from stock issues — separate from purchases (no double-counting).'}</div>
      ${issuedRows.map(r=>`<div class="item"><div class="ic">📤</div><div class="grow"><div class="t">${r.id} · ${esc(S.matShort(r.materialId))}</div>
        <div class="s">${esc(S.projName(r.projectId))} · ${qtyFmt(r.issuedQty)} ${S.material(r.materialId).unit} @ ${inr(r.unitPrice)}</div></div>
        <b class="num">${inr(r.issuedQty*r.unitPrice)}</b></div>`).join('')}
      <div class="card row spread"><b>${T('total')}</b><b class="num">${inr(S.issuedValueAll())}</b></div>`
    :expTab==='purchase'?`
      ${Store.state.purchases.map(purRow).join('')}
      <div class="card row spread"><b>${T('total')}</b><b class="num">${inr(S.purchTotal())}</b></div>`
    :`<p class="muted" style="margin-bottom:8px">${T('estimated')}:</p>
      ${committed.map(r=>`<div class="item"><div class="ic">🧾</div><div class="grow"><div class="t">${r.id} · ${esc(S.matShort(r.materialId))} × ${qtyFmt(r.qty)}</div>
        <div class="s">${esc(S.projName(r.projectId))}</div></div><div class="right">${statusPill(r.status)}<div class="bold num">${inr((r.qty-r.issuedQty)*r.unitPrice)}</div></div></div>`).join('')}
      <div class="card row spread"><b>${T('committedCost')}</b><b class="num">${inr(S.committedAll())}</b></div>`}`};
};
function purRow(p){
  return `<div class="item"><div class="ic">🧾</div><div class="grow">
    <div class="row spread"><b style="font-size:13.5px">${p.invoice}</b><span class="pill ${p.status==='paid'?'p-green':'p-amber'}">${T('status.'+p.status)}</span></div>
    <div class="s">${esc(p.supplier)} · ${esc(S.matShort(p.materialId))} ${qtyFmt(p.qty)} @ ${inr(p.unitCost)}</div>
    <div class="s">${esc(S.projName(p.projectId))} · ${dOnly(p.date)}</div></div>
    <div class="right"><b class="num">${inr(p.amount)}</b>
    ${p.status==='pending'&&S.me().role==='accounts'?`<button class="btn sm green" style="margin-top:4px" onclick="markPurchasePaid('${p.id}')">${T('status.paid')} ✓</button>`:''}</div></div>`;
}
let purQ={q:'',proj:'',status:''};
function setPurF(k,v){purQ[k]=v;render();}
Views.purchases=function(){
  let ps=Store.state.purchases.filter(p=>{
    if(purQ.q && !(p.invoice+p.supplier+S.material(p.materialId).name).toLowerCase().includes(purQ.q.toLowerCase())) return false;
    if(purQ.proj && p.projectId!==purQ.proj) return false;
    if(purQ.status && p.status!==purQ.status) return false;
    return true;});
  return {title:T('navPurchases'), html:`
    <div class="searchbar"><span class="si">🔍</span><input placeholder="${T('search')}" value="${esc(purQ.q)}" onchange="setPurF('q',this.value)"></div>
    <div class="chips" style="margin-bottom:10px">
      <select style="width:auto;padding:9px 12px;border-radius:22px;font-size:13px;font-weight:600" onchange="setPurF('proj',this.value)">
        <option value="">${T('allProjects')}</option>${Store.state.projects.map(p=>`<option value="${p.id}" ${purQ.proj===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select>
      <select style="width:auto;padding:9px 12px;border-radius:22px;font-size:13px;font-weight:600" onchange="setPurF('status',this.value)">
        <option value="">${T('all')}</option><option value="paid" ${purQ.status==='paid'?'selected':''}>${T('paid')}</option><option value="pending" ${purQ.status==='pending'?'selected':''}>${T('pending')}</option></select>
    </div>
    ${S.me().role==='accounts'||S.me().role==='admin'?`<button class="btn primary big" style="margin-bottom:12px" onclick="purchaseModal()">➕ ${T('addPurchase')}</button>`:''}
    ${ps.length?ps.map(purRow).join(''):emptyState('🧾',T('emptyPurch'),'')}
    <div class="card row spread"><b>${T('pendingInvoices')}</b><b class="num" style="color:var(--red)">${inr(S.pendingInvoiceTotal())}</b></div>`};
};
function purchaseModal(){
  openSheet(`<h2>🧾 ${T('addPurchase')}</h2>
    <div class="field"><label>${T('selectProject')}</label><select id="pu-proj">${Store.state.projects.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
    <div class="field"><label>${T('material')}</label><select id="pu-mat">${Store.state.materials.map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div>
    <div class="field"><label>${T('supplier')}</label><input id="pu-sup"></div>
    <div class="field"><label>${T('invoiceNo')}</label><input id="pu-inv" placeholder="INV/2026/000"></div>
    <div class="field"><label>${T('invDate')}</label><input id="pu-date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
    <div class="row"><div class="field grow"><label>${T('quantity')}</label><input id="pu-q" type="number" inputmode="numeric" min="1"></div>
    <div class="field grow"><label>${T('unitPrice')}</label><input id="pu-uc" type="number" inputmode="decimal" min="0"></div></div>
    <div class="field"><label>${Store.state.lang==='hi'?'स्थिति':'Status'}</label><select id="pu-st"><option value="pending">${T('status.pending')}</option><option value="paid">${T('status.paid')}</option></select></div>
    <div class="field"><label>${T('note')}</label><input id="pu-note"></div>
    <button class="btn big primary" onclick="submitPurchase()">✔ ${T('addPurchase')}</button>
    <button class="btn big outline" style="margin-top:8px" onclick="closeSheet()">${T('cancel')}</button>`);
}
function submitPurchase(){
  const f={projectId:document.getElementById('pu-proj').value, materialId:document.getElementById('pu-mat').value,
    supplier:document.getElementById('pu-sup').value.trim(), invoice:document.getElementById('pu-inv').value.trim(),
    date:document.getElementById('pu-date').value, qty:+document.getElementById('pu-q').value,
    unitCost:+document.getElementById('pu-uc').value, status:document.getElementById('pu-st').value,
    note:document.getElementById('pu-note').value};
  if(!f.supplier||!f.invoice||!(f.qty>0)||!(f.unitCost>=0)){ toast('danger',T('positiveQty')+' / '+T('invoiceNo'),''); return; }
  withLoading('loading',500,()=>{ addPurchase(f); toast('success',T('purchaseSaved'),inr(f.qty*f.unitCost)); closeSheet(); });
}

/* ================= REPORTS ================= */
Views.reports=function(){
  const byStatus={}; Store.state.requests.forEach(r=>byStatus[r.status]=(byStatus[r.status]||0)+1);
  const topReq={},topIss={};
  Store.state.requests.forEach(r=>topReq[r.materialId]=(topReq[r.materialId]||0)+r.qty*S.material(r.materialId).cost);
  Store.state.movements.filter(m=>m.type==='issue').forEach(m=>topIss[m.materialId]=(topIss[m.materialId]||0)+(m.valueImpact||0));
  const tR=Object.entries(topReq).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>({l:S.matShort(k),v}));
  const tI=Object.entries(topIss).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>({l:S.matShort(k),v}));
  const supp={}; Store.state.purchases.forEach(p=>supp[p.supplier]=(supp[p.supplier]||0)+p.amount);
  const pendInv=Store.state.purchases.filter(p=>p.status==='pending');
  const ret=Store.state.movements.filter(m=>m.type==='return').reduce((s,m)=>s+m.valueImpact,0);
  const dmg=Store.state.movements.filter(m=>m.type==='damage'||m.type==='adjustment'&&m.availDelta<0).reduce((s,m)=>s+Math.abs(m.valueImpact||0),0);
  const lows=S.lowStock();
  return {title:T('reportTitle'), html:`
    <div class="card"><h3>${T('reqDist')}</h3><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
      ${Object.entries(byStatus).map(([k,v])=>statusPill(k)+' <b class="num">'+v+'</b>').join('<span style="width:8px"></span>')}</div></div>
    <div class="card"><h3>${T('byProject')}</h3>${barChart(Store.state.projects.map(p=>({l:S.projName(p.id),v:Store.state.requests.filter(r=>r.projectId===p.id).length,f:Store.state.requests.filter(r=>r.projectId===p.id).length+' '+T('count')})),'var(--indigo)')}</div>
    <div class="card"><h3>${T('pendingByRole')}</h3>
      ${kv('👷 '+T('worker')+' → '+T('admin'),Store.state.requests.filter(r=>r.status==='pending_admin').length+'')}
      ${kv('👷 '+T('worker')+' → '+T('client'),Store.state.requests.filter(r=>r.status==='pending_client').length+'')}
      ${kv('📦 '+T('pendingStockVerif'),Store.state.requests.filter(r=>r.status==='pending_stock').length+'')}
      ${kv('🚚 '+T('readyForIssue'),Store.state.requests.filter(r=>['ready_issue','partial_issued'].includes(r.status)).length+'')}</div>
    <div class="card"><h3>${T('topRequested')}</h3>${barChart(tR)}</div>
    <div class="card"><h3>${T('topIssued')}</h3>${barChart(tI,'var(--green)')}</div>
    <div class="card"><h3>${T('lowStock')}</h3>${lows.length?lows.map(m=>{const s=S.stock(m.id);return `<div class="mthr"><span>${esc(m.name)}</span><b class="num" style="color:var(--red)">${qtyFmt(s.avail)} / ${qtyFmt(m.low)} ${m.unit}</b></div>`;}).join(''):'✅'}</div>
    <div class="card"><h3>${T('estByProject')} / ${T('issuedByProject')}</h3>
      ${Store.state.projects.map(p=>`<div class="mthr"><span>${esc(S.projName(p.id))}</span><span class="num small">${inr(S.projEstimate(p.id))} → <b style="color:var(--green)">${inr(S.projIssued(p.id))}</b></span></div>`).join('')}</div>
    <div class="card"><h3>${T('purchBySupp')}</h3>${barChart(Object.entries(supp).map(([l,v])=>({l,v})),'var(--blue)')}</div>
    <div class="card"><h3>${T('pendInv')}</h3>${pendInv.map(p=>`<div class="mthr"><span>${p.invoice} · ${esc(p.supplier)}</span><b class="num" style="color:var(--red)">${inr(p.amount)}</b></div>`).join('')||'✅'}</div>
    <div class="card"><h3>${T('authorityUtil')}</h3>${barChart(Store.state.projects.map(p=>({l:S.projName(p.id).split(' ').slice(0,2).join(' '),v:p.adminUsed,f:Math.round(100*p.adminUsed/(p.adminLimit||1))+'%'})))}</div>
    <div class="card"><h3>${T('commitVsActual')}</h3>${barChart([{l:T('estimated'),v:S.committedAll()},{l:T('actual'),v:S.issuedValueAll()}])}</div>
    <div class="card"><h3>${T('wastage')}</h3>${kv('↩️ '+T('mtype.return'),inr(ret))}${kv('💥 '+T('mtype.damage'),inr(dmg))}</div>
    <div class="card"><h3>${T('monthlySummary')}</h3>${barChart(S.monthlyExpenses().map(([k,v])=>{const[y,m]=k.split('-');return{l:T('monthNames')[+m-1]+' '+y,v}}),'var(--accent)')}</div>`};
};

/* ================= PROFILE ================= */
Views.profile=function(){
  const me=S.me();
  return {title:T('profile'), html:`
    <div class="card" style="text-align:center">
      <div style="font-size:44px">${me.pin}</div><h2>${esc(me.name)}</h2>
      <div class="muted">${T(me.role)} · ${esc(me.title)}</div>
      <span class="pill p-amber" style="margin-top:8px">${T('demo')}</span>
    </div>
    <div class="card divide">
      <div class="mthr"><span>🌐 ${T('language')}</span>
        <div class="row" style="gap:6px"><button class="chip ${Store.state.lang!=='hi'?'on':''}" onclick="if(Store.state.lang!=='en')toggleLang()">EN</button>
        <button class="chip ${Store.state.lang==='hi'?'on':''}" onclick="if(Store.state.lang!=='hi')toggleLang()">हिन्दी</button></div></div>
      <div class="mthr"><span>🔄 ${T('switchRole')}</span><button class="btn sm dark" onclick="switchRole()">${T('switchRole')} →</button></div>
      <div class="mthr"><span>🔔 ${T('notifPerm')}</span><button class="btn sm outline" onclick="askNotifPermission()">${T('enablePush')}</button></div>
      <div class="mthr"><span>📊 ${T('reports')}</span><button class="btn sm outline" onclick="go('reports')">${T('viewReports')}</button></div>
    </div>
    <div class="card">
      <h3>⚠️ ${T('limitations')}</h3>
      <p class="small" style="color:var(--ink2);margin-top:8px">${T('limitsList')}</p>
    </div>
    <div class="stack">
      <button class="btn big outline" style="color:var(--red)" onclick="confirmDialog(T('resetDemo'),T('resetConfirm'),()=>withLoading('resetting',900,()=>{Store.reset();Route.view='login';Route.stack=[];render();toast('success',T('demoReset'),'')},true),T('resetDemo'),true)">🗑️ ${T('resetDemo')}</button>
      <button class="btn big red" onclick="logout()">🚪 ${T('logout')}</button>
    </div>
    <p class="muted" style="text-align:center;margin-top:14px">${T('appName')} ${T('demo')} v1.0 · ${T('disclaimer')}</p>`};
};
