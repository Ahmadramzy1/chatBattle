/* Shared preference, applied before the first paint. */
(()=>{'use strict';
const key='chatbattle:theme:v1';let theme='light';try{theme=localStorage.getItem(key)==='dark'?'dark':'light'}catch{}
function apply(value){theme=value==='dark'?'dark':'light';document.documentElement.dataset.theme=theme;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#191a17':'#f5f0e5');const button=document.getElementById('themeToggle');if(button){button.setAttribute('aria-pressed',String(theme==='dark'));button.textContent=theme==='dark'?'☀':'☾'}}
apply(theme);
document.addEventListener('DOMContentLoaded',()=>{const host=document.querySelector('.header-actions')||document.querySelector('.wrap')||document.querySelector('.auth-page');if(!host)return;const button=document.createElement('button');button.type='button';button.id='themeToggle';button.className='icon-btn theme-toggle';button.setAttribute('aria-label','تغییر تم روشن و تاریک / Toggle light and dark theme');button.title='تغییر تم / Change theme';button.onclick=()=>{apply(theme==='dark'?'light':'dark');try{localStorage.setItem(key,theme)}catch{}};host.prepend(button);apply(theme)});
window.addEventListener('storage',event=>{if(event.key===key)apply(event.newValue)});
})();
