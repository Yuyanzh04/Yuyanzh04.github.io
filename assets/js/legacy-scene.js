import {DRACOLoader} from '../vendor/addons/loaders/DRACOLoader.js';
import {loadDetails,applyDetails} from './materials.js';
import * as THREE from 'three';
import {GLTFLoader} from '../vendor/addons/loaders/GLTFLoader.js';
import {BUILDINGS,QUALITY,qualityLevel} from './config.js';
import {getSeason} from './season.js';
import {makeEnvironment} from './environment.js';
import {makeGardenRooms} from './spatial.js';

export async function createGarden(canvas, progress) {
 const season=getSeason(), level=qualityLevel(),quality={...QUALITY[level]};
 const loader=new GLTFLoader();
 const draco=new DRACOLoader();draco.setDecoderPath(new URL('../vendor/addons/libs/draco/',import.meta.url).href);draco.setWorkerLimit(1);loader.setDRACOLoader(draco);draco.preload();
 const requestStart=performance.now();const firstModel=fetchModel(BUILDINGS[0]);
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,quality.dpr));renderer.setSize(innerWidth,innerHeight);
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 renderer.shadowMap.enabled=quality.shadows;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.info.autoReset=false;
 const scene=new THREE.Scene();scene.background=new THREE.Color(season.sky);scene.fog=new THREE.Fog(season.fog,45,125);
 const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{horizon:{value:new THREE.Color(season.fog)},zenith:{value:new THREE.Color(season.id==='winter'?0xa7b9c9:season.id==='summer'?0x9abbbc:0xb8d2df)}},vertexShader:`varying vec3 vWorld;void main(){vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform vec3 horizon;uniform vec3 zenith;varying vec3 vWorld;void main(){float y=normalize(vWorld).y;float blend=smoothstep(-.06,.85,y);vec3 color=mix(horizon,zenith,blend*.68);gl_FragColor=vec4(color,1.);\n
#include <colorspace_fragment>
}`});
 const sky=new THREE.Mesh(new THREE.SphereGeometry(270,32,24),skyMaterial);sky.frustumCulled=false;scene.add(sky);
 const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.3,420);
 const base=new THREE.Vector3(),target=new THREE.Vector3();
 function frameCamera(){
  const mobile=innerWidth<700;
  if(mobile){base.set(10,7.6,21);target.set(3.2,2.4,-4);camera.fov=44;}
  else {base.set(12,7.8,17);target.set(.6,3.2,-3.2);camera.fov=35;}
  scene.fog.near=26;scene.fog.far=70;
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();camera.position.copy(base);camera.lookAt(target);
 }
 frameCamera();
 const ambient=new THREE.HemisphereLight(season.ambient,0xa79a86,1.65);scene.add(ambient);
 const sun=new THREE.DirectionalLight(season.sun,3.5);sun.position.set(-18,22,16);sun.castShadow=true;sun.shadow.mapSize.set(3072,3072);sun.shadow.radius=4;sun.shadow.camera.left=-30;sun.shadow.camera.right=30;sun.shadow.camera.top=26;sun.shadow.camera.bottom=-24;sun.shadow.camera.near=.5;sun.shadow.camera.far=90;sun.shadow.normalBias=.045;sun.shadow.bias=-.0001;sun.target.position.set(0,0,-3);scene.add(sun,sun.target);
 const fill=new THREE.DirectionalLight(0xdde6ef,.9);fill.position.set(20,12,28);scene.add(fill);
 const rim=new THREE.DirectionalLight(0xffdfaa,1.2);rim.position.set(-15,20,-22);scene.add(rim);
 const environment={update(){},reduceLeaves(){}};
 const firstGround=new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),new THREE.MeshStandardMaterial({color:season.ground,roughness:1}));
 firstGround.rotation.x=-Math.PI/2;firstGround.position.y=-.13;firstGround.receiveShadow=true;scene.add(firstGround);
 renderer.render(scene,camera);canvas.dataset.backgroundMs=performance.now().toFixed(0);
 await new Promise(requestAnimationFrame);

 let detailsPromise;
 const buildings=[];const modelTimings=[];
 async function fetchModel(item){
  const url=new URL(`../models/${item.id}.glb?v=art2`,import.meta.url).href;
  const response=await fetch(url,{priority:item.id==='research'?'high':'low'});
  if(!response.ok)throw new Error(`${item.id}: HTTP ${response.status}`);
  return {url,data:await response.arrayBuffer()};
 };
 const requests=[firstModel];
 for(const item of BUILDINGS){
  const modelStart=performance.now();
  const {url,data}=await requests[BUILDINGS.indexOf(item)];
  const parseStart=performance.now();const gltf=await loader.parseAsync(data,url);
  progress(Math.round((BUILDINGS.indexOf(item)+1)/BUILDINGS.length*100));
  modelTimings.push({id:item.id,elapsedMs:performance.now()-modelStart,parseMs:performance.now()-parseStart,sinceRequestMs:performance.now()-requestStart});canvas.dataset.modelTimings=JSON.stringify(modelTimings);
  const group=gltf.scene;group.name=item.id+'Building';group.position.set(...item.position);
  const highlight=[];
  group.traverse(node=>{
   if(!node.isMesh)return;
   if(node.name.toLowerCase().includes('snow')){node.visible=season.snow;node.castShadow=false;return;}
   node.castShadow=quality.shadows;node.receiveShadow=true;
   const mats=Array.isArray(node.material)?node.material:[node.material];
   node.material=mats.map(m=>{const own=m.clone();
    if(own.emissive){own.userData.originalEmissive=own.emissive.clone();highlight.push(own);}return own;});
   if(!Array.isArray(gltf.userData.materials)&&node.material.length===1)node.material=node.material[0];
  });
  scene.add(group);
  buildings.push({...item,group,highlight,focus:new THREE.Vector3(...item.focus),strength:0});
  renderer.render(scene,camera);
  if(buildings.length===1){
   canvas.dataset.primaryMs=performance.now().toFixed(0);
   detailsPromise=loadDetails();requests.push(...BUILDINGS.slice(1).map(fetchModel));
  }
  await new Promise(requestAnimationFrame);
 }
 draco.dispose();
 const details=await detailsPromise;
 for(const b of buildings)b.group.traverse(n=>{if(n.isMesh)for(const m of (Array.isArray(n.material)?n.material:[n.material]))applyDetails(m,details);});
 canvas.dataset.modelsMs=performance.now().toFixed(0);
 Object.assign(environment,makeEnvironment(scene,season,quality));
 makeGardenRooms(scene,details);
 if(environment.materials)for(const [key,m]of Object.entries(environment.materials))if(key.startsWith('stone')||key.startsWith('bark'))applyDetails(m,details,key.startsWith('bark')?'wood':'stone');
 scene.remove(firstGround);firstGround.geometry.dispose();firstGround.material.dispose();
 renderer.render(scene,camera);canvas.dataset.environmentMs=performance.now().toFixed(0);
 renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 document.documentElement.dataset.season=season.id;document.querySelector('#season-name').textContent=season.name;
 canvas.dataset.models=String(buildings.length);canvas.dataset.quality=level;
 let samples=[], frames=0, frameStart=performance.now(), qualityReduced=false;
 const resized=()=>{renderer.setSize(innerWidth,innerHeight);frameCamera();environment.water.userData.refresh=true;};addEventListener('resize',resized);
 return {scene,camera,renderer,base,target,environment,buildings,season,
  render(time,delta,motion){
   environment.update(time,delta,motion);renderer.info.reset();renderer.render(scene,camera);
   frames++;
   if(performance.now()-frameStart>2000){
    const fps=frames*1000/(performance.now()-frameStart);samples.push(fps);if(samples.length>5)samples.shift();
    canvas.dataset.fps=fps.toFixed(1);canvas.dataset.drawCalls=String(renderer.info.render.calls);canvas.dataset.triangles=String(renderer.info.render.triangles);canvas.dataset.dpr=String(renderer.getPixelRatio());
    frames=0;frameStart=performance.now();
   }
  },
 };
}
