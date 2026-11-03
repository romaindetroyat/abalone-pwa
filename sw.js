if(self.location.hostname==='terminal.local'){self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));}else{
const CACHE='abalone-v1.0.0';
const ASSETS=['/','/index.html','/style.css','/src/app.js','/src/engine.js','/src/search.js','/src/board.js','/src/worker.js','/src/config.js','/manifest.webmanifest','/icons/icon.svg','/icons/icon-192.png','/icons/icon-512.png','/icons/apple.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
 if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(async r=>{if(r.ok){const c=await caches.open(CACHE);await c.put('/index.html',r.clone());}return r;}).catch(()=>caches.match('/index.html')));}
 else e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)));
});

}
