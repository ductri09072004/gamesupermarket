import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, quantize } from '@gltf-transform/functions';
import fs from 'fs';
const [SRC, OUT, ...names] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
let total = 0;
for (const n of names) {
  const doc = await io.read(`${SRC}/${n}.glb`);
  await doc.transform(dedup(), weld(), prune(), quantize());
  await io.write(`${OUT}/${n}.glb`, doc);
  total += fs.statSync(`${OUT}/${n}.glb`).size;
}
console.log('files', names.length, 'total', (total / 1048576).toFixed(2), 'MB');
