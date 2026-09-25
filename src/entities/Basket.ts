import * as THREE from 'three';
import { productMesh } from '../products/PackagingFactory';

const wire = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.5, metalness: 0.2 });

/** Giỏ đi chợ cầm tay; hàng khách lấy hiện bên trong. */
export class Basket {
  readonly group = new THREE.Group();
  private items: THREE.Mesh[] = [];

  constructor() {
    const w = 0.34;
    const d = 0.24;
    const h = 0.16;
    const add = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), wire);
      m.position.set(x, y, z);
      m.castShadow = true;
      this.group.add(m);
    };
    add(0, 0, 0, w, 0.01, d);
    add(0, h / 2, -d / 2, w, h, 0.01);
    add(0, h / 2, d / 2, w, h, 0.01);
    add(-w / 2, h / 2, 0, 0.01, h, d);
    add(w / 2, h / 2, 0, 0.01, h, d);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 6, 16, Math.PI), wire);
    handle.position.y = h;
    this.group.add(handle);
    this.group.position.set(0, -0.2, 0);
    this.group.rotation.y = Math.PI / 2;
  }

  add(productId: string): THREE.Mesh {
    const m = productMesh(productId);
    const n = this.items.length;
    m.scale.setScalar(0.55);
    m.position.set(-0.11 + (n % 4) * 0.075, 0.012 + Math.floor(n / 8) * 0.06, -0.06 + (Math.floor(n / 4) % 2) * 0.1);
    m.rotation.y = (n * 1.7) % 1;
    this.group.add(m);
    this.items.push(m);
    return m;
  }

  /** Lấy món ra (đặt lên băng chuyền) — trả về vị trí world trước khi gỡ. */
  takeOut(): { mesh: THREE.Mesh; world: THREE.Vector3 } | null {
    const m = this.items.shift();
    if (!m) return null;
    const world = m.getWorldPosition(new THREE.Vector3());
    m.removeFromParent();
    m.scale.setScalar(1);
    return { mesh: m, world };
  }

  get count(): number {
    return this.items.length;
  }
}
