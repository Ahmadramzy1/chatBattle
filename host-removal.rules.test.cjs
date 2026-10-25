// Requires @firebase/rules-unit-testing and firebase, with the Firestore emulator on 127.0.0.1:8188.
const {test,before,after,beforeEach}=require('node:test');
const fs=require('fs');const path=require('path');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,writeBatch,serverTimestamp,updateDoc}=require('firebase/firestore');let env;
const a='https://www.youtube.com/watch?v=aaaaaaaaaa1',b='https://www.youtube.com/watch?v=aaaaaaaaaa2',c='https://www.youtube.com/watch?v=aaaaaaaaaa3';
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-host-removal',firestore:{host:'127.0.0.1',port:8188,rules:fs.readFileSync(path.join(__dirname,'firestore.rules'),'utf8')}})});
after(()=>env?.cleanup());
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();await setDoc(doc(db,'chatBattleSessions','room'),{ownerUid:'owner',topic:'Test',capacity:64,perUser:10,status:'collecting',usedCount:3,schemaVersion:2,requireKick:false,reservedVideoKeys:[a,b,c]});await setDoc(doc(db,'chatBattleSessions','room','submissions','viewer'),{uid:'viewer',username:'Viewer',links:[a,b],videoKeys:[a,b],submittedAt:1});await setDoc(doc(db,'chatBattleSessions','room','submissions','other'),{uid:'other',username:'Other',links:[c],videoKeys:[c],submittedAt:1});});});
function remove(uid='owner',{closed=false,last=false,count=2,roster=[b,c],links=[b],roomWrite=true}={}){const db=env.authenticatedContext(uid).firestore(),batch=writeBatch(db),room=doc(db,'chatBattleSessions','room'),sub=doc(room,'submissions','viewer');if(last)batch.delete(sub);else batch.update(sub,{links,videoKeys:links});if(roomWrite)batch.update(room,{usedCount:count,reservedVideoKeys:roster,moderatedViewerUid:'viewer'});return batch.commit();}
test('owner removes one link atomically, preserving other viewers and remaining links',async()=>{await assertSucceeds(remove());const db=env.authenticatedContext('owner').firestore();const r=(await getDoc(doc(db,'chatBattleSessions','room'))).data();if(r.usedCount!==2)throw Error('count');if((await getDoc(doc(db,'chatBattleSessions','room','submissions','other'))).data().links[0]!==c)throw Error('other viewer affected');});
test('owner can delete last link and reclaim capacity',async()=>{await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();await setDoc(doc(db,'chatBattleSessions','room','submissions','viewer'),{uid:'viewer',username:'Viewer',links:[a],videoKeys:[a],submittedAt:1});await setDoc(doc(db,'chatBattleSessions','room'),{ownerUid:'owner',status:'collecting',schemaVersion:2,capacity:64,usedCount:2,reservedVideoKeys:[a,c]});});await assertSucceeds(remove('owner',{last:true,count:1,roster:[c]}));});
test('other viewers cannot moderate; standalone writes and invalid counters are rejected',async()=>{await assertFails(remove('other'));await assertFails(remove('owner',{roomWrite:false}));await assertFails(remove('owner',{count:0}));await assertFails(remove('owner',{roster:[b]}));});
test('owner cannot replace links or remove multiple links through the deletion operation',async()=>{await assertFails(remove('owner',{links:[c],roster:[c,c]}));await assertFails(remove('owner',{last:true,count:1,roster:[c]}));});
test('closed rooms reject host removal, including final-link deletion',async()=>{await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();const batch=writeBatch(db);batch.update(doc(db,'chatBattleSessions','room'),{status:'closed'});await batch.commit();});await assertFails(remove());await assertFails(remove('owner',{last:true,count:1,roster:[c]}));});

test('removal supports a ten-link submission and the freed video can be submitted again',async()=>{
 const links=Array.from({length:10},(_,i)=>'https://www.youtube.com/watch?v=aaaaaaaaaa'+i);
 await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();await setDoc(doc(db,'chatBattleSessions','room'),{ownerUid:'owner',status:'collecting',schemaVersion:2,capacity:64,perUser:10,requireKick:false,usedCount:10,reservedVideoKeys:links});await setDoc(doc(db,'chatBattleSessions','room','submissions','viewer'),{uid:'viewer',username:'Viewer',links,videoKeys:links,submittedAt:1});});
 await assertSucceeds(remove('owner',{count:9,links:links.slice(1),roster:links.slice(1)}));
 const db=env.authenticatedContext('new-viewer').firestore(),batch=writeBatch(db),r=doc(db,'chatBattleSessions','room');batch.set(doc(r,'submissions','new-viewer'),{uid:'new-viewer',username:'New viewer',links:[links[0]],videoKeys:[links[0]],submittedAt:serverTimestamp()});batch.update(r,{usedCount:10,reservedVideoKeys:[...links.slice(1),links[0]]});await assertSucceeds(batch.commit());
});

test('owner can increase capacity while preserving room ID, links and count',async()=>{
 await env.withSecurityRulesDisabled(async ctx=>updateDoc(doc(ctx.firestore(),'chatBattleSessions','room'),{capacity:16}));
 const db=env.authenticatedContext('owner').firestore(),ref=doc(db,'chatBattleSessions','room');await assertFails(updateDoc(doc(env.authenticatedContext('other').firestore(),'chatBattleSessions','room'),{capacity:32}));await assertSucceeds(updateDoc(ref,{capacity:32}));await assertSucceeds(updateDoc(ref,{capacity:64}));
 for(const capacity of [16,32,48,128])await assertFails(updateDoc(ref,{capacity}));
 await assertFails(updateDoc(doc(env.authenticatedContext('other').firestore(),'chatBattleSessions','room'),{capacity:128}));
 const data=(await getDoc(ref)).data();if(data.usedCount!==3||data.reservedVideoKeys.length!==3)throw Error('roster changed');await env.withSecurityRulesDisabled(async ctx=>updateDoc(doc(ctx.firestore(),'chatBattleSessions','room'),{capacity:16}));await updateDoc(ref,{status:'closed'});await assertFails(updateDoc(ref,{capacity:32}));
});
test('viewer can delete own confirmed submission and capacity is reclaimed atomically',async()=>{
 const db=env.authenticatedContext('viewer').firestore(),r=doc(db,'chatBattleSessions','room'),sub=doc(r,'submissions','viewer');let batch=writeBatch(db);batch.delete(sub);await assertFails(batch.commit());
 batch=writeBatch(db);batch.delete(sub);batch.update(r,{usedCount:1,reservedVideoKeys:[c]});await assertSucceeds(batch.commit());
 const before=(await getDoc(r)).data();if(before.usedCount!==1)throw Error('wrong released capacity');
 const attacker=env.authenticatedContext('other').firestore(),attack=writeBatch(attacker);attack.delete(doc(attacker,'chatBattleSessions','room','submissions','viewer'));attack.update(doc(attacker,'chatBattleSessions','room'),{usedCount:0,reservedVideoKeys:[]});await assertFails(attack.commit());
});

test('viewer deletion cannot alter another submission or remove videos after closing',async()=>{
 const db=env.authenticatedContext('viewer').firestore(),r=doc(db,'chatBattleSessions','room');let batch=writeBatch(db);batch.delete(doc(r,'submissions','other'));batch.update(r,{usedCount:2,reservedVideoKeys:[a,b]});await assertFails(batch.commit());
 await env.withSecurityRulesDisabled(async ctx=>updateDoc(doc(ctx.firestore(),'chatBattleSessions','room'),{status:'closed'}));batch=writeBatch(db);batch.delete(doc(r,'submissions','viewer'));batch.update(r,{usedCount:1,reservedVideoKeys:[c]});await assertFails(batch.commit());
});
