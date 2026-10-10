import { auth } from './firebase-client.js?v=20261010-controls3';
import { signInWithCustomToken } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { KICK_AUTH_API } from './kick-config.js';

const STORAGE='chatbattle:kick-oauth';
const base64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function request(action,body){
  if(!KICK_AUTH_API)throw Error('ورود Kick هنوز راه‌اندازی نشده؛ مدیر سایت باید سرویس احراز هویت را تنظیم کند.');
  const response=await fetch(KICK_AUTH_API.replace(/\/$/,'')+'/'+action,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)
  });
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'ورود به Kick ناموفق بود. دوباره تلاش کن.');
  return result;
}
export async function kickUser(){
  await auth.authStateReady();
  if(!auth.currentUser)return null;
  const {claims}=await auth.currentUser.getIdTokenResult();
  if(!claims.kick_verified||auth.currentUser.uid!=='kick:'+claims.kick_id)return null;
  return {uid:auth.currentUser.uid,kickName:claims.kick_name};
}
export async function loginWithKick(){
  const verifier=base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge=base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
  const result=await request('start',{challenge});
  sessionStorage.setItem(STORAGE,JSON.stringify({state:result.state,verifier,returnTo:location.href,createdAt:Date.now()}));
  location.assign(result.url);
}
export async function finishKickLogin(){
  const saved=JSON.parse(sessionStorage.getItem(STORAGE)||'null');
  const query=new URLSearchParams(location.search);
  history.replaceState(null,'',location.pathname);
  if(!saved||query.get('state')!==saved.state||Date.now()-saved.createdAt>600000)throw Error('درخواست ورود منقضی یا نامعتبر است؛ از لینک دعوت دوباره وارد شو.');
  sessionStorage.removeItem(STORAGE);
  if(query.has('error'))throw Error('ورود به Kick لغو شد. از لینک دعوت دوباره تلاش کن.');
  if(!query.get('code'))throw Error('کد ورود دریافت نشد.');
  const result=await request('exchange',{state:saved.state,verifier:saved.verifier,code:query.get('code')});
  await signInWithCustomToken(auth,result.token);
  const target=new URL(saved.returnTo);
  if(target.origin!==location.origin||!target.pathname.endsWith('/invite.html'))throw Error('آدرس بازگشت نامعتبر است.');
  location.replace(target.href);
}
