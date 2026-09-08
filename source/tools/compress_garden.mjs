import {NodeIO} from '@gltf-transform/core';
import {EXTMeshoptCompression} from '@gltf-transform/extensions';
import {weld,reorder,prune} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import fs from 'node:fs/promises';
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const [input,output]=process.argv.slice(2);const doc=await io.read(input);
const stats=d=>({triangles:d.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((a,p)=>a+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0),0),vertices:d.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((a,p)=>a+p.getAttribute('POSITION').getCount(),0),0),nodes:d.getRoot().listNodes().map(n=>n.getName())});
const before=stats(doc),normals=new Set();
for(const m of doc.getRoot().listMeshes())for(const p of m.listPrimitives()){const n=p.getAttribute('NORMAL');if(n){normals.add(n);p.setAttribute('NORMAL',null);}}
for(const n of normals)n.dispose();
await doc.transform(weld(),reorder({encoder:MeshoptEncoder}),prune({keepLeaves:true}));
// No quantize() or lossy FILTER preprocessing: POSITION remains Float32.
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
await io.write(output,doc);
const decoded=await io.read(output),after=stats(decoded);
if(before.triangles!==after.triangles)throw Error('Triangle count changed');
if(before.nodes.some(n=>!after.nodes.includes(n)))throw Error('Named scene node lost');
const report={before,after,inputBytes:(await fs.stat(input)).size,outputBytes:(await fs.stat(output)).size,positionComponentTypes:decoded.getRoot().listMeshes().flatMap(m=>m.listPrimitives().map(p=>p.getAttribute('POSITION').getComponentType()))};
await fs.writeFile(output+'.report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
