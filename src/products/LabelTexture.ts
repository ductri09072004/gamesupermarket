import * as THREE from 'three';
import type { ProductDef } from '../config/products';
import { hashString } from '../core/Random';
import { eanBits, eanFromId } from './Ean13';

const cache = new Map<string, THREE.CanvasTexture>();
export const LABEL_FONT = '"Nunito", "Segoe UI", Arial, sans-serif';

function pattern(g: CanvasRenderingContext2D, p: ProductDef, W: number, H: number): void {
  const { accent, pattern: kind } = p.label;
  g.save();
  g.globalAlpha = 0.18;
  g.fillStyle = accent;
  g.strokeStyle = accent;
  if (kind === 'stripes') {
    g.lineWidth = 18;
    for (let x = -H; x < W + H; x += 56) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + H, H);
      g.stroke();
    }
  } else if (kind === 'dots') {
    for (let y = 20; y < H; y += 44) for (let x = (y / 44) % 2 ? 20 : 42; x < W; x += 44) {
      g.beginPath();
      g.arc(x, y, 8, 0, Math.PI * 2);
      g.fill();
    }
  } else if (kind === 'wave') {
    g.globalAlpha = 0.28;
    g.lineWidth = 14;
    for (let y = 60; y < H; y += 90) {
      g.beginPath();
      for (let x = 0; x <= W; x += 8) g.lineTo(x, y + Math.sin(x / 40) * 14);
      g.stroke();
    }
  }
  g.restore();
}

function logo(g: CanvasRenderingContext2D, p: ProductDef, cx: number, cy: number, r: number): void {
  const h = hashString(p.brand);
  g.save();
  g.translate(cx, cy);
  g.fillStyle = p.label.accent;
  g.strokeStyle = p.label.text;
  g.lineWidth = 5;
  const n = 3 + (h % 5);
  g.beginPath();
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = h % 2 ? (i % 2 ? r * 0.55 : r) : r;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
}

function fitText(g: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight: number): void {
  let s = size;
  do {
    g.font = `${weight} ${s}px ${LABEL_FONT}`;
    s -= 2;
  } while (g.measureText(text).width > maxW && s > 10);
}

export function drawBarcode(g: CanvasRenderingContext2D, code: string, x: number, y: number, w: number, h: number): void {
  const bits = eanBits(code);
  g.fillStyle = '#ffffff';
  g.fillRect(x - 8, y - 6, w + 16, h + 30);
  const m = w / bits.length;
  g.fillStyle = '#111111';
  for (let i = 0; i < bits.length; i++) if (bits[i] === '1') g.fillRect(x + i * m, y, Math.ceil(m), h);
  g.font = `600 16px monospace`;
  g.textAlign = 'center';
  g.fillText(`${code[0]} ${code.slice(1, 7)} ${code.slice(7)}`, x + w / 2, y + h + 18);
}

/**
 * Nhãn 512×512: nền, hoạ tiết, logo, tên hãng lớn, tên sản phẩm, dung tích, mã vạch.
 * Với bao bì hình trụ, tâm ảnh (u = 0.5) là mặt trước; mã vạch nằm ở mặt bên.
 */
export function labelTexture(p: ProductDef): THREE.CanvasTexture {
  const hit = cache.get(p.id);
  if (hit) return hit;
  const W = 512;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = p.label.bg;
  g.fillRect(0, 0, W, H);
  pattern(g, p, W, H);
  const round = p.shape === 'can' || p.shape === 'bottle' || p.shape === 'jar' || p.shape === 'tube';
  const cx = round ? W / 2 : W / 2;
  const width = round ? W * 0.3 : W * 0.86;
  // dải màu nhấn
  g.fillStyle = p.label.accent;
  g.fillRect(0, H * 0.62, W, H * 0.07);
  logo(g, p, cx, H * 0.17, 42);
  g.fillStyle = p.label.text;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitText(g, p.brand.toUpperCase(), width, 76, 900);
  g.fillText(p.brand.toUpperCase(), cx, H * 0.38);
  fitText(g, p.name, width, 44, 700);
  g.fillText(p.name, cx, H * 0.52);
  g.fillStyle = p.label.bg;
  fitText(g, p.volumeText, width, 36, 800);
  g.fillText(p.volumeText, cx, H * 0.655);
  g.fillStyle = p.label.text;
  if (round) {
    drawBarcode(g, eanFromId(p.id), 18, H * 0.74, 150, 70);
    g.save();
    g.translate(W - 60, H * 0.5);
    g.rotate(-Math.PI / 2);
    g.font = `800 24px ${LABEL_FONT}`;
    g.fillText(p.brand, 0, 0);
    g.restore();
  } else {
    drawBarcode(g, eanFromId(p.id), W - 200, H * 0.76, 170, 60);
    g.font = `700 22px ${LABEL_FONT}`;
    g.textAlign = 'left';
    g.fillText(p.icon, 24, H * 0.82);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(p.id, tex);
  return tex;
}

/** Texture chữ đơn giản (biển, nhãn giá, màn hình LCD...). */
export function textCanvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
