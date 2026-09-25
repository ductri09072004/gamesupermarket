import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { textCanvas } from '../products/LabelTexture';
import { applyPbr, pbrSet } from '../world/Materials';
import { mat } from './FurnitureModels';

/** Vật liệu & khối vát cạnh dùng chung cho kệ/tủ trưng bày. */

const TILE = { powder: 0.35, steel: 0.5 };

/** Thép sơn tĩnh điện (thân kệ, vỏ tủ): vân sơn sần nhẹ từ texture Metal028. */
export function powder(color: number, roughness = 0.5): THREE.MeshStandardMaterial {
  return mat(`powder:${color}:${roughness}`, () => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
    const set = pbrSet('powder');
    if (set) {
      applyPbr(m, set, ['normalMap', 'roughnessMap']);
      m.roughness = roughness / 0.3; // map ~0.3 → nhân về độ nhám mong muốn
      m.normalScale.set(0.6, 0.6);
      m.userData.tile = TILE.powder;
    }
    return m;
  }) as THREE.MeshStandardMaterial;
}

/** Inox xước mờ (nẹp, tay nắm, viền tủ): roughness map vệt xước ngang vẽ canvas — sạch, không loang bẩn. */
export function steel(): THREE.MeshStandardMaterial {
  return mat('steel', () => {
    const S = 256;
    const t = textCanvas(S, S, (c) => {
      c.fillStyle = 'rgb(80,80,80)';
      c.fillRect(0, 0, S, S);
      for (let i = 0; i < 900; i++) {
        const v = 55 + Math.floor(Math.random() * 60);
        c.fillStyle = `rgba(${v},${v},${v},0.5)`;
        c.fillRect(Math.random() * S, Math.random() * S, 20 + Math.random() * 120, 1);
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.NoColorSpace;
    const m = new THREE.MeshStandardMaterial({ color: 0xd4d8dd, roughness: 1, roughnessMap: t, metalness: 1 });
    m.userData.tile = TILE.steel;
    return m;
  }) as THREE.MeshStandardMaterial;
}

/** Gỗ sồi veneer (ốp quầy thu ngân) — Poly Haven oak_veneer_01, thiếu texture thì màu gỗ phẳng. */
export function wood(): THREE.MeshStandardMaterial {
  return mat('oakVeneer', () => {
    const m = new THREE.MeshStandardMaterial({ color: 0xb08a5e, roughness: 0.6 });
    const set = pbrSet('wood');
    if (set) {
      applyPbr(m, set, ['map', 'normalMap', 'roughnessMap']);
      m.color.set(0xffffff);
      m.roughness = 1;
      m.userData.tile = 0.9;
    }
    return m;
  }) as THREE.MeshStandardMaterial;
}

/** Kính cửa tủ: trong, phản chiếu môi trường mạnh. */
export function coolerGlass(): THREE.Material {
  return mat('coolerGlass', () => new THREE.MeshStandardMaterial({
    color: 0xe8f4fb, transparent: true, opacity: 0.1, roughness: 0.03, metalness: 0,
    envMapIntensity: 2.2, depthWrite: false,
  }));
}

/** Nhựa bóng (nẹp giá, gioăng). */
export function plastic(color: number, roughness = 0.35): THREE.Material {
  return mat(`plastic:${color}:${roughness}`, () => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 }));
}

export function emissive(key: string, color: number, intensity: number): THREE.Material {
  return mat(`emis:${key}`, () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: intensity }));
}

/** Tấm pegboard lỗ đục: lỗ có bóng đổ vào trong (map) + gờ lỗ (normal giả bằng roughness). */
export function pegboard(): THREE.Material {
  return mat('pegboard', () => {
    const S = 256;
    const t = textCanvas(S, S, (c) => {
      c.fillStyle = '#e4e7eb';
      c.fillRect(0, 0, S, S);
      for (let y = 16; y < S; y += 32) for (let x = 16; x < S; x += 32) {
        const gr = c.createRadialGradient(x - 1, y - 1, 0.5, x, y, 5.5);
        gr.addColorStop(0, '#2b2f35');
        gr.addColorStop(0.7, '#4a5059');
        gr.addColorStop(1, 'rgba(228,231,235,0)');
        c.fillStyle = gr;
        c.beginPath();
        c.arc(x, y, 5.5, 0, Math.PI * 2);
        c.fill();
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 });
    m.userData.tile = 0.2; // lỗ cách nhau 25mm
    return m;
  });
}

/** Mặt kệ lưới (tủ lạnh): texture lưới thép với alphaTest, 1 tấm phẳng thay vì hàng chục thanh. */
export function wireDeck(): THREE.Material {
  return mat('wireDeck', () => {
    const S = 128;
    const t = textCanvas(S, S, (c) => {
      c.clearRect(0, 0, S, S);
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, S, 10);
      for (let x = 0; x < S; x += 32) c.fillRect(x, 0, 6, S);
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.NoColorSpace;
    const m = new THREE.MeshStandardMaterial({ color: 0xcfd6de, alphaMap: t, alphaTest: 0.5, roughness: 0.3, metalness: 0.9, side: THREE.DoubleSide });
    m.userData.tile = 0.08;
    return m;
  });
}

/** Lưới tản nhiệt chân tủ (khe ngang tối). */
export function grille(): THREE.Material {
  return mat('grille', () => {
    const t = textCanvas(64, 64, (c) => {
      c.fillStyle = '#3a4048';
      c.fillRect(0, 0, 64, 64);
      c.fillStyle = '#0d0f12';
      for (let y = 4; y < 64; y += 16) c.fillRect(0, y, 64, 7);
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.4 });
    m.userData.tile = 0.1;
    return m;
  });
}

const rounded = new Map<string, THREE.BufferGeometry>();

/** Hộp vát cạnh theo mép (x0..x1, y0..y1, z0..z1); bán kính tự giới hạn theo cạnh ngắn nhất. */
export function rblock(material: THREE.Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, r = 0.008, shadow = true): THREE.Mesh {
  const w = x1 - x0;
  const h = y1 - y0;
  const d = z1 - z0;
  const rr = Math.min(r, Math.min(w, h, d) * 0.45);
  const key = `${w.toFixed(4)}:${h.toFixed(4)}:${d.toFixed(4)}:${rr.toFixed(4)}`;
  let g = rounded.get(key);
  if (!g) rounded.set(key, (g = new RoundedBoxGeometry(w, h, d, 1, rr)));
  const m = new THREE.Mesh(g, material);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

/** Trụ đứng (chân tăng chỉnh, tay nắm tròn). */
export function cyl(material: THREE.Material, r: number, y0: number, y1: number, x: number, z: number, seg = 10): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, y1 - y0, seg), material);
  m.position.set(x, (y0 + y1) / 2, z);
  m.castShadow = false;
  return m;
}
