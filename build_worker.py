import base64,io,json
from PIL import Image,ImageDraw
def icon(sz):
    S=4*sz;im=Image.new('RGB',(S,S),(17,17,19));d=ImageDraw.Draw(im)
    u=S/100
    # jar body
    body=[30*u,30*u,70*u,84*u]
    d.rounded_rectangle([27*u,30*u,73*u,84*u],radius=11*u,fill=(44,44,48))
    d.rounded_rectangle([29*u,58*u,71*u,82*u],radius=9*u,fill=(78,163,111))
    d.rectangle([29*u,58*u,71*u,66*u],fill=(124,199,155))
    d.rounded_rectangle([27*u,30*u,73*u,84*u],radius=11*u,outline=(150,154,166),width=int(2*u))
    d.rounded_rectangle([33*u,20*u,67*u,30*u],radius=3*u,fill=(214,216,222))
    d.line([33*u,40*u,33*u,52*u],fill=(255,255,255),width=int(2.4*u))
    return im.resize((sz,sz),Image.LANCZOS)
def b64(im):
    b=io.BytesIO();im.save(b,'PNG');return base64.b64encode(b.getvalue()).decode()
i180,i512=b64(icon(180)),b64(icon(512))
app=open('want3.html',encoding='utf-8').read()
head_add='<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icon-180.png"><meta name="theme-color" content="#f4f4f6"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="apple-mobile-web-app-title" content="WANT.">'
app=app.replace('<title>WANT.</title>','<title>WANT.</title>'+head_add,1)
app=app.replace('<script>','<script>window.WANT_API="/api/product";</script><script>',1)
extract=open('extract.js',encoding='utf-8').read()+'\n'+open('sync_api.js',encoding='utf-8').read()
manifest=json.dumps({"name":"WANT.","short_name":"WANT.","start_url":"/","display":"standalone","background_color":"#f4f4f6","theme_color":"#f4f4f6","icons":[{"src":"/icon-180.png","sizes":"180x180","type":"image/png"},{"src":"/icon-512.png","sizes":"512x512","type":"image/png","purpose":"any maskable"}]})
sw="""const C='want-v2';self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['/','/manifest.webmanifest','/icon-180.png','/icon-512.png'])));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/'))return;
e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('/'))))});"""
worker=f"""// WANT. — your own free link, with automatic product reading.
// HOW TO DEPLOY (free, about 2 minutes):
// 1. Go to dash.cloudflare.com and sign up / sign in (free plan is enough).
// 2. Workers & Pages -> Create -> Create Worker -> name it "want" -> Deploy.
// 3. Click "Edit code", delete everything, paste this whole file, then Deploy.
// 4. Open the address it gives you (https://want.<your-name>.workers.dev) in Safari on your iPhone,
//    tap Share -> Add to Home Screen. Pasting a product link now fills name, photo and price.
// 5. (Optional, for Apple Pay + bank sync) In the worker: Settings -> Bindings -> Add -> KV namespace ->
//    create one called "want", variable name WANT_KV. Then Settings -> Variables and Secrets -> Add ->
//    type Secret, name WANT_TOKEN, value: a long random key you make up (keep it private). Deploy.
//    Put the same key in WANT. -> Settings -> Connections -> Sync key.
// Your data lives on your phone, in this app. To move data from the old link: Settings -> Copy backup there,
// then Settings -> Restore from backup here.

{extract}

const UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const J=(o,st=200,extra={{}})=>new Response(JSON.stringify(o),{{status:st,headers:Object.assign({{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','cache-control':'no-store'}},extra)}});
async function rates(cur){{
  const key=new Request('https://want.cache/rates/'+cur);const cache=caches.default;
  let r=await cache.match(key);
  if(!r){{const res=await fetch('https://open.er-api.com/v6/latest/'+cur);if(!res.ok)return null;const d=await res.json();if(d.result!=='success')return null;
    r=new Response(JSON.stringify({{ils:d.rates.ILS,at:d.time_last_update_utc}}),{{headers:{{'cache-control':'max-age=21600'}}}});await cache.put(key,r.clone())}}
  return r.json();
}}
async function product(u){{
  let target;try{{target=new URL(u)}}catch(e){{return J({{error:'bad_url'}},400)}}
  if(!/^https?:$/.test(target.protocol))return J({{error:'bad_url'}},400);
  const fopts={{headers:{{'user-agent':UA,'accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8','accept-language':'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7'}},redirect:'follow',cf:{{cacheTtl:900,cacheEverything:true}}}};
  let res;try{{res=await fetch(target.href,fopts)}}catch(e){{
    // some sites (seen on AliExpress) reject a fetch to a bare URL with no query string at all; a harmless one avoids it
    if(!target.search){{try{{res=await fetch(target.href+'?_w=1',fopts)}}catch(e2){{return J({{error:'fetch_failed'}},502)}}}}else return J({{error:'fetch_failed'}},502);
  }}
  const html=(await res.text()).slice(0,2000000);
  const d=extract(html,res.url||target.href);
  const blocked=res.status>=400||(!d.title&&!d.price&&!d.image)||(!d.price&&!d.image&&/denied|captcha|robot|blocked|forbidden|attention required|just a moment/i.test(d.title));
  if(blocked)return J({{error:'blocked',store:d.store}});
  if(d.price&&d.currency&&d.currency!=='ILS'){{try{{const r=await rates(d.currency);if(r&&r.ils){{d.priceILS=String(Math.round(parseFloat(d.price)*r.ils*100)/100);d.rateAt=r.at}}}}catch(e){{}}}}
  return J(d);
}}
const APP={json.dumps(app,ensure_ascii=False)};
const MANIFEST={json.dumps(manifest)};
const SW={json.dumps(sw)};
const I180='{i180}',I512='{i512}';
const png=b=>new Response(Uint8Array.from(atob(b),c=>c.charCodeAt(0)),{{headers:{{'content-type':'image/png','cache-control':'public, max-age=604800'}}}});
export default {{
  async fetch(req,env){{env=env||{{}};
    const url=new URL(req.url);
    if(req.method==='OPTIONS')return new Response(null,{{headers:{{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST','access-control-allow-headers':'authorization,content-type'}}}});
    switch(url.pathname){{
      case '/api/product':return product(url.searchParams.get('u')||'');
      case '/api/ping':case '/api/state':case '/api/ingest':case '/api/bank':case '/api/card':case '/api/ack':case '/api/reset-seen':return syncApi(req,env,url.pathname);
      case '/manifest.webmanifest':return new Response(MANIFEST,{{headers:{{'content-type':'application/manifest+json'}}}});
      case '/sw.js':return new Response(SW,{{headers:{{'content-type':'text/javascript','cache-control':'no-cache'}}}});
      case '/icon-180.png':return png(I180);
      case '/icon-512.png':return png(I512);
      default:return new Response(APP,{{headers:{{'content-type':'text/html; charset=utf-8','cache-control':'no-cache'}}}});
    }}
  }}
}};
"""
open('worker.js','w',encoding='utf-8').write(worker)
print(len(worker)//1024,'KB')
