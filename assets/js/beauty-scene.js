import * as THREE from 'three';
import {GLTFLoader} from '../vendor/addons/loaders/GLTFLoader.js';
import {BUILDINGS} from './config.js';
import {getSeason} from './season.js';

// Fixed-view radiance baking: true architecture, depth vegetation, original optical frame.
// This deliberately has no second tone map or dynamic relighting of baked surfaces.
const ROOT = new URL('../models/beauty/', import.meta.url);
const asset = name => new URL(name, ROOT).href;
const ids = {research:1, writing:2, projects:3, about:4, vegetation:5, environment:6, water:7, sky:0};
const vertexShader = `
uniform mat4 bakeVP;
varying vec4 bakeClip;
void main(){
 vec4 world=modelMatrix*vec4(position,1.);
 bakeClip=bakeVP*world;
 gl_Position=projectionMatrix*viewMatrix*world;
}`;
const fragmentShader = `
uniform sampler2D radiance;
uniform sampler2D objectIds;
uniform float objectId;
uniform float highlight;
uniform float time;
uniform float motion;
varying vec4 bakeClip;
void main(){
 vec2 uv=bakeClip.xy/bakeClip.w*.5+.5;
 if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))discard;
 float id=floor(texture2D(objectIds,uv).r*255.+.5);
 if(abs(id-objectId)>.4)discard;
 vec2 sampleUv=uv;
 // Quiet ripples inside the pond only. The water boundary and bank remain stationary.
 if(objectId>6.5){
   vec2 ripple=vec2(sin(uv.y*185.+time*.46),sin(uv.x*230.-time*.31))*.00022*motion;
   vec2 candidate=uv+ripple;
   float nextId=floor(texture2D(objectIds,candidate).r*255.+.5);
   if(abs(nextId-objectId)<.4)sampleUv=candidate;
 }
 vec3 color=texture2D(radiance,sampleUv).rgb;
 color+=vec3(.018,.012,.006)*highlight;
 gl_FragColor=vec4(color,1.);
 #include <colorspace_fragment>
}`;

export async function createBeautyGarden(canvas, progress){
 const season=getSeason(), scene=new THREE.Scene();
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(devicePixelRatio);
 renderer.setSize(innerWidth,innerHeight);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.NoToneMapping;
 scene.background=new THREE.Color('#aeb2a2');
 const textureLoader=new THREE.TextureLoader();
 const [meta,texture,mask,depthBuffer]=await Promise.all([
   fetch(asset('transfer.json')).then(r=>{if(!r.ok)throw Error('Missing fixed-camera manifest');return r.json();}),
   textureLoader.loadAsync(asset('radiance.png')),
   textureLoader.loadAsync(asset('object-ids.png')),
   fetch(asset('vegetation-depth.bin')).then(r=>{if(!r.ok)throw Error('Missing vegetation depth');return r.arrayBuffer();})
 ]);
 texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;
 texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;
 mask.colorSpace=THREE.NoColorSpace;mask.generateMipmaps=false;
 mask.minFilter=mask.magFilter=THREE.NearestFilter;
 const maskCanvas=document.createElement('canvas');maskCanvas.width=meta.width;maskCanvas.height=meta.height;
 const ctx=maskCanvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(mask.image,0,0);
 const maskPixels=ctx.getImageData(0,0,meta.width,meta.height).data;
 const camera=new THREE.PerspectiveCamera();
 const opticalProjection=new THREE.Matrix4().set(...meta.projection.flat());
 const blenderWorld=new THREE.Matrix4().set(...meta.camera_world.flat());
 const zToY=new THREE.Matrix4().makeRotationX(-Math.PI/2);
 const cameraWorld=zToY.clone().multiply(blenderWorld);
 cameraWorld.decompose(camera.position,camera.quaternion,camera.scale);camera.updateMatrixWorld(true);
 const bakeVP=opticalProjection.clone().multiply(camera.matrixWorldInverse);
 const base=camera.position.clone(),target=new THREE.Vector3(1,4.4,-2);
 function frame(){
   const cover=Math.max(innerWidth/meta.width,innerHeight/meta.height);
   camera.projectionMatrix.copy(opticalProjection);
   camera.projectionMatrix.elements[0]*=meta.width*cover/innerWidth;
   camera.projectionMatrix.elements[5]*=meta.height*cover/innerHeight;
   camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
 }
 frame();
 const materials=new Map();
 function material(key){
   if(materials.has(key))return materials.get(key);
   const m=new THREE.ShaderMaterial({name:`Baked ${key}`,vertexShader,fragmentShader,side:THREE.DoubleSide,toneMapped:false,uniforms:{
    bakeVP:{value:bakeVP},radiance:{value:texture},objectIds:{value:mask},objectId:{value:ids[key]},highlight:{value:0},time:{value:0},motion:{value:0}
   }});
   materials.set(key,m);return m;
 }
 const loader=new GLTFLoader(), groups=new Map();
 const gltfs=await Promise.all(meta.models.map(async (model,i)=>{
   const gltf=await loader.loadAsync(asset(model.file));progress(Math.round((i+1)/meta.models.length*90));
   return {model,gltf};
 }));
 for(const {gltf} of gltfs){
   scene.add(gltf.scene);gltf.scene.updateMatrixWorld(true);
   for(const [id,nodeName] of Object.entries(meta.groups)){
     const node=gltf.scene.getObjectByName(nodeName);
     if(!node)throw Error(`Missing exported node: ${nodeName}`);
     const group=new THREE.Group();group.name=id;scene.add(group);group.attach(node);
     group.traverse(n=>{if(n.isMesh){n.material=material(id);n.userData.bakedSurface=id;}});
     groups.set(id,group);
   }
 }
 // Every depth vertex lies on its original Blender camera ray. The silhouette stays at full render resolution.
 const positions=new Float32Array(depthBuffer), geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const indices=[];
 for(let y=0;y<meta.depth_rows-1;y++)for(let x=0;x<meta.depth_cols-1;x++){
  const a=y*meta.depth_cols+x,b=a+1,c=a+meta.depth_cols,d=c+1;indices.push(a,c,b,b,c,d);
 }
 geometry.setIndex(indices);geometry.computeBoundingSphere();
 const vegetation=new THREE.Mesh(geometry,material('vegetation'));vegetation.name='Depth-resolved vegetation impostor';scene.add(vegetation);
 const skyGeometry=new THREE.PlaneGeometry(2,2);
 const corners=skyGeometry.attributes.position;
 for(let i=0;i<corners.count;i++){
   const p=new THREE.Vector3(corners.getX(i),corners.getY(i),.9999).applyMatrix4(opticalProjection.clone().invert()).applyMatrix4(cameraWorld);
   corners.setXYZ(i,p.x,p.y,p.z);
 }
 skyGeometry.computeBoundingSphere();const sky=new THREE.Mesh(skyGeometry,material('sky'));sky.name='Sky only';scene.add(sky);
 const focuses={research:[4.1,5.5,-5.2],writing:[-6.1,3.7,-5.3],projects:[11.7,2.6,6.5],about:[-12.6,2.2,7.5]};
 const buildings=BUILDINGS.map(item=>({...item,group:groups.get(item.id),highlight:[],focus:new THREE.Vector3(...focuses[item.id]),strength:0}));
 for(const b of buildings)if(!b.group)throw Error(`Missing real building geometry: ${b.id}`);
 // The image-space visibility pass prevents a tree's cutout quad or an occluded building from stealing clicks.
 function pick(pointer,raycaster){
   const p=new THREE.Vector3(pointer.x,pointer.y,.5).unproject(camera).applyMatrix4(bakeVP);
   const x=Math.floor((p.x*.5+.5)*meta.width),y=Math.floor((.5-p.y*.5)*meta.height);
   if(x<0||y<0||x>=meta.width||y>=meta.height)return null;
   const id=maskPixels[(y*meta.width+x)*4],b=buildings.find(b=>ids[b.id]===id);
   if(!b)return null;
   raycaster.setFromCamera(pointer,camera);
   return raycaster.intersectObject(b.group,true).length?b:null;
 }
 addEventListener('resize',()=>{renderer.setPixelRatio(devicePixelRatio);renderer.setSize(innerWidth,innerHeight);frame();});
 document.documentElement.dataset.season=season.id;document.querySelector('#season-name').textContent=season.name;
 canvas.dataset.models=String(buildings.length);canvas.dataset.visual='blender-fixed-view-bake';canvas.dataset.quality='desktop-art';
 let frames=0,frameStart=performance.now();
 const environment={update(){}};
 progress(100);
 return {scene,camera,renderer,base,target,environment,buildings,season,pick,
  render(time,delta,motion){
   for(const b of buildings)material(b.id).uniforms.highlight.value=b.strength;
   const water=material('water');water.uniforms.time.value=time;water.uniforms.motion.value=motion?1:0;
   renderer.render(scene,camera);frames++;
   if(performance.now()-frameStart>2000){
    canvas.dataset.fps=(frames*1000/(performance.now()-frameStart)).toFixed(1);
    canvas.dataset.drawCalls=String(renderer.info.render.calls);canvas.dataset.triangles=String(renderer.info.render.triangles);canvas.dataset.dpr=String(renderer.getPixelRatio());frames=0;frameStart=performance.now();
   }
  }
 };
}
