import { describe, expect, it } from 'vitest';
import manifestJson from '../public/assets/manifest.json';
import credits from '../public/assets/CREDITS.md?raw';
import { BIKE_MODELS, DELIVERY_TRUCKS, NPC_CAR_MODELS, VARIANTS, getVariant, variantsOf } from '../src/config/fleet';
import { VEHICLES, getVehicle, vehicleDef } from '../src/config/vehicles';
import { createNewState } from '../src/core/GameState';
import { Services } from '../src/core/Services';

const files = new Set(Object.keys(import.meta.glob('../public/assets/models/city/*.glb', { query: '?url' })).map((k) => k.replace('../public/assets/models/', '')));
const city = (manifestJson as unknown as { city: string[] }).city;

describe('đội xe cổ', () => {
  it('mỗi loại xe có ≥ 2 kiểu để chọn khi mua (xe máy 4, bán tải 2)', () => {
    for (const v of VEHICLES) expect(variantsOf(v.id).length, v.id).toBeGreaterThanOrEqual(2);
    expect(variantsOf('moto')).toHaveLength(4);
    expect(variantsOf('pickup').map((v) => v.id).sort()).toEqual(['peugeot404', 'uaz469']);
  });

  it('mọi model của kiểu xe / xe NPC / xe máy / xe tải đều có file, khai báo trong manifest và ghi credit', () => {
    const models = [...VARIANTS.map((v) => v.model), ...BIKE_MODELS.map((b) => b.model), ...DELIVERY_TRUCKS.map((t) => t.model)];
    for (const m of new Set(models)) {
      expect(files.has(`city/${m}.glb`), `file ${m}`).toBe(true);
      expect(city.includes(`city/${m}.glb`), `manifest ${m}`).toBe(true);
      expect(credits.includes(`models/city/${m}.glb`), `credit ${m}`).toBe(true);
    }
  });

  it('ô tô NPC dùng đúng bộ ô tô người chơi có thể mua (kèm UAZ); có 3 kiểu xe tải giao hàng', () => {
    const ids = NPC_CAR_MODELS.map((v) => v.id);
    for (const v of variantsOf('car')) expect(ids).toContain(v.id);
    expect(ids).toContain('uaz469');
    expect(DELIVERY_TRUCKS.map((t) => t.model).sort()).toEqual(['truck_gaz66', 'truck_supply', 'truck_zil131']);
  });

  it('thông số từng xe lấy theo kiểu đã chọn; kiểu lạ / thiếu → kiểu đầu tiên', () => {
    const d = vehicleDef({ type: 'pickup', variant: 'peugeot404' });
    expect(d.name).toBe('Peugeot 404 bạt');
    expect(d.size).toEqual(getVariant('pickup', 'peugeot404').size);
    expect(d.capacity).toBe(getVehicle('pickup').capacity);
    expect(vehicleDef({ type: 'moto' }).name).toBe(variantsOf('moto')[0].name);
    expect(getVariant('car', 'khong-co').id).toBe(variantsOf('car')[0].id);
  });

  it('mua xe theo kiểu: giá nhân theo hệ số kiểu, lưu variant vào xe', () => {
    const s = new Services(createNewState(1));
    s.data.money = 1_000_000;
    s.data.level = 10;
    const spot = { x: 0, z: 0, yaw: 0 };
    const cad = getVariant('car', 'cadillac');
    const r = s.vehicles.buy('car', spot, 'cadillac');
    expect(r.ok).toBe(true);
    expect(r.vehicle?.variant).toBe('cadillac');
    expect(1_000_000 - s.data.money).toBe(Math.round(getVehicle('car').price * cad.priceMul));
    // chỉ được 1 xe mỗi loại
    expect(s.vehicles.buy('car', spot, 'volga').ok).toBe(false);
  });

  it('chỗ xếp thùng đủ cho sức chở của loại xe', () => {
    for (const k of VARIANTS) {
      const slots = k.cargo.cols * k.cargo.rows * k.cargo.layers;
      const cap = getVehicle(k.type).capacity;
      // ô tô/bán tải đếm theo suất (thùng to = 2) nên số ô ≥ capacity / 2; xe máy đếm theo thùng
      expect(slots, k.id).toBeGreaterThanOrEqual(k.type === 'moto' ? cap : Math.ceil(cap / 2));
    }
  });
});
