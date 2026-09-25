import * as THREE from 'three';

interface Fly {
  obj: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  arc: number;
  t: number;
  dur: number;
  quatFrom: THREE.Quaternion;
  quatTo: THREE.Quaternion;
  wobble: number;
  onDone?: () => void;
  tick?: (dt: number) => void;
  keep: boolean;
}

interface Floater {
  sprite: THREE.Sprite;
  t: number;
  y0: number;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Món bay (tween + cung + lắc nhẹ khi chạm) và chữ nổi "+$4.20" (object pool). */
export class Effects {
  readonly group = new THREE.Group();
  private flies: Fly[] = [];
  private floaters: Floater[] = [];
  private pool: THREE.Sprite[] = [];

  fly(obj: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, opts: {
    dur: number; arc?: number; quatTo?: THREE.Quaternion; wobble?: number; onDone?: () => void; keep?: boolean; tick?: (dt: number) => void;
  }): void {
    obj.position.copy(from);
    this.group.add(obj);
    this.flies.push({
      obj, from: from.clone(), to: to.clone(), arc: opts.arc ?? 0.12, t: 0, dur: Math.max(0.01, opts.dur),
      quatFrom: obj.quaternion.clone(), quatTo: opts.quatTo?.clone() ?? obj.quaternion.clone(), wobble: opts.wobble ?? 0,
      onDone: opts.onDone, keep: !!opts.keep, tick: opts.tick,
    });
  }

  private sprite(text: string, color: string): THREE.Sprite {
    const s = this.pool.pop() ?? new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    const g = c.getContext('2d')!;
    g.font = '900 60px "Nunito", Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = '#ffffff';
    g.strokeText(text, 128, 50);
    g.fillStyle = color;
    g.fillText(text, 128, 50);
    const mat = s.material as THREE.SpriteMaterial;
    mat.map?.dispose();
    mat.map = new THREE.CanvasTexture(c);
    mat.map.colorSpace = THREE.SRGBColorSpace;
    mat.opacity = 1;
    mat.needsUpdate = true;
    s.scale.set(0.5, 0.19, 1);
    s.renderOrder = 999;
    return s;
  }

  floatText(text: string, pos: THREE.Vector3, color = '#2a9d8f'): void {
    const s = this.sprite(text, color);
    s.position.copy(pos);
    this.group.add(s);
    this.floaters.push({ sprite: s, t: 0, y0: pos.y });
  }

  update(dt: number): void {
    for (let i = this.flies.length - 1; i >= 0; i--) {
      const f = this.flies[i];
      f.t += dt / f.dur;
      f.tick?.(dt);
      const k = easeOut(Math.min(1, f.t));
      f.obj.position.lerpVectors(f.from, f.to, k);
      f.obj.position.y += Math.sin(Math.min(1, f.t) * Math.PI) * f.arc;
      f.obj.quaternion.slerpQuaternions(f.quatFrom, f.quatTo, k);
      if (f.t >= 1) {
        if (f.wobble > 0 && f.t < 1.6) {
          const w = (f.t - 1) / 0.6;
          f.obj.rotation.z = Math.sin(w * Math.PI * 3) * f.wobble * (1 - w);
          continue;
        }
        this.flies.splice(i, 1);
        if (!f.keep) f.obj.removeFromParent();
        f.onDone?.();
      }
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const fl = this.floaters[i];
      fl.t += dt;
      fl.sprite.position.y = fl.y0 + easeOut(Math.min(1, fl.t / 1.4)) * 0.6;
      const s = 0.6 + Math.min(1, fl.t * 6) * 0.4;
      fl.sprite.scale.set(0.5 * s, 0.19 * s, 1);
      (fl.sprite.material as THREE.SpriteMaterial).opacity = fl.t < 0.9 ? 1 : Math.max(0, 1 - (fl.t - 0.9) / 0.6);
      if (fl.t > 1.5) {
        fl.sprite.removeFromParent();
        this.pool.push(fl.sprite);
        this.floaters.splice(i, 1);
      }
    }
  }

  get busy(): number {
    return this.flies.length;
  }
}
