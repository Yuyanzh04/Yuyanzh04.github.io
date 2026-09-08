import * as THREE from 'three';
import {mergeGeometries} from '../vendor/addons/utils/BufferGeometryUtils.js';
import {Reflector} from '../vendor/addons/objects/Reflector.js';

function random(seed=410) {
 let value=seed>>>0;
 return () => {value=(value*1664525+1013904223)>>>0;return value/4294967296;};
}

const rand=random(86231);
const dummy=new THREE.Object3D();
const UP=new THREE.Vector3(0,1,0);

function makeMaterial(color,roughness=.9,extra={}) {
 return new THREE.MeshStandardMaterial({color,roughness,...extra});
}

function polygonShape(points) {
 const shape=new THREE.Shape();
 points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));
 shape.closePath();
 return shape;
}

// A low, hand-jittered prism gives paving stones a cut-stone silhouette while
// keeping the top face broad enough to read from the fixed camera.
function stonePrism(width,depth,height,jitter=.12) {
 const corners=[];
 const ratios=[[-.5,-.5],[-.16,-.54],[.28,-.51],[.53,-.34],[.51,.24],[.28,.52],[-.26,.51],[-.54,.27]];
 for(const [x,z] of ratios)corners.push([width*(x+(rand()-.5)*jitter),depth*(z+(rand()-.5)*jitter)]);
 const positions=[],uvs=[],indices=[];
 for(const y of [0,height])for(const [x,z] of corners){positions.push(x,y,z);uvs.push(x/width+.5,z/depth+.5);}
 for(let i=1;i<7;i++)indices.push(8,8+i,8+i+1,0,i+1,i);
 for(let i=0;i<8;i++){const n=(i+1)%8;indices.push(i,n,8+n,i,8+n,8+i);}
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
 geo.setIndex(indices);geo.computeVertexNormals();
 return geo;
}

function branchBeam(a,b,radius,material,radiusB=radius) {
 const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
 const geo=new THREE.CylinderGeometry(radiusB,radius,delta.length(),7,1);
 geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP,delta.normalize()));
 geo.translate(...start.add(end).multiplyScalar(.5).toArray());
 return {geo,material};
}

function addLeafGeometry(kind) {
 const points=kind==='maple' ?
  [[0,.72],[-.16,.48],[-.46,.56],[-.36,.20],[-.77,.27],[-.52,-.04],[-.72,-.28],[-.24,-.22],[0,-.58],[.24,-.22],[.72,-.28],[.52,-.04],[.77,.27],[.36,.20],[.46,.56],[.16,.48]] :
  kind==='ginkgo' ?
  [[-.04,-.73],[-.38,-.47],[-.66,-.09],[-.48,.30],[-.18,.62],[.10,.69],[.38,.54],[.62,.27],[.69,-.08],[.37,-.49]] :
  [[-.08,-.67],[-.25,-.43],[-.31,-.04],[-.22,.47],[-.02,.61],[.20,.47],[.33,.05],[.24,-.42]];
 const positions=[0,.04,0],indices=[];
 points.forEach(([x,z])=>positions.push(x,0,z));
 for(let i=0;i<points.length;i++){const next=(i+1)%points.length;indices.push(0,i+1,next+1);}
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geo.setIndex(indices);geo.computeVertexNormals();
 return geo;
}

export function makeEnvironment(scene,season,quality={}) {
 const autumn=season.id==='autumn';
 const materials={
  earth:makeMaterial(new THREE.Color(season.ground).multiplyScalar(.78),1),
  soil:makeMaterial(autumn?0x716052:0x687761,1),
  moss:makeMaterial(autumn?0x596953:season.grass,.98),
  grass:makeMaterial(season.grass,.97),
  grassDeep:makeMaterial(autumn?0x405548:0x587462,.98),
  stone:makeMaterial(autumn?0xa59d8d:0xaeb3aa,.94),
  stoneLight:makeMaterial(autumn?0xc1b9a5:0xc1c4b9,.9),
  stoneWarm:makeMaterial(autumn?0x8e8678:0x969f99,.96),
  stoneDark:makeMaterial(autumn?0x69675d:0x727b75,.98),
  bark:makeMaterial(autumn?0x58453b:0x5d4c40,1),
  barkDark:makeMaterial(autumn?0x40372f:0x4c4138,1),
  reed:makeMaterial(autumn?0x6f7c59:0x658a67,.92),
  leafGround:makeMaterial(autumn?0x9c5a43:season.leaves?.[0]||0x78906c,.95),
  waterLeaf:makeMaterial(0x516d5b,.84),
  lantern:makeMaterial(autumn?0x766d60:0x7d877d,.94),
  lanternGlow:makeMaterial(autumn?0xf1b96e:0xffdf9b,.62,{emissive:autumn?0x9b4f25:0x8a6a2b,emissiveIntensity:.55}),
  snow:makeMaterial(0xe6e8e3,.88),
 };

 const batches=new Map();
 function queue(geo,material,pos=[0,0,0],rotation=[0,0,0],scale=[1,1,1]) {
  dummy.position.set(...pos);dummy.rotation.set(...rotation);dummy.scale.set(...scale);dummy.updateMatrix();
  geo.applyMatrix4(dummy.matrix);
  if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
  if(!batches.has(material))batches.set(material,[]);
  batches.get(material).push(geo);
 }
 function box(w,h,d,pos,material=materials.stone,rotation=[0,0,0]) {queue(new THREE.BoxGeometry(w,h,d),material,pos,rotation);}
 function beam(a,b,radius,material=materials.bark,radiusB=radius) {
  const part=branchBeam(a,b,radius,material,radiusB);queue(part.geo,part.material);
 }
 function flat(points,y,material) {
  const geo=new THREE.ShapeGeometry(polygonShape(points),1);geo.rotateX(-Math.PI/2);queue(geo,material,[0,y,0]);
 }

 // The base is a warm, irregular earth plane. Planted shapes and paving sit
 // a few millimetres above it so the scene reads as a designed garden floor.
 const textureCanvas=document.createElement('canvas');textureCanvas.width=textureCanvas.height=512;
 const ctx=textureCanvas.getContext('2d'),pixels=ctx.createImageData(512,512);
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const i=(y*512+x)*4;
  const wave=Math.sin(x*.037+Math.sin(y*.019)*2.4)+Math.cos(y*.052+x*.008);
  const v=210+wave*3.4+rand()*8;
  pixels.data[i]=Math.max(0,Math.min(255,v+autumn*4));
  pixels.data[i+1]=Math.max(0,Math.min(255,v+autumn*2));
  pixels.data[i+2]=Math.max(0,Math.min(255,v-4));
  pixels.data[i+3]=255;
 }
 ctx.putImageData(pixels,0,0);
 const groundMap=new THREE.CanvasTexture(textureCanvas);groundMap.wrapS=groundMap.wrapT=THREE.RepeatWrapping;groundMap.repeat.set(54,54);groundMap.colorSpace=THREE.SRGBColorSpace;
 materials.earth.map=groundMap;
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(260,260),materials.earth);
 ground.rotation.x=-Math.PI/2;ground.position.y=-.16;ground.receiveShadow=true;scene.add(ground);

 // Layered planted islands make the space between buildings feel occupied.
 const plantingBeds=[
  [[-15,17],[-10,18],[-7,16],[-8,13],[-12,12],[-16,14]],
  [[7,18],[12,18],[15,15],[13,12],[8,13],[6,15]],
  [[-.8,-.7],[1.5,-1],[2.2,.8],[1,1.6],[-1,1.2]],
  [[-16,5],[-12,6],[-10,3],[-12,.7],[-17,1.5]],
  [[7,7],[12,8],[14,5],[12,2],[8,3]],
  [[-2,-11],[4,-12],[8,-10],[7,-7],[2,-7]],
  [[-15,-8],[-11,-9],[-8,-12],[-12,-14],[-17,-12]],
 ];
 plantingBeds.forEach((points,i)=>{
  flat(points,.002,i%3===0?materials.moss:materials.soil);
  const inner=points.map(([x,z])=>[x*.92+(i%2)*.25,z*.92]);
  flat(inner,.006,materials.grassDeep);
 });

 // Natural paving: a primary approach curves around the pond, with short
 // branches to each building. Every slab has an independent silhouette.
 function samplePolyline(nodes,spacing=.88) {
  const result=[];
  for(let i=0;i<nodes.length-1;i++){
   const [x1,z1]=nodes[i],[x2,z2]=nodes[i+1];
   const length=Math.hypot(x2-x1,z2-z1),steps=Math.max(1,Math.ceil(length/spacing));
   for(let j=0;j<steps;j++){
    const t=j/steps;result.push({x:x1+(x2-x1)*t,z:z1+(z2-z1)*t,yaw:Math.atan2(x2-x1,z2-z1)});
   }
  }
  const last=nodes[nodes.length-1];result.push({x:last[0],z:last[1],yaw:result.at(-1)?.yaw||0});return result;
 }
 function paving(nodes,width=.95,materialOffset=0,spacing=.92) {
  samplePolyline(nodes,spacing).forEach((p,i)=>{
   const w=width*(.83+rand()*.28),d=spacing*(.72+rand()*.32),h=.075+rand()*.035;
   const material=[materials.stone,materials.stoneLight,materials.stoneWarm][(i+materialOffset)%3];
   queue(stonePrism(w,d,h,.16),material,[p.x,.012+rand()*.012,p.z],[0,p.yaw+(rand()-.5)*.16,0],[1,1,1]);
  });
 }
 paving([[3.5,23],[6.2,18],[6.1,14],[5.2,10],[4.1,6],[3.1,1], [3,-5.2]],1.12,0,.92);
 paving([[5.1,10],[1.2,9],[-2.3,8.8],[-5.5,8.2]],.9,1,.86);
 paving([[3.1,1],[-.5,1.4],[-4.4,.6],[-8.8,-2.1]],1.02,2,.9);
 paving([[4.7,5],[8.1,3.5],[10.2,1.7]],.9,1,.9);
 paving([[-1.2,-1.4],[-4.8,-3.7],[-7.8,-3.2],[-9.3,-2.1]],.82,0,.86);
 // Small square courts beneath the main entrances, laid with mixed stones.
 paving([[2.15,-5.3],[3.2,-5.4],[4.25,-5.25]],1.25,1,.82);
 paving([[-9.8,-2.15],[-10.7,-2.05],[-11.5,-2.1]],1.2,0,.82);
 paving([[-6.2,8.25],[-6.7,8.2],[-7.3,8.25]],1.15,2,.8);
 paving([[9.8,1.4],[10.7,1.3],[11.5,1.35]],1.12,1,.82);

 // Staggered courtyard paving wraps a central planted island.
 for(let row=0;row<10;row++)for(let col=0;col<10;col++){
  const x=-2.5+col*.68+(row%2)*.31,z=-2.3+row*.43;
  if(x>-.95&&x<2.25&&z>-.95&&z<1.5)continue;
  queue(stonePrism(.63+rand()*.04,.38+rand()*.025,.052,.045),[materials.stone,materials.stoneLight,materials.stoneWarm][Math.floor(rand()*3)],[x,.01,z]);
 }
 // A shallow irregular pond occupies the foreground left of the approach.
 // It leaves the about pavilion's entry visible and gives the camera a dark,
 // reflective plane to anchor the composition.
 const pondCenter=new THREE.Vector2(-2,11.8),pondRadii=[7.25,4.75],pondPoints=[];
 for(let i=0;i<96;i++){
  const a=i/96*Math.PI*2;
  const wobble=1+.075*Math.sin(a*3+.6)+.045*Math.cos(a*7);
  pondPoints.push([Math.cos(a)*pondRadii[0]*wobble,Math.sin(a)*pondRadii[1]*(1+.06*Math.sin(a*4))]);
 }
 const pondShape=new THREE.Shape();pondPoints.forEach(([x,z],i)=>i?pondShape.lineTo(x,-z):pondShape.moveTo(x,-z));pondShape.closePath();
 const waterGeo=new THREE.ShapeGeometry(pondShape,96);
 const water=new Reflector(waterGeo,{color:season.water,textureWidth:quality.reflection||512,textureHeight:quality.reflection||512,clipBias:.006});
 water.rotation.x=-Math.PI/2;water.position.set(pondCenter.x,.018,pondCenter.y);
 water.material.uniforms.uTime={value:0};
 if(water.material.fragmentShader.includes('uniform vec3 color;')){
  water.material.fragmentShader=water.material.fragmentShader
   .replace('uniform vec3 color;','uniform vec3 color;\nuniform float uTime;')
   .replace('vec4 base = texture2DProj( tDiffuse, vUv );','vec4 flowUv=vUv; flowUv.x+=sin(vUv.y*42.0+uTime*.42)*.0007*vUv.w; flowUv.y+=sin(vUv.x*33.0-uTime*.35)*.00045*vUv.w; vec4 base=texture2DProj(tDiffuse,flowUv);')
   .replace('blendOverlay( base.rgb, color )','mix(blendOverlay(base.rgb,color),color,.22)');
 }
 const reflect=water.onBeforeRender;water.userData.refresh=true;
 water.onBeforeRender=function(...args){if(!this.userData.refresh)return;reflect.apply(this,args);this.userData.refresh=false;};
 scene.add(water);

 // Broken rock edging follows the pond contour; gaps leave planting and water
 // visible so the edge feels built rather than stamped from one mesh.
 for(let i=0;i<78;i++){
  const a=i/78*Math.PI*2;
  if(i%7===0)continue;
  const wobble=1+.075*Math.sin(a*3+.6)+.045*Math.cos(a*7);
  const x=pondCenter.x+Math.cos(a)*(pondRadii[0]+.18+rand()*.22)*wobble;
  const z=pondCenter.y+Math.sin(a)*(pondRadii[1]+.16+rand()*.22);
  const rock=new THREE.DodecahedronGeometry(.24+rand()*.18,1);
  queue(rock,[materials.stone,materials.stoneLight,materials.stoneWarm][i%3],[x,.08+rand()*.07,z],[rand()*.3,rand()*Math.PI,rand()*.3],[1.25,.58+rand()*.35,.82+rand()*.35]);
 }

 // A short stone rail frames the near water edge and adds a human scale cue.
 function rail(nodes) {
  const points=samplePolyline(nodes,1.25);
  points.forEach((p,i)=>{
   if(i%2===0)beam([p.x,.06,p.z],[p.x,.78,p.z],.075,materials.stoneDark,.06);
   if(i<points.length-1){const q=points[i+1];beam([p.x,.61,p.z],[q.x,.61,q.z],.065,materials.stoneWarm,.05);}
  });
 }
 rail([[-8.8,15.4],[-6.3,16.3],[-3.3,16.6],[-.4,16.1],[2.1,14.9]]);

 // Pond plants and a handful of floating autumn leaves.
 function sedgeGeometry(height) {
  const positions=[],indices=[];
  for(let i=0;i<5;i++){
   const x=(rand()-.5)*.3,z=(rand()-.5)*.3,w=.024+rand()*.02,h=height*(.65+rand()*.35),k=positions.length/3;
   positions.push(x-w,0,z,x+w,0,z,x+(rand()-.5)*.18,h,z+(rand()-.5)*.12);indices.push(k,k+1,k+2);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
 }
 for(let i=0;i<30;i++){
  const a=(i/30*Math.PI*2)+.18;
  if(i%3===0)continue;
  const x=pondCenter.x+Math.cos(a)*(pondRadii[0]+.05),z=pondCenter.y+Math.sin(a)*(pondRadii[1]+.05);
  queue(sedgeGeometry(.42+rand()*.55),materials.reed,[x,-.015,z],[0,rand()*Math.PI*2,0]);
 }
 const lilyGeo=new THREE.CircleGeometry(.23,10);lilyGeo.rotateX(-Math.PI/2);
 const lilies=new THREE.InstancedMesh(lilyGeo,materials.waterLeaf,8);
 for(let i=0;i<8;i++){
  const a=rand()*Math.PI*2,r=Math.sqrt(rand())*.72;dummy.position.set(pondCenter.x+Math.cos(a)*pondRadii[0]*r*.72,.035,pondCenter.y+Math.sin(a)*pondRadii[1]*r*.72);dummy.rotation.y=rand()*Math.PI*2;dummy.scale.set(1+rand()*.5,1+rand()*.5,1);dummy.updateMatrix();lilies.setMatrixAt(i,dummy.matrix);
 }
 lilies.instanceMatrix.needsUpdate=true;scene.add(lilies);

 // Trees are placed in overlapping near/mid/far groups. Foreground trees are
 // intentionally cropped by the fixed camera to create the requested entry
 // into a garden rather than a catalog view of every building.
 const trees=[
  {x:-11,z:12,height:7.6,scale:.90,leafScale:.8,kind:'maple'},
  {x:14.5,z:11.5,height:6.7,scale:.88,leafScale:.8,kind:'maple'},
  {x:-13.8,z:8.6,height:6.8,scale:.96,kind:'maple'},
  {x:15.6,z:8.0,height:7.6,scale:1.02,kind:'ginkgo'},
  {x:-16.6,z:-1.5,height:8.4,scale:1.1,kind:'maple'},
  {x:17.6,z:-7.6,height:8.7,scale:1.1,kind:'maple'},
  {x:-10.5,z:2,height:11.3,scale:1.15,kind:'maple'},
  {x:-3.2,z:-9.5,height:9.1,scale:1.12,kind:'maple'},
  {x:-12.0,z:-12.8,height:7.2,scale:1.02,kind:'small',far:true},
  {x:4.7,z:-15.2,height:10.2,scale:1.12,kind:'maple',far:true},
  {x:15.0,z:-14.5,height:8.2,scale:1.02,kind:'ginkgo',far:true},
  {x:6.8,z:13.2,height:5.8,scale:.72,kind:'small'},
 ];
 const clusters=[];
 function growBranch(start,direction,length,radius,depth,kind,treeIndex) {
  const dir=direction.clone().normalize(),bend=new THREE.Vector3((rand()-.5)*length*.55,length*(.04+rand()*.14),(rand()-.5)*length*.55);
  const mid=start.clone().addScaledVector(dir,length*.46).add(bend);
  const end=start.clone().addScaledVector(dir,length).addScaledVector(bend,.54);
  beam(start.toArray(),mid.toArray(),radius,materials.bark,radius*.72);
  beam(mid.toArray(),end.toArray(),radius*.72,materials.barkDark,radius*.42);
  clusters.push({p:end.clone(),r:Math.max(.38,length*(.5+rand()*.24)),kind,tree:treeIndex,tone:trees[treeIndex].far?'far':'near',stretch:1.0+rand()*.36});
  if(depth<=0)return;
  const childCount=depth>=3?3:2;
  for(let i=0;i<childCount;i++){
   const angle=(i/childCount)*Math.PI*2+rand()*.7;
   const child=new THREE.Vector3(Math.cos(angle)*(.62+rand()*.35),.2+rand()*.5,Math.sin(angle)*(.62+rand()*.35));
   growBranch(end,child,length*(.52+rand()*.14),radius*.59,depth-1,kind,treeIndex);
  }
 }
 trees.forEach((tree,treeIndex)=>{
  const s=tree.scale,height=tree.height*s;
  const base=new THREE.Vector3(tree.x,-.08,tree.z);
  const trunkMid=base.clone().add(new THREE.Vector3((rand()-.5)*.58,height*.3,(rand()-.5)*.58));
  const crown=base.clone().add(new THREE.Vector3((rand()-.5)*.8,height*.47,(rand()-.5)*.8));
  beam(base.toArray(),trunkMid.toArray(),.18*s,materials.barkDark,.115*s);
  beam(trunkMid.toArray(),crown.toArray(),.12*s,materials.bark,.065*s);
  clusters.push({p:crown.clone(),r:1.0*s,kind:tree.kind,tree:treeIndex,tone:tree.far?'far':'near',stretch:1.1});
  const roots=tree.kind==='maple'?6:5;
  for(let i=0;i<roots;i++){
   const angle=i/roots*Math.PI*2+rand()*.55;
   const start=crown.clone().add(new THREE.Vector3((rand()-.5)*.22,.05+rand()*.4,(rand()-.5)*.22));
   const direction=new THREE.Vector3(Math.cos(angle)*(.78+rand()*.34),.16+rand()*.55,Math.sin(angle)*(.78+rand()*.34));
   growBranch(start,direction,(1.75+rand()*.7)*s,.095*s,3,tree.kind,treeIndex);
  }
 });

 // Low ornamental shrubs carry the eye between paving and the taller canopy.
 const shrubSpots=[[.5,.4],[-.5,.7],[-14.5,15.5],[-10.8,14.0],[10.4,15.0],[13.3,12.8],[-14.5,3.2],[-11.8,1.7],[9.3,6.1],[12.2,4.0],[-14,-10.7],[-8.8,-10.4],[4,-10.1],[7.1,-8.4]];
 shrubSpots.forEach((spot,i)=>{
  for(let layer=0;layer<4;layer++)clusters.push({p:new THREE.Vector3(spot[0]+(rand()-.5)*.75,.42+layer*.2,spot[1]+(rand()-.5)*.75),r:.58+rand()*.55,kind:'small',tree:trees.length+i,stretch:.8+rand()*.3});
 });

 const seasonColors=(season.leaves||[0x718d68]).map(c=>new THREE.Color(c));
 const autumnPalette=autumn?[0x633c38,0x7b4138,0x984b3b,0xb76645,0xc18a4d,0x5b654a]:null;
 const farPalette=autumn?[0x825747,0x98654d,0xa27d57,0x807557,0x65715f]:[0x6f8475,0x718778,0x7e8d7b,0x788979];
 const wind={value:0};
 function leafMaterial() {
  const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.86,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{
   shader.uniforms.windTime=wind;
   shader.vertexShader='uniform float windTime;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.y+=sin(windTime*.62+instanceMatrix[3].x*.55+instanceMatrix[3].z*.7)*.025*length(position.xz);');
  };
  return material;
 }
 const leafMeshes={};
 function clustersFor(kind){return clusters.filter(item=>item.kind===kind);}
 function fillLeaves(mesh,count,kind) {
  const own=clustersFor(kind);if(!own.length||!count)return;
  const shrubClusters=kind==='small'?own.filter(item=>item.tree>=trees.length):[];
  for(let i=0;i<count;i++){
   const cluster=shrubClusters.length&&i%6===0?shrubClusters[Math.floor(i/2)%shrubClusters.length]:own[i%own.length];
   const angle=rand()*Math.PI*2,rad=Math.sqrt(rand())*cluster.r*.82;
   dummy.position.set(cluster.p.x+Math.cos(angle)*rad,cluster.p.y+(rand()-.5)*cluster.r*.66,cluster.p.z+Math.sin(angle)*rad*cluster.stretch);
   dummy.rotation.set((rand()-.5)*2.5,rand()*Math.PI*2,(rand()-.5)*2.2);
   const size=(kind==='maple'?.11+rand()*.07:kind==='ginkgo'?.12+rand()*.07:.085+rand()*.065)*(trees[cluster.tree]?.leafScale??1);
   dummy.scale.set(size,size*.84,size*(.92+rand()*.2));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   let paletteIndex=i%seasonColors.length;
   if(autumn&&kind==='maple')paletteIndex=[0,0,1,1,2,2,3,4,4,5][i%10]%autumnPalette.length;
   if(autumn&&kind==='ginkgo')paletteIndex=3+(i%2);
   if(cluster.tone==='far')mesh.setColorAt(i,new THREE.Color(farPalette[i%farPalette.length]));
   else mesh.setColorAt(i,autumn?new THREE.Color(autumnPalette[paletteIndex%autumnPalette.length]):seasonColors[paletteIndex%seasonColors.length]);
  }
  mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.frustumCulled=false;scene.add(mesh);
 }
 const requestedLeaves=season.density>0?Math.floor((quality.leaves||900)*trees.length*season.density*1.28):0;
 const leafBudget=requestedLeaves?Math.floor(Math.min(90000,Math.max(4200,requestedLeaves*2.2))):0;
 const counts={maple:Math.floor(leafBudget*.67),ginkgo:Math.floor(leafBudget*.11),small:leafBudget-Math.floor(leafBudget*.78)};
 for(const kind of ['maple','ginkgo','small']){
  const geo=addLeafGeometry(kind),material=leafMaterial();
  const mesh=new THREE.InstancedMesh(geo,material,Math.max(1,counts[kind]));mesh.count=counts[kind];mesh.castShadow=true;mesh.receiveShadow=true;
  fillLeaves(mesh,counts[kind],kind);leafMeshes[kind]=mesh;
 }
 const leaves=leafMeshes.maple;
 const reduceLeaves=()=>Object.values(leafMeshes).forEach(mesh=>{mesh.count=Math.floor(mesh.count*.68);});

 // Fallen leaves are placed along beds and paving edges, with only a few on
 // the water so the surface remains legible.
 if(autumn||season.id==='spring'){
  const fallenCount=autumn?640:260,floatingCount=autumn?28:12;
  const fallen=new THREE.InstancedMesh(addLeafGeometry('maple'),leafMaterial(),fallenCount+floatingCount);
  for(let i=0;i<fallenCount+floatingCount;i++){
   let x,z,y;
   if(i<fallenCount){const bed=plantingBeds[i%plantingBeds.length],p=bed[i%bed.length];x=p[0]+(rand()-.5)*2.1;z=p[1]+(rand()-.5)*1.7;y=.024;}
   else{const a=rand()*Math.PI*2,r=Math.sqrt(rand())*.65;x=pondCenter.x+Math.cos(a)*pondRadii[0]*r*.72;z=pondCenter.y+Math.sin(a)*pondRadii[1]*r*.72;y=.057;}
   dummy.position.set(x,y,z);dummy.rotation.set(0,rand()*Math.PI*2,(rand()-.5)*.2);const s=.055+rand()*.07;dummy.scale.set(s,s,s);dummy.updateMatrix();fallen.setMatrixAt(i,dummy.matrix);
   const palette=autumnPalette||seasonColors.map(c=>c.getHex());fallen.setColorAt(i,new THREE.Color(palette[i%palette.length]));
  }
  fallen.instanceMatrix.needsUpdate=true;fallen.instanceColor.needsUpdate=true;fallen.frustumCulled=false;scene.add(fallen);
 }

 // Two modest stone lanterns mark the route without turning the garden into a
 // prop collection. Their warm apertures remain visible under the canopy.
 function lantern(x,z,scale=1) {
  const group=new THREE.Group();group.position.set(x,.02,z);group.scale.setScalar(scale);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.33,.42,.16,8),materials.lantern);base.position.y=.08;group.add(base);
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.16,.21,.58,8),materials.lantern);shaft.position.y=.45;group.add(shaft);
  for(const x of [-.2,.2])for(const z of [-.2,.2]){const post=new THREE.Mesh(new THREE.BoxGeometry(.065,.32,.065),materials.lantern);post.position.set(x,.82,z);group.add(post);}
  const ledge=new THREE.Mesh(new THREE.BoxGeometry(.48,.055,.48),materials.lantern);ledge.position.y=.65;group.add(ledge);
  const glow=new THREE.Mesh(new THREE.BoxGeometry(.22,.14,.22),materials.lanternGlow);glow.position.y=.82;group.add(glow);
  const cap=new THREE.Mesh(new THREE.ConeGeometry(.39,.22,8),materials.lantern);cap.position.y=1.08;group.add(cap);
  scene.add(group);
 }
 lantern(-8.7,6.3,.95);lantern(5.9,4.2,.82);

 // Winter keeps the underlying garden structure and receives restrained snow
 // islands rather than a full white plane that would erase paving depth.
 if(season.snow){
  const snowBeds=[[-13,16],[-1,-10],[10,15],[12,4],[-13,-10]];
  snowBeds.forEach(([x,z])=>flat([[x-1.8,z-.65],[x+.8,z-1],[x+2,z],[x+.7,z+.9],[x-1.7,z+.6]],.048,materials.snow));
 }

 // Merge static geometry per material after all transforms. Leaves, lanterns,
 // water and lily pads remain separate because they animate or instance.
 for(const [material,geometries] of batches){
  if(!geometries.length)continue;
  const ready=geometries.map(geo=>geo.index?geo.toNonIndexed():geo);
  const merged=mergeGeometries(ready,false);
  if(!merged)throw new Error('Environment geometry merge failed');
  const mesh=new THREE.Mesh(merged,material);mesh.castShadow=material!==materials.grass&&material!==materials.reed;mesh.receiveShadow=true;scene.add(mesh);
  geometries.forEach(geo=>geo.dispose());
 }

 const particleCount=season.particle?Math.min(70,(quality.particles||8)*(season.snow?3:5)):0;
 const particleGeo=season.snow?new THREE.SphereGeometry(.045,5,4):addLeafGeometry('maple');
 const particles=new THREE.InstancedMesh(particleGeo,season.snow?materials.snow:leafMaterial(),Math.max(1,particleCount));particles.count=particleCount;particles.frustumCulled=false;
 const particleColors=autumnPalette||seasonColors;
 const state=Array.from({length:particleCount},()=>({x:(rand()-.5)*34,y:rand()*11+1,z:rand()*29-10,s:.07+rand()*.085,v:.16+rand()*.28,phase:rand()*Math.PI*2}));
 if(!season.snow)for(let i=0;i<particleCount;i++)particles.setColorAt(i,new THREE.Color(particleColors[i%particleColors.length]));
 scene.add(particles);

 return {water,leaves,materials,reduceLeaves,update(time,delta,motion=true){
  water.material.uniforms.uTime.value=motion?time:0;wind.value=motion?time:0;
  for(let i=0;i<particleCount;i++){
   const p=state[i];if(motion)p.y-=delta*p.v;if(p.y<0)p.y=11;
   dummy.position.set(p.x+Math.sin(time*.32+p.phase)*.7,p.y,p.z+Math.cos(time*.24+p.phase)*.45);
   dummy.rotation.set(time*.4+p.phase,time*.2,p.phase);dummy.scale.setScalar(season.snow?1:p.s);dummy.updateMatrix();particles.setMatrixAt(i,dummy.matrix);
  }
  particles.instanceMatrix.needsUpdate=true;
 }};
}

// Keep the newer name available for callers that use the explicit contract.
export const createEnvironment=makeEnvironment;
