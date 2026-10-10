import {
  db, doc, collection, setDoc, getDoc, getDocs, onSnapshot, query, orderBy,
  updateDoc, serverTimestamp, authReady, firebaseError
} from './firebase-client.js?v=20261010-authfix2';

const bridge=window.ChatBattleBridge;
const box=document.getElementById('invitePanel');
let unsubscribe=null;
let currentId=null;
let creating=false;
let lastError='';
const inviteUrl=id=>new URL('invite.html?s='+encodeURIComponent(id),location.href).href;
function status(value,detail){
  // Only expose actionable connection errors; hide routine Firebase/Kick statuses.
  const errorBox=document.getElementById('inviteError');
  if(!errorBox)return;
  const failed=/خطا|ناموفق|فعال نشده|موجود نیست/.test(String(value));
  errorBox.hidden=!failed;
  errorBox.textContent=failed?String(detail||value):'';
}
function display(){
  const g=bridge?.getGame();
  if(!g||g.phase!=='collecting'||!box)return;
  const id=g.cloudSessionId;
  const addr=document.getElementById('inviteAddress');
  const copy=document.getElementById('copyInvite');
  const make=document.getElementById('makeInvite');
  const open=document.getElementById('openInvite');
  if(addr)addr.value=id?inviteUrl(id):'برای ساخت لینک دعوت دکمه پایین را بزنید';
  if(copy)copy.disabled=!id;
  if(open){open.href=id?inviteUrl(id):'#';open.setAttribute('aria-disabled',String(!id))}
  if(make)make.hidden=!!id;
  if(!id){status(lastError?'خطا در اتصال Firebase':'منتظر ساخت لینک',lastError||'لینک‌ها دیگر از چت Kick دریافت نمی‌شوند.');return}
  status('لینک دعوت فعال','ثبت‌ها به محض تأیید در لابی ظاهر می‌شوند.');
}
function stopListening(){
  if(unsubscribe){unsubscribe();unsubscribe=null}
  currentId=null;
}
function listen(id){
  if(!id||currentId===id)return;
  stopListening();currentId=id;
  const ref=query(collection(db,'chatBattleSessions',id,'submissions'),orderBy('submittedAt','asc'));
  unsubscribe=onSnapshot(ref,snapshot=>{
    const g=bridge?.getGame();
    if(!g||g.phase!=='collecting'||g.cloudSessionId!==id)return;
    const records=snapshot.docs.map(d=>({...d.data(),uid:d.id,when:d.data().submittedAt?.toMillis()||Date.now()}));
    bridge.syncSubmissions(id,records);
    status('متصل به Firebase',records.length+' ثبت نهایی دریافت شده');
  },error=>{
    status('خطای ارتباط با دیتابیس',firebaseError(error));
    bridge?.toast('Firestore: '+firebaseError(error));
  });
}
async function createSession(g){
  if(creating)return;
  if(!g||g.phase!=='collecting')return;
  if(g.cloudSessionId){await resume(g);return}
  creating=true;let succeeded=false;lastError='';status('در حال ساخت لینک دعوت','اتصال به Firebase و تأیید دسترسی...');
  try{
    const user=await authReady();
    if(bridge.getGame()!==g)return;
    const ref=doc(collection(db,'chatBattleSessions'));
    await setDoc(ref,{
      ownerUid:user.uid,topic:g.settings.topic,capacity:g.settings.capacity,
      perUser:g.settings.perUser,status:'collecting',usedCount:0,
      schemaVersion:2,reservedVideoKeys:[],createdAt:serverTimestamp()
    });
    if(bridge.getGame()!==g)return;
    bridge.attachSession(g,ref.id);
    display();listen(ref.id);
    bridge.toast('✅ لینک دعوت ساخته شد! از پنل لابی کپی کن.');
    succeeded=true;
  }catch(error){lastError=firebaseError(error);status('لینک دعوت هنوز فعال نشده','Firebase: '+lastError);bridge.toast(lastError)}
  finally{creating=false;if(succeeded)display()}
  return succeeded;
}
async function resume(g){
  if(!g?.cloudSessionId||g.phase!=='collecting')return;
  try{
    const user=await authReady();
    if(bridge.getGame()!==g)return;
    const ref=doc(db,'chatBattleSessions',g.cloudSessionId);
    // Reading the session verifies the Firebase setup, but ownership is enforced by Firestore rules.
    const snap=await getDoc(ref);
    if(!snap.exists())throw Error('اتاق مسابقه در Firebase پیدا نشد.');
    if(snap.data().ownerUid!==user.uid)throw Error('این مسابقه به مرورگر/هویت استریمر دیگری تعلق دارد.');
    listen(g.cloudSessionId);
    display();
  }catch(error){status('خطای اتصال',firebaseError(error))}
}
async function closeSession(g){
  if(!g?.cloudSessionId)throw Error('اول لینک دعوت رو بساز.');
  const id=g.cloudSessionId;
  const user=await authReady();
  const ref=doc(db,'chatBattleSessions',id);
  const snap=await getDoc(ref);
  if(!snap.exists()||snap.data().ownerUid!==user.uid)throw Error('مجوز مدیریت این مسابقه در این مرورگر موجود نیست.');
  if(snap.data().status==='collecting')await updateDoc(ref,{status:'closed'});
  const entries=await getDocs(query(collection(db,'chatBattleSessions',id,'submissions'),orderBy('submittedAt','asc')));
  if(g===bridge.getGame()&&g.phase==='collecting'){
    bridge.syncSubmissions(id,entries.docs.map(d=>({...d.data(),uid:d.id,when:d.data().submittedAt?.toMillis()||Date.now()})));
  }
  stopListening();
}
async function copyInvite(){
  const g=bridge?.getGame();if(!g?.cloudSessionId)return;
  const value=inviteUrl(g.cloudSessionId);
  try{await navigator.clipboard.writeText(value);bridge.toast('🔗 لینک دعوت کپی شد؛ در چت Kick قرارش بده.')}
  catch{const el=document.getElementById('inviteAddress');el?.select();bridge.toast('لینک را از کادر بالا کپی کن.')}
}
box?.querySelector('#copyInvite')?.addEventListener('click',copyInvite);
box?.querySelector('#makeInvite')?.addEventListener('click',()=>createSession(bridge.getGame()));
window.ChatBattleCloudHost={createSession,resume,closeSession,stopListening,display,copyInvite};
const existing=bridge?.getGame();
if(existing?.phase==='collecting'){
  display();
  if(existing.cloudSessionId)resume(existing);
}
