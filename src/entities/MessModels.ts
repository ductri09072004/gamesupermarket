import * as THREE from 'three';
import type { DirtData } from '../core/GameState';
import { productMesh } from '../products/PackagingFactory';
import { textCanvas } from '../products/LabelTexture';

/** Chất bẩn trên sàn / kính và hàng rơi — mesh dùng chung geometry & vật liệu. */
const cache = new Map<string, THREE.Material>();
function mat(key: string, make: () => THREE.Material): THREE.Material {
  let m = cache.get(key);
  if (!m) {
    m = make();
    cache.set(key, m);
  }
  return m;
}

/** Vết loang: nhiều đốm tròn mờ chồng nhau, viền không đều. */
function blotTexture(color: string, seed: number, drips: boolean): THREE.Texture {
  let s = seed * 9301 + 49297;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return textCanvas(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    for (let i = 0; i < 9; i++) {
      const x = 64 + (r() - 0.5) * 50;
      const y = 64 + (r() - 0.5) * 50;
      const rad = 14 + r() * 26;
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    }
    if (drips) {
      g.fillStyle = color;
      for (let i = 0; i < 5; i++) g.fillRect(30 + r() * 68, 60 + r() * 10, 3, 20 + r() * 40);
    }
  });
}

const spillColors = ['rgba(120,72,20,0.75)', 'rgba(200,120,30,0.6)', 'rgba(90,110,40,0.6)', 'rgba(60,40,30,0.7)'];
const paperGeo = new THREE.IcosahedronGeometry(0.045, 0);
const wrapperGeo = new THREE.BoxGeometry(0.12, 0.006, 0.07);

export function dirtMesh(d: DirtData): THREE.Object3D {
  const g = new THREE.Group();
  g.position.set(d.x, 0, d.z);
  if (d.kind === 'litter') {
    const paper = d.seed % 2 === 0;
    const m = new THREE.Mesh(paper ? paperGeo : wrapperGeo, mat(`litter${d.seed % 4}`, () => new THREE.MeshStandardMaterial({
      color: [0xf1f1ee, 0xe63946, 0xffd166, 0x2a9d8f][d.seed % 4], roughness: paper ? 0.9 : 0.4, metalness: paper ? 0 : 0.3, flatShading: true,
    })));
    m.position.y = paper ? 0.035 : 0.004;
    m.rotation.set(paper ? d.seed : 0, d.seed * 0.7, 0);
    m.castShadow = true;
    g.add(m);
  } else if (d.kind === 'spill') {
    const size = 0.45 + (d.seed % 5) * 0.08;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), mat(`spill${d.seed % 8}`, () => new THREE.MeshStandardMaterial({
      map: blotTexture(spillColors[d.seed % spillColors.length], d.seed, false), transparent: true, roughness: 0.05, metalness: 0.1,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    })));
    m.position.y = 0.003;
    m.rotation.y = d.seed;
    m.renderOrder = 2;
    g.add(m);
  } else {
    // vết tay / vết mờ trên kính mặt tiền (nhìn thấy cả 2 phía)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.45), mat(`smudge${d.seed % 6}`, () => new THREE.MeshBasicMaterial({
      map: blotTexture('rgba(110,100,85,0.45)', d.seed, d.seed % 3 === 0), transparent: true, depthWrite: false, side: THREE.DoubleSide,
    })));
    m.position.y = 0.7 + (d.seed % 7) * 0.12;
    g.add(m);
  }
  // vùng click rộng hơn cho dễ nhắm
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.4, d.kind === 'smudge' ? 0.5 : 0.12, 0.4), mat('hit', () => new THREE.MeshBasicMaterial({ visible: false })));
  hit.position.y = d.kind === 'smudge' ? 0.7 + (d.seed % 7) * 0.12 : 0.05;
  hit.scale.z = d.kind === 'smudge' ? 0.15 : 1;
  g.add(hit);
  g.userData = { kind: 'dirt', uid: d.uid };
  return g;
}

/** Món hàng nằm lăn trên sàn. */
export function looseMesh(uid: string, productId: string, x: number, z: number): THREE.Object3D {
  const g = new THREE.Group();
  const m = productMesh(productId);
  m.geometry.computeBoundingBox();
  const bb = m.geometry.boundingBox!;
  // nằm nghiêng trên sàn
  m.rotation.z = Math.PI / 2;
  m.position.y = (bb.max.x - bb.min.x) / 2;
  g.add(m);
  g.position.set(x, 0, z);
  g.rotation.y = (x * 13.7 + z * 7.1) % (Math.PI * 2);
  g.userData = { kind: 'loose', uid };
  return g;
}
