import {test} from 'node:test';
import assert from 'node:assert/strict';
test('Instagram client uses only the configured backend and normalizes reels',async()=>{
 const {resolveInstagram}=await import('./instagram-media.mjs');let request;
 const media=await resolveInstagram('https://instagram.com/reels/Deyg8LuIjW-/',{base:'https://media.example',fetcher:async(url,options)=>{request={url,options};return Response.json({playUrl:'https://media.example/media/instagram/stream?ticket=valid',poster:null})}});
 assert.equal(request.url,'https://media.example/media/instagram');assert.equal(JSON.parse(request.options.body).url,'https://www.instagram.com/reel/Deyg8LuIjW-/');assert.equal(request.options.credentials,'omit');assert.equal(media.playUrl,'https://media.example/media/instagram/stream?ticket=valid');
});
test('Instagram client rejects untrusted media response and gives actionable errors',async()=>{
 const {resolveInstagram}=await import('./instagram-media.mjs');
 await assert.rejects(resolveInstagram('https://instagram.com/reel/ABCDE/',{base:'https://media.example',fetcher:async()=>Response.json({playUrl:'https://evil.example/tracker'})}),/invalid_media_response/);
 await assert.rejects(resolveInstagram('https://instagram.com/reel/ABCDE/',{base:'https://media.example',fetcher:async()=>Response.json({error:'instagram_unavailable'},{status:422})}),/instagram_unavailable/);
});

