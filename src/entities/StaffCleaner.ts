import * as THREE from 'three';
import { DIRT } from '../config/hygiene';
import type { DirtData } from '../core/GameState';
import type { StaffBody, StaffBrain } from './StaffTypes';
import { prop } from '../engine/Props';

const stickMat = new THREE.MeshStandardMaterial({ color: 0x8d99ae, roughness: 0.4, metalness: 0.6 });
const headMat = new THREE.MeshStandardMaterial({ color: 0x4ea8de, roughness: 0.9 });

/** Chổi / cây lau cầm tay: ưu tiên model chổi Poly Haven, thiếu thì dựng bằng code. */
function mop(): THREE.Group {
  const broom = prop('broom');
  if (broom) {
    const g = new THREE.Group();
    broom.position.y = -1.02; // cán trong tay, đầu chổi chạm sàn
    g.add(broom);
    g.rotation.x = 0.3;
    return g;
  }
  const g = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.25, 6), stickMat);
  stick.position.y = -0.35;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.1), headMat);
  head.position.y = -0.97;
  g.add(stick, head);
  g.rotation.x = 0.35;
  return g;
}

/**
 * Lao công: chất bẩn nào chưa ai nhận thì tới dọn (nhặt rác, lau sàn, lau kính mặt tiền);
 * xong hết việc thì ra ngoài cửa hàng đứng.
 */
export class CleanerBrain implements StaffBrain {
  private job: DirtData | null = null;
  private phase: 'idle' | 'go' | 'work' = 'idle';
  private timer = 0;
  private tool = mop();
  /** Biển "sàn ướt" + xô nước đặt cạnh vết đổ lúc đang lau */
  private signs: THREE.Object3D[] = [];

  constructor(private npc: StaffBody) {
    this.tool.visible = false;
    npc.human.handR.add(this.tool);
  }

  private get mess() {
    return this.npc.world.mess;
  }

  update(): void {
    // người chơi đã dọn trước → bỏ việc
    if (this.job && !this.npc.world.s.data.dirt.includes(this.job)) this.drop();
    this.tool.visible = this.phase !== 'idle';
  }

  tick(sim: number): void {
    switch (this.phase) {
      case 'idle': {
        this.timer -= sim;
        if (this.timer > 0) return;
        this.timer = 1;
        const by = this.npc.data.uid;
        const jobs = this.mess.dirtJobs(by).sort((a, b) => Math.hypot(a.x - this.npc.x, a.z - this.npc.z) - Math.hypot(b.x - this.npc.x, b.z - this.npc.z));
        for (const d of jobs) {
          if (!this.mess.claim(d.uid, by)) continue;
          if (this.npc.walkTo(this.mess.workSpots(d.x, d.z, d.kind === 'smudge'))) {
            this.job = d;
            this.phase = 'go';
            this.npc.setStatus(d.kind === 'smudge' ? '🪟 Đi lau kính' : d.kind === 'spill' ? '🧽 Đi lau sàn' : '🧹 Đi nhặt rác');
            return;
          }
          this.mess.release(d.uid, by);
        }
        if (this.npc.goRest()) this.npc.setStatus('☕ Nghỉ ngoài cửa hàng');
        return;
      }
      case 'go': {
        const d = this.job;
        if (!d) { this.drop(); return; }
        this.npc.face(d.x, d.z);
        this.npc.human.reach();
        this.phase = 'work';
        this.timer = DIRT.cleanS[d.kind] / this.npc.data.speed;
        if (d.kind === 'spill') this.placeSigns(d);
        this.npc.world.s.bus.emit('sound', { name: d.kind === 'litter' ? 'paper' : 'mop', pos: { x: d.x, y: 0.5, z: d.z } });
        this.npc.setStatus(d.kind === 'litter' ? '🧹 Nhặt rác' : '🧽 Đang lau');
        return;
      }
      case 'work': {
        const before = this.timer;
        this.timer -= sim;
        // lau qua lau lại
        if (Math.floor(before / 0.8) !== Math.floor(this.timer / 0.8)) this.npc.human.reach();
        if (this.timer > 0) return;
        if (this.job) this.mess.cleanDirt(this.job.uid, this.npc.human.handR.getWorldPosition(new THREE.Vector3()));
        this.drop();
        this.timer = 0.2;
      }
    }
  }

  /** Đặt biển cảnh báo & xô cạnh vết đổ, lệch về phía lối đi (phía nhân viên đứng). */
  private placeSigns(d: DirtData): void {
    const parent = this.npc.human.root.parent;
    if (!parent) return;
    const dx = this.npc.x - d.x;
    const dz = this.npc.z - d.z;
    const len = Math.hypot(dx, dz) || 1;
    const items: Array<[string, number, number]> = [['wet_floor_sign', 0.55, 0.35], ['bucket', 0.35, -0.4]];
    for (const [name, along, side] of items) {
      const o = prop(name);
      if (!o) continue;
      o.position.set(d.x + (dx / len) * along - (dz / len) * side, 0, d.z + (dz / len) * along + (dx / len) * side);
      o.rotation.y = Math.atan2(dx, dz) + side;
      parent.add(o);
      this.signs.push(o);
    }
  }

  private drop(): void {
    for (const o of this.signs) o.removeFromParent();
    this.signs = [];
    if (this.job) this.mess.release(this.job.uid, this.npc.data.uid);
    this.job = null;
    this.phase = 'idle';
  }

  destroy(): void {
    this.drop();
    this.tool.removeFromParent();
  }
}
