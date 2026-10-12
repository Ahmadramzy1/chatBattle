// Canonicalize public TikTok share links before submission; saved links still obey existing Firestore rules.
const cache=new Map();
function canonical(value){try{const u=new URL(value);if(u.protocol!=='https:'||!['www.tiktok.com','tiktok.com'].includes(u.hostname)||u.username||u.password)return null;const m=u.pathname.match(/^\/@([\w.-]+)\/video\/(\d{12,25})/);return m?'https://www.tiktok.com/@'+m[1]+'/video/'+m[2]:null;}catch{return null;}}
function extract(text){const h=text.replace(/\\+u0026/g,'&').replace(/\\+\//g,'/').replace(/&quot;/g,'"').replace(/&amp;/g,'&');const candidates=h.match(/https:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d{12,25}/g)||[];for(const candidate of candidates){const u=canonical(candidate);if(u)return u;}try{const d=JSON.parse(text),id=String(d.video_id||d.embed_product_id||'').match(/^\d{12,25}$/)?.[0],user=new URL(d.author_url).pathname.match(/^\/@([\w.-]+)/)?.[1];if(id&&user)return canonical('https://www.tiktok.com/@'+user+'/video/'+id);}catch{}throw Error('لینک اصلی TikTok پیدا نشد؛ لینک کامل ویدیو را وارد کن.');}
export async function resolveTikTokLink(raw,{signal}={}){
 const u=new URL(String(raw).trim());const direct=canonical(u.href);if(direct)return direct;
 if(u.protocol!=='https:'||u.username||u.password||!['vt.tiktok.com','vm.tiktok.com'].includes(u.hostname)||!/^\/[\w-]+\/?$/.test(u.pathname))throw Error('لینک TikTok نامعتبر است.');
 const short=u.origin+u.pathname;if(cache.has(short))return cache.get(short);
 if(signal?.aborted)throw Error('cancelled');const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});const timeout=setTimeout(abort,10000);
 const urls=['https://www.tiktok.com/oembed?url='+encodeURIComponent(short),short],routes=[x=>x,x=>'https://corsproxy.io/?url='+encodeURIComponent(x),x=>'https://api.allorigins.win/raw?url='+encodeURIComponent(x),x=>'https://api.codetabs.com/v1/proxy?quest='+encodeURIComponent(x)];
 try{const result=await Promise.any(urls.flatMap(url=>routes.map(async route=>{const r=await fetch(route(url),{signal:controller.signal,credentials:'omit'});if(!r.ok)throw Error('resolver response');const redirected=canonical(r.url);return redirected||extract(await r.text());})));cache.set(short,result);return result;}
 catch{throw Error('باز کردن لینک کوتاه TikTok ناموفق بود؛ لینک کامل ویدیو را بفرست.');}
 finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);controller.abort();}
}
