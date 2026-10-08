import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import {leafCards} from './leaf-cards.mjs';
const require=createRequire(path.resolve('downloads/tree-review/tools/package.json'));
const {NodeIO}=require('@gltf-transform/core');
const {ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {dedup,weld,prune,simplifyPrimitive,transformMesh,textureCompress,getBounds}=require('@gltf-transform/functions');
const {MeshoptSimplifier}=require('meshoptimizer');
const sharp=require('sharp');
const source=path.resolve('downloads/tree-review');
const out=path.resolve('public/assets/models/city');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;
const simplifier={...MeshoptSimplifier,simplify:(i,p,s,t,e,f)=>MeshoptSimplifier.simplify(i,p,s,t,e,[...(f||[]),'Permissive','Prune'])};
const report=[];
for(const [id,height] of [['tree_small_02',6],['island_tree_01',4.8],['jacaranda_tree',7]]){
 const doc=await io.read(path.join(source,id,`${id}_1k.gltf`));
 const count=()=>doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((a,p)=>a+p.getIndices().getCount()/3,0);
 const before=count(); const bounds=getBounds(doc.getRoot().listScenes()[0]);
 const k=height/(bounds.max[1]-bounds.min[1]);
 // Align the trunk base with its sidewalk collider, rather than the canopy centre.
 const primitives=doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives());
 const trunk=primitives.find(p=>/trunk|bark/i.test(p.getMaterial().getName()))??primitives.find(p=>!/leaves/i.test(p.getMaterial().getName()));
 const pos=trunk.getAttribute('POSITION').getArray();const base=[];
 for(let i=0;i<pos.length;i+=3)if(pos[i+1]<bounds.min[1]+(bounds.max[1]-bounds.min[1])*.02)base.push([pos[i],pos[i+2]]);
 const cx=(Math.min(...base.map(p=>p[0]))+Math.max(...base.map(p=>p[0])))/2,cz=(Math.min(...base.map(p=>p[1]))+Math.max(...base.map(p=>p[1])))/2;
 const matrix=[k,0,0,0,0,k,0,0,0,0,k,0,-cx*k,-bounds.min[1]*k,-cz*k,1];
 await doc.transform(dedup(),weld());
 for(const mesh of doc.getRoot().listMeshes()){
  transformMesh(mesh,matrix);
  for(const p of mesh.listPrimitives()){
   const leaves=/leaves/i.test(p.getMaterial().getName());
   if(leaves)leafCards(doc,p);
   else simplifyPrimitive(p,{simplifier,ratio:Math.min(1,3000/(p.getIndices().getCount()/3)),error:.008});
  }
 }
 for(const mat of doc.getRoot().listMaterials())if(/leaves/i.test(mat.getName())){
  const tex=mat.getBaseColorTexture();
  const alpha=await sharp(path.join(source,id,'textures/leaves_alpha_1k.png')).extractChannel(0).raw().toBuffer();
  tex.setImage(await sharp(tex.getImage()).removeAlpha().joinChannel(alpha,{raw:{width:1024,height:1024,channels:1}}).png().toBuffer()).setMimeType('image/png');
  mat.setAlphaMode('MASK').setAlphaCutoff(.15).setDoubleSided(true);
 }
 await doc.transform(prune(),dedup(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],quality:82}));
 const file=path.join(out,`${id}.glb`);await io.write(file,doc);
 const row={id,height,originalTriangles:before,triangles:count(),bytes:(await fs.stat(file)).size};report.push(row);console.log(row);
}
await fs.writeFile(path.join(source,'optimized-stats.json'),JSON.stringify(report,null,2));
