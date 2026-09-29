import type { World } from './World';

/** Mở rộng cửa hàng: dựng lại mặt bằng, mặt tiền, thành phố (đường chính dịch theo), ánh sáng & biển hiệu. */
export function rebuildForExpansion(w: World): void {
  const s = w.s;
  const d = s.data;
  w.store.beginGrow();
  s.rebuildGrid();
  w.exterior.build(d.storeW, d.storeH);
  // đường chính dịch theo mặt tiền → xe đỗ phía trước cửa hàng dịch theo
  const dz = d.storeH - w.cityDepth;
  for (const v of d.vehicles) if (v.z > w.cityDepth - 1) v.z += dz;
  w.cityDepth = d.storeH;
  w.city.build(d.storeH, d.storeW);
  w.setInteractionRoots();
  s.bus.emit('vehicles:changed', {});
  w.decor.build(d.storeW, d.storeH);
  w.lighting.fit(d.storeW, d.storeH);
  const sp = s.grid.signPosition;
  w.sign.group.position.set(sp.x, 0, sp.z - 0.45);
  w.lights.layout();
  w.sound('thud');
}
