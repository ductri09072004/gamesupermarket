import * as THREE from 'three';
import { textCanvas } from '../products/LabelTexture';
import type { CityLayout } from './CityLayout';

const H = 7;

/** Biển chữ đơn giản (canvas) — dùng cho kho sỉ. */
function signTexture(text: string, sub: string, bg: string): THREE.Texture {
  return textCanvas(1024, 200, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, 1024, 200);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '900 104px "Nunito", Arial, sans-serif';
    g.fillText(text, 512, 88);
    g.font = '700 34px "Nunito", Arial, sans-serif';
    g.fillStyle = '#ffd166';
    g.fillText(sub, 512, 168);
  });
}


function corrugated(): THREE.Texture {
  const t = textCanvas(256, 64, (g) => {
    g.fillStyle = '#9fa8b3';
    g.fillRect(0, 0, 256, 64);
    for (let x = 0; x < 256; x += 16) {
      const gr = g.createLinearGradient(x, 0, x + 16, 0);
      gr.addColorStop(0, '#7d8792');
      gr.addColorStop(0.5, '#c7ced6');
      gr.addColorStop(1, '#7d8792');
      g.fillStyle = gr;
      g.fillRect(x, 0, 16, 64);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function shutter(): THREE.Texture {
  return textCanvas(128, 128, (g) => {
    g.fillStyle = '#b8bec6';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#8d949c';
    for (let y = 0; y < 128; y += 8) g.fillRect(0, y, 128, 2);
    g.fillStyle = '#f2c14e';
    g.fillRect(0, 118, 128, 10);
  });
}

function hatch(): THREE.Texture {
  const t = textCanvas(256, 256, (g) => {
    g.fillStyle = '#4b4f55';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#f2c14e';
    g.lineWidth = 14;
    g.strokeRect(8, 8, 240, 240);
    g.lineWidth = 10;
    for (let i = -256; i < 256; i += 48) {
      g.beginPath();
      g.moveTo(i, 256);
      g.lineTo(i + 256, 0);
      g.stroke();
    }
  });
  return t;
}

/**
 * Kho sỉ: nhà xưởng tôn, cửa cuốn, biển "KHO SỈ", bãi lấy hàng sơn vạch vàng và quầy tự phục vụ (kiosk).
 * Trả về vật để raycast khi người chơi bấm E ở quầy.
 */
export function buildDepot(L: CityLayout, group: THREE.Group): THREE.Object3D {
  const { shed, pad, kiosk } = L.depot;
  const w = shed.x1 - shed.x0;
  const d = shed.z1 - shed.z0;
  const tex = corrugated();
  tex.repeat.set(w / 4, 1);
  const wallMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallMat);
  body.position.set((shed.x0 + shed.x1) / 2, H / 2, (shed.z0 + shed.z1) / 2);
  body.castShadow = true;
  body.receiveShadow = true;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.35, d + 0.6), new THREE.MeshStandardMaterial({ color: 0x4a5561, roughness: 0.6, metalness: 0.3 }));
  roof.position.set(body.position.x, H + 0.17, body.position.z);
  group.add(body, roof);
  const shMat = new THREE.MeshStandardMaterial({ map: shutter(), roughness: 0.5, metalness: 0.3 });
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.6), shMat);
    s.position.set(shed.x0 + 4 + i * 6.5, 2.3, shed.z1 + 0.02);
    group.add(s);
  }
  const signMat = new THREE.MeshStandardMaterial({ map: signTexture('KHO SỈ', 'Giá sỉ · Lấy hàng ngay · Tự chở về', '#c0392b'), roughness: 0.5 });
  signMat.emissive.set(0xffffff);
  signMat.emissiveMap = signMat.map;
  signMat.emissiveIntensity = 0.25;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.95), signMat);
  sign.position.set(body.position.x + 3, H - 1.4, shed.z1 + 0.05);
  group.add(sign);
  const padMesh = new THREE.Mesh(new THREE.PlaneGeometry(pad.x1 - pad.x0, pad.z1 - pad.z0).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: hatch(), roughness: 0.8 }));
  padMesh.position.set((pad.x0 + pad.x1) / 2, -0.015, (pad.z0 + pad.z1) / 2);
  padMesh.receiveShadow = true;
  group.add(padMesh);
  // quầy tự phục vụ: bệ + màn hình + mái che
  const booth = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.5 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.05, 0.6), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 }));
  base.position.y = 0.525;
  const screenTex = textCanvas(256, 160, (g) => {
    g.fillStyle = '#0b3d2e';
    g.fillRect(0, 0, 256, 160);
    g.fillStyle = '#7CFFB2';
    g.font = '800 30px monospace';
    g.fillText('KHO SỈ', 70, 60);
    g.font = '700 20px monospace';
    g.fillText('Bấm E để mua', 50, 110);
  });
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.06), [dark, dark, dark, dark,
    new THREE.MeshBasicMaterial({ map: screenTex }), dark]);
  screen.position.set(0, 1.35, 0);
  screen.rotation.x = -0.25;
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.4, 0.08), dark);
  post.position.set(0, 1.2, -0.25);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.1), new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.6 }));
  awning.position.set(0, 2.45, 0.1);
  booth.add(base, screen, post, awning);
  booth.position.set(kiosk.x, 0, kiosk.z);
  booth.rotation.y = kiosk.yaw;
  booth.traverse((o) => { o.castShadow = true; });
  booth.userData = { kind: 'kiosk' };
  group.add(booth);
  return booth;
}
