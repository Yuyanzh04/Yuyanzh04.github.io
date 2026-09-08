import * as THREE from 'three';
export async function loadDetails(){
 const loader=new THREE.TextureLoader(),details={};
 await Promise.all(['tile','wood','plaster','stone'].map(async kind=>{
  details[kind]=await Promise.all(['color','rough','normal'].map(async type=>{
   const map=await loader.loadAsync(new URL(`../textures/${kind}-${type}.webp`,import.meta.url).href);
   map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=8;
   if(type==='color')map.colorSpace=THREE.SRGBColorSpace;
   return map;
  }));
 }));return details;
}
export function applyDetails(material,details,kind){
 if(material.name.includes('snow')||material.name.includes('paper')||material.name.includes('light'))return;
 kind??=material.name.includes('roof')?'tile':material.name.includes('wood')||material.name.includes('paint')?'wood':material.name.includes('stone')?'stone':'plaster';
 const [map,roughnessMap,normalMap]=details[kind];Object.assign(material,{map,roughnessMap,normalMap});
 material.normalScale.setScalar(kind==='wood'?.65:kind==='stone'?.8:.4);material.needsUpdate=true;
}
