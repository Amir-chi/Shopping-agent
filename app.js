/* Buildless Persian RTL prototype. All commercial information is explicitly sample data. */
'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const fa = value => new Intl.NumberFormat('fa-IR').format(value);
const money = value => fa(value) + ' تومان';
const paths = {
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1Z"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  pin:'<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  arrow:'<path d="M20 12H4m6-6-6 6 6 6"/>',
  mic:'<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-5"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  checkCircle:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  store:'<path d="M4 10v11h16V10M3 3h18l1 7a3 3 0 0 1-5 2 3 3 0 0 1-5 0 3 3 0 0 1-5 0 3 3 0 0 1-5-2Z"/><path d="M9 21v-6h6v6"/>',
  heart:'<path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z"/>',
  bookmark:'<path d="M5 3h14v18l-7-5-7 5Z"/>',
  plan:'<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4m8-4v4M8 11h8m-8 4h5"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  compare:'<path d="M8 3v18m8-18v18M3 8h10m-2 8h10M5 5 2 8l3 3m14 2 3 3-3 3"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v1"/>',
  tune:'<path d="M4 7h10m4 0h2M4 17h2m4 0h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16"/>',
  list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/>',
  walk:'<circle cx="14" cy="4" r="2"/><path d="m7 21 4-8 3 3 1 5M4 12l4-1 3-5 4 5 5 1m-9-5 1 6"/>',
  car:'<path d="m4 10 2-6h12l2 6m-17 0h18v9H3ZM6 19v2m12-2v2M6 14h2m8 0h2"/>',
  phone:'<path d="m5 3 4 5-2 3a16 16 0 0 0 6 6l3-2 5 4c-1 4-4 3-7 2A22 22 0 0 1 3 10C2 7 1 4 5 3Z"/>',
  route:'<path d="m22 2-7 20-4-9-9-4Z"/><path d="m11 13 6-6"/>',
  card:'<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 9h20M6 15h4"/>',
  refresh:'<path d="M20 7a9 9 0 1 0 1 9M20 3v5h-5"/>',
  wifi:'<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0m-4 4h.01"/>',
  copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  alert:'<path d="m12 3 10 18H2Z"/><path d="M12 9v5m0 3v1"/>',
  bag:'<path d="M4 7h16l1 14H3ZM8 8V6a4 4 0 0 1 8 0v2"/>'
};
function icon(name, extra = '') { return '<svg class="od-icon ' + extra + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.info) + '</svg>'; }
function esc(text) { return String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function button(label, action, cls = 'btn-secondary', attrs = '') { if(action==='product-stores'&&route==='home')cls='btn-secondary compact';return '<button class="btn ' + cls + '" data-action="' + action + '" ' + attrs + '>' + label + '</button>'; }
function badge(text, type = '', name = 'info') { return '<span class="badge ' + type + '">' + icon(name) + text + '</span>'; }
function sampleNote(text = 'قیمت‌ها، فروشگاه‌ها و پاسخ‌های بررسی موجودی در این پیش‌نمایش، نمونه‌اند و برای خرید واقعی قابل استناد نیستند.') { return '<div class="sample-note">' + icon('info') + '<p>' + text + '</p></div>'; }
const products = [
  {id:'a55', name:'سامسونگ گلکسی A۵۵', latin:'Samsung Galaxy A55 5G', short:'گلکسی A۵۵', image:'assets/galaxy-a55.jpg', width:710, height:614, price:27800000, high:29900000, features:['حافظه ۲۵۶ گیگابایت','نمایشگر ۱۲۰ هرتز','باتری ۵۰۰۰ میلی‌آمپر'], reason:'برای استفاده روزمره، دوربین و دوام بدنه، انتخاب متعادل‌تری است؛ با بودجه‌ات هم‌خوانی دارد.', strengths:'بدنه مقاوم، دوربین متعادل و نمایشگر روان', weaknesses:'وزن نسبتاً زیاد؛ شارژر در جعبه نیست', spec:'نمایشگر ۶٫۶ اینچ • دوربین اصلی ۵۰ مگاپیکسل', stores:4, match:'هماهنگی زیاد', installment:true},
  {id:'redmi', name:'شیائومی ردمی نوت ۱۳ پرو', latin:'Redmi Note 13 Pro 5G', short:'ردمی نوت ۱۳ پرو', image:'assets/redmi-note13.jpg', width:720, height:773, price:24600000, high:27000000, features:['حافظه ۲۵۶ گیگابایت','شارژ سریع ۶۷ وات','دوربین ۲۰۰ مگاپیکسل'], reason:'اگر شارژ سریع و جزئیات عکس برایت مهم‌تر است، ارزش بررسی دارد؛ با هزینه کمتر.', strengths:'شارژ سریع و نمایشگر با جزئیات بالا', weaknesses:'عملکرد عکس‌ها در نور کم متغیر است', spec:'نمایشگر ۶٫۶۷ اینچ • دوربین اصلی ۲۰۰ مگاپیکسل', stores:3, match:'هماهنگی خوب', installment:true},
  {id:'a35', name:'سامسونگ گلکسی A۳۵', latin:'Samsung Galaxy A35 5G', short:'گلکسی A۳۵', image:'assets/galaxy-a35.jpg', width:710, height:614, price:21900000, high:23900000, features:['حافظه ۲۵۶ گیگابایت','مقاوم در برابر آب','باتری ۵۰۰۰ میلی‌آمپر'], reason:'برای کارهای روزمره و هزینه کمتر مناسب است؛ برای بازی‌های سنگین انتخاب اول نیست.', strengths:'قیمت کمتر و مقاومت در برابر آب', weaknesses:'توان پردازشی پایین‌تر از گلکسی A۵۵', spec:'نمایشگر ۶٫۶ اینچ • دوربین اصلی ۵۰ مگاپیکسل', stores:2, match:'هماهنگی خوب', installment:false}
];
const stores = [
  {id:0,name:'دیجیتال آبان',area:'حافظ',mall:'مجتمع چارسو',floor:'طبقه دوم',unit:'۲۱۴',walk:8,drive:4,km:'۰٫۶',price:27800000,fresh:'امروز، ساعت ۱۲:۳۰',open:true,close:'۲۱:۰۰',installment:true,verified:true,status:'امروز تأیید شده',phone:null,lat:35.6917,lng:51.4125},
  {id:1,name:'موبایل نارون',area:'جمهوری',mall:'پاساژ علاءالدین',floor:'طبقه سوم',unit:'۳۱۸',walk:12,drive:6,km:'۰٫۹',price:27400000,fresh:'۲۳ روز پیش',open:true,close:'۲۰:۳۰',installment:false,verified:false,status:'پاسخ‌گو نبود',phone:null,lat:35.6937,lng:51.4144},
  {id:2,name:'همراه پارسه',area:'ولیعصر',mall:'مرکز خرید نمونه',floor:'همکف',unit:'۱۸',walk:19,drive:8,km:'۱٫۴',price:28200000,fresh:'دیروز',open:false,close:'۱۹:۰۰',installment:true,verified:false,status:'موجودی تأیید نشده',phone:null,lat:35.6955,lng:51.4057},
  {id:3,name:'دیجیتال سپید',area:'حافظ',mall:'مجتمع چارسو',floor:'طبقه اول',unit:'۱۲۶',walk:9,drive:4,km:'۰٫۷',price:28100000,fresh:'امروز، ساعت ۱۱:۰۰',open:true,close:'۲۱:۰۰',installment:true,verified:false,status:'موجودی تأیید نشده',phone:null,lat:35.6917,lng:51.4125}
];
const questions = [
  {key:'budget',title:'حدود بودجه‌ات چقدر است؟',sub:'یک بازه انتخاب کن؛ قیمت دقیق را قبل از حرکت بررسی می‌کنیم.',options:[['تا ۲۰ میلیون','برای یک انتخاب اقتصادی'],['۲۰ تا ۳۰ میلیون','تعادل قیمت و امکانات'],['۳۰ تا ۴۵ میلیون','امکانات بیشتر'],['بیشتر از ۴۵ میلیون','بودجه انعطاف‌پذیر']]},
  {key:'use',title:'بیشتر برای چه کاری می‌خواهی؟',sub:'مهم‌ترین استفاده‌ات را انتخاب کن.',options:[['کارهای روزمره','تماس، پیام و شبکه‌های اجتماعی'],['عکس و فیلم','ثبت لحظه‌ها با کیفیت بهتر'],['درس و کار','مطالعه، کلاس و کارهای روزانه'],['بازی','عملکرد روان‌تر در بازی‌ها']]},
  {key:'feature',title:'کدام ویژگی برایت مهم‌تر است؟',sub:'پیشنهادها را با همین اولویت مرتب می‌کنیم.',options:[['باتری بادوام','دیرتر به شارژ نیاز داشته باشد'],['دوربین خوب','عکس‌ها و فیلم‌های بهتر'],['استفاده راحت','کارکرد ساده و مطمئن'],['قیمت مناسب','هزینه کمتر با امکانات کافی']]},
  {key:'brand',title:'برند خاصی در نظر داری؟',sub:'اگر انتخاب نکرده‌ای، همه گزینه‌ها را بررسی می‌کنیم.',options:[['سامسونگ','گوشی‌های گلکسی'],['شیائومی','گوشی‌های ردمی'],['اپل','گوشی‌های آیفون'],['برند دیگری','در جست‌وجوی بعدی دقیق‌تر بنویس']]},
  {key:'installment',title:'خرید قسطی می‌خواهی؟',sub:'شرایط اقساط هر فروشگاه باید جداگانه تأیید شود.',options:[['بله، خرید قسطی','فروشگاه‌های دارای پرداخت قسطی'],['نه، نقدی می‌خرم','مقایسه قیمت نقدی']]}
];
const defaults = {query:'',category:'phone',answers:{},step:0,product:'a55',compare:[],saved:[],neighborhood:'حافظ و جمهوری',store:0,view:'list',filters:[],sort:'nearest',savedPlan:null,verification:null};
let state;
try { state = Object.assign({}, defaults, JSON.parse(localStorage.getItem('nazdika') || localStorage.getItem('torob-hamrah') || '{}')); } catch { state = {...defaults}; }
state.answers = state.answers || {};
state.compare = (state.compare || []).filter(id => products.some(p => p.id === id)).slice(0,3);
state.saved = (state.saved || []).filter(id => products.some(p => p.id === id));
if (!products.some(p => p.id === state.product)) state.product = 'a55';
if (!stores.some(s => s.id === Number(state.store))) state.store = 0;
state.step = Math.min(2, Math.max(0, Number(state.step) || 0));
state.intent=state.intent==='known'?'known':'guided';
state.flow=Array.isArray(state.flow)?state.flow.filter(i=>[0,1,2].includes(i)):[0,1,2];
let route = location.hash.slice(1) || 'home';
let historyRoutes = [];
let scrollPositions = {};
let timer = null;
let toastTimer = null;
let searchError = '';
let loadingResults = false;
const main = $('#main');
function persist() { try { localStorage.setItem('nazdika', JSON.stringify(state)); } catch { toast('ذخیره‌سازی مرورگر در دسترس نیست؛ انتخاب‌ها تا بستن صفحه حفظ می‌شوند.'); } }
function currentProduct(){return products.find(p=>p.id===state.product)||products[0];}
function currentStore(){return stores.find(s=>s.id===Number(state.store))||stores[0];}
function productPrice(s,p=currentProduct()){return s.price+(p.price-products[0].price);}
function image(p, className='product-image'){return '<div class="'+className+'"><img class="od-media" src="'+p.image+'" width="'+p.width+'" height="'+p.height+'" alt="'+p.name+'؛ نمای جلو و پشت گوشی" loading="lazy"></div>';}
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>{$('#toast').hidden=true;},3600);}
function navItems(){return [['home','home','خانه'],['discovery','search','جست‌وجو'],['plan','plan','برنامه خرید'],['saved','bookmark','ذخیره‌شده‌ها']];}
function activeNav(){return ['home','saved','plan'].includes(route)?route:'discovery';}
function renderChrome(){
  const links=navItems().map(([to,i,label])=>'<a href="#'+to+'" '+(activeNav()===to?'class="active" aria-current="page"':'')+'>'+label+'</a>').join('');
  $('#site-header').innerHTML='<div class="header-inner"><a class="brand" href="#home" aria-label="نزدیکا، خانه"><svg class="brand-mark" viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="1" y="1" width="46" height="46" rx="15" fill="var(--primary)"/><path d="M33 20c0 8-9 16-9 16S15 28 15 20a9 9 0 1 1 18 0Z" stroke="white" stroke-width="2.5"/><path d="m20 20 3 3 5-6" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="od-field"><span class="brand-name">نزدیکا<span class="brand-dot">.</span></span><span class="brand-caption">انتخاب بهتر، خرید نزدیک‌تر</span></span></a><nav class="desktop-nav" aria-label="پیمایش اصلی">'+links+'</nav><div class="header-end"><button class="location-button od-touch" data-action="location">'+icon('pin')+'<span>تهران، '+esc(state.neighborhood.split(' و ')[0])+'</span>'+icon('down')+'</button><button class="avatar-button" data-action="privacy" aria-label="درباره حفظ اطلاعات">'+icon('shield')+'</button></div></div>';
  $('#bottom-nav').innerHTML=navItems().map(([to,i,label])=>'<a href="#'+to+'" '+(activeNav()===to?'class="active" aria-current="page"':'')+'><span class="nav-icon-wrap">'+icon(i)+'</span><span>'+label+'</span></a>').join('');
}
function journeyProgress(){
 const step=['stores','store','verify'].includes(route)?1:route==='plan'?2:0;
 return '<ol class="journey-progress" aria-label="مراحل خرید">'+['انتخاب محصول','پیدا کردن فروشگاه','برنامه خرید'].map((label,i)=>'<li class="'+(i===step?'current':i<step?'done':'')+'" '+(i===step?'aria-current="step"':'')+'><span class="journey-number">'+(i<step?icon('check'):fa(i+1))+'</span><span>'+label+'</span></li>').join('')+'</ol>';
}
function backLink(){return '<button class="back-button" data-action="back">'+icon('chevron')+'بازگشت</button>';}
function pageHeading(title,sub='',action=''){return '<div class="page-heading">'+backLink()+'<div class="heading-actions"><div><h1>'+title+'</h1>'+(sub?'<p>'+sub+'</p>':'')+'</div>'+action+'</div></div>';}
function neighborhoodMap(hero=false){
  const pins=hero?'<g transform="translate(215 122)"><circle r="42" fill="var(--primary)" opacity=".07"/><circle r="27" fill="var(--primary)" opacity=".08"/><path d="M0 12s-15-12-15-23a15 15 0 1 1 30 0C15 0 0 12 0 12" fill="var(--primary)"/><circle cy="-11" r="5" fill="white"/></g>':filteredStores().map(s=>'<g class="map-point" role="button" tabindex="0" aria-label="'+s.name+'، '+money(productPrice(s))+'" data-action="map-store" data-id="'+s.id+'" transform="translate('+[225,285,90,188][s.id]+' '+[185,120,95,205][s.id]+')"><circle class="pin-ring" r="23" fill="'+(s.verified?'var(--green)':'var(--primary)')+'" stroke="white" stroke-width="3"/><text class="pin-label" text-anchor="middle" dy="5">'+fa(s.id+1)+'</text></g>').join('');
  return '<svg class="map-drawing" viewBox="0 0 400 '+(hero?'250':'360')+'" role="img" aria-label="نقشه شماتیک محدوده حافظ و جمهوری؛ موقعیت فروشگاه‌ها نمونه است"><rect width="400" height="360" fill="#e9ece5"/><g fill="#e0e4db"><rect x="15" y="20" width="60" height="60" rx="8"/><rect x="110" y="20" width="75" height="70" rx="8"/><rect x="220" y="20" width="65" height="65" rx="8"/><rect x="320" y="20" width="64" height="70" rx="8"/><rect x="12" y="133" width="80" height="75" rx="8"/><rect x="115" y="135" width="64" height="65" rx="8"/><rect x="237" y="140" width="55" height="70" rx="8"/><rect x="322" y="140" width="65" height="64" rx="8"/><rect x="15" y="248" width="70" height="85" rx="8"/><rect x="115" y="250" width="70" height="80" rx="8"/><rect x="225" y="255" width="70" height="75" rx="8"/><rect x="325" y="250" width="60" height="80" rx="8"/></g><g stroke="#fafbf7" stroke-width="18" fill="none"><path d="M-10 110 410 110M-10 230 410 230M99-10V370M205-10v380M310-10v380"/></g><g stroke="#f6f8f1" stroke-width="6"><path d="M0 45h400M0 300h400M50 0v360M260 0v360M360 0v360"/></g><path d="M99 288v-58h106v-68" stroke="var(--primary)" stroke-width="3" stroke-dasharray="6 6" fill="none"/><g class="map-label"><text x="172" y="115" text-anchor="middle">خیابان جمهوری</text><text x="250" y="234" text-anchor="middle">خیابان سرهنگ سخایی</text><text x="215" y="50" transform="rotate(90 215 50)">حافظ</text><text x="55" y="175">ولیعصر</text></g><circle cx="99" cy="288" r="9" fill="#fff"/><circle cx="99" cy="288" r="5" fill="#367ca5"/>'+pins+'</svg>';
}
function home(){
 const known=state.intent==='known';
 const resume=Object.keys(state.answers).some(k=>['budget','use','feature'].includes(k));
 return '<div class="page home-page"><div class="hero-grid"><section class="home-start"><div class="hero-intro"><span class="eyebrow"><span class="tiny-dot"></span>برای خریدی که به رفتنش می‌ارزد</span><h1 class="hero-title">برای خرید حضوری<br><span class="accent-text">چی لازم داری؟</span></h1><p class="hero-description">کمکت می‌کنم محصول مناسب را انتخاب کنی، فروشگاه‌های نزدیک را مقایسه کنی و قبل از حرکت موجودی را بررسی کنی.</p></div><div class="start-workspace"><div class="intent-switch" aria-label="از کجا شروع می‌کنی؟"><button data-action="set-intent" data-intent="guided" class="'+(!known?'selected':'')+'" aria-pressed="'+!known+'"><span class="intent-label">کمکم کن انتخاب کنم</span><span class="intent-help">هنوز مدل را انتخاب نکردم</span></button><button data-action="set-intent" data-intent="known" class="'+(known?'selected':'')+'" aria-pressed="'+known+'"><span class="intent-label">فروشگاه پیدا کن</span><span class="intent-help">محصولم را می‌شناسم</span></button></div><form id="search-form" class="search-panel"><label class="search-label" for="shopping-query">'+(known?'نام یا مدل محصول را بنویس':'چه محصولی لازم داری؟')+' <span class="required-label">ضروری</span></label><div class="search-input-row">'+icon('search')+'<input id="shopping-query" class="search-input" type="search" name="query" value="'+esc(state.query)+'" placeholder="'+(known?'مثلاً سامسونگ گلکسی A۵۵':'مثلاً گوشی تا ۳۰ میلیون با دوربین خوب')+'" autocomplete="off" aria-required="true" aria-describedby="search-error search-help"><button class="voice" type="button" data-action="voice" aria-label="گفتن درخواست با صدا">'+icon('mic')+'</button></div><p id="search-error" class="field-error" role="alert" '+(!searchError?'hidden':'')+'>'+searchError+'</p><button class="btn btn-primary search-submit" type="submit"><span>'+(known?'پیدا کردن فروشگاه':'شروع انتخاب محصول')+'</span>'+icon('arrow')+'</button><p id="search-help" class="search-help">'+(known?'بدون پرسش‌نامه، مستقیم سراغ فروشگاه‌ها برو.':'از چیزهایی که می‌نویسی شروع می‌کنیم؛ سؤال تکراری نمی‌پرسیم.')+'</p></form></div><span class="suggestion-label">برای شروع، یکی را امتحان کن</span><div class="od-cluster suggestions">'+['گوشی تا ۳۰ میلیون','کتانی مناسب پیاده‌روی','لپ‌تاپ دانشجویی','خرید قسطی'].map(s=>'<button class="chip" data-action="suggest" data-query="'+s+'">'+s+'</button>').join('')+'</div>'+(resume?'<button class="resume-search" data-action="resume">'+icon('refresh')+'ادامه انتخاب قبلی'+icon('arrow')+'</button>':'')+'</section><aside class="near-example" aria-label="نمونه مسیر خرید"><div class="example-heading"><span class="example-overline">از انتخاب تا فروشگاه</span><span class="badge">یک نمونه از مسیر خرید</span></div><h2>انتخاب روشن.<br><span>خرید نزدیک.</span></h2><div class="example-product">'+image(products[0])+'<div class="od-field"><span class="example-label">مثلاً برای کارهای روزمره</span><strong>گلکسی A۵۵</strong><span class="example-feature">حافظه ۲۵۶ گیگابایت</span><span class="example-price">'+money(products[0].price)+'</span><span class="example-label">قیمت نمونه</span></div></div><div class="example-store"><div class="example-store-icon">'+icon('store')+'</div><div class="od-field od-fill"><strong>فروشگاه مناسب، نزدیک تو</strong><span>مقایسه قیمت، فاصله و موجودی</span></div>'+icon('checkCircle')+'</div><div class="example-path"><span>انتخاب</span><span class="path-line"></span><span>بررسی</span><span class="path-line"></span><span>حرکت</span></div><p class="example-note">'+icon('info')+'اطلاعات این پیش‌نمایش نمونه است.</p></aside></div><section class="how-section"><div class="section-heading"><div><span class="section-kicker">از همین‌جا شروع کن</span><h2>سه قدم ساده تا خرید حضوری</h2></div><span class="desktop-only muted small">تصمیم نهایی همیشه با توست</span></div><div class="steps-grid">'+[['۱','نیازت را بگو','بودجه و چیزهایی که برایت مهم‌اند.'],['۲','انتخاب‌ها را کنار هم ببین','تفاوت محصول‌ها و فروشگاه‌ها را مقایسه کن.'],['۳','قبل از حرکت بررسی کن','موجودی، قیمت و نشانی را همراه داشته باش.']].map(s=>'<div class="how-step"><span class="step-number">'+s[0]+'</span><div><h3>'+s[1]+'</h3><p>'+s[2]+'</p></div></div>').join('')+'</div></section><section class="featured-section"><div class="section-heading"><div><h2>محصولت را انتخاب کرده‌ای؟</h2><p>برای تجربه نمونه، مستقیم فروشگاه‌های یک گوشی را ببین.</p></div><button class="section-link" data-action="demo">دیدن پیشنهادها '+icon('arrow')+'</button></div><div class="quick-products">'+products.map(p=>'<article class="quick-product">'+image(p)+'<div class="od-field od-fill"><h3>'+p.short+'</h3><span class="muted small">از '+fa(p.price/1000000)+' میلیون تومان · نمونه</span><button class="section-link" data-action="product-stores" data-id="'+p.id+'">پیدا کردن فروشگاه '+icon('arrow')+'</button></div></article>').join('')+'</div></section><footer class="home-footer">نزدیکا؛ برای انتخاب آگاهانه و خرید حضوری ساده‌تر. '+sampleNote()+'</footer></div>';
}
function answerChips(){return '<div class="answers">'+questions.filter(q=>state.answers[q.key]).map(q=>'<button class="chip" data-action="edit-answer" data-key="'+q.key+'" aria-label="ویرایش '+esc(state.answers[q.key])+'">'+esc(state.answers[q.key])+icon('tune')+'</button>').join('')+'</div>';}
function discovery(){
 const flow=state.flow?.length?state.flow:[0,1,2];
 if(!flow.includes(state.step))state.step=flow[0];
 const q=questions[state.step],position=flow.indexOf(state.step),last=position===flow.length-1;
 const options=q.options.concat([['مطمئن نیستم','با کمک پیشنهادها تصمیم می‌گیرم'],['فرقی ندارد','انتخاب را باز می‌گذارم']]);
 return '<div class="page narrow has-action">'+pageHeading('بیا انتخاب را ساده کنیم','فقط چیزهایی را می‌پرسیم که هنوز نگفته‌ای.')+'<div class="journey-label">'+icon('search')+'<span>'+esc(state.query||'انتخاب گوشی مناسب')+'</span></div>'+answerChips()+'<section class="panel discovery-panel"><div class="progress-label"><span>سؤال '+fa(position+1)+' از '+fa(flow.length)+'</span><span>'+(last?'آخرین سؤال ضروری':'یک قدم نزدیک‌تر به انتخاب')+'</span></div><div class="progress-track" aria-hidden="true">'+flow.map((_,i)=>'<span class="'+(i<=position?'done':'')+'"></span>').join('')+'</div><h2>'+q.title+'</h2><p class="question-subtitle">'+q.sub+'</p><div class="options-grid">'+options.map(([label,help])=>'<button class="option '+(state.answers[q.key]===label?'selected':'')+'" data-action="answer" data-value="'+label+'" aria-pressed="'+(state.answers[q.key]===label)+'"><span class="option-check">'+(state.answers[q.key]===label?icon('check'):'')+'</span><span class="od-field"><strong>'+label+'</strong><small>'+help+'</small></span></button>').join('')+'</div><button class="skip-question section-link" data-action="skip-question">فعلاً از این سؤال بگذر '+icon('arrow')+'</button></section><details class="optional-preferences panel"><summary>برند و روش پرداخت <span>اختیاری</span></summary><p class="muted small">اگر برایت مهم است، همین‌جا مشخص کن.</p>'+preferenceFields()+'</details><p class="privacy-line">'+icon('shield')+'انتخاب‌هایت در همین مرورگر حفظ می‌شوند.</p><div class="action-bar"><button class="btn btn-secondary" data-action="previous" '+(position===0?'disabled':'')+'>'+icon('chevron')+'قبلی</button><button class="btn btn-primary" data-action="next" '+(!state.answers[q.key]?'disabled':'')+'>'+(last?'دیدن پیشنهادها':'ادامه')+icon('arrow')+'</button></div></div>';
}
function preferenceFields(){
 return '<div class="preference-fields"><div><label for="brand-preference">برند</label><select id="brand-preference" data-preference="brand">'+['فرقی ندارد','سامسونگ','شیائومی','اپل','برند دیگری','مطمئن نیستم'].map(v=>'<option '+(state.answers.brand===v?'selected':'')+'>'+v+'</option>').join('')+'</select></div><div><label for="payment-preference">روش پرداخت</label><select id="payment-preference" data-preference="installment">'+['فرقی ندارد','بله، خرید قسطی','نه، نقدی می‌خرم','مطمئن نیستم'].map(v=>'<option '+(state.answers.installment===v?'selected':'')+'>'+v+'</option>').join('')+'</select></div></div>';
}
function preferencesDialog(){
 showDialog('برند و روش پرداخت','<p>این انتخاب‌ها اختیاری‌اند و هر وقت بخواهی قابل تغییرند.</p>'+preferenceFields()+button('ثبت انتخاب‌ها','apply-preferences','btn-primary full'));
}
function productCard(p,compact=false){
 const selected=state.compare.includes(p.id),saved=state.saved.includes(p.id),best=p.id===bestProduct().id;
 const brief=best?'با اولویت «'+esc(state.answers.feature||'استفاده روزمره')+'» هماهنگ‌تر است.':p.id==='redmi'?'برای شارژ سریع و جزئیات عکس، ارزش بررسی دارد.':'برای کارهای روزمره و هزینه کمتر، ارزش بررسی دارد.';
 return '<article class="product-card od-tile '+(best?'best-product':'')+'" id="product-'+p.id+'"><div><div class="product-top">'+badge(best?'هماهنگی بیشتر':p.match,best?'good':'',best?'checkCircle':'info')+'<button class="icon-button '+(saved?'saved':'')+'" data-action="save-product" data-id="'+p.id+'" aria-pressed="'+saved+'" aria-label="'+(saved?'حذف از':'افزودن به')+' ذخیره‌شده‌ها، '+p.name+'">'+icon('bookmark')+'</button></div>'+image(p)+'</div><div class="product-content"><div><h3 class="product-title">'+p.name+'</h3><p class="product-model">نسخه ۲۵۶ گیگابایتی · اینترنت نسل پنجم</p></div><div class="price-block od-field"><span class="price-label">بازه قیمت نمونه</span><span class="product-price">'+fa(p.price/1000000)+' تا '+fa(p.high/1000000)+' <small>میلیون تومان</small></span></div><div class="product-tags" aria-label="سه ویژگی اصلی">'+p.features.map(f=>'<span>'+f+'</span>').join('')+'</div><div class="fit-reason"><span class="fit-label">چرا مناسب توست؟</span><p>'+brief+'</p><button class="section-link" data-action="why" data-id="'+p.id+'">چرا پیشنهاد شد؟ '+icon('arrow')+'</button></div><div class="product-meta"><span>'+icon('store')+fa(p.stores)+' فروشگاه نمونه</span><span>مشخصات مدل</span></div><div class="product-actions">'+button('مشاهده فروشگاه‌ها '+icon('arrow'),'product-stores','btn-secondary full','data-id="'+p.id+'"')+'<button class="compare-button '+(selected?'selected':'')+'" data-action="compare-toggle" data-id="'+p.id+'" aria-pressed="'+selected+'"><span class="compare-check">'+(selected?icon('check'):'')+'</span>'+(selected?'به مقایسه اضافه شد':'افزودن به مقایسه')+'</button></div></div></article>';
}
function compareTray(){
 const selected=state.compare.map(id=>products.find(p=>p.id===id));
 const control=selected.length>=2?button('مقایسه انتخاب‌ها '+icon('arrow'),'open-compare','btn-primary'):selected.length===1?button('مقایسه با گزینه بعدی','compare-auto','btn-primary'):button('فروشگاه‌های پیشنهاد اول '+icon('arrow'),'product-stores','btn-primary','data-id="'+bestProduct().id+'"');
 return '<div class="action-bar recommendation-bar"><div class="compare-tray">'+(selected.length?'<div class="tray-chips">'+selected.map(p=>'<button data-action="compare-toggle" data-id="'+p.id+'" class="tray-chip" aria-label="حذف '+p.short+' از مقایسه">'+p.short+icon('close')+'</button>').join('')+'</div><span class="tray-help">'+fa(selected.length)+' انتخاب برای مقایسه</span>':'<span class="tray-help">هنوز مرددی؟ دو محصول را به مقایسه اضافه کن.</span>')+'</div>'+control+'</div>';
}
function bestProduct(){
 if(state.answers.brand==='شیائومی')return products[1];
 if(state.answers.brand==='سامسونگ')return state.answers.feature==='قیمت مناسب'?products[2]:products[0];
 if(state.answers.feature==='قیمت مناسب'||state.answers.budget==='تا ۲۰ میلیون')return products[2];
 if(state.answers.feature==='دوربین خوب'||state.answers.use==='عکس و فیلم')return products[1];
 return products[0];
}
function reasonFor(p){return p.id===bestProduct().id?'با اولویت «'+esc(state.answers.feature||'استفاده روزمره')+'»، این گزینه ارزش بررسی بیشتری دارد. '+p.reason:p.reason;}
function applicableProducts(){
 if(state.category!=='phone'||state.answers.brand==='اپل'||state.answers.brand==='برند دیگری'||state.answers.budget==='تا ۲۰ میلیون')return [];
 let list=[...products].sort((a,b)=>(a.id===bestProduct().id?-1:b.id===bestProduct().id?1:0));
 if(state.answers.brand==='سامسونگ')list=list.filter(p=>p.id!=='redmi');
 if(state.answers.brand==='شیائومی')list=list.filter(p=>p.id==='redmi');
 return list;
}
function recommendations(){
 if(loadingResults)return '<div class="page">'+pageHeading('داریم انتخاب‌ها را مرتب می‌کنیم','بر اساس بودجه و نیازهایی که گفتی')+'<div class="product-grid" role="status" aria-label="در حال آماده‌سازی پیشنهادها">'+products.map(()=>'<div class="skeleton-card"><div class="skeleton skeleton-image"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line"></div></div>').join('')+'</div></div>';
 const list=applicableProducts();
 if(!list.length)return '<div class="page narrow">'+pageHeading('این بار انتخاب مناسبی پیدا نشد')+answerChips()+'<div class="empty-state">'+icon('search')+'<h2>بیا جست‌وجو را کمی تغییر بدهیم</h2><p>فهرست این نمونه شامل سه گوشی میان‌رده است. برای این دسته، برند یا بودجه هنوز محصولی در فهرست نداریم.</p>'+button('تغییر ترجیحات','change-preferences','btn-primary')+' '+button('دیدن نمونه گوشی تا ۳۰ میلیون','demo','btn-secondary')+'</div>'+sampleNote()+'</div>';
 return '<div class="page has-action">'+pageHeading('چند انتخاب، متناسب با نیاز تو','از همین گزینه‌ها شروع کن؛ تصمیم نهایی با توست.',button(icon('tune')+'ویرایش انتخاب‌ها','change-preferences','btn-secondary compact'))+answerChips()+'<div class="recommendation-heading"><div><span class="section-kicker">پیشنهادهای نزدیکا</span><h2>'+fa(list.length)+' محصول برای بررسی</h2></div><span class="small muted">هماهنگی با نیاز، نه تضمین کیفیت</span></div><div class="product-grid">'+list.map(p=>productCard(p)).join('')+'</div>'+sampleNote('توضیح پیشنهادها یک برداشت بر اساس پاسخ‌هایت است. مشخصات مدل قابل بررسی است؛ قیمت‌ها و فروشگاه‌ها در این نسخه نمونه‌اند.')+compareTray()+'</div>';
}
function compare(){
 const list=state.compare.map(id=>products.find(p=>p.id===id));
 if(list.length<2)return '<div class="page narrow">'+pageHeading('مقایسه محصول‌ها')+'<div class="empty-state">'+icon('compare')+'<h2>دو انتخاب را کنار هم بگذار</h2><p>از پیشنهادها، دو یا سه محصول به مقایسه اضافه کن تا تفاوت‌هایشان روشن شود.</p>'+button('دیدن پیشنهادها','recommendations','btn-primary')+'</div></div>';
 if(!state.compare.includes(state.product))state.product=list[0].id;
 const best=list.find(p=>p.id===bestProduct().id)||list[0];
 const sections=[
 ['بازه قیمت نمونه',p=>'<b>'+fa(p.price/1000000)+' تا '+fa(p.high/1000000)+'</b><span style="display:block">میلیون تومان</span>'],
 ['مشخصات مهم',p=>p.spec+'<br>'+p.features[0]],
 ['نقطه قوت',p=>p.strengths],
 ['محدودیت‌ها',p=>p.weaknesses],
 ['فروشگاه و پرداخت',p=>fa(p.stores)+' فروشگاه نمونه<br>'+(p.installment?'قسطی: نیازمند تأیید فروشگاه':'قسطی: در نمونه ثبت نشده')]
 ];
 return '<div class="page has-action '+(list.length===3?'comparison-triple':'')+'" style="--compare-count:'+list.length+'">'+pageHeading('کدام انتخاب برای تو بهتر است؟','تفاوت‌های مهم، بدون جدول شلوغ')+'<div class="results-summary">'+icon('shield')+'<div><h2>'+best.short+'؛ پیشنهاد متناسب‌تر</h2><p>'+reasonFor(best)+'</p></div></div><div class="compare-intro">'+list.map(p=>'<article class="compare-product '+(p.id===best.id?'best':'')+'"><button class="icon-button" data-action="remove-compare" data-id="'+p.id+'" aria-label="حذف '+p.name+' از مقایسه">'+icon('close')+'</button>'+image(p)+'<h2>'+p.short+'</h2>'+(p.id===best.id?badge('متناسب‌تر با نیاز تو','good','checkCircle'):'')+'</article>').join('')+'</div>'+sections.map(([title,value])=>'<section class="compare-section"><h3>'+title+'</h3><div class="compare-values">'+list.map(p=>'<div class="compare-value"><span class="value-name">'+p.short+'</span>'+value(p)+'</div>').join('')+'</div></section>').join('')+'<section class="panel compare-choice"><h3>با کدام محصول ادامه می‌دهی؟</h3>'+list.map(p=>'<label><input type="radio" name="selected-product" value="'+p.id+'" '+(state.product===p.id?'checked':'')+'>'+p.name+'</label>').join('')+'</section>'+sampleNote()+'<div class="action-bar"><div class="action-context"><strong>'+currentProduct().short+'</strong>انتخاب فعلی تو</div>'+button('فروشگاه‌های این محصول را ببین '+icon('arrow'),'stores','btn-primary')+'</div></div>';
}
function storeCard(s){
 return '<article class="store-card '+(s.verified?'preferred':'')+'" id="store-'+s.id+'"><div class="store-card-heading"><div class="store-identity"><div class="store-avatar">'+icon('store')+'</div><div class="od-field"><h2>'+s.name+'</h2><span class="muted small">'+s.mall+'</span></div></div>'+badge(s.open?'باز تا '+s.close:'اکنون بسته است',s.open?'good':'warn','clock')+'</div><div class="store-key-facts"><div class="od-field"><span class="fact-label">قیمت ثبت‌شده · نمونه</span><strong class="store-main-price od-nowrap">'+fa(productPrice(s))+' <small>تومان</small></strong></div><div class="od-field store-main-distance"><span class="fact-label">فاصله تقریبی</span><strong>'+fa(s.walk)+' دقیقه پیاده</strong><span>'+fa(s.drive)+' دقیقه با خودرو</span></div></div><div class="freshness-line '+(s.id===1?'is-old':'')+'">'+icon(s.id===1?'alert':'clock')+'<span>'+(s.id===1?'قیمت ۲۳ روز پیش؛ قبل از حرکت بپرس':'ثبت قیمت: '+s.fresh)+'</span></div><div class="store-statuses">'+badge(s.status,s.verified?'good':'warn',s.verified?'shield':'alert')+badge(s.installment?'امکان خرید قسطی':'اقساط ثبت نشده','','card')+'</div><p class="store-address">'+icon('pin')+'<span>'+s.area+'، '+s.mall+'، '+s.floor+'، واحد '+s.unit+'</span></p>'+button('جزئیات و بررسی موجودی '+icon('arrow'),'store-detail',s.verified?'btn-primary full':'btn-secondary full','data-id="'+s.id+'"')+'</article>';
}
function filteredStores(){
 let list=stores.filter(s=>(!state.filters.includes('open')||s.open)&&(!state.filters.includes('installment')||s.installment)&&(!state.filters.includes('verified')||s.verified));
 if(state.answers.installment==='بله، خرید قسطی')list=list.filter(s=>s.installment);
 return list.sort((a,b)=>state.sort==='cheapest'?a.price-b.price:a.walk-b.walk);
}
function storesPage(){
 const list=filteredStores();
 const filterDefs=[['open','باز است'],['nearest','نزدیک‌ترین'],['cheapest','ارزان‌ترین'],['installment','خرید قسطی'],['verified','موجودی تأییدشده']];
 return '<div class="page">'+pageHeading('فروشگاه‌های نزدیک تو',currentProduct().name+' · '+state.neighborhood)+'<div class="store-toolbar"><div class="segmented" aria-label="نحوه نمایش فروشگاه‌ها"><button data-action="view" data-view="list" class="'+(state.view==='list'?'active':'')+'" aria-pressed="'+(state.view==='list')+'">'+icon('list')+'لیست</button><button data-action="view" data-view="map" class="'+(state.view==='map'?'active':'')+'" aria-pressed="'+(state.view==='map')+'">'+icon('map')+'نقشه</button></div>'+button(icon('pin')+'تغییر محدوده','location','btn-secondary compact')+'</div><div class="od-rail filters" aria-label="فیلتر فروشگاه‌ها">'+filterDefs.map(([id,label])=>{const active=['nearest','cheapest'].includes(id)?state.sort===id:state.filters.includes(id);return '<button class="chip '+(active?'selected':'')+'" data-action="filter" data-filter="'+id+'" aria-pressed="'+active+'">'+(active?icon('check'):'')+label+'</button>';}).join('')+'</div><p class="filter-count">'+fa(list.length)+' فروشگاه نمونه · فاصله‌ها تقریبی از مرکز محدوده‌اند</p><div class="store-layout '+(state.view==='map'?'map-mode':'')+'"><div class="store-list">'+(list.length?list.map(storeCard).join(''):'<div class="empty-state">'+icon('store')+'<h2>فروشگاهی با این شرایط نیست</h2><p>یکی از فیلترها را بردار یا محدوده را تغییر بده.</p>'+button('پاک کردن فیلترها','clear-filters','btn-primary')+'</div>')+'</div><aside class="map-panel">'+neighborhoodMap()+'<div class="map-legend"><span><span class="legend-dot green"></span>موجودی نمونه تأییدشده</span><span><span class="legend-dot"></span>نیازمند بررسی</span></div><p class="map-caption">نقشه شماتیک است؛ نشانگرها و فاصله‌ها برای نمایش تجربه‌اند. برای مسیر واقعی از مسیریابی استفاده کن.</p></aside></div>'+sampleNote()+'</div>';
}
function storeDetail(){
 const s=currentStore();
 return '<div class="page has-action">'+backLink()+'<div class="store-detail-grid"><div><section class="panel"><div class="detail-title"><div class="store-avatar">'+icon('store')+'</div><div><h1>'+s.name+'</h1><p class="muted">'+s.mall+' · فروشگاه نمونه</p></div></div><div class="store-statuses">'+badge(s.open?'باز تا '+s.close:'اکنون بسته است',s.open?'good':'warn','clock')+badge(s.status,s.verified?'good':'warn',s.verified?'shield':'alert')+'</div><div class="store-price-row" style="margin-top:24px"><span>'+currentProduct().short+'</span><strong>'+fa(productPrice(s))+' <small>تومان</small></strong></div><p class="small muted">قیمت نمونه · آخرین ثبت: '+s.fresh+'</p>'+(s.id===1?'<div class="warning">'+icon('alert')+'این قیمت ۲۳ روز پیش ثبت شده است. قبل از حرکت، قیمت امروز را بپرس.</div>':'')+'</section><section class="panel"><h2 class="detail-section-title">نشانی دقیق، بدون سردرگمی</h2><div class="address-grid">'+[['محله',s.area],['مرکز خرید',s.mall],['طبقه',s.floor],['شماره واحد',s.unit]].map(([k,v])=>'<div class="od-field"><small>'+k+'</small><strong>'+v+'</strong></div>').join('')+'</div><p class="helper">نشانی واحدها در این نمونه ساختگی است؛ مقصد مسیریابی، محدوده مرکز خرید است.</p><div class="detail-actions" style="margin-top:20px">'+button(icon('phone')+'تماس با فروشگاه','call','btn-secondary')+button(icon('route')+'مسیریابی','directions','btn-secondary')+'</div></section><section class="panel"><h2 class="detail-section-title">این سؤال را از فروشگاه بپرس</h2><p class="quote">سلام، این محصول موجود است؟ قیمت امروز آن چقدر است و فروشگاه تا چه ساعتی باز است؟</p>'+button(icon('copy')+'کپی متن سؤال','copy-question','btn-secondary compact')+'</section><section class="panel"><h2 class="detail-section-title">پرداخت قسطی حضوری</h2>'+(s.installment?'<div class="od-cluster">'+badge('اسنپ‌پی · نیازمند استعلام','','card')+badge('دیجی‌پی · نیازمند استعلام','','card')+'</div><p class="helper">ارائه‌دهنده‌ها صرفاً نمونه‌اند. پذیرش حضوری، پیش‌پرداخت و شرایط اعتبار باید از فروشگاه پرسیده شود.</p>':'<p class="muted">پرداخت قسطی برای این فروشگاه ثبت نشده است. پیش از مراجعه تماس بگیر.</p>')+'</section></div><aside><section class="panel"><h2 class="detail-section-title">'+icon('clock')+' ساعت کاری هفتگی</h2><div class="hours">'+['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'].map((d,i)=>'<div class="hour-row"><span>'+d+'</span><span class="od-nowrap">'+(i===6?'۱۱:۰۰ تا ۱۸:۰۰':'۱۰:۰۰ تا '+s.close)+'</span></div>').join('')+'</div><p class="helper">برنامه نمونه است؛ تعطیلات و ساعت امروز را دوباره بپرس.</p></section><section class="panel"><h2 class="detail-section-title">اگر اینجا نشد</h2><p class="muted small">یک گزینه نزدیک برای ادامه خرید</p><div class="od-row" style="margin-top:16px"><div class="store-avatar">'+icon('store')+'</div><div class="od-field"><strong>'+stores[s.id===0?3:0].name+'</strong><small class="muted">'+stores[s.id===0?3:0].mall+'</small></div></div>'+button('دیدن فروشگاه جایگزین '+icon('arrow'),'store-detail','btn-secondary full','data-id="'+(s.id===0?3:0)+'"')+'</section></aside></div>'+sampleNote()+'<div class="action-bar"><div class="action-context"><strong>قبل از حرکت مطمئن شو</strong>بررسی نمایشی، بدون تماس واقعی</div>'+button(icon('shield')+'بررسی موجودی','verify-start','btn-primary')+'</div></div>';
}
function verification(){
 const v=state.verification,s=currentStore();
 if(!v||v.store!==s.id)return '<div class="page narrow">'+pageHeading('بررسی موجودی')+'<div class="empty-state">'+icon('shield')+'<h2>اول یک فروشگاه انتخاب کن</h2><p>بعد می‌توانی وضعیت موجودی و قیمت را در مسیر نمونه بررسی کنی.</p>'+button('دیدن فروشگاه‌ها','stores','btn-primary')+'</div></div>';
 const stages=[['calling','phone','در حال آماده‌کردن ارتباط','مشخصات محصول و سؤال‌های لازم آماده می‌شوند.'],['waiting','clock','منتظر پاسخ فروشگاه','این یک پاسخ شبیه‌سازی‌شده است؛ تماس واقعی برقرار نشده.'],['stock','checkCircle','موجودی تأیید شد','در پاسخ نمونه، این محصول موجود است. قیمت را هم بررسی می‌کنیم.'],['confirmed','shield','موجودی و قیمت تأیید شد','پاسخ نمونه ثبت شد. حالا می‌توانی برنامه خریدت را آماده کنی.'],['no-response','phone','فروشگاه پاسخ نداد','منتظر نمان؛ یک فروشگاه نزدیک دیگر برایت داریم.'],['out','bag','این محصول موجود نیست','برای ادامه خرید، فروشگاه جایگزین را ببین.'],['closed','clock','فروشگاه اکنون بسته است','یک گزینه باز در همین محدوده پیشنهاد می‌کنیم.']];
 const stage=stages.find(a=>a[0]===v.status)||stages[0], success=v.status==='confirmed', fail=['no-response','out','closed'].includes(v.status), pending=!success&&!fail;
 const idx=['calling','waiting','stock','confirmed'].indexOf(v.status);
 return '<div class="page narrow has-action">'+pageHeading('بررسی پیش از حرکت',s.name+' · '+currentProduct().name)+'<section class="panel verification-card"><div class="verification-symbol '+(success?'good':fail?'warn':'')+'">'+icon(stage[1])+'</div><span class="badge">بررسی نمایشی</span><h1 style="margin-top:16px">'+stage[2]+'</h1><p>'+stage[3]+'</p>'+(pending?'<span class="pulse-dot" aria-hidden="true"></span><span class="small muted" role="status">در حال ادامه بررسی نمونه…</span>':'')+'<ol class="verification-timeline">'+[['اطلاعات محصول آماده شد',0],['درخواست قیمت و موجودی ارسال شد',1],['موجودی محصول تأیید شد',2],['قیمت روز ثبت شد',3]].map(([label,i])=>'<li class="'+(idx>i||success?'complete':idx===i?'current':'')+'">'+icon(idx>i||success?'checkCircle':'clock')+'<span>'+label+(i===3&&success?' · '+money(productPrice(s)):'')+'</span></li>').join('')+'</ol>'+(success?'<div class="why-box"><strong>زمان پاسخ نمونه</strong>'+esc(v.time)+' · اعتبار برای خرید واقعی ندارد</div>':'')+(fail?'<div class="panel" style="text-align:right"><h2 class="detail-section-title">پیشنهاد بعدی: دیجیتال آبان</h2><p>مجتمع چارسو · باز تا ساعت ۲۱:۰۰ · اطلاعات نمونه</p>'+button('بررسی فروشگاه جایگزین '+icon('arrow'),'alternative','btn-primary full')+'</div>':'')+'</section>'+sampleNote()+'<div class="action-bar">'+(success?button('آماده‌کردن برنامه خرید '+icon('arrow'),'create-plan','btn-primary full'):fail?button('دیدن همه فروشگاه‌ها','stores','btn-secondary full'):button('انصراف و بازگشت به فروشگاه','cancel-verification','btn-secondary full'))+'</div></div>';
}
function planPage(){
 const plan=state.plan;
 if(!plan)return '<div class="page narrow">'+pageHeading('برنامه خرید تو')+'<section class="empty-state">'+icon('plan')+'<h2>هنوز برنامه‌ای نساخته‌ای</h2><p>یک محصول و فروشگاه انتخاب کن. بعد از بررسی، مسیر و جزئیات خریدت اینجا آماده می‌شود.</p>'+button('شروع انتخاب محصول','demo','btn-primary')+'</section></div>';
 const p=products.find(x=>x.id===plan.product)||products[0],s=stores.find(x=>x.id===plan.store)||stores[0],backup=stores.find(x=>x.id!==s.id&&x.open)||stores[3];
 return '<div class="page has-action">'+backLink()+'<div class="plan-hero">'+icon('checkCircle')+'<div><h1>برنامه خریدت آماده است</h1><p>یک انتخاب مشخص، یک مقصد اصلی و یک گزینه جایگزین.</p></div></div><div class="plan-grid"><div><section class="panel"><div class="plan-product">'+image(p)+'<div><span class="section-kicker">محصول انتخابی تو</span><h2>'+p.name+'</h2><p class="product-price">'+fa(plan.price)+' <small>تومان</small></p><p class="muted small">قیمت تأییدشده در پاسخ نمونه</p></div></div></section><section class="panel"><h2 class="detail-section-title">مسیر خرید حضوری</h2><div class="trip-stop"><span class="trip-number">۱</span><div><h3>'+s.name+' <span class="badge good">مقصد اصلی</span></h3><p>تهران، '+s.area+'، '+s.mall+'<br>'+s.floor+'، واحد '+s.unit+'</p><p>'+icon('clock')+'ساعت کار: ۱۰:۰۰ تا '+s.close+'</p><p>'+icon('walk')+'حدود '+fa(s.walk)+' دقیقه از مرکز محدوده</p></div></div><div class="trip-stop"><span class="trip-number">۲</span><div><h3>'+backup.name+' <span class="badge">جایگزین</span></h3><p>'+backup.mall+'، '+backup.floor+'، واحد '+backup.unit+'</p><p>موجودی نیازمند بررسی است.</p><button class="section-link" data-action="store-detail" data-id="'+backup.id+'">جزئیات جایگزین '+icon('arrow')+'</button></div></div></section></div><aside><section class="panel"><h2 class="detail-section-title">قبل از بیرون رفتن</h2><div class="checklist">'+[['card','کارت بانکی یا روش پرداخت'],['warranty','بررسی گارانتی و شناسه کالا'],['model','تطبیق مدل، حافظه و رنگ'],['invoice','گرفتن فاکتور معتبر']].map(([id,label])=>'<label><input type="checkbox" data-check="'+id+'" '+(plan.checks&&plan.checks[id]?'checked':'')+'>'+label+'</label>').join('')+'</div></section><section class="panel"><h2 class="detail-section-title">خلاصه بررسی</h2><div class="od-stack"><span class="small">زمان پاسخ نمونه: '+esc(plan.time)+'</span><span class="small">روش تأیید: شبیه‌سازی در این نسخه</span>'+badge('پاسخ نمونه ثبت شده','good','shield')+'</div><div class="warning">'+icon('alert')+'اطلاعات واقعی تأیید نشده است. قیمت، موجودی و ساعت کار را پیش از خرید دوباره بپرس. نشانی واحدها نمونه است.</div></section></aside></div><div class="action-bar">'+button(icon('bookmark')+(state.savedPlan?'برنامه ذخیره شده':'ذخیره برنامه خرید'),'save-plan',state.savedPlan?'btn-soft':'btn-secondary')+button(icon('route')+'شروع مسیریابی','plan-directions','btn-primary')+'</div></div>';
}
function savedPage(){
 const list=products.filter(p=>state.saved.includes(p.id));
 return '<div class="page">'+pageHeading('ذخیره‌شده‌های تو','انتخاب‌هایت در همین مرورگر می‌مانند.')+(state.savedPlan?'<section class="panel saved-plan"><div><span class="section-kicker">برنامه خرید ذخیره‌شده</span><h2>'+(products.find(p=>p.id===state.savedPlan.product)||products[0]).name+'</h2><p class="small muted">'+esc(state.savedPlan.time)+' · اطلاعات نمونه</p></div>'+button('دیدن برنامه','open-saved-plan','btn-secondary compact')+'</section>':'')+(list.length?'<div class="product-grid">'+list.map(p=>productCard(p)).join('')+'</div>':!state.savedPlan?'<div class="empty-state">'+icon('bookmark')+'<h2>انتخاب‌های خوب را نگه دار</h2><p>روی نشان ذخیره در کارت محصول بزن تا بعداً راحت پیدایش کنی.</p>'+button('دیدن پیشنهادها','demo','btn-primary')+'</div>':'<p class="muted">هنوز محصولی ذخیره نکرده‌ای.</p>')+'</div>';
}
const views={home,discovery,recommendations,compare,stores:storesPage,store:storeDetail,verify:verification,plan:planPage,saved:savedPage};
function render(options={}){
 const focused=document.activeElement;
 const focusAction=focused?.dataset?.action;
 const focusValue=focused?.dataset?.value;
 const focusId=focused?.dataset?.id;
 const focusedRadio=focused?.name==='selected-product'?focused.value:null;
 if(!views[route])route='home';
 renderChrome(); main.innerHTML=views[route]();
 const page=main.querySelector('.page');if(page&&!['home','saved'].includes(route))page.insertAdjacentHTML('afterbegin',journeyProgress());
 $('#announcer').textContent=main.querySelector('.verification-card h1')?.textContent||main.querySelector('h1')?.textContent||'';
 document.querySelectorAll('.product-model').forEach(el=>{el.textContent='نسخه ۲۵۶ گیگابایتی · اینترنت نسل پنجم';});
 document.querySelectorAll('.map-panel .map-drawing').forEach(el=>el.setAttribute('role','group'));
 const searchField=$('#shopping-query');if(searchField)searchField.setAttribute('aria-required','true');
 document.title=({home:'همراه خرید حضوری تو',discovery:'انتخاب محصول',recommendations:'پیشنهادهای تو',compare:'مقایسه محصول‌ها',stores:'فروشگاه‌های نزدیک',store:currentStore().name,verify:'بررسی موجودی',plan:'برنامه خرید',saved:'ذخیره‌شده‌ها'}[route])+' | نزدیکا';
 if(options.focus){main.focus({preventScroll:true});}
 else if(focusAction){const replacement=Array.from(document.querySelectorAll('[data-action]')).find(el=>el.dataset.action===focusAction&&el.dataset.value===focusValue&&el.dataset.id===focusId);replacement?.focus({preventScroll:true});}
 else if(focusedRadio){Array.from(document.querySelectorAll('[name="selected-product"]')).find(el=>el.value===focusedRadio)?.focus({preventScroll:true});}
}
function go(to,back=false){
 if(!views[to])return;
 if(loadingResults&&to!=='recommendations')loadingResults=false;
 scrollPositions[route]=window.scrollY;
 if(!back&&route!==to)historyRoutes.push(route);
 route=to;
 if(location.hash!=='#'+to)history.pushState(null,'','#'+to);
 clearTimeout(timer);
 render({focus:true});
 window.scrollTo({top:back?(scrollPositions[to]||0):0,behavior:'instant'});
 if(to==='verify')continueVerification();
}
function showDialog(title,content){
 const dialog=$('#dialog');dialog.className='dialog';
 dialog.innerHTML='<div class="dialog-header"><h2 id="dialog-title">'+title+'</h2><button class="icon-button" data-action="close-dialog" aria-label="بستن پنجره">'+icon('close')+'</button></div>'+content;
 if(!dialog.open)dialog.showModal();
}
function closeDialog(){ $('#dialog').close(); }
function locationDialog(){
 showDialog('کجای تهران خرید می‌کنی؟','<p>برای پیدا کردن فروشگاه‌های نزدیک، محدوده‌ات را انتخاب کن. دسترسی به موقعیت اختیاری است.</p><label for="neighborhood">محله یا محدوده</label><select id="neighborhood">'+['حافظ و جمهوری','ولیعصر','تجریش','صادقیه','نارمک','میدان ونک'].map(n=>'<option '+(state.neighborhood===n?'selected':'')+'>'+n+'</option>').join('')+'</select>'+button('انتخاب این محدوده','set-location','btn-primary full')+button(icon('pin')+'استفاده از موقعیت من','geolocate','btn-secondary full')+'<p id="location-feedback" class="helper" role="status">موقعیت دقیق ذخیره نمی‌شود. فروشگاه‌های این نمونه فقط در محدوده حافظ نمایش داده می‌شوند.</p>');
}
function startSearch(query){
 query=String(query||'').trim();
 if(!query){searchError='نام محصول یا چیزی را که لازم داری بنویس.';const error=$('#search-error');if(error){error.textContent=searchError;error.hidden=false;$('#shopping-query').setAttribute('aria-invalid','true');$('#shopping-query').focus();}return;}
 searchError='';
 if(state.lastSearch!==query)state.answers={};
 state.lastSearch=query;state.query=query;
 state.category=/لپ|لپتاپ|لپ‌تاپ|کتانی|کفش/.test(query)?'other':'phone';
 const normalized=query.replace(/[۰-۹]/g,n=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(n))).toLowerCase();
 const budgetMatch=normalized.match(/(?:تا|حدود|بودجه)\s*(\d+)/);
 if(budgetMatch){const value=Number(budgetMatch[1]);state.answers.budget=value<=20?'تا ۲۰ میلیون':value<=30?'۲۰ تا ۳۰ میلیون':value<=45?'۳۰ تا ۴۵ میلیون':'بیشتر از ۴۵ میلیون';}
 if(/قسط/.test(query))state.answers.installment='بله، خرید قسطی';
 if(/دوربین|عکس/.test(query))state.answers.feature='دوربین خوب';
 else if(/باتری|شارژ/.test(query))state.answers.feature='باتری بادوام';
 else if(/ارزان|اقتصادی/.test(query))state.answers.feature='قیمت مناسب';
 if(/روزمره|تماس|پیام/.test(query))state.answers.use='کارهای روزمره';
 else if(/بازی/.test(query))state.answers.use='بازی';
 else if(/درس|دانشجو/.test(query))state.answers.use='درس و کار';
 if(/سامسونگ/.test(query))state.answers.brand='سامسونگ';
 else if(/شیائومی|ردمی/.test(query))state.answers.brand='شیائومی';
 else if(/آیفون|اپل/.test(query))state.answers.brand='اپل';
 persist();
 if(state.category!=='phone'){go('recommendations');return;}
 if(state.intent==='known'){
   const found=/a\s*55|آ\s*55|ای\s*55/.test(normalized)?products[0]:/a\s*35|آ\s*35|ای\s*35/.test(normalized)?products[2]:/ردمی|نوت\s*13|redmi/.test(normalized)?products[1]:null;
   if(found){state.product=found.id;state.filters=[];persist();go('stores');return;}
   showDialog('کدام محصول را در نظر داری؟','<p>مدل دقیق را انتخاب کن تا مستقیم فروشگاه‌ها را ببینی. این نمونه سه گوشی دارد.</p><div class="known-products">'+products.map(p=>'<button class="known-product" data-action="known-product" data-id="'+p.id+'">'+image(p)+'<span class="od-field od-fill"><strong>'+p.name+'</strong><small>حافظه ۲۵۶ گیگابایت</small></span>'+icon('arrow')+'</button>').join('')+'</div>');
   return;
 }
 state.flow=[0,1,2].filter(i=>!state.answers[questions[i].key]);
 state.step=state.flow[0]??0;persist();
 if(!state.flow.length)beginResults();else go('discovery');
}
function nextQuestion(){
 const flow=state.flow?.length?state.flow:[0,1,2];
 if(!state.answers[questions[state.step].key])return;
 const pos=flow.indexOf(state.step);
 if(pos<flow.length-1){state.step=flow[pos+1];persist();render({focus:true});window.scrollTo(0,0);}
 else beginResults();
}
function demo(){
 state.category='phone';state.query='گوشی تا ۳۰ میلیون برای استفاده روزمره';
 state.answers={budget:'۲۰ تا ۳۰ میلیون',use:'کارهای روزمره',feature:'استفاده راحت',brand:'فرقی ندارد',installment:'فرقی ندارد'};
 persist();go('recommendations');
}
function beginResults(){
 loadingResults=true;persist();go('recommendations');
 timer=setTimeout(()=>{loadingResults=false;if(route==='recommendations')render();},650);
}
function toggleCompare(id){
 if(state.compare.includes(id))state.compare=state.compare.filter(x=>x!==id);
 else if(state.compare.length<3)state.compare.push(id);
 else {toast('برای مقایسه، حداکثر سه محصول انتخاب کن.');return;}
 const y=window.scrollY;persist();render();window.scrollTo(0,y);toast(state.compare.includes(id)?'محصول به مقایسه اضافه شد.':'محصول از مقایسه حذف شد.');
}
function verifyStart(){
 showDialog('بررسی نمونه موجودی','<p>در این نسخه تماس خودکار انجام نمی‌شود. یک پاسخ نمونه می‌بینی تا روند تأیید و انتخاب جایگزین را تجربه کنی.</p><p class="small">برای خرید واقعی، قیمت و موجودی را مستقیماً از فروشگاه بپرس.</p>'+button('شروع بررسی نمونه','verify-confirm','btn-primary full')+button('بازگشت به فروشگاه','close-dialog','btn-secondary full'));
}
function continueVerification(){
 const v=state.verification;
 if(!v||v.store!==Number(state.store))return;
 const next={calling:'waiting',waiting:v.store===0?'stock':v.store===1?'no-response':v.store===2?'closed':'out',stock:'confirmed'}[v.status];
 if(!next)return;
 timer=setTimeout(()=>{
   if(route!=='verify')return;
   v.status=next;
   if(next==='confirmed')v.time=new Intl.DateTimeFormat('fa-IR',{hour:'2-digit',minute:'2-digit'}).format(new Date());
   persist();render();continueVerification();
 },v.status==='waiting'?1800:1100);
}
function directions(s){
 showDialog('مسیریابی تا مرکز خرید','<p>نشانی واحد و فروشگاه در این نسخه نمونه است. مسیر واقعی تا محدوده «'+s.mall+'» در نقشه گوگل باز می‌شود.</p><p class="small">پیش از حرکت، نشانی دقیق فروشگاه را تأیید کن.</p><a class="btn btn-primary full" href="https://www.google.com/maps/dir/?api=1&destination='+s.lat+','+s.lng+'&travelmode=walking" target="_blank" rel="noopener noreferrer">'+icon('route')+'باز کردن مسیر پیاده</a><a class="btn btn-secondary full" href="https://www.google.com/maps/dir/?api=1&destination='+s.lat+','+s.lng+'&travelmode=driving" target="_blank" rel="noopener noreferrer">'+icon('car')+'باز کردن مسیر با خودرو</a>');
}
const actions={
 'set-intent':el=>{const field=$('#shopping-query');if(field)state.query=field.value;state.intent=el.dataset.intent;persist();render();},
 'known-product':el=>{state.product=el.dataset.id;state.filters=[];closeDialog();persist();go('stores');},
 'resume':()=>{state.flow=[0,1,2].filter(i=>!state.answers[questions[i].key]);state.step=state.flow[0]??0;if(!state.flow.length)beginResults();else go('discovery');},
 'apply-preferences':()=>{closeDialog();persist();render();},
 'compare-auto':()=>{const options=applicableProducts();const next=options.find(p=>!state.compare.includes(p.id));if(next)state.compare.push(next.id);if(state.compare.length>=2){persist();go('compare');}else toast('برای مقایسه به دو محصول نیاز داریم؛ ترجیحاتت را تغییر بده.');},
 'back':()=>{if(route==='discovery'){const flow=state.flow?.length?state.flow:[0,1,2];const pos=flow.indexOf(state.step);if(pos>0){state.step=flow[pos-1];persist();render();return;}}go(historyRoutes.pop()||'home',true);},
 'location':locationDialog,
 'privacy':()=>showDialog('انتخاب‌های تو، در مرورگر خودت','<p>این نمونه اطلاعاتت را به سرور نمی‌فرستد. پاسخ‌ها، ذخیره‌شده‌ها و برنامه خرید فقط در همین مرورگر نگه داشته می‌شوند.</p>'+button('متوجه شدم','close-dialog','btn-primary full')),
 'close-dialog':closeDialog,
 'suggest':el=>startSearch(el.dataset.query),
 'demo':demo,
 'answer':el=>{state.answers[questions[state.step].key]=el.dataset.value;persist();const y=window.scrollY;render();window.scrollTo(0,y);},
 'edit-answer':el=>{const idx=questions.findIndex(q=>q.key===el.dataset.key);if(idx>2){preferencesDialog();return;}state.flow=[0,1,2];state.step=Math.max(0,idx);persist();if(route!=='discovery')go('discovery');else render();},
 'previous':()=>{const flow=state.flow?.length?state.flow:[0,1,2];const pos=flow.indexOf(state.step);if(pos>0){state.step=flow[pos-1];persist();render({focus:true});window.scrollTo(0,0);}},
 'next':nextQuestion,
 'skip-question':()=>{state.answers[questions[state.step].key]='فرقی ندارد';nextQuestion();},
 'change-preferences':()=>{state.flow=[0,1,2];state.step=0;persist();go('discovery');},
 'recommendations':()=>go('recommendations'),
 'product-stores':el=>{state.product=el.dataset.id;state.filters=[];persist();go('stores');},
 'compare-toggle':el=>toggleCompare(el.dataset.id),
 'remove-compare':el=>toggleCompare(el.dataset.id),
 'open-compare':()=>{if(state.compare.length>=2)go('compare');},
 'save-product':el=>{const id=el.dataset.id;state.saved=state.saved.includes(id)?state.saved.filter(x=>x!==id):state.saved.concat(id);persist();const y=window.scrollY;render();window.scrollTo(0,y);toast(state.saved.includes(id)?'در ذخیره‌شده‌ها نگه داشتیم.':'از ذخیره‌شده‌ها حذف شد.');},
 'why':el=>{const p=products.find(p=>p.id===el.dataset.id);showDialog('چرا '+p.short+'؟','<div class="why-box"><strong>برداشت پیشنهادی</strong>'+reasonFor(p)+'</div><p style="margin-top:16px">این توضیح از پاسخ‌ها و مشخصات عمومی محصول ساخته شده است؛ نظر قطعی، تضمین یا بررسی تخصصی نیست.</p><h3>اطلاعات قابل بررسی</h3><p class="small">'+p.features.join('، ')+'</p><p class="small">مشخصات مدل را با نسخه دقیق فروشگاه تطبیق بده. قیمت‌ها و تعداد فروشگاه‌ها نمونه‌اند.</p>'+button('متوجه شدم','close-dialog','btn-primary full'));},
 'stores':()=>{persist();go('stores');},
 'view':el=>{state.view=el.dataset.view;persist();render();},
 'filter':el=>{const f=el.dataset.filter;if(['nearest','cheapest'].includes(f))state.sort=f;else state.filters=state.filters.includes(f)?state.filters.filter(x=>x!==f):state.filters.concat(f);persist();const y=window.scrollY;render();window.scrollTo(0,y);},
 'clear-filters':()=>{state.filters=[];state.answers.installment='فرقی ندارد';state.sort='nearest';persist();render();},
 'store-detail':el=>{state.store=Number(el.dataset.id);persist();go('store');},
 'map-store':el=>{const s=stores[Number(el.dataset.id)];showDialog(s.name,'<p>'+s.mall+'، '+s.floor+'، واحد '+s.unit+'</p><p class="bold">'+money(productPrice(s))+' · قیمت نمونه</p>'+badge(s.status,s.verified?'good':'warn','shield')+button('جزئیات فروشگاه','map-details','btn-primary full','data-id="'+s.id+'"'));},
 'map-details':el=>{state.store=Number(el.dataset.id);closeDialog();persist();go('store');},
 'set-location':()=>{state.neighborhood=$('#neighborhood').value;closeDialog();persist();render();if(state.neighborhood!=='حافظ و جمهوری')toast('محدوده انتخاب شد؛ فروشگاه‌های این نمونه در حافظ و جمهوری‌اند.');},
 'geolocate':()=>{const feedback=$('#location-feedback');if(!navigator.geolocation){feedback.textContent='مرورگر به موقعیت دسترسی ندارد. محدوده را دستی انتخاب کن.';return;}feedback.innerHTML='<span class="spinner" aria-hidden="true"></span> در انتظار اجازه تو برای دسترسی به موقعیت…';navigator.geolocation.getCurrentPosition(()=>{if($('#dialog').open){feedback.textContent='موقعیت دریافت شد. در این نمونه نزدیک‌ترین محدوده قابل نمایش، حافظ و جمهوری است.';$('#neighborhood').value='حافظ و جمهوری';}},()=>{if($('#dialog').open)feedback.textContent='موقعیت دریافت نشد. می‌توانی محله‌ات را دستی انتخاب کنی.';},{enableHighAccuracy:false,timeout:10000,maximumAge:60000});},
 'call':()=>showDialog('تماس با '+currentStore().name,'<p>برای این فروشگاه نمونه، شماره تماس واقعی ثبت نشده است. در نسخه متصل، شماره تأییدشده فروشگاه اینجا در دسترس خواهد بود.</p><p class="quote">سلام، این محصول موجود است؟ قیمت امروز آن چقدر است و فروشگاه تا چه ساعتی باز است؟</p>'+button(icon('copy')+'کپی متن سؤال','copy-question','btn-primary full')+button('دیدن فروشگاه جایگزین','call-alternative','btn-secondary full')),
 'call-alternative':()=>{closeDialog();state.store=state.store===0?3:0;persist();go('store');},
 'copy-question':async()=>{const text='سلام، این محصول موجود است؟ قیمت امروز آن چقدر است و فروشگاه تا چه ساعتی باز است؟';try{await navigator.clipboard.writeText(text);toast('متن سؤال کپی شد.');}catch{showDialog('متن آماده برای تماس','<label for="copy-text">متن را انتخاب و کپی کن</label><textarea id="copy-text" readonly>'+text+'</textarea>'+button('بستن','close-dialog','btn-secondary full'));$('#copy-text').select();}},
 'directions':()=>directions(currentStore()),
 'plan-directions':()=>{const plan=state.plan;if(plan)directions(stores.find(s=>s.id===plan.store)||stores[0]);},
 'verify-start':verifyStart,
 'verify-confirm':()=>{closeDialog();state.verification={store:Number(state.store),product:state.product,status:'calling',time:''};persist();go('verify');},
 'cancel-verification':()=>{clearTimeout(timer);state.verification=null;persist();go('store',true);},
 'alternative':()=>{state.store=0;state.verification=null;persist();go('store');},
 'create-plan':()=>{if(state.verification?.status!=='confirmed'||state.verification.product!==state.product||state.verification.store!==Number(state.store)){toast('ابتدا موجودی این محصول را بررسی کن.');go('store');return;}state.plan={product:state.product,store:Number(state.store),price:productPrice(currentStore()),time:state.verification.time,checks:{}};state.savedPlan=null;persist();go('plan');},
 'save-plan':()=>{if(state.plan){state.savedPlan=JSON.parse(JSON.stringify(state.plan));persist();render();toast('برنامه خرید در این مرورگر ذخیره شد.');}},
 'open-saved-plan':()=>{state.plan=JSON.parse(JSON.stringify(state.savedPlan));state.product=state.plan.product;state.store=state.plan.store;persist();go('plan');},
 'voice':()=>{
   const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
   if(!SpeechRecognition){showDialog('درخواستت را بنویس','<p>ورودی صوتی در این مرورگر در دسترس نیست. می‌توانی همان جمله‌ای را که می‌خواستی بگویی، در جست‌وجو بنویسی.</p>'+button('بازگشت به جست‌وجو','close-dialog','btn-primary full'));return;}
   const recognition=new SpeechRecognition();recognition.lang='fa-IR';recognition.interimResults=false;
   const voice=$('.voice');voice.classList.add('listening');voice.setAttribute('aria-label','در حال شنیدن');
   toast('در حال شنیدن؛ بگو دنبال چه محصولی هستی.');
   recognition.onresult=event=>{const field=$('#shopping-query');if(field)field.value=event.results[0][0].transcript;};
   recognition.onerror=()=>toast('صدا دریافت نشد. درخواستت را بنویس یا دوباره تلاش کن.');
   recognition.onend=()=>{voice.classList.remove('listening');voice.setAttribute('aria-label','گفتن درخواست با صدا');};
   try{recognition.start();}catch{voice.classList.remove('listening');toast('ورودی صوتی آماده نیست. درخواستت را بنویس.');}
 }
};
document.addEventListener('click',event=>{
 const el=event.target.closest('[data-action]');
 if(el){const action=actions[el.dataset.action];if(action&&!el.disabled){event.preventDefault();action(el);}return;}
 const link=event.target.closest('a[href^="#"]');
 if(link&&link.hash!=='#main'){event.preventDefault();go(link.hash.slice(1));}
});
document.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('g[data-action]')){event.preventDefault();actions[event.target.dataset.action]?.(event.target);}});
document.addEventListener('submit',event=>{if(event.target.id==='search-form'){event.preventDefault();startSearch(new FormData(event.target).get('query'));}});
document.addEventListener('input',event=>{if(event.target.id==='shopping-query'){state.query=event.target.value;persist();if(searchError&&event.target.value.trim()){searchError='';$('#search-error').hidden=true;event.target.removeAttribute('aria-invalid');}}});
document.addEventListener('focusout',event=>{if(event.target.id==='shopping-query'&&!event.target.value.trim()){searchError='بنویس چه محصولی لازم داری؛ مثلاً گوشی تا ۳۰ میلیون.';const error=$('#search-error');if(error){error.textContent=searchError;error.hidden=false;event.target.setAttribute('aria-invalid','true');}}});
document.addEventListener('change',event=>{
 if(event.target.dataset.preference){state.answers[event.target.dataset.preference]=event.target.value;persist();}
 if(event.target.name==='selected-product'){state.product=event.target.value;persist();const y=window.scrollY;render();window.scrollTo(0,y);}
 if(event.target.dataset.check&&state.plan){state.plan.checks=state.plan.checks||{};state.plan.checks[event.target.dataset.check]=event.target.checked;if(state.savedPlan&&state.savedPlan.product===state.plan.product)state.savedPlan.checks={...state.plan.checks};persist();}
});
$('#dialog').addEventListener('click',event=>{if(event.target===$('#dialog')){const r=$('#dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog();}});
window.addEventListener('popstate',()=>{clearTimeout(timer);route=location.hash.slice(1)||'home';render({focus:true});window.scrollTo(0,scrollPositions[route]||0);if(route==='verify')continueVerification();});
function updateConnection(){$('#offline-banner').hidden=navigator.onLine;}
window.addEventListener('online',()=>{updateConnection();toast('دوباره به اینترنت وصل شدی.');});
window.addEventListener('offline',updateConnection);
updateConnection();render();if(route==='verify')continueVerification();
