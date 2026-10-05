import { formatVnd } from '../core/Random';
import * as THREE from 'three';
import { textCanvas } from '../products/LabelTexture';

/** Kích thước thật (m): tờ tiền 156 × 66mm. */
const NOTE_W = 0.156;
const NOTE_H = 0.066;

interface Palette {
  paper: string;
  ink: string;
  accent: string;
}

/** Màu giấy & mực từng mệnh giá (nhạt như tiền thật, không loè loẹt). */
const PALETTES: Record<number, Palette> = {
  0.2: { paper: '#e2d6bf', ink: '#6b4a2a', accent: '#a98558' },
  0.5: { paper: '#e8d3d0', ink: '#8a3a35', accent: '#c07a72' },
  1: { paper: '#dad7e0', ink: '#5a4f7a', accent: '#8f86ad' },
  2: { paper: '#d6dcd0', ink: '#4f6f5b', accent: '#8aa393' },
  5: { paper: '#d3dcea', ink: '#2f5f8a', accent: '#7ea0c4' },
  10: { paper: '#eadfc4', ink: '#a5601f', accent: '#c98a3f' },
  20: { paper: '#d2e3e8', ink: '#1d6c80', accent: '#6fb0bf' },
  50: { paper: '#ecd6dc', ink: '#8f3552', accent: '#c46b86' },
  100: { paper: '#d9e6d8', ink: '#2f6b4c', accent: '#7fb092' },
};

/** Số ngẫu nhiên có hạt giống — cùng mệnh giá luôn ra cùng hoa văn. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function drawNote(g: CanvasRenderingContext2D, W: number, H: number, denom: number): void {
  const p = PALETTES[denom] ?? PALETTES[1];
  const r = rng(denom * 7919);
  g.fillStyle = p.paper;
  g.fillRect(0, 0, W, H);
  // vân lượn nền (guilloche) rất nhẹ
  g.lineWidth = 1;
  for (let i = 0; i < 46; i++) {
    g.strokeStyle = i % 2 ? `${p.ink}22` : `${p.accent}30`;
    g.beginPath();
    for (let x = 0; x <= W; x += 6) {
      const y = (H * i) / 46 + Math.sin(x * 0.045 + i * 0.7) * 4 + Math.sin(x * 0.013 + i) * 6;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  // khung kép
  g.strokeStyle = p.ink;
  g.lineWidth = 5;
  g.strokeRect(10, 10, W - 20, H - 20);
  g.lineWidth = 1.5;
  g.strokeRect(20, 20, W - 40, H - 40);
  // chân dung: oval + nửa người
  const cx = W / 2;
  const cy = H / 2 + 8;
  const grad = g.createRadialGradient(cx, cy, 10, cx, cy, 78);
  grad.addColorStop(0, `${p.paper}`);
  grad.addColorStop(1, `${p.accent}66`);
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(cx, cy, 56, 64, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = p.ink;
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = `${p.ink}cc`;
  g.beginPath();
  g.arc(cx, cy - 16, 20, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(cx - 46, cy + 52);
  g.quadraticCurveTo(cx - 38, cy + 12, cx, cy + 8);
  g.quadraticCurveTo(cx + 38, cy + 12, cx + 46, cy + 52);
  g.closePath();
  g.fill();
  // ấn triện hai bên
  for (const [sx, col] of [[78, p.accent], [W - 78, p.ink]] as const) {
    for (let k = 3; k > 0; k--) {
      g.strokeStyle = k % 2 ? col : `${col}88`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(sx, cy, 14 + k * 8, 0, Math.PI * 2);
      g.stroke();
    }
  }
  // mệnh giá: 4 góc + chữ lớn
  g.fillStyle = p.ink;
  g.font = '900 34px "Nunito", Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '900 24px "Nunito", Arial';
  for (const [x, y] of [[58, 44], [W - 58, 44], [58, H - 44], [W - 58, H - 44]]) g.fillText(formatVnd(denom), x, y);
  g.font = '900 44px "Nunito", Arial';
  g.fillStyle = `${p.ink}dd`;
  g.fillText(`${formatVnd(denom)} ĐỒNG`, cx, 38);
  g.font = '800 18px "Nunito", Arial';
  g.letterSpacing = '3px';
  g.fillText('NGÂN HÀNG ĐẦU HẺM · TIỀN ĐỒNG', cx, H - 34);
  g.letterSpacing = '0px';
  // số sê-ri đỏ sẫm
  g.fillStyle = '#8f2d2d';
  g.font = '700 17px "Courier New", monospace';
  const serial = () => `${String.fromCharCode(65 + Math.floor(r() * 26))}${String(Math.floor(r() * 1e8)).padStart(8, '0')}${String.fromCharCode(65 + Math.floor(r() * 26))}`;
  g.textAlign = 'left';
  g.fillText(serial(), 72, H - 68);
  g.textAlign = 'right';
  g.fillText(serial(), W - 72, 68);
  // hạt giấy
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.045)' : 'rgba(255,255,255,0.06)';
    g.fillRect(r() * W, r() * H, 1.5, 1.5);
  }
}

const noteTex = new Map<number, THREE.CanvasTexture>();
function noteTexture(denom: number): THREE.CanvasTexture {
  let t = noteTex.get(denom);
  if (!t) {
    t = textCanvas(512, 216, (g) => drawNote(g, 512, 216, denom));
    t.anisotropy = 8;
    noteTex.set(denom, t);
  }
  return t;
}

/** Tờ tiền hơi cong / nhăn: 3 dáng khác nhau dùng chung. */
const bentGeos: THREE.PlaneGeometry[] = [];
function bentGeometry(v: number): THREE.PlaneGeometry {
  if (!bentGeos[v]) {
    const g = new THREE.PlaneGeometry(NOTE_W, NOTE_H, 18, 4);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const r = rng(101 + v * 31);
    const phase = r() * 6;
    const curl = (r() - 0.5) * 0.008;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / NOTE_W;
      const z = pos.getZ(i) / (NOTE_H / 2);
      pos.setY(i, 0.0025 + 0.0022 * Math.sin(x * Math.PI * 2.2 + phase) + curl * z * z + 0.001 * Math.sin(z * 3 + phase * 2));
    }
    g.computeVertexNormals();
    bentGeos[v] = g;
  }
  return bentGeos[v];
}

const noteMat = new Map<number, THREE.MeshStandardMaterial>();
let noteCount = 0;

/** Tờ tiền giấy (hơi cong, có hoạ tiết & số sê-ri) theo mệnh giá. */
export function moneyMesh(denom: number): THREE.Mesh {
  let m = noteMat.get(denom);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: noteTexture(denom), roughness: 0.85, side: THREE.DoubleSide });
    noteMat.set(denom, m);
  }
  const mesh = new THREE.Mesh(bentGeometry(noteCount++ % 3), m);
  mesh.castShadow = true;
  return mesh;
}

const edgeTex = new Map<number, THREE.CanvasTexture>();
function edgeTexture(denom: number): THREE.CanvasTexture {
  let t = edgeTex.get(denom);
  if (!t) {
    const p = PALETTES[denom] ?? PALETTES[1];
    t = textCanvas(8, 64, (g) => {
      g.fillStyle = p.paper;
      g.fillRect(0, 0, 8, 64);
      for (let y = 0; y < 64; y += 2) {
        g.fillStyle = y % 4 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.35)';
        g.fillRect(0, y, 8, 1);
      }
    });
    edgeTex.set(denom, t);
  }
  return t;
}

/** Xấp tiền có băng giấy (đặt trong khay ngăn kéo): dài theo trục Z, cao ~1.2cm. */
export function moneyStack(denom: number): THREE.Group {
  const g = new THREE.Group();
  const p = PALETTES[denom] ?? PALETTES[1];
  const top = noteTexture(denom).clone();
  top.needsUpdate = true;
  top.center.set(0.5, 0.5);
  top.rotation = Math.PI / 2;
  const edge = new THREE.MeshStandardMaterial({ map: edgeTexture(denom), roughness: 0.9 });
  const topMat = new THREE.MeshStandardMaterial({ map: top, roughness: 0.85 });
  const H = 0.012;
  const block = new THREE.Mesh(new THREE.BoxGeometry(NOTE_H, H, NOTE_W), [edge, edge, topMat, edge, edge, edge]);
  block.position.y = H / 2;
  block.castShadow = true;
  const band = new THREE.Mesh(new THREE.BoxGeometry(NOTE_H + 0.001, H + 0.0006, 0.02), new THREE.MeshStandardMaterial({ color: new THREE.Color(p.accent), roughness: 0.8 }));
  band.position.y = H / 2;
  g.add(block, band);
  g.rotation.y = 0.04 * (denom % 3 - 1);
  return g;
}

