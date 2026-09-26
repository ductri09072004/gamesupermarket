import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROAD_WIDTH, WALK_WIDTH } from '../config/city';
import type { AABB } from './Colliders';
import { buildCityInstances } from './CityInstances';
import { cityLayout, V_ROADS, type CityLayout, type Rect } from './CityLayout';
import { buildDepot } from './Depot';
import { applyPbr, pbrSet } from './Materials';
import { buildShopSigns } from './ShopSigns';
import { asphaltTexture, concreteTexture, grassTexture } from './Textures';

/** Mặt phẳng nằm ngang phủ rect, UV theo toạ độ thế giới / tile (m) → vật liệu dùng chung, không cần repeat riêng. */
function worldPlane(r: Rect, y: number, tile: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0).rotateX(-Math.PI / 2);
  g.translate((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / tile, -pos.getZ(i) / tile);
  return g;
}

function surface(slot: string, fallback: THREE.Texture, rough: number): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ map: fallback, roughness: rough });
  const set = pbrSet(slot);
  if (set) {
    m.roughness = 1;
    m.normalScale.set(0.7, 0.7);
    applyPbr(m, set, ['map', 'normalMap', 'roughnessMap']);
  }
  return m;
}

function mergedMesh(rects: Rect[], y: number, tile: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(mergeGeometries(rects.map((r) => worldPlane(r, y, tile)))!, mat);
  m.receiveShadow = true;
  return m;
}

/** Thành phố quanh cửa hàng: đường, vỉa hè, cỏ, bãi đỗ, kho sỉ và model nhà/cây/đèn. */
export class City {
  readonly group = new THREE.Group();
  layout!: CityLayout;
  private lampMats: THREE.MeshStandardMaterial[] = [];
  private signMats: THREE.MeshStandardMaterial[] = [];
  private lights: THREE.PointLight[] = [];
  private kiosk: THREE.Object3D | null = null;
  /** Gọi sau mỗi lần dựng lại (xe & người đi bộ cần tuyến mới) */
  onBuilt: (L: CityLayout) => void = () => {};

  build(D: number, storeW: number): void {
    this.group.clear();
    this.lights = [];
    const L = cityLayout(D, storeW);
    this.layout = L;
    const b = L.bounds;
    const outer: Rect = { x0: b.x0 - 80, x1: b.x1 + 80, z0: b.z0 - 80, z1: b.z1 + 80 };
    const pave = surface('pavement', concreteTexture('#cdc9c1'), 0.85);
    const grass = surface('grass', grassTexture(), 1);
    if (pbrSet('grass')) grass.color.set(0xb8d890); // ảnh cỏ gốc ngả vàng dưới nắng trưa
    const road = surface('asphalt', asphaltTexture(), 0.9);
    this.group.add(mergedMesh([outer], -0.04, 1.6, pave));
    const inner = L.blocks.map((k) => ({ x0: k.x0 + WALK_WIDTH, x1: k.x1 - WALK_WIDTH, z0: k.z0 + WALK_WIDTH, z1: k.z1 - WALK_WIDTH }));
    const ring = [{ x0: outer.x0, x1: b.x0 + 4, z0: outer.z0, z1: outer.z1 }, { x0: b.x1 - 4, x1: outer.x1, z0: outer.z0, z1: outer.z1 },
      { x0: b.x0 + 4, x1: b.x1 - 4, z0: outer.z0, z1: b.z0 + 4 }, { x0: b.x0 + 4, x1: b.x1 - 4, z0: b.z1 - 4, z1: outer.z1 }];
    this.group.add(mergedMesh([...inner, ...ring], -0.035, 2, grass));
    const yard: Rect = { x0: L.depot.shed.x0, x1: L.depot.shed.x1, z0: L.depot.shed.z1, z1: L.roads[1].z0 };
    this.group.add(mergedMesh([...L.roads, L.lot, { x0: L.lot.x0 + 4, x1: L.lot.x1 - 4, z0: L.lot.z1, z1: L.lot.z1 + WALK_WIDTH }, yard], -0.03, 3, road));
    this.addMarkings(L);
    this.addCurbs(L);
    this.lampMats = buildCityInstances(L.placements, this.group);
    this.signMats = buildShopSigns(L.placements, this.group);
    this.kiosk = buildDepot(L, this.group);
    // đèn đường thật (PointLight) chỉ cho vài cột gần cửa hàng — còn lại chỉ phát sáng (emissive)
    const cx = storeW / 2;
    const near = L.placements.filter((p) => p.model === 'Streetlight_Single')
      .sort((a, c) => Math.hypot(a.x - cx, a.z - D) - Math.hypot(c.x - cx, c.z - D)).slice(0, 5);
    for (const p of near) {
      const l = new THREE.PointLight(0xffd9a0, 0, 16, 1.6);
      l.position.set(p.x, 4.5, p.z);
      this.lights.push(l);
      this.group.add(l);
    }
    this.onBuilt(L);
  }

  private addMarkings(L: CityLayout): void {
    const dash = new THREE.MeshStandardMaterial({ color: 0xf1e3a0, roughness: 0.6 });
    const pts: Array<[number, number, boolean]> = [];
    for (const c of L.centerLines) {
      for (let t = c.from + 1.5; t < c.to - 1.5; t += 3.2) {
        const [x, z] = c.axis === 'x' ? [t, c.c] : [c.c, t];
        if (c.axis === 'x' && V_ROADS.some((v) => Math.abs(x - v) < ROAD_WIDTH / 2 + 1)) continue;
        pts.push([x, z, c.axis === 'x']);
      }
    }
    const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.6, 0.14).rotateX(-Math.PI / 2), dash, pts.length);
    const m = new THREE.Matrix4();
    pts.forEach(([x, z, alongX], i) => inst.setMatrixAt(i, m.makeRotationY(alongX ? 0 : Math.PI / 2).setPosition(x, -0.02, z)));
    this.group.add(inst);
    // vạch đỗ xe trong bãi + vạch qua đường trước cửa hàng
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7 });
    const lines: THREE.Matrix4[] = [];
    for (let i = 0; i <= 6; i++) lines.push(new THREE.Matrix4().makeScale(0.12, 1, 5.4).setPosition(L.lot.x0 + 0.3 + i * 3.4, -0.02, L.lot.z0 + 7));
    const road = L.roads[1];
    for (let i = 0; i < 9; i++) lines.push(new THREE.Matrix4().makeScale(3.4, 1, 0.45).setPosition(-5, -0.02, road.z0 + 0.6 + i * 0.85));
    const li = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), white, lines.length);
    lines.forEach((mm, i) => li.setMatrixAt(i, mm));
    this.group.add(li);
  }

  /** Bó vỉa quanh mỗi khối nhà (chỉ trang trí — xe/người không bị cản). */
  private addCurbs(L: CityLayout): void {
    const mat = new THREE.MeshStandardMaterial({ color: 0xb9b4aa, roughness: 0.8 });
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, L.blocks.length * 4);
    const m = new THREE.Matrix4();
    let i = 0;
    for (const k of L.blocks) {
      const w = k.x1 - k.x0;
      const d = k.z1 - k.z0;
      for (const [x, z, sx, sz] of [[(k.x0 + k.x1) / 2, k.z0, w, 0.2], [(k.x0 + k.x1) / 2, k.z1, w, 0.2], [k.x0, (k.z0 + k.z1) / 2, 0.2, d], [k.x1, (k.z0 + k.z1) / 2, 0.2, d]]) {
        inst.setMatrixAt(i++, m.makeScale(sx, 0.1, sz).setPosition(x, 0.01, z));
      }
    }
    inst.receiveShadow = true;
    this.group.add(inst);
  }

  /** Quầy mua sỉ (để Interaction bắt raycast). */
  get kioskObject(): THREE.Object3D | null {
    return this.kiosk;
  }

  colliders(): AABB[] {
    return this.layout.colliders;
  }

  /** Điểm đặt thùng mua sỉ trên bãi lấy hàng (lưới 0.75m). */
  padSpots(): Array<{ gx: number; gy: number }> {
    const p = this.layout.depot.pad;
    const out: Array<{ gx: number; gy: number }> = [];
    for (let z = p.z0 + 0.6; z < p.z1 - 0.3; z += 0.75) for (let x = p.x0 + 0.6; x < p.x1 - 0.3; x += 0.75) out.push({ gx: x, gy: z });
    return out;
  }

  setNight(night: number): void {
    for (const m of this.lampMats) m.emissiveIntensity = 0.3 + night * 3;
    for (const m of this.signMats) m.emissiveIntensity = 0.1 + night * 1.2;
    for (const l of this.lights) l.intensity = night * 14;
  }
}
