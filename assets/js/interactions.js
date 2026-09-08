import * as THREE from 'three';

export function bindInteractions(garden, canvas, reducedMotion) {
 const {buildings,camera,scene}=garden;
 const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2(3,3);
 const label=document.querySelector('#building-label');
 let hovered=null,active=null,transitionStart=0,down=null,navigating=false,pendingPointer=null;

 function pick(event){
  const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  if(garden.pick)return garden.pick(pointer,raycaster);
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(scene.children,true).filter(hit=>{for(let node=hit.object;node;node=node.parent)if(!node.visible)return false;return true;});
  if(!hits.length)return null;
  let obj=hits[0].object;while(obj&&!buildings.some(b=>b.group===obj))obj=obj.parent;
  return buildings.find(b=>b.group===obj)||null;
 }
 function setHover(b){hovered=b;canvas.style.cursor=b?'pointer':'default';label.hidden=!b;if(b){label.querySelector('strong').textContent=b.name;label.querySelector('span').textContent=b.label;}}
 canvas.addEventListener('pointermove',event=>{if(active)return;pendingPointer={clientX:event.clientX,clientY:event.clientY};});
 canvas.addEventListener('pointerleave',()=>{down=null;pendingPointer=null;if(!active)setHover(null);});
 canvas.addEventListener('pointercancel',()=>{down=null;});
 canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
 canvas.addEventListener('pointerup',e=>{const press=down;down=null;if(!press||Math.hypot(e.clientX-press.x,e.clientY-press.y)>15)return;const b=pick(e);if(b)enter(b);});
 const navLinks=[...document.querySelectorAll('[data-building]')];
 navLinks.forEach(link=>{
  const b=buildings.find(b=>b.id===link.dataset.building);
  link.addEventListener('focus',()=>setHover(b));link.addEventListener('blur',()=>{if(!active)setHover(null);});
  link.addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();enter(b);});
 });
 function enter(b){if(active)return;active=b;setHover(b);transitionStart=performance.now();document.body.classList.add('entering');}
 return {update(now){
  if(pendingPointer&&!active){setHover(pick(pendingPointer));pendingPointer=null;}
  for(const b of buildings){const wanted=(b===hovered||b===active)?1:0;b.strength+=(wanted-b.strength)*.09;
   for(const m of b.highlight){m.emissive.copy(m.userData.originalEmissive);m.emissive.add(new THREE.Color(.025,.018,.009).multiplyScalar(b.strength));}
  }
  if(active && !navigating && now-transitionStart>=280){navigating=true;location.assign(active.href);}
  if(hovered){const p=hovered.focus.clone().project(camera);label.style.left=`${Math.max(60,Math.min(innerWidth-60,(p.x*.5+.5)*innerWidth))}px`;label.style.top=`${Math.max(115,Math.min(innerHeight-115,(-p.y*.5+.5)*innerHeight))}px`;}
 }};
}
