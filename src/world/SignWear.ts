import type { Rng } from '../core/Random';

/**
 * Lớp bạc màu / gỉ sét cho bảng hiệu: 2 ảnh vết tróc sơn lộ gỉ + 1 ảnh vệt nước chảy (ambientCG, CC0 — đã tách kênh alpha),
 * nạp lúc khởi động rồi vẽ đè lên canvas biển với vị trí, tỉ lệ, độ đậm ngẫu nhiên.
 */
const images = new Map<string, HTMLImageElement>();

export const SIGN_WEAR = ['wear_a', 'wear_b', 'streak'] as const;

export async function loadSignWear(base = 'assets/textures/signs/'): Promise<void> {
  await Promise.all(SIGN_WEAR.map((name) => new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => { images.set(name, img); resolve(); };
    img.onerror = () => resolve();
    img.src = `${base}${name}.png`;
  })));
}

function tile(c: CanvasRenderingContext2D, name: string, w: number, h: number, alpha: number, scale: number, rng: Rng): void {
  const img = images.get(name);
  const pat = img ? c.createPattern(img, 'repeat') : null;
  if (!pat) return;
  pat.setTransform(new DOMMatrix().translate(rng() * 512, rng() * 512).scale(rng() < 0.5 ? -scale : scale, scale));
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = pat;
  c.fillRect(0, 0, w, h);
  c.restore();
}

/**
 * Phủ lên biển đã vẽ: tróc sơn lộ gỉ (đậm ở mép & góc, mờ ở giữa để chữ vẫn đọc được), vệt nước chảy, bụi dồn ở mép dưới.
 * amount 0..1 = mức hư hại.
 */
export function drawWear(g: CanvasRenderingContext2D, w: number, h: number, amount: number, rng: Rng): void {
  if (amount <= 0) return;
  const wc = document.createElement('canvas');
  wc.width = w;
  wc.height = h;
  const c = wc.getContext('2d')!;
  tile(c, rng() < 0.5 ? 'wear_a' : 'wear_b', w, h, Math.min(1, 0.5 + amount * 0.6), (0.4 + rng() * 0.5) * Math.max(0.6, w / 512), rng);
  // xoá bớt vùng giữa biển
  c.globalCompositeOperation = 'destination-out';
  const grad = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.12, w / 2, h / 2, Math.hypot(w, h) * 0.55);
  grad.addColorStop(0, `rgba(0,0,0,${0.7 + (1 - amount) * 0.3})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = grad;
  c.fillRect(0, 0, w, h);
  g.drawImage(wc, 0, 0);
  tile(g, 'streak', w, h, 0.12 + 0.3 * amount, (0.8 + rng() * 0.5) * Math.max(0.6, w / 512), rng);
  const dirt = g.createLinearGradient(0, h * 0.6, 0, h);
  dirt.addColorStop(0, 'rgba(50,38,24,0)');
  dirt.addColorStop(1, `rgba(50,38,24,${0.2 + 0.3 * amount})`);
  g.fillStyle = dirt;
  g.fillRect(0, 0, w, h);
}
