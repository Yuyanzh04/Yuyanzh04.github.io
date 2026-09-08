import * as THREE from 'three';
import {GLTFLoader} from '../vendor/addons/loaders/GLTFLoader.js';
import {BUILDINGS,QUALITY,qualityLevel} from './config.js';
import {getSeason} from './season.js';
import {makeEnvironment} from './environment.js';

export async function createGarden(canvas, progress) {
 const season=getSeason(), level=qualityLevel(),quality={...QUALITY[level]};
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,quality.dpr));renderer.setSize(innerWidth,innerHeight);
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 renderer.shadowMap.enabled=quality.shadows;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.info.autoReset=false;
 const scene=new THREE.Scene();scene.background=new THREE.Color(season.sky);scene.fog=new THREE.Fog(season.fog,45,125);
 const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{horizon:{value:new THREE.Color(season.sky)},zenith:{value:new THREE.Color(season.id==='winter'?0xa7b9c9:season.id==='summer'?0x9abbbc:0x8099aa)}},vertexShader:`varying vec3 vWorld;void main(){vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform vec3 horizon;uniform vec3 zenith;varying vec3 vWorld;void main(){float y=normalize(vWorld).y;float blend=smoothstep(-.06,.85,y);vec3 color=mix(horizon,zenith,blend*.68);gl_FragColor=vec4(color,1.);\n
#include <colorspace_fragment>
}`});
 const sky=new THREE.Mesh(new THREE.SphereGeometry(270,32,24),skyMaterial);sky.frustumCulled=false;scene.add(sky);
 const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.3,420);
 const base=new THREE.Vector3(),target=new THREE.Vector3();
 function frameCamera(){
  const mobile=innerWidth<700;
  if(mobile){base.set(27,23,56);target.set(0,2,-1);camera.fov=53;}
  else {base.set(27,17,36);target.set(0,4,-1);camera.fov=40;}
  scene.fog.near=mobile?70:48;scene.fog.far=mobile?180:130;
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();camera.position.copy(base);camera.lookAt(target);
 }
 frameCamera();
 const ambient=new THREE.HemisphereLight(season.ambient,0x526066,2.0);scene.add(ambient);
 const sun=new THREE.DirectionalLight(season.sun,2.1);sun.position.set(-20,29,16);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-30;sun.shadow.camera.right=30;sun.shadow.camera.top=26;sun.shadow.camera.bottom=-24;sun.shadow.camera.near=.5;sun.shadow.camera.far=90;sun.shadow.normalBias=.045;sun.shadow.bias=-.0001;sun.target.position.set(0,0,-3);scene.add(sun,sun.target);
 const environment=makeEnvironment(scene,season,quality);
 const manager=new THREE.LoadingManager();manager.onProgress=(url,loaded,total)=>progress(Math.round(loaded/total*100));
 const loader=new GLTFLoader(manager);
 const buildings=await Promise.all(BUILDINGS.map(async item=>{
  const gltf=await loader.loadAsync(new URL(`../models/${item.id}.glb`,import.meta.url).href);
  const group=gltf.scene;group.name=item.id+'Building';group.position.set(...item.position);
  const highlight=[];
  group.traverse(node=>{
   if(!node.isMesh)return;
   if(node.name.toLowerCase().includes('snow')){node.visible=season.snow;node.castShadow=false;return;}
   node.castShadow=true;node.receiveShadow=true;
   const mats=Array.isArray(node.material)?node.material:[node.material];
   node.material=mats.map(m=>{const own=m.clone();if(own.emissive){own.userData.originalEmissive=own.emissive.clone();highlight.push(own);}return own;});
   if(!Array.isArray(gltf.userData.materials)&&node.material.length===1)node.material=node.material[0];
  });
  scene.add(group);
  return {...item,group,highlight,focus:new THREE.Vector3(...item.focus),strength:0};
 }));
 document.documentElement.dataset.season=season.id;document.querySelector('#season-name').textContent=season.name;
 canvas.dataset.models=String(buildings.length);canvas.dataset.quality=level;
 let samples=[], frames=0, frameStart=performance.now(), qualityReduced=false;
 const resized=()=>{renderer.setSize(innerWidth,innerHeight);frameCamera();};addEventListener('resize',resized);
 return {scene,camera,renderer,base,target,environment,buildings,season,
  render(time,delta,motion){
   environment.update(time,delta,motion);renderer.info.reset();renderer.render(scene,camera);
   frames++;
   if(performance.now()-frameStart>2000){
    const fps=frames*1000/(performance.now()-frameStart);samples.push(fps);if(samples.length>5)samples.shift();
    canvas.dataset.fps=fps.toFixed(1);canvas.dataset.drawCalls=String(renderer.info.render.calls);canvas.dataset.triangles=String(renderer.info.render.triangles);canvas.dataset.dpr=String(renderer.getPixelRatio());
    // After multiple sustained slow windows, lower rendering cost once, without a settings panel.
    if(samples.length>=3&&samples.every(f=>f<35)&&!qualityReduced){renderer.setPixelRatio(1);renderer.shadowMap.enabled=false;environment.reduceLeaves();canvas.dataset.quality='reduced';qualityReduced=true;}
    frames=0;frameStart=performance.now();
   }
  },
 };
}
