// Cloudflare Workers Free. No npm dependencies or database bindings required.
const enc=new TextEncoder();
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const encode=value=>b64(enc.encode(JSON.stringify(value)));
const sha=async value=>b64(await crypto.subtle.digest('SHA-256',enc.encode(value)));
async function stateKey(secret){return crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function makeState(challenge,env){
  const payload=encode({challenge,exp:Math.floor(Date.now()/1000)+600,nonce:b64(crypto.getRandomValues(new Uint8Array(24)))});
  const signature=await crypto.subtle.sign('HMAC',await stateKey(env.KICK_CLIENT_SECRET),enc.encode(payload));
  return payload+'.'+b64(signature);
}
async function checkState(state,verifier,env){
  if(typeof state!=='string'||state.length>1024||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(state))throw Error('state');
  const [payload,signature]=state.split('.');
  if(!await crypto.subtle.verify('HMAC',await stateKey(env.KICK_CLIENT_SECRET),unb64(signature),enc.encode(payload)))throw Error('signature');
  const data=JSON.parse(new TextDecoder().decode(unb64(payload))),now=Math.floor(Date.now()/1000);
  if(!Number.isInteger(data.exp)||data.exp<=now||data.exp>now+600||data.challenge!==await sha(verifier))throw Error('expired or wrong verifier');
}
let cachedAccount,cachedSigningKey;
async function firebaseToken(user,env){
  if(cachedAccount!==env.FIREBASE_SERVICE_ACCOUNT){
    const account=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
    if(account.project_id!==env.FIREBASE_PROJECT_ID||account.type!=='service_account'||!account.client_email||!account.private_key)throw Error('Firebase configuration');
    const pem=account.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'');
    const key=await crypto.subtle.importKey('pkcs8',unb64(pem),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
    cachedSigningKey={key,email:account.client_email};cachedAccount=env.FIREBASE_SERVICE_ACCOUNT;
  }
  const now=Math.floor(Date.now()/1000),id=String(user.user_id);
  const payload={iss:cachedSigningKey.email,sub:cachedSigningKey.email,aud:'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',iat:now,exp:now+300,uid:'kick:'+id,claims:{kick_verified:true,kick_id:id,kick_name:user.name}};
  const unsigned=encode({alg:'RS256',typ:'JWT'})+'.'+encode(payload);
  return unsigned+'.'+b64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',cachedSigningKey.key,enc.encode(unsigned)));
}
async function readBody(request){
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error('content type');
  const reader=request.body?.getReader();if(!reader)throw Error('body');
  let size=0;const chunks=[];
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw Error('body too large')}chunks.push(value);}}
  finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export default {
 async fetch(request,env){
  const headers={'Cache-Control':'no-store','Vary':'Origin','Content-Type':'application/json; charset=utf-8'};
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
  if(!env.SITE_ORIGIN||request.headers.get('Origin')!==env.SITE_ORIGIN)return reply(403,{error:'Origin not allowed'});
  headers['Access-Control-Allow-Origin']=env.SITE_ORIGIN;
  headers['Access-Control-Allow-Methods']='POST, OPTIONS';headers['Access-Control-Allow-Headers']='Content-Type';
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply(405,{error:'Method not allowed'});
  if(!env.KICK_CLIENT_SECRET||!env.KICK_CLIENT_ID||!env.KICK_REDIRECT_URI||!env.FIREBASE_SERVICE_ACCOUNT||!env.FIREBASE_PROJECT_ID)return reply(503,{error:'ورود Kick هنوز توسط مدیر سایت راه‌اندازی نشده است.'});
  try{
   const path=new URL(request.url).pathname;
   if(!['/start','/exchange'].includes(path))return reply(404,{error:'Not found'});
   const body=await readBody(request);
   if(path==='/start'){
    if(typeof body.challenge!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(body.challenge))return reply(400,{error:'Invalid PKCE challenge'});
    const state=await makeState(body.challenge,env),url=new URL('https://id.kick.com/oauth/authorize');
    url.search=new URLSearchParams({client_id:env.KICK_CLIENT_ID,redirect_uri:env.KICK_REDIRECT_URI,response_type:'code',scope:'user:read',state,code_challenge:body.challenge,code_challenge_method:'S256'}).toString();
    return reply(200,{state,url:url.href});
   }
   const {state,verifier,code}=body;
   if(typeof verifier!=='string'||!/^[A-Za-z0-9_-]{43,128}$/.test(verifier)||typeof code!=='string'||!code||code.length>4096)throw Error('Invalid OAuth response');
   await checkState(state,verifier,env);
   // Kick consumes each authorization code once. A replay must fail there;
   // signed state is bound to the browser's PKCE verifier and expires in 10 min.
   const response=await fetch('https://id.kick.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:env.KICK_CLIENT_ID,client_secret:env.KICK_CLIENT_SECRET,redirect_uri:env.KICK_REDIRECT_URI,code,code_verifier:verifier}),signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error('Kick exchange');
   const tokens=await response.json();if(typeof tokens.access_token!=='string'||!tokens.access_token)throw Error('Missing token');
   const identity=await fetch('https://api.kick.com/public/v1/users',{headers:{Authorization:'Bearer '+tokens.access_token},signal:AbortSignal.timeout(12000)});
   if(!identity.ok)throw Error('Kick identity');
   const user=(await identity.json()).data?.[0];
   if(!Number.isSafeInteger(user?.user_id)||user.user_id<=0||typeof user.name!=='string'||!user.name||user.name.length>64)throw Error('Invalid identity');
   return reply(200,{token:await firebaseToken(user,env)});
  }catch{return reply(400,{error:'تأیید ورود ناموفق بود؛ از لینک دعوت دوباره با Kick وارد شو.'});}
 }
};
