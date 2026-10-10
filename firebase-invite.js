import {
  db, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, authReady, firebaseError
} from './firebase-client.js?v=20261010-authfix2';

const $=id=>document.getElementById(id);
const sessionId=new URLSearchParams(location.search).get('s')||'';
const sessionRef=doc(db,'chatBattleSessions',sessionId||'missing');
const form=$('entryForm'),inputs=$('inputs');
let current=null,anonymousUser=null,mine=null,editing=false,pending=false,unsubscribe=null;
const LEGACY='این مسابقه با نسخه قبلی ساخته شده. برای ویرایش و بررسی لینک تکراری، از استریمر بخواه مسابقه جدید بسازه.';
function status(message,type='info'){
  $('state').className='status '+type;
  $('state').textContent=message;
}
function normalize(raw){
  try{
    const url=new URL(String(raw).trim());
    if(url.protocol!=='https:'||url.username||url.password)return null;
    const host=url.hostname.toLowerCase().replace(/^(www|m)\./,'');
    const p=url.pathname.split('/').filter(Boolean);
    let key,link;
    if(['youtube.com','youtu.be','youtube-nocookie.com'].includes(host)){
      const id=host==='youtu.be'?p[0]:p[0]==='watch'?url.searchParams.get('v'):['shorts','live','embed','v'].includes(p[0])?p[1]:null;
      if(!/^[A-Za-z0-9_-]{11}$/.test(id||''))return null;
      link='https://www.youtube.com/watch?v='+id;
      key=link;
    }else if(['instagram.com','instagr.am'].includes(host)){
      const kind=p[0]==='reels'?'reel':p[0],id=p[1];
      if(!['reel','p','tv'].includes(kind)||!/^[A-Za-z0-9_-]{5,}$/.test(id||''))return null;
      link='https://www.instagram.com/'+kind+'/'+id+'/';
      key='https://www.instagram.com/v/'+id+'/';
    }else if(host==='tiktok.com'){
      const i=p.indexOf('video'),username=p[i-1],id=p[i+1];
      if(i<1||!/^@[A-Za-z0-9_.-]+$/.test(username||'')||!/^[0-9]{12,25}$/.test(id||''))return null;
      link='https://www.tiktok.com/'+username+'/video/'+id;
      key='https://www.tiktok.com/video/'+id;
    }else return null;
    if(link.length>800)return null;
    return {key,link};
  }catch{return null}
}
function linksFromForm(){
  return [...inputs.querySelectorAll('input')].map(input=>input.value.trim());
}
function ownKeys(){
  return new Set(mine?.videoKeys||mine?.links?.map(url=>normalize(url)?.key).filter(Boolean)||[]);
}
function otherKeys(room=current){
  const all=room?.reservedVideoKeys||[];
  const owned=ownKeys();
  return new Set(all.filter(key=>!owned.has(key)));
}
function highlightDuplicates(){
  if(!current||Number(current.schemaVersion)!==2)return [];
  const other=otherKeys(),seen=new Set(),duplicates=[];
  for(const element of inputs.querySelectorAll('.entry')){
    const raw=element.querySelector('input')?.value;
    const clip=normalize(raw);
    const duplicate=!!clip&&(other.has(clip.key)||seen.has(clip.key));
    element.classList.toggle('duplicate',duplicate);
    if(duplicate)duplicates.push(clip.key);
    if(clip)seen.add(clip.key);
  }
  return duplicates;
}
function addField(value=''){
  if(!current||inputs.children.length>=Math.min(Number(current.perUser)||1,10))return;
  const div=document.createElement('div');div.className='entry';
  const field=document.createElement('input');field.type='url';field.placeholder='https://www.youtube.com/watch?v=...';field.setAttribute('aria-label','لینک ویدیو');field.value=value;field.maxLength=800;field.required=true;
  field.addEventListener('input',()=>{
    const duplicates=highlightDuplicates();
    if(duplicates.length)status('این ویدیو قبلاً ثبت شده؛ لینک دیگری انتخاب کن.','error');
    else if($('state').classList.contains('error'))status('لینک‌ها رو بررسی کن و تأیید نهایی رو بزن.','info');
  });
  const remove=document.createElement('button');remove.type='button';remove.className='remove';remove.textContent='×';remove.setAttribute('aria-label','حذف لینک');
  remove.addEventListener('click',()=>{div.remove();refreshControls();highlightDuplicates()});
  div.append(field,remove);inputs.append(div);refreshControls();
}
function refreshControls(){
  if(!current)return;
  const count=inputs.children.length;
  $('addAnother').disabled=count>=Number(current.perUser)||pending;
  $('linkHint').textContent=count+' از '+current.perUser+' لینک مجاز. قبل از ذخیره می‌تونی لینک‌ها رو حذف یا جایگزین کنی.';
  for(const el of inputs.querySelectorAll('.remove'))el.disabled=count<=1||pending;
}
function populateForm(){
  inputs.replaceChildren();
  $('username').value=mine?.username||'';
  for(const link of mine?.links||[])addField(link);
  if(!inputs.children.length)addField();
  refreshControls();
  highlightDuplicates();
}
function showConfirmed(){
  editing=false;
  form.hidden=true;
  $('success').style.display='block';
  $('successInfo').textContent=(mine?.links?.length||0)+' ویدیو ثبت شده. تا قبل از شروع رقابت می‌تونی ویرایش کنی.';
  const canEdit=!!current&&current.status==='collecting'&&Number(current.schemaVersion)===2;
  $('editLinks').hidden=!canEdit;
  $('editHint').textContent=canEdit?'ویرایش لینک‌ها و اضافه کردن ویدیوی جدید تا سقف مجاز فعاله.':'مسابقه شروع شده یا ارسال‌ها بسته شده؛ ویرایش امکان‌پذیر نیست.';
  status(canEdit?'✅ لینک‌ها ثبت شدن و قابل ویرایش هستن.':'✅ ویدیوهای ثبت‌شده ذخیره شدن.','');
}
function showRoom(room){
  current=room;
  $('topic').textContent=room.topic||'Chat Battle';
  $('capacity').textContent=room.capacity+' ویدیو';
  $('perUser').textContent='سقف '+room.perUser+' لینک برای هر نفر';
  $('remaining').textContent=Math.max(0,room.capacity-room.usedCount)+' جای خالی';
  if(Number(room.schemaVersion)!==2){form.hidden=true;status(LEGACY,'error');return}
  if(mine&&!editing){showConfirmed();return}
  if(room.status!=='collecting'){
    form.hidden=true;
    if(mine)showConfirmed();else status('ارسال لینک این مسابقه بسته شده.','error');
    return;
  }
  // Existing users may replace links even if the room is completely full.
  if(!mine&&room.usedCount>=room.capacity){
    form.hidden=true;status('ظرفیت مسابقه تکمیل شده.','error');return;
  }
  $('success').style.display=editing?'none':mine?'block':'none';
  form.hidden=false;
  $('cancelEdit').hidden=!editing;
  $('confirm').textContent=mine?'ذخیره تغییرات لینک‌ها ←':'تأیید نهایی و ثبت ویدیوها ←';
  if(!inputs.children.length)populateForm();
  refreshControls();
  if(!highlightDuplicates().length)status(editing?'لینک‌ها رو ویرایش و ذخیره کن.':'لینک دعوت معتبره؛ ویدیوها رو وارد کن و تأیید نهایی بزن.','');
}
function editingMode(){
  if(!mine||!current||current.status!=='collecting')return;
  editing=true;populateForm();showRoom(current);
}
function finishSave(links,username){
  mine={uid:anonymousUser.uid,username,links:links.map(c=>c.link),videoKeys:links.map(c=>c.key)};
  showConfirmed();
}
async function submit(event){
  event.preventDefault();
  if(pending||!current||!anonymousUser||current.status!=='collecting')return;
  if(Number(current.schemaVersion)!==2){status(LEGACY,'error');return}
  const name=$('username').value.trim();
  if(!/^[A-Za-z0-9_.]{2,32}$/.test(name)){status('نام Kick باید ۲ تا ۳۲ کاراکتر انگلیسی، عدد، زیرخط یا نقطه باشه.','error');return}
  const clips=linksFromForm().map(normalize);
  if(!clips.length||clips.some(v=>!v)){status('یک یا چند لینک معتبر نیست. لینک مستقیم و عمومی YouTube، Instagram یا TikTok بذار.','error');return}
  const keys=clips.map(c=>c.key);
  if(new Set(keys).size!==keys.length){highlightDuplicates();status('این ویدیو قبلاً وارد شده. لینک تکراری رو حذف کن.','error');return}
  if(highlightDuplicates().length){status('این ویدیو قبلاً ثبت شده. لطفاً ویدیوی دیگری بذار.','error');return}
  if(clips.length>current.perUser){status('تعداد لینک‌ها از سقف مجاز بیشتره.','error');return}
  pending=true;$('confirm').disabled=true;refreshControls();status('در حال بررسی تکراری نبودن و ذخیره تغییرات...','info');
  try{
    const subRef=doc(db,'chatBattleSessions',sessionId,'submissions',anonymousUser.uid);
    await runTransaction(db,async transaction=>{
      const [roomSnap,oldSnap]=await Promise.all([transaction.get(sessionRef),transaction.get(subRef)]);
      if(!roomSnap.exists())throw Error('مسابقه پیدا نشد.');
      const room=roomSnap.data();
      if(room.schemaVersion!==2)throw Error(LEGACY);
      if(room.status!=='collecting')throw Error('زمان ویرایش یا ثبت لینک‌ها به پایان رسیده.');
      if(clips.length>room.perUser)throw Error('تعداد لینک‌ها از سقف مجاز بیشتره.');
      const before=oldSnap.exists()?oldSnap.data():null;
      const beforeLinks=before?.links||[];
      const beforeKeys=before?.videoKeys||[];
      if(before&&before.uid!==anonymousUser.uid)throw Error('اجازه ویرایش لینک این کاربر وجود نداره.');
      const owned=new Set(beforeKeys);
      const other=(room.reservedVideoKeys||[]).filter(k=>!owned.has(k));
      if(keys.some(k=>other.includes(k)))throw Error('این ویدیو قبلاً ثبت شده. لینک دیگری بذار.');
      const newUsed=room.usedCount-beforeLinks.length+clips.length;
      if(newUsed>room.capacity)throw Error('ظرفیت مسابقه برای اضافه کردن این تعداد لینک کافی نیست.');
      if(newUsed<0)throw Error('شمارنده مسابقه نامعتبره.');
      const newRoster=[...other,...keys];
      if(new Set(newRoster).size!==newRoster.length)throw Error('این ویدیو قبلاً ثبت شده.');
      if(before){
        transaction.update(subRef,{username:name,links:clips.map(c=>c.link),videoKeys:keys});
      }else{
        transaction.set(subRef,{uid:anonymousUser.uid,username:name,links:clips.map(c=>c.link),videoKeys:keys,submittedAt:serverTimestamp()});
      }
      transaction.update(sessionRef,{usedCount:newUsed,reservedVideoKeys:newRoster});
    });
    finishSave(clips,name);
  }catch(error){
    status(firebaseError(error),'error');
    highlightDuplicates();
  }finally{
    pending=false;$('confirm').disabled=false;refreshControls();
  }
}
$('addAnother').addEventListener('click',()=>{addField();highlightDuplicates()});
$('editLinks').addEventListener('click',editingMode);
$('cancelEdit').addEventListener('click',()=>{if(!mine)return;editing=false;showConfirmed()});
form.addEventListener('submit',submit);
async function boot(){
  if(!/^[A-Za-z0-9]{20}$/.test(sessionId)){status('لینک دعوت نامعتبره. لینک کامل رو از استریمر بگیر.','error');return}
  try{
    anonymousUser=await authReady();
    const ownRef=doc(db,'chatBattleSessions',sessionId,'submissions',anonymousUser.uid);
    const mineSnap=await getDoc(ownRef);
    if(mineSnap.exists())mine=mineSnap.data();
    unsubscribe=onSnapshot(sessionRef,snapshot=>{
      if(!snapshot.exists()){form.hidden=true;status('مسابقه پیدا نشد.','error');return}
      showRoom(snapshot.data());
    },error=>{form.hidden=true;status(firebaseError(error),'error')});
  }catch(error){status(firebaseError(error),'error')}
}
boot();
window.addEventListener('pagehide',()=>unsubscribe?.());
