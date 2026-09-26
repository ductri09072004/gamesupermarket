import { CAR_IMPACT } from '../config/physics';

/**
 * Va chạm xe kiểu vật rắn 2D trên mặt phẳng XZ: hộp định hướng (OBB), SAT tìm pháp tuyến & độ lún,
 * xung lượng có nảy + ma sát → vận tốc tịnh tiến & quay mới cho cả 2 xe (như va chạm ngoài đời).
 * yaw: góc quay, hướng đầu xe = (-sin yaw, -cos yaw) (quy ước game, mặt trước -Z).
 */
export interface CarBody {
  x: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  /** Tốc độ quay (rad/s) */
  w: number;
  /** Nửa bề ngang, nửa chiều dài (m) */
  hw: number;
  hl: number;
  /** kg; Infinity = vật cố định */
  mass: number;
}

export interface Contact {
  /** Pháp tuyến đơn vị từ A sang B */
  nx: number;
  nz: number;
  depth: number;
  /** Điểm tiếp xúc (world) */
  px: number;
  pz: number;
}

function axes(b: CarBody): Array<[number, number]> {
  const s = Math.sin(b.yaw);
  const c = Math.cos(b.yaw);
  // trục dọc thân xe & trục ngang
  return [[-s, -c], [c, -s]];
}

function corners(b: CarBody): Array<[number, number]> {
  const [[fx, fz], [rx, rz]] = axes(b);
  const out: Array<[number, number]> = [];
  for (const [a, l] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) out.push([b.x + fx * b.hl * l + rx * b.hw * a, b.z + fz * b.hl * l + rz * b.hw * a]);
  return out;
}

function project(pts: Array<[number, number]>, ax: number, az: number): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const [x, z] of pts) {
    const d = x * ax + z * az;
    lo = Math.min(lo, d);
    hi = Math.max(hi, d);
  }
  return [lo, hi];
}

/** SAT giữa 2 hộp định hướng; null nếu không chạm. */
export function obbContact(a: CarBody, b: CarBody): Contact | null {
  const ca = corners(a);
  const cb = corners(b);
  let best: Contact | null = null;
  for (const [ax, az] of [...axes(a), ...axes(b)]) {
    const [a0, a1] = project(ca, ax, az);
    const [b0, b1] = project(cb, ax, az);
    const overlap = Math.min(a1, b1) - Math.max(a0, b0);
    if (overlap <= 0) return null;
    if (!best || overlap < best.depth) {
      // hướng pháp tuyến từ A sang B
      const sign = (b.x - a.x) * ax + (b.z - a.z) * az >= 0 ? 1 : -1;
      best = { nx: ax * sign, nz: az * sign, depth: overlap, px: 0, pz: 0 };
    }
  }
  if (!best) return null;
  // điểm tiếp xúc: trung bình các góc của mỗi hộp nằm sâu nhất trong hộp kia theo pháp tuyến
  const deepest = (pts: Array<[number, number]>, nx: number, nz: number) => {
    const d = pts.map(([x, z]) => x * nx + z * nz);
    const m = Math.max(...d);
    const sel = pts.filter((_, i) => d[i] > m - 0.05);
    return sel.reduce((s, [x, z]) => [s[0] + x / sel.length, s[1] + z / sel.length], [0, 0]);
  };
  const pa = deepest(ca, best.nx, best.nz);
  const pb = deepest(cb, -best.nx, -best.nz);
  best.px = (pa[0] + pb[0]) / 2;
  best.pz = (pa[1] + pb[1]) / 2;
  return best;
}

const inertia = (b: CarBody) => (b.mass * ((2 * b.hw) ** 2 + (2 * b.hl) ** 2)) / 12;

/**
 * Giải va chạm: tách 2 xe ra theo độ lún (tỉ lệ nghịch khối lượng) rồi áp xung lượng pháp tuyến + ma sát.
 * Trả về tốc độ va chạm tương đối (m/s) để quyết định âm thanh / rung camera.
 */
export function resolveImpact(a: CarBody, b: CarBody, c: Contact): number {
  const ima = Number.isFinite(a.mass) ? 1 / a.mass : 0;
  const imb = Number.isFinite(b.mass) ? 1 / b.mass : 0;
  if (ima + imb === 0) return 0;
  const iia = ima ? 1 / inertia(a) : 0;
  const iib = imb ? 1 / inertia(b) : 0;
  // tách ra
  const push = c.depth / (ima + imb);
  a.x -= c.nx * push * ima;
  a.z -= c.nz * push * ima;
  b.x += c.nx * push * imb;
  b.z += c.nz * push * imb;
  const rax = c.px - a.x, raz = c.pz - a.z;
  const rbx = c.px - b.x, rbz = c.pz - b.z;
  // vận tốc điểm tiếp xúc: v + ω × r, ω quanh +Y → (ω·rz, −ω·rx)
  const vax = a.vx + a.w * raz, vaz = a.vz - a.w * rax;
  const vbx = b.vx + b.w * rbz, vbz = b.vz - b.w * rbx;
  const rvx = vbx - vax, rvz = vbz - vaz;
  const vn = rvx * c.nx + rvz * c.nz;
  if (vn >= 0) return 0;
  const crossN = (rx: number, rz: number) => rz * c.nx - rx * c.nz;
  const ran = crossN(rax, raz), rbn = crossN(rbx, rbz);
  const kn = ima + imb + ran * ran * iia + rbn * rbn * iib;
  const jn = (-(1 + CAR_IMPACT.restitution) * vn) / kn;
  // ma sát theo phương tiếp tuyến, giới hạn bởi Coulomb
  let tx = rvx - vn * c.nx, tz = rvz - vn * c.nz;
  const tl = Math.hypot(tx, tz);
  let jt = 0;
  if (tl > 1e-4) {
    tx /= tl;
    tz /= tl;
    const rat = raz * tx - rax * tz, rbt = rbz * tx - rbx * tz;
    const kt = ima + imb + rat * rat * iia + rbt * rbt * iib;
    jt = Math.max(-CAR_IMPACT.friction * jn, Math.min(CAR_IMPACT.friction * jn, -(rvx * tx + rvz * tz) / kt));
  }
  const jx = c.nx * jn + tx * jt;
  const jz = c.nz * jn + tz * jt;
  a.vx -= jx * ima;
  a.vz -= jz * ima;
  a.w -= (raz * jx - rax * jz) * iia;
  b.vx += jx * imb;
  b.vz += jz * imb;
  b.w += (rbz * jx - rbx * jz) * iib;
  return -vn;
}
