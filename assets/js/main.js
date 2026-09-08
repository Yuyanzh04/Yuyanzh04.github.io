import {createGarden} from './scene.js';
import {bindInteractions} from './interactions.js';
const canvas=document.querySelector('#garden');
const loading=document.querySelector('#loading');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
try {
 const garden=await createGarden(canvas,n=>document.querySelector('#load-percent').textContent=`${n}%`);
 const interaction=bindInteractions(garden,canvas,reducedMotion);
 canvas.dataset.loadedMs=performance.now().toFixed(0);
 document.body.classList.add('ready');loading.setAttribute('aria-busy','false');
 setTimeout(()=>loading.hidden=true,700);
 let last=performance.now(),time=0;
 function tick(now){
  requestAnimationFrame(tick);if(document.hidden){last=now;return;}
  const delta=Math.min((now-last)/1000,.05);last=now;time+=delta;
  interaction.update(now);garden.render(time,delta,!reducedMotion);
 }
 requestAnimationFrame(tick);
} catch(error) {
 console.error('Garden failed to load:',error);
 loading.classList.add('failed');loading.setAttribute('aria-busy','false');
 document.querySelector('#load-message').textContent='庭院未能加载，请刷新重试，或使用下方导航。';document.querySelector('#load-percent').textContent='';
}
