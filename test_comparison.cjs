// Regression: persisted selections, category switches and rapid clicks must never mix product kinds.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const nodes={'#dialog':{open:false,innerHTML:'',showModal(){this.open=true;},close(){this.open=false;}},'#toast':{hidden:true}};
let writes=0;
const context=vm.createContext({Intl,URLSearchParams,Date,Map,JSON,console,structuredClone,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,
  location:{hash:'#home',protocol:'http:'},localStorage:{getItem:()=>null,setItem:()=>writes++},navigator:{},
  document:{addEventListener:()=>{},querySelector:q=>nodes[q]||null},window:{addEventListener:()=>{}}});
for(const file of ['catalog.js','shopping.js','reviews.js'])vm.runInContext(fs.readFileSync(file,'utf8').replace(/initialize\(\);\s*$/,''),context);
const run=code=>vm.runInContext(code,context);
run(`let shoe={id:'product_shoe',name:'کتانی سفید',category:'کتانی و کفش اسپرت',images:[],price:100,stores:1,specs:[]};
let shoe2={...shoe,id:'product_shoe2',name:'کتانی مشکی'};let shoe3={...shoe,id:'product_shoe3',name:'کتانی سوم'};
let laptop={...shoe,id:'product_laptop',name:'لپ تاپ دانشجویی',category:'لپ تاپ و نوت بوک'};
let fixtures=[shoe,shoe2,shoe3,laptop];cacheProducts(fixtures);render=()=>{};go=async target=>{route=target;};
api=async path=>{const p=fixtures.find(p=>path.endsWith('/'+p.id));if(p)return p;const error=new Error('missing');error.status=404;throw error;};`);
(async()=>{
  run("state.compare=[shoe.id,laptop.id];");
  assert.ok(!run('comparable()'));
  let html=run('views.compare()');
  assert.ok(html.includes('compare-keep')&&html.includes('هم‌دسته'));
  assert.ok(!html.includes('compare-table')&&!html.includes('ai-compare'),'old mixed choices have a repair screen, never a misleading table');
  html=run('compareBar()');
  assert.ok(html.includes('کتانی سفید')&&html.includes('لپ تاپ دانشجویی')&&html.includes('اصلاح انتخاب‌ها'));
  assert.ok(!run('videoReviewProducts().length'),'no mixed video comparison');
  await run('restoreComparison()');
  assert.equal(run('state.compare.length'),2,'old choices are not silently erased');
  await run("actions['compare-keep']({dataset:{category:shoe.category}})");
  assert.equal(run('state.compare.join()'),'product_shoe');
  assert.ok(run('compareBar()').includes('disabled'),'one selection never automatically adds a product');
  await run("actions['compare-toggle']({dataset:{id:laptop.id}})");
  assert.equal(run('state.compare.join()'),'product_shoe','a category switch requires explicit confirmation');
  assert.ok(nodes['#dialog'].open&&nodes['#dialog'].innerHTML.includes('شروع مقایسهٔ جدید'));
  run('closeDialog()');assert.equal(run('state.compare.join()'),'product_shoe','cancel preserves selections');
  await run("actions['compare-replace']({dataset:{id:laptop.id}})");
  assert.equal(run('state.compare.join()'),'product_laptop');
  run("state.compare=[shoe.id];route='recommendations';");
  await Promise.all([run("actions['compare-toggle']({dataset:{id:shoe2.id}})"),run("actions['compare-toggle']({dataset:{id:laptop.id}})")]);
  assert.equal(run('state.compare.join()'),'product_shoe,product_shoe2','parallel clicks cannot race category validation');
  assert.ok(run('comparable()'));
  html=run('views.compare()');
  assert.ok(html.includes('compare-table')&&html.includes('حذف از مقایسه'));
  run("shoe.specs=Array.from({length:20},(_,i)=>({key:'ویژگی '+i,value:'الف'+i}));shoe2.specs=[...shoe.specs.slice(0,15).map(s=>({...s,value:s.value+'ب'})),{key:'<b>تنها</b>',value:'x'}];compareExpanded=false;");
  const rows=html=>(html.match(/role="row"/g)||[]).length;
  html=run('views.compare()');
  assert.equal(rows(html),9,'a header and eight rows, not a card per spec');
  assert.ok(html.includes('ویژگی دیگر')&&!html.includes('<b>تنها'),'the rest waits behind a button and names are escaped');
  assert.ok(html.indexOf('ویژگی 14')<html.indexOf('ویژگی 15')||!html.includes('ویژگی 15'),'specs every product has come before missing ones');
  run("actions['compare-more']()");
  assert.ok(rows(run('views.compare()'))>20&&run('views.compare()').includes('نمایش خلاصه'),'expanding shows every differing spec');
  run("actions['compare-more']();shoe.specs=[];shoe2.specs=[];");
  run("compareInsight={ids:state.compare.join(','),ai:false};");
  assert.ok(run('views.compare()').includes('جمع‌بندی هوشمند فعلاً در دسترس نیست'),'missing model access is not silently presented as an intelligent answer');
  await run("actions['compare-toggle']({dataset:{id:shoe.id}})");
  assert.equal(run('state.compare.join()'),'product_shoe2');
  await run("actions['compare-browse']()");
  assert.equal(run('state.category'),'کتانی و کفش اسپرت');
  assert.equal(run('state.query'),'');
  run("state.compare=[shoe.id,'product_missing'];");await run('restoreComparison()');
  assert.equal(run('state.compare.join()'),'product_shoe','only confirmed 404s are removed');
  run("state.compare=[shoe.id];let workingApi=api;api=async()=>{throw new Error('offline')};");
  await run('restoreComparison()');assert.equal(run('state.compare.join()'),'product_shoe','network errors preserve old selections');
  run('api=workingApi;');
  run("actions['compare-clear']()");assert.equal(run('state.compare.length'),0);
  assert.ok(writes>0,'all changes are persisted');
  console.log('Comparison regression checks passed');
})().catch(error=>{console.error(error);process.exitCode=1;});

// Suggestions skip same-leaf items priced far from the compared ones (a headset filed under consoles).
{
  const run = code => vm.runInContext(code, context);
  const saved = run('JSON.stringify([state.compare,compareSuggest])');
  run(`state.compare=['c1'];productCache.set('c1',{id:'c1',name:'کنسول',category:'PS5',price:180000000});
       compareSuggest={category:'PS5',loading:'',items:[{id:'c2',name:'کنسول دیگر',category:'PS5',price:320000000},{id:'h1',name:'هدست',category:'PS5',price:29500000},{id:'n1',name:'بی‌قیمت',category:'PS5',price:null}]};`);
  const html = run('compareSuggestions()');
  assert.ok(html.includes('data-id="c2"') && html.includes('data-id="n1"') && !html.includes('data-id="h1"'), 'headset priced at a sixth of the console is not suggested');
  run(`[state.compare,compareSuggest]=${saved};`);
  console.log('Compare suggestions stay in the compared price band.');
}
