import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weld, quantize } from '@gltf-transform/functions';
import fs from 'fs';
const SRC = process.argv[2], OUT = process.argv[3];
const KEEP = new Set(['Idle', 'Walk', 'PickUp', 'Walk_Carry']);
const ANIM_SOURCE = 'Casual_Male.gltf'; // file duy nhất giữ clip — mọi nhân vật dùng chung khung xương
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let total = 0;
for (const f of fs.readdirSync(SRC).filter((f) => f.endsWith('.gltf'))) {
  const doc = await io.read(`${SRC}/${f}`);
  for (const a of doc.getRoot().listAnimations()) {
    if (KEEP.has(a.getName()) && f === ANIM_SOURCE) continue;
    for (const c of a.listChannels()) c.dispose();
    for (const s of a.listSamplers()) s.dispose();
    a.dispose();
  }
  // accessor của clip đã xoá vẫn còn treo ở root → xoá hẳn
  for (const acc of doc.getRoot().listAccessors()) if (acc.listParents().every((p) => p.propertyType === 'Root')) acc.dispose();
  await doc.transform(dedup(), prune({ keepLeaves: true }), weld(), quantize());
  const out = `${OUT}/${f.replace('.gltf', '.glb')}`;
  await io.write(out, doc);
  total += fs.statSync(out).size;
  console.log(out.split('/').pop(), (fs.statSync(out).size / 1024).toFixed(0) + ' KB', doc.getRoot().listAnimations().map((a) => a.getName()).join(','));
}
console.log('total', (total / 1048576).toFixed(1), 'MB');
