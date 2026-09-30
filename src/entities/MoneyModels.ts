import * as THREE from 'three';
import { textCanvas } from '../products/LabelTexture';

/** Kích thước thật (m): tờ tiền 156 × 66mm, đồng xu 1.75mm dày. */
const NOTE_W = 0.156;
const NOTE_H = 0.066;
const COIN_R = 0.012;
const COIN_T = 0.0018;

interface Palette {
  paper: string;
  ink: string;
  accent: string;
}

/** Màu giấy & mực từng mệnh giá (nhạt như tiền thật, không loè loẹt). */
const PALETTES: Record<number, Palette> = {
  1: { paper: '#dde6d3', ink: '#3f6a48', accent: '#7a8f7b' },
  5: { paper: '#dcd6e4', ink: '#5b447f', accent: '#8f7eb0' },
  10: { paper: '#eadfc4', ink: '#a5601f', accent: '#c98a3f' },
  20: { paper: '#d9e6d8', ink: '#2f6b4c', accent: '#c99a7b' },
  50: { paper: '#ecd6dc', ink: '#8f3552', accent: '#c46b86' },
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
  for (const [x, y] of [[44, 44], [W - 44, 44], [44, H - 44], [W - 44, H - 44]]) g.fillText(String(denom), x, y);
  g.font = '900 44px "Nunito", Arial';
  g.fillStyle = `${p.ink}dd`;
  g.fillText(`$${denom}`, cx, 38);
  g.font = '800 18px "Nunito", Arial';
  g.letterSpacing = '3px';
  g.fillText('MINI MART BANK · LEGAL TENDER', cx, H - 34);
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

function coinFace(denom: number): THREE.CanvasTexture {
  const copper = denom < 0.05;
  const base = copper ? ['#e0a06a', '#b8733d', '#8c4f24'] : denom === 0.05 ? ['#dfe3e6', '#aab2b8', '#7c858c'] : ['#f4f5f6', '#c4c9ce', '#8f979d'];
  const t = textCanvas(128, 128, (g) => {
    const grad = g.createRadialGradient(50, 46, 6, 64, 64, 66);
    grad.addColorStop(0, base[0]);
    grad.addColorStop(0.65, base[1]);
    grad.addColorStop(1, base[2]);
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(64, 64, 58, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(64, 64, 50, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.font = '900 46px "Nunito", Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(Math.round(denom * 100)), 64, 66);
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fillText(String(Math.round(denom * 100)), 62, 64);
  });
  t.anisotropy = 8;
  return t;
}

const coinMats = new Map<number, THREE.Material[]>();
const coinGeo = new THREE.CylinderGeometry(COIN_R, COIN_R, COIN_T, 40);
/** Đường kính tương đối: 25¢ lớn nhất, 10¢ nhỏ nhất (như tiền xu Mỹ) */
const COIN_SCALE: Record<number, number> = { 0.25: 1.0, 0.1: 0.75, 0.05: 0.875, 0.01: 0.8 };

function coinMaterials(denom: number): THREE.Material[] {
  let m = coinMats.get(denom);
  if (!m) {
    const copper = denom < 0.05;
    const face = new THREE.MeshStandardMaterial({ map: coinFace(denom), metalness: 0.85, roughness: 0.32 });
    const side = new THREE.MeshStandardMaterial({ color: copper ? 0xa8652f : 0xb9c0c6, metalness: 0.9, roughness: 0.4 });
    m = [side, face, face];
    coinMats.set(denom, m);
  }
  return m;
}

/** Tờ tiền (hơi cong, có hoạ tiết & số sê-ri) hoặc đồng xu (có số, viền) theo mệnh giá. */
export function moneyMesh(denom: number): THREE.Mesh {
  if (denom >= 1) {
    let m = noteMat.get(denom);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ map: noteTexture(denom), roughness: 0.85, side: THREE.DoubleSide });
      noteMat.set(denom, m);
    }
    const mesh = new THREE.Mesh(bentGeometry(noteCount++ % 3), m);
    mesh.castShadow = true;
    return mesh;
  }
  const mesh = new THREE.Mesh(coinGeo, coinMaterials(denom));
  const s = COIN_SCALE[denom] ?? 0.85;
  mesh.scale.set(s, 1, s);
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

/** Cột đồng xu xếp chồng (n đồng). */
export function coinStack(denom: number, n: number): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(COIN_R, COIN_R, COIN_T * n, 32);
  const [side, face] = coinMaterials(denom);
  const m = new THREE.Mesh(geo, [side, face, face]);
  const s = COIN_SCALE[denom] ?? 0.85;
  m.scale.set(s, 1, s);
  m.position.y = (COIN_T * n) / 2;
  m.castShadow = true;
  g.add(m);
  return g;
}
