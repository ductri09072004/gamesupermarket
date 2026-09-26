import * as THREE from 'three';
import { getFurniture, isPassable } from '../config/furniture';
import { makeFurniture, type CrateData, type FurnitureData } from '../core/GameState';
import { canPlace } from '../systems/BuildSystem';
import { footprintCells, ROT_STEP, rotatedSize, stepRot, type GridPoint } from '../world/Footprint';
import { worldToCell } from '../world/NavGrid';
import { furnitureMatrix } from '../world/Placement';
import type { GameCtx } from '../game/Ctx';
import { commitFurniture, ghostModel, setCarried } from './BuildHelpers';
import { bindWheelSteps } from './wheelSteps';

interface Holding {
  type: string;
  rot: number;
  /** Đang dời nội thất có sẵn */
  from: FurnitureData | null;
  /** Đang lắp từ thùng nội thất */
  crate: CrateData | null;
}

/** Tầm đặt: điểm sàn tâm ngắm chỉ vào, trong khoảng này (m) tính từ người chơi */
const MIN_DIST = 1.1;
const MAX_DIST = 5;

/**
 * Đặt / dời nội thất ngay ở góc nhìn thứ nhất: ghost xanh/đỏ bám theo điểm sàn tâm ngắm chỉ vào,
 * lăn chuột xoay 15°, R xoay 90°, click trái đặt, Q / chuột phải huỷ. Người chơi vẫn đi lại bình thường.
 */
export class FpPlace {
  private holding: Holding | null = null;
  private ghost: THREE.Group | null = null;
  private ghostMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.45, depthWrite: false });
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private cell: GridPoint = { gx: 0, gy: 0 };
  private valid = false;
  private reason = '';
  private offWheel: () => void;

  constructor(private c: GameCtx, private peopleCells: () => GridPoint[], private onChanged: () => void) {
    this.offWheel = bindWheelSteps((dir) => this.rotate(dir * ROT_STEP), () => this.active && c.mode === 'play');
  }

  get active(): boolean {
    return this.holding !== null;
  }

  /** Nhấc nội thất đang nhìn để dời chỗ (hàng trên kệ đi theo). */
  startMove(uid: string): void {
    const f = this.c.s.state.furniture(uid);
    if (!f || this.active) return;
    this.holding = { type: f.type, rot: f.rot, from: f, crate: null };
    this.c.s.grid.free(f.uid);
    setCarried(this.c, f.uid, true);
    this.begin();
  }

  /** Bê thùng nội thất lên → lắp đặt. */
  startCrate(crate: CrateData): void {
    if (this.active) return;
    crate.held = true;
    this.c.s.bus.emit('crates:changed', {});
    this.holding = { type: crate.type, rot: 0, from: null, crate };
    this.begin();
  }

  private begin(): void {
    this.ghost?.removeFromParent();
    this.ghost = ghostModel(this.holding!.type, this.ghostMat);
    this.c.scene.add(this.ghost);
    this.c.sound('pop');
    this.update();
  }

  rotate(step = 1): void {
    if (!this.holding) return;
    this.holding.rot = stepRot(this.holding.rot, step);
    this.c.sound('click');
    this.refresh();
  }

  /** Điểm sàn ở tâm ngắm (giới hạn trong tầm đặt). */
  private floorPoint(): THREE.Vector3 {
    const c = this.c;
    c.camera.updateMatrixWorld();
    this.ray.setFromCamera(new THREE.Vector2(0, 0), c.camera);
    const p = new THREE.Vector3();
    const me = new THREE.Vector3(c.player.x, 0, c.player.z);
    const hit = this.ray.ray.intersectPlane(this.plane, p);
    const dir = new THREE.Vector3().subVectors(hit ? p : me.clone().add(c.player.forward.clone().setY(0).normalize().multiplyScalar(MAX_DIST)), me).setY(0);
    const dist = THREE.MathUtils.clamp(dir.length(), MIN_DIST, MAX_DIST);
    if (dir.lengthSq() < 1e-6) dir.copy(c.player.forward).setY(0);
    return me.add(dir.normalize().multiplyScalar(dist));
  }

  update(): void {
    const h = this.holding;
    if (!h) return;
    const p = this.floorPoint();
    const cell = worldToCell(p.x, p.z);
    const { w, h: d } = rotatedSize(getFurniture(h.type), h.rot);
    const next = { gx: cell.gx - Math.floor((w - 1) / 2), gy: cell.gy - Math.floor((d - 1) / 2) };
    if (next.gx !== this.cell.gx || next.gy !== this.cell.gy || !this.ghost?.visible) {
      this.cell = next;
      this.refresh();
    }
  }

  private refresh(): void {
    const h = this.holding;
    if (!h || !this.ghost) return;
    const def = getFurniture(h.type);
    const check = canPlace(this.c.s.grid, def, this.cell.gx, this.cell.gy, h.rot, this.c.s.data.furniture, h.from?.uid ?? null, this.peopleCells());
    this.valid = check.ok;
    this.reason = check.reason ?? '';
    this.ghostMat.color.set(check.ok ? 0x4ade80 : 0xf87171);
    this.ghost.matrix.copy(furnitureMatrix({ uid: '_ghost', type: h.type, gx: this.cell.gx, gy: this.cell.gy, rot: h.rot, slots: [], boxes: [] }));
    this.ghost.visible = true;
  }

  /** Click trái: lắp / đặt nếu hợp lệ. */
  place(): void {
    const c = this.c;
    const h = this.holding;
    if (!h) return;
    this.refresh();
    if (!this.valid) {
      c.sound('error');
      c.toast(this.reason || 'Không đặt được ở đây', 'error');
      return;
    }
    this.clearGhost();
    let placed: FurnitureData;
    if (h.from) {
      Object.assign(h.from, { gx: this.cell.gx, gy: this.cell.gy, rot: h.rot });
      setCarried(c, h.from.uid, false);
      placed = h.from;
    } else {
      placed = makeFurniture(c.s.state.newUid('f'), h.type, this.cell.gx, this.cell.gy, h.rot);
      c.s.data.furniture.push(placed);
      if (h.crate) {
        c.s.data.crates = c.s.data.crates.filter((k) => k !== h.crate);
        c.s.bus.emit('crates:changed', {});
        c.sound('fold');
      }
    }
    commitFurniture(c, placed.uid, this.onChanged);
  }

  /** Q / chuột phải: dời thì trả về chỗ cũ, thùng thì đặt xuống trước mặt. */
  cancel(): void {
    const h = this.holding;
    if (!h) return;
    this.clearGhost();
    const c = this.c;
    if (h.from) {
      const def = getFurniture(h.from.type);
      if (!isPassable(def)) c.s.grid.occupy(footprintCells(def, h.from.gx, h.from.gy, h.from.rot), h.from.uid);
      setCarried(c, h.from.uid, false);
    } else if (h.crate) {
      const f = c.player.forward.clone().setY(0).normalize().multiplyScalar(0.8);
      Object.assign(h.crate, { held: false, x: Math.round((c.player.x + f.x) * 100) / 100, z: Math.round((c.player.z + f.z) * 100) / 100 });
      c.s.bus.emit('crates:changed', {});
      c.sound('thud');
    }
  }

  private clearGhost(): void {
    this.holding = null;
    this.ghost?.removeFromParent();
    this.ghost = null;
  }

  hints(): string[] {
    const h = this.holding;
    if (!h) return [];
    const def = getFurniture(h.type);
    const status = this.valid ? `<b>${def.icon} ${def.name}</b> — đặt được ✔` : `<b>${def.icon} ${def.name}</b> — <span style="color:#f87171">${this.reason}</span>`;
    return [
      status,
      `<kbd>Chuột trái</kbd> ${h.crate ? 'Lắp đặt' : 'Đặt xuống'} · <kbd>Lăn chuột</kbd> xoay 15° · <kbd>R</kbd> xoay 90°`,
      `<span class="muted"><kbd>Q</kbd> / <kbd>Chuột phải</kbd> ${h.crate ? 'đặt thùng xuống' : 'huỷ dời'}</span>`,
    ];
  }

  destroy(): void {
    this.cancel();
    this.offWheel();
  }
}
