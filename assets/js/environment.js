import * as THREE from 'three';
import {mergeGeometries} from '../vendor/addons/utils/BufferGeometryUtils.js';
import {Reflector} from '../vendor/addons/objects/Reflector.js';

function random(seed=410) {return () => {seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296;};}
const rand = random();
const dummy = new THREE.Object3D();
const UP = new THREE.Vector3(0,1,0);
function mat(color, roughness=0.92) {return new THREE.MeshStandardMaterial({color,roughness});}
// Materials are shared and static geometry is merged, including beams and branches.
export function makeEnvironment(scene, season, quality) {
 const materials = {stone:mat(0x9da6a5), plaster:mat(0xc0c5c2), tile:mat(0x39413e), wood:mat(0x513631), bark:mat(0x484342), grass:mat(season.grass), snow:mat(0xe4e8e5)};
 const batches = new Map();
 function add(geo, material, pos=[0,0,0], rotation=[0,0,0], scale=[1,1,1]) {
  dummy.position.set(...pos);dummy.rotation.set(...rotation);dummy.scale.set(...scale);dummy.updateMatrix();geo.applyMatrix4(dummy.matrix);
  if(!batches.has(material)) batches.set(material,[]); batches.get(material).push(geo);
 }
 function box(w,h,d,p,m=materials.stone,r=[0,0,0]) {add(new THREE.BoxGeometry(w,h,d),m,p,r);}
 function beam(a,b,r,m=materials.wood,r2=r) {
  const va=new THREE.Vector3(...a), vb=new THREE.Vector3(...b), delta=vb.clone().sub(va);
  const geo=new THREE.CylinderGeometry(r2,r,delta.length(),6);geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP,delta.normalize()));geo.translate(...va.add(vb).multiplyScalar(.5).toArray());
  if(!batches.has(m))batches.set(m,[]);batches.get(m).push(geo);
 }
 const surface=document.createElement('canvas');surface.width=surface.height=512;
 const ctx=surface.getContext('2d'),image=ctx.createImageData(512,512);
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){const i=(y*512+x)*4;const v=243+Math.sin(x*.065+Math.cos(y*.043)*2)*2+rand()*10;image.data[i]=v;image.data[i+1]=v;image.data[i+2]=v;image.data[i+3]=255;}ctx.putImageData(image,0,0);
 const surfaceMap=new THREE.CanvasTexture(surface);surfaceMap.wrapS=surfaceMap.wrapT=THREE.RepeatWrapping;surfaceMap.repeat.set(122,122);surfaceMap.colorSpace=THREE.SRGBColorSpace;
 const earth=mat(season.ground);earth.map=surfaceMap;
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),earth);ground.rotation.x=-Math.PI/2;ground.position.y=-.13;ground.receiveShadow=true;scene.add(ground);
 // A long rear wall and side returns enclose the garden, without a monumental gate.
 box(52,2.6,.4,[0,1.17,-16.5],materials.plaster);
 box(.4,2.6,34,[-25,1.17,0],materials.plaster);box(.4,2.6,34,[25,1.17,0],materials.plaster);
 for(let x=-25;x<26;x+=.46){box(.49,.14,.78,[x,2.54,-16.5],materials.tile);}
 for(let z=-16;z<18;z+=.46)for(const x of [-25,25])box(.78,.14,.49,[x,2.54,z],materials.tile);
 for(let x=-24;x<25;x+=4){box(.55,2.8,.6,[x,1.25,-16.5],materials.plaster);box(.8,.18,.85,[x,2.72,-16.5],materials.tile);}
 // Flagstone lanes: uneven natural tones are baked into individual geometry colors below.
 for(let z=-13;z<=9;z+=1.05)for(let x=-1.6;x<=2;x+=1.04)box(.98,.06,.97,[x,.005,z]);
 for(let x=-14;x<=13;x+=1.04)for(const z of [2.3,3.35])box(.98,.06,.97,[x,.015,z]);
 // Pond edge and a bridge, with inset rails. Water is real reflected geometry.
 const pondX=2, pondZ=9.8, rx=10.3, rz=5.2;
 for(let i=0;i<120;i++){const a=i/120*Math.PI*2;box(.5,.21,.28,[pondX+Math.cos(a)*rx*(1+.1*Math.sin(3*a)),.03,pondZ+Math.sin(a)*rz*(1+.1*Math.cos(2*a))],materials.stone,[0,-Math.atan2(rz*Math.cos(a),-rx*Math.sin(a)),0]);}
 for(let i=0;i<17;i++){
  const x=-1+i*.48, y=.23+Math.sin(i/16*Math.PI)*.65;
  box(.51,.22,2.2,[x,y,9.5]);
  if(i%2===0)for(const z of [8.5,10.5]){box(.12,.85,.12,[x,y+.5,z]);box(.25,.09,.25,[x,y+.98,z]);}
  if(i>0){const px=x-.48, py=.23+Math.sin((i-1)/16*Math.PI)*.65;for(const z of [8.5,10.5])beam([px,py+.82,z],[x,y+.82,z],.055,materials.stone);}
 }
 const pondShape=new THREE.Shape();
 for(let i=0;i<=100;i++){const a=i/100*Math.PI*2,x=Math.cos(a)*(rx-.22)*(1+.1*Math.sin(3*a)),z=Math.sin(a)*(rz-.18)*(1+.1*Math.cos(2*a));i?pondShape.lineTo(x,-z):pondShape.moveTo(x,-z);}pondShape.closePath();
 const waterGeo=new THREE.ShapeGeometry(pondShape,72);
 const water=new Reflector(waterGeo,{color:season.water,textureWidth:quality.reflection,textureHeight:quality.reflection,clipBias:.006});water.rotation.x=-Math.PI/2;water.position.set(pondX,.015,pondZ);
 water.material.uniforms.uTime={value:0};
 water.material.fragmentShader=water.material.fragmentShader.replace('uniform vec3 color;','uniform vec3 color;\n uniform float uTime;').replace('vec4 base = texture2DProj( tDiffuse, vUv );', 'vec4 flowUv = vUv; flowUv.x += sin(vUv.y*40.0 + uTime*.5)*.00065*vUv.w; flowUv.y += sin(vUv.x*34.0-uTime*.4)*.0005*vUv.w; vec4 base = texture2DProj( tDiffuse, flowUv );').replace('blendOverlay( base.rgb, color )','mix( blendOverlay( base.rgb, color ), color, 0.42 )');
 scene.add(water);
 // Covered passages connect architecture into one garden rather than four exhibits.
 function corridor(x,z,length,angle=0){
  const origin=new THREE.Vector3(x,0,z),q=new THREE.Quaternion().setFromAxisAngle(UP,angle);
  const point=(a,b,c)=>new THREE.Vector3(a,b,c).applyQuaternion(q).add(origin).toArray();
  box(length+.5,.28,2.1,point(0,.13,0),materials.stone,[0,angle,0]);
  for(let a=-length/2;a<=length/2+.01;a+=1.75)for(const c of [-.72,.72]){beam(point(a,.28,c),point(a,2.35,c),.07);box(.23,.11,.3,point(a,2.1,c),materials.wood,[0,angle,0]);}
  for(const c of [-.72,.72])beam(point(-length/2,2.3,c),point(length/2,2.3,c),.085);
  // Curved roof strips and small tubular eave tiles.
  for(let a=-length/2;a<length/2;a+=.23)for(const side of [-1,1]){
   const verts=[], inds=[];for(let j=0;j<=8;j++){const t=j/8,c=side*t*1.2,y=3.04-.78*t+.23*t*t*t*t;for(const dx of [0,.235])verts.push(...point(a+dx,y,c));}
   for(let j=0;j<8;j++){let k=j*2;inds.push(k,k+1,k+2,k+1,k+3,k+2);}
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(inds);geo.computeVertexNormals();
   if(!batches.has(materials.tile))batches.set(materials.tile,[]);batches.get(materials.tile).push(geo);
   beam(point(a,2.5,side*1.2),point(a+.2,2.5,side*1.2),.055,materials.tile);
  }
  beam(point(-length/2-.15,3.07,0),point(length/2+.15,3.07,0),.07,materials.tile);
 }
 materials.tile.side=THREE.DoubleSide;
 corridor(-8,-8.5,9);corridor(10,-7.5,8);corridor(14,-3.5,7,Math.PI/2);corridor(-13.5,4.5,5,Math.PI/2);
 // Broadleaf trees use a recursive, bent branch skeleton and a small set of
 // instanced veined leaves. The perimeter stays open around the four buildings.
 const trees=[
  {x:-19,z:9,scale:1.3,kind:'maple'}, {x:-15,z:0,scale:1.05,kind:'maple'},
  {x:-16,z:-10,scale:1.08,kind:'maple'}, {x:-9,z:-13,scale:.98,kind:'small'},
  {x:-3,z:-14,scale:.92,kind:'maple'}, {x:8,z:-14,scale:1.08,kind:'maple'},
  {x:17,z:-10,scale:1.02,kind:'ginkgo'}, {x:22,z:-3,scale:1.08,kind:'maple'},
  {x:18,z:8,scale:.76,kind:'small'}, {x:-15,z:15,scale:1.14,kind:'maple'},
  {x:-21,z:-5,scale:.98,kind:'ginkgo'}, {x:23,z:13,scale:.85,kind:'small'},
  {x:-23,z:18,scale:1.08,kind:'maple'}, {x:18,z:20,scale:.88,kind:'maple'},
  {x:-12,z:23,scale:1.18,kind:'maple'},
 ];
 if(innerWidth<700)trees.push({x:6,z:30,scale:1.1,kind:'maple'});
 const clusters=[];
 function growBranch(start,direction,length,radius,depth,kind,treeIndex){
  const dir=direction.clone().normalize(),a=start.clone();
  const bend=new THREE.Vector3((rand()-.5)*length*.42,length*(.08+rand()*.14),(rand()-.5)*length*.42);
  const mid=a.clone().addScaledVector(dir,length*.47).add(bend);
  const end=a.clone().addScaledVector(dir,length).addScaledVector(bend,.55);
  beam(a.toArray(),mid.toArray(),radius,materials.bark,radius*.72);beam(mid.toArray(),end.toArray(),radius*.72,materials.bark,radius*.42);
  clusters.push({p:end,r:Math.max(.24,length*(.48+rand()*.22)),kind,tree:treeIndex});
  if(depth<=0)return;
  const childCount=depth===2?3:2;
  for(let i=0;i<childCount;i++){
   const angle=(i/childCount)*Math.PI*2+rand()*.75;
   const child=new THREE.Vector3(Math.cos(angle)*(.72+rand()*.3),.24+rand()*.5,Math.sin(angle)*(.72+rand()*.3));
   growBranch(end,child,length*(.5+rand()*.12),radius*.58,depth-1,kind,treeIndex);
  }
 }
 trees.forEach((tree,treeIndex)=>{
  const s=tree.scale,height=(tree.kind==='maple'?5.3:tree.kind==='ginkgo'?4.8:4.2)*s+rand()*.8;
  const base=new THREE.Vector3(tree.x,-.1,tree.z),trunkMid=base.clone().add(new THREE.Vector3((rand()-.5)*.45,height*.34,(rand()-.5)*.45));
  const crown=base.clone().add(new THREE.Vector3((rand()-.5)*.7,height*.68,(rand()-.5)*.7));
  beam(base.toArray(),trunkMid.toArray(),.22*s,materials.bark,.14*s);beam(trunkMid.toArray(),crown.toArray(),.14*s,materials.bark,.075*s);
  clusters.push({p:crown,r:1.05*s,kind:tree.kind,tree:treeIndex});
  const roots=tree.kind==='maple'?5:4;
  for(let i=0;i<roots;i++){
   const angle=i/roots*Math.PI*2+rand()*.6;
   const direction=new THREE.Vector3(Math.cos(angle)*(.78+rand()*.3),.22+rand()*.42,Math.sin(angle)*(.78+rand()*.3));
   growBranch(crown,direction,(1.65+rand()*.65)*s,.105*s,2,tree.kind,treeIndex);
  }
 });
 // Low shrub clusters fill only the planted edges and remain below the eaves.
 const shrubSpots=[[-13,9],[-11,6],[-20,4],[6,16],[15,13],[20,6],[-23,10]];
 shrubSpots.forEach(([x,z],i)=>{
  for(let layer=0;layer<3;layer++)clusters.push({p:new THREE.Vector3(x+(rand()-.5)*.8,.35+layer*.22,z+(rand()-.5)*.8),r:.7+rand()*.45,kind:'small',tree:trees.length+i});
 });
 function veinedLeaf(kind){
  const points=kind==='maple'?
   [[0,.78],[-.14,.43],[-.43,.59],[-.36,.2],[-.82,.29],[-.53,-.05],[-.74,-.25],[-.28,-.2],[0,-.56],[.28,-.2],[.74,-.25],[.53,-.05],[.82,.29],[.36,.2],[.43,.59],[.14,.43]]:
   kind==='ginkgo'?
   [[-.05,-.75],[-.43,-.48],[-.68,-.05],[-.48,.38],[-.13,.67],[.27,.57],[.57,.28],[.67,-.08],[.38,-.5]]:
   [[-.05,-.72],[-.25,-.43],[-.36,.02],[-.16,.62],[.12,.52],[.34,.1],[.22,-.42]];
  const positions=[],colors=[],indices=[];const edge=[1,1,1],vein=[.62,.68,.56];
  positions.push(0,.085,0);colors.push(...vein);
  points.forEach(([x,z])=>{positions.push(x,.018*(1-Math.min(1,Math.abs(z))),z);colors.push(...edge);});
  for(let i=0;i<points.length;i++){const next=(i+1)%points.length;indices.push(0,i+1,next+1);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
 }
 const colors=season.leaves.map(c=>new THREE.Color(c));
 const totalLeaves=Math.min(44000,Math.floor(trees.length*quality.leaves*season.density));
 const counts={maple:Math.floor(totalLeaves*.7),ginkgo:Math.floor(totalLeaves*.14),small:totalLeaves-Math.floor(totalLeaves*.84)};
 const leafMaterial=()=>new THREE.MeshStandardMaterial({color:0xffffff,roughness:.88,side:THREE.DoubleSide,vertexColors:true});
 const leafGeo=veinedLeaf('maple'),leafMat=leafMaterial();
 const leafMeshes={};
 function clustersFor(kind){return clusters.filter(c=>c.kind===kind);}
 function fillLeaves(mesh,count,kind){
  const ownClusters=clustersFor(kind);if(!ownClusters.length)return;
  const shrubs=kind==='small'?ownClusters.filter(c=>c.tree>=trees.length):[];
  for(let i=0;i<count;i++){
   const c=shrubs.length&&i%2===0?shrubs[Math.floor(i/2)%shrubs.length]:ownClusters[i%ownClusters.length],a=rand()*Math.PI*2,r=Math.sqrt(rand())*c.r;
   dummy.position.set(c.p.x+Math.cos(a)*r,c.p.y+(rand()-.5)*c.r*.72,c.p.z+Math.sin(a)*r);
   dummy.rotation.set((rand()-.5)*.9,rand()*Math.PI*2,(rand()-.5)*.9);
   const s=kind==='maple'?.20+rand()*.15:kind==='ginkgo'?.20+rand()*.14:.15+rand()*.12;dummy.scale.set(s,s*.92,s);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   let paletteIndex=i%colors.length;
   if(season.id==='autumn'&&kind==='maple')paletteIndex=[0,1,1,2,2,2,3][i%7];
   if(season.id==='autumn'&&kind==='ginkgo')paletteIndex=3+(i%2);
   mesh.setColorAt(i,colors[paletteIndex%colors.length]);
  }
  mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.frustumCulled=false;scene.add(mesh);
 }
 for(const kind of ['maple','ginkgo','small']){
  const geo=kind==='maple'?leafGeo:veinedLeaf(kind),material=kind==='maple'?leafMat:leafMaterial(),count=counts[kind];leafMeshes[kind]=new THREE.InstancedMesh(geo,material,Math.max(1,count));leafMeshes[kind].count=count;fillLeaves(leafMeshes[kind],count,kind);
 }
 const leaves=leafMeshes.maple;
 const reduceLeaves=()=>Object.values(leafMeshes).forEach(mesh=>{mesh.count=Math.floor(mesh.count*.65);});
 // Fallen leaves and a few floating leaves share one instanced draw call.
 if(season.id==='autumn'||season.id==='spring'){
  const fallen=260,floating=20,carpet=new THREE.InstancedMesh(leafGeo,leafMat,fallen+floating);carpet.count=fallen+floating;
  for(let i=0;i<fallen+floating;i++){
   let x,z,y;
   if(i<fallen){const t=trees[i%trees.length],a=rand()*Math.PI*2,r=rand()*3.2;x=t.x+Math.cos(a)*r;z=t.z+Math.sin(a)*r;y=-.06;}
   else{x=pondX+(rand()-.5)*rx*1.3;z=pondZ+(rand()-.5)*rz*1.25;y=.045;}
   dummy.position.set(x,y,z);dummy.rotation.set(0,rand()*Math.PI*2,0);const s=.07+rand()*.08;dummy.scale.set(s,s,s);dummy.updateMatrix();carpet.setMatrixAt(i,dummy.matrix);carpet.setColorAt(i,colors[i%colors.length]);
  }
  carpet.instanceMatrix.needsUpdate=true;carpet.instanceColor.needsUpdate=true;carpet.frustumCulled=false;scene.add(carpet);
 }
 // Slender pond-edge sedges add a low texture layer without another material batch.
 function sedgeTuft(height){
  const positions=[],indices=[];
  for(let i=0;i<5;i++){const x=(rand()-.5)*.28,z=(rand()-.5)*.28,w=.025+rand()*.018,h=height*(.65+rand()*.35);const k=positions.length/3;positions.push(x-w,0,z,x+w,0,z,x+(rand()-.5)*.16,h,z+(rand()-.5)*.12);indices.push(k,k+1,k+2);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
 }
 for(let i=0;i<24;i++){const a=i/24*Math.PI*2+.15;const x=pondX+Math.cos(a)*(rx-.35),z=pondZ+Math.sin(a)*(rz-.35);add(sedgeTuft(.42+rand()*.42),materials.grass,[x,-.08,z],[0,rand()*6.28,0]);}
 materials.grass.side=THREE.DoubleSide;
 if(season.snow){
  for(let i=0;i<45;i++){const t=trees[i%trees.length];add(new THREE.CircleGeometry(.5+rand(),12),materials.snow,[t.x+(rand()-.5)*4,-.045,t.z+(rand()-.5)*4],[-Math.PI/2,0,0],[1,.7,1]);}
  for(let x=-22;x<24;x+=2)box(1.8,.04,.55,[x,2.64,-16.5],materials.snow);
 }
 for(const [material,geos] of batches){
  // BoxGeometry and cylinders have UVs; roof strips receive dummy UVs for merging.
  for(const g of geos) {if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));}
  const merged=mergeGeometries(geos.map(g=>g.index?g.toNonIndexed():g));const mesh=new THREE.Mesh(merged,material);mesh.castShadow=material!==materials.grass;mesh.receiveShadow=true;scene.add(mesh);geos.forEach(g=>g.dispose());
 }
 const particleCount=season.particle?quality.particles:0;
 const particles=new THREE.InstancedMesh(season.snow?new THREE.SphereGeometry(.045,5,4):leafGeo,season.snow?materials.snow:leafMat,Math.max(1,particleCount));particles.count=particleCount;particles.frustumCulled=false;
 const state=Array.from({length:particleCount},(_,i)=>({x:(rand()-.5)*34,y:rand()*11+1,z:rand()*22-9,s:.09+rand()*.08,v:.18+rand()*.25,phase:rand()*6.28}));
 if(!season.snow)for(let i=0;i<particleCount;i++)particles.setColorAt(i,colors[i%colors.length]);scene.add(particles);
 return {water,leaves,reduceLeaves,update(time,delta,motion=true){
  water.material.uniforms.uTime.value=motion?time:0;
  for(let i=0;i<particleCount;i++){const p=state[i];if(motion)p.y-=delta*p.v;if(p.y<0)p.y=11;
   dummy.position.set(p.x+Math.sin(time*.3+p.phase)*.7,p.y,p.z+Math.cos(time*.25+p.phase)*.45);dummy.rotation.set(time*.4+p.phase,time*.2,p.phase);dummy.scale.setScalar(season.snow?1:p.s);dummy.updateMatrix();particles.setMatrixAt(i,dummy.matrix);
  }particles.instanceMatrix.needsUpdate=true;
 }};
}
