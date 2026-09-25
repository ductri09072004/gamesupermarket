import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

interface Part {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  castShadow: boolean;
}

const cache = new Map<string, Part[]>();

/**
 * UV chiếu hộp theo toạ độ cục bộ (m) cho vật liệu có `userData.tile` (kích thước 1 lần lặp texture):
 * mỗi đỉnh lấy 2 trục vuông góc với pháp tuyến trội → vân texture đều trên mọi khối, không bị kéo giãn.
 */
function boxProjectUv(g: THREE.BufferGeometry, tile: number): void {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    const [u, v] = ax >= ay && ax >= az ? [pos.getZ(i), pos.getY(i)]
      : ay >= az ? [pos.getX(i), pos.getZ(i)] : [pos.getX(i), pos.getY(i)];
    uv[i * 2] = u / tile;
    uv[i * 2 + 1] = v / tile;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** Gom các mesh con (đã đặt vị trí) thành 1 geometry / (vật liệu, đổ bóng). */
function bake(group: THREE.Group): Part[] {
  group.updateMatrixWorld(true);
  const buckets = new Map<string, { material: THREE.Material; castShadow: boolean; geos: THREE.BufferGeometry[] }>();
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const material = m.material as THREE.Material;
    let g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    const key = `${material.uuid}:${m.castShadow}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { material, castShadow: m.castShadow, geos: [] }));
    b.geos.push(g);
  });
  return [...buckets.values()].map(({ material, castShadow, geos }) => {
    const geometry = mergeGeometries(geos, false)!;
    const tile = material.userData.tile as number | undefined;
    if (tile) boxProjectUv(geometry, tile);
    geometry.computeBoundingSphere();
    geos.forEach((x) => x.dispose());
    return { geometry, material, castShadow };
  });
}

/**
 * Model tĩnh dựng từ nhiều khối → vài mesh (1/vật liệu), geometry dùng chung giữa các món cùng `key`.
 * Giảm draw call từ ~30 xuống ~6 mỗi kệ. Không dispose geometry trả về (dùng chung).
 */
export function mergedModel(key: string, build: () => THREE.Group): THREE.Group {
  let parts = cache.get(key);
  if (!parts) cache.set(key, (parts = bake(build())));
  const out = new THREE.Group();
  for (const p of parts) {
    const m = new THREE.Mesh(p.geometry, p.material);
    m.castShadow = p.castShadow;
    m.receiveShadow = true;
    out.add(m);
  }
  return out;
}
