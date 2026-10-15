/* Keyboard focus for the existing dialogs; no tournament state changes. */
(()=>{'use strict';let active=null,returnTo=null;
const focusable=el=>[...el.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]')].filter(n=>!n.hidden&&n.getClientRects().length);
function sync(){const next=[...document.querySelectorAll('.modal-backdrop')].find(n=>!n.classList.contains('hidden'))||null;if(next===active)return;
 if(active){document.querySelector('.app-shell')?.removeAttribute('inert');returnTo?.focus()}
 active=next;if(active){returnTo=document.activeElement;document.querySelector('.app-shell')?.setAttribute('inert','');const dialog=active.querySelector('[role=dialog]');if(dialog){dialog.tabIndex=-1;(focusable(active)[0]||dialog).focus()}}
}
document.addEventListener('keydown',e=>{if(!active)return;if(e.key==='Tab'){const items=focusable(active);if(!items.length){e.preventDefault();return}const first=items[0],last=items.at(-1);if(e.shiftKey&&(document.activeElement===first||!items.includes(document.activeElement))){e.preventDefault();last.focus()}else if(!e.shiftKey&&(document.activeElement===last||!items.includes(document.activeElement))){e.preventDefault();first.focus()}}if(e.key==='Escape'&&active.id==='coinDialog'){const close=document.getElementById('coinClose');if(!close.disabled)close.click()}});
const observer=new MutationObserver(sync);for(const modal of document.querySelectorAll('.modal-backdrop'))observer.observe(modal,{attributes:true,attributeFilter:['class']});
})();
