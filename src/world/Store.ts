import * as THREE from 'three';
import { CEILING_HEIGHT, DOOR_WIDTH, DOOR_X, PBR_TILE_M, STORE_FRONT_Z, WALL_THICKNESS, WAREHOUSE } from '../config/constants';
import type { AABB } from './Colliders';
import { applyPbr, pbrSet, setRepeat } from './Materials';
import { ceilingTexture, concreteTexture, floorTexture } from './Textures';
import { Shell } from './Shell';
import { StoreWalls } from './StoreWalls';
import { warehouseProps } from './InteriorDecor';

const H = CEILING_HEIGHT;
const T = WALL_THICKNESS;
/** Bề dày tường chung cửa hàng – kho (m) */
const PARTY = 0.5;
const GLASS_H = 2.45;
const DOOR_H = 2.3;
/** Cửa thông giữa cửa hàng và kho trên tường chung (z tuyệt đối) */
const WH_GAP = { z0: WAREHOUSE.doorZ - 0.5, z1: WAREHOUSE.doorZ + 0.5, h: 2.2 };

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitPlane = new THREE.PlaneGeometry(1, 1);

/** Hộp đơn vị đặt theo mép (min/max). */
function place(m: THREE.Object3D, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): void {
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.scale.set(Math.max(1e-3, x1 - x0), Math.max(1e-3, y1 - y0), Math.max(1e-3, z1 - z0));
}

/**
 * Cửa hàng: sàn bóng, tường, trần, dải đèn, mặt kính trước, cửa trượt; kho kế bên; vỏ nhà cố định chứa phần chưa mở khoá.
 * Phần cửa hàng dựng theo toạ độ cục bộ (tường sau z = 0, mặt tiền z = D) trong nhóm `active`, dịch theo z = STORE_FRONT_Z − D
 * để mặt tiền luôn nằm đúng chỗ khi mở rộng (vách sau lùi ra, phố đứng yên).
 */
export class Store {
  readonly group = new THREE.Group();
  /** Phần cửa hàng đã mở khoá (toạ độ cục bộ, gốc z ở tường sau) */
  private active = new THREE.Group();
  private shell = new Shell();
  private shellKey = '';
  W = 8;
  D = 6;
  warehouse = false;
  private floor: THREE.Mesh;
  private ceiling: THREE.Mesh;
  private walls: Record<string, THREE.Mesh> = {};
  private wallSet = new StoreWalls();
  private ceilMaps: THREE.Texture[] = [];
  private floorTex = floorTexture();
  /** Texture sàn cần đổi repeat khi mở rộng (canvas hoặc bộ PBR) */
  private floorMaps: THREE.Texture[] = [];
  private floorTile = 1.2;
  private mullions: THREE.InstancedMesh;
  private doorL: THREE.Group;
  private doorR: THREE.Group;
  private doorOpen = 0;
  private whGroup = new THREE.Group();
  readonly lightStripMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e6, emissiveIntensity: 3 });
  onDoorOpen: () => void = () => {};

  constructor() {
    const floorMat = new THREE.MeshStandardMaterial({ map: this.floorTex, roughness: 0.28, metalness: 0.0 });
    this.floorMaps = [this.floorTex];
    const fs = pbrSet('floor_tile') ?? pbrSet('floor');
    if (fs) {
      // đá bóng: roughnessMap nhân với roughness → vệt phản chiếu đèn trần mờ nhưng vẫn có vân
      floorMat.roughness = pbrSet('floor_tile') ? 0.9 : 0.55;
      floorMat.normalScale.set(0.6, 0.6);
      this.floorMaps = applyPbr(floorMat, fs, ['map', 'normalMap', 'roughnessMap', 'aoMap']);
      if (!fs.map) this.floorMaps.push(this.floorTex);
      this.floorTile = pbrSet('floor_tile') ? PBR_TILE_M.floorTile : PBR_TILE_M.floor;
    }
    this.floor = new THREE.Mesh(unitPlane, floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    const ceilMat = new THREE.MeshStandardMaterial({ map: ceilingTexture(), roughness: 0.95 });
    const cs = pbrSet('ceiling');
    if (cs) {
      ceilMat.roughness = 1;
      this.ceilMaps = applyPbr(ceilMat, cs, ['map', 'normalMap', 'roughnessMap', 'aoMap']);
    }
    this.ceiling = new THREE.Mesh(unitPlane, ceilMat);
    this.ceiling.rotation.x = Math.PI / 2;
    this.ceiling.castShadow = true;
    this.active.add(this.floor, this.ceiling);
    for (const name of ['back', 'leftA', 'leftB', 'leftLintel', 'leftFill', 'right']) this.wallSet.add(name);
    this.wallSet.add('header', 'shutter');
    this.active.add(this.wallSet.group);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xaeb4bb, metalness: 0.75, roughness: 0.35 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xcfe8f5, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false });
    for (const name of ['glassL', 'glassR']) {
      const m = new THREE.Mesh(unitBox, glassMat);
      this.walls[name] = m;
      this.active.add(m);
    }
    for (const name of ['kickL', 'kickR', 'railL', 'railR']) {
      const m = new THREE.Mesh(unitBox, frameMat);
      m.castShadow = true;
      this.walls[name] = m;
      this.active.add(m);
    }
    this.mullions = new THREE.InstancedMesh(unitBox, frameMat, 64);
    this.active.add(this.mullions);
    const makeDoor = () => {
      const g = new THREE.Group();
      const inner = new THREE.Mesh(new THREE.BoxGeometry(0.92, DOOR_H - 0.1, 0.06), glassMat);
      inner.position.y = DOOR_H / 2;
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.08), frameMat);
      handle.position.set(0.4, 1.05, 0);
      // khung dạng viền: 4 thanh
      const bars = [
        [-0.5, -0.46, 0, DOOR_H], [0.46, 0.5, 0, DOOR_H], [-0.5, 0.5, 0, 0.06], [-0.5, 0.5, DOOR_H - 0.06, DOOR_H],
      ].map(([a, b, c, d]) => {
        const bar = new THREE.Mesh(unitBox, frameMat);
        place(bar, a, b, c, d, -0.03, 0.03);
        return bar;
      });
      g.add(inner, handle, ...bars);
      return g;
    };
    this.doorL = makeDoor();
    this.doorR = makeDoor();
    this.doorR.scale.x = -1;
    this.active.add(this.doorL, this.doorR);
    this.buildWarehouse();
    this.group.add(this.active, this.whGroup, this.shell.group);
  }

  private buildWarehouse(): void {
    const { x0, z0, w, d } = WAREHOUSE;
    const concrete = concreteTexture('#b8b5ae', false);
    concrete.repeat.set(w / 2, d / 2);
    const floorMat = new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.7 });
    const cs = pbrSet('concrete');
    if (cs) {
      floorMat.roughness = 1;
      setRepeat(applyPbr(floorMat, cs, ['map', 'normalMap', 'roughnessMap', 'aoMap'], true), w / PBR_TILE_M.concrete, d / PBR_TILE_M.concrete);
    }
    const floor = new THREE.Mesh(unitPlane, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.scale.set(w, d, 1);
    floor.position.set(x0 + w / 2, 0.001, z0 + d / 2);
    floor.receiveShadow = true;
    const ceil = new THREE.Mesh(unitPlane, new THREE.MeshStandardMaterial({ color: 0xd9dcdf, roughness: 0.95 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.scale.set(w, d, 1);
    ceil.position.set(x0 + w / 2, H, z0 + d / 2);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.18), this.lightStripMat);
    lamp.position.set(x0 + w / 2, H - 0.03, z0 + d / 2);
    // ngưỡng cửa thông trên tường chung (x ∈ [−0.5, 0])
    const sill = new THREE.Mesh(unitPlane, floorMat);
    sill.rotation.x = -Math.PI / 2;
    sill.scale.set(PARTY, WH_GAP.z1 - WH_GAP.z0, 1);
    sill.position.set(-PARTY / 2, 0.001, (WH_GAP.z0 + WH_GAP.z1) / 2);
    this.whGroup.add(floor, ceil, lamp, sill, warehouseProps());
  }

  /** Đèn cố định của kho theo công tắc (đèn cửa hàng là nội thất mua/dời được). */
  setLightsOn(on: boolean): void {
    this.lightStripMat.emissiveIntensity = on ? 3 : 0;
  }

  get doorCenter(): THREE.Vector3 {
    return new THREE.Vector3(DOOR_X, 0, STORE_FRONT_Z);
  }

  /** Dựng lại kích thước (gọi mỗi frame khi đang có animation mở rộng). */
  private grow: { fromW: number; fromD: number; t: number } | null = null;

  /** Bắt đầu hiệu ứng tường nới ra khi mở rộng cửa hàng. */
  beginGrow(): void {
    this.grow = { fromW: this.W, fromD: this.D, t: 0 };
  }

  /** Chạy hiệu ứng mở rộng / bật tắt kho. Trả true khi hình dạng vừa chốt (cần tính lại va chạm). */
  animateTo(W: number, D: number, warehouse: boolean, dt: number): boolean {
    const a = this.grow;
    if (a) {
      a.t = Math.min(1, a.t + dt / 1.2);
      const k = 1 - Math.pow(1 - a.t, 3);
      this.setSize(a.fromW + (W - a.fromW) * k, a.fromD + (D - a.fromD) * k, warehouse);
      if (a.t < 1) return false;
      this.grow = null;
      return true;
    }
    if (this.warehouse === warehouse) return false;
    this.setSize(W, D, warehouse);
    return true;
  }

  setSize(W: number, D: number, warehouse: boolean): void {
    this.W = W;
    this.D = D;
    this.warehouse = warehouse;
    // hình chữ nhật đã mở khoá luôn sát mặt tiền cố định; khi đang nới ra (D lẻ) vách sau lùi dần
    this.active.position.z = STORE_FRONT_Z - D;
    this.floor.scale.set(W, D, 1);
    this.floor.position.set(W / 2, 0, D / 2);
    setRepeat(this.floorMaps, W / this.floorTile, D / this.floorTile);
    this.ceiling.scale.set(W, D, 1);
    this.ceiling.position.set(W / 2, H, D / 2);
    setRepeat(this.ceilMaps, W / PBR_TILE_M.ceiling, D / PBR_TILE_M.ceiling);
    const w = this.walls;
    const wall = (name: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => this.wallSet.set(name, x0, x1, y0, y1, z0, z1);
    // tường chung với kho (x ∈ [−0.5, 0]) có cửa thông ở z = WH_GAP (toạ độ cục bộ = tuyệt đối − (FRONT − D))
    const g0 = Math.max(0, WH_GAP.z0 - (STORE_FRONT_Z - D));
    const g1 = WH_GAP.z1 - (STORE_FRONT_Z - D);
    wall('back', -PARTY, W + T, 0, H, -T, 0);
    wall('leftA', -PARTY, 0, 0, H, 0, warehouse ? g0 : D + T);
    wall('leftB', -PARTY, 0, 0, H, warehouse ? g1 : D + T, D + T);
    wall('leftLintel', -PARTY, 0, WH_GAP.h, H, g0, g1);
    wall('leftFill', -PARTY, 0, 0, WH_GAP.h, g0, g1);
    this.wallSet.setVisible('leftLintel', warehouse);
    this.wallSet.setVisible('leftFill', false);
    wall('right', W, W + T, 0, H, 0, D + T);
    wall('header', -T, W + T, GLASS_H, H, D, D + T);
    const dl = DOOR_X - DOOR_WIDTH / 2;
    const dr = DOOR_X + DOOR_WIDTH / 2;
    place(w.glassL, 0, dl, 0.3, GLASS_H, D + T / 2 - 0.01, D + T / 2 + 0.01);
    place(w.glassR, dr, W, 0.3, GLASS_H, D + T / 2 - 0.01, D + T / 2 + 0.01);
    place(w.kickL, 0, dl, 0, 0.3, D, D + T);
    place(w.kickR, dr, W, 0, 0.3, D, D + T);
    place(w.railL, 0, dl, 1.05, 1.1, D + T / 2 - 0.03, D + T / 2 + 0.03);
    place(w.railR, dr, W, 1.05, 1.1, D + T / 2 - 0.03, D + T / 2 + 0.03);
    // khung đứng
    const m = new THREE.Matrix4();
    let n = 0;
    const xs = [0, dl, dr, W];
    for (let x = dr + 1.5; x < W - 0.4; x += 1.5) xs.push(x);
    for (let x = dl - 1.5; x > 0.4; x -= 1.5) xs.push(x);
    for (const x of xs) {
      m.compose(new THREE.Vector3(x, GLASS_H / 2, D + T / 2), new THREE.Quaternion(), new THREE.Vector3(0.08, GLASS_H, T));
      this.mullions.setMatrixAt(n++, m);
    }
    this.mullions.count = n;
    this.mullions.instanceMatrix.needsUpdate = true;
    this.whGroup.visible = warehouse;
    // vỏ nhà (khối chưa mở khoá) chỉ dựng lại khi kích thước chốt, không dựng mỗi khung hình lúc đang nới
    const key = `${W}x${D}x${warehouse}`;
    if (Number.isInteger(W) && Number.isInteger(D) && key !== this.shellKey) {
      this.shellKey = key;
      this.shell.update(W, D, warehouse);
    }
    this.layoutDoors();
  }

  private layoutDoors(): void {
    const o = this.doorOpen * 0.95;
    this.doorL.position.set(DOOR_X - 0.5 - o, 0, this.D + T + 0.04);
    this.doorR.position.set(DOOR_X + 0.5 + o, 0, this.D + T + 0.04);
  }

  /** Cửa trượt tự mở khi có người tới gần. */
  update(dt: number, people: Array<{ x: number; z: number }>): void {
    const c = { x: DOOR_X, z: STORE_FRONT_Z + T / 2 };
    const near = people.some((p) => Math.abs(p.x - c.x) < 1.6 && Math.abs(p.z - c.z) < 1.8);
    const target = near ? 1 : 0;
    const was = this.doorOpen;
    this.doorOpen += Math.sign(target - this.doorOpen) * Math.min(Math.abs(target - this.doorOpen), dt * 2.2);
    if (was === 0 && this.doorOpen > 0) this.onDoorOpen();
    if (was !== this.doorOpen) this.layoutDoors();
  }

  /** Hộp va chạm của tường & ranh giới khu vực chơi (toạ độ tuyệt đối). */
  colliders(): AABB[] {
    const { W, D } = this;
    const B = STORE_FRONT_Z - D;
    const out: AABB[] = [];
    const box = (x0: number, x1: number, z0: number, z1: number, tag: string) =>
      out.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, tag });
    box(-PARTY, W + T, B - T, B, 'wall');
    box(W, W + T, B, STORE_FRONT_Z + T, 'wall');
    // tường chung với kho: có cửa thông khi kho đã mở khoá
    if (this.warehouse) {
      box(-PARTY, 0, B, WH_GAP.z0, 'wall');
      box(-PARTY, 0, WH_GAP.z1, STORE_FRONT_Z + T, 'wall');
    } else box(-PARTY, 0, B, STORE_FRONT_Z + T, 'wall');
    box(-T, DOOR_X - DOOR_WIDTH / 2, STORE_FRONT_Z, STORE_FRONT_Z + T, 'glass');
    box(DOOR_X + DOOR_WIDTH / 2, W + T, STORE_FRONT_Z, STORE_FRONT_Z + T, 'glass');
    out.push(...this.shell.colliders());
    return out;
  }
}
