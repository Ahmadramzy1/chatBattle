import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./submission-auth.js',import.meta.url),'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e});
const api=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('Kick login is the default for old rooms and invalid settings',()=>{assert.equal(api.requiresKick({}),true);assert.equal(api.requiresKick({requireKick:true}),true);assert.equal(api.requiresKick({requireKick:'false'}),true)});
test('only explicit false enables name-only entry',()=>assert.equal(api.requiresKick({requireKick:false}),false));
test('manual names accept Persian and English, trim whitespace and reject empty or oversized values',()=>{assert.equal(api.manualName('  احمد رمزی  '),'احمد رمزی');assert.equal(api.manualName('viewer_01'),'viewer_01');for(const v of ['', ' ', 'a','x'.repeat(65),'ab\ncd'])assert.equal(api.manualName(v),null)});
test('verified Kick name comes from identity, not editable input; manual entry requires an identity too',()=>{assert.equal(api.submissionName({requireKick:true},{uid:'kick:1',kickName:'real_user'},'fake'),'real_user');assert.equal(api.submissionName({requireKick:true},{uid:'anonymous'},'fake'),null);assert.equal(api.submissionName({requireKick:false},{uid:'anonymous'},'نام من'),'نام من');assert.equal(api.submissionName({requireKick:false},null,'نام من'),null)});
import {runInNewContext} from 'node:vm';
test('host persists the selected entry mode; old settings still require Kick',async()=>{
 const hostSource=(await readFile(new URL('./firebase-host.js',import.meta.url),'utf8')).replace(/^import\s*\{[\s\S]*?from\s*'[^']+';/,'');
 for(const setting of [undefined,true,false]){let game=null,written=null;const bridge={getGame:()=>game,attachSession:(g,id)=>g.cloudSessionId=id,toast(){}};const ctx={window:{ChatBattleBridge:bridge},document:{getElementById:()=>null},URL,location:{href:'https://example.test/index.html'},db:{},authReady:async()=>({uid:'owner'}),doc:()=>({id:'room'}),collection:()=>({}),setDoc:async(_ref,data)=>{written=data},getDoc(){},getDocs(){},onSnapshot:()=>()=>{},query:()=>({}),orderBy:()=>({}),updateDoc(){},runTransaction(){},serverTimestamp:()=>123,firebaseError:e=>e.message};runInNewContext(hostSource,ctx);game={phase:'collecting',settings:{topic:'Test',capacity:16,perUser:2}};if(setting!==undefined)game.settings.requireKick=setting;await ctx.window.ChatBattleCloudHost.createSession(game);assert.equal(written.requireKick,setting!==false);assert.equal(written.ownerUid,'owner')}
});
