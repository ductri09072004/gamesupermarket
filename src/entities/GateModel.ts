import * as THREE from 'three';
import type { FurnitureDef } from '../config/furniture';
import { powder, rblock, steel } from './DisplayMaterials';

/** Cổng an ninh: 2 tấm acrylic đứng trên đế, dải LED trên đỉnh (xanh = bình thường, đỏ nháy = báo động). */
export interface GateParts {
  group: THREE.Group;
  light: THREE.MeshStandardMaterial;
}

const acrylic = new THREE.MeshStandardMaterial({ color: 0xe8f1f8, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.55 });

export function buildGate(def: FurnitureDef): GateParts {
  const g = new THREE.Group();
  const { w, d, h } = def.size;
  const light = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.8, roughness: 0.3 });
  const base = powder(0x9ca3af, 0.5);
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - 0.07);
    g.add(rblock(base, x - 0.1, x + 0.1, 0, 0.06, -d / 2, d / 2, 0.02));
    // tấm anten: khung nhôm + tấm acrylic mờ ở giữa
    g.add(rblock(steel(), x - 0.02, x + 0.02, 0.06, h - 0.04, -d / 2 + 0.02, -d / 2 + 0.05, 0.008));
    g.add(rblock(steel(), x - 0.02, x + 0.02, 0.06, h - 0.04, d / 2 - 0.05, d / 2 - 0.02, 0.008));
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.02, h - 0.14, d - 0.1), acrylic);
    panel.position.set(x, 0.06 + (h - 0.14) / 2 + 0.02, 0);
    g.add(panel);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, d - 0.04), light);
    led.position.set(x, h - 0.02, 0);
    g.add(led);
  }
  return { group: g, light };
}
