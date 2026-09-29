import * as THREE from 'three';
import { applyPbr, pbrSet, setRepeat } from './Materials';
import { wallTexture } from './Textures';

/** Chân tường ốp gạch men cao N m (kiểu tạp hóa / nhà ống Việt), phía trên sơn kem. */
export const WAINSCOT_H = 1.2;
const TRIM_H = 0.06;
/** Cạnh ô lặp của từng texture (m) */
const TILE_M = { tile: 0.9, paint: 1.6, shutter: 1.0 };

export type WallKind = 'wall' | 'shutter';

interface Part {
  mesh: THREE.Mesh;
  maps: THREE.Texture[];
  tile: number;
  /** chiều cao ô lặp / chiều rộng ô lặp (ảnh không vuông) */
  aspect: number;
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const trimMat = new THREE.MeshStandardMaterial({ color: 0x2f7d6d, roughness: 0.35, metalness: 0.05 });

function part(slot: 'wall_tile' | 'wall_paint' | 'shutter', fallback: THREE.MeshStandardMaterial, tile: number, aspect = 1): Part {
  const mat = fallback;
  const set = pbrSet(slot);
  let maps: THREE.Texture[] = [];
  if (set) {
    mat.roughness = 1;
    mat.normalScale.set(slot === 'wall_paint' ? 0.5 : 0.8, slot === 'wall_paint' ? 0.5 : 0.8);
    maps = applyPbr(mat, set, ['map', 'normalMap', 'roughnessMap', 'aoMap'], true);
    if (slot === 'wall_paint') mat.color.set(0xffffff);
  }
  const mesh = new THREE.Mesh(unitBox, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return { mesh, maps, tile, aspect };
}

/** Đặt hộp theo mép (min/max). */
function place(m: THREE.Object3D, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): void {
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.scale.set(Math.max(1e-3, x1 - x0), Math.max(1e-3, y1 - y0), Math.max(1e-3, z1 - z0));
}

interface Seg {
  kind: WallKind;
  lower: Part | null;
  upper: Part;
  trim: THREE.Mesh | null;
}

/**
 * Tường cửa hàng kiểu Việt: mỗi đoạn tường tách 2 tầng — gạch men trắng ở chân tường (có viền xanh) và sơn kem phía trên;
 * riêng phần trên mặt kính là hộp cửa cuốn bằng tôn sóng. Thiếu texture thì quay về sơn vẽ bằng code.
 */
export class StoreWalls {
  readonly group = new THREE.Group();
  private segs = new Map<string, Seg>();

  add(name: string, kind: WallKind = 'wall'): void {
    let upper: Part;
    let lower: Part | null = null;
    let trim: THREE.Mesh | null = null;
    if (kind === 'shutter') {
      const base = new THREE.MeshStandardMaterial({ color: 0xb9bec4, roughness: 0.5, metalness: 0.6 });
      upper = part('shutter', base, TILE_M.shutter);
    } else {
      const tex = wallTexture().clone();
      tex.needsUpdate = true;
      upper = part('wall_paint', new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), TILE_M.paint, 0.5);
      lower = part('wall_tile', new THREE.MeshStandardMaterial({ color: 0xf2f4f3, roughness: 0.25 }), TILE_M.tile);
      trim = new THREE.Mesh(unitBox, trimMat);
      trim.receiveShadow = true;
    }
    const seg: Seg = { kind, lower, upper, trim };
    this.segs.set(name, seg);
    this.group.add(upper.mesh);
    if (lower) this.group.add(lower.mesh);
    if (trim) this.group.add(trim);
  }

  set(name: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): void {
    const s = this.segs.get(name)!;
    const len = Math.max(x1 - x0, z1 - z0);
    const fit = (p: Part, ya: number, yb: number) => {
      place(p.mesh, x0, x1, ya, yb, z0, z1);
      setRepeat(p.maps, len / p.tile, (yb - ya) / (p.tile * p.aspect));
    };
    if (s.kind === 'shutter') {
      fit(s.upper, y0, y1);
      return;
    }
    const cut = Math.min(Math.max(WAINSCOT_H, y0), y1);
    // phần dưới: gạch men (bỏ nếu tường bắt đầu cao hơn chân tường)
    s.lower!.mesh.visible = y0 < WAINSCOT_H;
    if (s.lower!.mesh.visible) fit(s.lower!, y0, cut);
    s.upper.mesh.visible = y1 > cut;
    if (s.upper.mesh.visible) fit(s.upper, cut, y1);
    // viền xanh ở mép trên gạch (nhô ra 1cm 2 phía)
    const t = s.trim!;
    t.visible = y0 < WAINSCOT_H && y1 > WAINSCOT_H;
    if (t.visible) place(t, x0 - 0.012, x1 + 0.012, WAINSCOT_H, WAINSCOT_H + TRIM_H, z0 - 0.012, z1 + 0.012);
  }

  setVisible(name: string, on: boolean): void {
    const s = this.segs.get(name)!;
    s.upper.mesh.visible = on;
    if (s.lower) s.lower.mesh.visible = on;
    if (s.trim) s.trim.visible = on;
  }
}
