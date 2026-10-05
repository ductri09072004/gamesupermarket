import { formatVnd } from '../core/Random';
import * as THREE from 'three';

export { moneyMesh } from '../entities/MoneyModels';

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

export interface ReceiptLine {
  name: string;
  qty: number;
  sum: number;
}

/** Nội dung tờ hoá đơn viết tay: món đã quét (gộp theo mặt hàng), tổng, tiền khách đưa, tiền phải thối. */
export interface ReceiptData {
  lines: ReceiptLine[];
  total?: number;
  paid?: number;
  due?: number;
  /** Tiền thối đã lấy ra khỏi khay cho tới giờ */
  given?: number;
  /** Dòng ghi chú cuối (vd. "Đã thối xong") và con dấu */
  note?: string;
}

type Receipt = { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture };

const HAND = '"Caveat", "Segoe Script", "Bradley Hand", "Comic Sans MS", cursive';
const drawn = new Map<Receipt, ReceiptData>();
let fontReady = false;
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.load('700 32px Caveat').then(() => {
    fontReady = true;
    for (const [r, d] of drawn) drawReceipt(r, d);
  }).catch(() => undefined);
}

/** Số lệch nhỏ có hạt giống: nét chữ viết tay không thẳng tăm tắp. */
const wobble = (i: number, k: number): number => Math.sin(i * 12.9898 + k * 78.233) * 0.5;

/** Vẽ tờ hoá đơn viết tay (giấy ô li, mực bi xanh, số tiền thối bằng mực đỏ). */
export function drawReceipt(r: Receipt, d: ReceiptData): void {
  drawn.set(r, d);
  const { canvas, tex } = r;
  const g = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  g.fillStyle = '#f3ead0';
  g.fillRect(0, 0, W, H);
  // kẻ ô li + lề đỏ
  g.strokeStyle = 'rgba(90, 130, 190, 0.28)';
  g.lineWidth = 1.5;
  for (let y = 96; y < H; y += 36) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  g.strokeStyle = 'rgba(200, 70, 70, 0.45)';
  g.beginPath();
  g.moveTo(54, 0);
  g.lineTo(54, H);
  g.stroke();
  g.textBaseline = 'alphabetic';
  const ink = '#1f3a8a';
  const red = '#b3261e';
  g.fillStyle = ink;
  g.font = `700 44px ${HAND}`;
  g.textAlign = 'left';
  g.fillText('Hoá đơn', 70, 56);
  g.font = `600 24px ${HAND}`;
  g.fillText('Tạp hoá Đầu Hẻm', 72, 82);
  // dòng chân: tổng / đưa / thối
  const foot = 4;
  const rowH = 36;
  const top = 126;
  const footTop = H - 20 - foot * rowH - 10;
  const maxRows = Math.max(1, Math.floor((footTop - top) / rowH));
  const lines = d.lines;
  const shown = lines.length > maxRows ? lines.slice(lines.length - maxRows) : lines;
  shown.forEach((l, i) => {
    const y = top + i * rowH + wobble(i, 1) * 3;
    g.save();
    g.translate(0, y);
    g.rotate(wobble(i, 2) * 0.012);
    g.fillStyle = ink;
    g.font = `600 28px ${HAND}`;
    g.textAlign = 'right';
    const price = formatVnd(l.sum);
    g.fillText(price, W - 28, 0);
    const pw = g.measureText(price).width;
    g.textAlign = 'left';
    let label = `${l.name}${l.qty > 1 ? ` x${l.qty}` : ''}`;
    const room = W - 28 - pw - 90;
    while (label.length > 3 && g.measureText(label).width > room) label = label.slice(0, -2) + '…';
    g.fillText(label, 68, 0);
    g.restore();
  });
  if (shown.length < lines.length) {
    g.fillStyle = 'rgba(31, 58, 138, 0.55)';
    g.font = `600 20px ${HAND}`;
    g.textAlign = 'left';
    g.fillText(`… còn ${lines.length - shown.length} món ở trên`, 70, top - 24);
  }
  const row = (i: number, label: string, value: number | string | undefined, color: string, big = false) => {
    const y = footTop + 10 + i * rowH + 26;
    g.save();
    g.translate(0, y);
    g.rotate(wobble(i, 5) * 0.01);
    g.fillStyle = color;
    g.textAlign = 'left';
    g.font = `${big ? 800 : 700} ${big ? 34 : 30}px ${HAND}`;
    g.fillText(label, 68, 0);
    g.textAlign = 'right';
    g.fillText(value === undefined ? '...' : typeof value === 'string' ? value : `${formatVnd(value)}đ`, W - 28, 0);
    g.restore();
  };
  // gạch ngang trước dòng tổng
  g.strokeStyle = ink;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(64, footTop);
  g.lineTo(W - 24, footTop + 2);
  g.stroke();
  row(0, 'Tổng:', d.total ?? 0, ink, true);
  row(1, 'Khách đưa:', d.paid, ink);
  row(2, 'Thối lại:', d.due, red, true);
  if (d.due !== undefined) {
    // còn thiếu bao nhiêu sau khi đã lấy tiền ra (lẻ dưới 200đ không cần thối)
    const rem = Math.round((d.due - (d.given ?? 0)) * 100);
    const [label, value, color] = rem >= 20 ? ['Còn thiếu:', `${formatVnd(rem / 100)}đ`, red]
      : rem < 0 ? ['Thối dư:', `${formatVnd(-rem / 100)}đ`, red] : ['Còn thiếu:', 'Đủ rồi', ink];
    row(3, label, value, color as string, true);
  }
  if (d.note) {
    g.save();
    g.translate(W - 120, H - 150);
    g.rotate(-0.18);
    g.strokeStyle = red;
    g.fillStyle = red;
    g.lineWidth = 4;
    g.strokeRect(-90, -30, 180, 56);
    g.font = `800 30px ${HAND}`;
    g.textAlign = 'center';
    g.fillText(d.note, 0, 10, 168);
    g.restore();
  }
  // vết ố giấy rất nhẹ
  g.fillStyle = 'rgba(120, 90, 40, 0.035)';
  for (let i = 0; i < 40; i++) g.fillRect((i * 97) % W, (i * 211) % H, 2, 2);
  tex.needsUpdate = true;
  if (!fontReady && typeof document !== 'undefined' && document.fonts?.status === 'loaded') fontReady = true;
}

/** Tờ trống khi chưa có khách. */
export const BLANK_RECEIPT: ReceiptData = { lines: [] };
