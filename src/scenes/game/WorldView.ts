import Phaser from 'phaser';
import type { Services } from '../../core/Services';
import { hashString, mulberry32 } from '../../core/Random';
import { DEPTH_FLOOR, depthAt } from '../../iso/DepthSort';
import type { Tile } from '../../iso/IsoGrid';
import { DOOR_X, WAREHOUSE } from '../../config/constants';
import { gridToScreen } from '../../iso/IsoMath';
import { GLASS_H, WALL_H } from '../../render/TileArt';

/** Vẽ sàn, tường, cửa, biển mở/đóng cửa và cây trang trí. */
export class WorldView {
  private floor: Phaser.GameObjects.Image[] = [];
  private walls: Phaser.GameObjects.Image[] = [];
  private backWalls: Phaser.GameObjects.Image[] = [];
  private decor: Phaser.GameObjects.Image[] = [];
  private sign: Phaser.GameObjects.Container | null = null;
  private signText: Phaser.GameObjects.Text | null = null;
  private signBoard: Phaser.GameObjects.Graphics | null = null;
  private wallAlpha = 1;

  constructor(private scene: Phaser.Scene, private s: Services) {
    this.build(false);
    s.bus.on('store:toggled', ({ open }) => this.updateSign(open));
  }

  private floorTexture(gx: number, gy: number, t: Tile, H: number): string | null {
    switch (t.type) {
      case 'floor': return (gx + gy) % 2 === 0 ? 'tile_floor_a' : 'tile_floor_b';
      case 'door': return 'tile_door';
      case 'sidewalk': return 'tile_sidewalk';
      case 'road': return gy === H + 5 && gx % 2 === 0 ? 'tile_road_line' : 'tile_road';
      case 'grass': return 'tile_grass';
      case 'warehouse': return 'tile_warehouse';
      case 'wall':
        if (t.wall === 'front_y' || gy >= H) return 'tile_sidewalk';
        if (this.s.grid.warehouse && gx === -1 && gy >= 0 && gy < WAREHOUSE.y0 + WAREHOUSE.h) return 'tile_warehouse';
        return 'tile_grass';
      default: return null;
    }
  }

  /** Dựng lại toàn bộ; animate = hiệu ứng mở rộng. */
  build(animate: boolean): void {
    const oldKeys = new Set(this.floor.map((f) => f.getData('key') as string));
    this.floor.forEach((f) => f.destroy());
    this.walls.forEach((w) => w.destroy());
    this.decor.forEach((d) => d.destroy());
    this.floor = [];
    this.walls = [];
    this.backWalls = [];
    this.decor = [];
    const grid = this.s.grid;
    const H = grid.storeH;
    const W = grid.storeW;
    grid.forEach((gx, gy, t) => {
      const key = this.floorTexture(gx, gy, t, H);
      if (!key) return;
      const p = gridToScreen(gx, gy);
      const img = this.scene.add.image(p.x, p.y, key).setOrigin(0.5, 0).setDepth(DEPTH_FLOOR + (gx + gy) * 0.01);
      const id = `${gx},${gy},${key}`;
      img.setData('key', id);
      if (animate && !oldKeys.has(id) && (t.type === 'floor' || t.type === 'warehouse')) {
        img.setAlpha(0).y += 12;
        this.scene.tweens.add({ targets: img, alpha: 1, y: p.y, duration: 400, delay: (gx + gy) * 12, ease: 'Back.Out' });
      }
      this.floor.push(img);
      if (t.wall) this.addWall(gx, gy, t, animate);
    });
    this.addPosts(animate);
    // cây & bụi trang trí trên cỏ
    const rng = mulberry32(hashString(`decor${W}x${H}`));
    grid.forEach((gx, gy, t) => {
      if (t.type !== 'grass' || rng() > 0.06) return;
      if (gy > -1 && gy < H + 1 && gx > -3 && gx < W + 2) return;
      const p = gridToScreen(gx + 0.5, gy + 0.5);
      const tree = rng() < 0.5;
      const img = this.scene.add.image(p.x, p.y + 4, tree ? 'tree' : 'bush').setOrigin(0.5, 1).setDepth(depthAt(gx + 0.5, gy + 0.5, 2));
      this.decor.push(img);
    });
    this.buildSign();
  }

  private addWall(gx: number, gy: number, t: Tile, animate: boolean): void {
    const add = (key: string, ax: number, ay: number, depth: number, back: boolean, originX: number, originY: number) => {
      const p = gridToScreen(ax, ay);
      const img = this.scene.add.image(p.x, p.y, key).setOrigin(originX, originY).setDepth(depth);
      if (animate) {
        img.setAlpha(0);
        this.scene.tweens.add({ targets: img, alpha: 1, duration: 500, delay: 200 });
      }
      this.walls.push(img);
      if (back) this.backWalls.push(img);
      return img;
    };
    // origin: điểm neo ở đáy tấm tường (pad = 2)
    const drOrigin = (h: number) => [2 / 36, (h + 2) / (16 + h + 4)] as const;
    const dlOrigin = (h: number) => [34 / 36, (h + 2) / (16 + h + 4)] as const;
    switch (t.wall) {
      case 'back_y': {
        const [ox, oy] = drOrigin(WALL_H);
        add('wall_dr', gx, gy + 1, depthAt(gx + 0.5, gy + 1, 0), true, ox, oy);
        break;
      }
      case 'back_x': {
        const [ox, oy] = dlOrigin(WALL_H);
        add('wall_dl', gx + 1, gy, depthAt(gx + 1, gy + 0.5, 0), true, ox, oy);
        break;
      }
      case 'front_y': {
        const [ox, oy] = drOrigin(GLASS_H);
        add('glass_dr', gx, gy, depthAt(gx + 0.5, gy, 0), false, ox, oy);
        break;
      }
      case 'front_x': {
        const [ox, oy] = dlOrigin(GLASS_H);
        add('glass_dl', gx, gy, depthAt(gx, gy + 0.5, 0), false, ox, oy);
        break;
      }
      default:
        break;
    }
  }

  private addPosts(animate: boolean): void {
    const W = this.s.grid.storeW;
    const H = this.s.grid.storeH;
    const tall: Array<[number, number]> = [[0, 0], [W, 0], [0, H]];
    if (this.s.grid.warehouse) tall.push([WAREHOUSE.x0, WAREHOUSE.y0], [WAREHOUSE.x0, WAREHOUSE.y0 + WAREHOUSE.h]);
    const low: Array<[number, number]> = [[W, H], [DOOR_X, H], [DOOR_X + 1, H]];
    if (this.s.grid.warehouse) low.push([0, WAREHOUSE.y0 + WAREHOUSE.h]);
    const put = (key: string, x: number, y: number, oy: number, back: boolean) => {
      const p = gridToScreen(x, y);
      const img = this.scene.add.image(p.x, p.y, key).setOrigin(0.5, oy).setDepth(depthAt(x, y, 0.1));
      if (animate) {
        img.setAlpha(0);
        this.scene.tweens.add({ targets: img, alpha: 1, duration: 500, delay: 200 });
      }
      this.walls.push(img);
      if (back) this.backWalls.push(img);
    };
    for (const [x, y] of tall) put('post', x, y, (WALL_H + 4) / (WALL_H + 6), y === 0);
    for (const [x, y] of low) put('post_low', x, y, (GLASS_H + 6) / (GLASS_H + 8), false);
  }

  private buildSign(): void {
    this.sign?.destroy();
    const t = this.s.grid.signTile;
    const p = gridToScreen(t.gx + 0.5, t.gy + 0.2);
    const post = this.scene.add.graphics();
    post.fillStyle(0x8d6e63, 1).fillRect(-2, -36, 4, 36);
    this.signBoard = this.scene.add.graphics();
    this.signText = this.scene.add.text(0, -44, '', {
      fontFamily: 'Nunito, sans-serif', fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setResolution(2);
    this.sign = this.scene.add.container(p.x, p.y, [post, this.signBoard, this.signText]).setDepth(depthAt(t.gx + 0.5, t.gy + 0.5, 0.5));
    this.updateSign(this.s.data.storeOpen);
  }

  updateSign(open: boolean): void {
    if (!this.signBoard || !this.signText) return;
    this.signBoard.clear();
    this.signBoard.fillStyle(open ? 0x2a9d8f : 0xe63946, 1).fillRoundedRect(-24, -54, 48, 20, 5);
    this.signBoard.lineStyle(2, 0x3d3551, 1).strokeRoundedRect(-24, -54, 48, 20, 5);
    this.signText.setText(open ? 'MỞ CỬA' : 'ĐÓNG');
    if (this.sign) this.scene.tweens.add({ targets: this.sign, scaleX: { from: 0.2, to: 1 }, duration: 260, ease: 'Back.Out' });
  }

  /** Làm mờ tường sau khi người chơi đứng trong kho (bị tường che). */
  setBackWallFade(fade: boolean): void {
    const target = fade ? 0.35 : 1;
    if (target === this.wallAlpha) return;
    this.wallAlpha = target;
    this.scene.tweens.add({ targets: this.backWalls, alpha: target, duration: 200 });
  }

  destroy(): void {
    this.floor.forEach((f) => f.destroy());
    this.walls.forEach((w) => w.destroy());
    this.decor.forEach((d) => d.destroy());
    this.sign?.destroy();
  }
}
