import * as THREE from 'three';
import { ROAD_DAMAGE, ROAD_WIDTH } from '../config/city';
import { mulberry32, type Rng } from '../core/Random';
import type { Rect } from './CityLayout';

/** Hư hỏng mặt đường: miếng vá nhựa đường, nắp cống. */
export interface RoadMark {
  kind: 'patch' | 'manhole';
  x: number;
  z: number;
  /** Bán kính (nắp cống) hoặc nửa chiều dài (miếng vá) */
  r: number;
  rot: number;
  /** Tỉ lệ ngang/dọc (miếng vá dài) */
  aspect: number;
}

/**
 * Sinh dữ liệu thuần theo hạt giống: miếng vá rải theo mặt đường, nắp cống gần tim đường.
 * `hotspots`: đoạn đường xuống cấp nặng (vd. trước cửa hàng) — thêm cụm miếng vá dày.
 */
export function roadDamage(roads: Rect[], hotspots: Rect[] = [], avoid: Rect[] = []): RoadMark[] {
  const rng = mulberry32(ROAD_DAMAGE.seed);
  const out: RoadMark[] = [];
  for (const h of hotspots) {
    const len = h.x1 - h.x0;
    const mid = (h.z0 + h.z1) / 2;
    for (let i = 0; i < Math.round(len / 4); i++) {
      const x = h.x0 + rng() * len;
      if (rng() < 0.5) out.push({ kind: 'patch', x: x + 2, z: mid + (rng() - 0.5) * (ROAD_WIDTH - 2), r: 0.4 + rng() * 0.5, rot: (rng() - 0.5) * 0.3, aspect: 0.5 + rng() * 0.4 });
    }
  }
  for (const r of roads) {
    const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
    const len = alongX ? r.x1 - r.x0 : r.z1 - r.z0;
    const mid = alongX ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2;
    const start = alongX ? r.x0 : r.z0;
    const at = (t: number, off: number): [number, number] => (alongX ? [start + t, mid + off] : [mid + off, start + t]);
    const scatter = (per100: number, make: (rng: Rng) => Omit<RoadMark, 'x' | 'z'> & { off: number }) => {
      const n = Math.round((len / 100) * per100 * (0.6 + rng() * 0.8));
      for (let i = 0; i < n; i++) {
        const m = make(rng);
        const [x, z] = at(2 + rng() * (len - 4), m.off);
        out.push({ kind: m.kind, x, z, r: m.r, rot: m.rot, aspect: m.aspect });
      }
    };
    scatter(ROAD_DAMAGE.patchesPer100m, (g) => ({ kind: 'patch', r: 0.4 + g() * 0.55, rot: (alongX ? 0 : Math.PI / 2) + (g() - 0.5) * 0.3, aspect: 0.35 + g() * 0.4, off: (g() - 0.5) * (ROAD_WIDTH - 2) }));
    scatter(ROAD_DAMAGE.manholesPer100m, (g) => ({ kind: 'manhole', r: 0.36, rot: g() * 6.28, aspect: 1, off: (g() - 0.5) * 1.6 }));
  }
  // né vạch qua đường (mark nằm lọt vùng avoid thì bỏ)
  return out.filter((m) => !avoid.some((a) => m.x + m.r > a.x0 && m.x - m.r < a.x1 && m.z + m.r > a.z0 && m.z - m.r < a.z1));
}

function tex(draw: (g: CanvasRenderingContext2D, S: number) => void, S = 256): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  draw(c.getContext('2d')!, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Đường viền méo ngẫu nhiên quanh tâm. */
function blob(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, rng: Rng, jag = 0.25): void {
  g.beginPath();
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 - jag / 2 + rng() * jag);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
}

const textures = () => {
  const rng = mulberry32(99);
  const patch = tex((g, S) => {
    // miếng vá nhựa: hơi tối hơn mặt đường, viền méo có vệt nhựa chảy, lấm tấm đá dăm (mờ dần ở mép)
    g.globalAlpha = 0.8;
    blob(g, S / 2, S / 2, S * 0.46, rng, 0.18);
    g.fillStyle = '#35332f';
    g.fill();
    g.globalAlpha = 1;
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(18,17,15,0.7)';
    g.stroke();
    for (let i = 0; i < 700; i++) {
      const a = rng() * 6.28;
      const d = Math.sqrt(rng()) * S * 0.4;
      g.fillStyle = rng() < 0.5 ? 'rgba(95,92,86,0.55)' : 'rgba(18,18,16,0.45)';
      g.fillRect(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, 2, 2);
    }
  });
  const manhole = tex((g, S) => {
    g.beginPath();
    g.arc(S / 2, S / 2, S * 0.48, 0, Math.PI * 2);
    g.fillStyle = '#55524c';
    g.fill();
    g.beginPath();
    g.arc(S / 2, S / 2, S * 0.42, 0, Math.PI * 2);
    g.fillStyle = '#3a3935';
    g.fill();
    g.save();
    g.clip();
    g.strokeStyle = '#4a4843';
    g.lineWidth = 5;
    for (let i = -S; i < S; i += 18) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke();
      g.beginPath(); g.moveTo(i + S, 0); g.lineTo(i, S); g.stroke();
    }
    g.restore();
  });
  return { patch, manhole };
};

/** Decal phẳng trên mặt đường (InstancedMesh / loại), không ghi depth để khỏi nhấp nháy với mặt đường. */
export function buildRoadDamage(marks: RoadMark[], group: THREE.Group): void {
  const t = textures();
  const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const kinds: Array<[RoadMark['kind'], number]> = [['patch', -0.0285], ['manhole', -0.0265]];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (const [kind, y] of kinds) {
    const list = marks.filter((k) => k.kind === kind);
    if (!list.length) continue;
    const mat = new THREE.MeshStandardMaterial({
      map: t[kind], transparent: true, depthWrite: false, roughness: kind === 'manhole' ? 0.55 : 0.95,
      metalness: kind === 'manhole' ? 0.4 : 0, polygonOffset: true, polygonOffsetFactor: -2,
    });
    const inst = new THREE.InstancedMesh(plane, mat, list.length);
    list.forEach((k, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), k.rot);
      inst.setMatrixAt(i, m.compose(new THREE.Vector3(k.x, y, k.z), q, new THREE.Vector3(k.r * 2, 1, k.r * 2 * k.aspect)));
    });
    inst.receiveShadow = true;
    inst.renderOrder = 1;
    inst.computeBoundingSphere();
    group.add(inst);
  }
}
