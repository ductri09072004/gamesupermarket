import { createRequire } from 'module'; import fs from 'fs'; const r = createRequire(import.meta.url);
const { chromium } = r('/opt/node22/lib/node_modules/playwright');
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const rule = (n) => /Story/.test(n) ? [0.025, 0.85] : /Tree/.test(n) ? [0.026, 0.8] : /Bush/.test(n) ? [0.011, 0.8]
  : /Car|SUV|Taxi|Bus/.test(n) ? [0.01, 0.45] : /Streetlight/.test(n) ? [0.045, 0.5] : /TrafficLight/.test(n) ? [0.022, 0.5]
  : /TrafficCone/.test(n) ? [null, 0.6] : [null, 0.6];
const b = await chromium.launch(); const p = await b.newPage();
p.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text()); });
await p.goto('http://localhost:8765/convert.html'); await p.waitForFunction(() => window.done);
const files = fs.readdirSync('src').filter((f) => f.endsWith('.fbx'));
for (const f of files) {
  let [sc, rough] = rule(f);
  if (sc === null) { const i = await p.evaluate((n) => window.inspect(n), f); sc = (/Cone/.test(f) ? 0.7 : 2.6) / i.size[1]; }
  const res = await p.evaluate(([n, s, r]) => window.convert(n, s, r), [f, sc, rough]);
  const out = `${OUT}/${f.replace('.fbx', '.glb')}`; fs.writeFileSync(out, Buffer.from(res.b64, 'base64'));
  console.log(f, 'size(m)', res.size.join('x'), 'mats', res.mats, (fs.statSync(out).size / 1024).toFixed(0) + 'KB');
}
await b.close();
