import * as THREE from 'three';
import { CELL } from '../config/constants';
import { getFurniture } from '../config/furniture';
import type { FurnitureData } from '../core/GameState';
import { rotatedSize, rotationY } from './Footprint';

/** Tâm footprint (m). */
export function furnitureCenter(f: Pick<FurnitureData, 'type' | 'gx' | 'gy' | 'rot'>): { x: number; z: number } {
  const { w, h } = rotatedSize(getFurniture(f.type), f.rot);
  return { x: (f.gx + w / 2) * CELL, z: (f.gy + h / 2) * CELL };
}

const cache = new WeakMap<object, { key: string; m: THREE.Matrix4 }>();

/** Ma trận world của nội thất: gốc giữa đáy, mặt trước (-Z cục bộ) quay theo rot. */
export function furnitureMatrix(f: FurnitureData): THREE.Matrix4 {
  const key = `${f.type}:${f.gx}:${f.gy}:${f.rot}`;
  const c = cache.get(f);
  if (c && c.key === key) return c.m;
  const p = furnitureCenter(f);
  const m = new THREE.Matrix4().makeRotationY(rotationY(f.rot)).setPosition(p.x, 0, p.z);
  cache.set(f, { key, m });
  return m;
}
