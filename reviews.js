'use strict';
// Automatic discovery stays independent of catalog/price rendering and never blocks it.
const videoReviewResults=new Map();
function videoReviewProducts(){
  let items=[];
  if(['product','stores'].includes(route))items=product()?[product()]:[];
  if(route==='compare'){items=state.compare.map(id=>productCache.get(id)).filter(Boolean);if(items.length<2)return [];}
  if(route==='assistant'&&assistantData?.understood?.intent==='compare')items=(assistantData.picks||[]).map(p=>productCache.get(p.id)).filter(Boolean);
  return items.length&&items.length<=3&&new Set(items.map(p=>p.category)).size===1&&items.every(p=>['mobile','digital','beauty'].includes(p.group))?items:[];
}
function videoReviewKey(){return videoReviewProducts().map(p=>p.id).sort().join(',');}
function videoURL(url,search=false){return typeof url==='string'&&(search?/^https:\/\/www\.youtube\.com\/results\?search_query=[^\s]*$/:/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}(?:&t=\d+s)?$/).test(url)?url:'';}
function reviewLink(url,label,search=false,cls=''){const safe=videoURL(url,search);return safe?`<a class="${cls}" href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>`:'';}
function reviewTimestamp(seconds){const n=Math.max(0,Math.floor(Number(seconds)||0));return fa(Math.floor(n/60))+':'+fa(n%60).padStart(2,'۰');}
// Verdict first: it is what a buyer reads when skimming; unknown kinds fall back to "caution".
const reviewKinds=[['verdict','جمع‌بندی بررسی‌کننده','award'],['strength','نقاط قوت','checkCircle'],['weakness','نقاط ضعف','xCircle'],['caution','پیش از خرید بدان','alert'],['comparison','در مقایسه','compare']];
function reviewKind(p){return reviewKinds.some(k=>k[0]===p.kind)?p.kind:'caution';}
function reviewPoint(p,sources,products){
  const source=sources.find(s=>s.id===p.source_id);if(!source)return '';
  const item=products.length>1?products.find(x=>x.id===p.product_id):null;
  const tags=(p.topic?`<span class="review-topic">${esc(p.topic)}</span>`:'')+(item?`<span class="review-product">${esc(item.name)}</span>`:'');
  return `<li class="review-point">${tags?`<p class="review-tags">${tags}</p>`:''}<p>${esc(p.text)}</p>${reviewLink(p.url,`${icon('camera')}<bdi>${esc(source.channel)}</bdi><bdi>${esc(reviewTimestamp(p.start))}</bdi>`,false,'review-citation')}</li>`;
}
function reviewGroups(points,sources,products){
  return reviewKinds.map(([kind,title,symbol])=>{const items=points.filter(p=>reviewKind(p)===kind).map(p=>reviewPoint(p,sources,products)).join('');return items?`<section class="review-group kind-${kind}"><h3>${icon(symbol)}${title}</h3><ul class="review-points">${items}</ul></section>`:'';}).join('');
}
function reviewSourceMeta(s){
  const date=s.published_at&&Number.isFinite(Date.parse(s.published_at))?new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium'}).format(new Date(s.published_at)):s.published_label||'';
  return [`<bdi>${esc(s.channel)}</bdi>`,Number(s.duration)>0?fa(Math.max(1,Math.round(s.duration/60)))+' دقیقه':'',esc(date)].filter(Boolean).join(' · ');
}
function videoReviewSection(){
  const products=videoReviewProducts(), key=videoReviewKey();
  if(!key)return '';
  const entry=videoReviewResults.get(key), d=entry?.data||{}, sources=d.sources||[], points=d.status==='summarized'?(d.points||[]):[];
  const loading=!entry||entry.loading;
  const messages={
    not_configured:'جست‌وجوی خودکار ویدئو هنوز فعال نیست؛ می‌توانی بررسی این مدل را در یوتیوب جست‌وجو کنی.',
    budget_limited:'دریافت بررسی تازه برای حفظ سهمیه فعلاً متوقف است؛ می‌توانی از لینک جست‌وجوی یوتیوب استفاده کنی.',
    empty:'بررسی مرتبطی با همین مدل پیدا نشد؛ نتیجهٔ مدل مشابه را جای آن نمایش نمی‌دهیم.',
    unavailable:'سرویس جست‌وجوی ویدئو فعلاً در دسترس نیست. مشخصات و فروشگاه‌ها همچنان قابل استفاده‌اند.',
    links_only:d.reason==='summary_paused'?'ویدئوی بررسی پیدا شد؛ خلاصه‌سازی فعلاً غیرفعال است و خود ویدئو قابل مشاهده است.':d.reason==='budget_limit'?'برای حفظ سهمیه، دریافت متن تازه متوقف است؛ ویدئوهای پیدا‌شده را می‌توانی ببینی.':d.reason==='no_transcript'?'ویدئوی بررسی پیدا شد، اما متن قابل استفاده در دسترس نبود؛ خود ویدئو را ببین.':d.reason==='insufficient_evidence'?'متن برای یک جمع‌بندی مستند کافی نبود؛ لینک ویدئوها را ببین.':'جمع‌بندی متنی فعلاً آماده نشد؛ لینک ویدئوهای بررسی در دسترس است.',
    summarized:'این نکته‌ها با هوش مصنوعی از گفته‌های بررسی‌کننده‌ها استخراج شده‌اند؛ هر نکته به همان لحظه از ویدئو لینک دارد.',
    pending:sources.length?'ویدئوها پیدا شدند؛ متن و نکته‌های قابل استناد در حال بررسی‌اند…':'در حال جست‌وجوی بررسی مرتبط با مدل انتخاب‌شده…',
    found:'ویدئوهای مرتبط پیدا شدند؛ در حال بررسی دسترسی به متن…',
  };
  const status=loading?(sources.length?'در حال بررسی متن ویدئوها؛ لینک‌ها همین حالا قابل مشاهده‌اند…':'در حال پیدا کردن بررسی مرتبط با همین مدل…'):(messages[d.status]||'بررسی متنی آماده نشد؛ می‌توانی دوباره تلاش کنی.');
  const searchLinks=(d.search_links||[]).map(s=>reviewLink(s.url,esc(s.label),true,'review-search-link')).join('');
  const retry=!loading&&['unavailable','pending','client_error'].includes(d.status);
  const analyzed=points.length?sources.filter(s=>points.some(p=>p.source_id===s.id)):[];
  const basis=analyzed.length?`<p class="review-basis small muted">بر اساس متن ${fa(analyzed.length)} ویدئو از ${analyzed.map(s=>`<bdi>${esc(s.channel)}</bdi>`).join('، ')}</p>`:'';
  return `<section id="video-review-panel" class="panel video-reviews" aria-labelledby="video-review-title" aria-busy="${loading}"><div class="review-heading"><div><h2 id="video-review-title">${icon('sparkle')} خلاصهٔ بررسی‌های ویدئویی</h2><p class="small muted">${products.length>1?'آنچه بررسی‌کننده‌ها دربارهٔ این مدل‌ها گفته‌اند':'آنچه بررسی‌کننده‌ها دربارهٔ این مدل گفته‌اند'}، جدا از مشخصات و قیمت فروشگاه‌ها</p></div>${sources.length?badge(d.scope==='head_to_head'?'مقایسهٔ مستقیم':products.length>1?'بررسی‌های جداگانه':'بررسی محصول','','camera'):''}</div><p class="review-status" role="status" aria-live="polite" aria-atomic="true">${loading?'<span class="spinner" aria-hidden="true"></span>':''}${esc(status)}</p>${basis}${products.length>1&&sources.length&&d.scope!=='head_to_head'?'<p class="review-caution">ویدئوی مقایسهٔ مستقیم پیدا نشد؛ این‌ها بررسی‌های جداگانه‌اند، نه آزمون رودررو.</p>':''}${reviewGroups(points,sources,products)}${d.partial&&points.length?'<p class="review-caution">متن ویدئو طولانی بود؛ نکته‌ها از بخش‌هایی در سراسر ویدئو استخراج شده‌اند و کل ویدئو تحلیل نشده است.</p>':''}${sources.length?`<div class="review-sources"><h3>ویدئوهای بررسی</h3>${sources.map(s=>{const count=points.filter(p=>p.source_id===s.id).length;return `<article class="review-source">${reviewLink(s.url,`${icon('camera')}<span>${esc(s.title)}</span>`,'','review-video-link')}<p class="small muted">${reviewSourceMeta(s)}</p>${products.length>1?`<p class="small muted">${s.product_ids?.map(id=>products.find(p=>p.id===id)?.name).filter(Boolean).map(esc).join('، ')||''}</p>`:''}${count?`<span class="small review-count">${fa(count)} نکته از این ویدئو</span>`:s.transcript_status==='unavailable'?'<span class="small review-caution">متن در دسترس نیست؛ فقط لینک ویدئو</span>':s.transcript_status==='available'&&points.length?'<span class="small muted">متن بررسی شد؛ نکتهٔ مستند جداگانه‌ای از این ویدئو انتخاب نشد</span>':s.transcript_status==='not_requested'&&!loading?'<span class="small muted">فقط لینک؛ متن این ویدئو تحلیل نشده</span>':''}</article>`;}).join('')}</div>`:''}${d.partial_search?'<p class="small muted">بخشی از جست‌وجو پاسخ نداد؛ این فهرست ممکن است کامل نباشد.</p>':''}${searchLinks?`<details class="review-search"><summary>خودم در یوتیوب جست‌وجو می‌کنم</summary>${searchLinks}</details>`:''}${retry?btn('تلاش دوباره برای بررسی','retry-video-review','btn-secondary'):''}<p class="review-disclaimer small muted">ممکن است متن خودکار یا خلاصه خطا داشته باشد. نمودارها و جزئیات صرفاً تصویری از روی متن تأیید نمی‌شوند. قیمت و موجودی امروز از ویدئو برداشت نمی‌شود.${products[0].group==='beauty'?' تجربهٔ آرایشی افراد متفاوت است؛ شمارهٔ رنگ و نسخهٔ فرمول را تطبیق بده. این بخش توصیهٔ درمانی نیست.':''}</p></section>`;
}
function updateVideoReviewPanel(key,token){
  if(key!==videoReviewKey()||busy)return;
  const panel=$('#video-review-panel');
  if(panel)panel.outerHTML=videoReviewSection();
}
async function requestVideoReview(key,token,force=false){
  if(!key)return;
  const previous=videoReviewResults.get(key);
  if(previous?.loading||(!force&&previous?.complete&&Date.now()-previous.updated<300000))return;
  const entry={loading:true,data:previous?.data||{},updated:Date.now()};
  videoReviewResults.set(key,entry);
  updateVideoReviewPanel(key,token);
  try{
    // First response delivers links; the second may call the existing model on native captions.
    for(const phase of ['discover','summary']){
      let data;
      for(let attempt=0;attempt<4;attempt++){
        data=await api('/api/video-reviews',{ids:key,phase});
        entry.data=data;updateVideoReviewPanel(key,token);
        if(data.status!=='pending'||key!==videoReviewKey())break;
        await new Promise(resolve=>setTimeout(resolve,1500));
      }
      if(key!==videoReviewKey())break;
      if(data.status==='pending'||(phase==='discover'&&(!data.sources?.length||data.status!=='found')))break;
    }
  }catch{
    entry.data={...entry.data,status:entry.data.sources?.length?'links_only':'client_error',reason:'summary_unavailable'};
  }finally{
    entry.loading=false;entry.updated=Date.now();entry.complete=!['found','pending'].includes(entry.data.status);
    updateVideoReviewPanel(key,token);
  }
}
function appendReview(html){const section=videoReviewSection();if(!section)return html;const last=html.lastIndexOf('</div>');return last<0?html:html.slice(0,last)+section+html.slice(last);}
for(const name of ['product','stores','assistant']){
  const original=views[name];
  views[name]=()=>{
    const html=original(), section=videoReviewSection(), specs='<section class="panel"><h2>مشخصات ثبت‌شده</h2>';
    // Product pages: reviews run full width under the two columns; elsewhere they go above long specification lists.
    if(name==='product'&&section&&html.includes('<!--product-after-->'))return html.replace('<!--product-after-->',section+'<!--product-after-->');
    return name==='product'&&section&&html.includes(specs)?html.replace(specs,section+specs):appendReview(html);
  };
}
const compareReviewView=views.compare;
views.compare=()=>{const html=compareReviewView(),section=videoReviewSection();return section&&html.includes('<section class="compare-section">')?html.replace('<section class="compare-section">',section+'<section class="compare-section">'):appendReview(html);};
const videoReviewLoadRoute=loadRoute;
loadRoute=async function(){const token=generation;await videoReviewLoadRoute();if(token===generation)void requestVideoReview(videoReviewKey(),token);};
actions['retry-video-review']=()=>requestVideoReview(videoReviewKey(),generation,true);
const originalPrivacyAction=actions.privacy;
actions.privacy=()=>{originalPrivacyAction();const content=$('#dialog');if(content)content.insertAdjacentHTML('beforeend','<p>برای بررسی خودکار ویدئویی، فقط نام و مدل کالای انتخابی به سرویس جست‌وجوی ویدئو فرستاده می‌شود؛ نه موقعیت یا اطلاعات شخصی شما. متن عمومی ویدئو برای جمع‌بندی به سرویس هوش مصنوعی ارسال می‌شود. ویدئوها خودکار پخش نمی‌شوند.</p>');};
