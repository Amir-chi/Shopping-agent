// Seller panel and buyer threads: login screen, tabs, inbox/thread, products, escaping and the demo price lock. No server.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({Intl,URLSearchParams,Date,Map,Set,JSON,console,structuredClone,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,
  location:{hash:'#seller',protocol:'http:'},localStorage:{getItem:()=>null,setItem:()=>{}},navigator:{},
  document:{addEventListener:()=>{},querySelector:()=>null},window:{addEventListener:()=>{}}});
for(const file of ['catalog.js','shopping.js','reviews.js','seller.js'])vm.runInContext(fs.readFileSync(file,'utf8').replace(/initialize\(\);\s*$/,''),context);
const run=code=>vm.runInContext(code,context);

run("state.seller=null;sellerConfig={demo:true};sellerShops=[{id:'shop_a',name:'<b>فروشگاه</b>',area:'تهران'}];");
let html=run('sellerApp()');
assert.ok(html.includes('id="seller-find"')&&html.includes('data-action="seller-pick"')&&!html.includes('<b>فروشگاه'),'login starts with an escaped shop search');
run("sellerPick=sellerShops[0];");
html=run('sellerApp()');
assert.ok(html.includes('id="seller-code"')&&html.includes('autocomplete="one-time-code"')&&html.includes('ورود نمایشی'),'then a code field, plus demo login when the server allows it');
run("sellerPick=null;sellerConfig={demo:true,shops:[{id:'shop_x',name:'<i>نمونه</i>',area:'تهران',trade:'گوشی موبایل',products:120}]};");
html=run('sellerApp()');
assert.ok(html.includes('data-action="seller-demo-shop" data-id="shop_x"')&&html.includes('فروشگاه‌های نمونه')&&!html.includes('<i>نمونه'),'demo login lists sample shops for presenting');
run("sellerPick=sellerShops[0];sellerConfig={demo:false};");
assert.ok(!run('sellerApp()').includes('ورود نمایشی'),'no demo button when demo login is off');

const t=new Date().toISOString();
run(`state.seller={token:'t',demo:true,shop:{id:'shop_a',name:'آوانوش',area:'تهران'}};sellerOverview={shop:{id:'shop_a',name:'آوانوش',area:'تهران',categories:[]},demo:true,
  stats:{received:3,unread:2,answered:1,median_minutes:4,products:120,live:0},
  latest:[{id:'q1',shop:{id:'shop_a',name:'آوانوش',area:'تهران'},product:{id:'product_a',name:'<img src=x>'},questions:['موجود است؟'],note:'<script>',created_at:'${t}',updated_at:'${t}',answered_at:null,seller_unread:true,available:null,price:null,reply:''}],
  demand:{unmet:[{product:{id:'product_b',name:'یخچال'},count:2,in_your_shop:true}],searches:[{query:'<u>q</u>',count:3}],other_searches:[]}};sellerTab='home';`);
html=run('sellerApp()');
assert.ok(html.includes('role="tablist"')&&html.includes('class="sp-count">۲<')&&html.includes('ورود نمایشی'),'header, tabs and an unread badge');
run("sellerConfig={demo:true,shops:[{id:'shop_a',name:'آوانوش',area:'تهران',trade:'',products:1},{id:'shop_y',name:'دوم',area:'تهران',trade:'گاز',products:9}]};");
const switcher=run('sellerApp()');
assert.ok(switcher.includes('id="sp-switch"')&&switcher.includes('value="shop_y"')&&!switcher.includes('<option value="shop_a"'),'a demo panel can jump to the other sample shops');
run("sellerConfig={demo:true};");
assert.ok(html.includes('پیام خوانده‌نشده')&&html.includes('۱۲۰')&&html.includes('یخچال'),'dashboard shows numbers, latest messages and demand');
assert.ok(!html.includes('<img src=x')&&!html.includes('<script>')&&!html.includes('<u>q'),'buyer text and searches are escaped');

run(`sellerTab='inbox';sellerInbox={status:'unread',items:sellerOverview.latest};sellerThread={...sellerOverview.latest[0],seller_unread:false,your_price:1000000,messages:[{sender:'seller',text:'<i>موجود</i>',available:true,price:950000,created_at:'${t}'},{sender:'buyer',text:'تا کی باز هستید؟',available:null,price:null,created_at:'${t}'}]};`);
html=run('sellerApp()');
assert.ok(html.includes('id="seller-reply"')&&html.includes('data-action="seller-quick"')&&html.includes('name="available"'),'thread has quick replies, a status choice and a composer');
assert.ok(html.includes('sp-bubble mine')&&html.includes('sp-bubble theirs')&&html.includes('قیمت ثبت‌شدهٔ تو')&&!html.includes('<i>موجود'),'seller messages on one side, buyer messages on the other');
assert.ok(html.includes('aria-pressed="true"')&&html.includes('sp-inbox has-thread'),'filter state and two-pane inbox');

run(`sellerTab='products';sellerProducts={q:'',category:'',total:1,categories:[{name:'یخچال',count:1},{name:'گاز',count:2}],items:[{offer_id:'offer_a',price:5000000,changed_at:null,source:'dataset',fresh:false,availability:'unknown',reported_price:null,product:{id:'product_b',name:'یخچال',category:'یخچال',images:[],low:5000000,stores:3}}]};sellerEditing='offer_a';`);
html=run('sellerApp()');
assert.ok(html.includes('class="sp-price-form"')&&/<button class="btn btn-primary" type="submit" disabled>ذخیره/.test(html)&&html.includes('ورود نمایشی ذخیره غیرفعال'),'demo sessions cannot save public prices');
run("state.seller.demo=false;");
assert.ok(!/type="submit" disabled>ذخیره/.test(run('sellerApp()')),'a code login can save');
run("sellerTab='demand';");
assert.ok(run('sellerApp()').includes('در ویترین تو هست'),'demand tab');

run(`inquiryAnswers=new Map([['q1',{id:'q1',shop:{id:'shop_a',name:'آوانوش',area:'x'},product:null,questions:['موجود است؟'],note:'',created_at:'${t}',updated_at:'${t}',answered_at:'${t}',available:true,price:950000,reply:'',messages:[{sender:'seller',text:'بله',available:true,price:950000,created_at:'${t}'},{sender:'buyer',text:'<b>ممنون</b>',created_at:'${t}'}]}]]);`);
html=run('inquiriesPanel()');
assert.ok(html.includes('class="buyer-reply"')&&html.includes('>فروشنده ·')&&html.includes('>تو ·')&&!html.includes('<b>ممنون'),'buyer sees the thread from their side and can reply');
const css=fs.readFileSync('ui.css','utf8');
assert.ok(/body\[data-view="seller"\] #bottom-nav[^{]*\.desktop-nav[^{]*\.header-search[^{]*\{display:none\}/.test(css),'seller mode hides the buyer navigation and search');
run(`state.seller={token:'t',demo:false,shop:{id:'shop_a',name:'آوانوش',area:'تهران'}};sellerTab='home';`);
assert.ok(run('sellerApp()').includes('href="#home">سایت خریداران'),'the panel links back to the buyer site');
console.log('Seller panel: login, demo switch, tabs, dashboard, inbox thread, products with demo price lock, demand, buyer replies and escaping passed.');
