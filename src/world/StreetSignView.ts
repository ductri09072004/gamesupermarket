import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SignPlate, StreetSigns } from './StreetSigns';

const CELL_W = 256;
const CELL_H = 128;
const COLS = 8;

/** Vẽ một tấm biển tôn tráng men xanh: viền trắng, chữ trắng, đã cũ (trầy xước, gỉ ở mép, bạc màu). */
function drawPlate(g: CanvasRenderingContext2D, x0: number, y0: number, p: SignPlate, seed: number): void {
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  g.save();
  g.translate(x0, y0);
  // nền xanh men, hơi loang
  const grad = g.createLinearGradient(0, 0, 0, CELL_H);
  grad.addColorStop(0, '#2457a8');
  grad.addColorStop(1, '#1a4690');
  g.fillStyle = grad;
  g.fillRect(0, 0, CELL_W, CELL_H);
  // viền trắng
  g.strokeStyle = '#eef0ee';
  g.lineWidth = 6;
  g.strokeRect(7, 7, CELL_W - 14, CELL_H - 14);
  g.fillStyle = '#f4f6f3';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const fit = (text: string, size: number, y: number, weight = 800) => {
    g.font = `${weight} ${size}px "Be Vietnam Pro", Arial, sans-serif`;
    let sz = size;
    while (sz > 14 && g.measureText(text).width > CELL_W - 36) {
      sz -= 2;
      g.font = `${weight} ${sz}px "Be Vietnam Pro", Arial, sans-serif`;
    }
    g.fillText(text, CELL_W / 2, y);
  };
  if (p.style === 'street') {
    fit(p.line1, 20, 30, 700);
    fit(p.line2, 46, 76, 800);
    g.fillRect(40, 100, CELL_W - 80, 2);
  } else if (p.line2) {
    fit(p.line1, 56, 52, 800);
    fit(p.line2, 24, 100, 700);
  } else {
    fit(p.line1, 54, 64, 800);
  }
  // cũ: bạc màu từng mảng, trầy xước trắng, mép gỉ
  for (let i = 0; i < 34; i++) {
    g.fillStyle = `rgba(210,205,190,${0.04 + rnd() * 0.1})`;
    g.fillRect(rnd() * CELL_W, rnd() * CELL_H, 8 + rnd() * 40, 2 + rnd() * 10);
  }
  g.strokeStyle = 'rgba(235,235,230,0.5)';
  g.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const x = rnd() * CELL_W, y = rnd() * CELL_H;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 50, y + (rnd() - 0.5) * 16); g.stroke();
  }
  for (let i = 0; i < 9; i++) {
    g.fillStyle = `rgba(120,60,25,${0.35 + rnd() * 0.4})`;
    const edge = rnd() < 0.5;
    g.fillRect(edge ? rnd() * CELL_W : rnd() < 0.5 ? 0 : CELL_W - 5, edge ? (rnd() < 0.5 ? 0 : CELL_H - 5) : rnd() * CELL_H, 3 + rnd() * 9, 3 + rnd() * 7);
  }
  // vệt gỉ chảy xuống từ đinh tán ở góc
  for (const cx of [14, CELL_W - 14]) {
    const gr = g.createLinearGradient(0, 14, 0, 14 + 30 + rnd() * 30);
    gr.addColorStop(0, 'rgba(140,75,30,0.55)');
    gr.addColorStop(1, 'rgba(140,75,30,0)');
    g.fillStyle = gr;
    g.fillRect(cx - 2, 14, 4, 60);
    g.fillStyle = '#c9ccc9';
    g.beginPath(); g.arc(cx, 14, 3, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

/**
 * Dựng biển tên đường / số hẻm: mọi tấm biển vẽ chung một atlas canvas (mỗi chữ khác nhau một ô) → một mesh biển + một mesh cột.
 * Biển trên cột hiện cả hai mặt.
 */
export function buildStreetSigns(signs: StreetSigns, group: THREE.Group): void {
  if (!signs.plates.length) return;
  const keys = new Map<string, number>();
  const unique: SignPlate[] = [];
  for (const p of signs.plates) {
    const k = `${p.style}|${p.line1}|${p.line2}`;
    if (!keys.has(k)) {
      keys.set(k, unique.length);
      unique.push(p);
    }
  }
  const rows = Math.ceil(unique.length / COLS);
  const canvas = document.createElement('canvas');
  canvas.width = COLS * CELL_W;
  canvas.height = rows * CELL_H;
  const g = canvas.getContext('2d')!;
  unique.forEach((p, i) => drawPlate(g, (i % COLS) * CELL_W, Math.floor(i / COLS) * CELL_H, p, i + 1));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const geos: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const quad = (p: SignPlate, back: boolean) => {
    const g2 = new THREE.PlaneGeometry(p.w, p.h);
    const idx = keys.get(`${p.style}|${p.line1}|${p.line2}`)!;
    const u0 = ((idx % COLS) * CELL_W) / canvas.width;
    const v1 = 1 - (Math.floor(idx / COLS) * CELL_H) / canvas.height;
    const uv = g2.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (CELL_W / canvas.width), v1 - (1 - uv.getY(i)) * (CELL_H / canvas.height));
    q.setFromAxisAngle(up, p.rot + (back ? Math.PI : 0));
    const nx = Math.sin(p.rot) * (back ? -1 : 1);
    const nz = Math.cos(p.rot) * (back ? -1 : 1);
    g2.applyMatrix4(m.compose(new THREE.Vector3(p.x + nx * 0.012, p.y, p.z + nz * 0.012), q, new THREE.Vector3(1, 1, 1)));
    return g2;
  };
  for (const p of signs.plates) {
    geos.push(quad(p, false));
    if (p.double) geos.push(quad(p, true));
  }
  const plates = new THREE.Mesh(mergeGeometries(geos)!, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.3 }));
  group.add(plates);

  // cột sắt đen + tấm đỡ biển phía sau
  const postGeos: THREE.BufferGeometry[] = [];
  for (const p of signs.posts) {
    const pole = new THREE.CylinderGeometry(0.045, 0.055, p.h, 8).translate(p.x, p.h / 2, p.z);
    const cap = new THREE.SphereGeometry(0.06, 8, 6).translate(p.x, p.h + 0.02, p.z);
    postGeos.push(pole, cap);
  }
  // khung sau biển (viền kim loại mỏng)
  for (const p of signs.plates) {
    const back = new THREE.BoxGeometry(p.w + 0.03, p.h + 0.03, 0.012);
    q.setFromAxisAngle(up, p.rot);
    back.applyMatrix4(m.compose(new THREE.Vector3(p.x - Math.sin(p.rot) * 0.004, p.y, p.z - Math.cos(p.rot) * 0.004), q, new THREE.Vector3(1, 1, 1)));
    postGeos.push(back);
  }
  const frames = new THREE.Mesh(mergeGeometries(postGeos)!, new THREE.MeshStandardMaterial({ color: 0x2b2d2f, roughness: 0.6, metalness: 0.5 }));
  frames.castShadow = true;
  group.add(frames);
}
