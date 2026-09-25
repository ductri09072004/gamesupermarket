import * as THREE from 'three';
import { textCanvas } from '../products/LabelTexture';

const billMats = new Map<number, THREE.Material[]>();
const coinMat = new Map<number, THREE.MeshStandardMaterial>();
const billGeo = new THREE.BoxGeometry(0.15, 0.002, 0.07);
const coinGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.004, 20);

/** Mesh tờ tiền / đồng xu theo mệnh giá. */
export function moneyMesh(denom: number): THREE.Mesh {
  if (denom >= 1) {
    let m = billMats.get(denom);
    if (!m) {
      const hue = { 1: '#8fbf8f', 5: '#b39ddb', 10: '#ffcc80', 20: '#80cbc4', 50: '#f48fb1' }[denom] ?? '#b7e4c7';
      const tex = textCanvas(256, 120, (g) => {
        g.fillStyle = hue;
        g.fillRect(0, 0, 256, 120);
        g.strokeStyle = 'rgba(0,0,0,0.35)';
        g.lineWidth = 6;
        g.strokeRect(6, 6, 244, 108);
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.beginPath();
        g.ellipse(128, 60, 40, 44, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#1b4332';
        g.font = '900 54px "Nunito", Arial';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(`$${denom}`, 128, 62);
        g.font = '800 26px "Nunito", Arial';
        g.fillText(String(denom), 30, 26);
        g.fillText(String(denom), 226, 96);
      });
      const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
      const side = new THREE.MeshStandardMaterial({ color: hue, roughness: 0.8 });
      m = [side, side, top, top, side, side];
      billMats.set(denom, m);
    }
    const mesh = new THREE.Mesh(billGeo, m);
    mesh.castShadow = true;
    return mesh;
  }
  let cm = coinMat.get(denom);
  if (!cm) {
    cm = new THREE.MeshStandardMaterial({ color: denom >= 0.1 ? 0xd9d9d9 : 0xc87533, metalness: 0.9, roughness: 0.3 });
    coinMat.set(denom, cm);
  }
  const mesh = new THREE.Mesh(coinGeo, cm);
  const s = denom === 0.25 ? 1.15 : denom === 0.1 ? 0.8 : denom === 0.05 ? 1 : 0.85;
  mesh.scale.set(s, 1, s);
  return mesh;
}

/** Thẻ ngân hàng khách đưa. */
export function cardMesh(): THREE.Mesh {
  const tex = textCanvas(256, 160, (g) => {
    const grad = g.createLinearGradient(0, 0, 256, 160);
    grad.addColorStop(0, '#3a86ff');
    grad.addColorStop(1, '#8338ec');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 160);
    g.fillStyle = '#ffd166';
    g.fillRect(24, 50, 44, 32);
    g.fillStyle = '#ffffff';
    g.font = '700 20px monospace';
    g.fillText('4821 •••• •••• 0427', 24, 118);
    g.font = '900 22px "Nunito", Arial';
    g.fillText('MINI BANK', 24, 34);
  });
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.2 });
  const side = new THREE.MeshStandardMaterial({ color: 0x3a86ff });
  return new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.002, 0.054), [side, side, face, side, side, side]);
}

/** Túi giấy cho khách mang về. */
export function bagMesh(): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xc8a27a, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.16), m);
  body.position.y = -0.15;
  body.castShadow = true;
  g.add(body);
  return g;
}

/** Vẽ màn hình LCD quầy. */
export function drawLcd(canvas: HTMLCanvasElement, lines: string[], total: number, big?: string): void {
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#0f1f14';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#9ef01a';
  g.font = '700 30px "Courier New", monospace';
  g.textBaseline = 'top';
  lines.slice(-4).forEach((l, i) => g.fillText(l.slice(0, 26), 16, 12 + i * 36));
  g.fillStyle = '#d9f99d';
  g.font = '900 52px "Courier New", monospace';
  g.textAlign = 'right';
  g.fillText(big ?? `$${total.toFixed(2)}`, canvas.width - 16, canvas.height - 64);
  g.textAlign = 'left';
  g.font = '700 26px "Courier New", monospace';
  g.fillText('TOTAL', 16, canvas.height - 50);
}
