import base64,io,json,hashlib
from PIL import Image,ImageDraw,ImageOps,ImageFilter,ImageChops
def lerp(a,b,t):return tuple(int(round(a[i]+(b[i]-a[i])*t)) for i in range(3))
def vgrad(w,h,top,bot):
    g=Image.linear_gradient('L').resize((w,h),Image.BICUBIC)           # black (top) -> white (bottom)
    return ImageOps.colorize(g,black=top,white=bot)
def icon(sz,top=(229,92,82),bot=(217,78,45)):
    # Penny: a white piggy bank on a warm coral gradient. Drawn on a 100-unit grid, supersampled 4x for clean edges.
    S=4;W=sz*S;u=W/100.0
    img=vgrad(W,W,top,bot).convert('RGBA')
    hl=Image.new('L',(W,W),0);ImageDraw.Draw(hl).ellipse([-20*u,-40*u,120*u,45*u],fill=60)
    hl=hl.filter(ImageFilter.GaussianBlur(18*u));img=Image.composite(Image.new('RGBA',(W,W),(255,150,120,255)),img,hl.point(lambda p:int(p*0.35)))
    pig=Image.new('L',(W,W),0);g=ImageDraw.Draw(pig)
    def E(x0,y0,x1,y1):g.ellipse([x0*u,y0*u,x1*u,y1*u],fill=255)
    def R(x0,y0,x1,y1,r):g.rounded_rectangle([x0*u,y0*u,x1*u,y1*u],radius=r*u,fill=255)
    E(21,35,83,78)                      # body
    E(12,47,34,67)                      # snout
    ear=[(35*u,44*u),(41*u,32*u),(54*u,40*u)]                  # ear: a triangle with softly rounded corners
    g.polygon(ear,fill=255);g.line(ear+[ear[0]],fill=255,width=int(5*u),joint='curve')
    for x,y in ear:g.ellipse([x-2.5*u,y-2.5*u,x+2.5*u,y+2.5*u],fill=255)
    R(30,68,44,86,5);R(58,68,72,86,5)   # legs
    g.arc([76*u,44*u,92*u,60*u],start=-70,end=110,fill=255,width=int(3.2*u))  # tail
    img.alpha_composite(Image.composite(Image.new('RGBA',(W,W),(255,255,255,255)),Image.new('RGBA',(W,W),(0,0,0,0)),pig))
    d=ImageDraw.Draw(img)
    mid=tuple(int((a+b)/2) for a,b in zip(top,bot))+(255,)
    d.rounded_rectangle([42*u,39.5*u,67*u,44.5*u],radius=2.5*u,fill=mid)   # coin slot
    d.ellipse([25*u,52*u,29.6*u,56.6*u],fill=mid)                           # eye
    d.ellipse([15.5*u,56*u,17.5*u,58*u],fill=mid);d.ellipse([19*u,57*u,21*u,59*u],fill=mid)  # nostrils
    return img.resize((sz,sz),Image.LANCZOS).convert('RGB')
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
