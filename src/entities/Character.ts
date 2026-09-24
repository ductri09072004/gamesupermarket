import Phaser from 'phaser';
import { DEPTH_UI, depthAt, LAYER } from '../iso/DepthSort';
import { facingFromGridVector, gridToScreen, type Facing, type GridPoint } from '../iso/IsoMath';
import { characterTexture, type Look } from '../render/CharacterArt';

/** Hiển thị nhân vật: thân, bóng, thùng đang cầm, bong bóng suy nghĩ, icon trạng thái. */
export class CharacterView {
  readonly container: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Image;
  private held: Phaser.GameObjects.Image;
  private bubble: Phaser.GameObjects.Container;
  private bubbleBg: Phaser.GameObjects.Graphics;
  private bubbleText: Phaser.GameObjects.Text;
  private bubbleTimer: Phaser.Time.TimerEvent | null = null;
  private status: Phaser.GameObjects.Text;
  facing: Facing = 'down';
  gx: number;
  gy: number;
  private bobT = Math.random() * 10;

  constructor(private scene: Phaser.Scene, private look: Look, gx: number, gy: number) {
    this.gx = gx;
    this.gy = gy;
    const shadow = scene.add.image(0, 0, 'shadow');
    this.body = scene.add.image(0, 0, characterTexture(scene, look, 'down')).setOrigin(0.5, 0.97);
    this.held = scene.add.image(0, -18, '__DEFAULT').setVisible(false).setScale(0.85);
    this.container = scene.add.container(0, 0, [shadow, this.body, this.held]);
    this.bubbleBg = scene.add.graphics();
    this.bubbleText = scene.add.text(0, 0, '', {
      fontFamily: 'Nunito, sans-serif', fontSize: '13px', color: '#3d3551', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setResolution(2);
    this.bubble = scene.add.container(0, 0, [this.bubbleBg, this.bubbleText]).setVisible(false).setDepth(DEPTH_UI - 10);
    this.status = scene.add.text(0, 0, '', {
      fontFamily: 'Nunito, sans-serif', fontSize: '11px', color: '#ffffff', backgroundColor: '#3d3551cc',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5, 1).setVisible(false).setDepth(DEPTH_UI - 11).setResolution(2);
    this.setPosition(gx, gy);
  }

  setPosition(gx: number, gy: number): void {
    this.gx = gx;
    this.gy = gy;
    const p = gridToScreen(gx, gy);
    this.container.setPosition(p.x, p.y);
    this.container.setDepth(depthAt(gx, gy, LAYER.character));
    this.bubble.setPosition(p.x, p.y - 62);
    this.status.setPosition(p.x, p.y - 48);
  }

  get tile(): GridPoint {
    return { gx: Math.floor(this.gx), gy: Math.floor(this.gy) };
  }

  face(dgx: number, dgy: number): void {
    if (dgx === 0 && dgy === 0) return;
    const f = facingFromGridVector(dgx, dgy);
    if (f === this.facing) return;
    this.facing = f;
    this.body.setTexture(characterTexture(this.scene, this.look, f));
    this.updateHeldLayer();
  }

  setLook(look: Look): void {
    this.look = look;
    this.body.setTexture(characterTexture(this.scene, look, this.facing));
  }

  /** Hiệu ứng nhún khi đi. */
  animate(dtMs: number, moving: boolean): void {
    if (moving) {
      this.bobT += dtMs / 1000;
      this.body.y = -Math.abs(Math.sin(this.bobT * 12)) * 2.5;
      this.body.rotation = Math.sin(this.bobT * 12) * 0.04;
    } else {
      this.body.y = 0;
      this.body.rotation = 0;
    }
    this.held.y = this.body.y - 18;
  }

  setHeld(texture: string | null): void {
    if (!texture) {
      this.held.setVisible(false);
      return;
    }
    this.held.setTexture(texture).setVisible(true);
    this.updateHeldLayer();
  }

  private updateHeldLayer(): void {
    // quay lưng lại → thùng nằm sau người
    this.container.moveTo(this.held, this.facing === 'up' ? 1 : 2);
  }

  showBubble(text: string, durationMs = 1800): void {
    this.bubbleText.setText(text);
    const w = Math.max(28, this.bubbleText.width + 14);
    const h = this.bubbleText.height + 8;
    this.bubbleBg.clear();
    this.bubbleBg.fillStyle(0xffffff, 0.96).fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    this.bubbleBg.lineStyle(2, 0x3d3551, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    this.bubbleBg.fillStyle(0xffffff, 1).fillTriangle(-5, h / 2 - 1, 5, h / 2 - 1, 0, h / 2 + 6);
    this.bubble.setVisible(true).setScale(0.6);
    this.scene.tweens.add({ targets: this.bubble, scale: 1, duration: 160, ease: 'Back.Out' });
    this.bubbleTimer?.remove();
    this.bubbleTimer = durationMs > 0 ? this.scene.time.delayedCall(durationMs, () => this.hideBubble()) : null;
  }

  hideBubble(): void {
    this.bubble.setVisible(false);
    this.bubbleTimer?.remove();
    this.bubbleTimer = null;
  }

  setStatus(text: string | null): void {
    if (!text) this.status.setVisible(false);
    else this.status.setText(text).setVisible(true);
  }

  setVisible(v: boolean): void {
    this.container.setVisible(v);
    if (!v) {
      this.bubble.setVisible(false);
      this.status.setVisible(false);
    }
  }

  get depth(): number {
    return this.container.depth;
  }

  destroy(): void {
    this.bubbleTimer?.remove();
    this.container.destroy();
    this.bubble.destroy();
    this.status.destroy();
  }
}

/** Di chuyển theo đường đi (danh sách ô) với toạ độ thực. */
export class PathFollower {
  path: GridPoint[] = [];
  private idx = 0;
  goal: GridPoint | null = null;

  setPath(path: GridPoint[] | null, goal: GridPoint | null = null): boolean {
    this.path = path ?? [];
    this.idx = this.path.length > 1 ? 1 : 0;
    this.goal = goal ?? (this.path.length ? this.path[this.path.length - 1] : null);
    return !!path;
  }

  get done(): boolean {
    return this.idx >= this.path.length;
  }

  get next(): GridPoint | null {
    return this.path[this.idx] ?? null;
  }

  get remaining(): GridPoint[] {
    return this.path.slice(this.idx);
  }

  clear(): void {
    this.path = [];
    this.idx = 0;
    this.goal = null;
  }

  /** Tiến dọc đường đi; trả về vị trí mới và vector di chuyển. */
  step(gx: number, gy: number, dist: number): { gx: number; gy: number; dx: number; dy: number; arrived: boolean } {
    let x = gx;
    let y = gy;
    let remaining = dist;
    let dx = 0;
    let dy = 0;
    while (remaining > 0 && this.idx < this.path.length) {
      const t = this.path[this.idx];
      const tx = t.gx + 0.5;
      const ty = t.gy + 0.5;
      const d = Math.hypot(tx - x, ty - y);
      if (d < 1e-6) {
        this.idx++;
        continue;
      }
      dx = (tx - x) / d;
      dy = (ty - y) / d;
      if (d <= remaining) {
        x = tx;
        y = ty;
        remaining -= d;
        this.idx++;
      } else {
        x += dx * remaining;
        y += dy * remaining;
        remaining = 0;
      }
    }
    return { gx: x, gy: y, dx, dy, arrived: this.done };
  }
}
