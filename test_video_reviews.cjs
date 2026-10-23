// Pure component/state checks: provider/model/network are all mocked.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context=vm.createContext({Intl,URLSearchParams,Date,Map,JSON,console,structuredClone,setTimeout,clearTimeout,setInterval:()=>0,
  location:{hash:'#product',protocol:'http:'},localStorage:{getItem:()=>null,setItem:()=>{}},navigator:{},
  document:{addEventListener:()=>{},querySelector:()=>null},window:{addEventListener:()=>{}}});
for(const file of ['catalog.js','shopping.js','reviews.js'])vm.runInContext(fs.readFileSync(file,'utf8').replace(/initialize\(\);\s*$/,''),context);
const run=code=>vm.runInContext(code,context);
run(`let phone={id:'product_phone',name:'Galaxy A55',category:'گوشی موبایل',group:'mobile',images:[],specs:[],price:100,stores:1};
let other={...phone,id:'product_other',name:'Galaxy A56'};cacheProducts([phone,other]);state.product=phone.id;route='product';busy=false;
let reviewCalls=[];let appliedPanels=[];document.querySelector=q=>q==='#video-review-panel'?{set outerHTML(html){appliedPanels.push(html);}}:null;
let source={id:'AbCdEf123_-',title:'Galaxy A55 review',url:'https://www.youtube.com/watch?v=AbCdEf123_-',channel:'Test channel',product_ids:['product_phone'],transcript_status:'unavailable'};
`);
(async()=>{
  assert.ok(run('videoReviewSection()').includes('aria-busy="true"'),'initial component explains loading');
  run(`api=async(path,params)=>{reviewCalls.push({path,params});return {status:'not_configured',sources:[],search_links:[{label:'جست‌وجو',url:'https://www.youtube.com/results?search_query=a55'}]};};`);
  await run('requestVideoReview(videoReviewKey(),generation)');
  assert.equal(run('reviewCalls.length'),1,'no summary requests without discovered videos');
  assert.ok(run('videoReviewSection()').includes('هنوز فعال نیست'));
  assert.ok(run('videoReviewSection()').includes('www.youtube.com/results?'),'search link is not labelled as a discovered review');
  await run('requestVideoReview(videoReviewKey(),generation)');
  assert.equal(run('reviewCalls.length'),1,'rerenders do not rediscover videos');

  run(`reviewCalls=[];api=async(path,params)=>{reviewCalls.push({path,params});return {status:params.phase==='discover'?'found':'links_only',reason:'no_transcript',sources:[source],scope:'individual'};};`);
  await run('requestVideoReview(videoReviewKey(),generation,true)');
  assert.equal(run('reviewCalls.map(c=>c.params.phase).join()'),'discover,summary');
  assert.ok(run(`appliedPanels.some(html=>html.includes('review-video-link')&&html.includes('aria-busy="true"'))`),'real links arrive before the slower summary');
  let html=run('videoReviewSection()');
  assert.ok(html.includes('متن قابل استفاده')&&html.includes(sourceURL()),'without captions show real video, never a fabricated summary');
  assert.ok(!html.includes('class="review-points"'));

  run(`videoReviewResults.set(videoReviewKey(),{complete:true,loading:false,updated:Date.now(),data:{status:'summarized',sources:[{...source,title:'<img src=x onerror=alert(1)>'}],points:[{text:'<script>bad</script>',source_id:source.id,start:75,url:source.url+'&t=75s'}],partial:true}});`);
  html=run('videoReviewSection()');
  assert.ok(html.includes('&lt;script&gt;')&&!html.includes('<script>'),'model text is escaped');
  assert.ok(!html.includes('<img src=x'),'provider titles are escaped');
  assert.ok(html.includes('۱:۱۵')&&html.includes('&amp;t=75s'),'validated timestamp link');
  assert.ok(html.includes('کل ویدئو تحلیل نشده'),'partial coverage is explicit');
  assert.ok(html.includes('kind-caution')&&html.includes('پیش از خرید بدان'),'a point without a known kind is still shown, as a caution');

  run(`videoReviewResults.set(videoReviewKey(),{complete:true,loading:false,updated:Date.now(),data:{status:'summarized',sources:[{...source,duration:1051,published_label:'۲ سال پیش',transcript_status:'available'}],
    points:[{text:'باتری یک روز کامل',kind:'strength',topic:'باتری',source_id:source.id,start:254,url:source.url+'&t=254s'},{text:'خریدش را توصیه می‌کند',kind:'verdict',source_id:source.id,start:941,url:source.url+'&t=941s'}]}});`);
  html=run('videoReviewSection()');
  assert.ok(html.indexOf('جمع‌بندی بررسی‌کننده')<html.indexOf('نقاط قوت'),'the reviewer verdict leads the brief');
  assert.ok(html.includes('review-topic">باتری')&&html.includes('۱۸ دقیقه')&&html.includes('۲ سال پیش')&&html.includes('۲ نکته از این ویدئو'));
  assert.ok(html.includes('بر اساس متن ۱ ویدئو'),'the brief states what it is based on');
  assert.ok(!html.includes('review-product'),'single-product briefs do not repeat the product name');
  assert.equal(run(`reviewLink('javascript:alert(1)','bad')`),'');
  assert.equal(run(`reviewLink('https://evil.test/watch?v=AbCdEf123_-','bad')`),'');
  assert.equal(run(`reviewLink('https://www.youtube.com.evil.test/watch?v=AbCdEf123_-','bad')`),'');

  run(`state.compare=['product_phone','product_other'];route='compare';videoReviewResults.set(videoReviewKey(),{complete:true,loading:false,data:{status:'links_only',sources:[source],scope:'individual'}});`);
  assert.ok(run('videoReviewSection()').includes('نه آزمون رودررو'),'individual reviews cannot masquerade as direct comparison');
  run("state.compare=['product_phone'];");
  assert.equal(run('videoReviewKey()'),'','no paid review request for an incomplete comparison');
  run("route='product';state.product='product_phone';productCache.set('product_phone',{...phone,group:'fashion'});");
  assert.equal(run('videoReviewSection()'),'','no reviews module in unsupported departments');
  run("productCache.set('product_phone',phone);route='home';");
  assert.equal(run('videoReviewSection()'),'','no automatic home-page video calls');

  // Navigating away must not let an old request overwrite another product's panel.
  run(`route='product';videoReviewResults.clear();reviewCalls=[];let resolveDiscovery;api=(path,params)=>{reviewCalls.push(params);return new Promise(resolve=>{resolveDiscovery=resolve;});};`);
  const pending=run('requestVideoReview(videoReviewKey(),generation)');
  run("state.product='product_other';generation++;appliedPanels=[];resolveDiscovery({status:'found',sources:[source],scope:'individual'});");
  await pending;
  assert.equal(run('appliedPanels.length'),0,'stale requests cannot replace unrelated product content');
  assert.equal(run('reviewCalls.length'),1,'do not spend on summarizing a product the user left');
  run(`state.product='product_phone';api=async(path,params)=>{reviewCalls.push(params);return {status:params.phase==='discover'?'found':'links_only',sources:[source],scope:'individual'};};`);
  await run('requestVideoReview(videoReviewKey(),generation)');
  assert.equal(run('reviewCalls.length'),3,'returning to an interrupted product resumes analysis');
  run(`reviewCalls=[];api=async()=>{reviewCalls.push('discover');return {status:'budget_limited',sources:[],search_links:[{label:'جست‌وجو',url:'https://www.youtube.com/results?search_query=a55'}]};};`);
  await run('requestVideoReview(videoReviewKey(),generation,true)');
  assert.equal(run('reviewCalls.length'),1,'a spending stop never triggers caption/summary requests');
  assert.ok(run('videoReviewSection()').includes('حفظ سهمیه'));
  run(`videoReviewResults.set(videoReviewKey(),{loading:false,data:{status:'links_only',reason:'summary_paused',sources:[source]}});`);
  assert.ok(run('videoReviewSection()').includes('خلاصه‌سازی فعلاً غیرفعال'));
  console.log('Video reviews: progressive links, no-text fallback, citations, escaping, cache, category scope and stale-navigation checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
function sourceURL(){return 'https://www.youtube.com/watch?v=AbCdEf123_-';}
