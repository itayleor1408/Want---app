import base64,io,json,hashlib
from PIL import Image,ImageDraw,ImageOps,ImageFilter,ImageChops
def lerp(a,b,t):return tuple(int(round(a[i]+(b[i]-a[i])*t)) for i in range(3))
def vgrad(w,h,top,bot):
    g=Image.linear_gradient('L').resize((w,h),Image.BICUBIC)           # black (top) -> white (bottom)
    return ImageOps.colorize(g,black=top,white=bot)
def icon(sz,bg_top=(30,31,36),bg_bot=(13,13,15),mint_top=(110,240,185),mint_bot=(34,176,122)):
    # A jar filled to the brim: white rim + lid, mint fill, soft graphite background. Supersampled 4x for clean edges.
    S=4;W=sz*S;u=W/100.0
    img=vgrad(W,W,bg_top,bg_bot).convert('RGBA')
    glow=Image.new('L',(W,W),0);ImageDraw.Draw(glow).ellipse([22*u,38*u,78*u,98*u],fill=70)
    glow=glow.filter(ImageFilter.GaussianBlur(14*u));img=Image.composite(Image.new('RGBA',(W,W),(52,208,150,255)),img,glow.point(lambda p:int(p*0.30)))
    cx=50;top=27;bx0,bx1=29,71;by0,by1=38,84;r=13
    clear=Image.new('RGBA',(W,W),(0,0,0,0))
    body=Image.new('L',(W,W),0);ImageDraw.Draw(body).rounded_rectangle([bx0*u,by0*u,bx1*u,by1*u],radius=r*u,fill=255)
    fy=by0+6.5
    fill=vgrad(W,W,mint_top,mint_bot).convert('RGBA')
    fm=Image.new('L',(W,W),0);ImageDraw.Draw(fm).rectangle([0,fy*u,W,W],fill=255)
    img.alpha_composite(Image.composite(fill,clear,ImageChops.multiply(body,fm)))
    sl=Image.new('L',(W,W),0);ImageDraw.Draw(sl).rectangle([0,fy*u,W,(fy+1.1)*u],fill=255)
    img.alpha_composite(Image.composite(Image.new('RGBA',(W,W),(220,255,240,150)),clear,ImageChops.multiply(body,sl)))
    gm=Image.new('L',(W,W),0);ImageDraw.Draw(gm).rectangle([0,0,W,fy*u],fill=255)
    img.alpha_composite(Image.composite(Image.new('RGBA',(W,W),(255,255,255,22)),clear,ImageChops.multiply(body,gm)))
    d=ImageDraw.Draw(img)
    d.rounded_rectangle([bx0*u,by0*u,bx1*u,by1*u],radius=r*u,outline=(242,243,247,235),width=int(3.1*u))
    d.rounded_rectangle([(cx-15)*u,(top+6)*u,(cx+15)*u,(by0+3)*u],radius=2*u,fill=(242,243,247,255))
    d.rounded_rectangle([(cx-18)*u,top*u,(cx+18)*u,(top+8)*u],radius=3.2*u,fill=(250,250,252,255))
    d.rounded_rectangle([(bx0+5.5)*u,(by0+12)*u,(bx0+7.9)*u,(by0+24)*u],radius=1.2*u,fill=(255,255,255,70))
    return img.resize((sz,sz),Image.LANCZOS).convert('RGB')
def b64(im):
    b=io.BytesIO();im.save(b,'PNG');return base64.b64encode(b.getvalue()).decode()
i180,i512=b64(icon(180)),b64(icon(512))
IV=hashlib.sha1(i180.encode()).hexdigest()[:6]  # icons are cached for a week: a fresh URL makes phones fetch a changed logo
app=open('want3.html',encoding='utf-8').read()
head_add='<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icon-180.png?v='+IV+'"><link rel="icon" type="image/png" href="/icon-180.png?v='+IV+'"><meta name="theme-color" content="#f4f4f6"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="apple-mobile-web-app-title" content="Brim.">'
app=app.replace('<title>Brim.</title>','<title>Brim.</title>'+head_add,1)
# Serve the Inter font from the app itself (not Google), so a slow or missing connection never blocks the page
FONT_LINK='<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&display=swap" rel="stylesheet">'
assert FONT_LINK in app
app=app.replace(FONT_LINK,'<link rel="preload" href="/inter.woff2" as="font" type="font/woff2" crossorigin><style>@font-face{font-family:Inter;font-style:normal;font-weight:500 900;font-display:swap;src:url(/inter.woff2) format("woff2")}</style>',1)
FONT=base64.b64encode(open('assets/inter-latin.woff2','rb').read()).decode()
# a short id of this exact page: the app asks /version to learn whether a newer build exists
BUILD=hashlib.sha1(app.encode('utf-8')).hexdigest()[:8]
app=app.replace('<script>','<script>window.WANT_API="/api/product";window.WANT_BUILD="'+BUILD+'";</script><script>',1)
extract=open('extract.js',encoding='utf-8').read()+'\n'+open('sync_api.js',encoding='utf-8').read()
manifest=json.dumps({"name":"Brim.","short_name":"Brim.","start_url":"/","display":"standalone","background_color":"#f4f4f6","theme_color":"#f4f4f6","icons":[{"src":"/icon-180.png?v="+IV,"sizes":"180x180","type":"image/png"},{"src":"/icon-512.png?v="+IV,"sizes":"512x512","type":"image/png","purpose":"any maskable"}]})
sw="""const C='want-v5';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['/','/manifest.webmanifest','/icon-180.png?v=IVX','/icon-512.png?v=IVX','/inter.woff2'])));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const q=e.request,u=new URL(q.url);if(q.method!=='GET')return;
if(u.origin!==location.origin||u.pathname.startsWith('/api/')||u.pathname==='/version'||u.searchParams.has('b'))return;
const nav=q.mode==='navigate',key=nav?'/':q;
const net=fetch(q).then(r=>{if(r.ok){const cp=r.clone();caches.open(C).then(c=>c.put(key,cp))}return r});
e.waitUntil(net.then(()=>{},()=>{}));
e.respondWith(caches.match(key,{ignoreSearch:nav}).then(h=>h||net.catch(()=>caches.match('/'))))});"""
sw=sw.replace('IVX',IV)
worker=f"""// Brim. — your own free link, with automatic product reading.
// HOW TO DEPLOY (free, about 2 minutes):
// 1. Go to dash.cloudflare.com and sign up / sign in (free plan is enough).
// 2. Workers & Pages -> Create -> Create Worker -> name it "want" -> Deploy.
// 3. Click "Edit code", delete everything, paste this whole file, then Deploy.
// 4. Open the address it gives you (https://want.<your-name>.workers.dev) in Safari on your iPhone,
//    tap Share -> Add to Home Screen. Pasting a product link now fills name, photo and price.
// 5. (Optional, for Apple Pay + bank sync) In the worker: Settings -> Bindings -> Add -> KV namespace ->
//    create one called "want", variable name WANT_KV. Then Settings -> Variables and Secrets -> Add ->
//    type Secret, name WANT_TOKEN, value: a long random key you make up (keep it private). Deploy.
//    Put the same key in Brim. -> Settings -> Connections -> Sync key.
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
const BUILD='{BUILD}';
const APP={json.dumps(app,ensure_ascii=False)};
const MANIFEST={json.dumps(manifest)};
const SW={json.dumps(sw)};
const I180='{i180}',I512='{i512}',FONT='{FONT}';
const png=b=>new Response(Uint8Array.from(atob(b),c=>c.charCodeAt(0)),{{headers:{{'content-type':'image/png','cache-control':'public, max-age=604800'}}}});
export default {{
  async fetch(req,env){{env=env||{{}};
    const url=new URL(req.url);
    if(req.method==='OPTIONS')return new Response(null,{{headers:{{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST','access-control-allow-headers':'authorization,content-type'}}}});
    switch(url.pathname){{
      case '/api/product':return product(url.searchParams.get('u')||'');
      case '/api/ping':case '/api/state':case '/api/ingest':case '/api/bank':case '/api/card':case '/api/ack':case '/api/reset-seen':case '/api/wish':return syncApi(req,env,url.pathname);
      case '/manifest.webmanifest':return new Response(MANIFEST,{{headers:{{'content-type':'application/manifest+json'}}}});
      case '/version':return new Response(BUILD,{{headers:{{'content-type':'text/plain','cache-control':'no-store'}}}});
      case '/sw.js':return new Response(SW,{{headers:{{'content-type':'text/javascript','cache-control':'no-cache'}}}});
      case '/icon-180.png':return png(I180);
      case '/icon-512.png':return png(I512);
      case '/inter.woff2':return new Response(Uint8Array.from(atob(FONT),c=>c.charCodeAt(0)),{{headers:{{'content-type':'font/woff2','cache-control':'public, max-age=31536000'}}}});
      default:return new Response(APP,{{headers:{{'content-type':'text/html; charset=utf-8','cache-control':'no-cache'}}}});
    }}
  }}
}};
"""
open('worker.js','w',encoding='utf-8').write(worker)
print(len(worker)//1024,'KB')
