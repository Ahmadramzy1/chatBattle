/* Presentation-only localization. Tournament records and user content are never translated. */
(()=>{'use strict';
const KEY='chatbattle:language:v1',tables=window.ChatBattleTranslations;
let language='fa';try{language=localStorage.getItem(KEY)==='en'?'en':'fa'}catch{}
const originals=new WeakMap(),attributes=new WeakMap(),dirty=new Set();let scheduled=false;
const originalTitle=document.title;
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const expressions={};for(const locale of ['en','fa'])expressions[locale]=new RegExp(Object.keys(tables[locale]).sort((a,b)=>b.length-a.length).map(escape).join('|'),'g');
function translate(value){return String(value).replace(expressions[language],key=>tables[language][key])}
const skip='script,style,code,pre,[data-no-translate],.ranking-user,.bracket-sender,.voter-frame span,#username,#channelInput,#demoUsername,#demoVoter';
function excluded(el){return !el||el.closest(skip)||el.matches('[data-user-topic]')&&el.dataset.loaded==='true'}
function visit(root){
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
 while(node=walker.nextNode()){
  if(excluded(node.parentElement)||!node.nodeValue.trim())continue;
  let record=originals.get(node);if(!record||node.nodeValue!==record.output)record={source:node.nodeValue};
  record.output=translate(record.source);if(node.nodeValue!==record.output)node.nodeValue=record.output;originals.set(node,record);
 }
 for(const el of [root,...root.querySelectorAll('[placeholder],[title],[aria-label]')]){
  if(el.closest('[data-no-translate]'))continue;
  let records=attributes.get(el);if(!records){records={};attributes.set(el,records)}
  for(const attr of ['placeholder','title','aria-label']){if(!el.hasAttribute(attr))continue;let r=records[attr],value=el.getAttribute(attr);if(!r||value!==r.output)r={source:value};r.output=translate(r.source);if(value!==r.output)el.setAttribute(attr,r.output);records[attr]=r;}
 }
}
const observer=new MutationObserver(records=>{
 // User topics are supplied asynchronously by Firebase; preserve the original title.
 for(const r of records){const el=r.target.nodeType===1?r.target:r.target.parentElement;if(el?.closest('[data-user-topic]'))el.closest('[data-user-topic]').dataset.loaded='true';if(el)dirty.add(el);}
 if(!scheduled){scheduled=true;requestAnimationFrame(()=>refresh(false))}
});
function observe(){observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']})}
function refresh(full=true){scheduled=false;observer.disconnect();if(full)visit(document.body);else for(const root of dirty)if(root.isConnected&&!excluded(root))visit(root);dirty.clear();document.title=translate(originalTitle);for(const b of document.querySelectorAll('[data-language]'))b.setAttribute('aria-pressed',String(b.dataset.language===language));observe();}
function setLanguage(value){language=value==='en'?'en':'fa';try{localStorage.setItem(KEY,language)}catch{}document.documentElement.lang=language;document.documentElement.dir=language==='fa'?'rtl':'ltr';
 const topic=document.getElementById('topicInput');if(topic&&['خنده‌دارترین ویدیوی اینترنت','The funniest video on the internet'].includes(topic.value))topic.value=language==='en'?'The funniest video on the internet':'خنده‌دارترین ویدیوی اینترنت';
 refresh();window.dispatchEvent(new CustomEvent('chatbattle:language',{detail:language}));
}
function boot(){
 const host=document.querySelector('.header-actions')||document.querySelector('.wrap')||document.querySelector('.auth-page');
 if(host){const switcher=document.createElement('div');switcher.className='language-switch';switcher.setAttribute('role','group');switcher.setAttribute('aria-label','Language / زبان');for(const [code,label] of [['fa','فارسی'],['en','EN']]){const b=document.createElement('button');b.type='button';b.dataset.language=code;b.textContent=label;b.setAttribute('aria-label',code==='fa'?'فارسی':'English');b.onclick=()=>setLanguage(code);switcher.append(b)}host.prepend(switcher)}
 setLanguage(language);
}
window.ChatBattleI18n={translate,get language(){return language},setLanguage};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
