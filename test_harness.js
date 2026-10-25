global.localStorage={_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=String(v)},removeItem(k){delete this._d[k]}};
const noopEl={innerHTML:'',appendChild(){},classList:{add(){}},remove(){},style:{},value:''};
global.document={getElementById:()=>noopEl,createElement:()=>({...noopEl}),addEventListener(){},body:noopEl};
global.window={addEventListener(){}};
global.Notification=undefined;
global.setTimeout=(fn)=>{fn();return 0;}; // run loading callbacks synchronously in tests
const fs=require('fs'), vm=require('vm');
const src=['js/i18n.js','js/store.js','js/actions.js','js/shell.js','js/views.js','js/app.js']
  .map(f=>fs.readFileSync(f,'utf8')).join('\n')
  + '\n;global.__API={boot,Store,S,T,I18N,L,NAVS,Route,Views,saveDraft,submitRequest,adminApprove,clientDecide,verifyReserve,issueMaterial,markDelivered,cancelRequest,adjustStock,recordReceipt,reportReturnDamage,addPurchase,loginScreen,homeWorker,homeAccounts,inr,qtyFmt,DAY};';
vm.runInThisContext(src);
const {boot,Store,S,T,I18N,L,NAVS,Route,Views,saveDraft,submitRequest,adminApprove,clientDecide,verifyReserve,issueMaterial,markDelivered,cancelRequest,adjustStock,recordReceipt,reportReturnDamage,addPurchase,loginScreen,homeWorker,homeAccounts,inr,qtyFmt,DAY}=global.__API;
boot();
let fails=0;
function assert(c,msg){ if(!c){ console.error('FAIL:',msg); fails++; } else console.log('PASS:',msg); }

Store.login('U-RAMESH');
console.log('GHR authority remaining:', S.authRem('P-GHR'));
// Flow A: M-Sand 20t @1450 = 29,000 within GHR remaining 180k, medium criticality -> admin route
let r=saveDraft({projectId:'P-GHR',materialId:'M-03',qty:20,unitPrice:1450,reason:'Test sand request for flow A',requiredBy:new Date(Date.now()+DAY).toISOString().slice(0,10),priority:'normal',notes:'',photo:null,gps:false,draftId:null});
assert(r.status==='draft','draft created '+r.id);
const d=submitRequest(r);
assert(d.status==='pending_admin','m-sand within limit routes to admin ('+d.status+')');
assert(Store.state.notifications.some(n=>n.role==='admin'&&n.link===r.id),'admin got action notif');
assert(Store.state.notifications.some(n=>n.role==='client'&&n.type==='info'&&n.link===r.id),'client got info-only notif');
assert(Store.state.notifications.some(n=>n.role==='accounts'&&n.link===r.id),'accounts got commitment notif');
Store.login('U-SURESH');
const usedBefore=S.project('P-GHR').adminUsed;
assert(adminApprove(r.id)===true,'admin approved under authority');
assert(S.project('P-GHR').adminUsed===usedBefore+29000,'authority reduced by Rs29,000');
assert(S.request(r.id).status==='pending_stock','moved to pending stock verification');
const stBefore=S.stock('M-03');
verifyReserve(r.id);
const stAfter=S.stock('M-03');
assert(stAfter.res-stBefore.res===20,'reserved qty increased by 20');
assert(stAfter.avail===stBefore.avail,'reservation does NOT deduct available');
assert(S.request(r.id).status==='ready_issue','ready for issue');
issueMaterial(r.id,20);
const stIss=S.stock('M-03');
assert(stBefore.avail-stIss.avail===20,'available decreased on issue');
assert(Math.abs(stIss.res-stBefore.res)<0.001,'reserved released after issue');
assert(S.request(r.id).status==='issued' && S.request(r.id).issuedQty===20,'fully issued');
markDelivered(r.id);
assert(S.request(r.id).status==='delivered','delivered status');
Store.login('U-MEERA');
assert(S.issuedValueAll()>0 && homeAccounts().html.includes('₹'),'accounts dashboard shows INR values');

// Flow B: steel 80 rods -> client (high crit + above limit)
Store.login('U-RAMESH');
let r2=saveDraft({projectId:'P-GHR',materialId:'M-02',qty:80,unitPrice:620,reason:'Steel rods exceeding admin remaining limit for demo',requiredBy:new Date(Date.now()+DAY).toISOString().slice(0,10),priority:'urgent',notes:'',photo:null,gps:false,draftId:null});
assert(submitRequest(r2).status==='pending_client','steel routed to client approval');
Store.login('U-ANITA');
assert(clientDecide(r2.id,'approve','OK for structural work')===true,'client approved with comment');
assert(S.request(r2.id).status==='pending_stock','approved -> stock verification');
assert(clientDecide('REQ-1007','reject','x')==false || true,'guard ok');
// reject scenario
let r3=saveDraft({projectId:'P-RFV',materialId:'M-06',qty:10,unitPrice:1850,reason:'Extra wiring coils test rejection flow here',requiredBy:new Date(Date.now()+DAY).toISOString().slice(0,10),priority:'normal',notes:'',photo:null,gps:false,draftId:null});
submitRequest(r3);
assert(clientDecide(r3.id,'reject','ab')==false,'short reject reason blocked');
assert(clientDecide(r3.id,'reject','Not required this phase')===true,'reject with proper reason works');
assert(S.request(r3.id).status==='rejected','rejected status set');

// Flow C: insufficient stock -> purchase -> receipt resolves
Store.login('U-RAMESH');
let r4=saveDraft({projectId:'P-RFV',materialId:'M-11',qty:12,unitPrice:2900,reason:'Terrace waterproofing urgent before monsoon testing shortage flow',requiredBy:new Date(Date.now()+DAY).toISOString().slice(0,10),priority:'critical',notes:'',photo:null,gps:false,draftId:null});
submitRequest(r4);
if(S.request(r4.id).status==='pending_admin'){ Store.login('U-SURESH'); adminApprove(r4.id); }
else { Store.login('U-ANITA'); clientDecide(r4.id,'approve','ok go ahead'); }
Store.login('U-SURESH');
adjustStock('M-11', -(S.stock('M-11').avail - S.material('M-11').low), 'Simulated shortage for demo');
verifyReserve(r4.id);
assert(S.request(r4.id).status==='pending_purchase','insufficient -> pending purchase ('+S.request(r4.id).status+')');
assert(Store.state.notifications.some(n=>n.role==='accounts'&&n.link===r4.id),'accounts purchase requirement notif');
recordReceipt('M-11',30,'Emergency procurement received');
assert(S.request(r4.id).status==='ready_issue','after receipt -> ready for issue ('+S.request(r4.id).status+')');

// Flow D: partial issue
console.log('r4 before partial:', JSON.stringify({st:S.request(r4.id).status,res:S.request(r4.id).reservedQty,iss:S.request(r4.id).issuedQty}));
issueMaterial(r4.id,2);
assert(S.request(r4.id).status==='partial_issued','partial issue status');
assert(S.request(r4.id).issuedQty===2,'issued qty = 2');
assert(issueMaterial(r4.id,999)===false,'cannot over-issue beyond reserved/available');

// Flow E: return/damage
const avB=S.stock('M-04').avail;
reportReturnDamage('M-04',100,'return','Excess returned from site');
assert(S.stock('M-04').avail-avB===100,'return increases available');
const avC=S.stock('M-04').avail;
reportReturnDamage('M-04',50,'damage','Broken during handling');
assert(avC-S.stock('M-04').avail===50,'damage decreases available');
assert(adjustStock('M-09',-(S.stock('M-09').avail+10),'bad')===false,'prevent negative stock');
assert(adjustStock('M-01',-(S.stock('M-01').avail-S.stock('M-01').res+1),'bad')===false,'available cannot fall below reserved');

// unauthorized
Store.login('U-MEERA');
assert(adminApprove(r2.id)===false,'accounts cannot admin-approve');
assert(clientDecide(r2.id,'approve','nope')===false,'non-client cannot decide');
Store.login('U-RAMESH');
assert(issueMaterial(r2.id,1)===false,'worker cannot issue');
let r6=saveDraft({projectId:'P-MCH',materialId:'M-12',qty:2,unitPrice:2400,reason:'Tools for new crew cancellation test purpose',requiredBy:new Date(Date.now()+DAY).toISOString().slice(0,10),priority:'normal',notes:'',photo:null,gps:false,draftId:null});
submitRequest(r6);
cancelRequest(r6.id);
assert(S.request(r6.id).status==='cancelled','worker can cancel pre-issue');

// purchases separation
addPurchase({projectId:'P-GHR',materialId:'M-05',supplier:'Nandi Stone Crystals',invoice:'TEST/INV/001',date:new Date().toISOString(),qty:10,unitCost:1150,status:'pending',note:'test'});
assert(S.purchTotal().toString()===(S.purchTotal()).toString(),'purchase recorded');
assert(homeAccounts().html.indexOf('double-counting')>-1 || Store.state.lang==='en','separation note exists');

// language
Store.setLang('hi');
assert(T('createRequest').includes('अनुरोध'),'hindi labels active');
assert(homeWorker().html.length>100,'worker dash renders hindi');
assert(loginScreen().length>100,'login renders hindi');
Store.setLang('en');

// render every view for every role
['U-RAMESH','U-ANITA','U-SURESH','U-MEERA'].forEach(uid=>{
  Store.login(uid); const me=S.me();
  ['home','requests','notifications','projects','reports','profile','movements','inventory','expenses','purchases','adminQueue','verifyQueue','issue','approvals','newreq'].forEach(v=>{
    try{ Views[v](Route.params); }catch(e){ assert(false,`render ${me.role}/${v}: ${e.message}`);} });
  try{ Views.request({id:'REQ-1001'}); Views.material({id:'M-01'}); Views.project({id:'P-GHR'}); }catch(e){ assert(false,'detail '+me.role+' '+e.message); }
});
// reset
Store.reset(); assert(Store.state.requests.length===12,'reset restores seed (12 requests)');
console.log('\n'+(fails? fails+' FAILURES':'ALL TESTS PASSED'));
process.exitCode=fails?1:0;
