import { KICK_AUTH_API } from './kick-config.js';

// One attempt includes both metadata resolution and actual video readiness.
export async function tryInstagramPlayback(attempt,{signal}={}){
 let error;
 for(let number=1;number<=3;number++){
  if(signal?.aborted)throw new DOMException('Playback cancelled','AbortError');
  try{await attempt(number);if(signal?.aborted)throw new DOMException('Playback cancelled','AbortError');return {ok:true,attempts:number}}
  catch(e){if(signal?.aborted)throw new DOMException('Playback cancelled','AbortError');error=e}
 }
 return {ok:false,attempts:3,error};
}

export async function resolveInstagram(raw,{signal,base=KICK_AUTH_API,fetcher=fetch}={}){
 const url=new URL(raw),parts=url.pathname.match(/^\/(reel|reels|p|tv)\/([A-Za-z0-9_-]{5,40})\/?$/);
 if(url.protocol!=='https:'||url.username||url.password||!['instagram.com','www.instagram.com','m.instagram.com'].includes(url.hostname)||!parts)throw Error('invalid_instagram_url');
 const endpoint=new URL('/media/instagram',base),kind=parts[1]==='reels'?'reel':parts[1];
 const response=await fetcher(endpoint.href,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',body:JSON.stringify({url:'https://www.instagram.com/'+kind+'/'+parts[2]+'/'}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(13000)]):AbortSignal.timeout(13000)});
 if(!response.ok){let error;try{error=(await response.json()).error}catch{}throw Error(['instagram_unavailable','media_busy'].includes(error)?error:'media_service_unavailable')}
 const data=await response.json(),play=new URL(data.playUrl);
 if(play.origin!==endpoint.origin||play.pathname!=='/media/instagram/stream'||!play.searchParams.get('ticket'))throw Error('invalid_media_response');
 return {playUrl:play.href,poster:typeof data.poster==='string'&&data.poster.startsWith('https://')?data.poster:null};
}

