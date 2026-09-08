import * as THREE from 'three';

export function bindInteractions(garden, canvas, reducedMotion) {
 const {buildings,camera,base,target}=garden;
 const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2(3,3),offset=new THREE.Vector2();
 const label=document.querySelector('#building-label');
 let hovered=null,active=null,transitionStart=0,down=null,navigating=false;
 const initialCamera=new THREE.Vector3(),initialTarget=new THREE.Vector3();
 function pick(event){
  const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(buildings.map(b=>b.group),true).filter(hit=>hit.object.visible);
  if(!hits.length)return null;
  let obj=hits[0].object;while(obj&&!buildings.some(b=>b.group===obj))obj=obj.parent;
  return buildings.find(b=>b.group===obj)||null;
 }
 function setHover(b){hovered=b;canvas.style.cursor=b?'pointer':'default';label.hidden=!b;if(b){label.querySelector('strong').textContent=b.name;label.querySelector('span').textContent=b.label;}}
 canvas.addEventListener('pointermove',event=>{if(active)return;offset.set((event.clientX/innerWidth-.5)*.85,(event.clientY/innerHeight-.5)*.4);setHover(pick(event));});
 canvas.addEventListener('pointerleave',()=>{down=null;if(!active)setHover(null);offset.set(0,0);});
 canvas.addEventListener('pointercancel',()=>{down=null;});
 canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
 canvas.addEventListener('pointerup',e=>{const press=down;down=null;if(!press||Math.hypot(e.clientX-press.x,e.clientY-press.y)>15)return;const b=pick(e);if(b)enter(b);});
 const navLinks=[...document.querySelectorAll('[data-building]')];
 navLinks.forEach(link=>{
  const b=buildings.find(b=>b.id===link.dataset.building);
  link.addEventListener('focus',()=>setHover(b));link.addEventListener('blur',()=>{if(!active)setHover(null);});
  link.addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();enter(b);});
 });
 function enter(b){if(active)return;active=b;setHover(b);initialCamera.copy(camera.position);initialTarget.copy(target);transitionStart=performance.now();document.body.classList.add('entering');}
 return {update(now){
  for(const b of buildings){const wanted=(b===hovered||b===active)?1:0;b.strength+=(wanted-b.strength)*.09;
   for(const m of b.highlight){m.emissive.copy(m.userData.originalEmissive);m.emissive.add(new THREE.Color(.08,.043,.012).multiplyScalar(b.strength));}
  }
  if(active){const duration=reducedMotion?150:560,t=Math.min(1,(now-transitionStart)/duration),ease=t*t*(3-2*t);
   camera.position.copy(initialCamera).lerp(active.focus,.065*ease);camera.lookAt(initialTarget.clone().lerp(active.focus,ease*.15));
   document.querySelector('#transition').style.opacity=String(Math.max(0,(t-.65)/.35));
   if(t===1&&!navigating){navigating=true;location.assign(active.href);}
  }else{
   const desired=base.clone();if(!reducedMotion){desired.x+=offset.x;desired.y-=offset.y;}
   camera.position.lerp(desired,.035);camera.lookAt(target);
  }
  if(hovered){const p=hovered.focus.clone().project(camera);label.style.left=`${Math.max(60,Math.min(innerWidth-60,(p.x*.5+.5)*innerWidth))}px`;label.style.top=`${Math.max(115,Math.min(innerHeight-115,(-p.y*.5+.5)*innerHeight))}px`;}
 }};
}
