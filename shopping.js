'use strict';
// Shopping extensions reuse the exported cards, local state and same-origin API.
let outfitData={items:[]}, marketData={items:[]}, priceStatus={mode:'dataset_only',connected_shops:0,updated_offers:0};
state.outfitPrefs={audience:'men',style:'casual',occasion:'any',season:'any',coverage:'any',palette:'any',aesthetic:'any',fit:'any',liked_colors:[],budget:'',shoes:true,outer:false,accessory:false,multi:false,installment:false,...state.outfitPrefs,...(state.outfitPrefsV2?{}:{shoes:true})};
state.outfitPrefsV2=true;
const roleNames={top:'بالاتنه',bottom:'پایین‌تنه',onepiece:'لباس یک‌تکه',shoes:'کفش',outer:'لایه رویی',accessory:'اکسسوری'};
let outfitReviewBusy=false, outfitReviewError='';
const outfitCriteria={
  occasion:['برای کجا؟',{any:'موقعیت مشخص نیست',daily:'استفاده روزمره',work:'محیط کار رسمی',party:'مهمانی رسمی',sport:'فعالیت ورزشی'}],
  season:['فصل و هوا',{any:'محدودیتی ندارم',warm:'هوای گرم',cold:'هوای سرد'}],
  coverage:['پوشیدگی',{any:'ترجیحی مشخص نکرده‌ام',covered:'بدون کراپ، لباس کوتاه و بدون آستین'}],
  palette:['رنگ‌بندی',{any:'محدودیتی ندارم',neutral:'فقط رنگ‌های خنثیِ مشخص'}]
};
const outfitStyleChoices={minimal:['مینیمال','ساده و کم‌جزئیات؛ بدون طرح شلوغ',['#ebe4d6','#282828','#b7aa91']],street:['استریت','راحت و شهری؛ بدون کفش رسمی',['#43576a','#d3d9dd','#242424']],classic:['کلاسیک','مرتب و رسمی‌تر، با اجزای کلاسیک',['#26364f','#ece6db','#8a7160']],sporty:['اسپرت','ترکیب ورزشی و راحت',['#7b8f74','#e4e7e0','#353a34']],any:['هنوز مطمئن نیستم','چند سبک سازگار با موقعیتم را بررسی کن',['#9c8b7a','#e9dfcc','#677889']]};
const outfitColorChoices={'مشکی':'#252525','سفید':'#f3f3ed','سرمه ای':'#25334f','طوسی':'#8a8e90','کرم':'#daccad','بژ':'#c8b89e','آبی':'#507eaf','سبز':'#52785b','قهوه ای':'#865f45','قرمز':'#ab4543','صورتی':'#d695a4','بنفش':'#80659d','زرد':'#d7b65b','نارنجی':'#cf874a'};
let outfitInterviewError='';
function outfitStyleAllowed(style,occasion){return !((['work','party'].includes(occasion)&&['street','sporty'].includes(style))||(occasion==='sport'&&style==='classic'));}
function outfitNeedsInterview(){return state.outfitProfileV3!==true||!!state.outfitDraftV1;}
function outfitLocation(){return `<nav class="breadcrumb" aria-label="مسیر ست‌ساز"><a href="#categories">دسته‌ها</a>${icon('chevron')}<a href="#category?g=fashion">مد و پوشاک</a>${icon('chevron')}<span aria-current="page">ست‌ساز</span></nav>`;}
function outfitDraft(){
  const d=state.outfitDraftV1;
  if(!d||typeof d!=='object'||!Number.isInteger(d.step)||d.step<0||d.step>4||!d.answers||!Array.isArray(d.answers.liked_colors))state.outfitDraftV1={step:0,answers:{audience:'',occasion:'',aesthetic:'',liked_colors:[],colorsAnswered:false,fit:'any',coverage:'any',season:'any',budget:'',shoes:true,outer:false,accessory:false,multi:false,installment:false}};
  if(state.outfitDraftV1.step>1)state.outfitDraftV1.step=1;
  return state.outfitDraftV1;
}
function outfitAnswerError(draft){
  const a=draft.answers;
  if(!['men','women'].includes(a.audience)||!Object.hasOwn(outfitCriteria.occasion[1],a.occasion))return 'نوع پوشاک و موقعیت استفاده را انتخاب کن.';
  if(draft.step>=1){
    if(!Object.hasOwn(outfitStyleChoices,a.aesthetic))return 'یک سبک یا «هنوز مطمئن نیستم» را انتخاب کن.';
    if(!outfitStyleAllowed(a.aesthetic,a.occasion))return 'سبک انتخابی با موقعیت استفاده سازگار نیست؛ یکی را تغییر بده.';
  }
  if(draft.step>=1&&(a.liked_colors.length>3||a.liked_colors.some(c=>!Object.hasOwn(outfitColorChoices,c))))return 'حداکثر سه رنگ از فهرست انتخاب کن؛ یا هیچ رنگی را انتخاب نکن.';
  if(draft.step>=1&&(!['any','relaxed','fitted'].includes(a.fit)||!['any','covered'].includes(a.coverage)||!['any','warm','cold'].includes(a.season)))return 'گزینه‌های فرم و پوشش را دوباره بررسی کن.';
  if(draft.step>=1&&a.budget&&(Number(digits(a.budget))<1000||Number(digits(a.budget))>3e10))return 'بودجه را به تومان، بین هزار تا ۳۰ میلیارد بنویس یا خالی بگذار.';
  return '';
}
function outfitAppliedAnswers(a){
  return {...a,liked_colors:[...a.liked_colors],budget:digits(a.budget),palette:'any',style:a.aesthetic==='classic'||['work','party'].includes(a.occasion)?'formal':a.aesthetic==='any'?'any':'casual'};
}
function outfitProfileSummary(p){
  return [p.audience==='women'?'پوشاک زنانه':'پوشاک مردانه',outfitCriteria.occasion[1][p.occasion]||'موقعیت آزاد',outfitStyleChoices[p.aesthetic]?.[0]||'سبک آزاد',(p.liked_colors||[]).length?'رنگ‌های دلخواه: '+p.liked_colors.join('، '):'انتخاب رنگ آزاد',p.fit==='relaxed'?'فرم آزاد':p.fit==='fitted'?'فرم جذب':'فرم بدون محدودیت',outfitCriteria.season[1][p.season]||'فصل بدون محدودیت',p.coverage==='covered'?'پوشیده‌تر':'پوشیدگی بدون محدودیت','اجزای اضافه: '+([p.shoes&&'کفش',p.outer&&'لایه رویی',p.accessory&&'اکسسوری'].filter(Boolean).join('، ')||'ندارد'),p.budget?'تا '+money(Number(p.budget)):'بودجه آزاد',p.multi?'چندفروشگاهی مجاز':'فقط یک فروشگاه',...(p.installment?['فقط اقساط حضوری']:[])];
}
function outfitChoiceGroup(name,legend,choices,value){
  return `<fieldset class="interview-group"><legend>${legend}</legend><div class="interview-options">${choices.map(([v,title,detail])=>`<label class="interview-choice"><input type="radio" name="${name}" value="${v}" ${value===v?'checked':''}><span><strong>${title}</strong>${detail?`<small>${detail}</small>`:''}</span></label>`).join('')}</div></fieldset>`;
}
function outfitInterviewPage(){
  const d=outfitDraft(),a=d.answers;
  const titles=['این ست برای کیست و کجا؟','چه سبکی دوست داری؟'];
  const hints=['دو انتخاب ساده؛ هیچ‌کدام را از طرف تو حدس نمی‌زنیم.','فقط سبک لازم است؛ بودجه و بقیهٔ جزئیات اختیاری‌اند.'];
  let body='';
  if(d.step===0)body=outfitChoiceGroup('audience','دنبال کدام نوع پوشاکی؟',[['women','زنانه'],['men','مردانه']],a.audience)+outfitChoiceGroup('occasion','موقعیت استفاده',Object.entries(outfitCriteria.occasion[1]).map(([v,t])=>[v,t]),a.occasion);
  if(d.step===1)body=`<fieldset class="interview-group"><legend class="sr-only">سبک دلخواه</legend><div class="interview-styles">${Object.entries(outfitStyleChoices).map(([value,[title,detail,colors]])=>`<label class="interview-choice style-choice"><input type="radio" name="aesthetic" value="${value}" ${outfitStyleAllowed(value,a.occasion)?'':'disabled'} ${a.aesthetic===value?'checked':''}><span><span class="style-illustration" aria-hidden="true">${icon('outfit',38)}<span class="style-palette">${colors.map(color=>`<i style="background:${color}"></i>`).join('')}</span></span><strong>${title}</strong><small>${outfitStyleAllowed(value,a.occasion)?detail:'با موقعیت انتخابی سازگار نیست'}</small></span></label>`).join('')}</div></fieldset>`+outfitInterviewExtras(a);
  const seed=productCache.get(state.outfitSeed);
  return `<div class="page outfit-interview">${heading('ستِ خودت را پیدا کن')}${outfitLocation()}<div class="interview-progress"><span>مرحلهٔ ${fa(d.step+1)} از ${fa(titles.length)}</span><ol aria-label="مراحل شناخت سلیقه">${['موقعیت','سبک'].map((t,i)=>`<li ${i===d.step?'aria-current="step"':''} class="${i<=d.step?'reached':''}"><span>${t}</span></li>`).join('')}</ol></div>${seed?`<p class="interview-seed">${icon('outfit')} ترکیب را با «${esc(seed.name)}» می‌سازیم.</p>`:''}<section class="interview-sheet"><h2 id="outfit-question" tabindex="-1">${titles[d.step]}</h2><form id="outfit-interview-form" novalidate>${body}<p class="field-error" id="outfit-interview-error" role="alert" tabindex="-1">${esc(outfitInterviewError)}</p><div class="interview-actions">${d.step?btn('مرحله قبل','outfit-interview-back','btn-secondary','type="button"'):state.outfitProfileV3===true?btn('بازگشت به نتایج قبلی','outfit-interview-cancel','btn-secondary','type="button"'):''}<button class="btn btn-primary" type="submit">${d.step===1?'ساخت ست':'ادامه'} ${icon('next')}</button></div></form></section>${a.audience||a.occasion||a.aesthetic||a.colorsAnswered?btn('پاسخ‌ها را پاک کن و از اول شروع کن','outfit-reset-answers','section-link interview-reset','type="button"'):''}</div>`;
}
function outfitInterviewExtras(a){
  const chosen=a.liked_colors.length||a.fit!=='any'||a.coverage!=='any'||a.season!=='any'||!a.shoes||a.outer||a.accessory||a.multi||a.installment;
  return `<label class="catalog-field">بودجهٔ کل ست (تومان، اختیاری)${moneyInput('budget','outfit-interview-budget',a.budget,'اگر سقفی نداری خالی بگذار',1000,3e10)}</label><details class="interview-more"${chosen?' open':''}><summary>تنظیمات بیشتر (اختیاری) ${icon('chevron')}</summary><fieldset class="interview-group"><legend>رنگ‌های دلخواه (حداکثر سه)</legend><div class="interview-colors">${Object.entries(outfitColorChoices).map(([name,color])=>`<label class="color-choice"><input type="checkbox" name="liked_colors" value="${name}" ${a.liked_colors.includes(name)?'checked':''}><span class="interview-swatch" style="background:${color}" aria-hidden="true"></span><span>${name}</span></label>`).join('')}</div><p class="helper" id="outfit-color-count" role="status">${a.liked_colors.length?fa(a.liked_colors.length)+' رنگ انتخاب شده':'رنگ آزاد است.'}</p></fieldset>${outfitChoiceGroup('fit','فرم لباس',[['any','فرقی ندارد'],['relaxed','آزاد و راحت'],['fitted','جذب و اندامی']],a.fit)}${outfitChoiceGroup('coverage','پوشیدگی',[['any','محدودیتی ندارم'],['covered','پوشیده‌تر','بدون کراپ، لباس کوتاه و بدون آستین']],a.coverage)}${outfitChoiceGroup('season','هوا و فصل',[['any','فرقی ندارد'],['warm','هوای گرم'],['cold','هوای سرد']],a.season)}<fieldset class="interview-group"><legend>اجزای ست</legend>${[['shoes','کفش'],['outer','لایه رویی مثل کت یا مانتو'],['accessory','اکسسوری']].map(([name,label])=>`<label class="check-field"><input type="checkbox" name="${name}" ${a[name]?'checked':''}>${label}</label>`).join('')}</fieldset><label class="check-field"><input type="checkbox" name="multi" ${a.multi?'checked':''}> خرید از چند فروشگاه هم مجاز باشد</label><label class="check-field"><input type="checkbox" name="installment" ${a.installment?'checked':''}> فقط اقساط حضوری ثبت‌شده</label></details>`;
}
function startOutfitInterview(fresh=false){
  ++generation;
  outfitInterviewError='';
  state.outfitDraftV1=fresh||state.outfitProfileV3!==true?null:{step:0,answers:{...state.outfitPrefs,liked_colors:[...(state.outfitPrefs.liked_colors||[])],colorsAnswered:true}};
  const d=outfitDraft(),seed=productCache.get(state.outfitSeed);
  if(seed&&!d.answers.audience&&/زنانه|مردانه/.test(seed.category))d.answers.audience=/زنانه/.test(seed.category)?'women':'men';
  persist();return go('outfits');
}
function advanceOutfitInterview(){
  const d=outfitDraft();
  outfitInterviewError=outfitAnswerError(d);
  if(outfitInterviewError){render();$('#outfit-interview-error')?.focus?.();return false;}
  if(d.step<1){d.step++;persist();render();$('#outfit-question')?.focus({preventScroll:false});return true;}
  state.outfitPrefs=outfitAppliedAnswers(d.answers);state.outfitProfileV3=true;state.outfitDraftV1=null;
  state.outfitFixed=[];state.outfitExclude=[];state.outfitShop=null;persist();go('outfits');return true;
}
function outfitReviewPanel(){
  const review=outfitData.review||{};
  const messages={not_requested:'این‌ها پیشنهاد اولیه بر اساس مشخصات کالا هستند؛ تصویرها هنوز با مدل بررسی نشده‌اند.',unavailable:'مدل فعلاً پاسخ نداد؛ پیشنهاد اولیه حفظ شده و بررسی هوشمند انجام نشده است.',invalid_response:'پاسخ مدل قابل اعتبارسنجی نبود؛ این نتایج تأیید هوشمند ندارند.',reviewed:review.none_approved?'بررسی هوشمند هیچ‌کدام از ترکیب‌ها را تأیید نکرد؛ دلیلش را پایین ببین. پیشنهادهای اولیه همچنان دیده می‌شوند، ولی تأیید نشده‌اند.':outfitData.items.length?'پیشنهادهای پذیرفته‌شدهٔ مدل؛ نوع بررسی روی هر ست مشخص است.':'مدل هیچ‌کدام از ترکیب‌های بررسی‌شده را مناسب تشخیص نداد؛ شرایط را تغییر بده.'};
  return `<section class="panel outfit-review"><h2>${icon('sparkle')} یک بررسی دقیق‌تر</h2><p role="status" aria-live="polite">${outfitReviewBusy?'در حال بررسی ترکیب‌ها با مدل؛ ممکن است چند ده ثانیه طول بکشد…':esc(messages[review.status]||messages.not_requested)}</p>${(review.rejected_reasons||[]).length?`<details${review.none_approved?' open':''}><summary>چرا بعضی ترکیب‌ها رد شدند؟</summary>${review.rejected_reasons.map(r=>`<p>${esc(r)}</p>`).join('')}</details>`:''}${outfitReviewError?`<p class="field-error" role="alert">${esc(outfitReviewError)}</p>`:''}${outfitData.items.length?btn(icon(outfitReviewBusy?'spinner':'sparkle')+(outfitReviewBusy?' در حال بررسی…':'بررسی هوشمند ست‌ها'),'review-outfits','btn-secondary',outfitReviewBusy?'disabled aria-busy="true"':''):''}</section>`;
}
let assistantData=null, compareInsight=null, bundleData=null;
const originalProductCard=productCard, originalRecommendations=recommendations;
const originalStoreCard=storeCard, originalPlanPage=planPage, originalSavedPage=savedPage;
const originalLoadRoute=loadRoute;
productCard=function(p){
  let html=originalProductCard(p);
  if(p.outfit_slot)html=html.replace('<div class="product-actions">',`<div class="product-actions">${btn('با چی ست می‌شود؟','seed-outfit','btn-soft full',`data-id="${p.id}"`)}`);
  return html;
};
function priceSource(s){
  return `<div class="price-provenance ${s.price_fresh?'is-fresh':''}">${icon(s.price_fresh?'shield':'info')}<span>${s.observed_at?(s.price_fresh?'گزارش معتبر فروشنده':'اعتبار گزارش فروشنده گذشته')+' · '+dateText(s.observed_at):'قیمت ثبت‌شده؛ نیازمند تأیید امروز'}</span><a href="#prices" aria-label="درباره اعتبار قیمت‌ها">جزئیات</a></div>`;
}
storeCard=function(s,directoryMode=false){
  const v=verificationFor(s);
  let html=originalStoreCard(s,directoryMode);
  if(!directoryMode){
    if(verified(s)&&v?.price){html=originalStoreCard({...s,price:v.price},false).replace('کمترین قیمت معتبر ثبت‌شده','قیمت طبق گزارش تماس شما');}
    if(s.price_fresh&&s.offers?.some(o=>o.fresh&&o.availability==='in_stock'))html=html.replace('موجودی تأیید نشده','موجودی طبق گزارش تازه فروشنده');
    html=html.replace('</article>',priceSource(s)+'</article>');
  }
  return html;
};
offerList=function(s){return (s.offers||[]).map(o=>`<article class="offer-row"><h3>${esc(o.seller_title)}</h3><strong class="offer-price">${money(o.valid_price)}</strong><p class="small muted">${esc({in_stock:'موجود طبق گزارش فروشنده',out_of_stock:'ناموجود طبق آخرین گزارش فروشنده',unknown:'موجودی نیازمند تماس'}[o.availability]||'موجودی نیازمند تماس')}</p><p class="offer-meta">${o.source==='merchant_feed'?'گزارش فروشنده: '+dateText(o.observed_at)+' · '+(o.fresh?'در بازه اعتبار':'اعتبار گذشته'):'قیمت ثبت‌شده · '+priceAge(o.last_price_changed_at)}</p>${o.valid_price==null&&o.price_toman?'<p class="field-error">قیمت خام قابل اتکا نیست و در مقایسه استفاده نمی‌شود: '+esc(o.price_toman)+'</p>':''}<details class="offer-extras"><summary>توضیحات و گارانتی ${icon('chevron')}</summary><p>گارانتی: ${esc(o.warranty||'ثبت نشده')}</p>${o.description?'<p>'+esc(o.description)+'</p>':''}</details><div class="offer-links">${o.product_url?safeLink(o.product_url,'صفحه کالا نزد فروشنده'):''}${btn('سابقه قیمت','price-history','section-link',`data-id="${o.offer_id}"`)}</div></article>`).join('');};
function marketCards(){
  if(!marketData.items.length)return '';
  return `<section class="market-suggestions"><div class="section-heading"><div><span class="section-kicker">یک راه دیگر برای ادامه خرید</span><h2>کجا حضوری دنبالش بگردم؟</h2><p>${esc(marketData.reason)}</p></div></div><div class="market-grid">${marketData.items.map(m=>`<article class="panel market-card"><div class="store-avatar">${icon('pin')}</div><h3>${esc(m.name)}</h3>${badge(m.source==='curated_guide'?'راهنمای دارای منبع':'بر اساس تجمع فروشگاه‌ها')}<p>${esc(m.detail)}</p>${m.shop_count?`<p>${fa(m.shop_count)} فروشگاه مرتبط در این محدوده</p>`:''}${m.distance_km!=null?`<p>${fa(m.distance_km)} کیلومتر فاصله مستقیم</p>`:''}${m.source_url?`<p>${safeLink(m.source_url,'منبع معرفی این محدوده')} · بررسی منبع: ${esc(m.checked_at)}</p>`:''}<div class="od-cluster">${btn('نقشه و مسیر','market-map','btn-primary',`data-id="${m.id}"`)}${btn('فروشگاه‌های مرتبط','market-shops','btn-secondary',`data-id="${m.id}"`)}</div><p class="helper">موجودی مدل دقیق را بپرس.</p></article>`).join('')}</div></section>`;
}
recommendations=function(){return originalRecommendations().replace(note(),marketCards()+note());};
function outfitItem(item,outfit){
  const p=item.product,a=item.attributes;
  return `<article class="outfit-item"><span class="outfit-role">${esc(roleNames[item.role])}</span><a class="outfit-name-link" href="#product?id=${p.id}&shop=${item.shop_id}" aria-label="مشخصات و قیمت ${esc(p.name)} در ${esc(item.shop.name)}">${image(p)}<div class="outfit-item-copy"><h3>${esc(p.name)}</h3><p class="outfit-item-price">${money(item.price)}</p><span class="color-label"><span class="color-dot" style="background:${esc(a.color_hex)}"></span>${esc(a.color||'رنگ نامشخص')}</span></div></a>${!outfit.same_shop?`<p class="small muted">${esc(item.shop.name)}</p>`:''}${btn(icon('refresh')+' تغییر این تکه','swap-outfit-item','swap-button',`data-outfit="${outfit.id}" data-id="${p.id}" aria-label="جایگزین برای ${esc(p.name)}"`)}</article>`;
}
function outfitsPage(){
  if(outfitNeedsInterview())return outfitInterviewPage();
  const prefs=state.outfitPrefs;
  const seed=productCache.get(state.outfitSeed);
  const summary=outfitProfileSummary(prefs).join(' · ');
  return `<div class="page outfits-page">${heading('ست کامل لباس')}${outfitLocation()}<section class="panel outfit-profile"><h2>بر اساس سلیقهٔ تو</h2><p>${esc(summary)}</p><div class="detail-actions">${btn('ویرایش پاسخ‌ها','edit-outfit-preferences','btn-secondary')}${btn('از نو پاسخ می‌دهم','outfit-start-over','btn-soft')}</div></section>${seed?`<div class="panel seed-summary">${image(seed)}<div><span class="section-kicker">پایه این ترکیب</span><h2>${esc(seed.name)}</h2>${btn('انتخاب بدون این محصول','new-outfit','section-link')}</div></div>`:''}${state.outfitFixed?.length?`<div class="swap-notice">${icon('check')}<span>سایر اجزا ثابت‌اند؛ جایگزین‌ها را ببین.</span>${btn('همه پیشنهادها','clear-outfit-locks','section-link')}</div>`:''}${outfitReviewPanel()}<div class="results-context"><span>${fa(outfitData.items.length)} ست پیشنهادی</span><a class="section-link" href="#prices">قیمت ثبت‌شده؛ نیازمند استعلام ${icon('info')}</a></div><div class="outfits-list">${outfitData.items.length?outfitData.items.map((outfit,index)=>`<section class="panel outfit-card"><div class="look-heading"><span class="look-number">ست ${fa(index+1)}</span>${badge(outfit.same_shop?'یک مقصد خرید':fa(outfit.shop_count)+' مقصد',outfit.same_shop?'good':'warn','store')}</div>${outfit.review?badge(outfit.review.visual?'تأییدشده در بررسی تصویر و مشخصات':'تأییدشده در بررسی مشخصات','good','check'):outfit.not_approved?badge('در بررسی هوشمند تأیید نشد','warn','alert'):badge('پیشنهاد اولیه؛ بدون تحلیل تصویر')}<h2 class="look-shop">${outfit.same_shop?esc(outfit.items[0].shop.name):'ترکیب از '+fa(outfit.shop_count)+' فروشگاه'}</h2><div class="outfit-board">${outfit.items.map(i=>outfitItem(i,outfit)).join('')}</div><details class="outfit-details"><summary>چرا این ترکیب؟ و جزئیات قیمت ${icon('chevron')}</summary><div class="outfit-reasons">${outfit.review?.reason?`<p>${esc(outfit.review.reason)}</p>`:''}${outfit.reasons.map(r=>'<p>'+esc(r)+'</p>').join('')}${outfit.span_km?'<p>فاصله مستقیم بین فروشگاه‌ها تا '+fa(outfit.span_km)+' کیلومتر.</p>':''}${(outfit.warnings||[]).map(w=>`<p class="helper">${esc(w)}</p>`).join('')}</div><div class="outfit-price-details">${outfit.items.map(i=>`<p><strong>${esc(roleNames[i.role])}</strong> — ${i.source==='merchant_feed'?'بررسی فروشنده: '+dateText(i.observed_at):priceAge(i.changed_at)}${i.product_url?' · '+safeLink(i.product_url,'صفحه کالا نزد فروشنده'):''}</p>`).join('')}</div></details><div class="outfit-total"><div><span class="small muted">جمع قیمت ثبت‌شده</span><strong>${money(outfit.total)}</strong></div></div>${btn('برنامه خرید این ست '+icon('arrow'),'outfit-plan','btn-primary full',`data-id="${outfit.id}"`)}</section>`).join(''):empty('ترکیب قابل‌قبولی با این شرایط پیدا نشد',outfitData.reason||'مدل ترکیب‌ها را رد کرده است؛ سبک، شرایط یا محدوده خرید را تغییر بده.','edit-outfit-preferences','تغییر سلیقه و بودجه')}</div>${marketCards()}${note('قیمت، موجودی، سایز و رنگ را پیش از رفتن بپرس.')}</div>`;
}
function productSpecs(p){
  const all=p.specs||[],key=/نمایشگر|تراشه|رم|حافظه|باتری|دوربین اصلی|جنس|ابعاد|کاربرد/;
  const main=all.filter(s=>key.test(s.key||'')).slice(0,6);
  const row=s=>`<div class="spec-row"><span>${esc(s.key)}</span><strong>${esc(localNumbers(String(s.value??'').replace(/(\s*[,،])+\s*$/,'')))}</strong></div>`;
  return `<section class="panel"><h2>مشخصات ثبت‌شده</h2><div class="spec-list">${main.map(row).join('')}</div><details class="full-specifications"><summary>همهٔ مشخصات (${fa(all.length)})</summary><div class="spec-list">${all.length?all.map(row).join(''):'<p>مشخصات تکمیلی ثبت نشده است.</p>'}</div></details></section>`;
}
// Product page, as design C of the redesign: the photo on a bordered card with the lowest price as a sticker,
// the name and a few recorded specs, «کجا بخرم؟» as one ticket per shop (best first), and a fixed bar with
// «موجوده؟ بپرس», compare and route.
function productPage(){
  const p=product();
  if(!p)return `<div class="page">${heading('محصول')}${empty('محصول پیدا نشد','نام یا مدل را دوباره جست‌وجو کن.')}</div>`;
  state.lastSeen={id:p.id,name:p.name,price:p.price,stores:p.stores,images:(p.images||[]).slice(0,1)};
  const scoped=selectedShop&&selectedShop.id===state.shop, saved=state.saved.includes(p.id), compared=state.compare.includes(p.id);
  const priced=storeList.filter(s=>s.price!=null), located=priced.some(s=>s.distance_km!=null);
  const byPrice=[...priced].sort((a,b)=>a.price-b.price);
  const best=scoped?selectedShop:located?[...priced].sort((a,b)=>(a.distance_km??1e9)-(b.distance_km??1e9))[0]:byPrice[0];
  const low=byPrice[0]?.price;
  const short=v=>v>=1e6?[fa(Math.round(v/1e5)/10),'میلیون']:[fa(v),'تومان'];
  const shops=best?[best,...byPrice.filter(s=>s!==best).slice(0,3)]:[];
  const bestLabel=scoped?'همین فروشگاه':located?'نزدیک‌ترین':'ارزان‌ترین';
  const usual=byPrice.length>=4?byPrice[Math.floor((byPrice.length-1)/2)].price:null;
  // Without asking: one verdict on the recommended shop's price against this product's usual price (3+ shops).
  const mid=byPrice.length>=3?byPrice[Math.floor((byPrice.length-1)/2)].price:null;
  const verdict=best&&mid?(([text,tone])=>`<p class="price-verdict ${tone}">${scoped?'قیمت این فروشگاه':'قیمت «'+esc(best.name)+'»'}: ${text} <span>معمولاً حدود ${moneyWords(mid)} در ${fa(byPrice.length)} فروشگاه.</span></p>`)(priceVerdict(best.price,mid)):'';
  const odd=v=>!usual?'':v/usual<0.7?' <small class="price-flag">ارزانِ عجیب</small>':v/usual>1.3?' <small class="price-flag">گران‌تر از معمول</small>':'';
  const ticket=(s,i)=>{const [n,unit]=short(s.price);return `<a class="ticket ${i?'':'is-best'}" href="#store?id=${p.id}&shop=${s.id}"><span class="ticket-info"><strong>${esc(s.name)}${i?'':` <small class="ticket-tag">${bestLabel}</small>`}${odd(s.price)}</strong><small>${[s.distance_km!=null?fa(s.distance_km)+' کیلومتر':'',esc(s.area||''),s.opening?.label?`<span class="${s.opening.open?'is-open':''}">${esc(localNumbers(s.opening.label))}</span>`:''].filter(Boolean).join(' · ')}</small></span><span class="ticket-price"><strong>${n}</strong><small>${unit}</small></span></a>`;};
  const chips=(p.specs||[]).map(x=>String(x.value||'')).filter(v=>v&&v.length<=18&&!/\d{4}/.test(v)).slice(0,3);
  return `<div class="page product-page"><section class="product-top"><div class="product-top-bar">${btn(icon('back'),'back','icon-square','aria-label="بازگشت"')}<span class="product-top-actions">${btn(icon('send'),'share-product','icon-square','aria-label="اشتراک‌گذاری"')}<button class="icon-square save-square ${saved?'saved':''}" data-action="save-product" data-id="${p.id}" aria-pressed="${saved}" aria-label="${saved?'حذف از':'افزودن به'} فهرست من">${icon('bookmark')}</button></span></div><div class="product-photo">${image(p)}${low?`<span class="price-sticker"><strong>${fa(low)}</strong><small>تومان · ارزان‌ترین</small></span>`:''}</div><span class="product-path">${esc([p.group_name,p.category].filter(Boolean).join(' › '))}</span><h1 class="product-title">${esc(p.name)}</h1><span class="product-meta">${[p.brand?esc(p.brand):'',priced.length?fa(priced.length)+' فروشگاه':''].filter(Boolean).join(' · ')}</span>${chips.length?`<div class="spec-chips">${chips.map((v,i)=>`<span class="spec-chip ${i?'':'is-key'}">${esc(localNumbers(v))}</span>`).join('')}</div>`:''}</section>${best?`<section class="decision-card" aria-labelledby="buy-title"><h2 id="buy-title">کجا بخرم؟</h2>${verdict}${shops.map(ticket).join('')}<p class="decision-note">قیمت ثبت‌شده در ${fa(priced.length)} فروشگاه؛ قیمت امروز نیست.${priced.length>shops.length?` <a href="#stores?id=${p.id}">همه ${fa(priced.length)} فروشگاه</a>`:''}</p></section>`:`<p class="decision-note">برای این کالا قیمت ثبت‌شده‌ای نداریم.</p>`}${(p.specs||[]).length>1?`<a class="ask-card" href="#explain-panel">${icon('sparkle')}<span><strong>برای کار تو خوبه؟</strong> بپرس، از مشخصات ثبت‌شده جواب می‌دهیم.</span></a>`:''}<nav class="product-sections" aria-label="بخش‌های کالا"><a class="chip selected" href="#price-check">قیمت‌ها</a><a class="chip" href="#specs">مشخصات</a><a class="chip" href="#video-review-panel">بررسی ویدیویی</a>${p.bundle?'<a class="chip" href="#bundle">کنارش</a>':''}</nav><section class="product-purchase-bar" aria-label="کارهای این کالا">${best?btn('موجوده؟ بپرس','ask-best','btn-primary ask-main',`data-shop="${best.id}"`):btn(saved?'در فهرست من است':'به فهرست من','save-product','btn-primary ask-main',`data-id="${p.id}" aria-pressed="${saved}"`)}<button class="icon-square ${compared?'saved':''}" data-action="compare-toggle" data-id="${p.id}" aria-pressed="${compared}" aria-label="${compared?'حذف از مقایسه':'افزودن به مقایسه'}">${icon('compare')}</button>${best?`<button class="icon-square route-square" data-action="route-best" data-shop="${best.id}" aria-label="مسیر تا ${esc(best.name)}">${icon('route')}</button>`:''}</section><div class="product-detail-layout" id="specs"><div class="product-side"><section class="panel product-overview"><p>برند: ${esc(p.brand||'ثبت نشده')} · مدل: <bdi>${esc(p.model||'ثبت نشده')}</bdi></p>${p.outfit_slot?btn(icon('outfit')+'ست کامل با این','seed-outfit','btn-secondary',`data-id="${p.id}"`):''}</section><!--product-side--></div><div class="product-main">${scoped?`<section class="panel"><h2>${esc(selectedShop.name)}</h2><p>${esc(localNumbers(selectedShop.address))}</p>${phones(selectedShop)}${priceSource(selectedShop)}<details><summary>پیشنهادهای این فروشگاه</summary>${offerList(selectedShop)}</details></section>`:''}${productSpecs(p)}</div></div><!--product-after-->${p.bundle?`<div id="bundle">${bundleSection(p)}</div>`:''}${note()}</div>`;
}
const shopById=id=>storeList.find(s=>s.id===id)||(selectedShop?.id===id?selectedShop:null);
actions['ask-best']=el=>{const s=shopById(el.dataset.shop);if(s)inquiryDialog([s]);};
actions['route-best']=el=>{const s=shopById(el.dataset.shop);if(s)directions(s);};
actions['share-product']=async()=>{const url=location.href;try{if(navigator.share){await navigator.share({title:product()?.name||'سرراه',url});return;}await navigator.clipboard.writeText(url);toast('لینک کالا کپی شد.');}catch(error){if(error?.name!=='AbortError')showDialog('لینک کالا',`<textarea readonly rows="3" aria-label="لینک کالا">${esc(url)}</textarea>`);}};
function marketsPage(){return `<div class="page">${heading('کجا دنبالش بگردم؟')}<form id="market-form" class="panel refine-grid"><label class="catalog-field">چه کالایی؟<input name="q" value="${esc(state.query)}" placeholder="مثلاً کفش" maxlength="200"></label>${categoryField('market-categories')}<button class="btn btn-primary" type="submit">پیشنهاد محدوده خرید</button></form>${marketCards()||empty('نوع کالا را مشخص کن','اگر مدل را پیدا نکردی، نوع کلی کالا مثل «کفش» را بنویس.','home','بازگشت به خانه')}</div>`;}
function pricesPage(){
  const connected=priceStatus.connected_shops>0;
  return `<div class="page narrow">${heading('قیمت‌ها چقدر به‌روزند؟')}<section class="panel"><h2>${connected?'گزارش تازهٔ فروشگاه‌ها':'قیمت ثبت‌شده، نه تأیید قیمت امروز'}</h2><p>${connected?fa(priceStatus.connected_shops)+' فروشگاه گزارش قیمت می‌فرستند.':'هنوز اتصال زندهٔ قیمت فروشگاه‌ها فعال نشده است. قیمت‌ها برای مقایسهٔ اولیه‌اند؛ پیش از حرکت از فروشنده تأیید بگیر.'}</p>${connected?'<p>آخرین دریافت گزارش: '+dateText(priceStatus.latest_observation)+'</p>':''}${btn('بررسی دوبارهٔ وضعیت','refresh-prices','btn-secondary')}</section><section class="panel"><h2>پیش از حرکت مطمئن شو</h2><p>مدل دقیق، رنگ یا سایز، قیمت امروز، موجودی و ساعت کاری را از فروشنده بپرس. اگر راه تماس معتبر ثبت نشده، از وب‌سایت رسمی فروشگاه استفاده کن.</p><p>آخرین تغییر قیمت لزوماً زمان آخرین استعلام نیست. گزارش فروشنده فقط در بازهٔ اعتبار خودش تازه محسوب می‌شود.</p><p>بازآوری صفحه، قیمت قدیمی را به قیمت امروز تبدیل نمی‌کند.</p></section></div>`;
}
function outfitPlanPage(){
  const plan=state.outfitPlan;if(!plan)return originalPlanPage();
  const groups=new Map();for(const item of plan.items){if(!groups.has(item.shop_id))groups.set(item.shop_id,{shop:item.shop,items:[]});groups.get(item.shop_id).items.push(item);}
  const stops=[...groups.values()].sort((a,b)=>(a.shop.distance_km??Infinity)-(b.shop.distance_km??Infinity));
  return `<div class="page has-action">${heading('برنامه خرید ست تو',fa(stops.length)+' مقصد · '+dateText(plan.created_at))}<div class="plan-grid"><div>${stops.map(({shop:s,items},index)=>`<section class="panel"><span class="section-kicker">مقصد ${fa(index+1)}</span><h2>${esc(s.name)}</h2><p class="real-address">${esc(localNumbers(s.address))}</p><div class="detail-actions">${phones(s)}${btn('مسیریابی این مقصد','outfit-directions','btn-primary',`data-id="${s.id}"`)}</div><div class="outfit-plan-items">${items.map(i=>`<a href="#product?id=${i.product.id}&shop=${i.shop_id}" class="outfit-plan-item">${image(i.product)}<span>${esc(i.product.name)}<strong>${money(i.price)}</strong></span></a>`).join('')}</div><p>جمع این فروشگاه: ${money(items.reduce((sum,i)=>sum+i.price,0))}</p><p class="quote">سلام، ${items.map(i=>'«'+esc(i.product.name)+'»').join(' و ')} با سایز و رنگ موردنظر موجود است؟ قیمت امروز هرکدام و ساعت کاری‌تان چیست؟</p><p class="helper">${esc(localNumbers(s.opening.label))} · برنامه مسیر بر اساس فاصله مستقیم است.</p></section>`).join('')}</div><aside><section class="panel"><h2>جمع قیمت‌های ثبت‌شده</h2><p class="product-price">${money(plan.items.reduce((sum,i)=>sum+i.price,0))}</p><div class="checklist">${['تأیید موجودی همه اجزا','پرسیدن قیمت امروز','تأیید سایز و رنگ','بررسی شرایط پرداخت'].map((text,i)=>`<label><input type="checkbox" data-outfit-check="${i}" ${plan.checks?.[i]?'checked':''}>${text}</label>`).join('')}</div></section>${note()}</aside></div><div class="action-bar">${btn('بازگشت به ست‌ساز','outfits','btn-secondary')}${btn('ذخیره برنامه این ست','save-outfit-plan','btn-primary')}</div></div>`;
}
planPage=function(){return state.outfitPlanActive?outfitPlanPage():originalPlanPage();};
savedPage=function(){const html=originalSavedPage();const end=html.lastIndexOf('</div>');return state.savedOutfitPlan?html.slice(0,end)+`<section class="panel"><h2>برنامه ست ذخیره‌شده</h2><p>${fa(state.savedOutfitPlan.items.length)} جزء · ${money(state.savedOutfitPlan.items.reduce((sum,i)=>sum+i.price,0))}</p>${btn('دیدن برنامه ست','open-outfit-plan','btn-secondary')}</section>`+html.slice(end):html;};
views.outfits=outfitsPage;views.product=productPage;views.markets=marketsPage;views.prices=pricesPage;views.plan=planPage;views.saved=savedPage;
views.home=home;views.recommendations=recommendations;
function outfitParams(){const p=state.outfitPrefs;return {...locParams(),audience:p.audience,style:p.style,occasion:p.occasion,season:p.season,coverage:p.coverage,palette:p.palette,aesthetic:p.aesthetic,fit:p.fit,liked_colors:(p.liked_colors||[]).join(','),budget:p.budget,shoes:p.shoes?'1':'0',outer:p.outer?'1':'0',accessory:p.accessory?'1':'0',multi:p.multi?'1':'',installment:p.installment?'1':'',seed:state.outfitSeed||'',fixed:(state.outfitFixed||[]).join(','),exclude:(state.outfitExclude||[]).join(','),shop:state.outfitShop||''};}
loadRoute=async function(){
  const token=generation;
  if(route==='product'){
    selectedShop=null;
    if(state.product){await getProduct(state.product);if(token!==generation)return;const data=await api('/api/products/'+state.product+'/stores',locParams());if(token!==generation)return;storeList=data.items;selectedShop=storeList.find(s=>s.id===state.shop)||null;}
    return;
  }
  await originalLoadRoute();if(token!==generation)return;
  marketData={items:[]};
  if(route==='outfits'){
    outfitReviewError='';
    if(state.outfitSeed)await getProduct(state.outfitSeed);
    if(outfitNeedsInterview()){outfitDraft();outfitData={items:[]};return;}
    const data=await outfitResults();if(token!==generation)return;
    outfitData=data;
  }
  if(route==='prices'){const data=await api('/api/price-status');if(token===generation)priceStatus=data;}
  if(route==='markets'||(route==='recommendations'&&!total)||(route==='stores'&&!storeList.length)||(route==='outfits'&&!outfitData.items.length)){
    const category=route==='stores'?product()?.category:route==='outfits'?(productCache.get(state.outfitSeed)?.category|| (state.outfitPrefs.audience==='women'?'شومیز و تونیک زنانه':'پیراهن مردانه')):state.category;
    const installment=(route==='outfits'?state.outfitPrefs.installment:state.answers.installment||parsedQuery.installment||state.filters.includes('installment'));
    const data=await api('/api/market-fallback',{q:state.query,category,installment:installment?'1':'',...locParams()});if(token===generation)marketData=data;
  }
};
const originalStoresPage=storesPage;
views.stores=function(){return originalStoresPage().replace(note(),marketCards()+note());};
// Outfit results live for this visit, keyed by the exact request: leaving the page neither loses nor repeats them.
// ponytail: memory only (results carry location-based distances), so a closed tab starts over.
let outfitResult={key:'',data:null},outfitPending=null;
function outfitResults(){
  const params=outfitParams(),key=JSON.stringify(params);
  if(outfitResult.key===key)return Promise.resolve(outfitResult.data);
  if(outfitPending?.key===key)return outfitPending.promise;
  const promise=api('/api/outfits',params).then(data=>{
    data.items.forEach(o=>cacheProducts(o.items.map(i=>i.product)));
    outfitResult={key,data};
    notifyReady('ست‌های پیشنهادی آماده‌اند.','outfits');
    return data;
  }).finally(()=>{if(outfitPending?.key===key)outfitPending=null;});
  outfitPending={key,promise};
  return promise;
}
function findOutfit(id){const outfit=outfitData.items.find(x=>x.id===id);if(!outfit)throw new Error('این ترکیب دیگر در نتیجه‌ها نیست؛ دوباره ست بساز.');return outfit;}
actions.outfits=()=>go('outfits');
actions['outfit-start-over']=()=>{state.outfitSeed=null;return startOutfitInterview(true);};
actions['outfit-reset-answers']=()=>startOutfitInterview(true);
actions['outfit-interview-back']=()=>{outfitDraft().step=Math.max(0,outfitDraft().step-1);outfitInterviewError='';persist();render();$('#outfit-question')?.focus({preventScroll:false});};
actions['outfit-interview-cancel']=()=>{state.outfitDraftV1=null;outfitInterviewError='';persist();return go('outfits');};
actions['review-outfits']=async()=>{
  if(outfitReviewBusy||outfitNeedsInterview())return;
  const key=JSON.stringify(outfitParams());outfitReviewBusy=true;outfitReviewError='';render();
  // The review can take tens of seconds; its result is kept even if the shopper leaves meanwhile.
  try{const data=await api('/api/outfits',{...outfitParams(),review:'1'});if(JSON.stringify(outfitParams())!==key)return;
    // A strict review can reject every outfit; keep the first suggestions visible, clearly marked as not approved.
    if(data.review?.status==='reviewed'&&!data.items.length&&outfitData.items.length)outfitData={...outfitData,review:{...data.review,none_approved:true},items:outfitData.items.map(o=>({...o,review:null,not_approved:true}))};
    else outfitData=data;
    outfitData.items.forEach(o=>cacheProducts(o.items.map(i=>i.product)));
    outfitResult={key,data:outfitData};
    notifyReady('بررسی هوشمند ست‌ها تمام شد.','outfits');}
  catch{outfitReviewError='بررسی انجام نشد یا سقف درخواست پر شده است؛ نتایج قبلی حفظ شدند. کمی بعد دوباره تلاش کن.';}
  finally{outfitReviewBusy=false;if(route==='outfits')render();}
};
actions['new-outfit']=()=>{state.outfitSeed=null;state.outfitFixed=[];state.outfitExclude=[];state.outfitShop=null;return go('outfits');};
actions['seed-outfit']=async el=>{const p=await getProduct(el.dataset.id);state.outfitSeed=p.id;state.outfitFixed=[];state.outfitExclude=[];state.outfitShop=null;return startOutfitInterview(false);};
actions['clear-outfit-locks']=()=>{state.outfitFixed=[];state.outfitExclude=[];state.outfitShop=null;return go('outfits');};
actions['edit-outfit-preferences']=()=>startOutfitInterview(false);
actions['swap-outfit-item']=async el=>{const outfit=findOutfit(el.dataset.outfit);state.outfitSeed=null;state.outfitFixed=outfit.items.filter(i=>i.product.id!==el.dataset.id).map(i=>i.product.id);state.outfitExclude=[el.dataset.id];state.outfitShop=outfit.same_shop?outfit.items[0].shop_id:null;await go('outfits');toast('جایگزین‌ها آماده‌اند؛ سایر اجزای ست ثابت مانده‌اند.');};
actions['outfit-plan']=el=>{const o=findOutfit(el.dataset.id);state.outfitPlan={items:structuredClone(o.items),created_at:new Date().toISOString(),checks:{}};state.outfitPlanActive=true;persist();return go('plan');};
actions['save-outfit-plan']=()=>{state.savedOutfitPlan=structuredClone(state.outfitPlan);persist();toast('برنامه خرید ست ذخیره شد.');};
actions['open-outfit-plan']=()=>{state.outfitPlan=structuredClone(state.savedOutfitPlan);state.outfitPlanActive=true;return go('plan');};
actions['outfit-directions']=el=>{const item=state.outfitPlan.items.find(i=>i.shop_id===el.dataset.id);if(item)directions(item.shop);};
const originalCreatePlan=actions['create-plan'],originalOpenPlan=actions['open-plan'];
actions['create-plan']=()=>{state.outfitPlanActive=false;return originalCreatePlan();};
actions['open-plan']=()=>{state.outfitPlanActive=false;return originalOpenPlan();};
actions['refresh-prices']=()=>go('prices');
actions['price-history']=async el=>{const data=await api('/api/offers/'+el.dataset.id+'/history');showDialog('سابقه گزارش قیمت',`<p>قیمت ثبت‌شدهٔ اولیه: ${money(Number(data.snapshot_price)||null)}</p><p>${priceAge(data.snapshot_changed_at)}</p>${data.events.length?data.events.map(e=>`<div class="offer-row"><strong>${money(e.price_toman)}</strong><p>${dateText(e.observed_at)}</p><p>${esc({in_stock:'موجود طبق گزارش فروشنده',out_of_stock:'ناموجود طبق گزارش فروشنده',unknown:'موجودی نامشخص'}[e.availability])}</p></div>`).join(''):'<p>هنوز گزارش تازه‌ای از فروشنده متصل دریافت نشده است.</p>'}`);};
actions['market-map']=el=>{const m=marketData.items.find(m=>m.id===el.dataset.id);if(!m)return;showDialog(m.name,mapPanel([{...m,id:m.id,lon:m.lon}])+`<p>${esc(m.location_basis)}</p><a class="btn btn-primary full" href="https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lon}" target="_blank" rel="noopener noreferrer">مسیریابی به محدوده</a>`);};
actions['market-shops']=el=>{const m=marketData.items.find(m=>m.id===el.dataset.id);if(!m)return;showDialog('فروشگاه‌های مرتبط در '+m.name,`<p>این فروشگاه‌ها بر اساس دسته فعالیت مرتبط‌اند؛ موجودی مدل شما بررسی نشده.</p>${m.shops.map(s=>`<section class="offer-row"><h3>${esc(s.name)}</h3><p>${esc(localNumbers(s.address))}</p>${phones(s)}${btn('جزئیات فروشگاه','directory-detail','section-link',`data-id="${s.id}"`)}</section>`).join('')}`);};
const originalDirectoryDetail=actions['directory-detail'];actions['directory-detail']=el=>{if($('#dialog').open)closeDialog();return originalDirectoryDetail(el);};
document.addEventListener('submit',e=>{
  if(e.target.id==='outfit-interview-form'){e.preventDefault();advanceOutfitInterview();}
  if(e.target.id==='market-form'){e.preventDefault();const f=new FormData(e.target);state.query=f.get('q');state.category=f.get('category');go('markets');}
});
document.addEventListener('change',e=>{if(e.target.dataset.outfitCheck!=null&&state.outfitPlan){state.outfitPlan.checks[e.target.dataset.outfitCheck]=e.target.checked;persist();}});
document.addEventListener('change',e=>{
  const input=e.target;if(!input.closest('#outfit-interview-form'))return;
  const a=outfitDraft().answers,name=input.name;
  if(name==='liked_colors'){
    if(!Object.hasOwn(outfitColorChoices,input.value))return;
    if(input.checked&&a.liked_colors.length>=3){input.checked=false;$('#outfit-interview-error').textContent='حداکثر سه رنگ انتخاب کن.';return;}
    a.liked_colors=input.checked?[...a.liked_colors,input.value]:a.liked_colors.filter(c=>c!==input.value);
    a.colorsAnswered=a.liked_colors.length>0;
    $('#outfit-color-count').textContent=a.liked_colors.length?fa(a.liked_colors.length)+' رنگ انتخاب شده':'رنگ آزاد است.';
  }else if(['audience','occasion','aesthetic','fit','coverage','season'].includes(name)){
    a[name]=input.value;
    if(name==='occasion'&&!outfitStyleAllowed(a.aesthetic,a.occasion))a.aesthetic='';
  }
  else if(['shoes','outer','accessory','multi','installment'].includes(name))a[name]=input.checked;
  else return;
  outfitInterviewError='';$('#outfit-interview-error').textContent='';persist();
});
document.addEventListener('input',e=>{if(e.target.id==='outfit-interview-budget'){outfitDraft().answers.budget=digits(e.target.value);persist();}});
// Refetch observations while the user is looking; never mark a snapshot fresh merely by refetching it.
setInterval(async()=>{
  if(!boot||busy||document.visibilityState!=='visible'||!['stores','store','product'].includes(route)||$('#dialog').open||document.activeElement?.matches('input,select,textarea'))return;
  try{await loadRoute();if(!busy)render();}catch{/* Keep the current screen; explicit refresh still reports failures. */}
},60000);

// ---- Department breadcrumb, purchase bundles, AI assistant and AI comparison ----
function breadcrumb(p){return p.group?`<nav class="breadcrumb" aria-label="مسیر دسته‌بندی"><a href="#categories">دسته‌ها</a>${icon('chevron')}<a href="#category?g=${p.group}">${esc(p.group_name)}</a>${icon('chevron')}<a href="#category?g=${p.group}&c=${encodeURIComponent(p.category)}">${esc(p.category)}</a></nav>`:'';}
function bundleSection(p){
  const b=bundleData;
  if(!p.bundle||!b||b.product!==p.id||!b.roles.length)return '';
  const o=b.one_stop;
  return `<section class="bundle" aria-labelledby="bundle-title"><div class="section-heading"><div><span class="section-kicker">${icon('bag')} خرید کامل</span><h2 id="bundle-title">کنار ${esc(p.category)} چه لازم داری؟</h2><p>${esc(b.note)}</p></div></div>${o?`<div class="panel one-stop"><div class="one-stop-head"><div class="store-avatar">${icon('store')}</div><div class="od-field od-fill"><span class="section-kicker">همه از یک فروشگاه</span><strong>${esc(o.shop.name)}</strong><small class="muted">${esc(o.shop.area)}</small></div>${badge(fa(o.items.length+1)+' قلم','good','check')}</div><ul class="one-stop-items"><li><span>${esc(p.name)}</span><strong>${money(o.base_price)}</strong></li>${o.items.map(i=>`<li><a href="#product?id=${i.product.id}&shop=${o.shop.id}">${image(i.product,'one-stop-image')}<span><small>${esc(i.role)}</small>${esc(i.product.name)}</span></a><strong>${money(i.price)}</strong></li>`).join('')}</ul>${o.missing.length?`<p class="helper">این فروشگاه برای «${esc(o.missing.join('، '))}» پیشنهادی ثبت نکرده است.</p>`:''}<div class="outfit-total"><div><span class="small muted">جمع قیمت ثبت‌شده</span><strong>${money(o.total)}</strong></div>${btn('ویترین فروشگاه','store-detail','btn-secondary',`data-id="${o.shop.id}"`)}</div>${phones(o.shop)}</div>`:''}${b.roles.filter(r=>b.options[r]?.length).map(r=>rail({id:'bundle-'+r.replace(/\s+/g,'-'),title:r,items:b.options[r],link:`#category?g=${p.group}&c=${encodeURIComponent(r)}`})).join('')}</section>`;
}
function understoodChips(u){
  if(!u)return '';
  const chips=[u.department_name&&[icon('grid'),u.department_name+(u.category?' › '+u.category:'')],u.max_price&&[icon('card'),'تا '+moneyWords(u.max_price)],u.min_price&&[icon('card'),'از '+moneyWords(u.min_price)],u.installment&&[icon('card'),'اقساط حضوری'],...(u.priorities||[]).map(x=>[icon('check'),x])].filter(Boolean);
  return `<section class="panel ai-understood"><h2>${icon('sparkle')} این‌طور فهمیدم</h2><div class="od-cluster">${chips.map(([i,t])=>`<span class="badge">${i}${esc(t)}</span>`).join('')}</div>${u.department&&u.category?`<a class="section-link" href="#category?g=${u.department}&c=${encodeURIComponent(u.category)}">همه کالاهای «${esc(u.category)}» ${icon('arrow')}</a>`:''}</section>`;
}
function pickCard(pick,index){
  const p=assistantData.items.find(x=>x.id===pick.id);if(!p)return '';
  const selected=state.compare.includes(p.id);
  return `<article class="pick-card"><span class="pick-rank">${fa(index+1)}</span><a href="#product?id=${p.id}">${image(p)}</a><div class="pick-body"><a href="#product?id=${p.id}"><h3>${esc(p.name)}</h3></a><p class="pick-price">${p.price==null?money(null):'از '+fa(p.price)+' <small>تومان</small>'} · ${fa(p.stores)} فروشگاه</p><p class="pick-why">${icon('check')}<span>${esc(pick.why)}</span></p>${pick.watch_out?`<p class="pick-watch">${icon('alert')}<span>${esc(pick.watch_out)}</span></p>`:''}<div class="card-actions">${btn(icon('store')+'فروشگاه‌ها','product-stores','btn-secondary',`data-id="${p.id}"`)}<button class="compare-button ${selected?'selected':''}" data-action="compare-toggle" data-id="${p.id}" aria-pressed="${selected}"><span class="compare-check">${selected?icon('check'):''}</span>مقایسه</button></div></div></article>`;
}
function assistantPage(){
  const d=assistantData;
  const examples=['گوشی برای عکاسی تا ۳۰ میلیون','لپ تاپ سبک برای دانشجو','هدفون بی‌سیم ارزان','کفش راحت پیاده‌روی زنانه'];
  const rest=d?d.items.filter(p=>!d.picks.some(x=>x.id===p.id)):[];
  return `<div class="page narrow-wide ${state.compare.length?'has-action':''}">${heading('دستیار خرید سرراه')}<form id="assistant-form" class="assistant-box"><label class="sr-only" for="assistant-q">سؤال خرید</label><div class="search-input-row">${icon('sparkle')}<textarea id="assistant-q" class="search-input" name="query" rows="2" maxlength="200" required placeholder="مثلاً: گوشی با دوربین خوب تا ۳۰ میلیون که اقساطی هم بشه خرید">${esc(d?d.question:'')}</textarea></div><button class="btn btn-primary search-submit" type="submit">${icon('sparkle')}<span>${d?'دوباره بپرس':'بپرس'}</span></button></form>${!d?`<div class="suggestion-group"><div class="suggestion-heading"><span>نمونه سؤال</span></div><div class="suggestions">${examples.map(q=>`<button class="chip" data-action="suggest" data-query="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>`:`${understoodChips(d.understood)}<div class="results-context"><span>${fa(d.total)} نتیجهٔ مرتبط؛ نمایش ${fa(Math.min(rest.length,6)+d.picks.length)} کالا</span>${btn('همهٔ نتیجه‌های مرتبط','assistant-more','section-link')}</div>${d.understood?.clarify&&!d.picks.length?`<div class="warning">${icon('info')}<p>${esc(d.understood.clarify)}</p></div>`:''}<section class="panel ai-answer"><h2>${icon('sparkle')} ${d.ai?'پیشنهاد دستیار':'نتیجه جست‌وجو'}</h2>${d.summary?`<p class="ai-summary">${esc(d.summary)}</p>`:''}${d.picks.length?`<div class="pick-list">${d.picks.map(pickCard).join('')}</div>`:''}${d.follow_up.length?`<div class="follow-up"><span>برای دقیق‌تر شدن، جواب بده:</span>${d.follow_up.map(q=>`<button class="chip" data-action="refine-question" data-query="${esc(q)}">${icon('chat')}${esc(q)}</button>`).join('')}</div>`:''}<p class="ai-disclaimer">${icon('info')}<span>دلیل‌ها از مشخصات ثبت‌شده آمده‌اند؛ قیمت و موجودی امروز را از فروشنده بپرس.</span></p></section>${rest.length?`<section class="home-section"><div class="section-heading"><h2>گزینه‌های دیگر</h2><span class="muted small">${fa(Math.min(rest.length,6))} کالا</span></div><div class="product-grid">${rest.slice(0,6).map(productCard).join('')}</div></section>`:''}`}${compareBar()}</div>`;
}
function insightPanel(items){
  const c=compareInsight;
  const kinds=new Set(items.map(p=>p.category));
  const warn=kinds.size>1?`<div class="warning">${icon('alert')}<p>این کالاها از دسته‌های متفاوت‌اند (${esc([...kinds].join('، '))})؛ مقایسه مشخصات آن‌ها معنای کمی دارد.</p></div>`:'';
  if(!c||c.ids!==state.compare.join(','))return warn;
  if(c.loading)return warn+`<section class="panel ai-compare" aria-busy="true"><h2>${icon('sparkle')} جمع‌بندی هوشمند</h2><div class="ai-thinking"><span class="spinner"></span><span>دستیار در حال خواندن مشخصات و یکسان‌سازی آن‌هاست…</span></div></section>`;
  if(!c.ai)return warn+note('جمع‌بندی هوشمند فعلاً در دسترس نیست.');
  const name=id=>esc(items.find(p=>p.id===id)?.name||'');
  return warn+`<section class="panel ai-compare"><h2>${icon('sparkle')} جمع‌بندی هوشمند</h2>${!c.same_kind?`<p class="field-error">دستیار هم تشخیص داد این کالاها هم‌نوع نیستند.</p>`:''}<p class="ai-summary">${esc(c.verdict)}</p>${c.aspects.length?`<div class="aspect-table" role="table" aria-label="مقایسه جنبه‌های مهم"><div class="aspect-row aspect-head" role="row"><span role="columnheader">جنبه</span>${items.map(p=>`<span role="columnheader">${esc(p.name)}</span>`).join('')}</div>${c.aspects.map(a=>`<div class="aspect-row" role="row"><span role="rowheader"><strong>${esc(a.name)}</strong>${a.why?`<small>${esc(a.why)}</small>`:''}</span>${items.map(p=>`<span role="cell" class="${a.better===p.id?'is-better':''}">${esc(a.values[p.id]||'—')}${a.better===p.id?`<b class="better-tag">${icon('check')}بهتر</b>`:''}</span>`).join('')}</div>`).join('')}</div>`:''}${c.best_for.length?`<div class="best-for">${c.best_for.map(b=>`<p><strong>${name(b.id)}</strong> مناسب: ${esc(b.who)}</p>`).join('')}</div>`:''}<p class="ai-disclaimer">${icon('info')}<span>فقط بر اساس مشخصات ثبت‌شده؛ قیمت را از جدول زیر و فروشنده ببین.</span></p></section>`;
}
const originalCompare=compare;
views.compare=function(){const items=state.compare.map(id=>productCache.get(id)).filter(Boolean);return originalCompare().replace('<!--insight-->',items.length<2?'':insightPanel(items));};
views.assistant=()=>{
  const d=assistantData;if(!d?.off_topic)return assistantPage();
  // Off-topic question: show the starting page (examples included) with a short pointer, not an empty result.
  assistantData=null;const html=assistantPage();assistantData=d;
  return html.replace('</form>',`</form><div class="warning" role="status">${icon('info')}<p>${esc(d.summary)}</p></div>`);
};
const loadRouteBase=loadRoute;
loadRoute=async function(){
  const token=generation;
  if(route==='assistant'){
    if(state.query&&assistantData?.question!==state.query&&!pendingFollowUp&&state.assistantFollowUp){state.query='';state.assistantFollowUp=false;persist();return;}
    if(state.query&&assistantData?.question!==state.query){if(!pendingFollowUp)assistantThread=[];pendingFollowUp=false;state.assistantFollowUp=assistantThread.length>0;persist();const asked=state.query,data=await api('/api/assistant',{q:state.query,history:assistantThread.length?JSON.stringify(assistantThread.map(({q,shown})=>({q,shown}))):''});
      // Keep an answer that arrives after the shopper left; it shows when they return to the assistant.
      if(token!==generation){if(state.query===asked&&route!=='assistant'){assistantData=data;cacheProducts(data.items);notifyReady('پاسخ دستیار آماده است.','assistant');}return;}
      assistantData=data;cacheProducts(data.items);}
    return;
  }
  await loadRouteBase();if(token!==generation)return;
  if(route==='product'&&product()?.bundle&&bundleData?.product!==state.product){const data=await api('/api/products/'+state.product+'/bundle',locParams());if(token===generation){bundleData={...data,product:state.product};cacheProducts(Object.values(data.options).flat());}}
  if(route==='compare'&&comparable()){
    const ids=state.compare.join(',');
    if(compareInsight?.ids!==ids){
      compareInsight={ids,loading:true};
      // The page renders immediately; the slower model answer fills in when it arrives.
      api('/api/compare-insight',{ids}).then(data=>{if(state.compare.join(',')===ids)compareInsight={...data,ids};}).catch(()=>{if(state.compare.join(',')===ids)compareInsight={ids,ai:false};}).finally(()=>{if(route==='compare'&&!busy)render();});
    }
  }
};
actions['refine-question']=el=>{const box=$('#assistant-q');if(!box)return;box.value='';box.placeholder=el.dataset.query;box.focus();};
actions['assistant-more']=()=>{if(!assistantData)return;state.query=assistantData.understood?.keywords||assistantData.question;state.category=assistantData.understood?.category||'';state.answers={...state.answers,max_price:assistantData.understood?.max_price||'',installment:!!assistantData.understood?.installment};return go('recommendations');};
const productWithComparison=views.product;
views.product=()=>{const html=productWithComparison().replace('مقایسه با محصول دیگر',state.compare.includes(state.product)?'حذف از مقایسه':'افزودن به مقایسه'),end=html.lastIndexOf('</div>');return html.slice(0,end)+compareBar()+html.slice(end);};
// Decor photo -> appliance color advice. The photo lives only in this request; nothing about it is saved.
const decorAdvice=new Map();
function decorPanel(p){
  if(p.group!=='appliances')return '';
  const a=decorAdvice.get(p.id)||{},d=a.data,colors=list=>list.map(c=>'«'+esc(c)+'»').join('، ');
  const messages={not_room:'در این عکس فضای خانه یا آشپزخانه دیده نشد؛ از جایی که وسیله قرار می‌گیرد عکس بگیر.',unavailable:'پیشنهاد رنگ فعلاً در دسترس نیست؛ کمی بعد دوباره امتحان کن.',invalid_response:'پاسخ قابل‌اعتمادی دریافت نشد؛ دوباره امتحان کن.'};
  const match=!d?'':d.match==='match'?`<p>${badge('رنگ ثبت‌شدهٔ همین کالا ('+d.colors.join('، ')+') با پیشنهاد جور است','good','check')}</p>`
    :d.match==='mismatch'?`<p>رنگ ثبت‌شدهٔ این کالا ${colors(d.colors)} است. اگر رنگ پیشنهادی را می‌خواهی، مدل‌های دیگر را ببین یا از فروشنده بپرس این مدل رنگ دیگری هم دارد یا نه.</p>`
    :'<p>رنگ این کالا در مشخصاتش ثبت نشده؛ رنگ‌های موجود را از فروشنده بپرس.</p>';
  const result=a.loading?'<p role="status">در حال بررسی رنگ‌های دکور…</p>':a.error?`<p class="helper" role="status">${esc(a.error)}</p>`:!d?''
    :d.status!=='advised'?`<p class="helper" role="status">${messages[d.status]||messages.invalid_response}</p>`
    :`<div class="decor-result" role="status"><p><strong>رنگ پیشنهادی:</strong> ${d.recommended.map(c=>badge(c,'good','palette')).join(' ')}</p>${d.avoid.length?`<p><strong>کمتر هماهنگ:</strong> ${d.avoid.map(c=>badge(c,'warn')).join(' ')}</p>`:''}${d.room_colors.length?`<p class="small muted">رنگ‌های غالب عکس: ${esc(d.room_colors.join('، '))}</p>`:''}${d.reason?`<p>${esc(d.reason)}</p>`:''}${match}${d.caution?`<p class="helper">${esc(d.caution)}</p>`:''}</div>${d.alternatives.length?rail({id:'decor-alternatives',title:'همین نوع کالا با رنگ پیشنهادی',items:d.alternatives,link:`#category?g=${p.group}&c=${encodeURIComponent(p.category)}`}):''}`;
  return `<section id="decor-panel" class="panel decor-advice" aria-labelledby="decor-title" aria-busy="${!!a.loading}"><h2 id="decor-title">${icon('palette')} کدام رنگ به دکورت می‌آید؟</h2><p>از جای وسیله عکس بفرست تا رنگ هماهنگ را پیشنهاد بدهیم.</p><label class="btn btn-secondary decor-upload">${d||a.error?'عکس دیگری بفرست':'انتخاب عکس دکور'}<input id="decor-photo" class="sr-only" type="file" accept="image/*" data-product="${esc(p.id)}"${a.loading?' disabled':''}></label><p class="helper">عکس ذخیره نمی‌شود.</p>${result}</section>`;
}
async function shrinkPhoto(file){
  // Re-encoding on the device keeps the upload small and drops EXIF metadata such as GPS location.
  const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('این فایل عکس قابل خواندن نیست؛ یک عکس JPEG یا PNG بفرست.');});
  const scale=Math.min(1,1024/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
  canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  return canvas.toDataURL('image/jpeg',.82);
}
document.addEventListener('change',async e=>{
  if(e.target.id!=='decor-photo'||!e.target.files?.[0])return;
  const id=e.target.dataset.product,file=e.target.files[0];e.target.value='';
  const update=()=>{const panel=$('#decor-panel'),p=product();if(panel&&p?.id===id)panel.outerHTML=decorPanel(p);};
  decorAdvice.set(id,{loading:true});update();
  try{
    const image=await shrinkPhoto(file);
    const response=await fetch('/api/color-advice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product_id:id,image})});
    if(!response.ok)throw new Error(response.status===429?'درخواست‌ها زیاد شده؛ کمی بعد دوباره امتحان کن.':[400,413].includes(response.status)?'این عکس قابل بررسی نیست؛ یک عکس دیگر بفرست.':'بررسی انجام نشد؛ دوباره امتحان کن.');
    const data=await response.json();cacheProducts(data.alternatives||[]);decorAdvice.set(id,{data});
  }catch(error){decorAdvice.set(id,{error:error.message||'بررسی انجام نشد؛ دوباره امتحان کن.'});}
  update();
});
const productWithDecor=views.product;
views.product=()=>{const html=productWithDecor(),p=product(),specs='<section class="panel"><h2>مشخصات ثبت‌شده</h2>';if(!p)return html;const panel=decorPanel(p);if(!panel)return html;if(html.includes(specs))return html.replace(specs,panel+specs);const end=html.lastIndexOf('</div>');return html.slice(0,end)+panel+html.slice(end);};
document.addEventListener('submit',e=>{if(e.target.id==='assistant-form'){e.preventDefault();const query=String(new FormData(e.target).get('query')||'').trim();if(assistantData&&query&&query!==assistantData.question){assistantLog=[...assistantLog,{...assistantTurn(assistantData),followUp:assistantThread.length>0}].slice(-8);if(e.submitter?.value==='continue'){assistantThread=[...assistantThread,assistantTurn(assistantData)].slice(-3);pendingFollowUp=true;}}startSearch(query);}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.target.id==='assistant-q'){e.preventDefault();e.target.form.requestSubmit();}});
// Questions people actually ask, per department: one-tap chips instead of an empty box to fill in.
const usageQuestions={mobile:['برای عکاسی شب خوبه؟','برای بازی سنگین کافیه؟','باتریش یه روز کامل دووم میاره؟'],digital:['برای فتوشاپ و طراحی کافیه؟','برای برنامه‌نویسی خوبه؟','برای دانشجو مناسبه؟'],appliances:['برای خانوادهٔ چهارنفره مناسبه؟','مصرف برقش زیاده؟','برای آشپزخانهٔ کوچک جا می‌شه؟'],home:['برای آشپزخانهٔ کوچک مناسبه؟','نگهداری و شست‌وشوش سخته؟'],fashion:['برای پیاده‌روی روزانه راحته؟','برای مهمانی مناسبه؟'],jewelry:['برای هدیه مناسبه؟','برای استفادهٔ روزانه مناسبه؟','اصالت و عیارش رو چطور بسنجم؟'],beauty:['برای پوست حساس مناسبه؟','برای استفادهٔ روزانه خوبه؟'],lighting:['برای اتاق خواب مناسبه؟','مصرف برقش کمه؟'],sports:['برای کوهنوردی و سفر مناسبه؟','برای استفادهٔ حرفه‌ای کافیه؟'],kids:['برای بچهٔ پنج‌ساله مناسبه؟','ایمنی‌اش چطوره؟'],auto:['برای ماشین من مناسبه؟'],office:['برای کار روزانهٔ اداری کافیه؟']};
const usageChips=p=>usageQuestions[p?.group]||['برای استفادهٔ روزمره مناسبه؟'];
const usageExample=p=>'مثلاً: '+usageChips(p)[0];
const priceExample=p=>p?.price?'مثلاً '+moneyWords(Math.round(p.price*1.05/(p.price>=1e6?1e5:1e3))*(p.price>=1e6?1e5:1e3)).replace(' تومان',''):'مثلاً ۲ میلیون';
const questionChips=(questions,action,attrs,current,disabled)=>`<div class="suggestion-chips" role="group" aria-label="پرسش‌های آماده">${questions.map(([need,label])=>`<button class="chip${current===need?' selected':''}" data-action="${action}" data-need="${esc(need)}" ${attrs}${disabled?' disabled':''}>${esc(label)}</button>`).join('')}</div>`;

// Price card: the recorded range shows by itself; checking a price the seller quoted is optional. Nothing is stored.
const priceChecks=new Map(),priceSummaries=new Map(),webPrices=new Map();
// Today's price on the web: one search on request (or by itself when nothing is recorded); found nothing → ask the seller.
function webPriceBlock(p,s){
  const w=webPrices.get(p.id),ask=btn(icon('message')+' پرسیدن قیمت از فروشنده','product-stores','btn-secondary',`data-id="${p.id}"`);
  if(!w)return s?.shops?`<div class="web-prices">${btn(icon('search')+' قیمت امروز را در اینترنت پیدا کن','web-prices','btn-secondary full',`data-id="${p.id}"`)}</div>`:'';
  if(w.loading)return '<div class="web-prices"><p class="helper" role="status">در حال جست‌وجوی قیمت در فروشگاه‌های اینترنتی… چند ثانیه طول می‌کشد.</p></div>';
  if(!w.offers?.length)return `<div class="web-prices" role="status"><p>${w.error?esc(w.error):'قیمتی برای همین کالا در اینترنت پیدا نشد.'} قیمت و موجودی را مستقیم از فروشنده بپرس.</p>${ask}</div>`;
  return `<div class="web-prices" role="status"><h3>قیمت در فروشگاه‌های اینترنتی</h3><ul>${w.offers.map(o=>`<li><a href="${esc(o.url)}" target="_blank" rel="noopener noreferrer nofollow"><span>${esc(o.source)}<small>${esc(o.host)}</small></span><strong title="${esc(money(o.price))}">${moneyWords(o.price)}</strong></a></li>`).join('')}</ul><p class="helper">از جست‌وجوی اینترنتی${w.checked_at?' · '+dateText(w.checked_at):''}؛ سرراه آن را بررسی نکرده است. پیش از خرید از فروشنده بپرس.</p>${ask}</div>`;
}
async function requestWebPrices(id){
  if(webPrices.has(id))return;
  webPrices.set(id,{loading:true});updatePriceCard(id);
  try{webPrices.set(id,await api('/api/products/'+id+'/web-prices'));}
  catch(error){webPrices.set(id,{offers:[],error:error.status===429?'جست‌وجوهای زیادی پشت سر هم انجام شد.':''});}
  updatePriceCard(id);
}
const updatePriceCard=id=>{const panel=$('#price-check'),p=product();if(panel&&p?.id===id)panel.outerHTML=priceCheckPanel(p);};
actions['web-prices']=el=>requestWebPrices(el.dataset.id);
// One plain verdict on a price, against the usual (median recorded) price of the same product across shops.
function priceVerdict(price,median){
  const r=price/median;
  return r<0.7?['خیلی ارزان‌تر از معمول؛ به نظر درست نمی‌آید. مدل دقیق، اصالت و گارانتی را بپرس.','warn']
    :r<0.93?['ارزان‌تر از معمول؛ قیمت خوبی است.','good']
    :r<=1.08?['قیمت معمولی است.','good']
    :r<=1.3?['کمی گران‌تر از معمول است.','warn']
    :['این قیمت به نظر درست نمی‌آید؛ خیلی گران‌تر از معمول است.','warn'];
}
function priceCheckPanel(p){
  const c=priceChecks.get(p.id)||{},d=c.data,s=priceSummaries.get(p.id);
  const summary=!s?'<p class="helper" role="status">در حال خواندن قیمت‌های ثبت‌شده…</p>':!s.shops?'<p class="helper">برای این کالا قیمت ثبت‌شده‌ای نداریم.</p>'
    :`<div class="price-range" role="group" aria-label="بازهٔ قیمت‌های ثبت‌شده"><div><small>کمترین</small><strong title="${esc(money(s.low))}">${moneyWords(s.low)}</strong></div><div class="median"><small>میانه</small><strong title="${esc(money(s.median))}">${moneyWords(s.median)}</strong></div><div><small>بیشترین</small><strong title="${esc(money(s.high))}">${moneyWords(s.high)}</strong></div></div><p class="helper">${fa(s.shops)} فروشگاه${s.newest_change?' · تازه‌ترین تغییر: '+dateText(s.newest_change):''}؛ قیمت ثبت‌شده است، نه قیمت امروز.</p>`;
  let result='';
  if(c.loading)result='<p role="status">در حال مقایسه…</p>';
  else if(c.error)result=`<p class="field-error" role="status">${esc(c.error)}</p>`;
  else if(d?.level==='no_data')result='<p class="helper" role="status">برای این کالا قیمت ثبت‌شده‌ای نداریم که با آن مقایسه کنیم.</p>';
  else if(d){const [verdict,tone]=priceVerdict(d.price,d.median);result=`<div class="price-check-result" role="status"><p class="price-verdict ${tone}">${verdict}</p><p>این کالا معمولاً حدود <strong>${moneyWords(d.median)}</strong> است؛ از ${moneyWords(d.low)} تا ${moneyWords(d.high)} در ${fa(d.shops)} فروشگاه.</p>${d.shops<3?`<p class="helper">فقط ${fa(d.shops)} قیمت ثبت شده و مقایسه محدود است.</p>`:''}</div>`;}
  return `<section id="price-check" class="panel price-check" aria-labelledby="price-check-title"><h2 id="price-check-title">${icon('tag')} قیمت این کالا در فروشگاه‌ها</h2>${summary}${webPriceBlock(p,s)}<details class="price-quote"${c.input?' open':''}><summary>فروشنده قیمت دیگری گفت؟ منصفانه بودنش را بسنج</summary><form id="price-check-form" data-product="${esc(p.id)}"><label class="sr-only" for="price-check-input">قیمتی که فروشنده گفت (تومان)</label><div class="search-input-row"><input id="price-check-input" class="search-input" name="price" data-amount inputmode="decimal" maxlength="30" required autocomplete="off" placeholder="${esc(priceExample(p))}" value="${esc(c.input||'')}"><button class="btn btn-secondary" type="submit"${c.loading?' disabled':''}>بسنج</button></div></form>${result}</details></section>`;
}
async function requestPriceSummary(id){
  if(priceSummaries.has(id))return;
  priceSummaries.set(id,null);
  try{priceSummaries.set(id,await api('/api/products/'+id+'/price-check'));}
  catch{priceSummaries.set(id,{shops:0});}
  updatePriceCard(id);
  if(!priceSummaries.get(id)?.shops)requestWebPrices(id);
}
document.addEventListener('submit',async e=>{
  if(e.target.id!=='price-check-form')return;
  e.preventDefault();
  const id=e.target.dataset.product,input=String(new FormData(e.target).get('price')||'').trim();
  const update=()=>{const panel=$('#price-check'),p=product();if(panel&&p?.id===id)panel.outerHTML=priceCheckPanel(p);};
  priceChecks.set(id,{loading:true,input});update();
  try{priceChecks.set(id,{input,data:await api('/api/products/'+id+'/price-check',{price:input})});}
  catch(error){priceChecks.set(id,{input,error:error.status===400?'قیمت را به تومان بنویس؛ مثلاً ۲۶٫۵ میلیون یا ۲۶۵۰۰۰۰۰.':error.message});}
  update();
});
const productWithPriceCheck=views.product;
// The price card sits under the product card, so the side column carries the decision tools next to the long specs.
views.product=()=>{const html=productWithPriceCheck(),p=product();return p?html.replace('<!--product-side-->',priceCheckPanel(p)+'<!--product-side-->'):html;};
const loadRouteWithPriceSummary=loadRoute;
loadRoute=async function(){await loadRouteWithPriceSummary();if(route==='product'&&state.product)requestPriceSummary(state.product);};

// «Which one is for me?»: ready questions for the compared kind of product, or the shopper's own words; the pick must be a compared id.
const insightWithNeed=insightPanel;
insightPanel=function(items){
  const html=insightWithNeed(items),c=compareInsight;
  if(!c?.ai||c.ids!==state.compare.join(',')||c.same_kind===false)return html;
  const pick=c.for_need&&items.find(p=>p.id===c.for_need.id),ready=usageChips(items[0]);
  const answer=c.needLoading?'<p role="status">در حال سنجیدن با کاربرد تو…</p>':pick?`<p role="status">${badge('برای «'+c.need+'»: '+pick.name,'good','check')}</p>${c.for_need.why?`<p>${esc(c.for_need.why)}</p>`:''}`:c.need?'<p class="helper" role="status">از مشخصات ثبت‌شده نمی‌شود برای این کاربرد یکی را با اطمینان انتخاب کرد.</p>':'';
  const block=`<div class="for-need"><h3>کدام برای من؟</h3>${questionChips(ready.map(q=>[q,q]),'compare-need-chip','',c.need,c.needLoading)}<details class="own-question"${c.need&&!ready.includes(c.need)?' open':''}><summary>کاربرد خودت را بنویس</summary><form id="compare-need-form"><label class="sr-only" for="compare-need">کاربرد تو</label><div class="search-input-row"><input id="compare-need" class="search-input" name="need" maxlength="160" required value="${esc(ready.includes(c.need)?'':c.need||'')}" placeholder="${esc(usageExample(items[0]))}"><button class="btn btn-secondary" type="submit"${c.needLoading?' disabled':''}>بپرس</button></div></form></details>${answer}</div>`;
  const end=html.lastIndexOf('</section>');return end<0?html:html.slice(0,end)+block+html.slice(end);
};
function askCompareNeed(need){
  need=String(need||'').trim().slice(0,160);const ids=state.compare.join(','),previous=compareInsight;
  if(!need||!previous?.ai||previous.needLoading)return;
  compareInsight={...previous,need,needLoading:true};render();
  const failed=()=>{compareInsight={...previous,need,for_need:null};toast('پاسخ دستیار دریافت نشد؛ دوباره تلاش کن.');};
  api('/api/compare-insight',{ids,need}).then(data=>{if(state.compare.join(',')!==ids)return;if(data.ai)compareInsight={...data,ids};else failed();}).catch(()=>{if(state.compare.join(',')===ids)failed();}).finally(()=>{if(route==='compare'&&!busy)render();});
}
actions['compare-need-chip']=el=>askCompareNeed(el.dataset.need);
document.addEventListener('submit',e=>{
  if(e.target.id!=='compare-need-form')return;
  e.preventDefault();askCompareNeed(new FormData(e.target).get('need'));
});


// Shared list: product ids travel in the link itself; no account and nothing on the server.
let sharedIds=[];
const sharedFrom=target=>[...new Set((new URLSearchParams(String(target).split('?')[1]||'').get('ids')||'').split(',').filter(id=>/^product_[a-zA-Z0-9]+$/.test(id)))].slice(0,30);
if(route==='shared')sharedIds=sharedFrom(location.hash);
const readTargetWithShared=readTarget;
readTarget=function(target){const name=readTargetWithShared(target);if(name==='shared'&&String(target).includes('?'))sharedIds=sharedFrom(target);return name;};
function sharedPage(){
  const items=sharedIds.map(id=>productCache.get(id)).filter(Boolean),missing=sharedIds.length-items.length;
  return `<div class="page">${heading('لیست مشترک')}${items.length?`<div class="detail-actions">${btn(icon('bookmark')+' افزودن همه به ذخیره‌شده‌ها','save-shared','btn-primary')}</div><div class="product-grid">${items.map(productCard).join('')}</div>${missing?note(fa(missing)+' کالای این لینک دیگر در فهرست نیست.'):''}`:empty('کالایی در این لینک نیست','لینک ناقص است یا کالاهایش دیگر در فهرست نیستند.','home','بازگشت به خانه')}</div>`;
}
views.shared=sharedPage;
const loadRouteWithShared=loadRoute;
loadRoute=async function(){if(route!=='shared')return loadRouteWithShared();await Promise.allSettled(sharedIds.map(getProduct));};
const savedWithShare=views.saved;
views.saved=()=>{const html=savedWithShare();return state.saved.length?html.replace('<div class="product-grid">',`<div class="detail-actions">${btn(icon('copy')+' اشتراک‌گذاری لیست با لینک','share-saved','btn-secondary')}</div><div class="product-grid">`):html;};
actions['share-saved']=async()=>{
  const url=location.origin+location.pathname+'#shared?ids='+state.saved.slice(0,30).join(',');
  try{if(navigator.share){await navigator.share({title:'لیست خرید سرراه',url});return;}await navigator.clipboard.writeText(url);toast('لینک لیست کپی شد.');}
  catch(error){if(error?.name!=='AbortError')showDialog('لینک لیست',`<textarea readonly rows="3" aria-label="لینک لیست">${esc(url)}</textarea>`);}
};
actions['save-shared']=()=>{const ids=sharedIds.filter(id=>productCache.has(id));state.saved=[...new Set([...state.saved,...ids])];persist();toast(fa(ids.length)+' کالا به ذخیره‌شده‌ها اضافه شد.');return go('saved');};
// One-day shopping route over saved products: fewest shops vs cheapest, in visiting order. Legs are straight-line distances.
let routeData=null;
function routeMapUrl(plan){
  // No origin in the link: the map app starts from the device's own location.
  const points=plan.stops.map(s=>s.shop.lat+','+s.shop.lon),destination=points.pop();
  return 'https://www.google.com/maps/dir/?api=1&destination='+destination+(points.length?'&waypoints='+encodeURIComponent(points.join('|')):'')+'&travelmode=driving';
}
function routePage(){
  const title='مسیر خرید یک‌روزه',d=routeData;
  if(state.saved.length<2||!d)return `<div class="page">${heading(title)}${empty('حداقل دو کالا ذخیره کن','کالاهایی را که می‌خواهی در یک روز بخری ذخیره کن تا کم‌دردسرترین ترتیب فروشگاه‌ها را پیدا کنیم.','recommendations','دیدن محصول‌ها','bookmark')}</div>`;
  const names={fewest:['کمترین تعداد مغازه','store'],cheapest:['کمترین جمع قیمت','tag']},cheapest=Math.min(...d.plans.map(p=>p.total));
  const plan=p=>{const [name,symbol]=d.plans.length>1?names[p.kind]:['مسیر پیشنهادی','map'],extra=p.total-cheapest;
    return `<section class="panel route-plan"><h2>${icon(symbol)} ${name}</h2><p class="route-summary">${fa(p.shop_count)} مغازه · جمع ${money(p.total)}${extra>0?' · '+money(extra)+' بیشتر از ارزان‌ترین حالت':''}${p.distance_km?' · حدود '+fa(p.distance_km)+' کیلومتر فاصلهٔ مستقیم':''}</p><ol class="route-stops">${p.stops.map((s,i)=>`<li class="route-stop"><span class="route-step" aria-hidden="true">${fa(i+1)}</span><div class="od-field od-fill"><strong>${esc(s.shop.name)}</strong><span class="small muted">${esc(s.shop.area)}${s.leg_km!=null?' · '+fa(s.leg_km)+' کیلومتر از '+(i?'مقصد قبلی':'محدودهٔ تو'):''}</span>${metroLine(s.shop)}<div class="store-statuses">${badge(localNumbers(s.shop.opening.label),s.closed?'warn':'','clock')}${s.closed?badge('فقط همین فروشگاه این کالا را دارد','warn','alert'):''}</div><ul class="route-items">${s.items.map(i=>`<li><a href="#product?id=${i.product.id}&shop=${s.shop.id}">${esc(i.product.name)}</a><strong>${money(i.price)}</strong></li>`).join('')}</ul>${btn(icon('pin')+'مسیریابی این مقصد','route-directions','btn-quiet',`data-shop="${s.shop.id}"`)}</div></li>`).join('')}</ol>${p.stops.length>1&&p.stops.length<=10?`<a class="btn btn-primary full" href="${esc(routeMapUrl(p))}" target="_blank" rel="noopener noreferrer">${icon('map')} کل مسیر در نقشه</a>`:''}</section>`;};
  return `<div class="page">${heading(title,fa(Math.min(state.saved.length,12))+' کالای ذخیره‌شده')}${d.located?'':`<div class="warning">${icon('pin')}<p>محدوده‌ات انتخاب نشده؛ ترتیب فقط بر اساس فاصلهٔ فروشگاه‌ها از هم است. ${btn('انتخاب محدوده','location','btn-text')}</p></div>`}${state.saved.length>12?note('فقط ۱۲ کالای اول ذخیره‌شده در مسیر آمده‌اند.'):''}${d.plans.length===1?note('این مسیر هم کمترین تعداد مغازه را دارد و هم ارزان‌ترین است.'):''}${d.plans.map(plan).join('')}${d.missing.length?`<section class="panel"><h2>در هیچ فروشگاه ثبت‌شده‌ای قیمت ندارد</h2><ul>${d.missing.map(p=>`<li>${esc(p.name)}</li>`).join('')}</ul></section>`:''}${d.unknown?note(fa(d.unknown)+' کالای ذخیره‌شده دیگر در فهرست نیست.'):''}${note('فاصله‌ها مستقیم‌اند؛ قیمت و موجودی را پیش از رفتن بپرس.')}</div>`;
}
views.route=routePage;
const loadRouteWithPlan=loadRoute;
loadRoute=async function(){
  if(route!=='route')return loadRouteWithPlan();
  const token=generation;routeData=null;
  if(state.saved.length<2)return;
  const data=await api('/api/route-plan',{ids:state.saved.slice(0,12).join(','),...locParams()});
  if(token!==generation)return;
  routeData=data;data.plans.forEach(p=>p.stops.forEach(s=>cacheProducts(s.items.map(i=>i.product))));
};
const savedWithRoute=views.saved;
views.saved=()=>{const html=savedWithRoute();return state.saved.length>=2?html.replace('<div class="detail-actions">',`<div class="detail-actions">${btn(icon('map')+' مسیر خرید یک‌روزه','open-route','btn-primary')}`):html;};
actions['open-route']=()=>go('route');
actions['route-directions']=el=>{const stop=routeData?.plans.flatMap(p=>p.stops).find(s=>s.shop.id===el.dataset.shop);if(stop)directions(stop.shop);};

// Photo search: the photo only names the item; matching, prices and sellers come from the catalog.
let photoResult=null;
function photoNearby(p){
  const n=photoResult?.nearby;if(!n?.length)return '';
  return `<section class="photo-nearby"><h2>${origin?'نزدیک‌ترین فروشنده‌های':'فروشنده‌های'} «${esc(p.name)}»</h2><ul class="route-items">${n.map(s=>`<li><a href="#store?shop=${s.id}">${esc(s.name)} · ${esc(s.area)}${s.distance_km!=null?' · '+fa(s.distance_km)+' کیلومتر':''}</a><strong>${money(s.price)}</strong></li>`).join('')}</ul>${btn('همهٔ فروشگاه‌های این کالا','product-stores','btn-secondary',`data-id="${p.id}"`)}${origin?'':note('محدوده‌ات را انتخاب کن تا فروشنده‌های نزدیک‌تر اول بیایند.')}</section>`;
}
function photoPage(){
  const r=photoResult||{},d=r.data,u=d?.understood;
  const matches={exact:'برند و مدلی که در عکس دیده شد در کاتالوگ هست؛ پیش از خرید مدل دقیق را تطبیق بده.',keywords:'کالاهای نزدیک به نشانه‌های عکس؛ مدل دقیق را تطبیق بده.',brand:'مدل دقیق پیدا نشد؛ این‌ها کالاهای همین برند و نوع‌اند.',type:'برند یا مدل پیدا نشد؛ این‌ها کالاهای همین نوع‌اند.'};
  const what=u?`<div class="photo-understood"><p>${badge([u.brand,u.model].filter(Boolean).join(' ')||u.product_type||'کالا',u.confidence==='high'?'good':'warn','sparkle')}${u.product_type?' '+esc(u.product_type):''}</p>${u.seen?`<p class="small muted">${esc(u.seen)}</p>`:''}${u.confidence==='low'?'<p class="helper">تشخیص از روی این عکس مطمئن نیست.</p>':''}</div>`:'';
  const body=r.loading?'<p role="status">در حال شناختن کالا از روی عکس…</p>':r.error?`<p class="field-error" role="status">${esc(r.error)}</p>`:!d?''
    :d.status==='found'?`${what}<p class="helper">${matches[d.match]}</p>${photoNearby(d.items[0])}<div class="product-grid">${d.items.map(productCard).join('')}</div>`
    :d.status==='no_match'?`${what}<p>کالایی شبیه این عکس در فروشگاه‌های ثبت‌شده پیدا نشد.</p>${btn('جست‌وجوی متنی','photo-text-search','btn-secondary',`data-query="${esc([u.brand,u.model,u.product_type].filter(Boolean).join(' '))}"`)}`
    :`<p class="helper" role="status">${d.status==='not_product'?'در این عکس کالای مشخصی دیده نشد؛ از خود کالا، برچسب یا جعبه‌اش عکس بگیر.':'شناسایی عکس فعلاً در دسترس نیست؛ کمی بعد دوباره امتحان کن.'}</p>`;
  return `<div class="page">${heading('جست‌وجو با عکس','از خود کالا، برچسب یا جعبه‌اش عکس بگیر.')}<section class="panel photo-search" aria-busy="${!!r.loading}"><label class="btn btn-primary decor-upload">${icon('camera')} ${d||r.error?'عکس دیگری بفرست':'گرفتن یا انتخاب عکس'}<input id="photo-search-input" class="sr-only" type="file" accept="image/*"${r.loading?' disabled':''}></label><p class="helper">عکس ذخیره نمی‌شود.</p>${body}</section></div>`;
}
views.photo=photoPage;
document.addEventListener('change',async e=>{
  if(e.target.id!=='photo-search-input'||!e.target.files?.[0])return;
  const file=e.target.files[0];e.target.value='';
  const update=()=>{if(route==='photo')render();};
  photoResult={loading:true};update();
  try{
    const image=await shrinkPhoto(file);
    const response=await fetch('/api/photo-search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image})});
    if(!response.ok)throw new Error(!navigator.onLine?offlineMessage:response.status===429?'درخواست‌ها زیاد شده؛ کمی بعد دوباره امتحان کن.':[400,413].includes(response.status)?'این عکس قابل بررسی نیست؛ یک عکس دیگر بفرست.':'بررسی انجام نشد؛ دوباره امتحان کن.');
    const data=await response.json();cacheProducts(data.items);photoResult={data};
    // Sellers are shown only for a close match, so a looser result never reads as the photographed item.
    if(data.status==='found'&&['exact','keywords'].includes(data.match)){
      const stores=await api('/api/products/'+data.items[0].id+'/stores',locParams()).catch(()=>null);
      if(stores)photoResult.nearby=stores.items.filter(s=>s.price!=null).sort((a,b)=>(a.distance_km??Infinity)-(b.distance_km??Infinity)||a.price-b.price).slice(0,3);
    }
  }catch(error){photoResult={error:error.message||'بررسی انجام نشد؛ دوباره امتحان کن.'};}
  update();
});
actions['photo-text-search']=el=>startSearch(el.dataset.query);
const searchFormWithPhoto=searchForm;
// Home lists photo search among its tools, so the extra link is only for other search boxes.
searchForm=function(){return searchFormWithPhoto()+(route==='home'?'':`<a class="photo-entry" href="#photo">${icon('camera')} جست‌وجو با عکس</a>`);};

// Dowry planner: the budget is split by each category's median recorded price, with three listings near each share.
let dowryData=null,dowryCatalog=null,dowryBusy=false;
const dowryTiers={economy:'اقتصادی',balanced:'متعادل',better:'بهتر'};
function dowryPage(){
  const plan=state.dowry||{},catalog=dowryCatalog||[],chosen=new Set(plan.items||[]),d=dowryData;
  const form=`<form id="dowry-form" class="panel dowry-form"><label class="search-label" for="dowry-budget">بودجهٔ کل (تومان)</label><input id="dowry-budget" class="search-input" name="budget" data-amount inputmode="decimal" maxlength="30" required autocomplete="off" placeholder="مثلاً ۳۰۰ میلیون" value="${esc(plan.budget||'')}"><fieldset class="dowry-items"><legend>چه وسایلی لازم داری؟</legend>${catalog.map(c=>`<label class="chip-option"><input type="checkbox" name="items" value="${esc(c.key)}"${chosen.has(c.key)?' checked':''}><span>${esc(c.label)}</span></label>`).join('')}</fieldset><label class="search-label" for="dowry-extra">چیز دیگری هم لازم داری؟ <span class="muted">(اختیاری، با ویرگول جدا کن)</span></label><input id="dowry-extra" class="search-input" name="extra" maxlength="200" autocomplete="off" placeholder="مثلاً آینه، سرویس قاشق چنگال" value="${esc(plan.extra||'')}"><button class="btn btn-primary full" type="submit"${dowryBusy?' disabled':''}>${dowryBusy?'در حال پیدا کردن کالاها…':'پیدا کردن کالاهای پیشنهادی'}</button></form>`;
  let result='';
  if(dowryBusy)result=`<p class="dowry-status" role="status">${icon('spinner')} در حال پیدا کردن کالاهای مناسب بودجه‌ات…</p>`;
  else if(d?.error)result=`<p class="field-error" role="status">${esc(d.error)}</p>`;
  else if(d?.items){
    // The recommended basket is each item's mid-priced listing; the other tiers and nearby listings are "similar".
    const picks=d.items.map(i=>i.options.find(o=>o.tier==='balanced')||i.options[0]),total=picks.reduce((sum,o)=>sum+o.price,0);
    result=`<section id="dowry-results" class="panel dowry-summary" tabindex="-1"><h2>سبد پیشنهادی جهیزیه</h2><p>برای هر وسیله یک کالا متناسب با سهمش از بودجه انتخاب شد. جمع این سبد <strong>${money(total)}</strong> از بودجهٔ ${money(d.budget)} است.</p>${d.cheapest_total>d.budget?`<p class="field-error">ارزان‌ترین گزینهٔ ثبت‌شدهٔ این وسایل روی هم ${money(d.cheapest_total)} می‌شود؛ بیشتر از بودجه. چند قلم را بردار یا بودجه را بیشتر کن.</p>`:total>d.budget?`<p class="field-error">این سبد از بودجه بیشتر شد؛ از کالاهای مشابهِ ارزان‌تر هر وسیله استفاده کن.</p>`:''}${d.missing.length?`<p class="helper">برای ${esc(d.missing.join('، '))} قیمت ثبت‌شده‌ای نداریم.</p>`:''}<p class="helper">قیمت‌ها ثبت‌شده‌اند، نه قیمت امروز.</p></section>${d.items.map((i,n)=>dowryItem(i,picks[n])).join('')}`;
  }
  return `<div class="page">${heading('برنامه‌ریز جهیزیه')}${form}${result}</div>`;
}
function dowryItem(i,pick){
  const p=pick.product,others=[...i.options.filter(o=>o!==pick),...(i.similar||[])];
  return `<section class="panel dowry-item"><div class="dowry-head"><h2>${esc(i.label)}</h2><span class="small muted">سهم بودجه ${money(i.share)}</span></div><a class="dowry-pick" href="#product?id=${p.id}">${image(p)}<span class="dowry-pick-info"><span class="badge good">پیشنهاد ما</span><strong class="od-clamp-2">${esc(p.name)}</strong><span class="dowry-price">${money(pick.price)}</span><span class="small muted">${icon('store')} ${fa(p.stores)} فروشگاه</span></span></a>${others.length?`<h3 class="dowry-sub">کالاهای مشابه</h3><div class="dowry-options">${others.map(o=>`<a class="dowry-option" href="#product?id=${o.product.id}">${image(o.product)}${o.tier?`<span class="small muted">${dowryTiers[o.tier]}</span>`:''}<span class="od-clamp-2">${esc(o.product.name)}</span><strong>${money(o.price)}</strong></a>`).join('')}</div>`:''}</section>`;
}
views.dowry=dowryPage;
async function loadDowry(){
  if(!dowryCatalog)dowryCatalog=(await api('/api/dowry')).catalog;
  const plan=state.dowry;if(dowryData||!plan?.budget||!(plan.items?.length||plan.extra))return;
  try{dowryData=await api('/api/dowry',{budget:plan.budget,items:(plan.items||[]).join(','),extra:plan.extra||''});dowryData.items.forEach(i=>cacheProducts([...i.options,...(i.similar||[])].map(o=>o.product)));}
  catch(error){dowryData={error:error.status===400?'بودجه را به تومان بنویس؛ مثلاً ۳۰۰ میلیون.':error.message};}
}
const loadRouteWithDowry=loadRoute;
loadRoute=async function(){if(route!=='dowry')return loadRouteWithDowry();await loadDowry();};
document.addEventListener('submit',async e=>{
  if(e.target.id!=='dowry-form')return;
  e.preventDefault();
  const form=new FormData(e.target);state.dowry={budget:String(form.get('budget')||'').trim(),items:form.getAll('items').map(String),extra:String(form.get('extra')||'').trim()};persist();
  dowryData=state.dowry.items.length||state.dowry.extra?null:{error:'حداقل یک قلم را انتخاب کن یا بنویس.'};
  dowryBusy=!dowryData;render();
  try{await loadDowry();}finally{dowryBusy=false;}
  if(route!=='dowry')return;
  render();
  // Results sit below a long checklist; bring them into view so the button visibly did something.
  const results=$('#dowry-results')||$('#main .field-error');
  // Focus first: a focus() after a smooth scroll starts would cancel that scroll.
  if(results?.id==='dowry-results')results.focus({preventScroll:true});
  results?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
});

// Multi-step assistant: earlier turns of this visit (questions and what was shown) go back with each follow-up; nothing is saved.
let assistantThread=[],pendingFollowUp=false,assistantLog=[];
const assistantTurn=d=>({q:d.question,summary:d.summary,shown:(d.picks.length?d.picks.map(p=>productCache.get(p.id)):d.items).filter(Boolean).slice(0,3).map(p=>p.name.slice(0,80)+(p.price?' — '+p.price+' تومان':''))});
const assistantWithThread=views.assistant;
views.assistant=()=>{
  let html=assistantWithThread();const d=assistantData;
  if(d){
    // The box stays free for a new question; continuing the same topic is an explicit choice.
    html=html.replace(`>${esc(d.question)}</textarea>`,'></textarea>').replace(/placeholder="[^"]*"/,'placeholder="سؤال تازه‌ات را بنویس؛ برای ادامهٔ همین بحث، دکمهٔ «ادامه» را بزن"')
      .replace(/<button class="btn btn-primary search-submit" type="submit">[\s\S]*?<\/button>/,`<div class="assistant-submit"><button class="btn btn-primary search-submit" type="submit" name="mode" value="new">${icon('sparkle')}<span>سؤال تازه</span></button>${d.ai&&!d.off_topic?`<button class="btn btn-secondary" type="submit" name="mode" value="continue">${icon('chat')}<span>ادامهٔ همین گفت‌وگو</span></button>`:''}</div>`);
  }
  const asked=d?`<p class="assistant-asked">${icon('chat')}<span>${assistantThread.length?`<small>در ادامهٔ «${esc(assistantThread[assistantThread.length-1].q)}»</small>`:''}${esc(d.question)}</span></p>`:'';
  const past=assistantLog.length?`<section class="panel assistant-past"><h2>پیام‌های قبلی</h2><ol>${assistantLog.slice().reverse().map(t=>`<li><strong>${esc(t.q)}</strong>${t.summary?`<span class="small muted">${esc(t.summary)}</span>`:''}</li>`).join('')}</ol>${btn('پاک کردن گفت‌وگو','assistant-reset','btn-quiet')}</section>`:'';
  html=html.replace('</form>',`</form><a class="photo-entry" href="#gift">${icon('heart')} پیدا کردن هدیه</a>${asked}`);
  const last=html.lastIndexOf('</div>');return past&&last>=0?html.slice(0,last)+past+html.slice(last):html;
};
// A fresh search (not typed as a follow-up) is never treated as one, even right after a reload.
const startSearchFresh=startSearch;
startSearch=query=>{if(!pendingFollowUp)state.assistantFollowUp=false;return startSearchFresh(query);};
actions['assistant-reset']=()=>{assistantThread=[];assistantLog=[];assistantData=null;state.query='';render();$('#assistant-q')?.focus();};

// Gift interview: who, how old, what they like and the budget; candidates come from the catalog, the model only picks.
let giftResult=null;
const giftChoices={relation:[['spouse','همسر'],['mother','مادر'],['father','پدر'],['friend','دوست'],['colleague','همکار'],['child','کودک']],
  age:[['child','کودک'],['teen','نوجوان'],['young','جوان'],['adult','میانسال'],['senior','سالمند']],for:[['any','فرقی ندارد'],['women','خانم'],['men','آقا']],
  interests:[['tech','تکنولوژی'],['cooking','آشپزی'],['sport','ورزش و سفر'],['beauty','آرایش و عطر'],['books','کتاب و نوشت‌افزار'],['fashion','مد و پوشاک'],['decor','خانه و دکور'],['play','بازی و سرگرمی']]};
function giftPage(){
  const a=state.giftAnswers||{},r=giftResult||{},d=r.data;
  // Three questions: who, what they like, how much. Age and gender follow from «who» unless set under «دقیق‌ترش کن».
  const group=(name,legend,type,required)=>`<fieldset class="interview-group gift-group"><legend>${legend}</legend><div class="gift-options">${giftChoices[name].map(([v,t])=>`<label class="chip-option"><input type="${type}" name="${name}" value="${v}"${(type==='radio'?a[name]===v:(a[name]||[]).includes(v))?' checked':''}${required?' required':''}><span>${t}</span></label>`).join('')}</div></fieldset>`;
  const budgets=[['1000000','تا ۱ میلیون'],['3000000','تا ۳ میلیون'],['10000000','تا ۱۰ میلیون'],['30000000','تا ۳۰ میلیون']],quick=budgets.some(([v])=>v===a.budget);
  const form=`<form id="gift-form" class="panel gift-form">${group('relation','برای کی؟','radio',true)}${group('interests','به چی علاقه داره؟','checkbox')}<fieldset class="interview-group gift-group"><legend>تا چقدر؟</legend><div class="gift-options">${budgets.map(([v,t])=>`<label class="chip-option"><input type="radio" name="budget" value="${v}"${a.budget===v?' checked':''}><span>${t}</span></label>`).join('')}</div><input class="search-input gift-other" name="budget_other" data-amount inputmode="decimal" maxlength="30" autocomplete="off" aria-label="مبلغ دیگر به تومان" placeholder="یا مبلغ دیگر، مثلاً ۵ میلیون" value="${quick?'':esc(a.budget||'')}"></fieldset><details class="gift-more"${a.age||a.for?' open':''}><summary>دقیق‌ترش کن (اختیاری)</summary>${group('age','چند سال داره؟','radio')}${group('for','برای خانم یا آقا؟','radio')}</details><button class="btn btn-primary full" type="submit"${r.loading?' disabled':''}>پیدا کردن هدیه</button></form>`;
  const result=r.loading?'<p role="status">در حال گشتن بین کالاها…</p>':r.error?`<p class="field-error" role="status">${esc(r.error)}</p>`:!d?'':`<section class="panel ai-answer" role="status"><h2>${icon('sparkle')} ${d.ai?'پیشنهاد هدیه':'کالاهای مرتبط'}</h2>${d.summary?`<p class="ai-summary">${esc(d.summary)}</p>`:''}${d.picks.length?`<div class="gift-picks">${d.picks.map(p=>`<div class="gift-pick">${productCard(p.product)}${p.why?`<p class="small">${esc(p.why)}</p>`:''}</div>`).join('')}</div>`:''}${d.items.length?`<h3>${d.picks.length?'گزینه‌های دیگر':'کالاها'}</h3><div class="product-grid">${d.items.map(productCard).join('')}</div>`:''}</section>`;
  return `<div class="page">${heading('پیدا کردن هدیه')}${form}${result}</div>`;
}
views.gift=giftPage;
document.addEventListener('submit',async e=>{
  if(e.target.id!=='gift-form')return;
  e.preventDefault();
  const f=new FormData(e.target),answers={relation:f.get('relation'),age:f.get('age')||'',for:f.get('for')||'',interests:f.getAll('interests').map(String),budget:String(f.get('budget_other')||'').trim()||String(f.get('budget')||'')};
  state.giftAnswers=answers;persist();
  if(!answers.interests.length){giftResult={error:'حداقل یک علاقه را انتخاب کن.'};return render();}
  if(!answers.budget){giftResult={error:'بودجه را انتخاب کن یا بنویس.'};return render();}
  giftResult={loading:true};render();
  try{const data=await api('/api/gift',{...answers,interests:answers.interests.join(',')});cacheProducts([...data.items,...data.picks.map(p=>p.product)]);giftResult={data};}
  catch(error){giftResult={error:error.status===400?'بودجه را به تومان بنویس؛ مثلاً ۳ میلیون.':error.message};}
  if(route==='gift')render();
});

// Plain-language specs: ready questions for this kind of product (or the shopper's own); only recorded specs are explained.
const specExplain=new Map();
function explainPanel(p){
  if((p.specs||[]).length<2)return '';
  const e=specExplain.get(p.id)||{},d=e.data,ready=usageChips(p),verdicts={yes:['به نظر مناسب است','good'],maybe:['شاید؛ بستگی دارد','warn'],no:['احتمالاً کافی نیست','warn'],unknown:['از مشخصات معلوم نیست','']};
  const result=e.loading?'<p role="status">در حال ساده‌کردن مشخصات…</p>':e.error?`<p class="field-error" role="status">${esc(e.error)}</p>`:!d?'':!d.ai?`<p class="helper" role="status">${d.reason==='no_specs'?'مشخصات کافی برای توضیح ثبت نشده است.':'توضیح ساده فعلاً در دسترس نیست؛ کمی بعد دوباره امتحان کن.'}</p>`
    :`<div class="explain-result" role="status">${d.fits_need?`<p>${badge(verdicts[d.fits_need.verdict][0],verdicts[d.fits_need.verdict][1],'info')} ${esc(d.fits_need.why)}</p>`:''}<dl class="explain-points">${d.points.map(x=>`<div><dt>${esc(x.key)}: <bdi>${esc(x.value)}</bdi></dt><dd>${esc(x.plain)}${x.matters?`<small>${esc(x.matters)}</small>`:''}</dd></div>`).join('')}</dl><p class="helper">فقط از مشخصات ثبت‌شده.</p></div>`;
  const chips=questionChips([['','فقط به زبان ساده توضیح بده'],...ready.map(q=>[q,q])],'explain-need',`data-product="${esc(p.id)}"`,(e.data||e.loading)?e.need:null,e.loading);
  return `<section id="explain-panel" class="panel explain-specs" aria-labelledby="explain-title" aria-busy="${!!e.loading}"><h2 id="explain-title">${icon('help')} این مشخصات یعنی چه؟</h2>${chips}<details class="own-question"${e.need&&!ready.includes(e.need)?' open':''}><summary>سؤال خودت را بپرس</summary><form id="explain-form" data-product="${esc(p.id)}"><label class="sr-only" for="explain-need">کاربرد تو</label><div class="search-input-row"><input id="explain-need" class="search-input" name="need" maxlength="160" required autocomplete="off" placeholder="${esc(usageExample(p))}" value="${esc(ready.includes(e.need)?'':e.need||'')}"><button class="btn btn-secondary" type="submit"${e.loading?' disabled':''}>بپرس</button></div></form></details>${result}</section>`;
}
async function askExplain(id,need){
  need=String(need||'').trim().slice(0,160);
  const update=()=>{const panel=$('#explain-panel'),p=product();if(panel&&p?.id===id)panel.outerHTML=explainPanel(p);};
  specExplain.set(id,{loading:true,need});update();
  try{specExplain.set(id,{need,data:await api('/api/explain-specs',{id,need})});}
  catch(error){specExplain.set(id,{need,error:error.message});}
  update();
}
actions['explain-need']=el=>askExplain(el.dataset.product,el.dataset.need);
document.addEventListener('submit',e=>{
  if(e.target.id!=='explain-form')return;
  e.preventDefault();askExplain(e.target.dataset.product,new FormData(e.target).get('need'));
});
const productWithExplain=views.product;
views.product=()=>{const html=productWithExplain(),p=product(),specs='<section class="panel"><h2>مشخصات ثبت‌شده</h2>';if(!p)return html;const panel=explainPanel(p);return panel&&html.includes(specs)?html.replace(specs,panel+specs):html;};

// Offline mode: a service worker keeps the app and already-seen data on this device; the bar says when that copy is shown.
function offlineBar(){
  let bar=document.getElementById('offline-bar');
  if(!bar){document.body.insertAdjacentHTML('beforeend','<div id="offline-bar" class="offline-bar" role="status" hidden></div>');bar=document.getElementById('offline-bar');}
  bar.innerHTML=`${icon('info')}<span>آفلاین هستی؛ لیست، مسیر و صفحه‌هایی که قبلاً باز کرده‌ای از نسخهٔ ذخیره‌شده نمایش داده می‌شوند و ممکن است قدیمی باشند.</span>`;
  bar.hidden=navigator.onLine;
}
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    offlineBar();
    navigator.serviceWorker.register('/sw.js').then(()=>navigator.serviceWorker.ready)
      .then(reg=>reg.active?.postMessage({precache:[...document.querySelectorAll('script[src],link[rel=stylesheet],link[rel=preload]')].map(e=>e.src||e.href)}))
      .catch(()=>{});
  });
  window.addEventListener('online',offlineBar);
  window.addEventListener('offline',offlineBar);
}
// Inquiries through Nazdika (a working mock: no SMS or call is sent). Buyers keep only random tokens in this browser.
const inquiryQuestions=[['stock','موجود است؟',true],['price','قیمت امروز چند است؟',true],['installment','اقساط حضوری دارید؟',false],['warranty','گارانتی دارد؟',false]];
let inquiryTargets=[], inquiryAnswers=new Map(), inquiryTimer=0;
async function postJson(path,body){
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok){const error=new Error(response.status===429?'درخواست‌ها زیاد شده؛ کمی بعد دوباره امتحان کن.':response.status===404?'این مورد دیگر پیدا نشد.':'ارسال انجام نشد؛ دوباره امتحان کن.');error.status=response.status;throw error;}
  return response.json();
}
function inquiryDialog(shops,item){
  inquiryTargets=shops.slice(0,5);const p=item||(product()&&shops.every(s=>storeList.some(x=>x.id===s.id))?product():null);
  showDialog(inquiryTargets.length>1?'استعلام از '+fa(inquiryTargets.length)+' فروشگاه':'استعلام از '+inquiryTargets[0].name,`<form id="inquiry-form" class="inquiry-form">${p?`<p class="inquiry-product">${icon('box')} ${esc(p.name)}</p>`:''}${inquiryTargets.length>1?`<p class="small muted">${inquiryTargets.map(s=>esc(s.name)).join('، ')}</p>`:''}<fieldset class="interview-group"><legend>چه چیزی را بپرسیم؟</legend>${inquiryQuestions.map(([id,label,on])=>`<label class="check-field"><input type="checkbox" name="questions" value="${id}" ${on?'checked':''}>${label}</label>`).join('')}</fieldset><label class="search-label" for="inquiry-note">توضیح کوتاه (اختیاری)</label><textarea id="inquiry-note" name="note" rows="2" maxlength="200" placeholder="مثلاً رنگ سفید یا سایز ۴۲"></textarea><input type="hidden" name="product_id" value="${p?esc(p.id):''}"><p class="field-error" id="inquiry-error" role="alert"></p><button class="btn btn-primary full" type="submit">${icon('send')} ارسال استعلام</button><p class="demo-note">${icon('info')}<span>نسخهٔ نمایشی: پیامکی ارسال نمی‌شود؛ جواب در «ذخیره‌شده‌ها» می‌آید.</span></p></form>`);
}
document.addEventListener('submit',async e=>{
  if(e.target.id!=='inquiry-form')return;
  e.preventDefault();
  const form=new FormData(e.target),button=e.target.querySelector('[type=submit]'),questions=form.getAll('questions'),note=String(form.get('note')||'').trim();
  if(!questions.length&&!note){$('#inquiry-error').textContent='حداقل یک سؤال انتخاب کن یا توضیح بنویس.';return;}
  button.disabled=true;
  try{
    const product_id=form.get('product_id')||undefined,sent=await postJson('/api/inquiries/new',{product_id,shop_ids:inquiryTargets.map(s=>s.id),questions,note});
    state.inquiries=[{token:sent.token,ids:sent.ids,created:new Date().toISOString()},...(state.inquiries||[])].slice(0,20);persist();
    closeDialog();toast('استعلام برای '+fa(sent.ids.length)+' فروشگاه فرستاده شد؛ جواب‌ها در «پیام‌ها» می‌آید.');refreshInquiries();
  }catch(error){$('#inquiry-error').textContent=error.message;button.disabled=false;}
});
async function refreshInquiries(){
  const tokens=(state.inquiries||[]).map(i=>i.token);if(!tokens.length)return;
  try{
    const data=await api('/api/inquiries',{tokens:tokens.join(',')}),seen=new Set(state.inquirySeen||[]);
    const fresh=data.items.filter(i=>i.answered_at&&!seen.has(i.id+i.answered_at));
    inquiryAnswers=new Map(data.items.map(i=>[i.id,i]));
    if(fresh.length){toast(fresh.length>1?fa(fresh.length)+' فروشگاه به استعلامت جواب دادند.':fresh[0].shop.name+' به استعلامت جواب داد.');state.inquirySeen=[...seen,...fresh.map(i=>i.id+i.answered_at)].slice(-200);persist();}
    if(route==='messages'&&!busy)render();else nav();
  }catch{}
}
function inquiriesPanel(){
  const items=[...inquiryAnswers.values()];if(!items.length)return '';
  const status=i=>!i.answered_at?badge('در انتظار پاسخ فروشنده','','clock'):i.available?badge('موجود است'+(i.price?' · '+money(i.price).replace(/<[^>]*>/g,''):''),'good','check'):badge('موجود نیست','warn','alert');
  return `<section id="my-inquiries" class="panel"><h2>${icon('chat')} استعلام‌های من</h2><ul class="inquiry-list">${items.map(i=>`<li><div class="od-field od-fill"><strong>${esc(i.shop.name)}</strong><span class="small muted">${i.product?esc(i.product.name)+' · ':''}${esc(i.questions.join(' '))}</span>${i.reply?`<p class="quote">${esc(i.reply)}</p>`:''}</div>${status(i)}</li>`).join('')}</ul><p class="helper">فقط برای تو نمایش داده می‌شود و قیمت عمومی نمی‌شود.</p></section>`;
}
const contactDialogBase=contactDialog;
contactDialog=function(s){
  contactDialogBase(s);
  const box=$('#dialog .contact-channels');
  if(box)box.insertAdjacentHTML('afterbegin',`<button class="contact-channel inquiry-channel" data-action="inquiry-open" data-id="${esc(s.id)}"><span class="tool-icon">${icon('send')}</span><span class="od-field od-fill"><strong>استعلام سریع از طریق سرراه</strong><small>با یک لمس بپرس موجود است و قیمت امروز چند است؛ جواب همین‌جا می‌آید</small></span>${badge('پیشنهادی','good')}</button>`);
};
actions['inquiry-open']=el=>{const s=contactShop?.id===el.dataset.id?contactShop:shopCache.get(el.dataset.id);if(s)inquiryDialog([s]);};
actions['inquiry-many']=()=>{const shops=filteredStores().slice(0,5);if(shops.length)inquiryDialog(shops);};
const storesWithInquiry=views.stores;
views.stores=()=>{const html=storesWithInquiry(),shops=filteredStores().slice(0,5),at=html.indexOf('<article class="store-card');return shops.length>1&&at>=0?html.slice(0,at)+`<div class="inquiry-many">${btn(icon('send')+' استعلام هم‌زمان از '+fa(shops.length)+' فروشگاه اول فهرست','inquiry-many','btn-secondary full')}</div>`+html.slice(at):html;};
// «پیام‌ها» tab (redesign): the buyer's inquiries and shop answers live on their own page, not under the saved list.
function unreadMessages(){const read=new Set(state.inquiryRead||[]);return [...inquiryAnswers.values()].filter(i=>i.answered_at&&!read.has(i.id+i.answered_at)).length;}
function messagesPage(){
  const panel=inquiriesPanel();
  return `<div class="page"><header class="list-head"><h1>پیام‌ها</h1></header><p class="muted">استعلام موجودی و قیمت از فروشگاه‌ها، بدون حساب کاربری</p>${noticesPanel()}${panel||(state.notices?.length?'':empty('هنوز پیامی نفرستادی','از صفحهٔ هر کالا یا فروشگاه بپرس موجود است یا نه؛ جوابش اینجا می‌آید.','home','رفتن به خانه','chat'))}</div>`;
}
views.messages=messagesPage;
const loadRouteWithMessages=loadRoute;
loadRoute=async function(){
  if(route!=='messages')return loadRouteWithMessages();
  await refreshInquiries();
  state.inquiryRead=[...inquiryAnswers.values()].filter(i=>i.answered_at).map(i=>i.id+i.answered_at).slice(-200);persist();
};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshInquiries();});
inquiryTimer=setInterval(()=>{if(!document.hidden)refreshInquiries();},60000);
setTimeout(refreshInquiries,1500);

// «فهرست من», as the round-1 redesign: the total of the lowest recorded prices, one route button,
// the saved items, compare and messages, and the shopper's own call reports (kept only on this device).
function listPage(){
  const items=state.saved.map(id=>productCache.get(id)).filter(Boolean);
  const total=items.reduce((sum,p)=>sum+(p.price||0),0);
  const statusName={confirmed:'موجود بود',out:'ناموجود بود','no-response':'پاسخ نداد',closed:'بسته بود',unverified:'تأیید نشده'};
  const reports=Object.entries(state.verifications||{}).slice(-5).reverse();
  const head=`<header class="list-head"><h1>فهرست من</h1>${items.length?btn(icon('send')+'لینک فهرست','share-saved','btn-secondary list-share'):''}</header>`;
  if(!items.length)return `<div class="page list-page">${head}${empty('فهرستت خالی است','روی نشان ذخیره در کارت یا صفحهٔ هر کالا بزن.','home','دیدن کالاها','bookmark')}</div>`;
  return `<div class="page list-page">${head}<section class="list-summary"><div class="list-summary-row"><span><small>جمع کمترین قیمت‌ها · ${fa(items.length)} کالا</small><strong>${fa(total)} <small>تومان</small></strong></span></div>${items.length>1?btn(icon('route')+'مسیر خرید یک‌روزه بساز','open-route','btn-light full'):''}</section><section class="panel list-items">${items.map(p=>`<div class="list-item"><span class="list-thumb">${image(p,'list-img')}</span><a class="list-copy" href="#product?id=${p.id}"><strong>${esc(p.name)}</strong><span>${p.price!=null?`<strong>${fa(p.price)}</strong> <small class="muted">· ${fa(p.stores||0)} فروشگاه</small>`:'<small class="muted">قیمت ثبت نشده</small>'}</span></a><button class="icon-square ghost" data-action="save-product" data-id="${p.id}" aria-label="حذف ${esc(p.name)} از فهرست">${icon('close')}</button></div>`).join('')}</section><div class="list-actions"><a class="btn btn-secondary" href="#messages">${icon('chat')}پیام‌ها</a><a class="btn btn-secondary" href="#compare">${icon('compare')}مقایسه‌ها (${fa(state.compare.length)})</a></div>${state.savedPlan?`<section class="panel"><h2>${esc(state.savedPlan.product.name)}</h2>${btn('دیدن برنامه ذخیره‌شده','open-plan','btn-secondary')}</section>`:''}${state.savedOutfitPlan?`<section class="panel"><h2>برنامه ست ذخیره‌شده</h2><p>${fa(state.savedOutfitPlan.items.length)} جزء</p>${btn('دیدن برنامه ست','open-outfit-plan','btn-secondary')}</section>`:''}${reports.length?`<section class="panel list-reports"><h2>گزارش تماس‌های من</h2><p class="helper">فقط روی همین گوشی ذخیره می‌شود و عمومی نمی‌شود.</p>${reports.map(([key,v])=>`<div class="other-row"><span>${esc(productCache.get(key.split(':')[0])?.name||'کالا')} <small class="muted">· ${esc(statusName[v.status]||v.status||'')}</small></span><strong>${v.price?fa(v.price):''}</strong></div>`).join('')}</section>`:''}</div>`;
}
views.saved=listPage;
// «کمکم کن»: every guided tool on one list.
function helpersPage(){
  const row=([h,i,t,d,tone])=>`<a class="helper-row" href="${h}"><span class="help-icon ${tone}">${icon(i)}</span><span><strong>${t}</strong><small>${d}</small></span>${icon('chevron')}</a>`;
  const group=(title,rows)=>`<h2 class="helper-group">${title}</h2><section class="panel helper-list">${rows.map(row).join('')}</section>`;
  return `<div class="page">${heading('کمکم کن')}${group('برای یک موقعیت',[['#outfits','outfit','ست لباس بچین','مهمانی، کار، دانشگاه؛ از سر تا کفش، با یک بودجه','tone-blue'],['#dowry','box','برنامه جهیزیه','بودجهٔ کل را بین اقلام تقسیم می‌کند','tone-orange'],['#gift','heart','هدیه پیدا کن','برای کی، به چی علاقه دارد و چقدر','tone-green'],['#assistant','sparkle','از دستیار بپرس','نیازت را با زبان خودت بنویس','tone-blue']])}${group('با عکس',[['#photo','camera','این کالا را پیدا کن','از یک کالا عکس بگیر؛ مدل و فروشندهٔ نزدیک را می‌آوریم','tone-gray'],['#category?g=appliances','palette','رنگش با خانه‌ام می‌خونه؟','برای لوازم خانگی؛ در صفحهٔ کالا عکس اتاق را بده','tone-gray']])}${group('برای خرید حضوری',[['#locate','pin','من این‌جام','روی نقشه بگو کجایی؛ فروشگاه‌های نزدیک را خبر می‌دهیم','tone-green'],['#route','map','مسیر خرید یک‌روزه','چند کالا با کمترین مغازه و کوتاه‌ترین مسیر','tone-gray'],['#markets','pin','بورس‌های کالا در تهران','کجا برای چه چیزی برویم','tone-gray'],['#prices','tag','قیمت‌ها چقدر تازه‌اند؟','وضعیت به‌روزرسانی قیمت‌ها','tone-gray']])}</div>`;
}
views.helpers=helpersPage;

// «من این‌جام»: a virtual location. The buyer taps a point on a Tehran map (OpenStreetMap tiles, no map library);
// shops within walking distance that carry items from «فهرست من» (else the best-stocked nearby) become in-app notices
// in «پیام‌ها», and the first one shows as a toast. The point stays in this browser; requests only carry its lat/lon.
const MAP={z:12,w:51.2,e:51.62,n:35.83,s:35.56};
const tileX=lon=>(lon+180)/360*2**MAP.z, tileY=lat=>{const r=lat*Math.PI/180;return (1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*2**MAP.z;};
const MAPBOX={x0:Math.floor(tileX(MAP.w)),x1:Math.floor(tileX(MAP.e)),y0:Math.floor(tileY(MAP.n)),y1:Math.floor(tileY(MAP.s))};
MAPBOX.cols=MAPBOX.x1-MAPBOX.x0+1;MAPBOX.rows=MAPBOX.y1-MAPBOX.y0+1;
const mapSpot=(lat,lon)=>[(tileX(lon)-MAPBOX.x0)/MAPBOX.cols*100,(tileY(lat)-MAPBOX.y0)/MAPBOX.rows*100];
function spotAt(fx,fy){const x=MAPBOX.x0+fx*MAPBOX.cols,y=MAPBOX.y0+fy*MAPBOX.rows,n=Math.PI-2*Math.PI*y/2**MAP.z;return {lat:+(180/Math.PI*Math.atan(Math.sinh(n))).toFixed(4),lon:+(x/2**MAP.z*360-180).toFixed(4)};}
const walkLabel=km=>km<1?fa(Math.max(50,Math.round(km*20)*50))+' متر':fa(km)+' کیلومتر';
function noticeOf(s){
  const c=(s.carries||[]).map(x=>({...x,name:String(x.name).split('|')[0].trim()})),where=`«${s.name}» ${walkLabel(s.distance_km)} از توست`;
  return {shop:s.id,product:c[0]?.id||'',text:c.length?`${where} و ${c[0].name}${c.length>1?` و ${fa(c.length-1)} کالای دیگر`:''} از فهرستت را دارد؛ ${fa(c[0].price)} تومان ثبت شده.`:`${where}${s.open?' و الان باز است':''}؛ می‌توانی سر بزنی و بررسی کنی.`};
}
function noticesPanel(){
  const items=state.notices||[];
  if(!items.length)return '';
  return `<section class="panel notices" aria-labelledby="notices-title"><h2 id="notices-title">${icon('bell')} نزدیک تو</h2>${items.map(n=>`<a class="notice-row" href="#store?shop=${esc(n.shop)}${n.product?'&id='+esc(n.product):''}">${icon('store')}<span>${esc(n.text)}</span></a>`).join('')}<p class="helper">بر اساس نقطه‌ای که روی نقشه انتخاب کردی؛ فاصله‌ها خط مستقیم و قیمت‌ها ثبت‌شده‌اند. <a href="#locate">تغییر نقطه</a></p></section>`;
}
let nearbyBusy=false;
function locatePage(){
  const spot=state.virtualSpot,shops=state.nearbyShops||[],tiles=[];
  for(let y=MAPBOX.y0;y<=MAPBOX.y1;y++)for(let x=MAPBOX.x0;x<=MAPBOX.x1;x++)tiles.push(`<img src="https://tile.openstreetmap.org/${MAP.z}/${x}/${y}.png" alt="" draggable="false" referrerpolicy="origin" style="left:${(x-MAPBOX.x0)/MAPBOX.cols*100}%;top:${(y-MAPBOX.y0)/MAPBOX.rows*100}%;width:${100/MAPBOX.cols}%;height:${100/MAPBOX.rows}%">`);
  const pin=(lat,lon,cls,label)=>{const [l,t]=mapSpot(lat,lon);return `<span class="${cls}" style="left:${l}%;top:${t}%" title="${esc(label)}"></span>`;};
  return `<div class="page locate-page">${heading('من این‌جام','روی نقشه بزن کجایی؛ فروشگاه‌های نزدیکِ همان نقطه را خبر می‌دهیم.')}<div class="locate-scroll"><div class="locate-map" id="locate-map" style="aspect-ratio:${MAPBOX.cols}/${MAPBOX.rows}" aria-label="نقشهٔ تهران؛ برای انتخاب نقطه بزن">${tiles.join('')}${shops.map(s=>pin(s.lat,s.lon,'map-shop',s.name)).join('')}${spot?pin(spot.lat,spot.lon,'map-me','این‌جایی'):pin(35.7,51.39,'map-center','')}</div></div><p class="map-credit">نقشه © مشارکت‌کنندگان OpenStreetMap · بدون نقشه؟ از دکمهٔ محدوده یک محله انتخاب کن.</p>${nearbyBusy?`<p role="status">${icon('spinner')} در حال پیدا کردن فروشگاه‌های نزدیک…</p>`:''}${noticesPanel()}${spot?btn('پاک کردن این نقطه','clear-spot','btn-secondary full'):''}</div>`;
}
views.locate=()=>{setTimeout(()=>$('.map-me,.map-center')?.scrollIntoView({block:'nearest',inline:'center'}),0);return locatePage();};
async function setSpot(spot,quiet){
  state.virtualSpot=spot;state.neighborhood='';
  origin={lat:spot.lat,lon:spot.lon,label:'نقطهٔ انتخابی',precise:true};
  nearbyBusy=true;persist();if(route==='locate')render();
  try{
    const d=await api('/api/nearby',{lat:spot.lat,lon:spot.lon,ids:state.saved.slice(0,20).join(',')});
    state.nearbyShops=d.items.map(s=>({id:s.id,name:s.name,lat:s.lat,lon:s.lon}));
    const fresh=d.items.map(s=>noticeOf({...s,open:s.opening?.open}));
    if(!quiet||fresh[0]?.text!==state.notices?.[0]?.text){state.notices=fresh;state.noticesUnread=fresh.length;if(fresh[0])toast(fresh[0].text);else toast('در فاصلهٔ پیاده‌روی این نقطه فروشگاهی ثبت نشده.');}
  }catch{if(!quiet)toast('فروشگاه‌های نزدیک دریافت نشد؛ دوباره امتحان کن.');}
  finally{nearbyBusy=false;persist();route==='locate'||route==='messages'?render():nav();}
}
document.addEventListener('click',e=>{
  const m=e.target.closest('#locate-map');if(!m||nearbyBusy)return;
  const r=m.getBoundingClientRect();setSpot(spotAt((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height));
});
actions.locate=()=>{closeDialog();return go('locate');};
actions['clear-spot']=()=>{state.virtualSpot=null;state.nearbyShops=[];state.notices=[];state.noticesUnread=0;origin=null;persist();render();nav();};
for(const name of ['set-location','geolocate']){const own=actions[name];actions[name]=(...a)=>{state.virtualSpot=null;state.nearbyShops=[];return own(...a);};}
const unreadInquiries=unreadMessages;
unreadMessages=()=>unreadInquiries()+(state.noticesUnread||0);
const loadRouteWithNotices=loadRoute;
loadRoute=async function(){await loadRouteWithNotices();if(route==='messages'&&state.noticesUnread){state.noticesUnread=0;persist();nav();}};
if(state.virtualSpot){origin={lat:state.virtualSpot.lat,lon:state.virtualSpot.lon,label:'نقطهٔ انتخابی',precise:true};setTimeout(()=>setSpot(state.virtualSpot,true),2500);}

// «همین الان»: a minimal chat. Each question becomes one decision for here and now (or a demo time): who is open,
// who is nearer but closed and when it opens, whose hours are unknown, and the nearby area where shops of this kind
// cluster. One map (OpenStreetMap tiles around the shopper) shows them all; a pin jumps to its card.
const askShops=new Map();
const askTimes=[['','الان'],['21:30|','امشب، ۹:۳۰'],['23:30|','آخر شب، ۱۱:۳۰'],['08:30|','صبح زود، ۸:۳۰'],['10:00|fri','جمعه صبح']];
const askModes=[['now','pin','همین الان، نزدیکم'],['model','sparkle','کدام مدل بخرم؟'],['price','tag','ارزان‌ترین قیمت']];
const askIdeas={now:['شارژر موبایل','لامپ ال‌ای‌دی','کابل HDMI'],model:['گوشی برای عکاسی در شب','لپ‌تاپ سبک برای دانشگاه'],price:['ایرپاد پرو ۲','اتو بخار فیلیپس']};
const tx=(lon,z)=>(lon+180)/360*2**z, ty=(lat,z)=>{const r=lat*Math.PI/180;return (1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*2**z;};
function nowMap(d){
  const me=origin,shops=[...d.open.slice(0,2).map(s=>[s,'open']),...d.closed.slice(0,2).map(s=>[s,'closed']),...d.unknown.slice(0,1).map(s=>[s,'unknown'])];
  // Zoom to the main options (first open shop, nearer closed ones, the area); farther pins sit on the edge, marked off-map.
  const far=Math.max(0.6,d.open[0]?.distance_km||0,...d.closed.slice(0,2).map(s=>s.distance_km||0),d.hub?.distance_km||0);
  const z=far<=1.2?15:far<=2.6?14:far<=5.5?13:12,x0=Math.floor(tx(me.lon,z))-1,y0=Math.floor(ty(me.lat,z))-1,tiles=[];
  for(let y=y0;y<y0+3;y++)for(let x=x0;x<x0+3;x++)tiles.push(`<img src="https://tile.openstreetmap.org/${z}/${x}/${y}.png" alt="" draggable="false" referrerpolicy="origin" style="left:${(x-x0)/3*100}%;top:${(y-y0)/3*100}%">`);
  const at=(lat,lon)=>{const l=(tx(lon,z)-x0)/3*100,t=(ty(lat,z)-y0)/3*100;return {l:Math.min(97,Math.max(3,l)),t:Math.min(97,Math.max(3,t)),off:l<0||l>100||t<0||t>100};};
  const pin=(s,type)=>{const p=at(s.lat,s.lon);return `<button type="button" class="pin pin-${type}${p.off?' off':''}" style="left:${p.l}%;top:${p.t}%" data-action="ask-pin" data-id="${s.id}" aria-label="${esc(s.name)}"></button>`;};
  let hub='';
  if(d.hub){const p=at(d.hub.lat,d.hub.lon),size=1.2*2**z/(40075*Math.cos(me.lat*Math.PI/180))/3*100;hub=`<span class="pin-hub" style="left:${p.l}%;top:${p.t}%;width:${size}%"><b>${esc(d.hub.name)}</b></span>`;}
  const m=at(me.lat,me.lon);
  return `<div class="now-map" aria-label="نقشهٔ فروشگاه‌ها نسبت به تو">${tiles.join('')}${hub}${shops.map(([s,t])=>pin(s,t)).join('')}<span class="pin pin-me" style="left:${m.l}%;top:${m.t}%" title="تو"></span></div><p class="map-credit">© OpenStreetMap · سبز باز، خاکستری بسته، زرد ساعت نامشخص</p>`;
}
// One compact row per shop: status dot, name, distance and hours, the recorded price, and two icon buttons.
const priceShort=v=>v>=1e6?fa(Math.round(v/1e5)/10)+' میلیون':fa(Math.round(v/1e3))+' هزار';
function nowCard(s,type){
  askShops.set(s.id,s);
  const until=(s.hours_label||'').match(/\d\d:\d\d/)?.[0];
  const status=type==='open'?`باز${until?' تا '+until:''}`:type==='closed'?(s.next_open?`${s.next_open} باز می‌شود`:'بسته'):'ساعت نامعلوم';
  const o=s.offer,item=o?String(o.product.name).split('|')[0].trim():'';
  return `<article class="now-row now-${type}" id="now-${s.id}"><span class="now-dot" aria-hidden="true"></span><span class="now-main"><strong>${esc(s.name)}</strong><small>${s.distance_km!=null?walkLabel(s.distance_km)+' · ':''}${esc(localNumbers(status))}${s.metro?' · مترو '+esc(s.metro.name):''}</small>${item?`<small class="now-item">${esc(item)}</small>`:''}</span><span class="now-price">${o?`<b>${priceShort(o.price)}</b><small>تومان</small>`:'<small>قیمت ثبت نشده</small>'}</span><span class="now-icons"><button type="button" class="icon-square" data-action="now-route" data-id="${s.id}" aria-label="مسیر تا ${esc(s.name)}">${icon('route')}</button><button type="button" class="icon-square" data-action="now-ask" data-id="${s.id}" aria-label="${type==='open'?'موجود است؟':'باز است؟'} از ${esc(s.name)} بپرس">${icon('chat')}</button></span></article>`;
}
function nowAnswer(d){
  if(d.kind==='unknown_item')return '<p>نفهمیدم دنبال چه کالایی هستی؛ اسمش را ساده‌تر بنویس، مثلاً «شارژر موبایل».</p>';
  const thing=d.categories[0]||d.query,first=d.open[0],soon=d.soonest||d.closed[0],hub=d.hub,lines=[];
  if(d.kind==='open_near')lines.push(`«${first.name}» ${walkLabel(first.distance_km)} از توست و الان باز است.`);
  else if(d.kind==='open_far')lines.push(`نزدیک‌ترین فروشگاهِ بازی که ${thing} دارد «${first.name}» است، ${walkLabel(first.distance_km)} از تو.`);
  else lines.push(`این ساعت هیچ فروشگاهِ ثبت‌شده‌ای در نزدیکی‌ات که ${thing} دارد باز نیست.`);
  if(d.kind!=='open_near'&&soon)lines.push(`${d.kind==='open_far'?'نزدیک‌ترها بسته‌اند؛ ':''}«${soon.name}» (${walkLabel(soon.distance_km)}) ${soon.next_open||'بعداً'} باز می‌شود.`);
  if(hub&&d.kind!=='open_near')lines.push(`ولی تو ${walkLabel(hub.distance_km)} با محدودهٔ ${hub.name} فاصله داری که ${fa(hub.shops)} فروشگاه مرتبط آن‌جا ثبت شده${hub.unknown?` و ساعت کار ${fa(hub.unknown)} تا معلوم نیست`:''}؛ شاید مغازه‌ای، حتی بیرون از ترب، هنوز باز باشد.`);
  const group=(title,list,type)=>list.length?`<section class="now-group"><h3>${title}</h3>${list.map(x=>nowCard(x,type)).join('')}</section>`:'';
  const cards=group('باز',d.open.slice(0,3),'open')+(d.kind==='open_near'?'':group('نزدیک‌تر ولی بسته',d.closed.slice(0,3),'closed'))+group('ساعت نامعلوم؛ اول بپرس',d.unknown.slice(0,2),'unknown');
  const hubCard=hub&&d.kind!=='open_near'?`<section class="now-group"><h3>شانس بیرون از ترب</h3><article class="now-row now-hub"><span class="now-dot" aria-hidden="true"></span><span class="now-main"><strong>محدودهٔ ${esc(hub.name)}</strong><small>${walkLabel(hub.distance_km)} · ${fa(hub.shops)} فروشگاه مرتبط · ${fa(hub.unknown)} ساعت نامعلوم</small></span><span class="now-icons"><button type="button" class="icon-square" data-action="now-hub" data-lat="${hub.lat}" data-lon="${hub.lon}" data-name="${esc(hub.name)}" aria-label="مسیر تا محدودهٔ ${esc(hub.name)}">${icon('route')}</button></span></article></section>`:'';
  // The decision in one bold sentence; the reasons as short lines under it.
  return `<p class="now-decision">${esc(localNumbers(lines[0]))}</p>${lines.length>1?`<ul class="now-notes">${lines.slice(1).map(l=>`<li>${esc(localNumbers(l))}</li>`).join('')}</ul>`:''}${nowMap(d)}<div class="now-cards">${cards}${hubCard}</div>`;
}
// Conversations. Each question from the main box starts a thread, kept in this browser (the last 8, up to 8 turns
// each; only questions are stored, answers are fetched again when needed). The assistant's main page is always the
// question box with earlier threads as cards below it; a card opens its thread (#ask?t=id), which can be closed and
// takes follow-ups. All three intents answer inside the thread: «همین الان» from /api/now, «کدام مدل» from the AI
// assistant (with the thread's earlier model turns as history), «ارزان‌ترین قیمت» from the cheapest listings.
const askData=new Map();
const askThreads=()=>state.askThreads||(state.askThreads=[]);
const openThread=()=>askThreads().find(t=>t.id===state.askOpen)||null;
const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const modeName=id=>(askModes.find(m=>m[0]===id)||askModes[0])[2];
function prodRow(p,why){
  return `<a class="now-row prod-row" href="#product?id=${esc(p.id)}"><span class="prod-thumb">${image(p)}</span><span class="now-main"><strong>${esc(p.name)}</strong>${why?`<small class="prod-why">${esc(why)}</small>`:''}<small>${fa(p.stores||0)} فروشگاه</small></span>${p.price?`<span class="now-price"><b>${priceShort(p.price)}</b><small>تومان</small></span>`:''}</a>`;
}
const askNext=(q,skip)=>`<div class="ask-next">${askModes.filter(([id])=>id!==skip).map(([id,i,t])=>`<button type="button" class="chip" data-action="ask-switch" data-mode="${id}" data-query="${esc(q)}">${icon(i)}${t}</button>`).join('')}</div>`;
function modelAnswer(d,q){
  if(d.off_topic)return `<p class="now-decision">${esc(d.summary||'این دستیار فقط برای پیدا کردن کالا و فروشگاه است.')}</p>`;
  const byId=new Map((d.items||[]).map(p=>[p.id,p])),picks=(d.picks||[]).map(x=>({product:byId.get(x.id),why:x.why})).filter(x=>x.product).slice(0,4),rest=picks.length?[]:(d.items||[]).slice(0,5);
  return `<p class="now-decision">${esc(d.summary||(picks.length||rest.length?'این‌ها به کارت می‌آیند:':'چیزی پیدا نکردم؛ ساده‌تر بنویس چه می‌خواهی.'))}</p>${picks.length||rest.length?`<section class="now-group"><h3>${picks.length?'پیشنهاد دستیار':'کالاهای مرتبط'}</h3>${picks.map(x=>prodRow(x.product,x.why)).join('')}${rest.map(p=>prodRow(p)).join('')}</section>`:''}${(d.follow_up||[]).length?`<div class="ask-next">${d.follow_up.map(f=>`<button type="button" class="chip" data-action="ask-follow" data-query="${esc(f)}">${esc(f)}</button>`).join('')}</div>`:''}${askNext(q,'model')}`;
}
function priceAnswer(d,q){
  const items=d.items||[],fixed=d.parsed?.corrected;
  return `<p class="now-decision">${items.length?`ارزان‌ترین‌ها برای «${esc(fixed||q)}»${fixed?` <small>(به‌جای «${esc(q)}»)</small>`:''}`:'برای این، قیمتی ثبت نشده.'}</p>${items.length?`<section class="now-group"><h3>از ${fa(d.total)} کالا، ارزان‌ترین‌ها</h3>${items.map(p=>prodRow(p)).join('')}</section><p class="now-more"><a href="#recommendations" data-action="now-all" data-q="${esc(q)}">همهٔ نتیجه‌ها و فیلترها</a></p>`:''}${askNext(q,'price')}`;
}
function turnAnswer(t){
  const d=askData.get(t.id);
  if(!d||d.loading)return `<p class="ask-wait" role="status">${icon('spinner')} ${t.mode==='now'?'دارم فروشگاه‌های اطرافت را می‌گردم…':t.mode==='model'?'دارم مدل‌ها را مقایسه می‌کنم…':'دارم قیمت‌ها را می‌گردم…'}</p>`;
  if(d.needSpot)return `<p>اول بگو کجایی تا نزدیک‌ترها را پیدا کنم.</p>${btn(icon('map')+'انتخاب روی نقشه','ask-locate','btn-primary')}`;
  if(d.error)return `<p class="field-error">${esc(d.error)}</p>`;
  return t.mode==='model'?modelAnswer(d.data,t.q):t.mode==='price'?priceAnswer(d.data,t.q):nowAnswer(d.data)+askNext(t.q,'now');
}
function askBox(placeholder){
  const mode=state.askMode||'now',w=state.askWhen||'';
  const modes=`<div class="ask-modes" role="radiogroup" aria-label="چه کمکی؟">${askModes.map(([id,i,t])=>`<button type="button" role="radio" class="ask-mode${mode===id?' on':''}" aria-checked="${mode===id}" data-action="ask-mode" data-mode="${id}">${icon(i)}<span>${t}</span></button>`).join('')}</div>`;
  const context=mode==='now'?`<div class="ask-context"><button type="button" class="ask-place" data-action="ask-locate">${icon('pin')}<span>${origin?esc(origin.label||'موقعیت تو'):'کجایی؟ انتخاب روی نقشه'}</span></button><label class="ask-time">${icon('clock')}<span class="sr-only">زمان</span><select id="ask-time">${askTimes.map(([v,t])=>`<option value="${v}"${w===v?' selected':''}>${t}</option>`).join('')}</select></label></div>`:'';
  return `<form id="ask-form" class="ask-box" role="search"><div class="ask-input"><label class="sr-only" for="ask-q">${placeholder}</label><input id="ask-q" name="q" maxlength="120" autocomplete="off" enterkeyhint="send" data-typing placeholder="${placeholder}"><button class="ask-send" type="submit" aria-label="بفرست">${icon('arrow')}</button></div>${modes}${context}</form>`;
}
function askPage(){
  const t=openThread();
  if(t)return `<div class="page ask-page ask-open"><header class="ask-bar"><strong>${esc(t.turns[0].q)}</strong>${btn(icon('close'),'ask-close','icon-square','aria-label="بستن گفت‌وگو و برگشت به دستیار"')}</header><div class="ask-thread">${t.turns.map(x=>`<div class="ask-turn"><p class="ask-q"><span class="ask-q-mode">${esc(modeName(x.mode))}</span>${esc(x.q)}</p><div class="ask-a" aria-live="polite"><span class="ask-avatar" aria-hidden="true"></span><div class="ask-body">${turnAnswer(x)}</div></div></div>`).join('')}</div>${askBox('ادامه بده یا سؤال بعدی…')}</div>`;
  const threads=askThreads();
  const cards=threads.length?`<section class="ask-history" aria-labelledby="ask-history-title"><h2 id="ask-history-title">گفت‌وگوهای قبلی</h2>${threads.map(x=>`<article class="ask-card"><a href="#ask?t=${x.id}" class="ask-card-link"><span class="ask-card-mode">${icon((askModes.find(m=>m[0]===x.turns.at(-1).mode)||askModes[0])[1])}</span><span class="now-main"><strong>${esc(x.turns[0].q)}</strong><small>${x.turns.length>1?fa(x.turns.length)+' سؤال · آخری: '+esc(x.turns.at(-1).q):esc(modeName(x.turns[0].mode))}</small></span>${icon('chevron')}</a><button type="button" class="ask-card-del" data-action="ask-delete" data-id="${x.id}" aria-label="حذف این گفت‌وگو">${icon('close')}</button></article>`).join('')}</section>`:`<div class="ask-ideas">${(askIdeas[state.askMode||'now']||[]).map(q=>`<button class="ask-idea" data-action="ask-suggest" data-query="${esc(q)}">${esc(q)}${icon('arrow')}</button>`).join('')}</div>`;
  return `<div class="page ask-page ask-start"><div class="ask-hero"><span class="ask-avatar big" aria-hidden="true"></span><h1>سلام! چی لازم داری؟</h1><p>بگو چی می‌خوای؛ می‌گم کجای نزدیکت هست، کی بازه و چقدره.</p></div>${askBox('چی لازم داری؟')}${cards}</div>`;
}
views.ask=askPage;
async function runTurn(thread,turn){
  const keep=d=>{askData.set(turn.id,d);if(route==='ask'&&state.askOpen===thread.id)render();};
  if(turn.mode==='now'&&!origin)return keep({needSpot:true});
  keep({loading:true});
  try{
    let data;
    if(turn.mode==='now'){const [at,day]=String(turn.when||'').split('|');data=await api('/api/now',{q:turn.q,lat:origin.lat,lon:origin.lon,at,day});}
    else if(turn.mode==='model'){
      const earlier=thread.turns.slice(0,thread.turns.indexOf(turn)).filter(x=>x.mode==='model').slice(-3).map(x=>({q:x.q,shown:(askData.get(x.id)?.data?.items||[]).slice(0,3).map(p=>p.name)}));
      data=await api('/api/assistant',{q:turn.q,history:earlier.length?JSON.stringify(earlier):''});cacheProducts(data.items||[]);
    }else{data=await api('/api/products',{q:turn.q,sort:'price',limit:6});cacheProducts(data.items);}
    keep({data});
  }catch(error){keep({error:error.status===429?'چند لحظه صبر کن و دوباره بپرس.':error.status===400?'این را نفهمیدم؛ ساده‌تر بنویس.':error.message});}
  if(route==='ask')$('.ask-turn:last-child')?.scrollIntoView({block:'start'});
}
// A question from the main box starts a thread; inside an open thread it is a follow-up.
function askNow(q,mode){
  q=String(q||'').trim();if(!q)return;
  mode=mode||state.askMode||'now';
  const turn={id:newId(),q,mode,when:state.askWhen||''};
  let thread=route==='ask'?openThread():null;
  if(thread)thread.turns=[...thread.turns,turn].slice(-8);
  else{thread={id:newId(),turns:[turn]};state.askThreads=[thread,...askThreads()].slice(0,8);}
  state.askOpen=thread.id;state.query=q;persist();
  return go('ask?t='+thread.id).then(()=>runTurn(thread,turn));
}
const readTargetWithAsk=readTarget;
readTarget=function(target){const name=readTargetWithAsk(target);if(name==='ask')state.askOpen=new URLSearchParams(String(target).split('?')[1]||'').get('t')||'';return name;};
if(route==='ask')state.askOpen=new URLSearchParams(location.hash.split('?')[1]||'').get('t')||'';
// Opening a thread after a reload fetches its answers again (questions only are stored).
const loadRouteWithAsk=loadRoute;
loadRoute=async function(){await loadRouteWithAsk();const t=route==='ask'&&openThread();if(t)for(const x of t.turns)if(!askData.has(x.id))runTurn(t,x);};
document.addEventListener('submit',e=>{if(e.target.id!=='ask-form')return;e.preventDefault();askNow(new FormData(e.target).get('q'));});
document.addEventListener('change',e=>{
  if(e.target.id!=='ask-time')return;state.askWhen=e.target.value;persist();
  const t=openThread(),last=t?.turns.findLast(x=>x.mode==='now');
  if(last){last.when=state.askWhen;persist();runTurn(t,last);}
});
actions['ask-suggest']=el=>askNow(el.dataset.query);
actions['ask-follow']=el=>askNow(el.dataset.query,'model');
actions['ask-switch']=el=>askNow(el.dataset.query,el.dataset.mode);
actions['ask-mode']=el=>{state.askMode=el.dataset.mode;persist();render();$('#ask-q')?.focus();};
actions['ask-close']=()=>{state.askOpen='';return go('ask');};
actions['ask-delete']=el=>{state.askThreads=askThreads().filter(t=>t.id!==el.dataset.id);persist();render();};
actions['ask-locate']=()=>{state.askReturn=true;return go('locate');};
actions['ask-pin']=el=>{const row=$('#now-'+el.dataset.id);if(!row)return;row.scrollIntoView({block:'nearest',behavior:'smooth'});row.classList.remove('flash');void row.offsetWidth;row.classList.add('flash');};
actions['now-route']=el=>{const s=askShops.get(el.dataset.id);if(s)directions(s);};
actions['now-ask']=el=>{const s=askShops.get(el.dataset.id);if(s)inquiryDialog([s],s.offer?.product||null);};
actions['now-hub']=el=>directions({name:'محدودهٔ '+el.dataset.name,address:'مرکز تقریبی محدوده',lat:el.dataset.lat,lon:el.dataset.lon});
actions['now-all']=el=>startSearch(el.dataset.q,'recommendations');
// After picking a point, go back to the open thread and answer the questions that were waiting for it.
const setSpotForAsk=setSpot;
setSpot=async function(spot,quiet){
  await setSpotForAsk(spot,quiet);
  if(!state.askReturn||quiet)return;
  state.askReturn=false;const t=openThread();
  await go(t?'ask?t='+t.id:'ask');
  if(t)for(const x of t.turns)if(askData.get(x.id)?.needSpot)runTurn(t,x);
};

// Search boxes marked data-typing show example requests typing in, pausing, then erasing. One timer for every such box;
// a box that is focused or filled keeps still, and nothing moves under prefers-reduced-motion.
const typingExamples=['شارژر موبایل، همین الان','لامپ ال‌ای‌دی نزدیکم','کابل HDMI تا آخر شب','باتری قلمی برای ریموت','هندزفری بلوتوث ارزان'];
const typing={i:0,n:0,dir:1,wait:0};
setInterval(()=>{
  const boxes=[...document.querySelectorAll('input[data-typing]')].filter(el=>el!==document.activeElement&&!el.value);
  if(!boxes.length||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  if(typing.wait>0){typing.wait--;return;}
  const text=typingExamples[typing.i];
  typing.n=Math.max(0,Math.min(text.length,typing.n+(typing.dir>0?1:-2)));
  if(typing.n===text.length&&typing.dir>0){typing.dir=-1;typing.wait=24;}
  else if(typing.n===0&&typing.dir<0){typing.dir=1;typing.i=(typing.i+1)%typingExamples.length;typing.wait=5;}
  for(const el of boxes)el.placeholder=text.slice(0,typing.n)+'|';
},75);
