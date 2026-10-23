// Service worker checks with an in-memory Cache Storage and a switchable network; no browser needed.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const store=new Map(),handlers={};let online=true;
const keyOf=k=>typeof k==='string'?new URL(k,'http://nazdika.test').href:k.url;
const caches={
  open:async name=>{if(!store.has(name))store.set(name,new Map());const m=store.get(name);return {
    put:async(k,r)=>{m.set(keyOf(k),r);},addAll:async list=>list.forEach(u=>m.set(keyOf(u),new Response('shell'))),add:async u=>{m.set(keyOf(u),new Response('asset'));},
    keys:async()=>[...m.keys()].map(url=>({url})),delete:async k=>m.delete(k.url)};},
  keys:async()=>[...store.keys()],delete:async name=>store.delete(name),
  match:async(k,{cacheName})=>store.get(cacheName)?.get(keyOf(k)),
};
const self={location:new URL('http://nazdika.test/'),addEventListener:(type,fn)=>{handlers[type]=fn;},skipWaiting:async()=>{},clients:{claim:async()=>{}}};
const context=vm.createContext({self,caches,URL,Response,JSON,Promise,Array,Math,console,
  fetch:async request=>{if(!online)throw new TypeError('Failed to fetch');return new Response(JSON.stringify({url:request.url}),{status:200,headers:{'Content-Type':'application/json'}});}});
vm.runInContext(fs.readFileSync('sw.js','utf8'),context);
function request(path,{method='GET',mode='cors',precise=false}={}){return {method,mode,url:'http://nazdika.test'+path,headers:{get:h=>h==='X-Nazdika-Location'&&precise?'precise':null}};}
async function fire(req){
  const waits=[];let answer=null;
  handlers.fetch({request:req,respondWith:p=>{answer=p;},waitUntil:p=>waits.push(p)});
  const response=answer&&await answer;await Promise.all(waits);return response;
}
const cached=(name,path)=>store.get(name)?.has('http://nazdika.test'+path);
(async()=>{
  const installWaits=[];handlers.install({waitUntil:p=>installWaits.push(p)});await Promise.all(installWaits);
  assert.ok(cached('nazdika-shell-v1','/'),'the app shell is stored on install');
  await fire(request('/api/products/product_a'));
  assert.ok(cached('nazdika-data-v1','/api/products/product_a'),'seen catalog data is kept for offline use');
  await fire(request('/api/route-plan?ids=a,b&lat=35.7&lon=51.4'));
  assert.ok(cached('nazdika-data-v1','/api/route-plan?ids=a,b&lat=35.7&lon=51.4'),'a neighbourhood route is kept');
  await fire(request('/api/route-plan?ids=a,b&lat=35.71234&lon=51.41234',{precise:true}));
  assert.ok(!cached('nazdika-data-v1','/api/route-plan?ids=a,b&lat=35.71234&lon=51.41234'),'a precise device location is never stored');
  await fire(request('/?r=1',{mode:'navigate'}));
  for(const path of ['/admin/','/api/health'])assert.equal(await fire(request(path)),null,path+' is left to the network');
  assert.equal(await fire(request('/api/color-advice',{method:'POST'})),null,'writes are never intercepted');
  online=false;
  assert.deepEqual(await (await fire(request('/api/products/product_a'))).json(),{url:'http://nazdika.test/api/products/product_a'},'offline answers come from the cache');
  const missing=await fire(request('/api/products/product_new'));
  assert.equal(missing.status,503,'unseen data fails clearly instead of hanging');
  assert.ok(await fire(request('/saved',{mode:'navigate'})),'any page opens offline from the stored shell');
  online=true;
  for(let i=0;i<320;i++)await fire(request('/api/products/p'+i));
  assert.equal(store.get('nazdika-data-v1').size,300,'stored data is capped');
  console.log('Offline: shell install, network-first caching, precise-location exclusion, offline fallback and cache cap passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
