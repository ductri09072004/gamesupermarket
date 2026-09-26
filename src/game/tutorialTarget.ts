import * as THREE from 'three';
import type { World } from './World';

/** Vật cần tới ở bước hướng dẫn hiện tại (mũi tên vàng). */
export function tutorialTarget(w: World): THREE.Vector3 | null {
  const t = w.s.data.tutorial;
  if (t.dismissed) return null;
  const steps = ['pc', 'order', 'pickup', 'stock', 'price', 'open', 'checkout'];
  const step = steps.find((k) => !t[k]);
  if (!step) return null;
  const find = (kind: string) => w.s.data.furniture.find((f) => w.furniture.get(f.uid)?.def.kind === kind);
  const top = (uid: string | undefined) => {
    const v = uid ? w.furniture.get(uid) : undefined;
    return v ? v.toWorld(new THREE.Vector3(0, v.def.size.h + 0.45, 0)) : null;
  };
  switch (step) {
    case 'pc': case 'order': return top(find('computer')?.uid);
    case 'pickup': {
      if (w.held.box) return null;
      const b = w.s.data.boxes.find((x) => x.location === 'floor');
      return b ? new THREE.Vector3(b.gx, 0.4, b.gy) : null;
    }
    case 'stock': case 'price': return top(find('display')?.uid);
    case 'open': return w.sign.group.position.clone().setY(1.6);
    case 'checkout': return w.s.data.storeOpen ? top(find('checkout')?.uid) : null;
  }
  return null;
}
