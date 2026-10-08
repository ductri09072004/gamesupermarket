import assert from 'node:assert/strict';
import fs from 'node:fs';
const manifest=JSON.parse(fs.readFileSync('public/assets/manifest.json','utf8'));
for(const id of ['tree_small_02','island_tree_01','jacaranda_tree']){
 const file=fs.readFileSync(`public/assets/models/city/${id}.glb`);
 assert.equal(file.readUInt32LE(0),0x46546c67);
 assert(file.length<3*1024*1024);
 const gltf=JSON.parse(file.subarray(20,20+file.readUInt32LE(12)).toString());
 const primitives=gltf.meshes.flatMap(m=>m.primitives);
 const triangles=primitives.reduce((sum,p)=>sum+gltf.accessors[p.indices].count/3,0);
 assert(triangles<25000&&triangles>5000);
 const leaves=gltf.materials.find(m=>m.name.includes('leaves'));
 assert.equal(leaves.alphaMode,'MASK');assert.equal(leaves.doubleSided,true);
 assert(leaves.pbrMetallicRoughness.baseColorTexture);
 const leafPrimitive=primitives.find(p=>gltf.materials[p.material]===leaves);
 assert.equal(gltf.accessors[leafPrimitive.attributes.POSITION].count%4,0);
 assert.equal(gltf.accessors[leafPrimitive.indices].count,48000);
 assert(gltf.buffers.every(b=>!b.uri));assert(gltf.images.every(i=>i.bufferView!==undefined));
 assert(manifest.city.includes(`city/${id}.glb`));
 console.log(`${id}: ${triangles} triangles, ${(file.length/1048576).toFixed(2)} MiB, embedded leaf mask`);
}
