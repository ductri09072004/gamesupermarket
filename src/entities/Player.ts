import type Phaser from 'phaser';
import { CARRY_SPEED_MULT, CHARACTER_RADIUS, PLAYER_SPEED } from '../config/constants';
import type { BoxData } from '../core/GameState';
import type { WalkGrid } from '../iso/IsoGrid';
import type { GridPoint } from '../iso/IsoMath';
import { CharacterView } from './Character';
import { boxTextureFor } from './Box';

export const PLAYER_LOOK = { shirt: 0x3a86ff, hair: 0x2b2d42, skin: 0xf1c27d, apron: 0xff8fab };

/** Nhân vật chủ tiệm. */
export class Player {
  readonly view: CharacterView;
  facing: GridPoint = { gx: 1, gy: 1 };
  heldBox: BoxData | null = null;
  moving = false;

  constructor(private scene: Phaser.Scene, gx: number, gy: number) {
    this.view = new CharacterView(scene, PLAYER_LOOK, gx, gy);
  }

  get gx(): number { return this.view.gx; }
  get gy(): number { return this.view.gy; }
  get tile(): GridPoint { return this.view.tile; }

  /** Điểm phía trước mặt (để chọn vật tương tác / đặt thùng). */
  frontPoint(dist = 0.8): { gx: number; gy: number } {
    return { gx: this.gx + this.facing.gx * dist, gy: this.gy + this.facing.gy * dist };
  }

  private canStand(grid: WalkGrid, x: number, y: number): boolean {
    const r = CHARACTER_RADIUS;
    return grid.isWalkable(Math.floor(x - r), Math.floor(y - r))
      && grid.isWalkable(Math.floor(x + r), Math.floor(y - r))
      && grid.isWalkable(Math.floor(x - r), Math.floor(y + r))
      && grid.isWalkable(Math.floor(x + r), Math.floor(y + r));
  }

  /** dir: vector lưới đã chuẩn hoá. */
  update(dtMs: number, dir: GridPoint, grid: WalkGrid): void {
    this.moving = dir.gx !== 0 || dir.gy !== 0;
    if (this.moving) {
      this.facing = { gx: dir.gx, gy: dir.gy };
      this.view.face(dir.gx, dir.gy);
      const speed = PLAYER_SPEED * (this.heldBox ? CARRY_SPEED_MULT : 1);
      const d = (speed * dtMs) / 1000;
      let x = this.gx;
      let y = this.gy;
      const stuckNow = !this.canStand(grid, x, y);
      if (stuckNow || this.canStand(grid, x + dir.gx * d, y)) x += dir.gx * d;
      if (stuckNow || this.canStand(grid, x, y + dir.gy * d)) y += dir.gy * d;
      this.view.setPosition(x, y);
    }
    this.view.animate(dtMs, this.moving);
  }

  teleport(gx: number, gy: number): void {
    this.view.setPosition(gx, gy);
  }

  faceTowards(gx: number, gy: number): void {
    const dx = gx - this.gx;
    const dy = gy - this.gy;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    this.facing = { gx: dx / len, gy: dy / len };
    this.view.face(dx, dy);
  }

  hold(box: BoxData | null): void {
    this.heldBox = box;
    this.refreshHeld();
  }

  refreshHeld(): void {
    this.view.setHeld(this.heldBox ? boxTextureFor(this.scene, this.heldBox) : null);
  }
}
