import type Phaser from 'phaser';
import type { BoxData } from '../../core/GameState';
import type { Services } from '../../core/Services';
import { BoxView } from '../../entities/Box';

/** Đồng bộ các thùng trên sàn / kệ kho với state. */
export class BoxManager {
  private views = new Map<string, BoxView>();
  private dirty = true;
  private offs: Array<() => void> = [];
  private pendingDrops = new Set<string>();

  constructor(private scene: Phaser.Scene, private s: Services) {
    this.offs.push(
      s.bus.on('boxes:changed', () => { this.dirty = true; }),
      s.bus.on('order:arrived', ({ boxUids }) => { boxUids.forEach((u) => this.pendingDrops.add(u)); this.dirty = true; }),
    );
  }

  markDirty(): void {
    this.dirty = true;
  }

  get(uid: string): BoxView | undefined {
    return this.views.get(uid);
  }

  update(): void {
    if (!this.dirty) return;
    this.dirty = false;
    const stacks = new Map<string, number>();
    const seen = new Set<string>();
    const boxes = [...this.s.data.boxes].sort((a, b) => a.uid.localeCompare(b.uid, undefined, { numeric: true }));
    let dropIndex = 0;
    for (const b of boxes) {
      if (b.location === 'held' || b.location === 'staff') continue;
      seen.add(b.uid);
      let v = this.views.get(b.uid);
      if (!v) {
        v = new BoxView(this.scene, b);
        this.views.set(b.uid, v);
      }
      v.data = b;
      let stack = 0;
      if (b.location === 'floor') {
        const k = `${Math.floor(b.gx)},${Math.floor(b.gy)}`;
        stack = stacks.get(k) ?? 0;
        stacks.set(k, stack + 1);
      }
      const rack = b.location === 'rack' && b.holderId ? this.s.state.furniture(b.holderId) ?? null : null;
      v.sync(stack, rack);
      if (this.pendingDrops.has(b.uid)) {
        this.pendingDrops.delete(b.uid);
        v.drop(140, dropIndex++ * 90);
      }
    }
    for (const [uid, v] of this.views) {
      if (!seen.has(uid)) {
        v.destroy();
        this.views.delete(uid);
      }
    }
  }

  /** Thùng dưới con trỏ (toạ độ world) — thùng trên cùng. */
  boxAt(wx: number, wy: number): BoxData | null {
    let best: BoxView | null = null;
    for (const v of this.views.values()) {
      if (v.containsWorld(wx, wy) && (!best || v.image.depth > best.image.depth)) best = v;
    }
    return best?.data ?? null;
  }

  destroy(): void {
    this.offs.forEach((o) => o());
    this.views.forEach((v) => v.destroy());
    this.views.clear();
  }
}
