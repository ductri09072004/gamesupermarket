import * as THREE from 'three';
import { CELL, WAREHOUSE } from '../config/constants';
import { getFurniture } from '../config/furniture';
import type { FurnitureData } from '../core/GameState';
import type { Services } from '../core/Services';
import { buildCounter } from '../entities/CheckoutCounter';
import { buildFurnitureModel } from '../entities/FurnitureModels';
import { packFurnitureContents } from '../systems/InventorySystem';
import type { NavGrid } from '../world/NavGrid';
import { furnitureCenter } from '../world/Placement';

/** Lưới 0.5m phủ cửa hàng (và kho nếu đã mở). */
export function buildGrid(g: NavGrid): THREE.LineSegments {
  const pts: number[] = [];
  const add = (x0: number, z0: number, x1: number, z1: number) => {
    for (let x = x0; x <= x1 + 1e-6; x += CELL) pts.push(x, 0.01, z0, x, 0.01, z1);
    for (let z = z0; z <= z1 + 1e-6; z += CELL) pts.push(x0, 0.01, z, x1, 0.01, z);
  };
  add(0, 0, g.storeW, g.storeH);
  if (g.warehouse) add(WAREHOUSE.x0, WAREHOUSE.z0, WAREHOUSE.x0 + WAREHOUSE.w, 0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x3a86ff, transparent: true, opacity: 0.35 }));
}

/** Model ghost (vật liệu trong suốt xanh/đỏ). */
export function ghostModel(type: string, mat: THREE.Material): THREE.Group {
  const def = getFurniture(type);
  const model = def.kind === 'checkout' ? buildCounter(def).group : buildFurnitureModel(def).group;
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.material = mat;
      m.castShadow = false;
    }
  });
  const ghost = new THREE.Group();
  ghost.add(model);
  ghost.matrixAutoUpdate = false;
  return ghost;
}

/** Bán kệ còn hàng: đóng hàng vào thùng (đã mở) và đặt thùng (cả thùng trên kệ kho) xuống sàn chỗ kệ cũ. */
export function dropContents(s: Services, f: FurnitureData): number {
  const p = furnitureCenter(f);
  const x = Math.round(p.x * 100) / 100;
  const z = Math.round(p.z * 100) / 100;
  let n = 0;
  for (const uid of f.boxes) {
    const b = s.state.box(uid);
    if (!b) continue;
    b.location = 'floor';
    b.holderId = null;
    b.gx = x;
    b.gy = z;
    n++;
  }
  f.boxes = [];
  for (const pack of packFurnitureContents(f)) {
    s.inventory.createBox(pack.productId, pack.qty, x, z).open = true;
    n++;
  }
  if (n) s.bus.emit('boxes:changed', {});
  return n;
}
