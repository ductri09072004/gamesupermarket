import { formatMoney } from '../core/Random';
import * as THREE from 'three';
import { textCanvas } from '../products/LabelTexture';

export { moneyMesh } from '../entities/MoneyModels';

/** Thẻ ngân hàng khách đưa. */
export function cardMesh(): THREE.Mesh {
  const tex = textCanvas(256, 160, (g) => {
    const grad = g.createLinearGradient(0, 0, 256, 160);
    grad.addColorStop(0, '#1d4a3f');
    grad.addColorStop(1, '#0f2f27');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 160);
    g.fillStyle = '#ffd166';
    g.fillRect(24, 50, 44, 32);
    g.fillStyle = '#ffffff';
    g.font = '700 20px monospace';
    g.fillText('4821 •••• •••• 0427', 24, 118);
    g.font = '900 22px "Nunito", Arial';
    g.fillText('ĐẦU HẺM BANK', 24, 34);
  });
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.2 });
  const side = new THREE.MeshStandardMaterial({ color: 0x1d4a3f });
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

/** Màn hình quầy kiểu cũ: đèn LED hổ phách trên nền đen, chữ số mờ "88.88" phía sau, vạch quét ngang. */
export function drawLcd(canvas: HTMLCanvasElement, lines: string[], total: number, big?: string): void {
  const g = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  g.fillStyle = '#0b0d08';
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.7);
  glow.addColorStop(0, 'rgba(90, 70, 10, 0.2)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  g.textBaseline = 'top';
  g.textAlign = 'left';
  g.font = '700 28px "Courier New", monospace';
  g.fillStyle = '#ffb000';
  g.shadowColor = '#ff9a00';
  g.shadowBlur = 8;
  lines.slice(-4).forEach((l, i) => g.fillText(l.slice(0, 26), 16, 12 + i * 34));
  const text = big ?? formatMoney(total);
  g.font = '900 58px "Courier New", monospace';
  g.textAlign = 'right';
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(255, 176, 0, 0.1)';
  g.fillText(text.replace(/[0-9]/g, '8'), W - 16, H - 74);
  g.fillStyle = '#ffc933';
  g.shadowColor = '#ff9a00';
  g.shadowBlur = 14;
  g.fillText(text, W - 16, H - 74);
  g.shadowBlur = 0;
  g.textAlign = 'left';
  g.font = '700 24px "Courier New", monospace';
  g.fillStyle = '#ffb000';
  g.fillText('TỔNG', 16, H - 44);
  g.fillStyle = 'rgba(0, 0, 0, 0.2)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
}
