import * as THREE from 'three';
import { textCanvas } from '../products/LabelTexture';

export { moneyMesh } from '../entities/MoneyModels';

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
