const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
for(const source of scripts)new vm.Script(source);
const context={module:{exports:{}},console,URL};vm.runInNewContext(scripts[0],context);
const core=context.module.exports;
function game(n){const g=core.newGame({capacity:48});for(let i=0;i<n;i++)core.submitLink(g,'https://youtu.be/'+String(i).padStart(11,'a'),'viewer'+i);return g;}
test('every entrant count 2–48 creates a complete elimination bracket',()=>{
 for(let n=2;n<=48;n++){const g=game(n);assert.equal(core.startTournament(g).ok,true);let played=0;
 while(g.phase==='battle'){assert.ok(core.currentMatch(g).left);assert.ok(core.currentMatch(g).right);core.startVote(g,100);core.endVote(g,101);assert.equal(core.advance(g,played%2).ok,true);assert.ok(++played<49);}
 assert.equal(played,n-1);assert.equal(core.rankings(g).length,n);assert.equal(g.history.length,n-1);
 }
});
test('zero and one entries cannot launch',()=>{for(const n of [0,1])assert.equal(core.startTournament(game(n)).ok,false)});
test('undo final and previous round restores votes and clears dependent winners',()=>{
 const g=game(3);core.startTournament(g);core.startVote(g,100);core.vote(g,'1','voter',101);core.endVote(g,102);
 const before=JSON.stringify(g);core.advance(g,0);core.startVote(g,200);core.endVote(g,201);core.advance(g,0);
 assert.equal(g.phase,'finished');assert.equal(core.undo(g),true);assert.equal(g.phase,'battle');assert.equal(g.completedAt,null);
 assert.equal(core.undo(g),true);const {history,revealed,...rest}=g;assert.deepEqual(JSON.parse(JSON.stringify(rest)),JSON.parse(before));
 assert.equal(core.currentMatch(g).votes[0],1);const correctedWinner=core.currentMatch(g).right;assert.equal(core.advance(g,1).ok,true);assert.ok([core.currentMatch(g).left,core.currentMatch(g).right].includes(correctedWinner));
});
test('vote changes move one vote and special names do not modify prototypes',()=>{
 const g=game(2);g.settings.allowChange=true;core.startTournament(g);core.startVote(g,100);
 assert.equal(core.vote(g,'1','__proto__',101).ok,true);assert.equal(core.vote(g,'2','__proto__',102).ok,true);
 assert.deepEqual(Array.from(core.currentMatch(g).votes),[0,1]);assert.equal(core.vote(g,'2','__proto__',103).ok,false);
});

