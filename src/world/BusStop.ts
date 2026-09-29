import * as THREE from 'three';
import type { BusStop } from './CityLayout';
import { signMaterial } from './SignFactory';

/**
 * Trạm xe buýt kiểu Hà Nội: mái che kính xanh trên 4 cột thép, ghế băng, cột biển "TRẠM XE BUÝT" phát sáng nhẹ ban đêm.
 * Quay mặt về phía lòng đường (+Z); hai cột ghế đặt sát lề.
 */
export function buildBusStop(stop: BusStop, parent: THREE.Group): THREE.MeshStandardMaterial {
  const s = stop.shelter;
  const g = new THREE.Group();
  g.position.set((s.x0 + s.x1) / 2, 0, (s.z0 + s.z1) / 2);
  const w = s.x1 - s.x0;
  const d = s.z1 - s.z0;
  const steel = new THREE.MeshStandardMaterial({ color: 0x2f3a45, roughness: 0.5, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x8fd3c8, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
  const roof = new THREE.MeshStandardMaterial({ color: 0x0b6e4f, roughness: 0.6 });
  const wood = new THREE.MeshStandardMaterial({ color: 0xb0894f, roughness: 0.8 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 8), steel, sx * (w / 2 - 0.08), 1.25, sz * (d / 2 - 0.08));
  add(new THREE.BoxGeometry(w + 0.3, 0.07, d + 0.4), roof, 0, 2.52, 0);
  add(new THREE.BoxGeometry(w - 0.2, 1.7, 0.03), glass, 0, 1.45, -d / 2 + 0.06);
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.03, 1.7, d - 0.2), glass, sx * (w / 2 - 0.08), 1.45, 0);
  // ghế băng
  add(new THREE.BoxGeometry(w - 0.7, 0.05, 0.36), wood, 0, 0.46, -d / 2 + 0.36);
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.44, 0.32), steel, sx * (w / 2 - 0.5), 0.22, -d / 2 + 0.36);
  // cột biển đặt cạnh mái che phía đầu xe (xe chạy về -X → biển ở phía -X của mái)
  const post = new THREE.Group();
  post.position.set(-w / 2 - 0.5, 0, d / 2 - 0.1);
  post.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.9, 8), steel).translateY(1.45));
  // biển tôn tráng men xanh có dòng tuyến; ban đêm sáng nhẹ như biển trạm thật
  const face = signMaterial({ text: 'TRẠM XE BUÝT', sub: 'Tuyến 03 · 27 · 32', style: 'enamel', bg: '#0b6e4f', ink: '#ffffff', accent: '#ffd166', w: 1024, h: 512, seed: 3, wear: 0.35 }).clone();
  face.emissive.set(0xffffff);
  face.emissiveMap = face.map;
  face.emissiveIntensity = 0.05;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.375), face);
  board.position.set(0, 2.6, 0.04);
  const back = board.clone();
  back.rotation.y = Math.PI;
  back.position.z = -0.04;
  post.add(board, back);
  g.add(post);
  parent.add(g);
  return face;
}
