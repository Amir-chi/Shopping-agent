// Offline mode: the app shell and catalog data already seen stay on this device only.
// Network first, so prices are fresh whenever there is a connection; the cache answers only when the network fails.
const SHELL='nazdika-shell-v1',DATA='nazdika-data-v1',LIMIT={[SHELL]:40,[DATA]:300};
const OFFLINE=JSON.stringify({error:'offline'});
const local=url=>new URL(url,self.location).origin===self.location.origin;

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(['/','/manifest.webmanifest','/assets/favicon.svg'])).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>!(k in LIMIT)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
// The page lists the exact versioned scripts and styles it loaded, so the first visit is enough to work offline.
self.addEventListener('message',event=>{
  const urls=Array.isArray(event.data?.precache)?event.data.precache.filter(u=>typeof u==='string'&&local(u)):[];
  event.waitUntil(caches.open(SHELL).then(cache=>Promise.all(urls.map(u=>cache.add(u).catch(()=>{})))).then(()=>trim(SHELL)));
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||!local(url)||url.pathname.startsWith('/admin')||url.pathname==='/api/health')return;
  const api=url.pathname.startsWith('/api/'),name=api?DATA:SHELL,key=request.mode==='navigate'?'/':request;
  // Precise device location is never stored; a chosen neighbourhood centre is already kept in app state.
  const keep=request.headers.get('X-Nazdika-Location')!=='precise';
  event.respondWith(fetch(request).then(response=>{
    if(response.ok&&keep){const copy=response.clone();event.waitUntil(caches.open(name).then(cache=>cache.put(key,copy)).then(()=>trim(name)));}
    return response;
  }).catch(async()=>(await caches.match(key,{cacheName:name}))||(api?new Response(OFFLINE,{status:503,headers:{'Content-Type':'application/json'}}):Response.error())));
});
async function trim(name){
  const cache=await caches.open(name),keys=await cache.keys();
  await Promise.all(keys.slice(0,Math.max(0,keys.length-LIMIT[name])).map(k=>cache.delete(k)));
}
