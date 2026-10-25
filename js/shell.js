/* ============ Router + app shell + login + shared components ============ */
const NAVS = {
  worker:[['home','🏠','navHome'],['requests','📋','navRequests'],['newreq','➕','navNew'],['profile','👤','navProfile']],
  client:[['home','🏠','navHome'],['approvals','✅','navApprovals'],['projects','🏗️','navProjects'],['profile','👤','navProfile']],
  admin:[['home','🏠','navHome'],['inventory','📦','navInventory'],['issue','🚚','navIssue'],['profile','👤','navProfile']],
  accounts:[['home','🏠','navHome'],['expenses','💰','navExpenses'],['purchases','🧾','navPurchases'],['profile','👤','navProfile']]
};
const Route = {view:'login', params:{}, stack:[]};
function go(view, params){ const u=S.me(); Route.stack.push({view:Route.view,params:Route.params}); Route.view=view; Route.params=params||{}; render(); }
function back(){ if(Route.stack.length){const p=Route.stack.pop(); Route.view=p.view; Route.params=p.params;} else if(Store.state.session){Route.view='home';Route.params={};} else Route.view='login'; render(); }
let loadingBusy=false;
function withLoading(labelKey, ms, fn){
  loadingBusy=true; renderShell(labelKey);
  setTimeout(()=>{ loadingBusy=false; fn(); }, ms);
}

/* ---------- shared component helpers ---------- */
function statusPill(st){
  const map={'draft':'grey','submitted':'grey','pending_admin':'amber','pending_client':'amber','approved_admin':'blue','approved_client':'green','rejected':'red','pending_stock':'amber','ready_issue':'green','partial_issued':'indigo','issued':'dgreen','delivered':'dgreen','pending_purchase':'amber','cancelled':'dgrey','closed':'dgrey'};
  return `<span class="pill p-${map[st]||'grey'}">${T('status.'+st)}</span>`;
}
function prioPill(p){ const m={normal:'grey',urgent:'amber',critical:'red'}; return `<span class="pill p-${m[p]}">${T('priority.'+p)}</span>`; }
function critPill(c){ const m={low:'grey',medium:'blue',high:'red'}; return `<span class="pill p-${m[c]}">${T('criticality.'+c)}</span>`; }
function reqCard(r, opts){
  const o=opts||{}, st=S.stock(r.materialId), overdue = new Date(r.requiredBy)<Date.now() && !['issued','delivered','closed','cancelled','rejected'].includes(r.status);
  return `<div class="item clickable" onclick="openReq('${r.id}')">
    <div class="ic">${matIcon(r.materialId)}</div>
    <div class="grow">
      <div class="row spread"><b style="font-size:14px">${esc(S.matShort(r.materialId))} · ${qtyFmt(r.qty)} ${st.unit}</b><span class="muted num">${r.id}</span></div>
      <div class="s">${esc(S.projName(r.projectId))} · ${inr(r.estCost)}</div>
      <div class="row" style="margin-top:6px;flex-wrap:wrap;gap:6px">${statusPill(r.status)}${prioPill(r.priority)}
        ${overdue?`<span class="pill p-red">⏰ ${T('overdue')}</span>`:''}
        ${o.showMine&&r.createdBy===S.me().id?'':''}</div>
    </div></div>`;
}
function matIcon(mid){ const m=S.material(mid); const ic={'Cement':'🧱','Steel':'🔩','Aggregates':'⛰️','Masonry':'🧱','Electrical':'⚡','Plumbing':'🚿','Paint':'🎨','Finishing':'🖌️','Tools':'🛠️'}; return ic[m.cat]||'📦'; }
function emptyState(icon,title,hint,btnHtml){
  return `<div class="empty"><div class="e">${icon}</div><div class="t">${title}</div><p>${hint||''}</p>${btnHtml||''}</div>`;
}
function barChart(rows,color){
  const max=Math.max(...rows.map(x=>x.v),1);
  return `<div class="bar-chart">${rows.map(x=>`<div class="brow"><div class="bl">${esc(x.l)}</div><div class="bt"><i style="width:${Math.round(100*x.v/max)}%;${color?`background:${color}`:''}"></i></div><div class="bv num">${x.f||inr(x.v)}</div></div>`).join('')}</div>`;
}
function progBar(v,max,cls){ const pct=Math.min(100,Math.round(100*v/(max||1))); return `<div class="prog ${cls||''}"><i style="width:${pct}%"></i></div>`; }
function kv(k,v){ return `<div class="kv"><span class="k">${k}</span><span class="v num">${v}</span></div>`; }

/* ---------- modal / sheet engine ---------- */
let sheetOpen=false;
function openSheet(html){ sheetOpen=true; const ov=document.createElement('div'); ov.className='overlay'; ov.id='ovl';
  ov.innerHTML=`<div class="sheet"><div class="grab"></div>${html}</div>`;
  ov.addEventListener('click',e=>{ if(e.target===ov) closeSheet(); });
  document.getElementById('app').appendChild(ov); }
function openDialog(html){ sheetOpen=true; const ov=document.createElement('div'); ov.className='overlay center'; ov.id='ovl';
  ov.innerHTML=`<div class="dialog">${html}</div>`; document.getElementById('app').appendChild(ov); }
function closeSheet(){ sheetOpen=false; const o=document.getElementById('ovl'); if(o)o.remove(); }
function confirmDialog(title,msg,onYes,yesLabel,danger){
  window._confirmFn=onYes;
  openDialog(`<h3>${esc(title)}</h3><p style="margin:10px 0 16px;color:var(--ink2);font-size:14px">${msg}</p>
   <div class="row"><button class="btn grow outline" onclick="closeSheet()">${T('cancel')}</button>
   <button class="btn grow ${danger?'red':'primary'}" onclick="window._confirmFn();closeSheet()">${yesLabel||T('confirm')}</button></div>`);
}

/* ---------- top bar & nav ---------- */
function topbar(title){
  const me=S.me(), unread=me?S.unread(me.role):0;
  return `<div class="topbar">
    ${Route.view!=='home'&&Route.view!=='login'?`<button class="iconbtn" onclick="back()">←</button>`:''}
    <div class="title">${esc(title)} <span class="demo-badge">${T('demo')}</span></div>
    ${me?`<span class="rolechip">${me.pin} ${T(me.role)}</span>`:''}
    <button class="iconbtn" onclick="go('notifications')">🔔${unread?`<span class="nbadge">${unread}</span>`:''}</button>
  </div>`;
}
function botnav(){
  const me=S.me(); if(!me) return '';
  const items=NAVS[me.role];
  return `<div class="botnav">${items.map(([v,i,k])=>`<button class="${Route.view===v?'on':''}" onclick="goTab('${v}')"><span class="i">${i}</span>${T(k)}</button>`).join('')}</div>
   ${me.role==='worker'&&Route.view!=='newreq'?`<button class="fab" onclick="goTab('newreq')">+</button>`:''}`;
}
function goTab(v){ Route.stack=[]; Route.view=v; Route.params={}; render(); }

/* ---------- LOGIN ---------- */
function loginScreen(){
  const lang=Store.state.lang||'en';
  return `<div class="login">
    <div class="row spread"><span class="demo-badge" style="visibility:hidden">.</span>
      <button class="link" style="color:#cbd5e1" onclick="toggleLang()">${lang==='en'?'हिन्दी':'English'}</button></div>
    <div class="logo">🏗️</div>
    <h1>${T('appName')} <span class="demo-badge">${T('demo')}</span></h1>
    <div class="sub">${T('tagline')}</div>
    <div style="margin-top:22px;font-weight:700;font-size:13px;color:#cbd5e1;text-transform:uppercase;letter-spacing:.6px">${T('chooseRole')}</div>
    <div style="margin-top:12px">
      ${Store.state.users.map(u=>`<div class="rolecard" onclick="doLogin('${u.id}')">
        <div class="ri">${u.pin}</div>
        <div><div class="rr">${T(u.role)}</div><div class="rn">${u.name}</div><div class="rd">${T(u.role+'Desc')} · ${u.title}</div></div>
      </div>`).join('')}
    </div>
    <div class="disclaimer">⚠️ ${T('disclaimer')}<br>${T('session')}</div>
  </div>`;
}
function doLogin(userId){
  withLoading('loading',700,()=>{ Store.login(userId); Route.stack=[]; Route.view='home'; Route.params={}; render();
    toast('success', T('signedInAs'), S.me().name+' — '+T(S.me().role)); });
}
function toggleLang(){ Store.setLang((Store.state.lang||'en')==='en'?'hi':'en'); render(); toast('info',T('langChanged'),''); }
function switchRole(){ Store.logout(); Route.view='login'; Route.stack=[]; render(); }
function logout(){ confirmDialog(T('logout'), T('loggedOut')+'?', ()=>{ Store.logout(); Route.view='login'; Route.stack=[]; render(); toast('info',T('loggedOut'),''); }); }

/* ---------- shell ---------- */
function renderShell(labelKey){
  const app=document.getElementById('app');
  app.innerHTML = labelKey ? `${topbar(T('appName'))}<div class="page no-nav"><div class="loading-wrap"><div class="spinner"></div>${T(labelKey)}</div></div>` : '';
}
function render(){
  if(loadingBusy) return;
  try{ _render(); }catch(e){ console.error(e);
    document.getElementById('app').innerHTML = `${topbar('Error')}<div class="page"><div class="alert danger">⚠️ ${esc(e.message)}<br><button class="btn sm outline" onclick="Store.reset();Route.view='login';render()">Reset demo</button></div></div>`;
  }
}
function _render(){
  const app=document.getElementById('app');
  const me=S.me();
  if(!Store.state.session){ app.innerHTML=loginScreen(); return; }
  let body='', title=T('appName');
  const V=Views[Route.view];
  if(V){ const r=V(Route.params)||{}; body=r.html||''; title=r.title||T('appName'); }
  app.innerHTML = `${topbar(title)}<div class="page ${sheetOpen?'':''}">${body}</div>${botnav()}<div class="flag-demo">DEMO • FICTIONAL DATA</div>`;
}

/* ---------- notifications screen ---------- */
let notifFilter='all';
function setNotifFilter(f){ notifFilter=f; render(); }
Views = {}; // populated by views.js
Views.notifications=function(){
  const me=S.me(), all=S.notifs(me.role);
  const list=all.filter(n=> notifFilter==='all'?true : notifFilter==='unread'?!n.read : notifFilter==='action'?n.type==='action' : n.type==='info');
  const cnt=t=>all.filter(n=>t==='unread'?!n.read:n.type===t).length;
  const tabs=[['all',T('all'),all.length],['unread',T('unread'),cnt('unread')],['action',T('actionReq'),cnt('action')],['info',T('infoOnlyF'),cnt('info')]];
  return {title:T('notifCentre'), html:`
    <div class="row spread" style="margin-bottom:10px">
      <div class="chips" style="flex:1">${tabs.map(([k,l,c])=>`<button class="chip ${notifFilter===k?'on':''}" onclick="setNotifFilter('${k}')">${l}${c?` (${c})`:''}</button>`).join('')}</div>
      <button class="btn sm outline" onclick="markAllRead('${me.role}')">${T('markAllRead')}</button>
    </div>
    <div class="card divide">
      ${list.length?list.map(n=>`<div class="notif ${n.read?'read':''} clickable" onclick="notifTap('${n.id}')">
        <div class="dot"></div>
        <div class="grow"><div class="nt">${TYPE_ICON[n.type]||''} ${esc(n.title)}<span class="type-tag tt-${n.type}">${n.type==='action'?T('actionReq'):n.type==='info'?T('infoOnlyF'):n.type==='alert'?'ALERT':n.type==='success'?'SUCCESS':'WARNING'}</span></div>
        <div class="nb">${esc(n.body)}</div><div class="nm">${timeAgo(n.ts)} · ${dt(n.ts)}</div></div>
      </div>`).join(''):emptyState('🔕',T('noNotifs'),T('noNotifsHint'))}
    </div>`};
};
function notifTap(id){ markRead(id); const n=Store.state.notifications.find(x=>x.id===id);
  if(n&&n.link){ if(n.link.startsWith('REQ-')) openReq(n.link); else if(n.link.startsWith('PUR-')) go('purchases'); else if(n.link.startsWith('M-')) go('material',{id:n.link}); else if(n.link.startsWith('P-')) go('project',{id:n.link}); }
  else render(); }

function openReq(id){ const r=S.request(id);
  if(r&&r.status==='draft'&&S.me()&&S.me().role==='worker'){ Route.stack=[]; Route.view='newreq'; Route.params={editId:id,__init:true}; render(); }
  else go('request',{id}); }
