import * as THREE from 'three';
import {mergeGeometries} from '../vendor/addons/utils/BufferGeometryUtils.js';
import {applyDetails} from './materials.js';

// Garden rooms: two connecting galleries, a moon gate, a screened rear court.
export function makeGardenRooms(scene,details){
 const colors={stone:0xa6aaa0,plaster:0xe5dcc6,tile:0x555f59,wood:0x60352b,paint:0x394e49,trim:0x968564};
 const mats={},batches=new Map(),dummy=new THREE.Object3D();
 for(const [name,color]of Object.entries(colors)){mats[name]=new THREE.MeshStandardMaterial({color,roughness:name==='wood'?.5:.85});mats[name].name=name;applyDetails(mats[name],details,name==='tile'?'tile':name==='wood'||name==='paint'||name==='trim'?'wood':name==='stone'?'stone':'plaster');}
 function add(g,m,p=[0,0,0],r=[0,0,0]){dummy.position.set(...p);dummy.rotation.set(...r);dummy.scale.set(1,1,1);dummy.updateMatrix();g.applyMatrix4(dummy.matrix);if(!g.getAttribute('uv'))g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count*2),2));if(g.index)g=g.toNonIndexed();if(!batches.has(m))batches.set(m,[]);batches.get(m).push(g);}
 function box(w,h,d,p,m=mats.stone,r=[0,0,0]){add(new THREE.BoxGeometry(w,h,d),m,p,r);}
 function beam(a,b,r,m=mats.wood){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),delta=vb.clone().sub(va),g=new THREE.CylinderGeometry(r,r,delta.length(),12);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...va.add(vb).multiplyScalar(.5).toArray());add(g,m);}
 function curve(points,r,m){add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(12,points.length*2),r,7,false),m);}
 function corridor(cx,cz,length,angle=0){
  const cs=Math.cos(angle),sn=Math.sin(angle),point=(x,y,z)=>[cx+x*cs+z*sn,y,cz-x*sn+z*cs];
  box(length,.24,2.1,point(0,.18,0),mats.stone,[0,angle,0]);
  for(let i=0;i<=Math.ceil(length/1.7);i++){
   const x=-length/2+length*i/Math.ceil(length/1.7);
   for(const z of [-.78,.78]){
    beam(point(x,.3,z),point(x,2.62,z),.075);
    box(.23,.17,.23,point(x,.38,z));
    box(.36,.12,.35,point(x,2.46,z),mats.paint,[0,angle,0]);
    box(.54,.085,.22,point(x,2.57,z),mats.wood,[0,angle,0]);
    // Curved braces make each bay read as a framed space.
    for(const sign of [-1,1])if(x+sign*.4>-length/2&&x+sign*.4<length/2)curve([point(x,2.1,z),point(x+sign*.15,2.32,z),point(x+sign*.46,2.45,z)],.043,mats.wood);
   }
  }
  for(const z of [-.78,.78])box(length,.17,.16,point(0,2.64,z),mats.paint,[0,angle,0]);
  const height=t=>3.43-1.28*t+.58*t*t+.10*Math.pow(t,7);
  for(const side of [-1,1]){
   const v=[],uv=[],idx=[],nx=Math.ceil(length/.14),nz=18;
   for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){const x=-length/2+length*i/nx,t=j/nz;v.push(...point(x,height(t),side*t*1.22));uv.push(x,t*1.22);}
   for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const a=i*(nz+1)+j,b=a+nz+1;idx.push(a,b,a+1,b,b+1,a+1);}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();add(g,mats.tile);
   for(let x=-length/2;x<length/2;x+=.145){const pts=[];for(let j=0;j<=12;j++){const t=j/12;pts.push(point(x,height(t)+.019,side*t*1.22));}curve(pts,.022,mats.tile);beam(point(x,2.79,side*1.04),point(x,2.79,side*1.24),.025,mats.wood);}
   beam(point(-length/2,2.82,side*1.22),point(length/2,2.82,side*1.22),.025,mats.tile);
  }
  beam(point(-length/2-.08,3.48,0),point(length/2+.08,3.48,0),.066,mats.tile);
 }
 mats.tile.side=THREE.DoubleSide;
 // Connect the library to the main tower; the nearer gallery defines the garden's edge.
 corridor(-2.75,-5.6,4.7);
 corridor(-3.25,1.4,3.5,Math.PI/2);
 corridor(1.5,3.05,7.8);
 corridor(5.5,1.45,3.2,Math.PI/2);
 // Rear wall: close enough for depth, with stepped coping and lattice openings.
 function wall(cx,cz,w,h=2.65,moon=false){
  const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(w/2,h);shape.lineTo(-w/2,h);shape.closePath();
  if(moon){const hole=new THREE.Path();hole.absarc(0,1.24,1.12,0,Math.PI*2,true);shape.holes.push(hole);}
  else if(w>4){for(const x of [-w*.28,w*.28]){const hole=new THREE.Path();hole.absellipse(x,1.55,.62,.67,0,Math.PI*2,true);shape.holes.push(hole);}}
  add(new THREE.ExtrudeGeometry(shape,{depth:.28,bevelEnabled:true,bevelThickness:.015,bevelSize:.015,bevelSegments:2,steps:1,curveSegments:48}),mats.plaster,[cx,.12,cz]);
  box(w+.12,.14,.5,[cx,h+.23,cz+.14],mats.tile);
  for(let x=-w/2;x<w/2;x+=.13)beam([cx+x,h+.3,cz-.12],[cx+x,h+.3,cz+.42],.034,mats.tile);
  box(w,.25,.4,[cx,.22,cz+.14],mats.stone);
  if(moon){const pts=[];for(let i=0;i<=96;i++){const a=i/96*Math.PI*2;pts.push([cx+Math.cos(a)*1.17,1.36+Math.sin(a)*1.17,cz+.32]);}curve(pts,.065,mats.stone);}
  else if(w>4)for(const x of [-w*.28,w*.28]){const pts=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;pts.push([cx+x+Math.cos(a)*.65,1.67+Math.sin(a)*.7,cz+.32]);}curve(pts,.045,mats.wood);for(const dx of [-.36,0,.36]){const dh=Math.sqrt(1-dx*dx/.38)*.62;beam([cx+x+dx,1.67-dh,cz+.33],[cx+x+dx,1.67+dh,cz+.33],.026,mats.wood);}beam([cx+x-.61,1.67,cz+.33],[cx+x+.61,1.67,cz+.33],.026,mats.wood);}
 }
 wall(-2.2,-1.5,3.7,2.75,true);wall(-11,-10,8.6,2.7);wall(1.5,-11,12,2.7);wall(11,-10,7,2.35);
 // Two hanging lanterns give scale, without turning the garden into a festival set.
 const silk=new THREE.MeshStandardMaterial({color:0xd9ae65,roughness:.9,emissive:0xb77732,emissiveIntensity:.18});
 for(const x of [-1.5,3.7]){beam([x,2.65,2.3],[x,2.4,2.3],.012);const g=new THREE.SphereGeometry(.17,16,12);g.scale(1,1.32,1);add(g,silk,[x,2.25,2.3]);box(.24,.045,.24,[x,2.47,2.3],mats.wood);box(.2,.045,.2,[x,2.04,2.3],mats.wood);beam([x,2.01,2.3],[x,1.87,2.3],.009,mats.trim);}
 for(const [material,geos]of batches){const geo=mergeGeometries(geos,false);if(!geo)throw new Error('Garden room geometry merge failed');const mesh=new THREE.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);for(const g of geos)g.dispose();}
}
