// Pure rendering/state checks; no browser automation or dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
function apiFixture(path, params={}) {
  const base=process.env.API_BASE || 'http://127.0.0.1:8000';
  const url=base+path+'?'+new URLSearchParams(params);
  return JSON.parse(execFileSync(process.env.PYTHON || 'python',['-c',
    'import json,urllib.request,sys; print(json.dumps(json.load(urllib.request.urlopen(sys.argv[1],timeout=120)),ensure_ascii=True))',url],{encoding:'utf8',maxBuffer:8*1024*1024}));
}
const fixture = apiFixture('/api/bootstrap');
const sample = fixture.featured[0];
const shops = apiFixture('/api/products/'+sample.id+'/stores');
const context = vm.createContext({Intl,URLSearchParams,Date,Map,JSON,console,structuredClone,setTimeout,clearTimeout,setInterval:()=>0,
  location:{hash:'',protocol:'http:'},localStorage:{getItem:()=>null,setItem:()=>{}},navigator:{},
  document:{addEventListener:()=>{}},window:{addEventListener:()=>{}}});
vm.runInContext(fs.readFileSync('catalog.js','utf8').replace(/initialize\(\);\s*$/, ''),context);
vm.runInContext(fs.readFileSync('shopping.js','utf8'),context);
vm.runInContext(fs.readFileSync('reviews.js','utf8'),context);
vm.runInContext(fs.readFileSync('seller.js','utf8'),context);
context.fixture=fixture;context.shopFixture=shops;
vm.runInContext(`boot=fixture;cacheProducts(boot.featured);state.product=boot.featured[0].id;list=boot.featured;total=list.length;storeList=shopFixture.items;selectedShop=storeList[0];shopProducts=list;shopTotal=3;directory=storeList;directoryTotal=storeList.length;`, context);
assert.equal(shops.items[0].contacts_synthetic,true,'PostgreSQL API labels dataset phone numbers');
assert.ok(!vm.runInContext('phones(selectedShop)',context).includes('tel:'),'synthetic phones never become callable links');
vm.runInContext("route='product';",context);
const reviewedProduct=vm.runInContext('views.product()',context);
assert.ok(reviewedProduct.includes('id="video-review-panel"'),'actual product view includes automatic video reviews');
assert.ok(reviewedProduct.indexOf('id="video-review-panel"')>reviewedProduct.indexOf('class="product-main"')&&reviewedProduct.indexOf('<!--product-after-->')>reviewedProduct.indexOf('id="video-review-panel"'),'video reviews run full width right after the two columns (specs show at most six rows before them)');
vm.runInContext("route='home';",context);
for (const name of ['home','discovery','recommendations','compare','storesPage','storeDetail','verification','planPage','savedPage','shopsPage','outfitsPage','productPage','marketsPage','pricesPage','categoriesPage','categoryPage','assistantPage','sharedPage','routePage','photoPage','dowryPage','giftPage','sellerApp','listPage','helpersPage','messagesPage','locatePage','askPage']) {
  const html=vm.runInContext(`${name}()`,context);
  assert.ok(html.startsWith('<div'),name+' renders a page');
  assert.ok(!/undefined|NaN/.test(html),name+' contains no invalid values');
}
vm.runInContext("let comparisonSample={...boot.featured[0],id:'product_compareDemo',name:'گزینه دوم'};cacheProducts([comparisonSample]);state.compare=[boot.featured[0].id,comparisonSample.id];",context);
assert.ok(vm.runInContext('compare()',context).includes('compare-table'));
vm.runInContext(`state.plan={product:product(),shop:selectedShop,backup:null,checks:{}};`,context);
assert.ok(vm.runInContext('planPage()',context).includes(sample.name));
vm.runInContext(`state.filters=['installment'];`,context);
assert.equal(vm.runInContext('filteredStores().every(s=>s.installment)',context),true);
assert.equal(vm.runInContext('esc("<script>")',context),'&lt;script&gt;');
assert.equal(vm.runInContext('digits("۳۰٬۰۰۰٬۰۰۰")+digits("٢٥,000")+digits("abc")',context),'3000000025000','Persian/Arabic digits and separators normalize');
assert.equal(vm.runInContext('moneyWords(30000000)',context),'۳۰ میلیون تومان');
assert.ok(vm.runInContext('moneyInput("max_price","b",30000000)',context).includes('value="۳۰٬۰۰۰٬۰۰۰"'),'saved budgets render in Persian digits');
assert.ok(vm.runInContext(`productCard({...product(),name:'<img src=x>',images:['javascript:bad']})`,context).includes('&lt;img src=x&gt;'));
assert.ok(vm.runInContext(`image({...product(),images:['javascript:bad']})`,context).includes('/assets/placeholder.svg'));
assert.equal(vm.runInContext('priceAge(null)',context),'زمان تغییر قیمت ثبت نشده');
context.outfitFixture=apiFixture('/api/outfits');
context.marketFixture=apiFixture('/api/market-fallback',{q:'کفش'});
vm.runInContext('outfitData=outfitFixture;marketData=marketFixture;state.outfitProfileV3=true;state.outfitDraftV1=null;',context);
assert.ok(vm.runInContext('outfitsPage()',context).includes('outfit-board'));
const lookboard=vm.runInContext('outfitsPage()',context);
assert.ok(lookboard.includes('بر اساس سلیقهٔ تو')&&lookboard.includes('ویرایش پاسخ‌ها'),'results explain their source and let users edit answers');
assert.ok(lookboard.includes('data-action="review-outfits"'),'model review is explicitly requested, not automatic');
assert.ok(lookboard.includes('بدون تحلیل تصویر'),'rule-only sets do not claim visual understanding');
vm.runInContext("outfitData={items:[],review:{status:'reviewed'}}",context);
assert.ok(vm.runInContext('outfitsPage()',context).includes('هیچ‌کدام'),'a reviewer can reject every candidate');
vm.runInContext('outfitData=outfitFixture',context);
assert.ok(lookboard.includes('class="outfit-details"'),'explanations are progressively disclosed');
assert.ok(lookboard.includes('class="outfit-name-link"'),'garments retain scoped product links');
assert.ok(!lookboard.includes('id="outfit-form"'),'the old long filter form is replaced by the interview');
vm.runInContext("state.compare=[];state.category='';state.answers={};",context);
assert.ok(!vm.runInContext('recommendations()',context).includes('recommendation-bar'),'empty comparison does not cover results');
vm.runInContext("state.compare=[boot.featured[0].id];state.category='<test>';state.answers={max_price:2000000,installment:true};",context);
const filteredResults=vm.runInContext('recommendations()',context);
assert.ok(filteredResults.includes('search-filters')&&filteredResults.includes('<datalist'),'filters are disclosed and categories searchable');
assert.ok(filteredResults.includes('&lt;test&gt;')&&!filteredResults.includes('<test>'),'applied filters are escaped');
assert.equal((vm.runInContext('activeProductFilters()',context).match(/data-action="remove-product-filter"/g)||[]).length,3);
assert.ok(filteredResults.includes('recommendation-bar'),'comparison appears after selecting a product');
assert.ok(vm.runInContext('priceSource({})',context).includes('نیازمند تأیید امروز'),'snapshot prices are not presented as live');
const storeHtml=vm.runInContext('storeDetail()',context);
assert.equal((storeHtml.match(/<h1[ >]/g)||[]).length,1,'store detail has one page heading');
assert.ok(storeHtml.includes('store-products'),'secondary shop inventory is disclosed on demand');
const luminance=hex=>hex.match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
const uiCss=fs.readFileSync('ui.css','utf8');
for(const id of ['pop','poplilac','popyellow','ink','teal','olive','brown','night']){
  // Light themes share one token rule and override only the accent: a theme's tokens are every :root rule naming it, the last one winning.
  const block=[...uiCss.matchAll(/((?::root\[data-theme="[a-z]+"\],?)+)\{([^}]*)\}/g)].filter(m=>m[1].includes('"'+id+'"')).map(m=>m[2]).join(';');
  const token=name=>[...block.matchAll(new RegExp('--'+name+':#([0-9a-f]{6})','gi'))].pop()[1];
  for(const [fg,bg] of [['primary','surface'],['ink','bg'],['muted','bg'],['muted','primary-soft'],['green','green-soft'],['amber','amber-soft'],['danger','danger-soft']]){
    assert.ok(contrast(token(fg),token(bg))>=4.5,id+' '+fg+'/'+bg+' text contrast');
  }
  assert.ok(contrast(token('control-line'),token('surface'))>=3,id+' form boundaries');
  assert.ok(contrast(token('blue'),token('bg'))>=3,id+' keyboard focus');
}
// Theme changes touch presentation only: no view rerender, API call, or shopping-state mutation.
const themeWrites=[];
const themeMeta={content:''},themeFeedback={textContent:''};
const choiceButtons=['pop','poplilac','popyellow','ink','teal','olive','brown','night'].map(id=>({dataset:{id},setAttribute(k,v){this[k]=v;}}));
context.document.documentElement={dataset:{theme:'navy'}};
context.document.querySelector=q=>q==='meta[name="theme-color"]'?themeMeta:q==='#theme-feedback'?themeFeedback:null;
context.document.querySelectorAll=q=>q==='[data-action="set-theme"]'?choiceButtons:[];
context.getComputedStyle=()=>({getPropertyValue:()=>' #f4f1ea '});
context.localStorage.setItem=(k,v)=>themeWrites.push([k,v]);
const shoppingBefore=vm.runInContext('JSON.stringify(state)',context);
for(const id of ['poplilac','popyellow','ink','teal','olive','brown','night','pop']){
  assert.equal(vm.runInContext('applyTheme("'+id+'")',context),id);
  assert.equal(context.document.documentElement.dataset.theme,id);
  assert.equal(choiceButtons.filter(b=>b['aria-pressed']==='true').length,1);
  assert.deepEqual(themeWrites.at(-1),['nazdika-theme-v4',id]);
  assert.equal(vm.runInContext('JSON.stringify(state)',context),shoppingBefore);
}
for(const id of ['invalid','__proto__','constructor'])assert.equal(vm.runInContext('resolveTheme("'+id+'")',context),'pop');
context.localStorage.setItem=()=>{throw Error('Storage blocked');};
assert.equal(vm.runInContext('applyTheme("olive")',context),'olive');
assert.ok(themeFeedback.textContent.includes('در دسترس نیست'));
const earlyThemeScript=fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const activeHtml=fs.readFileSync('index.html','utf8');
assert.equal((activeHtml.match(/rel="stylesheet"/g)||[]).length,1,'one coherent stylesheet, no legacy theme leakage');
assert.ok(vm.runInContext('heading("عنوان")',context).includes('aria-label="بازگشت"'),'icon-only back is named');
assert.equal((vm.runInContext('themeOptions()',context).match(/data-action="set-theme"/g)||[]).length,8);
for(const [stored,expected] of [['pop','pop'],['poplilac','poplilac'],['popyellow','popyellow'],['ink','ink'],['teal','teal'],['olive','olive'],['brown','brown'],['night','night'],['nazdika','pop'],['invalid','pop'],[null,'pop']]){
  const root={dataset:{}};
  vm.runInNewContext(earlyThemeScript,{document:{documentElement:root},localStorage:{getItem:()=>stored}});
  assert.equal(root.dataset.theme,expected,'saved theme is restored before first paint');
}
const blockedRoot={dataset:{}};
vm.runInNewContext(earlyThemeScript,{document:{documentElement:blockedRoot},localStorage:{getItem:()=>{throw Error('Blocked');}}});
assert.equal(blockedRoot.dataset.theme,'pop');
assert.ok(vm.runInContext('marketCards()',context).includes('market-card'));
context.homeFixture=apiFixture('/api/home');
vm.runInContext("homeData=homeFixture;state.group='mobile';state.category='';list=boot.featured;total=list.length;",context);
assert.ok(vm.runInContext('home()',context).includes('class="dept-card"')&&vm.runInContext('home()',context).includes('href="#category?g='+context.homeFixture.groups[0].id),'home shows the departments');
assert.ok(vm.runInContext('categoryPage()',context).includes('browse-grid'),'department page lists products');
assert.equal((vm.runInContext('categoriesPage()',context).match(/class="panel dept-panel"/g)||[]).length,context.homeFixture.groups.length);
assert.ok(vm.runInContext(`railCard({...product(),name:'<img src=x>'})`,context).includes('&lt;img src=x&gt;'),'rail cards escape names');
assert.ok(!vm.runInContext(`storeCard({...selectedShop,product_count:3,samples:[{image:'javascript:x'}]},true)`,context).includes('javascript:'),'shop previews only allow https images');
vm.runInContext('state.outfitPlan={items:outfitData.items[0].items,checks:{},created_at:new Date().toISOString()};state.savedOutfitPlan=structuredClone(state.outfitPlan);state.outfitPlanActive=true;',context);
assert.ok(vm.runInContext('planPage()',context).includes('outfit-plan-items'));
assert.ok(vm.runInContext('savedPage()',context).includes('برنامه ست ذخیره‌شده'));
vm.runInContext(`readTarget('product?id=${sample.id}&shop=${shops.items[0].id}')`,context);
assert.equal(vm.runInContext('state.product',context),sample.id);
assert.equal(vm.runInContext('state.shop',context),shops.items[0].id);
vm.runInContext("state.group='fashion';state.category='';",context);
assert.ok(vm.runInContext('categoryPage()',context).includes('href="#outfits"'),'fashion department owns the outfit entry');
assert.equal((vm.runInContext('categoriesPage()',context).match(/href="#outfits"/g)||[]).length,1,'only fashion panel offers outfit building');
vm.runInContext("state.group='mobile';",context);
assert.ok(!vm.runInContext('categoryPage()',context).includes('href="#outfits"'),'other departments do not show outfit building');
assert.ok(vm.runInContext('outfitInterviewPage()',context).includes('مسیر ست‌ساز'),'questionnaire shows its place in the hierarchy');
context.navNodes={'#site-header':{innerHTML:''},'#bottom-nav':{innerHTML:''}};
context.document.querySelector=q=>context.navNodes[q]||null;
vm.runInContext("route='outfits';nav();",context);
for(const node of Object.values(context.navNodes))assert.ok(!node.innerHTML.includes('href="#outfits"'),'outfits is not a global navigation item');
assert.equal((context.navNodes['#bottom-nav'].innerHTML.match(/<a /g)||[]).length,3,'three mobile tabs: home, my list, messages');
assert.ok(/href="#categories" class="active" aria-current="page"/.test(context.navNodes['#site-header'].innerHTML),'categories remains active while inside outfit building');
console.log('Frontend: 26 routes, fashion-only outfit entry, three-tab navigation, scoped links, plans, maps, escaping and filters passed.');
