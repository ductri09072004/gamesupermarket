import * as THREE from 'three';

/** Bong bóng suy nghĩ dạng sprite billboard phía trên đầu. */
export class Bubble {
  readonly sprite: THREE.Sprite;
  private canvas = document.createElement('canvas');
  private tex: THREE.CanvasTexture;
  private hideAt = 0;
  private text = '';

  constructor(parent: THREE.Object3D, height = 2.0) {
    this.canvas.width = 256;
    this.canvas.height = 128;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false }));
    this.sprite.scale.set(0.55, 0.275, 1);
    this.sprite.position.y = height;
    this.sprite.visible = false;
    this.sprite.renderOrder = 10;
    parent.add(this.sprite);
  }

  show(text: string, ms = 1800, now = performance.now()): void {
    this.hideAt = ms > 0 ? now + ms : Infinity;
    this.sprite.visible = true;
    if (text === this.text) return;
    this.text = text;
    const g = this.canvas.getContext('2d')!;
    g.clearRect(0, 0, 256, 128);
    g.font = '800 34px "Nunito", "Segoe UI Emoji", Arial';
    const w = Math.min(244, Math.max(80, g.measureText(text).width + 36));
    const x = 128 - w / 2;
    g.fillStyle = 'rgba(255,255,255,0.96)';
    g.strokeStyle = '#3d3551';
    g.lineWidth = 4;
    g.beginPath();
    g.roundRect(x, 8, w, 80, 24);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(118, 86);
    g.lineTo(128, 108);
    g.lineTo(138, 86);
    g.fill();
    g.fillStyle = '#3d3551';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 128, 50, 230);
    this.tex.needsUpdate = true;
  }

  hide(): void {
    this.sprite.visible = false;
  }

  update(now = performance.now()): void {
    if (this.sprite.visible && now > this.hideAt) this.sprite.visible = false;
  }
}
