import * as THREE from 'three';
import { prop } from '../engine/Props';
import { CEILING_HEIGHT, DOOR_WIDTH, DOOR_X, STORE_FRONT_Z } from '../config/constants';
import { textCanvas } from '../products/LabelTexture';
import { buildInterior, type InteriorParts } from './InteriorDecor';
import { signMaterial, type SignSpec } from './SignFactory';

function plant(): THREE.Group {
  // chậu cây Quaternius (GLB) — thu về cỡ chậu cạnh cửa
  const glb = prop('houseplant');
  if (glb) {
    glb.scale.setScalar(0.6);
    return glb;
  }
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 16), new THREE.MeshStandardMaterial({ color: 0xc8745a, roughness: 0.7 }));
  pot.position.y = 0.2;
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.7 });
  g.add(pot);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.7, 6), leafMat);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.08, 0.7, Math.sin(a) * 0.08);
    leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}

/** Bảng, poster bạc màu: phủ lớp ố vàng + vài vệt nước chảy */
function ageCanvas(g: CanvasRenderingContext2D, w: number, h: number): void {
  g.fillStyle = 'rgba(120,96,52,0.32)';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9; i++) {
    const x = ((i * 137) % 100) / 100 * w;
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(60,45,20,0.35)');
    grad.addColorStop(1, 'rgba(60,45,20,0)');
    g.fillStyle = grad;
    g.fillRect(x, 0, 2 + (i % 3) * 2, h * (0.4 + (i % 4) * 0.15));
  }
}

const ZONE_SIGNS: Record<string, Partial<SignSpec>> = {
  'Thực phẩm': { style: 'paint', bg: '#f2e0bd', ink: '#9c2a1a', accent: '#6b3a1a', sub: 'Mì · Gạo · Gia vị · Bánh kẹo' },
  'Đồ uống': { style: 'enamel', bg: '#1a5fa8', ink: '#ffffff', accent: '#ffd23f', sub: 'Nước ngọt · Bia · Trà · Cà phê' },
  'Đông lạnh': { style: 'lightbox', bg: '#2b6cb0', ink: '#2b6cb0', accent: '#2b6cb0', sub: 'Kem · Thịt · Há cảo' },
  'Xin chào!': { style: 'paint', bg: '#e9dcc0', ink: '#1f7a6d', accent: '#b3541e', sub: 'Cảm ơn quý khách' },
};

/** Bảng treo dày 5cm, hai mặt cùng chữ, kiểu biển theo khu vực (xem SignFactory). */
function sign(text: string, _color: string, w = 1.6): THREE.Mesh {
  const z = ZONE_SIGNS[text] ?? {};
  const mat = signMaterial({ text, style: 'paint', bg: '#f2e0bd', ink: '#9c2a1a', seed: text.length, w: 1024, h: 288, ...z });
  const edge = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.8 });
  return new THREE.Mesh(new THREE.BoxGeometry(w, (w * 288) / 1024, 0.05), [edge, edge, edge, edge, mat, mat]);
}

function poster(title: string, sub: string, bg: string): THREE.Mesh {
  const tex = textCanvas(256, 360, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, 256, 360);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(128, 130, 80, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = bg;
    g.font = '900 64px "Nunito", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(title, 128, 132);
    g.fillStyle = '#ffffff';
    g.font = '800 30px "Nunito", Arial, sans-serif';
    g.fillText(sub, 128, 260);
    g.font = '600 20px "Nunito", Arial, sans-serif';
    g.fillText('Chỉ có tại Mini Mart', 128, 310);
    ageCanvas(g, 256, 360);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.98), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
}

/** Trang trí trong cửa hàng: biển khu vực treo trần, poster khuyến mãi, chậu cây. */
export class Decor {
  readonly group = new THREE.Group();
  private interior: InteriorParts | null = null;

  /** Bật đồ trang trí Tết (đèn lồng, bánh chưng…) */
  setTet(on: boolean): void {
    if (this.interior) this.interior.tet.visible = on;
  }

  update(dt: number): void {
    this.interior?.update(dt);
  }

  /** W × D = phần cửa hàng đã mở khoá; dựng theo toạ độ cục bộ (tường sau z = 0) rồi dịch nhóm về sát mặt tiền cố định. */
  build(W: number, D: number): void {
    const tetOn = this.interior?.tet.visible ?? false;
    this.group.clear();
    this.group.position.z = STORE_FRONT_Z - D;
    const zones: Array<[string, string, number, number]> = [
      ['Thực phẩm', '#e76f51', W * 0.3, 1.2],
      ['Đồ uống', '#2a9d8f', W * 0.7, 1.2],
      ['Đông lạnh', '#457b9d', W - 1.2, D * 0.45],
    ];
    for (const [text, color, x, z] of zones) {
      const s = sign(text, color);
      s.position.set(x, CEILING_HEIGHT - 0.55, z);
      if (x > W - 2) s.rotation.y = -Math.PI / 2;
      const wireMat = new THREE.MeshBasicMaterial({ color: 0x555555 });
      for (const dx of [-0.6, 0.6]) {
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.35, 4), wireMat);
        wire.position.set(dx, 0.37, 0);
        s.add(wire);
      }
      this.group.add(s);
    }
    const posters: Array<[string, string, string]> = [['-20%', 'Mì gói', '#e63946'], ['1+1', 'Nước ngọt', '#f4a261'], ['MỚI', 'Bánh quy', '#2a9d8f']];
    posters.forEach(([t, sub, bg], i) => {
      const p = poster(t, sub, bg);
      p.position.set(0.012, 1.8, 2.2 + i * 1.3);
      p.rotation.y = Math.PI / 2;
      if (2.2 + i * 1.3 < D - 1) this.group.add(p);
    });
    for (const x of [DOOR_X - DOOR_WIDTH / 2 - 0.4, DOOR_X + DOOR_WIDTH / 2 + 0.4]) {
      const pl = plant();
      pl.position.set(x, 0, D - 0.35);
      this.group.add(pl);
    }
    // camera an ninh ở 2 góc trước, nhìn vào trong cửa hàng
    for (const [x, yaw] of [[0.25, -Math.PI / 4], [W - 0.25, Math.PI / 4]] as const) {
      const cam = prop('security_camera');
      if (!cam) break;
      cam.position.set(x, CEILING_HEIGHT - 0.25, D - 0.25);
      cam.rotation.set(0, yaw, 0);
      this.group.add(cam);
    }
    this.interior = buildInterior(W, D);
    this.interior.tet.visible = tetOn;
    this.group.add(this.interior.group);
    const welcome = sign('Xin chào!', '#1f7a6d', 1.2);
    welcome.position.set(DOOR_X, 2.62, D - 0.02);
    welcome.rotation.y = Math.PI;
    this.group.add(welcome);
  }
}
