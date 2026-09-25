import * as THREE from 'three';
import type { CheckoutController } from './Checkout';
import type { GameCtx } from './Ctx';

/** Chuột & bàn phím khi đứng quầy: click món / khay tiền / tiền thối / phím POS; Space, số, Enter, Backspace, Esc. */
export function bindCheckoutInput(ctrl: CheckoutController, c: GameCtx): void {
  const ray = new THREE.Raycaster();
  c.input.onMouseDown((e) => {
    const parts = ctrl.view?.counter;
    if (!ctrl.active || e.button !== 0 || !parts) return;
    const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    c.camera.updateMatrixWorld();
    ray.setFromCamera(ndc, c.camera);
    const ss = ctrl.session;
    const targets: THREE.Object3D[] = [...parts.trays, ...parts.posKeys, ...(ctrl.drawer?.givenMeshes() ?? [])];
    if (ss) for (const m of ss.meshes) if (m && m.userData.kind === 'beltItem') targets.push(m);
    const hit = ray.intersectObjects(targets, false)[0];
    if (!hit) return;
    const u = hit.object.userData as { kind?: string; index?: number; denom?: number; key?: string };
    if (u.kind === 'beltItem') ctrl.scan(u.index!);
    else if (u.kind === 'poskey') ctrl.posKey(u.key!);
    else if (u.kind === 'tray' && ss?.method === 'cash') {
      ctrl.drawer!.take(u.denom!, hit.object.getWorldPosition(new THREE.Vector3()));
      c.sound(u.denom! >= 1 ? 'paper' : 'coin');
      ctrl.refreshCash();
    } else if (u.kind === 'change') {
      ctrl.drawer!.remove(hit.object);
      c.sound('paper');
      ctrl.refreshCash();
    }
  });
  c.input.keys.onKey((e) => {
    if (!ctrl.active) return;
    const ss = ctrl.session;
    if (e.code === 'Escape') {
      e.preventDefault();
      ctrl.exit();
      return;
    }
    if (!ss) return;
    if (e.code === 'Space') {
      e.preventDefault();
      const i = ss.items.findIndex((it, k) => !it.scanned && ss.meshes[k]);
      if (i >= 0) ctrl.scan(i);
      return;
    }
    if (ss.method === 'cash') {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') ctrl.confirmCash();
      if (e.code === 'Backspace') {
        ctrl.drawer?.remove();
        ctrl.refreshCash();
      }
      return;
    }
    if (ss.method === 'card') {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') ctrl.posKey('enter');
      else if (e.code === 'Backspace') ctrl.posKey('back');
      else if (e.key === '.' || e.key === ',') ctrl.posKey('.');
      else if (/^[0-9]$/.test(e.key)) ctrl.posKey(e.key);
    }
  });
}
