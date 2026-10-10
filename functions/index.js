'use strict';
const {onRequest}=require('firebase-functions/v2/https');
const {defineSecret,defineString}=require('firebase-functions/params');
const {initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,Timestamp}=require('firebase-admin/firestore');
const {randomBytes,createHash}=require('node:crypto');
initializeApp();
const clientSecret=defineSecret('KICK_CLIENT_SECRET');
const clientId=defineString('KICK_CLIENT_ID');
const redirectUri=defineString('KICK_REDIRECT_URI');
const siteOrigin=defineString('SITE_ORIGIN');
const digest=s=>createHash('sha256').update(s).digest('base64url');

exports.kickAuth=onRequest({secrets:[clientSecret],maxInstances:5,timeoutSeconds:40},async(req,res)=>{
  res.set('Cache-Control','no-store');
  res.set('Vary','Origin');
  if(req.get('origin')!==siteOrigin.value())return res.status(403).json({error:'Origin not allowed'});
  res.set('Access-Control-Allow-Origin',siteOrigin.value());
  res.set('Access-Control-Allow-Methods','POST, OPTIONS');
  res.set('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const db=getFirestore();
  try{
    if(req.path==='/start'){
      const {challenge}=req.body||{};
      if(typeof challenge!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(challenge))return res.status(400).json({error:'Invalid PKCE challenge'});
      const state=randomBytes(32).toString('base64url');
      await db.collection('_kickOAuth').doc(digest(state)).create({challenge,expiresAt:Timestamp.fromMillis(Date.now()+600000)});
      const url=new URL('https://id.kick.com/oauth/authorize');
      url.search=new URLSearchParams({client_id:clientId.value(),redirect_uri:redirectUri.value(),response_type:'code',scope:'user:read',state,code_challenge:challenge,code_challenge_method:'S256'}).toString();
      return res.json({state,url:url.href});
    }
    if(req.path!=='/exchange')return res.status(404).json({error:'Not found'});
    const {state,verifier,code}=req.body||{};
    if(typeof state!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(state)||typeof verifier!=='string'||!/^[A-Za-z0-9_-]{43,128}$/.test(verifier)||typeof code!=='string'||!code||code.length>4096)return res.status(400).json({error:'Invalid OAuth response'});
    const ref=db.collection('_kickOAuth').doc(digest(state));
    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref),data=snap.data();
      if(!data||data.expiresAt.toMillis()<Date.now()||data.challenge!==digest(verifier))throw Error('Invalid OAuth state');
      tx.delete(ref);
    });
    const tokenResponse=await fetch('https://id.kick.com/oauth/token',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'authorization_code',client_id:clientId.value(),client_secret:clientSecret.value(),redirect_uri:redirectUri.value(),code,code_verifier:verifier}),signal:AbortSignal.timeout(15000)
    });
    if(!tokenResponse.ok)throw Error('Kick token exchange failed');
    const tokens=await tokenResponse.json();
    if(typeof tokens.access_token!=='string')throw Error('Missing access token');
    const userResponse=await fetch('https://api.kick.com/public/v1/users',{headers:{Authorization:'Bearer '+tokens.access_token},signal:AbortSignal.timeout(15000)});
    if(!userResponse.ok)throw Error('Kick identity lookup failed');
    const user=(await userResponse.json()).data?.[0];
    if(!Number.isSafeInteger(user?.user_id)||user.user_id<=0||typeof user.name!=='string'||!user.name||user.name.length>64)throw Error('Invalid Kick identity');
    // Never accept an identity from the browser or store Kick access/refresh tokens.
    const id=String(user.user_id);
    const token=await getAuth().createCustomToken('kick:'+id,{kick_verified:true,kick_id:id,kick_name:user.name});
    return res.json({token});
  }catch{
    return res.status(400).json({error:'تأیید ورود ناموفق بود؛ از لینک دعوت دوباره با Kick وارد شو.'});
  }
});
