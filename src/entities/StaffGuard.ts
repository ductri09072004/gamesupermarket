import * as THREE from 'three';
import { SECURITY } from '../config/hygiene';
import type { LooseItem } from '../core/GameState';
import { findReturnShelf } from '../systems/InventorySystem';
import { getFurniture } from '../config/furniture';
import { frontTiles } from '../world/Footprint';
import { worldToCell } from '../world/NavGrid';
import type { Customer } from './Customer';
import type { StaffBody, StaffBrain } from './StaffTypes';

type Phase = 'post' | 'chase' | 'collect' | 'pick' | 'return';

/**
 * Bảo vệ: đứng canh cạnh cổng an ninh. Cổng hú còi → chạy tới tóm kẻ trộm (hàng văng ra sàn)
 * → nhặt từng món → mang về đúng kệ → quay lại chỗ canh.
 */
export class GuardBrain implements StaffBrain {
  private phase: Phase = 'post';
  private thief: Customer | null = null;
  private item: LooseItem | null = null;
  private carried: string[] = [];
  private timer = 0;
  private repath = 0;

  constructor(private npc: StaffBody) {}

  private get w() {
    return this.npc.world;
  }

  update(dt: number): void {
    this.checkAlarm();
    // đang đuổi: bám theo vị trí kẻ trộm (tick không chạy khi đang di chuyển)
    const t = this.thief;
    if (this.phase !== 'chase' || !t) return;
    if (!this.w.security.thieves().includes(t)) { this.endChase(); return; }
    if (Math.hypot(t.x - this.npc.x, t.z - this.npc.z) < SECURITY.catchDist) {
      this.npc.stop();
      this.npc.face(t.x, t.z);
      this.npc.human.act?.('punch');
      this.w.security.catchThief(t, 'guard');
      this.npc.setStatus('💪 Tóm được rồi!');
      this.endChase();
      return;
    }
    this.repath -= dt;
    if (this.repath <= 0) {
      this.repath = 0.35;
      this.npc.walkTo(t.cell);
    }
  }

  private endChase(): void {
    this.thief = null;
    this.npc.speedMul = 1;
    this.phase = 'collect';
    this.timer = 0.4;
  }

  /** Báo động → bỏ mọi việc khác để đuổi (kiểm tra mỗi khung hình, kể cả đang đi). */
  private checkAlarm(): void {
    if (this.phase === 'chase') return;
    const thieves = this.w.security.thieves();
    if (!thieves.length) return;
    const dist = (c: Customer) => Math.hypot(c.x - this.npc.x, c.z - this.npc.z);
    this.thief = thieves.reduce((a, b) => (dist(a) < dist(b) ? a : b));
    this.phase = 'chase';
    this.npc.speedMul = SECURITY.guardRun;
    this.repath = 0;
    if (this.item) this.w.mess.release(this.item.uid, this.npc.data.uid);
    this.item = null;
    this.npc.setStatus('🚨 Đứng lại!');
  }

  tick(sim: number): void {
    switch (this.phase) {
      case 'chase':
        // tới vị trí cũ mà kẻ trộm đã chạy tiếp → update() sẽ tìm đường lại
        this.repath = 0;
        return;
      case 'collect':
        this.timer -= sim;
        if (this.timer > 0) return;
        this.timer = 0.3;
        if (this.carried.length < SECURITY.carryMax && this.nextItem()) return;
        if (this.carried.length) this.goReturn();
        else this.goPost();
        return;
      case 'pick': {
        const it = this.item;
        this.item = null;
        this.phase = 'collect';
        this.timer = SECURITY.pickS / this.npc.data.speed;
        if (!it || !this.w.mess.takeLoose(it.uid)) return;
        this.npc.human.reach();
        this.carried.push(it.productId);
        this.npc.setStatus(`🛍️ Nhặt hàng (${this.carried.length})`);
        return;
      }
      case 'return': {
        // trả hết món cùng loại lên kệ trước mặt, món nào hết chỗ thì để lại thành thùng
        const pid = this.carried[0];
        const hand = this.npc.human.handR.getWorldPosition(new THREE.Vector3());
        const rest: string[] = [];
        for (const p of this.carried) {
          if (p !== pid || !this.w.mess.returnToShelf(p, hand)) rest.push(p);
        }
        const failed = rest.filter((p) => p === pid).length;
        if (failed) this.w.s.inventory.createBox(pid, failed, Math.round(this.npc.x * 100) / 100, Math.round(this.npc.z * 100) / 100);
        if (failed) this.w.s.bus.emit('boxes:changed', {});
        this.carried = rest.filter((p) => p !== pid);
        this.npc.human.reach();
        this.phase = 'collect';
        this.timer = 0.5;
        return;
      }
      case 'post':
        this.goPost();
    }
  }

  private nextItem(): boolean {
    const by = this.npc.data.uid;
    const jobs = this.w.mess.looseJobs(by).sort((a, b) => Math.hypot(a.x - this.npc.x, a.z - this.npc.z) - Math.hypot(b.x - this.npc.x, b.z - this.npc.z));
    for (const it of jobs) {
      if (!this.w.mess.claim(it.uid, by)) continue;
      if (this.npc.walkTo(this.w.mess.workSpots(it.x, it.z, false))) {
        this.item = it;
        this.phase = 'pick';
        this.npc.setStatus('🛍️ Đi nhặt hàng rơi');
        return true;
      }
      this.w.mess.release(it.uid, by);
    }
    return false;
  }

  private goReturn(): void {
    const s = this.w.s;
    const t = findReturnShelf(s.data.furniture, this.carried[0]);
    const goals = t ? frontTiles(getFurniture(t.furn.type), t.furn.gx, t.furn.gy, t.furn.rot).filter((p) => s.grid.isWalkable(p.gx, p.gy)) : [];
    if (goals.length && this.npc.walkTo(goals)) {
      this.phase = 'return';
      this.npc.setStatus('↩️ Mang hàng về kệ');
      return;
    }
    // không có kệ nào nhận → đóng thành thùng tại chỗ cho người chơi xử lý
    const pid = this.carried[0];
    const n = this.carried.filter((p) => p === pid).length;
    s.inventory.createBox(pid, n, Math.round(this.npc.x * 100) / 100, Math.round(this.npc.z * 100) / 100);
    s.bus.emit('boxes:changed', {});
    this.carried = this.carried.filter((p) => p !== pid);
  }

  private goPost(): void {
    this.phase = 'post';
    const posts = this.w.guardPost();
    const here = worldToCell(this.npc.x, this.npc.z);
    if (posts.some((p) => p.gx === here.gx && p.gy === here.gy)) {
      this.npc.face(this.npc.x, this.npc.z + 5);
      this.npc.setStatus('🛡️ Canh cửa');
      return;
    }
    if (posts.length && this.npc.walkTo(posts)) this.npc.setStatus('🚶 Về chỗ canh');
    else this.npc.setStatus('🛡️ Canh cửa');
  }

  destroy(): void {
    if (this.item) this.w.mess.release(this.item.uid, this.npc.data.uid);
    // hàng đang ôm rơi lại xuống sàn
    for (const p of this.carried) this.w.mess.addLoose(p, this.npc.x, this.npc.z);
    this.carried = [];
    this.npc.speedMul = 1;
  }
}
