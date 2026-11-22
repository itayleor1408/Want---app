import base64,io,json,hashlib
from PIL import Image,ImageDraw,ImageOps,ImageFilter,ImageChops
def lerp(a,b,t):return tuple(int(round(a[i]+(b[i]-a[i])*t)) for i in range(3))
def vgrad(w,h,top,bot):
    g=Image.linear_gradient('L').resize((w,h),Image.BICUBIC)           # black (top) -> white (bottom)
    return ImageOps.colorize(g,black=top,white=bot)
def icon(sz):
    # Penny's logo: the white piggy bank (assets/penny-pig.png, cut from the supplied artwork) centred on solid black.
    # Supersampled so the edges stay clean at every size; the phone applies its own rounded corners.
    S=4;W=sz*S
    img=Image.new('RGB',(W,W),(0,0,0))
    pig=Image.open('assets/penny-pig.png').convert('L')
    w=int(W*0.568);h=int(w*pig.height/pig.width)
    pig=pig.resize((w,h),Image.LANCZOS)
    img.paste((255,255,255),((W-w)//2,(W-h)//2),pig)
    return img.resize((sz,sz),Image.LANCZOS)
def b64(im):
    b=io.BytesIO();im.save(b,'PNG');return base64.b64encode(b.getvalue()).decode()
i180,i512=b64(icon(180)),b64(icon(512))
IV=hashlib.sha1(i180.encode()).hexdigest()[:6]  # icons are cached for a week: a fresh URL makes phones fetch a changed logo
app=open('want3.html',encoding='utf-8').read()
head_add='<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icon-180.png?v='+IV+'"><link rel="icon" type="image/png" href="/icon-180.png?v='+IV+'"><meta name="theme-color" content="#f4f4f6"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="apple-mobile-web-app-title" content="Penny.">'
app=app.replace('<title>Penny.</title>','<title>Penny.</title>'+head_add,1)
# Serve the Inter font from the app itself (not Google), so a slow or missing connection never blocks the page
FONT_LINK='<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&display=swap" rel="stylesheet">'
assert FONT_LINK in app
app=app.replace(FONT_LINK,'<link rel="preload" href="/inter.woff2" as="font" type="font/woff2" crossorigin><style>@font-face{font-family:Inter;font-style:normal;font-weight:500 900;font-display:swap;src:url(/inter.woff2) format("woff2")}</style>',1)
FONT=base64.b64encode(open('assets/inter-latin.woff2','rb').read()).decode()
# never ship a page whose script does not parse (a stray apostrophe would blank the whole app)
import re,subprocess,tempfile,os,shutil
if shutil.which('node'):
    js=max(re.findall(r'<script>(.*?)</script>',app,re.S),key=len)
    with tempfile.NamedTemporaryFile('w',suffix='.js',delete=False,encoding='utf-8') as f:f.write(js)
    r=subprocess.run(['node','--check',f.name],capture_output=True,text=True);os.unlink(f.name)
    if r.returncode:raise SystemExit('Syntax error in the page script - not building:\n'+r.stderr[:700])
# a short id of this exact page: the app asks /version to learn whether a newer build exists
BUILD=hashlib.sha1(app.encode('utf-8')).hexdigest()[:8]
app=app.replace('<script>','<script>window.WANT_API="/api";window.WANT_BUILD="'+BUILD+'";</script><script>',1)
extract=open('sync_api.js',encoding='utf-8').read()
manifest=json.dumps({"name":"Penny.","short_name":"Penny.","start_url":"/","display":"standalone","background_color":"#f4f4f6","theme_color":"#f4f4f6","icons":[{"src":"/icon-180.png?v="+IV,"sizes":"180x180","type":"image/png"},{"src":"/icon-512.png?v="+IV,"sizes":"512x512","type":"image/png","purpose":"any maskable"}]})
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
worker=f"""// Penny. — your own free link.
// HOW TO DEPLOY (free, about 2 minutes):
// 1. Go to dash.cloudflare.com and sign up / sign in (free plan is enough).
// 2. Workers & Pages -> Create -> Create Worker -> name it "want" -> Deploy.
// 3. Click "Edit code", delete everything, paste this whole file, then Deploy.
// 4. Open the address it gives you (https://want.<your-name>.workers.dev) in Safari on your iPhone,
//    tap Share -> Add to Home Screen.
// 5. (Optional, for Apple Pay + bank sync) In the worker: Settings -> Bindings -> Add -> KV namespace ->
//    create one called "want", variable name WANT_KV. Then Settings -> Variables and Secrets -> Add ->
//    type Secret, name WANT_TOKEN, value: a long random key you make up (keep it private). Deploy.
//    Put the same key in Penny. -> Settings -> Connections -> Sync key.
// Your data lives on your phone, in this app. To move data from the old link: Settings -> Copy backup there,
// then Settings -> Restore from backup here.

{extract}

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
      case '/api/ping':case '/api/state':case '/api/ingest':case '/api/bank':case '/api/card':case '/api/ack':case '/api/reset-seen':case '/api/join':case '/api/config':case '/api/google':case '/api/google-cb':case '/api/email-start':case '/api/email-verify':case '/api/backup':case '/api/forget':return syncApi(req,env,url.pathname);
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
