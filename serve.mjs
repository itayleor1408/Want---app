// Local dev server: runs the built worker.js on plain Node, with fetch() and KV mocked.
// Usage: node serve.mjs   (then open http://localhost:8787)
import http from 'node:http';
const FIX={
 'https://www.ikea.com/il/he/p/billy-bookcase-white-00263850/':`<html><head><title>BILLY Bookcase, white - IKEA</title><script type="application/ld+json">{"@type":"Product","name":"BILLY Bookcase, white","image":["https://picsum.invalid/billy.jpg"],"offers":{"@type":"Offer","price":"249","priceCurrency":"ILS"}}</script></head></html>`,
 'https://www.shop.com/lamp':`<meta property="og:title" content="Desk Lamp | Shop"><meta property="og:site_name" content="Shop"><meta property="product:price:amount" content="40"><meta property="product:price:currency" content="USD">`,
 'https://www.blocked.com/x':`<title>Access denied</title>`};
const realFetch=globalThis.fetch;
globalThis.fetch=async(u,o)=>{u=String(u);if(u.startsWith('https://oauth2.googleapis.com/tokeninfo')){const t=decodeURIComponent(u.split('id_token=')[1]);return t.startsWith('good-')?new Response(JSON.stringify({aud:'test-client',iss:'https://accounts.google.com',exp:String(Date.now()/1000+3600),sub:t.slice(5),email:t.slice(5)+'@example.com'})):new Response('{}',{status:400})}if(u.includes('open.er-api.com'))return new Response(JSON.stringify({result:'success',rates:{ILS:3.7},time_last_update_utc:'today'}));const h=FIX[u];return new Response(h||'nope',{status:h?(u.includes('blocked')?403:200):404})};
const store=new Map();globalThis.caches={default:{match:async r=>store.get(r.url)?.clone(),put:async(r,v)=>{store.set(r.url,v)}}};
const mod=await import('./worker.js');
const kv=new Map();const ENV={WANT_TOKEN:'test-key-123456',GOOGLE_CLIENT_ID:'test-client',WANT_KV:{get:async k=>kv.has(k)?kv.get(k):null,put:async(k,v)=>{kv.set(k,v)},delete:async k=>{kv.delete(k)}}};
http.createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);const r=await mod.default.fetch(new Request('http://localhost:8787'+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:body}),ENV);res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()))}).listen(8787,()=>console.log('up'));
