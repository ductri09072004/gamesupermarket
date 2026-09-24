import Phaser from 'phaser';
import type { Services } from '../../core/Services';
import { DEPTH_UI } from '../../iso/DepthSort';
import { gridToScreen } from '../../iso/IsoMath';

/** Chữ bay (+$4.20) có object pool + hạt lấp lánh. */
export class Effects {
  private pool: Phaser.GameObjects.Text[] = [];
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private offs: Array<() => void> = [];

  constructor(private scene: Phaser.Scene, s: Services) {
    this.emitter = scene.add.particles(0, 0, 'sparkle', {
      speed: { min: 60, max: 160 },
      angle: { min: 200, max: 340 },
      gravityY: 300,
      lifespan: 700,
      scale: { start: 1, end: 0.2 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      emitting: false,
    }).setDepth(DEPTH_UI - 5);
    this.offs.push(
      s.bus.on('sale', ({ amount, gx, gy }) => {
        this.floatText(`+$${amount.toFixed(2)}`, gx, gy, '#2a9d8f');
        this.burst(gx, gy, 14);
      }),
      s.bus.on('float:text', ({ text, gx, gy, color }) => this.floatText(text, gx, gy, color ?? '#3d3551')),
    );
  }

  private acquire(): Phaser.GameObjects.Text {
    const t = this.pool.pop();
    if (t) return t.setVisible(true).setActive(true);
    return this.scene.add.text(0, 0, '', {
      fontFamily: 'Nunito, sans-serif', fontSize: '18px', fontStyle: '900', stroke: '#ffffff', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(DEPTH_UI).setResolution(2);
  }

  floatText(text: string, gx: number, gy: number, color: string): void {
    const p = gridToScreen(gx, gy);
    const t = this.acquire();
    t.setText(text).setColor(color).setPosition(p.x, p.y - 50).setAlpha(1).setScale(0.6);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.Out' });
    this.scene.tweens.add({
      targets: t, y: p.y - 110, alpha: 0, duration: 1200, delay: 250, ease: 'Cubic.Out',
      onComplete: () => {
        t.setVisible(false).setActive(false);
        this.pool.push(t);
      },
    });
  }

  burst(gx: number, gy: number, n: number): void {
    const p = gridToScreen(gx, gy);
    this.emitter.explode(n, p.x, p.y - 40);
  }

  destroy(): void {
    this.offs.forEach((o) => o());
    this.pool.forEach((t) => t.destroy());
    this.emitter.destroy();
  }
}
