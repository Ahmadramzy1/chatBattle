import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify,createHash,createHmac} from 'node:crypto';
import worker from './worker.mjs';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const env={SITE_ORIGIN:'https://example.com',KICK_CLIENT_ID:'client',KICK_CLIENT_SECRET:'test-only-secret',KICK_REDIRECT_URI:'https://example.com/kick-callback.html',FIREBASE_PROJECT_ID:'test-project',FIREBASE_SERVICE_ACCOUNT:JSON.stringify({type:'service_account',project_id:'test-project',client_email:'test@test-project.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})})};
const verifier='a'.repeat(43),challenge=createHash('sha256').update(verifier).digest('base64url');
const call=(path,body,config=env,origin=env.SITE_ORIGIN)=>worker.fetch(new Request('https://worker.example/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}),config);
test('state integrity, PKCE, expiry, CORS, body limits and missing config',async()=>{
 assert.equal((await call('start',{challenge},env,'https://evil.example')).status,403);
 assert.equal((await call('start',{challenge},{...env,KICK_CLIENT_SECRET:''})).status,503);
 assert.equal((await call('start',{challenge:'wrong'})).status,400);
 assert.equal((await call('start',{challenge,padding:'x'.repeat(9000)})).status,400);
 const {state,url}=await (await call('start',{challenge})).json();assert.equal(new URL(url).searchParams.get('scope'),'user:read');
 assert.equal((await call('exchange',{state,verifier:'b'.repeat(43),code:'code'})).status,400);
 assert.equal((await call('exchange',{state:'X'+state.slice(1),verifier,code:'code'})).status,400);
 const payload=Buffer.from(JSON.stringify({challenge,exp:Math.floor(Date.now()/1000)-1})).toString('base64url');
 const expired=payload+'.'+createHmac('sha256',env.KICK_CLIENT_SECRET).update(payload).digest('base64url');
 assert.equal((await call('exchange',{state:expired,verifier,code:'code'})).status,400);
});
test('verified Kick identity produces a valid RS256 Firebase token; replay and forged identity fail',async()=>{
 const original=globalThis.fetch;let used=false,calls=0;
 globalThis.fetch=async(url,opts)=>{calls++;if(url.endsWith('/oauth/token')){assert.equal(opts.body.get('code_verifier'),verifier);if(used)return new Response('{}',{status:400});used=true;return Response.json({access_token:'kick-token'});}assert.equal(opts.headers.Authorization,'Bearer kick-token');return Response.json({data:[{user_id:42,name:'RealKickName',email:'not-stored@example.com'}]});};
 try{
  const {state}=await (await call('start',{challenge})).json();
  const body={state,verifier,code:'one-use-code',username:'FakeName',user_id:999};
  const response=await call('exchange',body);assert.equal(response.status,200);const {token}=await response.json();
  const [header,payload,signature]=token.split('.');assert.equal(verify('RSA-SHA256',Buffer.from(header+'.'+payload),publicKey,Buffer.from(signature,'base64url')),true);
  const claims=JSON.parse(Buffer.from(payload,'base64url'));assert.equal(claims.uid,'kick:42');assert.equal(claims.claims.kick_name,'RealKickName');assert.equal(claims.exp-claims.iat,300);assert.equal(claims.aud,'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit');assert.equal(JSON.stringify(claims).includes('email'),false);
  assert.equal((await call('exchange',body)).status,400);assert.equal(calls,3);
 }finally{globalThis.fetch=original;}
});
