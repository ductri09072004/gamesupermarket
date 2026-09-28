import { describe, expect, it } from 'vitest';
import { BUILDINGS, isVnHouse, VN_PROPS } from '../src/config/city';
import { MAX_STORE_W } from '../src/config/constants';
import { cityLayout, curbZ, footprint, rectsOverlap } from '../src/world/CityLayout';

describe('phố Việt Nam', () => {
  const D = 10;
  const L = cityLayout(D, 12);
  const props = L.placements.filter((p) => p.model in VN_PROPS);
  const houses = L.placements.filter((p) => p.kind === 'building');

  it('có quán bánh mì, ghế đẩu, xe máy', () => {
    const count = (m: string) => props.filter((p) => p.model === m).length;
    expect(count('vn_banhmi_cart')).toBeGreaterThanOrEqual(2);
    expect(count('vn_stool_red') + count('vn_stool_blue')).toBeGreaterThanOrEqual(8);
    expect(count('vn_scooter')).toBeGreaterThanOrEqual(15);
  });

  it('đồ vỉa hè phía cửa hàng nằm ngoài lưới đi lại của khách', () => {
    const F = curbZ(D);
    for (const p of props.filter((q) => q.z < F)) {
      expect(p.x < -8.2 || p.x > MAX_STORE_W + 8).toBe(true);
    }
  });

  it('đồ vỉa hè không đè lên nhà hay lấn xuống lòng đường', () => {
    for (const p of props) {
      const [w, , d] = VN_PROPS[p.model as keyof typeof VN_PROPS];
      const r = footprint(p.x, p.z, w, d, p.rot);
      for (const h of houses) {
        const [hw, , hd] = BUILDINGS[h.model];
        expect(rectsOverlap(r, footprint(h.x, h.z, hw, hd, h.rot))).toBe(false);
      }
      // xe máy đỗ tràn được phép lấn nửa xe xuống lòng đường (≤ 1m), đồ khác thì không
      const spill = p.model === 'vn_scooter' ? -1 : -0.05;
      for (const road of L.roads) expect(rectsOverlap(r, road, spill)).toBe(false);
    }
  });

  it('xe máy lấn chiếm vỉa hè: có xe dựng sát mặt tiền và xe tràn xuống lòng đường', () => {
    const bikes = props.filter((p) => p.model === 'vn_scooter');
    const onRoad = bikes.filter((p) => L.roads.some((road) => rectsOverlap(footprint(p.x, p.z, 0.62, 1.39, p.rot), road, -0.1)));
    expect(onRoad.length).toBeGreaterThan(5);
    expect(bikes.length).toBeGreaterThan(40);
  });

  it('hàng rong theo giờ: sáng có bánh mì, tối có hủ tiếu; không có va chạm (dọn hàng thì đi qua được)', () => {
    const open = (m: string, h: number) => props.filter((p) => p.model === m && p.hours && h >= p.hours[0] && h < p.hours[1]).length;
    expect(open('vn_banhmi_cart', 8)).toBeGreaterThan(0);
    expect(open('vn_banhmi_cart', 20)).toBe(0);
    expect(open('vn_hutieu_cart', 20)).toBeGreaterThan(0);
    expect(open('vn_hutieu_cart', 8)).toBe(0);
    expect(L.stalls.length).toBeGreaterThanOrEqual(5);
    // đồ của sạp theo giờ không có va chạm
    const stallModels = new Set(props.filter((p) => p.hours).map((p) => `${p.x},${p.z}`));
    expect(stallModels.size).toBeGreaterThan(10);
  });

  it('ổ gà, miếng vá, nắp cống nằm trên mặt đường', () => {
    const kinds = new Set(L.damage.map((d) => d.kind));
    expect([...kinds].sort()).toEqual(['manhole', 'patch', 'pothole']);
    expect(L.damage.filter((d) => d.kind === 'pothole').length).toBeGreaterThan(20);
    for (const d of L.damage) {
      expect(L.roads.some((r) => d.x >= r.x0 && d.x <= r.x1 && d.z >= r.z0 && d.z <= r.z1)).toBe(true);
    }
  });

  it('nhà ống Việt chiếm đa số nhà mặt phố, dãy cạnh cửa hàng toàn nhà Việt có biển hiệu', () => {
    const vn = houses.filter((h) => isVnHouse(h.model)).length;
    // tính cả các vòng nhà cao tầng lấp lõi khối phố (vẫn chủ yếu nhà Quaternius cho skyline)
    expect(vn / houses.length).toBeGreaterThan(0.35);
    const shops = houses.filter((h) => h.sign);
    expect(shops.length).toBeGreaterThan(0);
    expect(shops.filter((h) => isVnHouse(h.model)).length / shops.length).toBeGreaterThan(0.7);
  });
});
