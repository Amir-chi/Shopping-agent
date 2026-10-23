'use strict';
// Both sides of buyer↔shop messaging: the seller panel (#seller) and the buyer's replies in «استعلام‌های من».
// Panel calls carry the shop's session token as a Bearer header; nothing is sent by SMS, call or push.
let sellerTab='home', sellerOverview=null, sellerInbox={status:'all',items:[]}, sellerThread=null, sellerProducts={q:'',category:'',items:[],total:0,categories:[]};
let sellerConfig=null, sellerShops=[], sellerPick=null, sellerError='', sellerEditing='', sellerBusy=false;
const sellerQuickReplies=['بله، موجود است.','متأسفانه فعلاً موجود نیست.','قیمت امروز همین است.','تا ساعت ۹ شب باز هستیم.','گارانتی اصلی دارد.','می‌توانید حضوری ببینید.'];
const plain=n=>money(n).replace(/<[^>]*>/g,'');
function since(t){
  const m=Math.max(0,Math.round((Date.now()-new Date(t))/60000));
  return m<1?'همین حالا':m<60?fa(m)+' دقیقه پیش':m<1440?fa(Math.round(m/60))+' ساعت پیش':dateText(t);
}
async function sellerFetch(section,params={},body){
  const s=state.seller,query=new URLSearchParams(Object.entries(params).filter(([,v])=>v!==''&&v!=null));
  const response=await fetch('/api/seller/'+s.shop.id+'/'+section+(query.size?'?'+query:''),{method:body?'POST':'GET',headers:{Authorization:'Bearer '+s.token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  if(response.status===401){state.seller=null;persist();sellerError='نشست ورود تمام شده؛ دوباره وارد شو.';throw Object.assign(new Error(sellerError),{status:401});}
  if(!response.ok)throw Object.assign(new Error(response.status===403?'در ورود نمایشی تغییر قیمت و موجودی عمومی ممکن نیست.':response.status===400?'اطلاعات واردشده درست نیست؛ قیمت را به تومان بنویس.':response.status===429?'درخواست‌ها زیاد شده؛ کمی بعد امتحان کن.':'انجام نشد؛ دوباره امتحان کن.'),{status:response.status});
  return response.json();
}
async function sellerLoad(){
  if(!sellerConfig)sellerConfig=await fetch('/api/seller/config').then(r=>r.json()).catch(()=>({demo:false}));
  if(!state.seller)return;
  sellerOverview=await sellerFetch('overview');
  if(sellerTab==='inbox')sellerInbox={...sellerInbox,items:(await sellerFetch('conversations',{status:sellerInbox.status})).items};
  if(sellerTab==='products')Object.assign(sellerProducts,await sellerFetch('products',{q:sellerProducts.q,category:sellerProducts.category}));
}
function sellerLogin(){
  const pick=sellerPick;
  return `<div class="page narrow sp-login">${heading('پنل فروشندگان سرراه')}
  <section class="panel"><h2>${pick?'ورود به '+esc(pick.name):'۱. فروشگاهت را پیدا کن'}</h2>
  ${pick?`<p class="small muted">${esc(pick.area)} · ${btn('فروشگاه دیگر','seller-unpick','btn-text')}</p>
    <form id="seller-login" class="sp-login-form"><label class="search-label" for="seller-code">کد ورود فروشگاه</label><input id="seller-code" name="code" autocomplete="one-time-code" autocapitalize="off" spellcheck="false" maxlength="24" dir="ltr" placeholder="xxxxx-xxxxx" required>
    <button class="btn btn-primary full" type="submit">${icon('check')} ورود</button></form>
    ${sellerConfig?.demo?`<div class="sp-or"><span>یا</span></div>${btn(icon('store')+' ورود نمایشی بدون کد','seller-demo','btn-secondary full')}<p class="helper">در ورود نمایشی می‌توانی پیام‌ها را ببینی و جواب بدهی، اما قیمت و موجودی عمومی تغییر نمی‌کند.</p>`:''}`
  :`${sellerConfig?.shops?.length?`<div class="sp-showcase"><h3>فروشگاه‌های نمونه</h3><ul>${sellerConfig.shops.map(s=>`<li><button class="sp-showcase-card" data-action="seller-demo-shop" data-id="${esc(s.id)}"><span class="store-avatar">${icon('store')}</span><span class="od-field od-fill"><strong>${esc(s.name)}</strong><small>${esc(s.area)}${s.trade?' · '+esc(s.trade):''}</small></span>${badge(fa(s.products)+' کالا','')}</button></li>`).join('')}</ul><div class="sp-or"><span>یا فروشگاه دیگری را پیدا کن</span></div></div>`:''}<form id="seller-find" class="shop-search" role="search"><label class="sr-only" for="seller-q">نام یا محدودهٔ فروشگاه</label><input id="seller-q" name="q" type="search" maxlength="100" placeholder="نام یا محدودهٔ فروشگاه" required><button class="btn btn-secondary" type="submit" aria-label="جست‌وجو">${icon('search')}</button></form>
    <ul class="sp-shop-results">${sellerShops.map(s=>`<li><button class="contact-channel" data-action="seller-pick" data-id="${esc(s.id)}"><span class="tool-icon">${icon('store')}</span><span class="od-field od-fill"><strong>${esc(s.name)}</strong><small>${esc(s.area)}</small></span>${icon('arrow')}</button></li>`).join('')}</ul>`}
  ${sellerError?`<p class="field-error" role="alert">${esc(sellerError)}</p>`:''}</section>
  <p class="helper sp-center">کد ورود هر فروشگاه را پشتیبانی سرراه صادر می‌کند؛ کد را با کسی به اشتراک نگذار.<br><a class="section-link" href="#home">رفتن به سایت خریداران</a></p></div>`;
}
function sellerHome(o){
  const k=[['پیام خوانده‌نشده',fa(o.stats.unread),'chat',o.stats.unread?'warn':''],['پاسخ داده‌شده (۱۴ روز)',fa(o.stats.answered)+' از '+fa(o.stats.received),'check',''],['میانهٔ زمان پاسخ',o.stats.median_minutes==null?'—':fa(o.stats.median_minutes)+' دقیقه','clock',''],['کالاهای ویترین',fa(o.stats.products),'box','']];
  return `<div class="sp-kpis">${k.map(([t,v,i,tone])=>`<div class="sp-kpi ${tone}">${icon(i)}<span>${t}</span><strong>${v}</strong></div>`).join('')}</div>
  <section class="panel"><div class="sp-section-head"><h2>پیام‌های تازه</h2>${btn('همهٔ پیام‌ها','seller-tab','btn-text','data-tab="inbox"')}</div>${o.latest.length?`<ul class="sp-list">${o.latest.map(conversationRow).join('')}</ul>`:'<p class="helper">پیام خوانده‌نشده‌ای نداری.</p>'}</section>
  <section class="panel"><div class="sp-section-head"><h2>خریدارها دنبال چه هستند؟</h2>${btn('جزئیات','seller-tab','btn-text','data-tab="demand"')}</div>${o.demand.unmet.length||o.demand.searches.length?`<ul class="sp-demand">${o.demand.unmet.slice(0,3).map(u=>`<li><span>${esc(u.product.name)}</span>${badge(fa(u.count)+' بار ناموجود در جای دیگر','warn')}</li>`).join('')}${o.demand.searches.slice(0,3).map(m=>`<li><span>«${esc(m.query)}»</span>${badge(fa(m.count)+' جست‌وجوی بی‌نتیجه','')}</li>`).join('')}</ul>`:'<p class="helper">فعلاً تقاضای بی‌پاسخی در دسته‌های تو ثبت نشده.</p>'}</section>
  ${o.stats.live?note(fa(o.stats.live)+' کالا قیمت و موجودی تازه از طرف تو دارد.'):''}`;
}
function conversationRow(i){
  const last=i.reply||i.note||i.questions.join(' ');
  return `<li><button class="sp-row ${i.seller_unread?'unread':''} ${sellerThread?.id===i.id?'active':''}" data-action="seller-open" data-id="${esc(i.id)}"><span class="sp-dot" aria-hidden="true"></span><span class="od-field od-fill"><strong>${i.product?esc(i.product.name):'سؤال دربارهٔ فروشگاه'}</strong><small>${esc(last)}</small></span><span class="sp-row-end"><small>${since(i.updated_at)}</small>${i.seller_unread?badge('تازه','warn'):i.answered_at?badge('پاسخ داده شد','good'):badge('بی‌پاسخ','')}</span></button></li>`;
}
function bubble(m,viewer='seller'){
  const mine=m.sender===viewer,who=mine?'تو':m.sender==='seller'?'فروشنده':'خریدار';
  const status=m.available===true?badge('موجود است'+(m.price?' · '+plain(m.price):''),'good','check'):m.available===false?badge('موجود نیست','warn'):m.price?badge('قیمت: '+plain(m.price),'good'):'';
  return `<li class="sp-bubble ${mine?'mine':'theirs'}"><span class="small muted">${who} · ${since(m.created_at)}</span>${status}${m.text?`<p>${esc(m.text)}</p>`:''}</li>`;
}
function sellerThreadView(t){
  return `<div class="sp-thread"><div class="sp-thread-head">${btn(icon('back')+' همهٔ پیام‌ها','seller-close','btn-text sp-back')}<div><strong>${t.product?`<a href="#product?id=${esc(t.product.id)}">${esc(t.product.name)}</a>`:'سؤال دربارهٔ فروشگاه'}</strong>${t.your_price?`<span class="small muted">قیمت ثبت‌شدهٔ تو: ${plain(t.your_price)}</span>`:''}</div></div>
  <ol class="sp-bubbles"><li class="sp-bubble theirs"><span class="small muted">خریدار · ${since(t.created_at)}</span>${t.questions.length?`<div class="od-cluster">${t.questions.map(q=>badge(q,'')).join('')}</div>`:''}${t.note?`<p>${esc(t.note)}</p>`:''}</li>${t.messages.map(m=>bubble(m,'seller')).join('')}</ol>
  <form id="seller-reply" class="sp-composer" data-id="${esc(t.id)}"><fieldset class="sp-status"><legend class="sr-only">وضعیت کالا</legend>${[['1','موجود است'],['0','موجود نیست'],['','فقط پیام']].map(([v,l],i)=>`<label><input type="radio" name="available" value="${v}" ${i===2?'checked':''}><span>${l}</span></label>`).join('')}</fieldset>
  <label class="sr-only" for="sp-price">قیمت امروز برای این خریدار</label><input id="sp-price" name="price" data-amount inputmode="decimal" maxlength="30" placeholder="قیمت امروز (اختیاری)، مثلاً ۲۶٫۵ میلیون">
  <div class="sp-quick" aria-label="پاسخ‌های آماده">${sellerQuickReplies.map(q=>`<button type="button" class="chip" data-action="seller-quick" data-text="${esc(q)}">${esc(q)}</button>`).join('')}</div>
  <label class="sr-only" for="sp-text">متن پاسخ</label><textarea id="sp-text" name="text" rows="3" maxlength="500" placeholder="پاسخت را بنویس…"></textarea>
  <button class="btn btn-primary full" type="submit" ${sellerBusy?'disabled':''}>${icon('send')} ارسال پاسخ</button><p class="helper">فقط همین خریدار می‌بیند.</p></form></div>`;
}
function sellerInboxView(){
  const filters=[['all','همه'],['unread','خوانده‌نشده'],['answered','پاسخ داده‌شده']];
  const list=`<div class="sp-inbox-list"><div class="sp-filters" role="group" aria-label="فیلتر پیام‌ها">${filters.map(([v,l])=>`<button class="chip ${sellerInbox.status===v?'selected':''}" data-action="seller-filter" data-status="${v}" aria-pressed="${sellerInbox.status===v}">${l}</button>`).join('')}</div>${sellerInbox.items.length?`<ul class="sp-list">${sellerInbox.items.map(conversationRow).join('')}</ul>`:'<p class="helper">پیامی در این بخش نیست.</p>'}</div>`;
  return `<div class="sp-inbox ${sellerThread?'has-thread':''}">${list}${sellerThread?sellerThreadView(sellerThread):'<div class="sp-thread sp-empty"><p class="helper">یک گفت‌وگو را انتخاب کن.</p></div>'}</div>`;
}
function productRow(i){
  const live=i.source==='merchant_feed'?(i.fresh?badge(i.availability==='out_of_stock'?'ناموجود (گزارش تو)':'موجود · '+plain(i.reported_price),i.availability==='out_of_stock'?'warn':'good','check'):badge('گزارش تو منقضی شده','')):badge('قیمت از داده ثبت‌شده','');
  const editing=sellerEditing===i.offer_id;
  return `<li class="sp-product"><div class="sp-product-main">${image({...i.product,images:i.product.images},'sp-thumb')}<div class="od-field od-fill"><strong>${esc(i.product.name)}</strong><small class="muted">${esc(i.product.category)}</small><span class="sp-price">${i.price?plain(i.price):'بدون قیمت'} ${live}</span></div>${btn(editing?'بستن':'به‌روزرسانی','seller-edit','btn-secondary',`data-id="${esc(i.offer_id)}"`)}</div>
  ${editing?`<form class="sp-price-form" data-id="${esc(i.offer_id)}"><label class="sr-only" for="pp-${esc(i.offer_id)}">قیمت امروز</label><input id="pp-${esc(i.offer_id)}" name="price" data-amount inputmode="decimal" maxlength="30" placeholder="قیمت امروز به تومان" value="${i.reported_price||i.price?fa(i.reported_price||i.price):''}"><select name="availability" aria-label="موجودی"><option value="in_stock">موجود است</option><option value="out_of_stock">موجود نیست</option></select><button class="btn btn-primary" type="submit" ${state.seller.demo?'disabled':''}>ذخیره</button>${state.seller.demo?'<p class="helper">در ورود نمایشی ذخیره غیرفعال است.</p>':'<p class="helper">برای ۲۴ ساعت به خریدارها «تأییدشده توسط فروشنده» نشان داده می‌شود.</p>'}</form>`:''}</li>`;
}
function sellerProductsView(){
  const p=sellerProducts;
  return `<form id="seller-products-search" class="shop-search" role="search"><label class="sr-only" for="sp-q">جست‌وجو در کالاهای فروشگاه</label><input id="sp-q" name="q" type="search" maxlength="100" value="${esc(p.q)}" placeholder="جست‌وجو در کالاهای فروشگاه"><button class="btn btn-secondary" type="submit" aria-label="جست‌وجو">${icon('search')}</button></form>
  ${p.categories.length>1?`<div class="leaf-chips scroll-chips" role="group" aria-label="دسته‌ها"><button class="chip ${p.category?'':'selected'}" data-action="seller-category" data-value="" aria-pressed="${!p.category}">همه</button>${p.categories.map(c=>`<button class="chip ${p.category===c.name?'selected':''}" data-action="seller-category" data-value="${esc(c.name)}" aria-pressed="${p.category===c.name}">${esc(c.name)} <small>${fa(c.count)}</small></button>`).join('')}</div>`:''}
  <p class="small muted">${fa(p.total)} کالا</p>${p.items.length?`<ul class="sp-products">${p.items.map(productRow).join('')}</ul>${p.items.length<p.total?btn('کالاهای بیشتر','seller-more','btn-secondary full'):''}`:'<p class="helper">کالایی پیدا نشد.</p>'}`;
}
function sellerDemandView(o){
  const list=(items,render)=>items.length?`<ul class="sp-demand">${items.map(render).join('')}</ul>`:'<p class="helper">فعلاً موردی نیست.</p>';
  return `<section class="panel"><h2>کالاهایی که در فروشگاه‌های دیگر موجود نبود</h2><p class="helper">در فروشگاه‌های دیگر پرسیده شده و موجود نبوده.</p>${list(o.demand.unmet,u=>`<li><a href="#product?id=${esc(u.product.id)}">${esc(u.product.name)}</a><span>${badge(fa(u.count)+' استعلام','warn')}${u.in_your_shop?badge('در ویترین تو هست','good','check'):''}</span></li>`)}</section>
  <section class="panel"><h2>جست‌وجوهای بی‌نتیجه در دسته‌های تو</h2>${list(o.demand.searches,m=>`<li><span>«${esc(m.query)}»</span>${badge(fa(m.count)+' بار','')}</li>`)}</section>
  <section class="panel"><h2>سایر جست‌وجوهای بی‌نتیجه</h2>${list(o.demand.other_searches,m=>`<li><span>«${esc(m.query)}»</span>${badge(fa(m.count)+' بار','')}</li>`)}</section>
  ${note('فقط جست‌وجوهای تکراری؛ بدون اطلاعات شخصی.')}`;
}
function sellerApp(){
  if(!state.seller)return sellerLogin();
  const o=sellerOverview,s=state.seller;
  if(!o)return `<div class="page">${heading('پنل فروشنده')}${empty('پنل در دسترس نیست','اتصال را بررسی کن و دوباره امتحان کن.','retry','تلاش دوباره','alert')}</div>`;
  const tabs=[['home','داشبورد','grid'],['inbox','پیام‌ها','chat'],['products','کالاها','box'],['demand','تقاضا','target']];
  const body=sellerTab==='inbox'?sellerInboxView():sellerTab==='products'?sellerProductsView():sellerTab==='demand'?sellerDemandView(o):sellerHome(o);
  return `<div class="page sp-app"><header class="sp-header"><div class="store-avatar">${icon('store')}</div><div class="od-field od-fill"><h1>${esc(s.shop.name)}</h1><span class="small muted">${esc(s.shop.area)} · پنل فروشنده</span></div>${s.demo?badge('ورود نمایشی','warn'):''}${s.demo&&sellerConfig?.shops?.length?`<label class="sr-only" for="sp-switch">تعویض فروشگاه</label><select id="sp-switch" class="sp-switch"><option value="">تعویض فروشگاه…</option>${sellerConfig.shops.filter(x=>x.id!==s.shop.id).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}${x.trade?' · '+esc(x.trade):''}</option>`).join('')}</select>`:''}${`<a class="btn btn-quiet sp-site" href="#home">سایت خریداران</a>`+btn('خروج','seller-logout','btn-quiet')}</header>
  <nav class="sp-tabs" role="tablist" aria-label="بخش‌های پنل">${tabs.map(([id,label,i])=>`<button role="tab" aria-selected="${sellerTab===id}" class="${sellerTab===id?'active':''}" data-action="seller-tab" data-tab="${id}">${icon(i)}<span>${label}</span>${id==='inbox'&&o.stats.unread?`<b class="sp-count">${fa(o.stats.unread)}</b>`:''}</button>`).join('')}</nav>
  ${sellerError?`<p class="field-error" role="alert">${esc(sellerError)}</p>`:''}<div class="sp-body">${body}</div></div>`;
}
views.seller=sellerApp;
const loadRouteWithSellerPanel=loadRoute;
loadRoute=async function(){
  if(route!=='seller')return loadRouteWithSellerPanel();
  const token=generation;sellerError='';
  try{await sellerLoad();}catch(error){if(token===generation)sellerError=error.message;}
};
async function sellerRefresh(){try{await sellerLoad();sellerError='';}catch(error){sellerError=error.message;}render();}
actions['seller-pick']=el=>{sellerPick=sellerShops.find(s=>s.id===el.dataset.id)||null;sellerError='';render();$('#seller-code')?.focus();};
actions['seller-unpick']=()=>{sellerPick=null;sellerError='';render();};
actions['seller-demo']=()=>sellerSignIn({shop_id:sellerPick.id,demo:true});
actions['seller-demo-shop']=el=>sellerSignIn({shop_id:el.dataset.id,demo:true});
// Presenting: jump to another sample shop without going back to the login page.
document.addEventListener('change',e=>{
  if(e.target.id!=='sp-switch'||!e.target.value)return;
  const old=state.seller?.token;if(old)fetch('/api/seller/logout',{method:'POST',headers:{Authorization:'Bearer '+old}}).catch(()=>{});
  sellerThread=null;sellerEditing='';sellerProducts={q:'',category:'',items:[],total:0,categories:[]};sellerSignIn({shop_id:e.target.value,demo:true});
});
actions['seller-logout']=async()=>{fetch('/api/seller/logout',{method:'POST',headers:{Authorization:'Bearer '+state.seller.token}}).catch(()=>{});state.seller=null;sellerOverview=null;sellerThread=null;persist();render();};
actions['seller-tab']=async el=>{sellerTab=el.dataset.tab;sellerThread=null;sellerEditing='';await sellerRefresh();};
actions['seller-filter']=async el=>{sellerInbox.status=el.dataset.status;await sellerRefresh();};
actions['seller-open']=async el=>{
  try{sellerThread=await sellerFetch('thread',{id:el.dataset.id});sellerTab='inbox';}catch(error){sellerError=error.message;}
  render();$('#sp-text')?.focus({preventScroll:true});
  // The list and the unread badge refresh behind the open thread; never redraw over a reply being typed.
  sellerLoad().then(()=>{if(route==='seller'&&!document.activeElement?.closest?.('form'))render();}).catch(()=>{});
};
actions['seller-close']=()=>{sellerThread=null;render();};
actions['seller-quick']=el=>{const box=$('#sp-text');box.value=(box.value?box.value+' ':'')+el.dataset.text;box.focus();if(/^بله/.test(el.dataset.text))$('#seller-reply [name=available][value="1"]').checked=true;if(/موجود نیست/.test(el.dataset.text))$('#seller-reply [name=available][value="0"]').checked=true;};
actions['seller-category']=async el=>{sellerProducts={...sellerProducts,category:el.dataset.value,items:[]};await sellerRefresh();};
actions['seller-edit']=el=>{sellerEditing=sellerEditing===el.dataset.id?'':el.dataset.id;render();$(`#pp-${el.dataset.id}`)?.focus();};
actions['seller-more']=async()=>{try{const page=await sellerFetch('products',{q:sellerProducts.q,category:sellerProducts.category,offset:sellerProducts.items.length});sellerProducts.items=sellerProducts.items.concat(page.items);}catch(error){sellerError=error.message;}render();};
actions['open-seller']=()=>{sellerPick=selectedShop?{id:selectedShop.id,name:selectedShop.name,area:selectedShop.area}:null;return go('seller');};
async function sellerSignIn(body){
  sellerError='';
  try{
    const response=await fetch('/api/seller/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!response.ok)throw new Error(response.status===401?(body.demo?'ورود نمایشی خاموش است.':'کد ورود درست نیست.'):response.status===429?'تلاش‌ها زیاد شد؛ چند دقیقه بعد امتحان کن.':'ورود انجام نشد.');
    const data=await response.json();state.seller={token:data.token,demo:data.demo,shop:data.shop};sellerPick=null;sellerTab='home';persist();await sellerRefresh();
  }catch(error){sellerError=error.message;render();}
}
document.addEventListener('submit',async e=>{
  const form=e.target;
  if(form.id==='seller-find'){e.preventDefault();const q=String(new FormData(form).get('q')||'').trim();const data=await api('/api/shops',{q,limit:8}).catch(()=>({items:[]}));sellerShops=data.items;sellerError=data.items.length?'':'فروشگاهی با این نام پیدا نشد.';render();return;}
  if(form.id==='seller-login'){e.preventDefault();return sellerSignIn({shop_id:sellerPick.id,code:new FormData(form).get('code')});}
  if(form.id==='seller-products-search'){e.preventDefault();sellerProducts={...sellerProducts,q:String(new FormData(form).get('q')||'').trim(),items:[]};return sellerRefresh();}
  if(form.id==='seller-reply'){
    e.preventDefault();const f=new FormData(form),available=f.get('available');
    sellerBusy=true;
    try{sellerThread={...await sellerFetch('reply',{},{id:form.dataset.id,text:f.get('text'),price:f.get('price'),available:available===''?null:available==='1'}),your_price:sellerThread.your_price};toast('پاسخ برای خریدار فرستاده شد.');await sellerLoad();sellerError='';}
    catch(error){sellerError=error.message;}
    sellerBusy=false;render();return;
  }
  if(form.classList.contains('sp-price-form')){
    e.preventDefault();const f=new FormData(form);
    try{await sellerFetch('price',{},{offer_id:form.dataset.id,price:f.get('price'),availability:f.get('availability')});toast('قیمت و موجودی به‌روز شد.');sellerEditing='';sellerProducts.items=[];await sellerLoad();sellerError='';}
    catch(error){sellerError=error.message;}
    render();
  }
});
setInterval(async()=>{
  if(route!=='seller'||!state.seller||document.hidden||busy||document.activeElement?.closest?.('form'))return;
  const before=sellerOverview?.stats.unread||0;
  try{sellerOverview=await sellerFetch('overview');}catch{return;}
  if(sellerOverview.stats.unread>before){toast('پیام تازه از خریدار رسید.');if(sellerTab==='inbox')sellerInbox.items=(await sellerFetch('conversations',{status:sellerInbox.status}).catch(()=>({items:sellerInbox.items}))).items;render();}
},30000);
const storeWithPanel=views.store;
views.store=()=>{const html=storeWithPanel(),s=selectedShop;if(!s)return html;const end=html.lastIndexOf('</div>');return html.slice(0,end)+`<p class="seller-entry">${icon('store')} صاحب این فروشگاه هستی؟ ${btn('ورود به پنل فروشنده','open-seller','btn-text')}</p>`+html.slice(end);};

// Buyer side: each inquiry is a small thread; the buyer can reply with the same token that created it.
inquiriesPanel=function(){
  const items=[...inquiryAnswers.values()];if(!items.length)return '';
  const status=i=>!i.answered_at?badge('در انتظار پاسخ فروشنده','','clock'):i.available===true?badge('موجود است'+(i.price?' · '+plain(i.price):''),'good','check'):i.available===false?badge('موجود نیست','warn','alert'):badge('فروشنده پاسخ داد','good','chat');
  return `<section id="my-inquiries" class="panel"><h2>${icon('chat')} استعلام‌های من</h2><ul class="inquiry-list">${items.map(i=>`<li class="buyer-thread"><div class="buyer-thread-head"><div class="od-field od-fill"><strong>${esc(i.shop.name)}</strong><span class="small muted">${i.product?esc(i.product.name)+' · ':''}${esc(i.questions.join(' '))}</span></div>${status(i)}</div>${i.messages?.length?`<ol class="sp-bubbles">${i.messages.map(m=>bubble(m,'buyer')).join('')}</ol>`:''}${i.answered_at?`<form class="buyer-reply" data-id="${esc(i.id)}"><label class="sr-only" for="br-${esc(i.id)}">پاسخ به فروشنده</label><input id="br-${esc(i.id)}" name="text" maxlength="500" placeholder="پاسخ یا سؤال بعدی…" required><button class="btn btn-secondary" type="submit" aria-label="ارسال">${icon('send')}</button></form>`:''}</li>`).join('')}</ul><p class="helper">فقط برای تو نمایش داده می‌شود و قیمت عمومی نمی‌شود.</p></section>`;
};
document.addEventListener('submit',async e=>{
  if(!e.target.classList.contains('buyer-reply'))return;
  e.preventDefault();
  const id=e.target.dataset.id,text=String(new FormData(e.target).get('text')||'').trim();if(!text)return;
  const known=(state.inquiries||[]).find(x=>x.ids?.includes(id)),tokens=known?[known.token]:(state.inquiries||[]).map(x=>x.token);
  for(const token of tokens){
    const response=await fetch('/api/inquiries/reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,id,text})}).catch(()=>null);
    if(response?.ok){inquiryAnswers.set(id,await response.json());toast('پیامت برای فروشنده فرستاده شد.');render();return;}
    if(response&&response.status!==404)break;
  }
  toast('پیام فرستاده نشد؛ دوباره امتحان کن.');
});
