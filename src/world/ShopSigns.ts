import * as THREE from 'three';
import { BUILDINGS, SHOP_SIGNS } from '../config/city';
import { mulberry32 } from '../core/Random';
import { cityModel, retainCityMaterial } from './CityModels';
import type { Placement } from './CityLayout';
import { signMaterial, type SignSpec } from './SignFactory';

const COLORS = ['#c0392b', '#1f7a6d', '#6c3483', '#d35400', '#1a5276', '#7d6608', '#117864', '#943126'];
const edgeMat = new THREE.MeshStandardMaterial({ color: 0x555b62, roughness: 0.5, metalness: 0.6 });
retainCityMaterial(edgeMat);

/** Mái hiên bằng model (vải hoặc tôn sóng) co giãn theo bề rộng biển, nhuộm màu của tiệm. */
function awning(kind: 'awning_cloth' | 'awning_tin', width: number, color: string): THREE.Object3D | null {
  const src = cityModel(kind);
  if (!src) return null;
  const o = src.clone(true);
  o.traverse((m) => {
    const mesh = m as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
    if (kind === 'awning_cloth') mat.color.set(color);
    else mat.side = THREE.DoubleSide;
    mesh.material = mat;
    mesh.castShadow = true;
  });
  const g = new THREE.Group();
  o.scale.set(width, 1.5, 1.7);
  g.add(o);
  return g;
}

/** Biển hiệu treo vuông góc mặt tiền (model biển treo, mặt biển thay bằng chữ tiệm). */
function blade(spec: SignSpec): THREE.Object3D | null {
  const src = cityModel('sign_blade');
  if (!src) return null;
  const o = src.clone(true);
  const mat = signMaterial({ ...spec, w: 512, h: 600, wear: 0.15, sub: undefined, style: spec.style === 'lightbox' ? 'lightbox' : 'enamel' });
  // model biển treo chỉ có khung + tấm trơn: dán mặt chữ đè lên hai mặt tấm
  const face = new THREE.PlaneGeometry(0.5, 0.585);
  for (const side of [1, -1]) {
    const f = new THREE.Mesh(face, mat);
    f.position.set(0, 0.37, 0.05 * side);
    if (side < 0) f.rotation.y = Math.PI;
    o.add(f);
  }
  return o;
}

/**
 * Biển hiệu cho các cửa hiệu cạnh siêu thị: mỗi loại tiệm một chất liệu & phông chữ (hộp đèn, biển tôn tróc sơn, bảng sơn tay, alu),
 * có dòng phụ, mái hiên (vải / tôn), biển treo vuông góc và vài tấm biển quảng cáo tôn cũ (Coca, Pepsi).
 * Trả về vật liệu hộp đèn (sáng lên ban đêm).
 */
export function buildShopSigns(placements: Placement[], group: THREE.Group): THREE.MeshStandardMaterial[] {
  const lit: THREE.MeshStandardMaterial[] = [];
  placements.filter((p) => p.sign).forEach((p, i) => {
    const [bw, , bd] = BUILDINGS[p.model];
    const w = bw * (p.sx ?? 1);
    const d = bd * (p.sz ?? 1);
    const theme = SHOP_SIGNS[p.sign!];
    const color = COLORS[i % COLORS.length];
    const rng = mulberry32(i * 131 + 7);
    const spec: SignSpec = theme
      ? { text: p.sign!, sub: theme.sub, style: theme.style, bg: theme.bg, ink: theme.ink, accent: theme.accent, seed: i + 1, h: 288 }
      : { text: p.sign!, style: 'enamel', bg: color, ink: '#fff', seed: i + 1 };
    const mat = signMaterial(spec);
    if (spec.style === 'lightbox') lit.push(mat);
    const sw = Math.min(w - 0.8, 3.8);
    const sh = (sw * (spec.h ?? 256)) / 1024;
    const g = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, 0.12), [edgeMat, edgeMat, edgeMat, edgeMat, mat, edgeMat]);
    board.position.set(0, 3.25, d / 2 + 0.12);
    board.castShadow = true;
    g.add(board);
    const cover = awning(i % 3 === 1 ? 'awning_tin' : 'awning_cloth', sw + 0.4, color);
    if (cover) {
      cover.position.set(0, 2.5, d / 2 + 0.12);
      g.add(cover);
    }
    if (i % 2 === 0) {
      const b = blade({ ...spec, text: p.sign!.split(' ')[0], seed: i + 9 });
      if (b) {
        b.position.set(sw / 2 + 0.15, 2.9, d / 2 + 0.35);
        b.rotation.y = Math.PI / 2;
        g.add(b);
      }
    }
    // biển quảng cáo tôn cũ dựng cạnh mặt tiền (thỉnh thoảng)
    if (i % 4 === 3) {
      const tin = cityModel(rng() < 0.5 ? 'sign_tin_coca' : 'sign_tin_pepsi');
      if (tin) {
        const t = tin.clone(true);
        t.scale.setScalar(0.62);
        t.position.set(-(sw / 2) - 0.2, 0, d / 2 + 0.5);
        t.rotation.y = Math.PI + 0.15;
        g.add(t);
      }
    }
    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.rot;
    group.add(g);
  });
  return lit;
}
