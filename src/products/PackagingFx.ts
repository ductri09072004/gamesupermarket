import * as THREE from 'three';

/**
 * Hạt nhiễu thủ tục cho bao bì: bản đồ pháp tuyến (nhăn ni-lông, thớ giấy, vết lõm lon) và độ nhám loang.
 * Làm 1 lần rồi dùng chung cho mọi sản phẩm — giúp bao bì bắt sáng không đều, trông như vật thật chứ không phải khối nhựa phẳng.
 */

const SIZE = 256;
const cache = new Map<string, THREE.CanvasTexture>();

/** Số ngẫu nhiên xác định theo seed (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nhiễu giá trị tuần hoàn nhiều tầng (tile được), trả về mảng SIZE×SIZE trong [0,1]. */
function fractalNoise(seed: number, octaves: number, base: number): Float32Array {
  const out = new Float32Array(SIZE * SIZE);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = base << o;
    const r = rng(seed + o * 101);
    const grid = new Float32Array(n * n);
    for (let i = 0; i < grid.length; i++) grid[i] = r();
    for (let y = 0; y < SIZE; y++) {
      const fy = (y / SIZE) * n;
      const y0 = Math.floor(fy);
      const ty = fy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < SIZE; x++) {
        const fx = (x / SIZE) * n;
        const x0 = Math.floor(fx);
        const tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const a = grid[(y0 % n) * n + (x0 % n)];
        const b = grid[(y0 % n) * n + ((x0 + 1) % n)];
        const c = grid[((y0 + 1) % n) * n + (x0 % n)];
        const d = grid[((y0 + 1) % n) * n + ((x0 + 1) % n)];
        out[y * SIZE + x] += (a + (b - a) * sx + (c - a + (d - c) * sx - (b - a) * sx) * sy) * amp;
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** Bản đồ chiều cao → pháp tuyến (khác biệt hữu hạn, tuần hoàn). */
function heightToNormal(h: Float32Array, strength: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d')!;
  const img = g.createImageData(SIZE, SIZE);
  const at = (x: number, y: number) => h[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const i = (y * SIZE + x) * 4;
      img.data[i] = (-dx * inv * 0.5 + 0.5) * 255;
      img.data[i + 1] = (dy * inv * 0.5 + 0.5) * 255;
      img.data[i + 2] = (inv * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function memo(key: string, make: () => THREE.CanvasTexture): THREE.CanvasTexture {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

/** Nhăn ni-lông / túi: nhiễu mềm + vài đường gấp dài. */
export function crinkleNormal(): THREE.CanvasTexture {
  return memo('crinkle', () => {
    const h = fractalNoise(11, 4, 3);
    const r = rng(7);
    for (let k = 0; k < 14; k++) {
      // đường gấp: gờ hẹp theo hướng ngẫu nhiên
      const a = r() * Math.PI;
      const cx = r() * SIZE;
      const cy = r() * SIZE;
      const len = 40 + r() * 90;
      for (let s = -len; s < len; s += 1) {
        const x = Math.round(cx + Math.cos(a) * s);
        const y = Math.round(cy + Math.sin(a) * s);
        for (let w = -2; w <= 2; w++) {
          const px = (((x + Math.round(-Math.sin(a) * w)) % SIZE) + SIZE) % SIZE;
          const py = (((y + Math.round(Math.cos(a) * w)) % SIZE) + SIZE) % SIZE;
          h[py * SIZE + px] += (1 - Math.abs(w) / 3) * 0.12 * (1 - Math.abs(s) / len);
        }
      }
    }
    return heightToNormal(h, 9);
  });
}

/** Thớ giấy / bìa cứng: hạt mịn. */
export function paperNormal(): THREE.CanvasTexture {
  return memo('paper', () => heightToNormal(fractalNoise(23, 3, 24), 4));
}

/** Vết lõm / xước nhẹ trên lon kim loại. */
export function dentNormal(): THREE.CanvasTexture {
  return memo('dent', () => heightToNormal(fractalNoise(31, 4, 4), 5));
}

/** Độ nhám loang (vệt vecni không đều, dấu vân tay): giá trị 0.55–1 nhân với roughness của vật liệu. */
export function grainRoughness(): THREE.CanvasTexture {
  return memo('grain', () => {
    const h = fractalNoise(47, 4, 5);
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const g = c.getContext('2d')!;
    const img = g.createImageData(SIZE, SIZE);
    for (let i = 0; i < h.length; i++) {
      const v = Math.round((0.55 + h[i] * 0.45) * 255);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.NoColorSpace;
    return tex;
  });
}
