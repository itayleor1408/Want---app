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
sw="""const C='want-v3',F='want-fonts-v1';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['/','/manifest.webmanifest','/icon-180.png','/icon-512.png'])));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C&&x!==F).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const q=e.request,u=new URL(q.url);if(q.method!=='GET')return;
if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com'){e.respondWith(caches.open(F).then(c=>c.match(q).then(h=>h||fetch(q).then(r=>{if(r.ok)c.put(q,r.clone());return r}))));return}
if(u.origin!==location.origin||u.pathname.startsWith('/api/'))return;
const nav=q.mode==='navigate',key=nav?'/':q;
const net=fetch(q).then(r=>{if(r.ok){const cp=r.clone();caches.open(C).then(c=>c.put(key,cp))}return r});
e.waitUntil(net.then(()=>{},()=>{}));
e.respondWith(caches.match(key,{ignoreSearch:nav}).then(h=>h||net.catch(()=>caches.match('/'))))});"""
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
// Several stores answer differently depending on who asks: try a phone, then a desktop browser, then a link-preview
// reader (what chat apps use to show a link's photo and title), and keep the first good value found for each field.
const UAS=[UA,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36','facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'];
const BAD_TITLE=/denied|captcha|robot|blocked|forbidden|attention required|just a moment|page not found|error page|^amazon\\.com$/i;
async function productData(u){{
  let target;try{{target=new URL(u)}}catch(e){{return{{error:'bad_url'}}}}
  if(!/^https?:$/.test(target.protocol))return{{error:'bad_url'}};
  const out={{title:'',image:'',price:'',currency:'',store:'',brand:''}};let finalUrl=target.href;
  const merge=d=>{{if(!d)return;if(d.title&&BAD_TITLE.test(d.title))d.title='';for(const k in out)if(!out[k]&&d[k])out[k]=d[k];if(d.price&&!out.currency&&d.currency)out.currency=d.currency}};
  const done=()=>out.title&&out.price&&out.image;
  for(const ua of UAS){{
    const fopts={{headers:{{'user-agent':ua,'accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8','accept-language':'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7'}},redirect:'follow',cf:{{cacheTtl:900,cacheEverything:true}}}};
    let res;try{{res=await fetch(target.href,fopts)}}catch(e){{
      // some sites (seen on AliExpress) reject a fetch to a bare URL with no query string at all; a harmless one avoids it
      if(!target.search){{try{{res=await fetch(target.href+'?_w=1',fopts)}}catch(e2){{continue}}}}else continue;
    }}
    if(res.status>=400)continue;
    finalUrl=res.url||target.href;
    const html=(await res.text()).slice(0,2000000);
    merge(extract(html,finalUrl));
    // Shopify stores (a big share of small shops) publish every product as clean JSON at <product url>.js
    if(!done()&&/\\/products\\/[^/?#]+/.test(new URL(finalUrl).pathname)&&/shopify/i.test(html)){{
      try{{const p=new URL(finalUrl);const r=await fetch(p.origin+p.pathname.replace(/\\/$/,'')+'.js',{{headers:{{'user-agent':ua,accept:'application/json'}}}});
        if(r.ok){{const j=await r.json();const img=j.featured_image||(j.images&&j.images[0])||'';
          out.title=j.title||out.title;if(j.price)out.price=String(j.price/100);if(img&&!out.image)out.image=img.startsWith('//')?'https:'+img:img;
          if(!out.currency){{const c=html.match(/Shopify\\.currency\\s*=\\s*\\{{[^}}]*"active"\\s*:\\s*"([A-Z]{{3}})"/);if(c)out.currency=c[1]}}}}}}catch(e){{}}
    }}
    if(done())break;
  }}
  if(!out.title&&!out.price&&!out.image)return{{error:'blocked',store:out.store}};
  if(out.price&&out.currency&&out.currency!=='ILS'){{try{{const r=await rates(out.currency);if(r&&r.ils){{out.priceILS=String(Math.round(parseFloat(out.price)*r.ils*100)/100);out.rateAt=r.at}}}}catch(e){{}}}}
  return out;
}}
async function product(u){{const d=await productData(u);return J(d,d.error=='bad_url'?400:200)}}
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
      case '/api/ping':case '/api/state':case '/api/ingest':case '/api/bank':case '/api/card':case '/api/ack':case '/api/reset-seen':case '/api/wish':return syncApi(req,env,url.pathname);
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
