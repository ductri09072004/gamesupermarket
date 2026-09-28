import { SCOOTER_FILTERS, SIDEWALK_BIKES, STREET_LIFE, VENDOR_HOURS, VN_PROPS, type VendorShift, type VnProp } from '../config/city';
import type { Rng } from '../core/Random';
import type { AABB } from './Colliders';
import { footprint, rectsOverlap, type Placement, type Rect } from './CityLayout';

type AddSolid = (r: Rect, tag: string) => void;

/** Vùng sạp hàng rong chiếm cả vỉa hè; `curb`: z mép lề, `dir`: +1 nếu lòng đường ở phía +Z. */
export type StallArea = Rect & { curb: number; dir: number };

/** Vỉa hè phía cửa hàng: khách đi lại trong lưới NavGrid ở khoảng X này → không đặt gì cản đường. */
const STORE_ZONE = { x0: -8.2, x1: 32 };

interface Side {
  facade: number;
  /** +1: vỉa hè phía cửa hàng (đường ở +Z); -1: bên kia đường */
  dir: number;
  rot: number;
  stalls: Array<{ x: number; shift: VendorShift }>;
  parking: Array<[number, number]>;
  store: boolean;
}

/**
 * Đời sống vỉa hè kiểu Việt Nam: hàng rong theo giờ (xôi/bánh mì sáng, chợ cóc, dừa chiều, hủ tiếu tối, cà phê võng),
 * xe máy dựng kín mặt tiền & tràn xuống lòng đường. Trả về vùng các sạp (để cột điện né).
 */
export function streetLife(rng: Rng, F: number, roadHalf: number, colliders: AABB[], out: Placement[], addSolid: AddSolid): StallArea[] {
  const stallAreas: StallArea[] = [];
  const blocked = (r: Rect) => stallAreas.some((s) => rectsOverlap(s, r, 0.1))
    || colliders.some((c) => rectsOverlap({ x0: c.minX, x1: c.maxX, z0: c.minZ, z1: c.maxZ }, r, 0.12));
  const put = (model: VnProp, x: number, z: number, rot: number, o: { solid?: boolean; variant?: number; y?: number; hours?: readonly [number, number]; force?: boolean } = {}): boolean => {
    const [w, , d] = VN_PROPS[model];
    const r = footprint(x, z, w, d, rot);
    if (!o.force && blocked(r)) return false;
    out.push({ kind: 'prop', model, x, z, rot, variant: o.variant ?? 0, y: o.y, hours: o.hours ? [o.hours[0], o.hours[1]] : undefined });
    if (o.solid) addSolid(r, 'streetlife');
    return true;
  };
  const bike = (x: number, z: number, rot: number, solid = true) =>
    put('vn_scooter', x, z, rot + (rng() - 0.5) * 0.35, { solid, variant: Math.floor(rng() * SCOOTER_FILTERS.length) });

  const sides: Side[] = [
    { facade: F - 3, dir: 1, rot: 0, ...STREET_LIFE.near, store: true },
    { facade: F + 2 * roadHalf + 3, dir: -1, rot: Math.PI, ...STREET_LIFE.far, store: false },
  ];
  for (const s of sides) {
    const at = (depth: number) => s.facade + s.dir * depth;
    const curb = at(3);
    for (const st of s.stalls) {
      const hours = VENDOR_HOURS[st.shift];
      const area = { x0: st.x - 3.2, x1: st.x + 3.2, z0: Math.min(s.facade, curb), z1: Math.max(s.facade, curb), curb, dir: s.dir };
      if (s.store && area.x1 > STORE_ZONE.x0 && area.x0 < STORE_ZONE.x1) continue;
      stallAreas.push(area);
      stall(st.shift, st.x);
      function stall(shift: VendorShift, x: number): void {
        const o = { hours, force: true };
        const stools = (cx: number, n: number) => {
          for (let i = 0; i < n; i++) {
            const sx = cx - 1.2 + (i % 3) * 1.2 + (rng() - 0.5) * 0.25;
            const sz = at(1.7 + Math.floor(i / 3) * 0.65 + (rng() - 0.5) * 0.15);
            if (rng() < 0.15) continue;
            put(rng() < 0.65 ? 'vn_stool_red' : 'vn_stool_blue', sx, sz, rng() * Math.PI, o);
          }
        };
        switch (shift) {
          case 'morning': // xe xôi – bánh mì, rổ bánh mì trên bàn nhựa
            put('vn_banhmi_cart', x, at(0.75), s.rot, o);
            put('vn_table', x + 1.6, at(1.1), s.rot, o);
            put('vn_bread_basket', x + 1.6, at(1.1), s.rot + 0.4, { ...o, y: 0.45 });
            stools(x, 6);
            break;
          case 'evening': // hủ tiếu gõ: xe + 2 bàn thấp quây ghế
            put('vn_hutieu_cart', x, at(0.9), s.rot, o);
            for (const dx of [-1.4, 1.4]) put('vn_table', x + dx, at(2.1), s.rot, o);
            stools(x, 6);
            break;
          case 'afternoon': // dừa tươi chất trên bàn
            put('vn_table', x, at(1.2), s.rot, o);
            for (let i = 0; i < 7; i++) put('vn_coconut', x - 0.25 + (i % 4) * 0.17, at(1.12 + Math.floor(i / 4) * 0.16), rng() * 6, { ...o, y: 0.45 + (i >= 4 ? 0.02 : 0) });
            stools(x, 3);
            break;
          case 'market': // chợ cóc: sạp thịt sát mặt tiền, rau củ bày kín vỉa hè
            put('vn_meat_stall', x - 1.8, at(0.9), s.rot, o);
            put('vn_veg_market', x + 2.2, at(1.45), s.rot, o);
            break;
          case 'allday': // cà phê võng
            put('vn_hammock', x - 0.6, at(1.3), s.rot, o);
            put('vn_table', x + 2, at(1.3), s.rot, o);
            stools(x + 2, 3);
            break;
        }
      }
    }
    // bãi xe máy đỗ vuông góc lề, đầu xe quay ra đường
    for (const [x0, x1] of s.parking) {
      for (let x = x0; x < x1; x += 0.8 + rng() * 0.15) if (rng() > 0.2) bike(x, curb - s.dir * 1.05, s.rot);
    }
    // lấn chiếm vỉa hè: xe dựng dọc sát mặt tiền cửa hiệu (chừa lối đi giữa vỉa hè cho người đi bộ)
    // + xe đỗ vuông góc tràn nửa xuống lòng đường
    for (let x = -33; x < 58; x += 1.2 + rng() * 0.35) {
      if (s.store && x > STORE_ZONE.x0 - 1 && x < STORE_ZONE.x1 + 1) continue;
      if (rng() < SIDEWALK_BIKES.facadeChance) bike(x, at(0.36), s.rot + (rng() < 0.5 ? 1 : -1) * Math.PI / 2, false);
      // chỗ có sạp, người đi bộ phải bước xuống đường → không đỗ tràn ở đó
      const nearStall = stallAreas.some((a) => a.dir === s.dir && x > a.x0 - 3.5 && x < a.x1 + 3.5);
      if (!nearStall && rng() < SIDEWALK_BIKES.spillChance) bike(x + 0.3, curb + s.dir * 0.25, s.rot);
    }
  }
  return stallAreas;
}
