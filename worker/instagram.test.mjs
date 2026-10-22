import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
const env={SITE_ORIGIN:'https://example.com',KICK_CLIENT_SECRET:'test-only-instagram-secret'};
const call=url=>worker.fetch(new Request('https://worker.example/media/instagram',{method:'POST',headers:{Origin:env.SITE_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({url})}),env);
test('Instagram metadata is resolved on the server and playable through a signed, range-aware stream',async()=>{
 const original=globalThis.fetch;let requests=[];
 globalThis.fetch=async(url,options={})=>{requests.push({url,options});
  if(new URL(url).hostname.endsWith('cdninstagram.com'))return new Response('video',{status:206,headers:{'Content-Type':'video/mp4','Content-Range':'bytes 0-4/5','Accept-Ranges':'bytes'}});
  return new Response('<meta content="https://video.cdninstagram.com/public.mp4?x=1&amp;y=2" property="og:video"><meta property="og:image" content="https://image.cdninstagram.com/cover.jpg">');
 };
 try{
  const r=await call('https://www.instagram.com/reels/Deyg8LuIjW-/');assert.equal(r.status,200);const data=await r.json();assert.match(data.playUrl,/^https:\/\/worker.example\/media\/instagram\/stream\?ticket=/);assert.equal(data.poster,'https://image.cdninstagram.com/cover.jpg');
  const v=await worker.fetch(new Request(data.playUrl,{headers:{Range:'bytes=0-4'}}),env);assert.equal(v.status,206);assert.equal(v.headers.get('Content-Range'),'bytes 0-4/5');assert.equal(await v.text(),'video');assert.equal(requests.at(-1).options.headers.Range,'bytes=0-4');assert.equal(requests.at(-1).options.headers.Cookie,undefined);
  const bad=new URL(data.playUrl);bad.searchParams.set('ticket',bad.searchParams.get('ticket')+'x');assert.equal((await worker.fetch(new Request(bad),env)).status,403);
 }finally{globalThis.fetch=original}
});
test('Instagram routes reject arbitrary URLs, private media destinations and redirects before signing',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('<meta property="og:video" content="https://127.0.0.1/private.mp4">')};
 try{assert.equal((await call('https://evil.example/reel/ABCDE/')).status,400);assert.equal(calls,0);assert.equal((await call('https://instagram.com/reel/ABCDE/')).status,422);assert.ok(calls>0);
  globalThis.fetch=async()=>new Response('',{status:302,headers:{Location:'https://evil.example/private'}});assert.equal((await call('https://instagram.com/reel/FGHIJ/')).status,422);
 }finally{globalThis.fetch=original}
});
test('Login-only pages return an explicit unavailable result rather than a fake playable source',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('<html><form>Log in to Instagram</form></html>');
 try{const r=await call('https://instagram.com/reel/KLMNO/');assert.equal(r.status,422);assert.equal((await r.json()).error,'instagram_unavailable')}
 finally{globalThis.fetch=original}
});
test('Metadata parsing accepts public video JSON, rejects bad origins and caps upstream bodies',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response('{"video_url":"https:\\/\\/video.cdninstagram.com\\/clip.mp4?one=1\\u0026two=2"}')};
 try{
  const bad=new Request('https://worker.example/media/instagram',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({url:'https://instagram.com/reel/PQRST/'})});assert.equal((await worker.fetch(bad,env)).status,403);assert.equal(calls,0);
  assert.equal((await call('https://instagram.com/reel/PQRST/')).status,200);
  globalThis.fetch=async()=>new Response('x'.repeat(512*1024+1));assert.equal((await call('https://instagram.com/reel/UVWXY/')).status,422);
 }finally{globalThis.fetch=original}
});
test('A failed CDN stream reports the upstream status without exposing its URL',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async url=>new URL(url).hostname.endsWith('cdninstagram.com')?new Response('denied',{status:403}):new Response('<meta property="og:video" content="https://video.cdninstagram.com/diagnostic.mp4">');
 try{const media=await (await call('https://instagram.com/reel/DIAGN/')).json();const r=await worker.fetch(new Request(media.playUrl),env);assert.equal(r.status,502);assert.equal(r.headers.get('X-Instagram-Error'),'upstream_http_403');assert.deepEqual(await r.json(),{error:'upstream_http_403'})}
 finally{globalThis.fetch=original}
});

