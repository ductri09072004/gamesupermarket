/** Hộp va chạm thẳng trục trên mặt phẳng XZ (m). */
export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  tag: string;
}

export function aabb(cx: number, cz: number, w: number, d: number, tag: string): AABB {
  return { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, tag };
}

/**
 * Đẩy hình tròn (capsule nhìn từ trên) ra khỏi các hộp; trượt dọc tường vì chỉ bỏ phần vận tốc
 * theo pháp tuyến. Lặp vài lần để không kẹt ở góc.
 */
export function resolveCircle(x: number, z: number, r: number, boxes: AABB[], iterations = 4): { x: number; z: number; hit: boolean } {
  let px = x;
  let pz = z;
  let hit = false;
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (const b of boxes) {
      if (px + r <= b.minX || px - r >= b.maxX || pz + r <= b.minZ || pz - r >= b.maxZ) continue;
      const cx = Math.max(b.minX, Math.min(px, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pz, b.maxZ));
      const dx = px - cx;
      const dz = pz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 > 1e-10) {
        if (d2 >= r * r) continue;
        const d = Math.sqrt(d2);
        const push = r - d + 1e-5;
        px += (dx / d) * push;
        pz += (dz / d) * push;
      } else {
        // tâm nằm trong hộp → đẩy ra theo trục xuyên ít nhất
        const left = px - b.minX + r;
        const right = b.maxX - px + r;
        const back = pz - b.minZ + r;
        const front = b.maxZ - pz + r;
        const m = Math.min(left, right, back, front);
        if (m === left) px -= left;
        else if (m === right) px += right;
        else if (m === back) pz -= back;
        else pz += front;
      }
      moved = true;
      hit = true;
    }
    if (!moved) break;
  }
  return { x: px, z: pz, hit };
}

/** Di chuyển có va chạm: chia nhỏ bước để không xuyên qua vật mỏng. */
export function moveCircle(x: number, z: number, dx: number, dz: number, r: number, boxes: AABB[]): { x: number; z: number } {
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / (r * 0.5)));
  let px = x;
  let pz = z;
  for (let i = 0; i < steps; i++) {
    const res = resolveCircle(px + dx / steps, pz + dz / steps, r, boxes);
    px = res.x;
    pz = res.z;
  }
  return { x: px, z: pz };
}

export function pointInAABB(x: number, z: number, b: AABB): boolean {
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
}
