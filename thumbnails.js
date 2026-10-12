// Fetch public preview metadata only when a thumbnail approaches the viewport.
(()=>{
 const cache=new Map(),pending=new Map(),bindings=new WeakMap(),waiting=new Map(),queue=[];let running=0;
 const routes=[x=>x,x=>'https://corsproxy.io/?url='+encodeURIComponent(x),x=>'https://api.allorigins.win/raw?url='+encodeURIComponent(x)];
 function imageUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
 function extract(text){
  try{const data=JSON.parse(text),url=imageUrl(data.thumbnail_url);if(url)return url;}catch{}
  const doc=new DOMParser().parseFromString(text,'text/html');
  for(const name of ['og:image','twitter:image']){const url=imageUrl(doc.querySelector('meta[property="'+name+'"],meta[name="'+name+'"]')?.content);if(url)return url;}
  const embedded=imageUrl(doc.querySelector('img.EmbeddedMediaImage,link[rel="image_src"]')?.getAttribute('src')||doc.querySelector('link[rel="image_src"]')?.href);if(embedded)return embedded;
  const decoded=text.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/\\+"/g,'"');
  for(const key of ['thumbnail_url','display_url','thumbnail_src','cover','originCover']){
   const match=decoded.match(new RegExp('"'+key+'"\\s*:\\s*"((?:\\\\.|[^"\\\\])+)"'));
   if(match){try{const value=JSON.parse('"'+match[1]+'"').replace(/\\+\//g,'/').replace(/\\+u0026/gi,'&'),url=imageUrl(value);if(url)return url;}catch{}}
  }
  throw Error('No public preview');
 }
 async function metadata(video){
  let url=video.url;
  if(video.platform==='tiktok'&&['vt.tiktok.com','vm.tiktok.com'].includes(new URL(url).hostname)){
   const {resolveTikTokLink}=await import('./media-links.js?v=tiktok-short-1');url=await resolveTikTokLink(url);
  }
  const sources=video.platform==='tiktok'?['https://www.tiktok.com/oembed?url='+encodeURIComponent(url)]:[url.replace(/\/$/,'')+'/embed/captioned/',url];
  for(const source of sources){
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
   try{return await Promise.any(routes.map(async route=>{const r=await fetch(route(source),{signal:controller.signal,credentials:'omit'});if(!r.ok)throw Error('Preview unavailable');return extract(await r.text());}));}
   catch{}finally{clearTimeout(timeout);controller.abort();}
  }
  throw Error('Preview unavailable');
 }
 function resolve(video){const key=video.key||video.url,cached=cache.get(key);if(cached&&cached.expires>Date.now())return Promise.resolve(cached.url);
  if(pending.has(key))return pending.get(key);
  const job=metadata(video).then(url=>{cache.set(key,{url,expires:Date.now()+20*60*1000});return url;}).catch(()=>{cache.set(key,{url:null,expires:Date.now()+60000});return null;}).finally(()=>pending.delete(key));pending.set(key,job);return job;
 }
 function drain(){while(running<3&&queue.length){const task=queue.shift();if(!task.target.isConnected||bindings.get(task.image)!==task.token)continue;running++;
  resolve(task.video).then(url=>{if(url&&task.target.isConnected&&bindings.get(task.image)===task.token)paint(task,url);}).finally(()=>{running--;drain();});
 }}
 function paint(task,url){const {image,holder,token}=task;let proxied=false;
  image.onload=()=>{if(bindings.get(image)!==token)return;image.hidden=false;holder?.querySelector('.placeholder-symbol')?.remove();};
  image.onerror=()=>{if(bindings.get(image)!==token)return;if(!proxied){proxied=true;image.src='https://images.weserv.nl/?url='+encodeURIComponent(url);return;}image.hidden=true;cache.set(task.video.key||task.video.url,{url:null,expires:Date.now()+60000});};
  image.src=url;
 }
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){const task=waiting.get(e.target);waiting.delete(e.target);observer.unobserve(e.target);if(task)queue.push(task);}drain();},{rootMargin:'200px'}):null;
 function bind(video,image,holder){
  const token={},target=holder||image.parentElement;bindings.set(image,token);image.onload=image.onerror=null;image.hidden=true;image.removeAttribute('src');
  if(!target||!['instagram','tiktok'].includes(video.platform))return;
  image.alt='تصویر بندانگشتی '+video.platform;image.decoding='async';image.referrerPolicy='no-referrer';
  const task={video,image,holder,target,token};
  // Renders replace old bracket nodes; release observer references to those nodes.
  queueMicrotask(()=>{for(const node of waiting.keys())if(!node.isConnected){observer?.unobserve(node);waiting.delete(node);}});
  if(observer){waiting.set(target,task);observer.observe(target);}else{queue.push(task);requestAnimationFrame(drain);}
 }
 function release(image){bindings.delete(image);image.onload=image.onerror=null;const target=image.parentElement;if(waiting.get(target)?.image===image){waiting.delete(target);observer?.unobserve(target);}}
 window.ChatBattleThumbnails={attach(video,holder){const image=document.createElement('img');holder.append(image);bind(video,image,holder);},bind,release};
})();
