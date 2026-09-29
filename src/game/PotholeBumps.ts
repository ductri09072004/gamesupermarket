import * as THREE from 'three';
import { BOX_PHYSICS, POTHOLE } from '../config/physics';
import { getProduct } from '../config/products';
import type { VehicleDef } from '../config/vehicles';
import type { VehicleData } from '../core/GameState';
import { brokenItems, bumpStrength, dropChance, holesUnder, wheelPoints, type Hole } from '../systems/PotholeSystem';
import { forward, type DriveState } from '../systems/VehicleDrive';
import type { World } from './World';

/**
 * Lái xe qua ổ gà: xe xóc (rung camera, tiếng dội, mất đà); đi nhanh thì thùng hàng trên xe có thể văng xuống đường
 * (vật lý thật, nhặt lại được) và vỡ vài món.
 */
export class PotholeBumps {
  private holes: Hole[] = [];
  private layoutRef: unknown = null;
  /** Ổ gà bánh xe đang nằm trong (mỗi bánh lọt vào → 1 cú xóc) */
  private inside = new Set<number>();
  /** Ổ gà đã xét rơi thùng trong lượt đi qua này (bánh sau lọt lại không tính thêm) */
  private rolled = new Set<number>();

  constructor(private w: World) {}

  private refresh(): void {
    const L = this.w.city.layout;
    if (L === this.layoutRef) return;
    this.layoutRef = L;
    this.holes = L.damage.filter((d) => d.kind === 'pothole').map((d) => ({ x: d.x, z: d.z, r: d.r }));
    this.inside.clear();
    this.rolled.clear();
  }

  /** Gọi sau mỗi bước lái; trả về độ mạnh cú xóc (0 nếu không xóc) để rung camera. */
  check(s: DriveState, def: VehicleDef, v: VehicleData): number {
    this.refresh();
    const near = this.holes.map((h, i) => ({ h, i })).filter(({ h }) => Math.abs(h.x - s.x) < 6 && Math.abs(h.z - s.z) < 6);
    const under = new Set(holesUnder(wheelPoints(s.x, s.z, s.yaw, def), near.map((n) => n.h)).map((k) => near[k].i));
    let strength = 0;
    for (const i of under) {
      if (this.inside.has(i)) continue;
      const h = this.holes[i];
      const k = bumpStrength(s.speed, h.r);
      strength = Math.max(strength, k);
      s.speed *= 1 - POTHOLE.speedLoss * k;
      this.w.sound('thud', new THREE.Vector3(s.x, 0.2, s.z), 0.7 + Math.random() * 0.15);
      if (!this.rolled.has(i)) {
        this.rolled.add(i);
        if (v.cargo.length && Math.random() < dropChance(s.speed, h.r, def.id) * (this.w.s.weather.flood > 0.04 ? 1.4 : 1)) this.dropBox(s, def, v);
      }
    }
    this.inside = under;
    for (const i of this.rolled) if (Math.hypot(this.holes[i].x - s.x, this.holes[i].z - s.z) > 4) this.rolled.delete(i);
    return strength;
  }

  /** Thùng trên cùng văng ra phía sau xe, rơi xuống đường; vỡ vài món. */
  private dropBox(s: DriveState, def: VehicleDef, v: VehicleData): void {
    const w = this.w;
    const uid = v.cargo.pop()!;
    const box = w.s.state.box(uid);
    if (!box) return;
    const f = forward(s.yaw);
    const back = def.size[2] / 2 + 0.3;
    const side = (Math.random() - 0.5) * def.size[0];
    const x = s.x - f.x * back - f.z * side;
    const z = s.z - f.z * back + f.x * side;
    const broken = brokenItems(s.speed, box.qty, Math.random);
    box.qty -= broken;
    box.location = 'floor';
    box.holderId = null;
    box.pose = undefined;
    box.gx = Math.round(x * 100) / 100;
    box.gy = Math.round(z * 100) / 100;
    w.s.bus.emit('boxes:changed', {});
    w.s.bus.emit('vehicles:changed', {});
    // văng theo quán tính của xe (chậm hơn xe một chút) + nảy sang bên
    const k = (s.speed * 0.6) / BOX_PHYSICS.throwSpeed;
    w.physics.launch(uid, new THREE.Vector3(x, 1.1, z), new THREE.Vector3(f.x * k + (Math.random() - 0.5), 0, f.z * k + (Math.random() - 0.5)));
    w.sound('crash', new THREE.Vector3(x, 0.3, z), 1.3);
    const name = getProduct(box.productId).name;
    w.toast(broken > 0 ? `💥 Ổ gà! Rơi thùng ${name} — vỡ ${broken} món` : `📦 Ổ gà! Rơi thùng ${name} xuống đường`, 'error');
  }
}
