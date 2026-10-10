const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const crypto=require('node:crypto');
function fixture(){
 const docs=new Map(),calls=[];let handler,claims;
 const db={collection:()=>({doc:id=>({id,create:async d=>docs.set(id,d)})}),runTransaction:async fn=>fn({get:async r=>({data:()=>docs.get(r.id)}),delete:r=>docs.delete(r.id)})};
 const modules={
  'firebase-functions/v2/https':{onRequest:(_,fn)=>handler=fn},
  'firebase-functions/params':{defineSecret:()=>({value:()=> 'secret'}),defineString:key=>({value:()=>({KICK_CLIENT_ID:'client',SITE_ORIGIN:'https://example.com',KICK_REDIRECT_URI:'https://example.com/kick-callback.html'})[key]})},
  'firebase-admin/app':{initializeApp(){}},'firebase-admin/firestore':{getFirestore:()=>db,Timestamp:{fromMillis:n=>({toMillis:()=>n})}},
  'firebase-admin/auth':{getAuth:()=>({createCustomToken:async(uid,c)=>{claims={uid,...c};return 'firebase-token'}})},'node:crypto':crypto
 };
 vm.runInNewContext(fs.readFileSync(__dirname+'/index.js','utf8'),{require:n=>modules[n],exports:{},URL,URLSearchParams,AbortSignal,fetch:async(url,opts)=>{calls.push({url,opts});return {ok:true,json:async()=>url.includes('/token')?{access_token:'kick-token'}:{data:[{user_id:42,name:'verified_name',email:'discarded@example.com'}]}}}});
 return {docs,calls,getClaims:()=>claims,request:async(path,body,origin='https://example.com')=>{let status=200,data;const res={set(){},status(n){status=n;return this},json(d){data=d},end(){}};await handler({path,body,method:'POST',get:()=>origin},res);return {status,data}}};
}
test('OAuth uses only user:read, verifies PKCE, issues stable identity and rejects replay',async()=>{
 const f=fixture(),verifier='a'.repeat(43),challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
 const start=await f.request('/start',{challenge});assert.equal(start.status,200);const url=new URL(start.data.url);assert.equal(url.searchParams.get('scope'),'user:read');assert.equal(url.searchParams.get('code_challenge'),challenge);
 const body={state:start.data.state,verifier,code:'code'};assert.equal((await f.request('/exchange',body)).status,200);
 assert.deepEqual(JSON.parse(JSON.stringify(f.getClaims())),{uid:'kick:42',kick_verified:true,kick_id:'42',kick_name:'verified_name'});
 assert.equal((await f.request('/exchange',body)).status,400);assert.equal(f.calls.length,2);
});
test('wrong origin and wrong verifier cannot exchange an identity',async()=>{
 const f=fixture();assert.equal((await f.request('/start',{challenge:'a'.repeat(43)},'https://evil.example')).status,403);
 const start=await f.request('/start',{challenge:'a'.repeat(43)});
 assert.equal((await f.request('/exchange',{state:start.data.state,verifier:'b'.repeat(43),code:'code'})).status,400);assert.equal(f.calls.length,0);
});
