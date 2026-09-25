import * as THREE from 'three';

/**
 * Bóng tiếp xúc giả: tấm mặt phẳng tối mờ dưới đồ vật (kệ, tủ, người) — rẻ hơn nhiều so với tăng shadow map,
 * xoá cảm giác đồ vật "trôi" trên sàn.
 */
let rectTex: THREE.CanvasTexture | null = null;
let blobTex: THREE.CanvasTexture | null = null;
const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const mats = new Map<string, THREE.MeshBasicMaterial>();

function canvasTex(draw: (g: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  draw(c.getContext('2d')!, s);
  return new THREE.CanvasTexture(c);
}

function texture(round: boolean): THREE.CanvasTexture {
  if (round) {
    blobTex ??= canvasTex((g, s) => {
      const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      // alphaMap đọc kênh G → vẽ trắng (đậm) trên nền đen (trong suốt)
      r.addColorStop(0, '#fff');
      r.addColorStop(0.5, '#8c8c8c');
      r.addColorStop(1, '#000');
      g.fillStyle = r;
      g.fillRect(0, 0, s, s);
    });
    return blobTex;
  }
  rectTex ??= canvasTex((g, s) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, s, s);
    g.filter = `blur(${s * 0.07}px)`;
    g.fillStyle = '#fff';
    g.fillRect(s * 0.16, s * 0.16, s * 0.68, s * 0.68);
  });
  return rectTex;
}

function material(round: boolean, opacity: number): THREE.MeshBasicMaterial {
  const key = `${round}:${opacity}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color: 0x000000, alphaMap: texture(round), transparent: true, opacity, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    mats.set(key, m);
  }
  return m;
}

/** Bóng chữ nhật mềm cho khối w×d (m); tấm lớn hơn khối một chút để viền mờ lan ra ngoài. */
export function contactShadow(w: number, d: number, opacity = 0.45, round = false): THREE.Mesh {
  const m = new THREE.Mesh(plane, material(round, opacity));
  const pad = round ? 1 : 1 / 0.68;
  m.scale.set(w * pad + (round ? 0 : 0.12), 1, d * pad + (round ? 0 : 0.12));
  m.position.y = 0.004;
  m.renderOrder = -1;
  m.name = 'contactShadow';
  return m;
}
