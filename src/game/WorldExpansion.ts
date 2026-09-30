import type { World } from './World';

/** Mở rộng cửa hàng: vách lùi ra sau / sang phải trong vỏ nhà cố định; dựng lại lưới, trang trí, ánh sáng & biển hiệu (phố đứng yên). */
export function rebuildForExpansion(w: World): void {
  const s = w.s;
  const d = s.data;
  w.store.beginGrow();
  s.rebuildGrid();
  w.exterior.build(d.storeW);
  w.setInteractionRoots();
  w.decor.build(d.storeW, d.storeH);
  w.lighting.fit(d.storeW, d.storeH);
  const sp = s.grid.signPosition;
  w.sign.group.position.set(sp.x, 0, sp.z - 0.45);
  w.lights.layout();
  w.sound('thud');
}
