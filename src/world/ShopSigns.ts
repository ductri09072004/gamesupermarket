import * as THREE from 'three';
import { BUILDINGS } from '../config/city';
import { textCanvas } from '../products/LabelTexture';
import type { Placement } from './CityLayout';

const COLORS = ['#c0392b', '#1f7a6d', '#6c3483', '#d35400', '#1a5276', '#7d6608', '#117864', '#943126'];

/** Biển hiệu + mái hiên vải cho các cửa hiệu cạnh siêu thị. Trả về vật liệu biển (sáng lên ban đêm). */
export function buildShopSigns(placements: Placement[], group: THREE.Group): THREE.MeshStandardMaterial[] {
  const mats: THREE.MeshStandardMaterial[] = [];
  const awningGeo = new THREE.BoxGeometry(1, 0.06, 1.1);
  placements.filter((p) => p.sign).forEach((p, i) => {
    const [w, , d] = BUILDINGS[p.model];
    const color = COLORS[i % COLORS.length];
    const tex = textCanvas(512, 112, (g) => {
      g.fillStyle = color;
      g.fillRect(0, 0, 512, 112);
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 5;
      g.strokeRect(8, 8, 496, 96);
      g.fillStyle = '#fff';
      g.font = '900 58px "Nunito", Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(p.sign!, 256, 60, 470);
    });
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.1, roughness: 0.5 });
    mats.push(mat);
    const sw = Math.min(w - 0.8, 3.8);
    const board = new THREE.Mesh(new THREE.BoxGeometry(sw, sw * 112 / 512, 0.08), [mat, mat, mat, mat, mat, mat]);
    const g = new THREE.Group();
    board.position.set(0, 3.25, d / 2 + 0.12);
    // mái hiên sọc nghiêng trên cửa
    const awning = new THREE.Mesh(awningGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    awning.scale.set(sw + 0.4, 1, 1);
    awning.position.set(0, 2.55, d / 2 + 0.55);
    awning.rotation.x = 0.35;
    awning.castShadow = true;
    g.add(board, awning);
    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.rot;
    group.add(g);
  });
  return mats;
}
