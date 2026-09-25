import * as THREE from 'three';

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = true): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function speckle(g: CanvasRenderingContext2D, w: number, h: number, n: number, alpha: number, dark = true): void {
  for (let i = 0; i < n; i++) {
    g.fillStyle = dark ? `rgba(0,0,0,${Math.random() * alpha})` : `rgba(255,255,255,${Math.random() * alpha})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

/** Gạch sàn 60×60cm hai tông, ron xám nhạt. Một ô texture = 1.2m. */
export function floorTexture(): THREE.CanvasTexture {
  return canvasTex(512, 512, (g) => {
    const s = 256;
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      g.fillStyle = (x + y) % 2 === 0 ? '#e9e2d6' : '#d4cbbd';
      g.fillRect(x * s, y * s, s, s);
    }
    speckle(g, 512, 512, 2500, 0.05);
    g.strokeStyle = '#c9c1b3';
    g.lineWidth = 3;
    for (let i = 0; i <= 2; i++) {
      g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, 512); g.stroke();
      g.beginPath(); g.moveTo(0, i * s); g.lineTo(512, i * s); g.stroke();
    }
  });
}

/** Tường sơn kem, ốp chân màu xanh ngọc, len chân tường sẫm. Chiều dọc = cả chiều cao tường. */
export function wallTexture(): THREE.CanvasTexture {
  return canvasTex(256, 512, (g) => {
    g.fillStyle = '#f6efe0';
    g.fillRect(0, 0, 256, 512);
    speckle(g, 256, 512, 800, 0.03);
    const band = 512 * (1 - 1.05 / 3.2);
    g.fillStyle = '#7fb6a4';
    g.fillRect(0, band, 256, 512 - band);
    g.fillStyle = '#5f9785';
    g.fillRect(0, band, 256, 8);
    g.fillStyle = '#4b5563';
    g.fillRect(0, 512 - 20, 256, 20);
    g.strokeStyle = 'rgba(0,0,0,0.06)';
    for (let x = 0; x < 256; x += 32) {
      g.beginPath(); g.moveTo(x, band + 8); g.lineTo(x, 492); g.stroke();
    }
  });
}

export function ceilingTexture(): THREE.CanvasTexture {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#f7f7f5';
    g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, 1500, 0.06);
    g.strokeStyle = '#cfd4da';
    g.lineWidth = 4;
    g.strokeRect(0, 0, 256, 256);
  });
}

export function concreteTexture(tone = '#c9c6c0', lines = true): THREE.CanvasTexture {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = tone;
    g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, 4000, 0.08);
    speckle(g, 256, 256, 1500, 0.06, false);
    if (lines) {
      g.strokeStyle = 'rgba(0,0,0,0.18)';
      g.lineWidth = 2;
      g.strokeRect(1, 1, 254, 254);
    }
  });
}

export function asphaltTexture(): THREE.CanvasTexture {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#3d3f45';
    g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, 6000, 0.12, false);
  });
}

export function grassTexture(): THREE.CanvasTexture {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#6f9e4f';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(40,80,20,0.25)' : 'rgba(160,200,100,0.2)';
      g.fillRect(Math.random() * 256, Math.random() * 256, 1, 3);
    }
  });
}

/** Mặt tiền nhà bên kia đường: gạch + cửa sổ (cửa sổ phát sáng ban đêm qua emissiveMap). */
export function facadeTexture(seed: number): { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } {
  const colors = ['#d8b4a0', '#b8c5d6', '#e8d9b5', '#c7d3bf', '#d4c4e0'];
  const lit: boolean[] = [];
  const map = canvasTex(256, 512, (g) => {
    g.fillStyle = colors[seed % colors.length];
    g.fillRect(0, 0, 256, 512);
    speckle(g, 256, 512, 1500, 0.06);
    for (let y = 30; y < 480; y += 90) for (let x = 24; x < 230; x += 76) {
      g.fillStyle = '#4a5a6a';
      g.fillRect(x, y, 50, 60);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x + 4, y + 4, 18, 52);
      lit.push(Math.random() < 0.45);
    }
  });
  let k = 0;
  const emissive = canvasTex(256, 512, (g) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, 256, 512);
    for (let y = 30; y < 480; y += 90) for (let x = 24; x < 230; x += 76) {
      if (lit[k++]) {
        g.fillStyle = '#ffd89a';
        g.fillRect(x, y, 50, 60);
      }
    }
  });
  return { map, emissive };
}
