// Anonymous public chat. Native Centrifugo JSON protocol; no OAuth or Pusher key.
(()=>{
 const worker='https://chatbattle-auth.amarez-editing.workers.dev';
 function connect({channel,onState=()=>{},onMessage=()=>{}}){
  const clientId=crypto.randomUUID();let stopped=false,socket=null,controller=null,attempt=0,generation=0,retryTimer,heartbeatTimer,refreshTimer,deadlineTimer;
  let commandId=0,pingMs=35000,needsPong=false,roomChannel='',commands=new Map();
  const emit=(state,message)=>{if(!stopped)onState(state,message);};
  const clearTimers=()=>{clearTimeout(heartbeatTimer);clearTimeout(refreshTimer);clearTimeout(deadlineTimer);};
  async function api(path,body,signal){
   const response=await fetch(worker+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
   let data;try{data=await response.json();}catch{throw Error('پاسخ سرویس چت معتبر نیست.');}
   if(!response.ok)throw Error(response.status===404?'Worker چت هنوز به نسخهٔ جدید ارتقا پیدا نکرده است.':data.error||'خطای سرویس چت '+response.status);
   return data;
  }
  function retry(token,message){
   if(stopped||token!==generation)return;generation++;clearTimers();controller?.abort();commands.clear();
   const old=socket;socket=null;if(old){old.onopen=old.onmessage=old.onclose=old.onerror=null;try{old.close();}catch{}}
   emit('disconnected',message||'اتصال قطع شد؛ تلاش دوباره…');
   clearTimeout(retryTimer);retryTimer=setTimeout(start,Math.min(15000,800*2**Math.min(attempt++,4))+Math.random()*400);
  }
  async function start(){
   if(stopped)return;const token=++generation;controller?.abort();controller=new AbortController();const signal=controller.signal;
   emit('connecting','در حال اتصال به چت Kick…');
   deadlineTimer=setTimeout(()=>retry(token,'دریافت اتصال چت بیش از حد طول کشید.'),40000);
   try{
    const config=await api('/chat/bootstrap',{channel,clientId},signal);if(stopped||token!==generation)return;
    if(config.provider!=='centrifugo'||!Number.isSafeInteger(config.roomId)||config.roomId<=0)throw Error('تنظیمات اتصال چت نامعتبر است.');
    const url=new URL(config.url);if(url.protocol!=='wss:'||!url.hostname.endsWith('.platform.kick.com'))throw Error('آدرس اتصال چت نامعتبر است.');
    roomChannel='chatrooms.'+config.roomId+'.v2';commands=new Map();commandId=0;
    const relay=new URL(worker+'/chat/socket');relay.protocol='wss:';relay.searchParams.set('host',url.hostname);
    const ws=new WebSocket(relay.href);socket=ws;
    const current=()=>!stopped&&token===generation&&socket===ws;
    const send=(type,data,callback)=>{if(!current()||ws.readyState!==WebSocket.OPEN)return;const id=++commandId;commands.set(id,callback);ws.send(JSON.stringify({id,[type]:data}));};
    const alive=()=>{clearTimeout(heartbeatTimer);heartbeatTimer=setTimeout(()=>retry(token,'چت پاسخ نمی‌دهد؛ اتصال دوباره…'),pingMs);};
    function renew(result){
     clearTimeout(refreshTimer);if(!result.expires||!Number.isFinite(result.ttl))return;
     refreshTimer=setTimeout(async()=>{try{const auth=await api('/chat/token',{clientId},signal);if(current())send('refresh',{token:auth.token},renew);}catch(error){if(current())retry(token,error.message);}},Math.max(1000,(result.ttl-20)*1000));
    }
    function publication(pub){
     let envelope=pub?.data;if(typeof envelope==='string')try{envelope=JSON.parse(envelope);}catch{return;}
     if(!envelope?.event?.endsWith('ChatMessageEvent'))return;
     let data=envelope.data;if(typeof data==='string')try{data=JSON.parse(data);}catch{return;}
     if(typeof data?.content!=='string')return;
     onMessage({content:data.content,username:String(data.sender?.username||data.sender?.slug||data.sender?.id||''),id:data.id??data.message_id,time:data.created_at,kickId:data.sender?.id});
    }
    ws.onopen=()=>{if(current())send('connect',{token:config.token,name:'js'},result=>{
     needsPong=!!result.pong;pingMs=result.ping>0?(result.ping+10)*1000:45000;alive();renew(result);
     send('subscribe',{channel:roomChannel},()=>{clearTimeout(deadlineTimer);attempt=0;emit('connected','Kick Live');});
    });};
    ws.onmessage=event=>{
     if(!current())return;alive();
     for(const line of String(event.data).trim().split('\n')){
      let reply;try{reply=JSON.parse(line);}catch{continue;}
      if(!Object.keys(reply).length){if(needsPong)ws.send('{}');continue;}
      if(reply.id){const callback=commands.get(reply.id);commands.delete(reply.id);if(reply.error){retry(token,'خطای چت '+reply.error.code+': '+reply.error.message);return;}const value=reply.connect||reply.subscribe||reply.refresh;if(callback&&value)callback(value);}
      else if(reply.push){const push=reply.push;if(push.disconnect||push.unsubscribe&&push.channel===roomChannel){retry(token,'اتصال چت نیاز به تمدید دارد.');return;}if(push.channel===roomChannel&&push.pub)publication(push.pub);}
     }
    };
    ws.onerror=()=>{if(current())retry(token,'خطای شبکهٔ چت؛ اتصال دوباره…');};
    ws.onclose=event=>{if(current())retry(token,'اتصال چت قطع شد ('+event.code+').');};
   }catch(error){if(!stopped&&token===generation)retry(token,error.message);}
  }
  start();
  return {close(){if(stopped)return;stopped=true;generation++;clearTimeout(retryTimer);clearTimers();controller?.abort();commands.clear();if(socket){socket.onopen=socket.onmessage=socket.onerror=socket.onclose=null;try{socket.close();}catch{}socket=null;}}};
 }
 window.ChatBattleRealtime={connect};
})();
