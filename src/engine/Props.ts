import * as THREE from 'three';

/**
 * Registry model đồ vật (GLB đã chuẩn hoá: mét, gốc giữa đáy, mặt trước -Z) — manifest.props.
 * Thiếu file → prop() trả null, nơi gọi dùng model dựng bằng code.
 */
const props = new Map<string, THREE.Group>();

export function registerProp(name: string, scene: THREE.Group): void {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
  });
  props.set(name, scene);
}

/** Bản clone (dùng chung geometry & vật liệu). */
export function prop(name: string): THREE.Group | null {
  const p = props.get(name);
  return p ? p.clone(true) : null;
}

export function hasProp(name: string): boolean {
  return props.has(name);
}
