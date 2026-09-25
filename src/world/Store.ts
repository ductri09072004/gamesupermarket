import * as THREE from 'three';
import { CEILING_HEIGHT, DOOR_WIDTH, DOOR_X, PBR_TILE_M, WALL_THICKNESS, WAREHOUSE } from '../config/constants';
import type { AABB } from './Colliders';
import { applyPbr, pbrSet, setRepeat } from './Materials';
import { ceilingTexture, concreteTexture, floorTexture, wallTexture } from './Textures';

const H = CEILING_HEIGHT;
const T = WALL_THICKNESS;
const GLASS_H = 2.45;
const DOOR_H = 2.3;
const WH_GAP = { x0: WAREHOUSE.x0 + WAREHOUSE.doorX - 0.5, x1: WAREHOUSE.x0 + WAREHOUSE.doorX + 0.5, h: 2.2 };

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitPlane = new THREE.PlaneGeometry(1, 1);

/** Hộp đơn vị đặt theo mép (min/max). */
function place(m: THREE.Object3D, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): void {
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.scale.set(Math.max(1e-3, x1 - x0), Math.max(1e-3, y1 - y0), Math.max(1e-3, z1 - z0));
}

function wallMat(tex: THREE.Texture): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
}

/** Vỏ cửa hàng: sàn bóng, tường, trần, dải đèn, mặt kính trước, cửa trượt, kho phía sau. */
export class Store {
  readonly group = new THREE.Group();
  W = 12;
  D = 10;
  warehouse = false;
  private floor: THREE.Mesh;
  private ceiling: THREE.Mesh;
  private walls: Record<string, THREE.Mesh> = {};
  private wallTex: Record<string, THREE.Texture> = {};
  private floorTex = floorTexture();
  /** Texture sàn cần đổi repeat khi mở rộng (canvas hoặc bộ PBR) */
  private floorMaps: THREE.Texture[] = [];
  private floorTile = 1.2;
  private wallPbr: Record<string, THREE.Texture[]> = {};
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
    const fs = pbrSet('floor');
    if (fs) {
      // đá bóng: roughnessMap nhân với roughness → vệt phản chiếu đèn trần mờ nhưng vẫn có vân
      floorMat.roughness = 0.55;
      floorMat.normalScale.set(0.6, 0.6);
      this.floorMaps = applyPbr(floorMat, fs, ['map', 'normalMap', 'roughnessMap', 'aoMap']);
      if (!fs.map) this.floorMaps.push(this.floorTex);
      this.floorTile = PBR_TILE_M.floor;
    }
    this.floor = new THREE.Mesh(unitPlane, floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    const ceilTex = ceilingTexture();
    this.ceiling = new THREE.Mesh(unitPlane, new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.95 }));
    this.ceiling.rotation.x = Math.PI / 2;
    this.group.add(this.floor, this.ceiling);
    const baseWall = wallTexture();
    for (const name of ['backL', 'backR', 'backFill', 'backLintel', 'left', 'right', 'header']) {
      const tex = baseWall.clone();
      tex.needsUpdate = true;
      this.wallTex[name] = tex;
      const mat = wallMat(tex);
      const ws = pbrSet('wall');
      if (ws) {
        // giữ màu sơn vẽ bằng code, thêm vân vữa thật (normal + roughness) có repeat riêng theo kích thước tường
        mat.roughness = 1;
        mat.normalScale.set(0.45, 0.45);
        this.wallPbr[name] = applyPbr(mat, ws, ['normalMap', 'roughnessMap'], true);
      }
      const m = new THREE.Mesh(unitBox, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      this.walls[name] = m;
      this.group.add(m);
    }
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.7, roughness: 0.35 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xcfe8f5, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false });
    for (const name of ['glassL', 'glassR']) {
      const m = new THREE.Mesh(unitBox, glassMat);
      this.walls[name] = m;
      this.group.add(m);
    }
    for (const name of ['kickL', 'kickR', 'railL', 'railR']) {
      const m = new THREE.Mesh(unitBox, frameMat);
      m.castShadow = true;
      this.walls[name] = m;
      this.group.add(m);
    }
    this.mullions = new THREE.InstancedMesh(unitBox, frameMat, 64);
    this.group.add(this.mullions);
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
    this.group.add(this.doorL, this.doorR);
    this.buildWarehouse();
    this.group.add(this.whGroup);
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
    const wm = new THREE.MeshStandardMaterial({ map: concreteTexture('#d6d3cc'), roughness: 0.9 });
    const add = (a: number, b: number, c: number, e: number) => {
      const m = new THREE.Mesh(unitBox, wm);
      place(m, a, b, 0, H, c, e);
      m.receiveShadow = true;
      this.whGroup.add(m);
    };
    add(x0 - T, x0, z0 - T, 0);
    add(x0 + w, x0 + w + T, z0 - T, 0);
    add(x0 - T, x0 + w + T, z0 - T, z0);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.18), this.lightStripMat);
    lamp.position.set(x0 + w / 2, H - 0.03, z0 + d / 2);
    this.whGroup.add(floor, ceil, lamp);
  }

  /** Đèn cố định của kho theo công tắc (đèn cửa hàng là nội thất mua/dời được). */
  setLightsOn(on: boolean): void {
    this.lightStripMat.emissiveIntensity = on ? 3 : 0;
  }

  get doorCenter(): THREE.Vector3 {
    return new THREE.Vector3(DOOR_X, 0, this.D);
  }

  /** Dựng lại kích thước (gọi mỗi frame khi đang có animation mở rộng). */
  setSize(W: number, D: number, warehouse: boolean): void {
    this.W = W;
    this.D = D;
    this.warehouse = warehouse;
    this.floor.scale.set(W, D, 1);
    this.floor.position.set(W / 2, 0, D / 2);
    setRepeat(this.floorMaps, W / this.floorTile, D / this.floorTile);
    this.ceiling.scale.set(W, D, 1);
    this.ceiling.position.set(W / 2, H, D / 2);
    const w = this.walls;
    const wall = (name: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => {
      place(w[name], x0, x1, y0, y1, z0, z1);
      const len = Math.max(x1 - x0, z1 - z0);
      this.wallTex[name]?.repeat.set(Math.max(1, len / 2), (y1 - y0) / H);
      this.wallTex[name]?.offset.set(0, y0 / H);
      if (this.wallPbr[name]) setRepeat(this.wallPbr[name], len / PBR_TILE_M.wall, (y1 - y0) / PBR_TILE_M.wall);
    };
    wall('backL', -T, WH_GAP.x0, 0, H, -T, 0);
    wall('backR', WH_GAP.x1, W + T, 0, H, -T, 0);
    wall('backLintel', WH_GAP.x0, WH_GAP.x1, WH_GAP.h, H, -T, 0);
    wall('backFill', WH_GAP.x0, WH_GAP.x1, 0, WH_GAP.h, -T, 0);
    w.backFill.visible = !warehouse;
    wall('left', -T, 0, 0, H, 0, D + T);
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
    this.layoutDoors();
  }

  private layoutDoors(): void {
    const o = this.doorOpen * 0.95;
    this.doorL.position.set(DOOR_X - 0.5 - o, 0, this.D + T + 0.04);
    this.doorR.position.set(DOOR_X + 0.5 + o, 0, this.D + T + 0.04);
  }

  /** Cửa trượt tự mở khi có người tới gần. */
  update(dt: number, people: Array<{ x: number; z: number }>): void {
    const c = { x: DOOR_X, z: this.D + T / 2 };
    const near = people.some((p) => Math.abs(p.x - c.x) < 1.6 && Math.abs(p.z - c.z) < 1.8);
    const target = near ? 1 : 0;
    const was = this.doorOpen;
    this.doorOpen += Math.sign(target - this.doorOpen) * Math.min(Math.abs(target - this.doorOpen), dt * 2.2);
    if (was === 0 && this.doorOpen > 0) this.onDoorOpen();
    if (was !== this.doorOpen) this.layoutDoors();
  }

  /** Hộp va chạm của tường & ranh giới khu vực chơi. */
  colliders(): AABB[] {
    const { W, D } = this;
    const out: AABB[] = [];
    const box = (x0: number, x1: number, z0: number, z1: number, tag: string) =>
      out.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, tag });
    box(-T, WH_GAP.x0, -T, 0, 'wall');
    box(WH_GAP.x1, W + T, -T, 0, 'wall');
    if (!this.warehouse) box(WH_GAP.x0, WH_GAP.x1, -T, 0, 'wall');
    box(-T, 0, 0, D + T, 'wall');
    box(W, W + T, 0, D + T, 'wall');
    box(-T, DOOR_X - DOOR_WIDTH / 2, D, D + T, 'glass');
    box(DOOR_X + DOOR_WIDTH / 2, W + T, D, D + T, 'glass');
    if (this.warehouse) {
      const { x0, z0, w } = WAREHOUSE;
      box(x0 - T, x0, z0 - T, 0, 'wall');
      box(x0 + w, x0 + w + T, z0 - T, 0, 'wall');
      box(x0 - T, x0 + w + T, z0 - T, z0, 'wall');
    }
    return out;
  }
}
