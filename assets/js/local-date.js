import {getSeason} from './season.js';

export function formatLocalDate(date){
 const pad=value=>String(value).padStart(2,'0');
 return `${date.getFullYear()}.${pad(date.getMonth()+1)}.${pad(date.getDate())}`;
}

export function startLocalDate(){
 const element=document.querySelector('#current-date');
 let timer;
 function update(){
  clearTimeout(timer);
  const now=new Date();
  element.textContent=formatLocalDate(now);
  element.dateTime=element.textContent.replaceAll('.','-');
  document.querySelector('#season-name').textContent=getSeason().name;
  const midnight=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  timer=setTimeout(update,midnight.getTime()-now.getTime()+100);
 }
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
 window.addEventListener('focus',update);
 update();
}
