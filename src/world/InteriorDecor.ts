import * as THREE from 'three';
import { CEILING_HEIGHT, DOOR_X, WAREHOUSE } from '../config/constants';
import { prop } from '../engine/Props';

const H = CEILING_HEIGHT;
const LEFT = -Math.PI / 2; // mặt trước model (-Z) quay ra +X: treo tường trái
const RIGHT = Math.PI / 2; // treo tường phải

/** Đặt 1 model prop (front -Z, gốc giữa đáy) vào nhóm; thiếu model thì bỏ qua. */
function put(g: THREE.Object3D, name: string, x: number, y: number, z: number, rotY = 0, scale = 1): THREE.Group | null {
  const m = prop(`in_${name}`);
  if (!m) return null;
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  if (scale !== 1) m.scale.setScalar(scale);
  g.add(m);
  return m;
}

export interface InteriorParts {
  group: THREE.Group;
  /** Đồ trang trí Tết (đèn lồng đỏ, bánh chưng, bánh trung thu…) — chỉ hiện dịp Tết */
  tet: THREE.Group;
  /** Quạt trần quay */
  update(dt: number): void;
}

/**
 * Đồ nội thất "chất tạp hóa Việt": quạt trần, điều hòa treo tường, đồng hồ, cờ đỏ sao vàng, tủ điện + bình chữa cháy,
 * đèn EXIT, bảng phấn, ghế gỗ cũ, cây trên ghế đẩu, dép & mũ bảo hiểm ở cửa. W, D = kích thước cửa hàng hiện tại.
 */
export function buildInterior(W: number, D: number): InteriorParts {
  const group = new THREE.Group();
  const tet = new THREE.Group();
  const fans: THREE.Group[] = [];
  // quạt trần: 2–3 chiếc dọc giữa cửa hàng (model cao 0.42, treo sát trần)
  const rows = W > 16 ? 3 : 2;
  for (let i = 0; i < rows; i++) {
    const f = put(group, 'ceiling_fan', W * ((i + 1) / (rows + 1)), H - 0.42, D * 0.5);
    if (f) fans.push(f);
  }
  put(group, 'wall_clock', 0.02, 2.55, D * 0.5, LEFT);
  put(group, 'wall_ac', 0.11, 2.5, D * 0.28, LEFT);
  put(group, 'wall_ac', W - 0.11, 2.5, D * 0.72, RIGHT);
  put(group, 'flag_flat', W - 0.02, 1.95, D * 0.42, RIGHT);
  // cửa: đèn EXIT trên khung cửa, bảng phấn menu, dép tổ ong ngoài thảm
  put(group, 'exit_sign', DOOR_X + 1.35, 2.68, D - 0.05, 0);
  put(group, 'chalkboard', DOOR_X - 1.5, 0, D - 0.75, 0.18);
  put(group, 'flip_flops', DOOR_X - 0.4, 0.001, D - 0.95, 0.4);
  // góc điện: tủ điện + bình chữa cháy cạnh cửa phải
  put(group, 'meter_box', W - 0.03, 1.45, D - 1.4, RIGHT);
  put(group, 'extinguisher', W - 0.2, 0, D - 0.7, 0);
  // góc ngồi: ghế gỗ cũ (mũ bảo hiểm để trên ghế) + cây trên ghế đẩu
  put(group, 'wood_chair', W - 0.5, 0, D - 2.3, -2.6);
  put(group, 'helmet', W - 0.5, 0.47, D - 2.3, -0.4);
  put(group, 'stool_plant', 0.5, 0, D - 0.6, 0);
  // Tết: đèn lồng đỏ treo trần trước cửa, bánh chưng + bánh trung thu trên thùng gỗ cạnh cửa
  for (const dx of [-1.6, 0, 1.6]) {
    const l = put(tet, 'lantern_red', DOOR_X + dx, H - 0.5 - 0.35, D - 0.9);
    if (l) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.35, 4), new THREE.MeshBasicMaterial({ color: 0x444444 }));
      rope.position.set(DOOR_X + dx, H - 0.35 / 2, D - 0.9);
      tet.add(rope);
    }
  }
  // bàn gỗ trải khăn đỏ
  const tx = DOOR_X + 1.9;
  const table = new THREE.Mesh(new THREE.BoxGeometry(1, 0.72, 0.55), new THREE.MeshStandardMaterial({ color: 0x5b3a24, roughness: 0.8 }));
  table.position.set(tx, 0.36, D - 0.7);
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.02, 0.6), new THREE.MeshStandardMaterial({ color: 0xb3131b, roughness: 0.85 }));
  cloth.position.set(tx, 0.73, D - 0.7);
  tet.add(table, cloth);
  put(tet, 'banh_chung', tx - 0.3, 0.74, D - 0.7, 0.3);
  put(tet, 'banh_chung', tx - 0.05, 0.74, D - 0.68, -0.2);
  put(tet, 'banh_chung', tx - 0.18, 0.96, D - 0.69, 0.1);
  put(tet, 'mooncake', tx + 0.3, 0.74, D - 0.7, 0.1, 0.8);
  group.add(tet);
  return {
    group,
    tet,
    update(dt) {
      for (const f of fans) f.rotation.y += dt * 4;
    },
  };
}

/** Đồ trên mặt quầy thu ngân (toạ độ cục bộ: khách -Z, thu ngân +Z): mèo thần tài, lọ kẹo, xấp vé số. */
export function counterProps(w: number, d: number, h: number): THREE.Group {
  const g = new THREE.Group();
  put(g, 'lucky_cat', -w / 2 + 0.25, h, d / 2 - 0.2, 0);
  put(g, 'candy_jar', -w / 2 + 0.6, h, d / 2 - 0.2, 0);
  put(g, 'lottery', -w / 2 + 0.95, h, d / 2 - 0.22, 0.3);
  return g;
}

/** Kho sau: két bia nhựa xếp chồng, thùng gỗ, thùng xốp, chậu, xô, cuộn dây điện; góc nghỉ có phích + ấm + nồi cơm. */
export function warehouseProps(): THREE.Group {
  const g = new THREE.Group();
  const { x0, z0, w, d } = WAREHOUSE;
  const x1 = x0 + w - 0.4;
  for (let i = 0; i < 4; i++) {
    put(g, 'beer_crate', x1 - 0.45, i * 0.23, z0 + 0.4, 0.05 * i);
    put(g, 'beer_crate', x1 - 0.45, i * 0.23, z0 + 0.75, -0.04 * i);
  }
  put(g, 'wood_boxes', x1 - 1.4, 0, z0 + 0.5, 0.2);
  put(g, 'foam_box', x0 + 0.5, 0, z0 + 0.45, 0.1);
  put(g, 'wash_basin', x0 + 1.2, 0, z0 + 0.5, 0);
  put(g, 'bucket', x0 + 1.6, 0, z0 + 0.45, 0);
  put(g, 'bamboo_basket', x0 + 0.55, 0, z0 + 1.2, 0.3);
  put(g, 'cables', x0 + 2.4, 0, z0 + d - 0.9, 0.8, 0.6);
  // góc nghỉ nhân viên trên thùng gỗ
  put(g, 'wood_boxes', x0 + w / 2, 0, z0 + d - 0.55, 0);
  put(g, 'thermos', x0 + w / 2 - 0.15, 0.33, z0 + d - 0.55, 0.4);
  put(g, 'kettle', x0 + w / 2 + 0.05, 0.33, z0 + d - 0.55, -0.5);
  put(g, 'rice_cooker', x0 + w / 2 + 0.3, 0.33, z0 + d - 0.55, 0.2);
  put(g, 'dalat_milk', x0 + w / 2 + 0.5, 0.33, z0 + d - 0.55, 0.5);
  return g;
}
