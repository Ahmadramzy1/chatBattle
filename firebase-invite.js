import {
  db, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, authReady, firebaseError
} from './firebase-client.js?v=20261010-authfix2';

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const sessionId=params.get('s')||'';
const sessionRef=doc(db,'chatBattleSessions',sessionId||'missing');
const form=$('entryForm'),inputs=$('inputs');
let current=null,anonymousUser=null,submitted=false,pending=false,unsubscribe=null;
function status(message,type='info'){
  $('state').className='status '+type;$('state').textContent=message;
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
      key='youtube:'+id;
      link=p[0]==='shorts'?'https://www.youtube.com/shorts/'+id:'https://www.youtube.com/watch?v='+id;
    }else if(['instagram.com','instagr.am'].includes(host)){
      const kind=p[0]==='reels'?'reel':p[0];
      if(!['reel','p','tv'].includes(kind)||!/^[A-Za-z0-9_-]{5,}$/.test(p[1]||''))return null;
      key='instagram:'+kind+':'+p[1];link='https://www.instagram.com/'+kind+'/'+p[1]+'/';
    }else if(host==='tiktok.com'){
      const i=p.indexOf('video');
      if(i<1||!/^@[A-Za-z0-9_.-]+$/.test(p[i-1]||'')||!/[0-9]{12,25}/.test(p[i+1]||''))return null;
      key='tiktok:'+p[i+1];link='https://www.tiktok.com/'+p[i-1]+'/video/'+p[i+1];
    }else{
      return null;
    }
    if(link.length>800)return null;
    return {key,link};
  }catch{return null}
}
function addField(value=''){
  if(!current)return;
  if(inputs.children.length>=Math.min(current.perUser,10))return;
  const div=document.createElement('div');div.className='entry';
  const field=document.createElement('input');field.type='url';field.placeholder='https://www.youtube.com/watch?v=...';field.setAttribute('aria-label','لینک ویدیو');field.value=value;field.maxLength=800;field.required=true;
  const remove=document.createElement('button');remove.type='button';remove.className='remove';remove.textContent='×';remove.setAttribute('aria-label','حذف لینک');remove.addEventListener('click',()=>{div.remove();refreshControls()});
  div.append(field,remove);inputs.append(div);refreshControls();
}
function refreshControls(){
  if(!current)return;
  const count=inputs.children.length;
  $('addAnother').disabled=count>=current.perUser;
  $('linkHint').textContent=count+' از '+current.perUser+' لینک مجاز اضافه شده. می‌تونی قبل از تأیید حذف یا جایگزینشون کنی.';
  for(const el of inputs.querySelectorAll('.remove'))el.disabled=count<=1;
}
function complete(links=[]){
  submitted=true;form.hidden=true;$('success').style.display='block';
  $('successInfo').textContent=links.length?links.length+' ویدیو ثبت شد. منتظر شروع رأی‌گیری در چت Kick باش.':'ویدیوهای تو قبلاً ثبت شدن. منتظر مسابقه باش.';
  status('✅ ثبت نهایی انجام شده.','');
}
function showRoom(room){
  current=room;
  $('topic').textContent=room.topic||'Chat Battle';
  $('capacity').textContent=room.capacity+' ویدیو';
  $('perUser').textContent='سقف '+room.perUser+' لینک برای هر نفر';
  $('remaining').textContent=Math.max(0,room.capacity-room.usedCount)+' جای خالی';
  if(submitted)return;
  if(room.status!=='collecting'){form.hidden=true;status('ارسال لینک این مسابقه بسته شده.','error');return}
  if(room.usedCount>=room.capacity){form.hidden=true;status('ظرفیت مسابقه تکمیل شده.','error');return}
  form.hidden=false;
  if(!inputs.children.length)addField();
  refreshControls();
  status('✅ لینک دعوت معتبره؛ ویدیوها رو وارد کن و تأیید نهایی رو بزن.','');
}
async function submit(event){
  event.preventDefault();
  if(pending||submitted||!current||!anonymousUser)return;
  const name=$('username').value.trim();
  if(!/^[A-Za-z0-9_.]{2,32}$/.test(name)){status('نام Kick باید ۲ تا ۳۲ کاراکتر انگلیسی، عدد، زیرخط یا نقطه باشه.','error');return}
  const raw=[...inputs.querySelectorAll('input')].map(input=>input.value.trim());
  const clips=raw.map(normalize);
  if(!clips.length||clips.some(clip=>!clip)){status('یکی از لینک‌ها معتبر نیست. لطفاً لینک مستقیم و عمومی ویدیو رو وارد کن.','error');return}
  const keys=clips.map(c=>c.key);
  if(new Set(keys).size!==keys.length){status('یک ویدیو رو دو بار وارد کردی. لینک‌های تکراری داخل ثبت خودت مجاز نیست.','error');return}
  if(clips.length>current.perUser){status('تعداد لینک‌ها از سقف مجاز بیشتره.','error');return}
  pending=true;$('confirm').disabled=true;status('در حال ثبت نهایی و رزرو ظرفیت...','info');
  try{
    const subRef=doc(db,'chatBattleSessions',sessionId,'submissions',anonymousUser.uid);
    await runTransaction(db,async transaction=>{
      const [session,prior]=await Promise.all([transaction.get(sessionRef),transaction.get(subRef)]);
      if(!session.exists())throw Error('مسابقه پیدا نشد.');
      if(prior.exists())throw Error('از این مرورگر قبلاً ثبت نهایی انجام شده است.');
      const state=session.data();
      if(state.status!=='collecting')throw Error('مهلت ارسال لینک تمام شده است.');
      if(clips.length>state.perUser)throw Error('سقف لینک مجاز تغییر کرده است.');
      if(state.usedCount+clips.length>state.capacity)throw Error('جای خالی کافی برای این تعداد لینک باقی نمانده است.');
      transaction.set(subRef,{uid:anonymousUser.uid,username:name,links:clips.map(c=>c.link),submittedAt:serverTimestamp()});
      transaction.update(sessionRef,{usedCount:state.usedCount+clips.length});
    });
    complete(clips);
  }catch(error){status(firebaseError(error),'error')}
  finally{pending=false;$('confirm').disabled=false}
}
$('addAnother').addEventListener('click',()=>addField());
form.addEventListener('submit',submit);
async function boot(){
  if(!/^[A-Za-z0-9]{20}$/.test(sessionId)){status('آدرس دعوت ناقص یا نامعتبره. لینک کامل رو از استریمر بگیر.','error');return}
  try{
    anonymousUser=await authReady();
    const myRef=doc(db,'chatBattleSessions',sessionId,'submissions',anonymousUser.uid);
    const mine=await getDoc(myRef);
    if(mine.exists())complete(mine.data().links||[]);
    unsubscribe=onSnapshot(sessionRef,snapshot=>{
      if(!snapshot.exists()){form.hidden=true;status('این مسابقه پیدا نشد یا حذف شده است.','error');return}
      showRoom(snapshot.data());
    },error=>{form.hidden=true;status(firebaseError(error),'error')});
  }catch(error){status(firebaseError(error),'error')}
}
boot();
window.addEventListener('pagehide',()=>unsubscribe?.());
