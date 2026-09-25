import * as THREE from 'three';
import { CEILING_HEIGHT, DOOR_WIDTH, DOOR_X } from '../config/constants';
import { textCanvas } from '../products/LabelTexture';

function plant(): THREE.Group {
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

function sign(text: string, color: string, w = 1.6): THREE.Mesh {
  const tex = textCanvas(512, 128, (g) => {
    g.fillStyle = color;
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#ffffff';
    g.font = '900 64px "Nunito", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 256, 68);
  });
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), mat);
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
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.98), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
}

/** Trang trí trong cửa hàng: biển khu vực treo trần, poster khuyến mãi, chậu cây. */
export class Decor {
  readonly group = new THREE.Group();

  build(W: number, D: number): void {
    this.group.clear();
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
    const welcome = sign('Xin chào!', '#1f7a6d', 1.2);
    welcome.position.set(DOOR_X, 2.62, D - 0.02);
    welcome.rotation.y = Math.PI;
    this.group.add(welcome);
  }
}
