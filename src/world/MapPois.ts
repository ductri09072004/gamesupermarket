import { STREET_NAMES } from '../config/city';
import { DOOR_X, STORE_FRONT_Z } from '../config/constants';
import { vehicleDef } from '../config/vehicles';
import { getVariant } from '../config/fleet';
import type { CityLayout } from './CityLayout';
import { V_ROADS } from './CityLayout';

/** Địa điểm trên bản đồ (có thể bấm để chỉ đường). */
export interface Poi {
  id: string;
  label: string;
  group: 'main' | 'cross' | 'alley' | 'vehicle';
  x: number;
  z: number;
}

export interface PoiContext {
  vehicles: Array<{ uid: string; type: string; variant?: string; x: number; z: number }>;
}

/** Danh sách địa điểm: cửa hàng, kho sỉ, trạm buýt, chỗ đỗ xe, xe của bạn, ngã tư, đầu các hẻm. */
export function mapPois(L: CityLayout, ctx: PoiContext): Poi[] {
  const out: Poi[] = [];
  const front = STORE_FRONT_Z;
  out.push({ id: 'store', label: 'Tạp Hoá Đầu Hẻm (cửa hàng)', group: 'main', x: DOOR_X, z: front + 1.6 });
  const pad = L.depot.pad;
  out.push({ id: 'depot', label: 'Kho sỉ (bãi lấy hàng)', group: 'main', x: (pad.x0 + pad.x1) / 2, z: (pad.z0 + pad.z1) / 2 });
  out.push({ id: 'kiosk', label: 'Quầy mua sỉ ở kho', group: 'main', x: L.depot.kiosk.x, z: L.depot.kiosk.z + 1.2 });
  const bs = L.busStop.shelter;
  out.push({ id: 'bus', label: 'Trạm xe buýt', group: 'main', x: (bs.x0 + bs.x1) / 2, z: bs.z1 + 0.6 });
  out.push({ id: 'park', label: 'Chỗ đỗ xe trước cửa hàng', group: 'main', x: L.frontSpots[0].x, z: L.roads[1].z0 - 0.8 });
  for (const v of ctx.vehicles) {
    out.push({ id: `veh:${v.uid}`, label: `Xe của bạn — ${getVariant(v.type, v.variant)?.name ?? vehicleDef(v).name}`, group: 'vehicle', x: v.x, z: v.z });
  }
  // ngã tư
  V_ROADS.forEach((X, i) => L.hz.forEach((Z, j) => {
    out.push({ id: `x:${i}:${j}`, label: `Ngã tư ${STREET_NAMES.horizontal[j]} – ${STREET_NAMES.vertical[i]}`, group: 'cross', x: X, z: Z });
  }));
  // đầu hẻm (theo biển "HẺM n"): tâm hẻm cách biển 1.25m, lùi ra vỉa hè 1m
  for (const p of L.signs.plates) {
    if (p.style !== 'alley' || !/^HẺM \d+$/.test(p.line1)) continue;
    const dir = Math.cos(p.rot) < 0 ? -1 : 1; // rot π: biển hướng -z (đầu phía bắc)
    out.push({ id: `a:${p.line1}:${p.line2}`, label: `${p.line1} ${p.line2 ? `· ${p.line2}` : ''}`.trim(), group: 'alley', x: p.x - 1.25, z: p.z + dir * 1.0 });
  }
  return out;
}
