// IndexedDB keeps large tournaments outside localStorage's small string quota.
(()=>{
 let connection;
 function open(){return connection??=new Promise((resolve,reject)=>{const r=indexedDB.open('chatbattle-local',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('storage blocked'));});}
 async function transaction(mode,action){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('state',mode),request=action(tx.objectStore('state'));let value;request.onsuccess=()=>value=request.result;tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(tx.error||request.error||Error('storage failed'));});}
 window.ChatBattleStore={read:()=>transaction('readonly',s=>s.get('game')),write:game=>transaction('readwrite',s=>s.put(game,'game')),clear:()=>transaction('readwrite',s=>s.delete('game'))};
})();
