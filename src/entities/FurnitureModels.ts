import * as THREE from 'three';
import type { FurnitureDef } from '../config/furniture';
import { shelfGeom, tierHeights } from '../systems/SlotLayout';
import { textCanvas } from '../products/LabelTexture';
import { clothingRack, electronicsCase, vendingMachine } from './SpecialtyModels';
import { freezer, fridge, gondola } from './DisplayModels';
import { mergedModel } from './MergeStatic';
import { buildSelfCheckout } from './SelfCheckoutModel';
import { buildLamp } from './LampModels';

const box = new THREE.BoxGeometry(1, 1, 1);
const mats = new Map<string, THREE.Material>();

export function mat(key: string, make: () => THREE.Material): THREE.Material {
  let m = mats.get(key);
  if (!m) {
    m = make();
    mats.set(key, m);
  }
  return m;
}

export const std = (color: number, roughness = 0.6, metalness = 0) =>
  mat(`s${color}:${roughness}:${metalness}`, () => new THREE.MeshStandardMaterial({ color, roughness, metalness }));
export const glassMat = () => mat('glass', () => new THREE.MeshStandardMaterial({
  color: 0xdff3ff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.3, depthWrite: false,
}));

/** Hộp theo mép (x0..x1, y0..y1, z0..z1). */
export function block(material: THREE.Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(box, material);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.scale.set(x1 - x0, y1 - y0, z1 - z0);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

/**
 * AO giả trong lòng kệ: 1 tấm phủ vách sau, tối dần ngay dưới mỗi tấm kệ phía trên (ánh sáng trần bị che).
 * Vẽ 1 texture/cấu hình tầng, dùng chung — thay cho SSAO ở chất lượng Thấp/Trung.
 */
export function backShade(def: FurnitureDef, g: THREE.Group, z: number, strength = 0.55): void {
  const geo = shelfGeom(def);
  const { w, h } = def.size;
  const y0 = geo.base;
  const y1 = h - geo.top;
  const tiers = tierHeights(def);
  const m = mat(`shade:${def.id}:${strength}`, () => {
    const H = 256;
    const t = textCanvas(4, H, (c) => {
      c.fillStyle = '#000';
      c.fillRect(0, 0, 4, H);
      const tops = [...tiers.slice(1), y1];
      tiers.forEach((ty, i) => {
        const a = H * (1 - (tops[i] - y0) / (y1 - y0));
        const b = H * (1 - (ty - y0) / (y1 - y0));
        const gr = c.createLinearGradient(0, a, 0, b);
        const k = Math.round(255 * strength);
        gr.addColorStop(0, `rgb(${k},${k},${k})`);
        gr.addColorStop(0.55, 'rgb(20,20,20)');
        gr.addColorStop(1, `rgb(${Math.round(k * 0.35)},${Math.round(k * 0.35)},${Math.round(k * 0.35)})`);
        c.fillStyle = gr;
        c.fillRect(0, a, 4, b - a);
      });
    });
    t.colorSpace = THREE.NoColorSpace;
    return new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: t, transparent: true, depthWrite: false });
  });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w - geo.side * 2, y1 - y0), m);
  p.position.set(0, (y0 + y1) / 2, z);
  p.rotation.y = Math.PI;
  g.add(p);
}

function rack(def: FurnitureDef, g: THREE.Group): void {
  const { w, d, h } = def.size;
  const metal = std(0x3d5a80, 0.45, 0.6);
  const board = std(0xb08968, 0.8);
  for (const x of [-w / 2, w / 2 - 0.05]) for (const z of [-d / 2, d / 2 - 0.05]) g.add(block(metal, x, x + 0.05, 0, h, z, z + 0.05));
  for (const y of tierHeights(def)) {
    g.add(block(board, -w / 2, w / 2, y, y + 0.03, -d / 2, d / 2));
    g.add(block(std(0xf77f00, 0.5), -w / 2, w / 2, y - 0.06, y, -d / 2 - 0.005, -d / 2 + 0.03));
  }
}

function desk(def: FurnitureDef, g: THREE.Group): { screen: THREE.Mesh } {
  const { w, d, h } = def.size;
  const wood = std(0xa47148, 0.6);
  const legs = std(0x3f3f46, 0.5, 0.5);
  g.add(block(wood, -w / 2, w / 2, h - 0.04, h, -d / 2, d / 2));
  for (const x of [-w / 2 + 0.03, w / 2 - 0.07]) for (const z of [-d / 2 + 0.03, d / 2 - 0.07]) g.add(block(legs, x, x + 0.04, 0, h - 0.04, z, z + 0.04));
  const dark = std(0x1f2937, 0.4, 0.3);
  g.add(block(dark, -0.05, 0.05, h, h + 0.12, 0.08, 0.14));
  g.add(block(dark, -0.14, 0.14, h, h + 0.015, 0.04, 0.2));
  g.add(block(dark, -0.33, 0.33, h + 0.1, h + 0.48, 0.1, 0.13));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.34), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  screen.position.set(0, h + 0.29, 0.099);
  screen.rotation.y = Math.PI;
  g.add(screen);
  g.add(block(std(0xe5e7eb, 0.5), -0.22, 0.22, h, h + 0.02, -0.12, 0.02));
  g.add(block(std(0xe5e7eb, 0.5), 0.28, 0.34, h, h + 0.02, -0.08, 0.0));
  // ghế
  const chair = std(0x2a9d8f, 0.6);
  g.add(block(chair, -0.22, 0.22, 0.45, 0.5, -0.75, -0.35));
  g.add(block(chair, -0.22, 0.22, 0.5, 0.95, -0.8, -0.75));
  g.add(block(legs, -0.03, 0.03, 0, 0.45, -0.58, -0.52));
  return { screen };
}

function trash(def: FurnitureDef, g: THREE.Group): void {
  const { w, h } = def.size;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.42, w * 0.36, h * 0.9, 20), std(0x4f7a38, 0.55, 0.2));
  body.position.y = h * 0.45;
  body.castShadow = true;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.45, w * 0.45, h * 0.1, 20), std(0x3b5d29, 0.5, 0.2));
  lid.position.y = h * 0.95;
  lid.name = 'lid';
  const sign = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), std(0xffffff, 0.5));
  sign.position.set(0, h * 0.55, -w * 0.4 - 0.002);
  sign.rotation.y = Math.PI;
  g.add(body, lid, sign);
}

/** Dựng model theo loại (gốc giữa đáy, mặt trước -Z). */
export function buildFurnitureModel(def: FurnitureDef): { group: THREE.Group; screen?: THREE.Mesh } {
  const g = new THREE.Group();
  let screen: THREE.Mesh | undefined;
  if (def.kind === 'display') {
    if (def.vending) vendingMachine(def, g);
    else if (def.storage === 'clothing') clothingRack(def, g);
    else if (def.storage === 'electronics') electronicsCase(def, g);
    else {
      const build = def.storage === 'fridge' ? fridge : def.storage === 'freezer' ? freezer : gondola;
      return { group: mergedModel(def.id, () => {
        const m = new THREE.Group();
        build(def, m);
        return m;
      }) };
    }
  } else if (def.kind === 'rack') return { group: mergedModel(def.id, () => {
    const m = new THREE.Group();
    rack(def, m);
    return m;
  }) };
  else if (def.kind === 'selfcheckout') return { group: buildSelfCheckout(def).group };
  else if (def.kind === 'lamp') return { group: buildLamp(def) };
  else if (def.kind === 'computer') screen = desk(def, g).screen;
  else if (def.kind === 'trash') trash(def, g);
  return { group: g, screen };
}
