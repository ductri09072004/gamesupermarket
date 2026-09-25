import * as THREE from 'three';
import type { ProductDef } from '../config/products';
import { LABEL_FONT, fitText, logo, pattern } from './LabelTexture';

/** Hình bóng nửa phải (x ≥ 0) từ gấu dưới lên cổ, toạ độ chuẩn hoá: x ∈ [0, 0.5], y ∈ [0, 1]. */
const SILHOUETTES: Record<string, Array<[number, number]>> = {
  tshirt: [[0, 0], [0.3, 0], [0.31, 0.6], [0.44, 0.52], [0.5, 0.7], [0.27, 0.93], [0.12, 0.95], [0, 0.87]],
  hoodie: [[0, 0], [0.33, 0], [0.33, 0.5], [0.38, 0.04], [0.5, 0.06], [0.45, 0.76], [0.28, 0.9], [0.17, 1], [0, 0.94]],
  dress: [[0, 0], [0.5, 0], [0.24, 0.58], [0.26, 0.82], [0.18, 0.96], [0.1, 0.96], [0, 0.88]],
  pants: [[0.04, 0.6], [0.14, 0], [0.5, 0], [0.43, 0.98], [0, 0.98]],
};

const texCache = new Map<string, THREE.CanvasTexture>();
const wire = new THREE.MeshStandardMaterial({ color: 0xb8bec6, metalness: 0.9, roughness: 0.25 });

/** Vải: màu nền, hoạ tiết mờ, sọc dệt nhỏ và hình in trước ngực (logo + tên hãng). */
function fabricTexture(p: ProductDef): THREE.CanvasTexture {
  const hit = texCache.get(p.id);
  if (hit) return hit;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = p.label.bg;
  g.fillRect(0, 0, S, S);
  if (p.label.pattern !== 'solid') pattern(g, p, S, S);
  g.globalAlpha = 0.06;
  g.fillStyle = '#000000';
  for (let y = 0; y < S; y += 3) g.fillRect(0, y, S, 1);
  g.globalAlpha = 1;
  if (p.shape === 'pants') {
    // đường may + túi
    g.strokeStyle = p.label.accent;
    g.lineWidth = 2;
    g.setLineDash([4, 3]);
    g.strokeRect(S * 0.12, S * 0.1, S * 0.2, S * 0.14);
    g.strokeRect(S * 0.68, S * 0.1, S * 0.2, S * 0.14);
    g.beginPath();
    g.moveTo(S / 2, S * 0.04);
    g.lineTo(S / 2, S * 0.4);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = p.label.accent;
    g.fillRect(S * 0.46, S * 0.05, S * 0.08, S * 0.04);
  } else {
    logo(g, p, S / 2, S * 0.3, 18);
    g.fillStyle = p.label.text;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fitText(g, p.brand.toUpperCase(), S * 0.4, 26, 900);
    g.fillText(p.brand.toUpperCase(), S / 2, S * 0.43);
    g.font = `700 12px ${LABEL_FONT}`;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  texCache.set(p.id, tex);
  return tex;
}

function silhouetteGeo(half: Array<[number, number]>, w: number, h: number, d: number): THREE.BufferGeometry {
  const pts = [...half.map(([x, y]) => new THREE.Vector2(x * w, y * h))];
  for (let i = half.length - 1; i >= 0; i--) {
    const [x, y] = half[i];
    if (x > 0) pts.push(new THREE.Vector2(-x * w, y * h));
  }
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
    depth: d, bevelEnabled: true, bevelThickness: d * 0.3, bevelSize: Math.min(0.012, d * 0.4), bevelSegments: 2,
  });
  g.translate(0, 0, -d / 2);
  // UV phẳng theo khung hình bóng (in trước ngực nằm đúng chỗ ở mặt trước)
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 - pos.getX(i) / w, pos.getY(i) / h);
  g.computeVertexNormals();
  return g;
}

/** Móc treo kim loại (hook + thanh ngang) từ y0 lên top. */
function hanger(w: number, y0: number, top: number, clip: boolean): THREE.BufferGeometry[] {
  const bar = new THREE.CylinderGeometry(0.004, 0.004, w * (clip ? 0.9 : 0.8), 6);
  bar.rotateZ(Math.PI / 2);
  bar.translate(0, y0, 0);
  const stem = new THREE.CylinderGeometry(0.003, 0.003, (top - y0) * 0.55, 6);
  stem.translate(0, y0 + (top - y0) * 0.28, 0);
  const hook = new THREE.TorusGeometry((top - y0) * 0.25, 0.003, 6, 12, Math.PI * 1.3);
  hook.rotateY(Math.PI / 2);
  hook.translate(0, top - (top - y0) * 0.25, 0);
  return [bar, stem, hook];
}

export type Part = [THREE.BufferGeometry, number];

/** Quần áo treo móc: gốc giữa đáy, mặt trước -Z. Vật liệu: 0 vải in, 1 kim loại móc. */
export function garmentParts(p: ProductDef): { parts: Part[]; materials: THREE.Material[] } {
  const [w, h, d] = p.size;
  const kind = p.shape === 'pants' ? 'pants' : p.id === 'hoodie' ? 'hoodie' : p.id === 'dress' ? 'dress' : 'tshirt';
  const bodyH = h * 0.86;
  const body = silhouetteGeo(SILHOUETTES[kind], w, bodyH, d * 0.5);
  body.rotateY(Math.PI); // mặt +Z của extrude (in ngực) quay về -Z
  const fabric = new THREE.MeshStandardMaterial({ map: fabricTexture(p), roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  const parts: Part[] = [[body, 0]];
  for (const g of hanger(w, bodyH * 0.97, h, kind === 'pants')) parts.push([g, 1]);
  return { parts, materials: [fabric, wire] };
}

/** Mũ lưỡi trai: chóp bán cầu + lưỡi trai hướng -Z + nút chóp. */
export function capParts(p: ProductDef): { parts: Part[]; materials: THREE.Material[] } {
  const [w, h, d] = p.size;
  const r = w / 2;
  const dome = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(1, h / r, 1.05);
  dome.rotateY(Math.PI / 2); // đường nối UV ra phía sau
  dome.translate(0, 0, d / 2 - r * 1.05);
  const brim = new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.006, 24, 1, false, Math.PI / 2, Math.PI);
  brim.scale(1, 1, 1.1);
  brim.translate(0, 0.004, d / 2 - r * 1.65);
  const button = new THREE.SphereGeometry(0.008, 8, 6);
  button.translate(0, h, d / 2 - r * 1.05);
  const cloth = new THREE.MeshStandardMaterial({ map: fabricTexture(p), roughness: 0.9 });
  const accent = new THREE.MeshStandardMaterial({ color: p.label.accent, roughness: 0.7, side: THREE.DoubleSide });
  return { parts: [[dome, 0], [brim, 1], [button, 1]], materials: [cloth, accent] };
}
