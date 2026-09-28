import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { POLE } from '../config/city';
import { mulberry32 } from '../core/Random';
import type { AABB } from './Colliders';
import type { Rect } from './CityLayout';

/**
 * Cột điện bê tông + dây điện chằng chịt kiểu phố Việt. Dữ liệu (vị trí cột, dây) sinh thuần từ bố cục;
 * phần dựng mesh gộp mọi dây thành 1 geometry và cột thành InstancedMesh.
 */

export interface PoleSpot {
  x: number;
  z: number;
  /** Có hộp biến áp + bó cáp cuộn */
  heavy: boolean;
  /** Hướng ra đường (rad) — xà ngang vuông góc lề */
  rot: number;
}

export interface Wire {
  a: THREE.Vector3;
  b: THREE.Vector3;
  sag: number;
}

/** Cột dọc mép lề của mọi vỉa hè; né cây/đèn (colliders) và các vùng `avoid` (sạp hàng rong, lối cửa siêu thị). */
export function polePlan(blocks: Rect[], colliders: AABB[], avoid: Rect[]): { poles: PoleSpot[]; wires: Wire[] } {
  const rng = mulberry32(POLE.seed);
  const W = POLE.walk;
  const blocked = (x: number, z: number) => {
    const r = { x0: x - 0.4, x1: x + 0.4, z0: z - 0.4, z1: z + 0.4 };
    return avoid.some((a) => r.x0 < a.x1 && r.x1 > a.x0 && r.z0 < a.z1 && r.z1 > a.z0)
      || colliders.some((c) => c.tag !== 'building' && r.x0 < c.maxX && r.x1 > c.minX && r.z0 < c.maxZ && r.z1 > c.minZ);
  };
  const poles: PoleSpot[] = [];
  const wires: Wire[] = [];
  const top = (p: PoleSpot, h: number, side: number) => new THREE.Vector3(
    p.x + Math.cos(p.rot) * side, h, p.z - Math.sin(p.rot) * side);
  for (const b of blocks) {
    // 4 dải: [trục, toạ độ lề, hướng quay ra đường, mặt tiền nhà]
    const strips: Array<{ along: 'x' | 'z'; from: number; to: number; curb: number; facade: number; rot: number }> = [
      { along: 'x', from: b.x0 + W, to: b.x1 - W, curb: b.z1 - POLE.inset, facade: b.z1 - W, rot: 0 },
      { along: 'x', from: b.x0 + W, to: b.x1 - W, curb: b.z0 + POLE.inset, facade: b.z0 + W, rot: Math.PI },
      { along: 'z', from: b.z0 + W, to: b.z1 - W, curb: b.x1 - POLE.inset, facade: b.x1 - W, rot: Math.PI / 2 },
      { along: 'z', from: b.z0 + W, to: b.z1 - W, curb: b.x0 + POLE.inset, facade: b.x0 + W, rot: -Math.PI / 2 },
    ];
    for (const s of strips) {
      const line: PoleSpot[] = [];
      for (let t = s.from + 4 + rng() * 4; t < s.to - 3; t += POLE.spacing + (rng() - 0.5) * 6) {
        let placed: PoleSpot | null = null;
        for (const shift of [0, 1.5, -1.5, 3]) {
          const u = t + shift;
          const [x, z] = s.along === 'x' ? [u, s.curb] : [s.curb, u];
          if (!blocked(x, z)) { placed = { x, z, heavy: rng() < 0.35, rot: s.rot }; break; }
        }
        if (placed) line.push(placed);
      }
      poles.push(...line);
      // dây chạy dọc giữa 2 cột liền nhau: nhiều sợi, độ cao & độ võng lệch nhau
      for (let i = 0; i + 1 < line.length; i++) {
        const [p, q] = [line[i], line[i + 1]];
        const n = 7 + Math.floor(rng() * 6);
        for (let k = 0; k < n; k++) {
          const h = POLE.height - 0.5 - rng() * 2.8;
          const side = (rng() - 0.5) * 1.1;
          const sag = 0.25 + rng() * 1.1;
          wires.push({ a: top(p, h, side), b: top(q, h + (rng() - 0.5) * 0.4, side + (rng() - 0.5) * 0.3), sag });
          // bó cáp: vài sợi đi sát nhau, võng lệch chút
          if (rng() < 0.45) {
            for (let j = 0; j < 2 + Math.floor(rng() * 3); j++) {
              const e = (rng() - 0.5) * 0.08;
              wires.push({ a: top(p, h + e, side + e), b: top(q, h + e, side - e), sag: sag + rng() * 0.12 });
            }
          }
        }
      }
      // dây kéo từ cột vào nhà (tầng 2–3), mỗi cột vài sợi toả ra hai bên
      for (const p of line) {
        const drops = 3 + Math.floor(rng() * 4);
        for (let k = 0; k < drops; k++) {
          const u = (s.along === 'x' ? p.x : p.z) + (rng() - 0.5) * 12;
          const y = 3.6 + rng() * 3;
          const end = s.along === 'x' ? new THREE.Vector3(u, y, s.facade) : new THREE.Vector3(s.facade, y, u);
          wires.push({ a: top(p, POLE.height - 2 - rng() * 1.5, 0), b: end, sag: 0.2 + rng() * 0.5 });
        }
      }
    }
  }
  // dây vắt ngang qua đường giữa 2 cột đối diện (mạng dây trên đầu — đặc trưng phố Việt)
  for (const p of poles) {
    for (const q of poles) {
      if (q === p || !((p.x < q.x) || (p.x === q.x && p.z < q.z))) continue;
      const alongX = Math.abs(Math.sin(p.rot)) < 0.5;
      const [dAlong, dAcross] = alongX ? [Math.abs(p.x - q.x), Math.abs(p.z - q.z)] : [Math.abs(p.z - q.z), Math.abs(p.x - q.x)];
      if (dAlong > 7 || dAcross < 7 || dAcross > 17 || Math.cos(p.rot - q.rot) > -0.5) continue;
      for (let k = 0; k < 2 + Math.floor(rng() * 3); k++) {
        const h = POLE.height - 0.4 - rng() * 1.6;
        wires.push({ a: top(p, h, (rng() - 0.5) * 1.2), b: top(q, h + (rng() - 0.5) * 0.5, (rng() - 0.5) * 1.2), sag: 0.5 + rng() * 1.1 });
      }
    }
  }
  return { poles, wires };
}

/** Điểm trên dây võng (parabol xấp xỉ dây xích). */
function sagPoints(w: Wire, n: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = w.a.clone().lerp(w.b, t);
    p.y -= 4 * w.sag * t * (1 - t);
    out.push(p);
  }
  return out;
}

function poleGeometry(heavy: boolean): THREE.BufferGeometry {
  const H = POLE.height;
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number) => parts.push(g.translate(x, y, z));
  // thân bê tông vuốt thon + chân đế
  add(new THREE.CylinderGeometry(0.1, 0.17, H, 8), 0, H / 2, 0);
  add(new THREE.BoxGeometry(0.42, 0.25, 0.42), 0, 0.12, 0);
  // 2 xà ngang (vuông góc lề: trục X cục bộ) + sứ cách điện
  for (const y of [H - 0.35, H - 1.2]) {
    add(new THREE.BoxGeometry(1.5, 0.09, 0.09), 0, y, 0);
    for (const x of [-0.65, -0.25, 0.25, 0.65]) add(new THREE.CylinderGeometry(0.035, 0.045, 0.12, 6), x, y + 0.1, 0);
  }
  if (heavy) {
    // hộp biến áp + bó cáp cuộn tròn (đặc trưng) + hộp công tơ
    add(new THREE.BoxGeometry(0.55, 0.85, 0.45), 0, H - 2.6, 0.32);
    add(new THREE.TorusGeometry(0.42, 0.07, 6, 16).rotateY(Math.PI / 2), 0.05, H - 3.8, 0);
    add(new THREE.TorusGeometry(0.34, 0.06, 6, 14).rotateY(Math.PI / 2.4), -0.05, H - 4.05, 0.05);
    add(new THREE.BoxGeometry(0.35, 0.5, 0.18), 0, 2.2, 0.2);
  }
  const merged = mergeGeometries(parts.map((p) => p.toNonIndexed()))!;
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Dựng cột (InstancedMesh, 2 biến thể) + toàn bộ dây (1 mesh gộp). */
export function buildWires(plan: { poles: PoleSpot[]; wires: Wire[] }, group: THREE.Group): void {
  const concrete = new THREE.MeshStandardMaterial({ color: 0x9d9a93, roughness: 0.9 });
  for (const heavy of [false, true]) {
    const list = plan.poles.filter((p) => p.heavy === heavy);
    if (!list.length) continue;
    const inst = new THREE.InstancedMesh(poleGeometry(heavy), concrete, list.length);
    const m = new THREE.Matrix4();
    list.forEach((p, i) => inst.setMatrixAt(i, m.makeRotationY(p.rot).setPosition(p.x, 0, p.z)));
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    group.add(inst);
  }
  const tubes = plan.wires.map((w) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sagPoints(w, 8)), 10, POLE.wireRadius, 3, false));
  if (!tubes.length) return;
  const wires = new THREE.Mesh(mergeGeometries(tubes)!, new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.55 }));
  tubes.forEach((t) => t.dispose());
  group.add(wires);
}
