import * as THREE from 'three';
import { alleyHeight, alleyLength, type Alley, type AlleyDecor } from './Alleys';

/** Canvas → texture sRGB, lọc nhẹ */
function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Cửa sắt kéo (khung + chấn song + hoa văn đầu cửa) mở vào gian nhà tối; màu sơn theo biến thể. */
function doorTexture(variant: number): THREE.CanvasTexture {
  const ink = ['#1d1d1f', '#2b4a3a', '#4a2f22', '#6b3b2a'][variant % 4];
  return canvasTexture(128, 256, (g) => {
    g.fillStyle = '#17120e';
    g.fillRect(0, 0, 128, 256);
    // ánh sáng yếu hắt vào trong nhà
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, 'rgba(120,95,60,0.35)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(8, 8, 112, 240);
    g.strokeStyle = ink;
    g.fillStyle = ink;
    g.lineWidth = 8;
    g.strokeRect(5, 5, 118, 246);
    g.lineWidth = 3;
    for (let x = 18; x < 118; x += 11) { g.beginPath(); g.moveTo(x, 12); g.lineTo(x, 248); g.stroke(); }
    for (const y of [92, 168]) { g.lineWidth = 5; g.beginPath(); g.moveTo(8, y); g.lineTo(120, y); g.stroke(); }
    // hoa văn vòm phía trên
    g.lineWidth = 3;
    for (let x = 14; x < 114; x += 22) { g.beginPath(); g.arc(x + 11, 70, 11, Math.PI, 0); g.stroke(); }
    g.fillRect(96, 130, 6, 22); // tay nắm
  });
}

/** Ô cửa sổ chấn song sắt */
function windowTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#1a1d22';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(150,170,180,0.25)';
    g.fillRect(10, 10, 108, 108);
    g.strokeStyle = '#2a2a2c';
    g.lineWidth = 6;
    g.strokeRect(3, 3, 122, 122);
    g.lineWidth = 3;
    for (let k = 20; k < 120; k += 17) { g.beginPath(); g.moveTo(k, 8); g.lineTo(k, 120); g.stroke(); g.beginPath(); g.moveTo(8, k); g.lineTo(120, k); g.stroke(); }
  });
}

const ADS = [
  ['SƠN NƯỚC', 'ĐT: 0905 123 456'], ['CHO THUÊ PHÒNG TRỌ', 'LH: 0987 654 321'], ['THÔNG CỐNG NGHẸT', '24/24 · 0912 888 777'],
  ['KHOAN CẮT BÊ TÔNG', '0903 456 789'], ['SỬA ĐIỆN NƯỚC', '0976 321 654'], ['CHỐNG THẤM · SƠN SỬA NHÀ', '0933 112 233'],
];

/** Chữ quảng cáo viết sơn tay lên tường (nền trong suốt): mực xanh / đỏ / đen, nét không đều. */
function adTexture(variant: number): THREE.CanvasTexture {
  const [t1, t2] = ADS[variant % ADS.length];
  const ink = ['#1f4e9c', '#b3261e', '#1b1b1b'][variant % 3];
  return canvasTexture(256, 128, (g) => {
    g.clearRect(0, 0, 256, 128);
    g.fillStyle = ink;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '900 36px "Be Vietnam Pro", "Alfa Slab One", Arial';
    g.fillText(t1, 128, 40, 240);
    g.font = '800 30px "Be Vietnam Pro", Arial';
    g.fillText(t2, 128, 88, 240);
    // sơn loang & bong: lỗ nhỏ trong suốt
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 140; i++) {
      g.globalAlpha = 0.35 + ((i * 37) % 10) / 20;
      g.fillRect((i * 97) % 256, (i * 53) % 128, 2 + (i % 3), 2);
    }
  });
}

/** Biển số nhà tráng men xanh viền trắng */
function plateTexture(variant: number): THREE.CanvasTexture {
  const nums = ['12', '37/4', '5B', '21/6', '9', '48A'];
  return canvasTexture(128, 80, (g) => {
    g.fillStyle = '#1c4fa0';
    g.fillRect(0, 0, 128, 80);
    g.strokeStyle = '#f2f2f2';
    g.lineWidth = 4;
    g.strokeRect(4, 4, 120, 72);
    g.fillStyle = '#f7f7f7';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '800 40px Arial';
    g.fillText(nums[variant % nums.length], 64, 42, 108);
  });
}

/**
 * Nền hẻm bê tông tối màu đã cũ: tấm đổ lệch màu, mảng vá xi măng sáng hơn, vết dầu / ẩm loang, rêu ở khe, các vết nứt dài
 * phân nhánh và khe co giãn. Trả về vật liệu có cả bump (nứt lún xuống).
 */
export function alleyFloorMaterial(): THREE.MeshStandardMaterial {
  const S = 512;
  const color = document.createElement('canvas');
  const bump = document.createElement('canvas');
  color.width = color.height = bump.width = bump.height = S;
  const c = color.getContext('2d')!;
  const b = bump.getContext('2d')!;
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  c.fillStyle = '#55524d';
  c.fillRect(0, 0, S, S);
  b.fillStyle = '#9a9a9a';
  b.fillRect(0, 0, S, S);
  // tấm bê tông lệch tông + khe co giãn
  for (const [x0, y0, w, h] of [[0, 0, 256, 256], [256, 0, 256, 256], [0, 256, 256, 256], [256, 256, 256, 256]]) {
    c.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rnd() * 0.05})`;
    c.fillRect(x0, y0, w, h);
  }
  c.strokeStyle = 'rgba(15,14,13,0.75)';
  b.strokeStyle = '#3a3a3a';
  c.lineWidth = b.lineWidth = 3;
  for (const v of [0, 256]) { c.beginPath(); c.moveTo(v, 0); c.lineTo(v, S); c.stroke(); b.beginPath(); b.moveTo(v, 0); b.lineTo(v, S); b.stroke(); c.beginPath(); c.moveTo(0, v); c.lineTo(S, v); c.stroke(); b.beginPath(); b.moveTo(0, v); b.lineTo(S, v); b.stroke(); }
  // hạt sạn & vết loang ẩm / dầu
  for (let i = 0; i < 9000; i++) {
    c.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.12)';
    c.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  for (let i = 0; i < 26; i++) {
    const x = rnd() * S, y = rnd() * S, r = 14 + rnd() * 46;
    const g = c.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, rnd() < 0.5 ? 'rgba(20,18,16,0.38)' : 'rgba(30,38,30,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // mảng vá xi măng mới hơn
  for (let i = 0; i < 5; i++) {
    const w = 40 + rnd() * 90, h = 20 + rnd() * 60, x = rnd() * (S - w), y = rnd() * (S - h);
    c.fillStyle = 'rgba(140,134,124,0.35)';
    c.fillRect(x, y, w, h);
    c.strokeStyle = 'rgba(20,18,16,0.55)';
    c.lineWidth = 2;
    c.strokeRect(x, y, w, h);
    b.strokeStyle = '#555';
    b.lineWidth = 2;
    b.strokeRect(x, y, w, h);
  }
  // vết nứt dài phân nhánh
  const crack = (x: number, y: number, ang: number, len: number, w: number, depth: number) => {
    let px = x, py = y;
    for (let i = 0; i < len; i += 6) {
      ang += (rnd() - 0.5) * 0.7;
      const nx = px + Math.cos(ang) * 6, ny = py + Math.sin(ang) * 6;
      c.strokeStyle = 'rgba(8,8,8,0.9)';
      c.lineWidth = w;
      c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny); c.stroke();
      b.strokeStyle = '#1c1c1c';
      b.lineWidth = w + 1;
      b.beginPath(); b.moveTo(px, py); b.lineTo(nx, ny); b.stroke();
      px = nx; py = ny;
      if (depth > 0 && rnd() < 0.09) crack(px, py, ang + (rnd() < 0.5 ? 1 : -1) * (0.6 + rnd() * 0.7), len * 0.5, Math.max(1, w - 1), depth - 1);
    }
  };
  for (let i = 0; i < 9; i++) crack(rnd() * S, rnd() * S, rnd() * Math.PI * 2, 120 + rnd() * 230, 2 + rnd() * 1.5, 2);
  const mk = (cv: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return new THREE.MeshStandardMaterial({ map: mk(color, true), bumpMap: mk(bump, false), bumpScale: 2.2, roughness: 0.93 });
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const ONE = new THREE.Vector3(1, 1, 1);
const col = new THREE.Color();

/** Sàn hẻm: dải lưới dọc hẻm, cao độ theo dốc của hẻm (nối liền vỉa hè ở hai đầu). */
function groundGeometry(alleys: Alley[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (const a of alleys) {
    const len = alleyLength(a);
    const n = Math.max(2, Math.ceil(len / 0.6));
    const base = pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * len;
      for (const side of [0, 1]) {
        const x = a.axis === 'z' ? (side ? a.rect.x1 : a.rect.x0) : a.rect.x0 + s;
        const z = a.axis === 'z' ? a.rect.z0 + s : side ? a.rect.z1 : a.rect.z0;
        pos.push(x, alleyHeight(a, x, z) + 0.006, z);
        uv.push(x / 3.2, -z / 3.2);
      }
      if (i < n) {
        const k = base + i * 2;
        // mặt trên hướng +Y theo cả hai hướng trục
        if (a.axis === 'z') idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
        else idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, n: number): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
  m.count = n;
  m.castShadow = false;
  m.receiveShadow = true;
  return m;
}

const std = (color: number, roughness = 0.85, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });

/**
 * Dựng sàn hẻm (dốc) và đồ sinh hoạt: cây chậu, túi rác / thùng rác, xô, dép, bàn thờ treo tường có đèn đỏ, dây phơi quần áo.
 * Trả về vật liệu phát sáng (đèn bàn thờ) để bật vào ban đêm.
 */
export function buildAlleys(alleys: Alley[], decor: AlleyDecor[], floor: THREE.Material, group: THREE.Group): THREE.MeshStandardMaterial[] {
  const lit: THREE.MeshStandardMaterial[] = [];
  if (!alleys.length) return lit;
  const ground = new THREE.Mesh(groundGeometry(alleys), floor);
  ground.receiveShadow = true;
  group.add(ground);

  const of = (k: AlleyDecor['kind']) => decor.filter((d) => d.kind === k);
  const place = (m: THREE.InstancedMesh, i: number, x: number, y: number, z: number, ry = 0, sx = 1, sy = 1, sz = 1) => {
    tmpQ.setFromEuler(tmpE.set(0, ry, 0));
    m.setMatrixAt(i, tmpM.compose(new THREE.Vector3(x, y, z), tmpQ, ONE.clone().set(sx, sy, sz)));
  };

  // cây chậu: chậu đất nung + tán lá
  const plants = of('plant');
  if (plants.length) {
    const pots = instanced(new THREE.CylinderGeometry(0.13, 0.09, 0.22, 10), std(0xffffff, 0.8), plants.length);
    const leaves = instanced(new THREE.IcosahedronGeometry(0.17, 1), std(0xffffff, 0.9), plants.length);
    plants.forEach((d, i) => {
      const s = 0.8 + d.seed * 0.7;
      place(pots, i, d.x, d.y + 0.11 * s, d.z, 0, s, s, s);
      pots.setColorAt(i, col.setHex([0xb5653a, 0xa3552e, 0xe8e2d4, 0x4f7a8a][Math.floor(d.seed * 4) % 4]));
      place(leaves, i, d.x, d.y + 0.34 * s, d.z, d.seed * 6, s * 1.1, s * (0.9 + d.seed * 0.5), s * 1.1);
      leaves.setColorAt(i, col.setHSL(0.27 + d.seed * 0.08, 0.5, 0.28 + d.seed * 0.12));
    });
    group.add(pots, leaves);
  }

  // túi rác đen / thùng rác nhựa xanh
  const trash = of('trash');
  if (trash.length) {
    const bags = trash.filter((d) => d.seed < 0.55);
    const bins = trash.filter((d) => d.seed >= 0.55);
    const bagM = instanced(new THREE.SphereGeometry(0.17, 10, 8), std(0x1c1d20, 0.6), bags.length);
    bags.forEach((d, i) => place(bagM, i, d.x, d.y + 0.14, d.z, d.seed * 9, 1, 0.8, 0.95));
    const binM = instanced(new THREE.CylinderGeometry(0.2, 0.17, 0.5, 12), std(0x3f7a45, 0.7), bins.length);
    bins.forEach((d, i) => place(binM, i, d.x, d.y + 0.25, d.z));
    group.add(bagM, binM);
  }

  const buckets = of('bucket');
  if (buckets.length) {
    const m = instanced(new THREE.CylinderGeometry(0.14, 0.11, 0.26, 12), std(0xffffff, 0.6), buckets.length);
    buckets.forEach((d, i) => {
      place(m, i, d.x, d.y + 0.13, d.z);
      m.setColorAt(i, col.setHex([0x2f6fb5, 0xc23b32, 0xd9a21b, 0x2f9a6a][Math.floor(d.seed * 4) % 4]));
    });
    group.add(m);
  }

  // dép tổ ong trước cửa: hai chiếc
  const sandals = of('sandals');
  if (sandals.length) {
    const m = instanced(new THREE.BoxGeometry(0.1, 0.025, 0.26), std(0xffffff, 0.7), sandals.length * 2);
    sandals.forEach((d, i) => {
      for (let k = 0; k < 2; k++) {
        place(m, i * 2 + k, d.x + (k ? 0.1 : -0.1), d.y + 0.013, d.z + k * 0.04, d.seed * 0.8 - 0.4);
        m.setColorAt(i * 2 + k, col.setHex([0x3a8f5a, 0xd96b3a, 0x2f5fb0, 0xcf3b4f][Math.floor(d.seed * 4) % 4]));
      }
    });
    group.add(m);
  }

  // bàn thờ ông Địa/Thần Tài treo tường: hộp gỗ đỏ + đèn đỏ nhỏ (sáng ban đêm)
  const shrines = of('shrine');
  if (shrines.length) {
    const box = instanced(new THREE.BoxGeometry(0.32, 0.4, 0.16), std(0x7a1f1a, 0.6), shrines.length);
    const lampMat = std(0x330000, 0.4, { emissive: 0xff2a14, emissiveIntensity: 0.9 });
    const lamp = instanced(new THREE.BoxGeometry(0.06, 0.1, 0.04), lampMat, shrines.length);
    lit.push(lampMat);
    shrines.forEach((d, i) => {
      // len = góc quay Y để mặt hướng ra lòng hẻm; dịch ra 0.08m so với mặt tường
      const nx = Math.sin(d.len);
      const nz = Math.cos(d.len);
      place(box, i, d.x + nx * 0.08, d.y, d.z + nz * 0.08, d.len);
      place(lamp, i, d.x + nx * 0.17, d.y + 0.1, d.z + nz * 0.17, d.len);
    });
    group.add(box, lamp);
  }

  // mặt tường: cửa sắt, ô cửa sổ chấn song, chữ quảng cáo sơn, biển số nhà — mỗi biến thể một mesh instanced
  const flat = new THREE.PlaneGeometry(1, 1);
  const wallItems = (kind: AlleyDecor['kind'], variants: number, w: number, h: number, tex: (v: number) => THREE.Texture, transparent: boolean) => {
    const items = of(kind);
    for (let v = 0; v < variants; v++) {
      const mine = items.filter((d) => Math.floor(d.seed * variants) % variants === v);
      if (!mine.length) continue;
      const mat = new THREE.MeshStandardMaterial({ map: tex(v), roughness: 0.75, transparent, alphaTest: transparent ? 0.25 : 0, polygonOffset: true, polygonOffsetFactor: -2 });
      const m = instanced(flat, mat, mine.length);
      mine.forEach((d, i) => {
        const nx = Math.sin(d.len);
        const nz = Math.cos(d.len);
        place(m, i, d.x + nx * 0.02, d.y + h / 2, d.z + nz * 0.02, d.len, w, h, 1);
      });
      group.add(m);
    }
  };
  wallItems('door', 4, 0.95, 2.05, doorTexture, false);
  wallItems('window', 1, 0.7, 0.7, windowTexture, false);
  wallItems('ad', ADS.length, 1.7, 0.85, adTexture, true);
  wallItems('plate', 6, 0.2, 0.125, plateTexture, false);

  // dây điện / cáp chằng chịt trên cao
  const cables = of('cable');
  if (cables.length) {
    const m = instanced(new THREE.BoxGeometry(1, 0.016, 0.016), std(0x1a1a1a, 0.7), cables.length);
    cables.forEach((d, i) => place(m, i, d.x, d.y, d.z, d.axis === 'x' ? 0 : Math.PI / 2, d.len, 1, 1));
    group.add(m);
  }

  // dây phơi quần áo dọc hẻm: dây mảnh + áo quần nhiều màu treo lủng lẳng
  const lines = of('laundry');
  if (lines.length) {
    const cloths: Array<{ x: number; y: number; z: number; ry: number; w: number; h: number; c: number }> = [];
    const wires = instanced(new THREE.BoxGeometry(1, 0.012, 0.012), std(0x2b2b2b, 0.8), lines.length);
    lines.forEach((d, i) => {
      const alongX = d.axis === 'x';
      place(wires, i, d.x, d.y, d.z, alongX ? 0 : Math.PI / 2, d.len, 1, 1);
      const n = Math.max(2, Math.floor(d.len / 0.55));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n - 0.5;
        const jitter = Math.sin((i + 1) * 12.9898 + k * 78.233) * 0.1;
        const h = 0.4 + (Math.sin(k * 3.1 + i) * 0.5 + 0.5) * 0.35;
        cloths.push({
          x: d.x + (alongX ? t * d.len + jitter : 0), y: d.y - h / 2 - 0.02, z: d.z + (alongX ? 0 : t * d.len + jitter),
          ry: alongX ? 0 : Math.PI / 2, w: 0.28 + (k % 3) * 0.08, h, c: Math.floor(Math.abs(Math.sin(k * 7.7 + i * 3.3)) * 6) % 6,
        });
      }
    });
    group.add(wires);
    const cloth = instanced(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide }), cloths.length);
    const palette = [0xf2efe6, 0x3e6fb0, 0xd34a4a, 0xe8c24a, 0x4fa07a, 0xb07ab5];
    cloths.forEach((c, i) => {
      place(cloth, i, c.x, c.y, c.z, c.ry, c.w, c.h, 1);
      cloth.setColorAt(i, col.setHex(palette[c.c]));
    });
    cloth.receiveShadow = false;
    group.add(cloth);
  }
  return lit;
}
