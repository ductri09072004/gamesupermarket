import * as THREE from 'three';
import { getFurniture } from '../config/furniture';
import { textCanvas } from '../products/LabelTexture';

const cardboard = new THREE.MeshStandardMaterial({ color: 0xb98a5a, roughness: 0.85 });
const tape = new THREE.MeshStandardMaterial({ color: 0xd9b46a, roughness: 0.4 });
const labels = new Map<string, THREE.Material>();

/** Kích thước thùng (m) theo nội thất bên trong: hàng lắp ráp nên dẹt hơn đồ thật. */
export function crateSize(type: string): { w: number; h: number; d: number } {
  const s = getFurniture(type).size;
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  return { w: clamp(s.w * 0.8, 0.6, 1.4), h: clamp(s.h * 0.45, 0.35, 0.85), d: clamp(s.d, 0.45, 0.75) };
}

function label(type: string): THREE.Material {
  let m = labels.get(type);
  if (!m) {
    const def = getFurniture(type);
    const tex = textCanvas(512, 256, (g) => {
      g.fillStyle = '#c99a68';
      g.fillRect(0, 0, 512, 256);
      g.fillStyle = '#f5ecd9';
      g.fillRect(24, 24, 464, 208);
      g.fillStyle = '#3d3551';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '90px "Nunito", Arial';
      g.fillText(def.icon, 100, 128);
      g.textAlign = 'left';
      g.font = '900 44px "Nunito", Arial';
      g.fillText(def.name, 160, 104, 320);
      g.font = '800 26px "Nunito", Arial';
      g.fillStyle = '#c0392b';
      g.fillText('▲ HÀNG LẮP ĐẶT · MINI MART', 160, 160, 320);
    });
    m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
    labels.set(type, m);
  }
  return m;
}

/** Thùng carton lớn chứa nội thất: băng keo dọc nắp, nhãn tên món ở 2 mặt. Gốc giữa đáy. */
export function crateModel(type: string): THREE.Group {
  const { w, h, d } = crateSize(type);
  const g = new THREE.Group();
  const lab = label(type);
  // thứ tự mặt BoxGeometry: +x, -x, +y, -y, +z, -z
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [cardboard, cardboard, cardboard, cardboard, lab, lab]);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.004, d + 0.004), tape);
  strip.position.y = h + 0.002;
  g.add(body, strip);
  return g;
}
