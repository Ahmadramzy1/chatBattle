/* One-shot entrances and tactile feedback. No perpetual movement. */
(()=>{'use strict';const reduced=matchMedia('(prefers-reduced-motion: reduce)');const running=new Set();
function animate(el,frames,options){if(reduced.matches||!el)return;const a=el.animate(frames,options);running.add(a);a.finished.catch(()=>{}).finally(()=>running.delete(a));return a}
function enter(page){if(!page||reduced.matches)return;const targets=page.id==='page-setup'?[...page.querySelectorAll('.battle-art-title,.setup-panel')]:[...page.querySelectorAll('.page-title,.battle-intro,.progress-track,.lobby-main,.side-card,.video-card,.stage-center,.bracket-section,.results-top,.ranking-row,.result-actions')];targets.forEach((el,i)=>{if(!el.getClientRects().length)return;animate(el,[{opacity:0,transform:'translateY(18px) scale(.975)'},{opacity:1,transform:'translateY(-2px) scale(1.003)',offset:.74},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:650,delay:Math.min(i,7)*55,easing:'cubic-bezier(.22,1,.36,1)'})})}
let current=document.querySelector('.page.active');
const pages=document.querySelectorAll('.page');
const observer=new MutationObserver(()=>{const next=document.querySelector('.page.active');if(next===current)return;current=next;for(const a of running)a.cancel();requestAnimationFrame(()=>enter(next))});
for(const page of pages)observer.observe(page,{attributes:true,attributeFilter:['class']});
requestAnimationFrame(()=>enter(current));
document.addEventListener('click',e=>{const button=e.target.closest('button:not(:disabled),a.secondary-btn');if(button&&!button.matches('[data-screen]'))animate(button,[{transform:'scale(.96)'},{transform:'scale(1.035)',offset:.6},{transform:'scale(1)'}],{duration:410,easing:'cubic-bezier(.22,1,.36,1)'});if(button?.matches('[data-demo-vote],#demoVoteBurst'))document.querySelectorAll('.votes-top strong').forEach(el=>animate(el,[{transform:'scale(.9)'},{transform:'scale(1.16)',offset:.55},{transform:'scale(1)'}],{duration:480,easing:'cubic-bezier(.22,1,.36,1)'}))});
reduced.addEventListener('change',e=>{if(e.matches)for(const a of running)a.cancel()});
})();

/* Capture before the original preference handlers so both snapshots are available. */
(()=>{'use strict';const reduced=matchMedia('(prefers-reduced-motion: reduce)');let active=null,sequence=0;
document.addEventListener('click',event=>{const button=event.target.closest('#themeToggle,[data-language]');if(!button||button.disabled||typeof button.onclick!=='function')return;if(button.dataset.language===document.documentElement.lang)return;
if(reduced.matches)return;
event.preventDefault();event.stopImmediatePropagation();const handler=button.onclick;const serial=++sequence;
if(active){active.skipTransition();active=null}
let updated=false;const update=()=>{if(updated)return;updated=true;handler.call(button,event);if(!button.matches('[data-language]'))return;const items=[...document.querySelectorAll('.page.active .battle-art-title,.page.active .panel-heading,.page.active .form-field,.page.active .toggle-row,.page.active .entry-tile,.page.active .side-card,.page.active .video-card,.page.active .stage-center,.page.active .winner-card,.page.active .ranking-row')].filter(el=>el.getClientRects().length);items.forEach((el,i)=>el.animate([{opacity:.65,transform:'translateY(6px) scale(.98)'},{opacity:1,transform:'translateY(-1px) scale(1.005)',offset:.7},{opacity:1,transform:'none'}],{duration:520,delay:Math.min(i,10)*24,easing:'cubic-bezier(.2,.8,.2,1)'}))};
if(document.startViewTransition){try{const transition=document.startViewTransition(update);active=transition;transition.ready.catch(()=>{});transition.finished.catch(()=>{}).finally(()=>{if(sequence===serial)active=null});return}catch{update();return}}
// Smooth fade/scale fallback for browsers without snapshot transitions.
const shell=document.querySelector('.app-shell,.wrap,.auth-page')||document.body;const exit=shell.animate([{opacity:1,transform:'scale(1)'},{opacity:.2,transform:'scale(.99)'}],{duration:150,fill:'forwards',easing:'ease-out'});exit.finished.then(()=>{update();exit.cancel();if(reduced.matches)return;shell.animate([{opacity:.2,transform:'scale(.99)'},{opacity:1,transform:'scale(1)'}],{duration:450,easing:'cubic-bezier(.22,1,.36,1)'})}).catch(update);
},true);
})();
