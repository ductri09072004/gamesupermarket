import * as THREE from 'three';
import { mulberry32 } from '../core/Random';
import { textCanvas } from '../products/LabelTexture';
import { drawWear } from './SignWear';

/**
 * Bảng hiệu kiểu Việt: mỗi tiệm một chất liệu & phông chữ riêng.
 * - lightbox: hộp đèn mica trắng, chữ màu có viền, phát sáng ban đêm
 * - enamel: biển tôn sơn dầu chữ nổi viền trắng, đinh tán, tróc sơn lộ gỉ
 * - paint: bảng gỗ/vữa sơn tay bằng chữ thư pháp (Lobster), viền nét cọ
 * - alu: biển alu hiện đại chữ đậm, ít hư hại
 */
export type SignStyle = 'lightbox' | 'enamel' | 'paint' | 'alu';

export interface SignSpec {
  text: string;
  sub?: string;
  style: SignStyle;
  /** Kích thước ảnh (px), mặc định 1024×256 */
  w?: number;
  h?: number;
  seed?: number;
  /** Màu nền / chữ / nhấn (CSS) */
  bg: string;
  ink: string;
  accent?: string;
  /** Mức hư hại 0..1 (mặc định theo kiểu biển) */
  wear?: number;
}

const FONTS: Record<SignStyle, (px: number) => string> = {
  lightbox: (px) => `800 ${px}px "Baloo 2", "Nunito", sans-serif`,
  enamel: (px) => `400 ${px}px "Alfa Slab One", "Bungee", serif`,
  paint: (px) => `400 ${px}px "Lobster", cursive`,
  alu: (px) => `800 ${px}px "Be Vietnam Pro", "Nunito", sans-serif`,
};
const DEFAULT_WEAR: Record<SignStyle, number> = { lightbox: 0.25, enamel: 0.75, paint: 0.5, alu: 0.12 };
/** Phông cho dòng phụ (nhỏ) */
const SUB_FONT = (px: number) => `800 ${px}px "Be Vietnam Pro", "Nunito", sans-serif`;

const cache = new Map<string, THREE.CanvasTexture>();

/** Cỡ chữ lớn nhất (≤ maxH) để dòng text vừa bề ngang maxW. */
function fit(g: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxW: number, maxH: number): number {
  let px = maxH;
  for (; px > 12; px -= 2) {
    g.font = font(px);
    if (g.measureText(text).width <= maxW) break;
  }
  return px;
}

function rivets(g: CanvasRenderingContext2D, w: number, h: number): void {
  for (const [x, y] of [[26, 26], [w - 26, 26], [26, h - 26], [w - 26, h - 26]]) {
    const r = g.createRadialGradient(x - 2, y - 2, 1, x, y, 9);
    r.addColorStop(0, '#e8e8e8');
    r.addColorStop(1, '#5a5a5a');
    g.fillStyle = r;
    g.beginPath();
    g.arc(x, y, 8, 0, Math.PI * 2);
    g.fill();
  }
}

function centered(g: CanvasRenderingContext2D, text: string, x: number, y: number, draw: (t: string, x: number, y: number) => void): void {
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  draw(text, x, y);
}

function drawLightbox(g: CanvasRenderingContext2D, s: SignSpec, w: number, h: number): void {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#f1ecd8');
  bg.addColorStop(0.5, '#fbf8ea');
  bg.addColorStop(1, '#ebe5cc');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = s.accent ?? s.bg;
  g.lineWidth = 14;
  g.strokeRect(14, 14, w - 28, h - 28);
  const subH = s.sub ? h * 0.2 : 0;
  const px = fit(g, s.text, FONTS.lightbox, w - 110, h - 70 - subH);
  g.font = FONTS.lightbox(px);
  centered(g, s.text, w / 2, h / 2 - subH / 2, (t, x, y) => {
    g.lineJoin = 'round';
    g.lineWidth = px * 0.12;
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.strokeText(t, x, y + 2);
    g.fillStyle = s.ink;
    g.fillText(t, x, y);
  });
  if (s.sub) {
    g.font = SUB_FONT(subH * 0.8);
    g.fillStyle = s.accent ?? s.bg;
    centered(g, s.sub, w / 2, h - 46 - subH * 0.15, (t, x, y) => g.fillText(t, x, y, w - 120));
  }
  // ố vàng ở mép trên, mối ghép mica
  const y = g.createLinearGradient(0, 0, 0, h * 0.35);
  y.addColorStop(0, 'rgba(120,90,30,0.28)');
  y.addColorStop(1, 'rgba(120,90,30,0)');
  g.fillStyle = y;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,0.06)';
  g.fillRect(w / 3, 0, 3, h);
  g.fillRect((2 * w) / 3, 0, 3, h);
}

function drawEnamel(g: CanvasRenderingContext2D, s: SignSpec, w: number, h: number): void {
  g.fillStyle = s.bg;
  g.fillRect(0, 0, w, h);
  const sh = g.createLinearGradient(0, 0, w, h);
  sh.addColorStop(0, 'rgba(255,255,255,0.14)');
  sh.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = sh;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = s.accent ?? '#f4ecd0';
  g.lineWidth = 8;
  g.strokeRect(16, 16, w - 32, h - 32);
  const subH = s.sub ? h * 0.2 : 0;
  const px = fit(g, s.text, FONTS.enamel, w - 120, h - 80 - subH);
  g.font = FONTS.enamel(px);
  centered(g, s.text, w / 2, h / 2 - subH / 2, (t, x, y) => {
    g.lineJoin = 'round';
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillText(t, x + px * 0.05, y + px * 0.06);
    g.lineWidth = px * 0.1;
    g.strokeStyle = s.accent ?? '#f4ecd0';
    g.strokeText(t, x, y);
    g.fillStyle = s.ink;
    g.fillText(t, x, y);
  });
  if (s.sub) {
    g.font = SUB_FONT(subH * 0.7);
    g.fillStyle = s.accent ?? '#f4ecd0';
    centered(g, s.sub, w / 2, h - 48 - subH * 0.1, (t, x, y) => g.fillText(t, x, y, w - 140));
  }
  rivets(g, w, h);
}

function drawPaint(g: CanvasRenderingContext2D, s: SignSpec, w: number, h: number, rng: () => number): void {
  g.fillStyle = s.bg;
  g.fillRect(0, 0, w, h);
  // vân cọ ngang mờ
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(${rng() < 0.5 ? '255,255,255' : '0,0,0'},${0.02 + rng() * 0.04})`;
    g.fillRect(0, rng() * h, w, 2 + rng() * 6);
  }
  g.strokeStyle = s.accent ?? s.ink;
  g.lineWidth = 9;
  g.beginPath();
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const j = () => (rng() - 0.5) * 3;
    const pts: Array<[number, number]> = [[18 + t * (w - 36), 20 + j()], [w - 20 + j(), 18 + t * (h - 36)], [w - 18 - t * (w - 36), h - 20 + j()], [20 + j(), h - 18 - t * (h - 36)]];
    for (const [x, y] of pts) (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y));
  }
  g.stroke();
  const subH = s.sub ? h * 0.2 : 0;
  const px = fit(g, s.text, FONTS.paint, w - 120, h - 90 - subH);
  g.font = FONTS.paint(px);
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  const total = g.measureText(s.text).width;
  let x = (w - total) / 2;
  const y = h / 2 - subH / 2;
  for (const ch of s.text) {
    const cw = g.measureText(ch).width;
    g.save();
    g.translate(x + cw / 2, y + (rng() - 0.5) * 6);
    g.rotate((rng() - 0.5) * 0.06);
    g.lineJoin = 'round';
    g.lineWidth = px * 0.11;
    g.strokeStyle = 'rgba(0,0,0,0.3)';
    g.strokeText(ch, -cw / 2 + 3, 3);
    g.fillStyle = s.ink;
    g.fillText(ch, -cw / 2, 0);
    g.restore();
    x += cw;
  }
  if (s.sub) {
    g.font = SUB_FONT(subH * 0.62);
    g.fillStyle = s.accent ?? s.ink;
    centered(g, s.sub, w / 2, h - 52 - subH * 0.05, (t, xx, yy) => g.fillText(t, xx, yy, w - 140));
  }
}

function drawAlu(g: CanvasRenderingContext2D, s: SignSpec, w: number, h: number): void {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, s.bg);
  bg.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = s.bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = bg;
  g.globalAlpha = 0.35;
  g.fillRect(0, 0, w, h);
  g.globalAlpha = 1;
  const subH = s.sub ? h * 0.2 : 0;
  const px = fit(g, s.text, FONTS.alu, w - 100, h - 80 - subH);
  g.font = FONTS.alu(px);
  centered(g, s.text, w / 2, h / 2 - subH / 2, (t, x, y) => {
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillText(t, x + 3, y + 4);
    g.fillStyle = s.ink;
    g.fillText(t, x, y);
  });
  g.fillStyle = s.accent ?? '#e6b422';
  g.fillRect(50, h - 34 - subH, w - 100, 5);
  if (s.sub) {
    g.font = SUB_FONT(subH * 0.62);
    g.fillStyle = s.accent ?? '#e6b422';
    centered(g, s.sub, w / 2, h - 30 - subH * 0.2, (t, x, y) => g.fillText(t, x, y, w - 120));
  }
}

/** Ảnh biển hiệu (cache theo nội dung). Gọi sau khi phông chữ đã nạp (document.fonts). */
export function signTexture(s: SignSpec): THREE.CanvasTexture {
  const key = JSON.stringify(s);
  const hit = cache.get(key);
  if (hit) return hit;
  const w = s.w ?? 1024;
  const h = s.h ?? 256;
  const rng = mulberry32((s.seed ?? 1) * 7919 + s.text.length);
  const tex = textCanvas(w, h, (g) => {
    if (s.style === 'lightbox') drawLightbox(g, s, w, h);
    else if (s.style === 'enamel') drawEnamel(g, s, w, h);
    else if (s.style === 'paint') drawPaint(g, s, w, h, rng);
    else drawAlu(g, s, w, h);
    drawWear(g, w, h, s.wear ?? DEFAULT_WEAR[s.style], rng);
  });
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

/** Vật liệu cho mặt biển; lightbox tự phát sáng (bật mạnh ban đêm bằng emissiveIntensity). */
export function signMaterial(s: SignSpec): THREE.MeshStandardMaterial {
  const map = signTexture(s);
  const lit = s.style === 'lightbox';
  return new THREE.MeshStandardMaterial({
    map, roughness: s.style === 'enamel' ? 0.42 : s.style === 'lightbox' ? 0.3 : 0.7, metalness: s.style === 'enamel' ? 0.25 : 0,
    emissive: lit ? 0xffffff : 0x000000, emissiveMap: lit ? map : null, emissiveIntensity: lit ? 0.35 : 0,
  });
}

/** Nạp sẵn phông chữ biển hiệu để canvas vẽ đúng (gọi lúc khởi động, trước khi dựng thành phố). */
export async function loadSignFonts(): Promise<void> {
  const specs = ['800 40px "Baloo 2"', '400 40px "Alfa Slab One"', '400 40px "Lobster"', '800 40px "Be Vietnam Pro"', '400 40px "Bungee"', '400 40px "Patrick Hand"'];
  const sample = 'Tiệm Tạp Hóa Cà Phê Nhà Thuốc ĐÓNG MỞ CỬA';
  await Promise.all(specs.map((f) => document.fonts.load(f, sample).catch(() => [])));
}
