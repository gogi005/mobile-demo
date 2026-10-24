/* ============ Central state store + localStorage persistence + seed demo data ============ */
const LS_KEY = 'buildmate_demo_v1';

/* ---- helpers ---- */
const now = Date.now();
const DAY = 86400000;
const ago = d => new Date(now - d*DAY).toISOString();
let _mid = 1; const MOV_ID = () => 'MOV-' + (1000 + _mid++);

/* Seed users, projects, materials */
function seedData(){
  _mid = 1;
  const users = [
    {id:'U-RAMESH', role:'worker',  name:'Ramesh Kumar', title:'Site Supervisor', pin:'👷'},
    {id:'U-ANITA',  role:'client',  name:'Anita Sharma', title:'Project Owner',   pin:'🏛️'},
    {id:'U-SURESH', role:'admin',   name:'Suresh Patel', title:'Store Manager',   pin:'📦'},
    {id:'U-MEERA',  role:'accounts',name:'Meera Iyer',   title:'Accounts Manager',pin:'🧮'}
  ];
  const projects = [
    {id:'P-GHR', name:'Green Heights Residency', hi:'ग्रीन हाइट्स रेसिडेंसी', loc:'Whitefield, Bengaluru', status:'active',
     pm:'Vikram Rao', client:'Anita Sharma', budget:8500000, adminLimit:500000, adminUsed:320000,
     approvalRule:{requireClientForCritical:false}}, /* demo: cement within limit → Flow A (admin delegated) */
    {id:'P-RFV', name:'Riverfront Villas', hi:'रिवरफ्रंट विलास', loc:'Electronic City, Bengaluru', status:'active',
     pm:'Kavitha Nair', client:'Anita Sharma', budget:6200000, adminLimit:400000, adminUsed:150000,
     approvalRule:{requireClientForCritical:true}}, /* demo: strict — steel/cement/wire/pipes need client */
    {id:'P-MCH', name:'Metro Commercial Hub', hi:'मेट्रो कॉमर्शियल हब', loc:'HSR Layout, Bengaluru', status:'planning',
     pm:'Arjun Mehta', client:'Anita Sharma', budget:12000000, adminLimit:600000, adminUsed:0,
     approvalRule:{requireClientForCritical:true}}
  ];
  /* stock fields are computed below from movements so everything stays consistent */
  const materials = [
    {id:'M-01', sku:'CEM-O53',   name:'OPC 53 Grade Cement',   hi:'सीमेंट (OPC 53 ग्रेड)', cat:'Cement',    unit:'bags', cost:380, low:150, supplier:'UltraTech Depot',      crit:'high',  open:{a:640,r:60}},
    {id:'M-02', sku:'TMT-12',    name:'TMT Steel 12mm Rod',    hi:'टीएमटी स्टील 12mm रॉड', cat:'Steel',     unit:'rods', cost:620, low:100, supplier:'Jindal Steel Traders',   crit:'high',  open:{a:410,r:40}},
    {id:'M-03', sku:'MSAND-1',   name:'M-Sand',                hi:'एम-सांड (रेत)',        cat:'Aggregates',unit:'tons', cost:1450,low:40,  supplier:'Nandi Stone Crystals', crit:'medium',open:{a:120,r:12}},
    {id:'M-04', sku:'BRICK-RC',  name:'Red Clay Brick',        hi:'लाल ईंट',             cat:'Masonry',   unit:'nos',  cost:9,   low:3000,supplier:'Kolar Brick Kiln',     crit:'medium',open:{a:14500,r:2000}},
    {id:'M-05', sku:'AGG-20',    name:'20mm Aggregate',        hi:'20mm एग्रीगेट',        cat:'Aggregates',unit:'tons', cost:1180,low:30,  supplier:'Nandi Stone Crystals', crit:'medium',open:{a:88,r:6}},
    {id:'M-06', sku:'WIRE-25',   name:'Electrical Wire 2.5sq', hi:'इलेक्ट्रिकल वायर 2.5 वर्ग',cat:'Electrical',unit:'coils',cost:1850,low:20,supplier:'Polycab Agency',       crit:'high',  open:{a:46,r:4}},
    {id:'M-07', sku:'PVC-4',     name:'PVC Pipe 4 inch',       hi:'पीवीसी पाइप 4 इंच',    cat:'Plumbing',  unit:'pcs',  cost:410, low:40,  supplier:'Astral Pipes Dealer',  crit:'high',  open:{a:95,r:10}},
    {id:'M-08', sku:'CPF-SET',   name:'CP Fittings Set',       hi:'सीपी फिटिंग्स सेट',    cat:'Plumbing',  unit:'sets', cost:1250,low:15,  supplier:'Hindware Distributor', crit:'medium',open:{a:32,r:2}},
    {id:'M-09', sku:'PAIN-EM20', name:'Emulsion Paint 20L',    hi:'इमल्शन पेंट 20 ली',    cat:'Paint',     unit:'buckets',cost:2350,low:12, supplier:'Asian Paints Shop',    crit:'low',   open:{a:26,r:3}},
    {id:'M-10', sku:'TILE-ADH',  name:'Tile Adhesive 20kg',    hi:'टाइल आधेसिव 20 किग्रा', cat:'Finishing', unit:'bags', cost:520, low:50,  supplier:'Fevicol Distributor',  crit:'low',   open:{a:38,r:0}},
    {id:'M-11', sku:'WP-CMP20',  name:'Waterproofing Compound',hi:'वॉटरप्रूफिंग कंपाउंड', cat:'Finishing', unit:'buckets',cost:2900,low:10,supplier:'Dr. Fixit Channel',    crit:'medium',open:{a:8,r:0}},
    {id:'M-12', sku:'HTK-STD',   name:'Hand Tools Kit',        hi:'हैंड टूल्स किट',       cat:'Tools',     unit:'kits', cost:2400,low:6,   supplier:'Stanley Hardware',     crit:'low',   open:{a:11,r:1}}
  ];
  /* --- requests across the full lifecycle --- */
  const R = [];
  function req(o){ R.push(Object.assign({issuedQty:0,reservedQty:0,rejectReason:'',photo:null,gps:'',notes:''},o)); }
  req({id:'REQ-1001', projectId:'P-GHR', materialId:'M-01', qty:100, unitPrice:380, reason:'Foundation slab PCC work for block A', priority:'normal', requiredBy:ago(-6), created:ago(9), createdBy:'U-RAMESH', status:'delivered', route:'admin', approvedBy:'U-SURESH', authority:'admin_delegated', issuedQty:100, estCost:38000});
  req({id:'REQ-1002', projectId:'P-GHR', materialId:'M-02', qty:80,  unitPrice:620, reason:'Column reinforcement 3rd floor', priority:'urgent', requiredBy:ago(-4), created:ago(8), createdBy:'U-RAMESH', status:'delivered', route:'client', approvedBy:'U-ANITA', authority:'client', issuedQty:80, estCost:49600});
  req({id:'REQ-1003', projectId:'P-RFV', materialId:'M-04', qty:8000,unitPrice:9,   reason:'Boundary wall construction phase 2', priority:'normal', requiredBy:ago(-2), created:ago(6), createdBy:'U-RAMESH', status:'issued', route:'admin', approvedBy:'U-SURESH', authority:'admin_delegated', issuedQty:8000, estCost:72000});
  req({id:'REQ-1004', projectId:'P-RFV', materialId:'M-09', qty:6,   unitPrice:2350,reason:'Interior emulsion painting sample flat', priority:'normal', requiredBy:ago(0), created:ago(5), createdBy:'U-RAMESH', status:'ready_issue', route:'admin', approvedBy:'U-SURESH', authority:'admin_delegated', reservedQty:6, estCost:14100});
  req({id:'REQ-1005', projectId:'P-GHR', materialId:'M-03', qty:20,  unitPrice:1450,reason:'Masonry mortar requirement block B', priority:'normal', requiredBy:ago(-1), created:ago(4), createdBy:'U-RAMESH', status:'partial_issued', route:'admin', approvedBy:'U-SURESH', authority:'admin_delegated', issuedQty:12, reservedQty:8, estCost:29000});
  req({id:'REQ-1006', projectId:'P-GHR', materialId:'M-02', qty:60,  unitPrice:620, reason:'Beam reinforcement pending for slab 4', priority:'urgent', requiredBy:ago(-3), created:ago(3), createdBy:'U-RAMESH', status:'pending_stock', route:'client', approvedBy:'U-ANITA', authority:'client', estCost:37200});
  req({id:'REQ-1007', projectId:'P-MCH', materialId:'M-01', qty:150, unitPrice:380, reason:'Trial pit concreting for metro footing', priority:'normal', requiredBy:ago(-8), created:ago(2.5), createdBy:'U-RAMESH', status:'pending_admin', route:'admin', estCost:57000});
  req({id:'REQ-1008', projectId:'P-GHR', materialId:'M-06', qty:15,  unitPrice:1850,reason:'Wiring for model apartment floors', priority:'normal', requiredBy:ago(-5), created:ago(2), createdBy:'U-RAMESH', status:'pending_client', route:'client', estCost:27750});
  req({id:'REQ-1009', projectId:'P-RFV', materialId:'M-11', qty:12,  unitPrice:2900,reason:'Terrace waterproofing before monsoon', priority:'critical', requiredBy:ago(-2), created:ago(1.5), createdBy:'U-RAMESH', status:'pending_purchase', route:'client', approvedBy:'U-ANITA', authority:'client', estCost:34800});
  req({id:'REQ-1010', projectId:'P-GHR', materialId:'M-07', qty:40,  unitPrice:410, reason:'Downpipe installation basement level', priority:'normal', requiredBy:ago(-7), created:ago(1.2), createdBy:'U-RAMESH', status:'rejected', route:'client', rejectReason:'Duplicate of REQ-1003 plumbing scope; use balance from previous issue.', estCost:16400});
  req({id:'REQ-1011', projectId:'P-RFV', materialId:'M-12', qty:3,   unitPrice:2400,reason:'New mason crew joining next week', priority:'normal', requiredBy:ago(-10), created:ago(1), createdBy:'U-RAMESH', status:'cancelled', route:'admin', estCost:7200});
  req({id:'REQ-1012', projectId:'P-GHR', materialId:'M-10', qty:25,  unitPrice:520, reason:'Flooring adhesive for lobby tiles', priority:'normal', requiredBy:ago(-9), created:ago(0.4), createdBy:'U-RAMESH', status:'draft', route:null, estCost:13000});
  // fix totals on state
  R.forEach(r=>{ r.estCost = +(r.qty*r.unitPrice).toFixed(2); });

  /* --- inventory opening balances + movements consistent with requests --- */
  const movements = [];
  function mv(mat,type,q,aD,rD,proj,reqId,user,note,daysAgo,val){
    movements.push({id:MOV_ID(), ts:ago(daysAgo), materialId:mat, type, qty:q, availDelta:aD, resDelta:rD,
      projectId:proj||null, requestId:reqId||null, userId:user, note:note||'', valueImpact:val!=null?val:Math.abs((aD||0))*(materials.find(m=>m.id===mat).cost)});
  }
  materials.forEach(m=> mv(m.id,'receipt', m.open.a, m.open.a, 0, null, null, 'U-SURESH','Opening stock receipt', 40));
  // reservations & issues matching request lifecycle
  mv('M-01','reservation',100,0,100,'P-GHR','REQ-1001','U-SURESH','Stock reserved',8);
  mv('M-01','issue',100,-100,-100,'P-GHR','REQ-1001','U-SURESH','Material issued to site',7,38000);
  mv('M-02','reservation',80,0,80,'P-GHR','REQ-1002','U-SURESH','Stock reserved',7);
  mv('M-02','issue',80,-80,-80,'P-GHR','REQ-1002','U-SURESH','Material issued to site',6,49600);
  mv('M-04','reservation',8000,0,8000,'P-RFV','REQ-1003','U-SURESH','Stock reserved',5);
  mv('M-04','issue',8000,-8000,-8000,'P-RFV','REQ-1003','U-SURESH','Material issued to site',4,72000);
  mv('M-09','reservation',6,0,6,'P-RFV','REQ-1004','U-SURESH','Stock reserved',4);
  mv('M-03','reservation',20,0,20,'P-GHR','REQ-1005','U-SURESH','Stock reserved',3);
  mv('M-03','issue',12,-12,-12,'P-GHR','REQ-1005','U-SURESH','Partial issue - balance awaited',2,17400);
  mv('M-01','adjustment',-5,-5,0,'P-GHR',null,'U-SURESH','Bag damage in storage - write off',3,1900);
  mv('M-02','return',10,10,0,'P-GHR','REQ-1002','U-RAMESH','Unused cut pieces returned from site',2,6200);
  mv('M-04','damage',-150,-150,0,'P-RFV',null,'U-SURESH','Broken bricks during unloading',2,1350);

  /* --- purchases (separate ledger from issuance) --- */
  const purchases = [
    {id:'PUR-501', projectId:'P-GHR', materialId:'M-01', supplier:'UltraTech Depot', invoice:'UT/2026/8841', date:ago(20), qty:400, unitCost:372, amount:148800, status:'paid', note:'Bulk cement for GHR foundation phase'},
    {id:'PUR-502', projectId:'P-GHR', materialId:'M-02', supplier:'Jindal Steel Traders', invoice:'JST/2026/1120', date:ago(16), qty:300, unitCost:605, amount:181500, status:'paid', note:'Reinforcement steel lot 1'},
    {id:'PUR-503', projectId:'P-RFV', materialId:'M-04', supplier:'Kolar Brick Kiln', invoice:'KBK/2026/330', date:ago(12), qty:20000, unitCost:8.6, amount:172000, status:'pending', note:'Bricks for villas block C'},
    {id:'PUR-504', projectId:'P-RFV', materialId:'M-09', supplier:'Asian Paints Shop', invoice:'AP/2026/771', date:ago(9), qty:20, unitCost:2280, amount:45600, status:'paid', note:'Emulsion paint advance stock'},
    {id:'PUR-505', projectId:'P-GHR', materialId:'M-03', supplier:'Nandi Stone Crystals', invoice:'NSC/2026/2044', date:ago(6), qty:60, unitCost:1420, amount:85200, status:'pending', note:'M-sand delivery slot Monday'},
    {id:'PUR-506', projectId:'P-MCH', materialId:'M-05', supplier:'Nandi Stone Crystals', invoice:'NSC/2026/2091', date:ago(3), qty:40, unitCost:1150, amount:46000, status:'pending', note:'Aggregate for trial concreting'}
  ];

  /* --- notifications per role (seeded history) --- */
  const notifications = [];
  let _nid=1;
  function nt(role,type,title,body,link,daysAgo,read){
    notifications.push({id:'N'+(_nid++), role, type, title, body, link:link||null, ts:ago(daysAgo), read:!!read});
  }
  nt('worker','success','REQ-1001 delivered','100 bags cement delivered to Green Heights Residency.','REQ-1001',7,true);
  nt('worker','success','REQ-1003 issued','8,000 bricks issued against your request.','REQ-1003',4,true);
  nt('worker','warning','REQ-1005 partially issued','12 of 20 tons M-Sand issued. Balance awaited.','REQ-1005',2,true);
  nt('worker','alert','REQ-1010 rejected','Duplicate of REQ-1003 plumbing scope. Talk to store manager.','REQ-1010',1.2,false);
  nt('worker','info','REQ-1009 awaiting purchase','Waterproofing compound pending purchase by store.','REQ-1009',1.5,false);
  nt('client','info','Delegated approval: REQ-1003','8,000 Red Clay Bricks approved by Admin under delegated authority (₹72,000).','REQ-1003',5,true);
  nt('client','action','Action required: REQ-1008','15 coils Electrical Wire (₹27,750) needs your approval — critical material.','REQ-1008',2,false);
  nt('client','action','Action required: REQ-1006','60 TMT rods (₹37,200) needs your approval — critical material.','REQ-1006',3,false);
  nt('client','warning','Budget impact alert','Riverfront Villas issued material worth ₹86,100 this month.','P-RFV',4,false);
  nt('client','info','Delegated approval: REQ-1004','6 buckets Emulsion Paint approved by Admin under delegated authority.','REQ-1004',4,true);
  nt('admin','action','Approve under authority: REQ-1007','150 bags Cement (₹57,000) within your delegated limit at Metro Commercial Hub.','REQ-1007',2.5,false);
  nt('admin','action','Stock verification: REQ-1006','Client-approved: 60 TMT rods awaiting your stock verification.','REQ-1006',2.6,false);
  nt('admin','alert','Low stock: Waterproofing Compound','Only 8 buckets left (threshold 10).','M-11',1.5,false);
  nt('admin','alert','Low stock: Tile Adhesive','38 bags left (threshold 50).','M-10',2,false);
  nt('admin','alert','Pending purchase: REQ-1009','12 buckets waterproofing compound — insufficient stock.','REQ-1009',1.4,false);
  nt('admin','success','Issued: REQ-1005 partial','12 tons M-Sand issued to Green Heights Residency.','REQ-1005',2,true);
  nt('accounts','info','Commitment confirmed: REQ-1003','₹72,000 approved under admin delegated authority.','REQ-1003',5,true);
  nt('accounts','action','High-value request: REQ-1008','₹27,750 electrical wire pending client approval.','REQ-1008',2,false);
  nt('accounts','alert','Pending invoice KBK/2026/330','₹1,72,000 Kolar Brick Kiln invoice is unpaid.','PUR-503',12,false);
  nt('accounts','info','Actual issued value updated','₹17,400 M-Sand issued against REQ-1005.','REQ-1005',2,false);
  nt('accounts','warning','Purchase requirement','Waterproofing compound purchase needed for REQ-1009 (₹34,800 est.).','REQ-1009',1.4,false);

  return {users, projects, materials, requests:R, movements, purchases, notifications,
          counters:{req:1013}, meta:{seededAt:new Date().toISOString()}};
}

/* ---- store ---- */
const Store = {
  state:null,
  load(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(raw){ this.state = JSON.parse(raw); if(this.state.meta && this.state.materials) return; }
    }catch(e){ console.warn('state load failed, reseeding', e); }
    this.state = seedData();
    this.persist();
  },
  persist(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(this.state)); }catch(e){ console.warn('persist failed',e); } },
  reset(){ this.state = seedData(); this.persist(); },
  setLang(l){ this.state.lang = l; this.persist(); },
  login(userId){ this.state.session = userId; this.persist(); },
  logout(){ this.state.session = null; this.persist(); }
};

/* ---- session language lives inside state ---- */
function L(){ return I18N[(Store.state && Store.state.lang) || 'en']; }
function T(key){ const l=L(); return key.split('.').reduce((o,k)=>o&&o[k], l) || key; }

/* ---- derived selectors (single source of truth) ---- */
const S = {
  user:id => Store.state.users.find(u=>u.id===id),
  me:()=> S.user(Store.state.session),
  project:id => Store.state.projects.find(p=>p.id===id),
  material:id => Store.state.materials.find(m=>m.id===id),
  request:id => Store.state.requests.find(r=>r.id===id),
  projName:p=>{const pr=S.project(p);return pr?(L()===I18N.hi&&pr.hi?pr.hi:pr.name):'—';},
  matName:m=>{const mm=S.material(m);if(!mm)return '—';return L().appName && Store.state.lang==='hi' ? mm.name+' / '+mm.hi : mm.name;},
  matShort:m=>{const mm=S.material(m);if(!mm)return '—';return Store.state.lang==='hi'?mm.hi:mm.name;},
  myRequests(){ const u=S.me(); if(!u) return [];
    return Store.state.requests.filter(r=> u.role==='worker' ? r.createdBy===u.id : true)
      .sort((a,b)=> b.created.localeCompare(a.created)); },
  reqsByStatus(...st){ return Store.state.requests.filter(r=>st.includes(r.status)); },
  /* stock computed from movements so it never drifts */
  stock(mid){
    const m=S.material(mid);
    let a=m.open.a, r=m.open.r;
    Store.state.movements.filter(x=>x.materialId===mid).forEach(x=>{ a+=x.availDelta; r+=x.resDelta; });
    return {avail:+a.toFixed(2), res:+r.toFixed(2), low:m.low, cost:m.cost, unit:m.unit, name:m.name, hi:m.hi};
  },
  issuedTotal(mid){ return Store.state.movements.filter(x=>x.materialId===mid&&x.type==='issue').reduce((s,x)=>s+x.qty,0); },
  lowStock(){ return Store.state.materials.filter(m=> S.stock(m.id).avail < m.low); },
  authRem(pid){ const p=S.project(pid); return p.adminLimit - p.adminUsed; },
  budgetRem(pid){ const p=S.project(pid); return p.budget - S.projIssued(pid) - S.projCommitted(pid); },
  projIssued(pid){ return Store.state.requests.filter(r=>r.projectId===pid).reduce((s,r)=> s + r.issuedQty*r.unitPrice, 0); },
  projCommitted(pid){ /* approved but not yet fully issued */
    return Store.state.requests.filter(r=>r.projectId===pid && ['approved_admin','approved_client','pending_stock','ready_issue','partial_issued'].includes(r.status))
      .reduce((s,r)=> s + (r.qty-r.issuedQty)*r.unitPrice, 0);
  },
  projEstimate(pid){ return Store.state.requests.filter(r=>r.projectId===pid).reduce((s,r)=>s+r.estCost,0); },
  purchTotal(pid){ return Store.state.purchases.filter(p=>!pid||p.projectId===pid).reduce((s,p)=>s+p.amount,0); },
  pendingInvoiceTotal(){ return Store.state.purchases.filter(p=>p.status==='pending').reduce((s,p)=>s+p.amount,0); },
  committedAll(){ return Store.state.requests.filter(r=>['approved_admin','approved_client','pending_stock','ready_issue','partial_issued'].includes(r.status)).reduce((s,r)=>s+(r.qty-r.issuedQty)*r.unitPrice,0); },
  issuedValueAll(){ return Store.state.requests.reduce((s,r)=> s + r.issuedQty*r.unitPrice, 0); },
  unread(role){ return Store.state.notifications.filter(n=>n.role===role && !n.read).length; },
  notifs(role){ return Store.state.notifications.filter(n=>n.role===role).sort((a,b)=>b.ts.localeCompare(a.ts)); },
  monthlyExpenses(){
    const map={};
    Store.state.purchases.forEach(p=>{ const k=p.date.slice(0,7); map[k]=(map[k]||0)+p.amount; });
    Store.state.movements.filter(m=>m.type==='issue').forEach(mv=>{ const k=mv.ts.slice(0,7); map[k]=(map[k]||0)+(mv.valueImpact||0); });
    return Object.entries(map).sort();
  }
};

/* INR formatting - Indian digit grouping */
function inr(n){
  if(n==null||isNaN(n)) n=0;
  const neg=n<0; n=Math.abs(Math.round(n));
  let s=String(n), last3=s.slice(-3), rest=s.slice(0,-3);
  if(rest) last3=','+last3;
  rest=rest.replace(/\B(?=(\d{2})+(?!\d))/g,',');
  return (neg?'-':'')+'₹'+rest+last3;
}
function qtyFmt(n){ return (Math.round(n*100)/100).toLocaleString('en-IN'); }
function dt(ts){ const d=new Date(ts); return d.toLocaleDateString(Store.state.lang==='hi'?'hi-IN':'en-IN',{day:'numeric',month:'short'}) + ' ' + d.toLocaleTimeString(Store.state.lang==='hi'?'hi-IN':'en-IN',{hour:'2-digit',minute:'2-digit'}); }
function dOnly(ts){ return new Date(ts).toLocaleDateString(Store.state.lang==='hi'?'hi-IN':'en-IN',{day:'numeric',month:'short',year:'numeric'}); }
function timeAgo(ts){
  const s=(Date.now()-new Date(ts))/1000;
  if(s<60) return Store.state.lang==='hi'?'अभी':'just now';
  if(s<3600) return Math.floor(s/60)+(Store.state.lang==='hi'?' मिनट पहले':' min ago');
  if(s<86400) return Math.floor(s/3600)+(Store.state.lang==='hi'?' घंटे पहले':' hr ago');
  return Math.floor(s/86400)+(Store.state.lang==='hi'?' दिन पहले':' d ago');
}
