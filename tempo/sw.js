const C='tempo-v4-__BUILD__',FILES=['./','index.html','tokens.css','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:'reload'})))));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
// The app itself (page, styles, manifest): always try the network first so a new version shows up immediately,
// fall back to the saved copy when offline or slow. Icons: saved copy first. Other sites (bus data): never touched.
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==location.origin)return;
 const app=r.mode==='navigate'||/\.(html|css|webmanifest)$/.test(u.pathname)||u.pathname.endsWith('/');
 if(app){e.respondWith((async()=>{const c=await caches.open(C);try{const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),4000);const res=await fetch(r,{cache:'no-cache',signal:ctl.signal});clearTimeout(to);if(res.ok)c.put(r,res.clone());return res}catch(err){return (await c.match(r,{ignoreSearch:true}))||(await c.match('./'))||Response.error()}})());return}
 e.respondWith(caches.open(C).then(async c=>{const hit=await c.match(r,{ignoreSearch:true});return hit||fetch(r).then(res=>{if(res.ok)c.put(r,res.clone());return res})}))});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>l.length?l[0].focus():self.clients.openWindow('./')))});
