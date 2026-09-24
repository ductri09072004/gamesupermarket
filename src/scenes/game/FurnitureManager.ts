import type Phaser from 'phaser';
import type { Services } from '../../core/Services';
import { FurnitureView } from '../../entities/Shelf';

export class FurnitureManager {
  private views = new Map<string, FurnitureView>();
  private zoom = 1;
  private offs: Array<() => void> = [];

  constructor(private scene: Phaser.Scene, private s: Services) {
    this.sync();
    this.offs.push(
      s.bus.on('inventory:changed', ({ furnitureUid }) => this.views.get(furnitureUid)?.drawItems()),
      s.bus.on('price:changed', () => this.views.forEach((v) => v.updateLabels(this.zoom))),
      s.bus.on('day:started', () => this.views.forEach((v) => v.updateLabels(this.zoom))),
    );
  }

  get(uid: string): FurnitureView | undefined {
    return this.views.get(uid);
  }

  all(): FurnitureView[] {
    return [...this.views.values()];
  }

  /** Đồng bộ view với state (thêm / xoá / vẽ lại). */
  sync(): void {
    const seen = new Set<string>();
    for (const f of this.s.data.furniture) {
      seen.add(f.uid);
      const v = this.views.get(f.uid);
      if (v) {
        v.data = f;
        v.refresh();
      } else {
        this.views.set(f.uid, new FurnitureView(this.scene, f, (id) => this.s.state.priceOf(id)));
      }
    }
    for (const [uid, v] of this.views) {
      if (!seen.has(uid)) {
        v.destroy();
        this.views.delete(uid);
      }
    }
    this.views.forEach((v) => v.updateLabels(this.zoom));
  }

  setZoom(zoom: number): void {
    const was = this.zoom >= 1;
    this.zoom = zoom;
    if (was !== zoom >= 1) this.views.forEach((v) => v.updateLabels(zoom));
  }

  destroy(): void {
    this.offs.forEach((o) => o());
    this.views.forEach((v) => v.destroy());
    this.views.clear();
  }
}
