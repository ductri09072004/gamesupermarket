import Phaser from 'phaser';
import { CHECKOUT_ZOOM, ZOOM_MAX, ZOOM_MIN } from '../../config/constants';
import type { Services } from '../../core/Services';
import { gridToScreen } from '../../iso/IsoMath';

/** Camera: follow người chơi, cuộn để zoom, kéo chuột phải/giữa để pan. */
export class CameraController {
  private cam: Phaser.Cameras.Scene2D.Camera;
  private panning = false;
  private panned = false;
  private last = { x: 0, y: 0 };
  private focusPoint: { x: number; y: number } | null = null;
  private savedZoom = 1;
  private targetZoom = 1;
  onZoom: (z: number) => void = () => {};

  constructor(scene: Phaser.Scene, private s: Services, private target: () => { gx: number; gy: number; moving: boolean }) {
    this.cam = scene.cameras.main;
    this.cam.setZoom(1.25);
    this.targetZoom = 1.25;
    const t = target();
    const p = gridToScreen(t.gx, t.gy);
    this.cam.centerOn(p.x, p.y);
    scene.input.mouse?.disableContextMenu();
    scene.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.focusPoint) return;
      this.targetZoom = Phaser.Math.Clamp(this.targetZoom * (dy > 0 ? 0.9 : 1.1), ZOOM_MIN, ZOOM_MAX);
    });
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown() || p.middleButtonDown()) {
        this.panning = true;
        this.last = { x: p.x, y: p.y };
      }
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.panning) return;
      if (!p.rightButtonDown() && !p.middleButtonDown()) {
        this.panning = false;
        return;
      }
      this.cam.scrollX -= (p.x - this.last.x) / this.cam.zoom;
      this.cam.scrollY -= (p.y - this.last.y) / this.cam.zoom;
      this.last = { x: p.x, y: p.y };
      this.panned = true;
    });
    scene.input.on('pointerup', () => { this.panning = false; });
  }

  get zoom(): number {
    return this.cam.zoom;
  }

  get follow(): boolean {
    return this.s.data.settings.cameraFollow;
  }

  toggleFollow(): void {
    this.s.data.settings.cameraFollow = !this.s.data.settings.cameraFollow;
    this.panned = false;
    this.s.bus.emit('toast', { message: `Camera theo người chơi: ${this.follow ? 'BẬT' : 'TẮT'}`, kind: 'info' });
  }

  focus(gx: number, gy: number): void {
    const p = gridToScreen(gx, gy);
    this.focusPoint = { x: p.x, y: p.y + 60 };
    this.savedZoom = this.targetZoom;
    this.targetZoom = CHECKOUT_ZOOM;
  }

  unfocus(): void {
    this.focusPoint = null;
    this.targetZoom = this.savedZoom;
    this.panned = false;
  }

  update(dtMs: number): void {
    const k = 1 - Math.pow(0.001, dtMs / 1000);
    if (Math.abs(this.cam.zoom - this.targetZoom) > 0.001) {
      this.cam.setZoom(Phaser.Math.Linear(this.cam.zoom, this.targetZoom, Math.min(1, k * 2)));
      this.onZoom(this.cam.zoom);
    }
    const t = this.target();
    if (t.moving) this.panned = false;
    let goal: { x: number; y: number } | null = null;
    if (this.focusPoint) goal = this.focusPoint;
    else if (this.follow && !this.panned) {
      const p = gridToScreen(t.gx, t.gy);
      goal = { x: p.x, y: p.y - 20 };
    }
    if (!goal) return;
    const cx = this.cam.scrollX + this.cam.width / 2;
    const cy = this.cam.scrollY + this.cam.height / 2;
    this.cam.centerOn(Phaser.Math.Linear(cx, goal.x, k), Phaser.Math.Linear(cy, goal.y, k));
  }
}
