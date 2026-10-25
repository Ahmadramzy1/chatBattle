const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
for(const source of scripts)new vm.Script(source);
const context={module:{exports:{}},console,URL};vm.runInNewContext(scripts[0],context);
const core=context.module.exports;
function game(n){const g=core.newGame({capacity:64});for(let i=0;i<n;i++)core.submitLink(g,'https://youtu.be/'+String(i).padStart(11,'a'),'viewer'+i);return g;}
test('compact rounds pair all entrants with at most one manual bye per odd round',()=>{
 for(let n=2;n<=64;n++){const g=game(n);assert.equal(core.startTournament(g).ok,true);
 assert.equal(g.rounds[0].length,Math.ceil(n/2));
 assert.equal(g.rounds[0].filter(m=>!m.left||!m.right).length,n%2);
 let played=0,solo=0,round=-1,soloInRound=0;
 while(g.phase==='battle'){
  const m=core.currentMatch(g);assert.ok(m.left||m.right);
  if(round!==g.current.round){round=g.current.round;soloInRound=0;}
  if(m.left&&m.right){assert.equal(core.startVote(g,100),true);core.endVote(g,101);played++;}
  else {assert.ok(++soloInRound<=1);assert.equal(core.startVote(g,100),false);assert.equal(m.winner,null);solo++;}
  assert.equal(core.advance(g,m.left?0:1).ok,true);assert.ok(played+solo<80);
 }
 assert.equal(played,n-1);assert.equal(core.rankings(g).length,n);assert.equal(g.history.length,played+solo);
 }
});
test('full supported queues never have a bye; unsupported capacity options are absent',()=>{
 for(const capacity of [16,32,64]){const g=game(capacity);g.settings.capacity=capacity;core.startTournament(g);
 while(g.phase==='battle'){const m=core.currentMatch(g);assert.ok(m.left&&m.right);core.startVote(g,100);core.endVote(g,101);assert.equal(core.advance(g,0).ok,true);}}
 for(const capacity of [24,48]){assert.throws(()=>core.newGame({capacity}));assert.ok(!html.includes('name="capacity" value="'+capacity+'"'));}
});

test('zero and one entries cannot launch',()=>{for(const n of [0,1])assert.equal(core.startTournament(game(n)).ok,false)});
test('undo final and previous round restores votes and clears dependent winners',()=>{
 const g=game(3);core.startTournament(g);core.startVote(g,100);core.vote(g,'1','voter',101);core.endVote(g,102);
 const before=JSON.stringify(g);core.advance(g,0);core.startVote(g,200);core.endVote(g,201);core.advance(g,0);core.startVote(g,300);core.endVote(g,301);core.advance(g,0);
 assert.equal(g.phase,'finished');assert.equal(core.undo(g),true);assert.equal(g.phase,'battle');assert.equal(g.completedAt,null);
 assert.equal(core.undo(g),true);assert.equal(core.undo(g),true);const {history,revealed,...rest}=g;assert.deepEqual(JSON.parse(JSON.stringify(rest)),JSON.parse(before));
 assert.equal(core.currentMatch(g).votes[0],1);const correctedWinner=core.currentMatch(g).right;assert.equal(core.advance(g,1).ok,true);assert.ok([g.rounds[1][0].left,g.rounds[1][0].right].includes(correctedWinner));
});
test('vote changes move one vote and special names do not modify prototypes',()=>{
 const g=game(2);g.settings.allowChange=true;core.startTournament(g);core.startVote(g,100);
 assert.equal(core.vote(g,'1','__proto__',101).ok,true);assert.equal(core.vote(g,'2','__proto__',102).ok,true);
 assert.deepEqual(Array.from(core.currentMatch(g).votes),[0,1]);assert.equal(core.vote(g,'2','__proto__',103).ok,false);
});

