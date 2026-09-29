import { describe, expect, it } from 'vitest';
import manifestJson from '../public/assets/manifest.json';
import { FURNITURE, getFurniture } from '../src/config/furniture';
import { createNewState } from '../src/core/GameState';
import { itemLayout, slotBox, tierHeights } from '../src/systems/SlotLayout';
import { getProduct } from '../src/config/products';

const near = (a: number, b: number, tol = 0.03) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe('kệ & tủ cổ (model Sketchfab)', () => {
  it('mặt các tầng khớp mặt ván đo được trên model (đã co giãn theo kích thước nội thất)', () => {
    // model gốc: ván ở 0.30/0.75/1.23 (pantry, cao 1.229 → 1.15); 1.05…2.07 (hutch, cao 2.221 → 2.5); 0.8/1.4/2.0/2.55 (ladder, cao 2.6 → 2.4)
    const p = tierHeights(getFurniture('shelf_pantry'));
    [0.3, 0.75, 1.23].forEach((y, i) => near(p[i], (y * 1.15) / 1.229));
    const h = tierHeights(getFurniture('shelf_hutch'));
    [1.05, 1.3, 1.56, 1.81, 2.07].forEach((y, i) => near(h[i], (y * 2.5) / 2.221, 0.05));
    const l = tierHeights(getFurniture('shelf_ladder'));
    [0.8, 1.4, 2.0, 2.55].forEach((y, i) => near(l[i], (y * 2.4) / 2.6, 0.03));
  });

  it('ngăn nằm gọn trong thân kệ; kệ tủ có ngăn nông ở nửa sau', () => {
    for (const id of ['shelf_pantry', 'shelf_hutch', 'shelf_ladder', 'fridge_coke', 'freezer_chest']) {
      const def = getFurniture(id);
      for (let i = 0; i < def.slots; i++) {
        const b = slotBox(def, i);
        expect(b.x0).toBeGreaterThanOrEqual(-def.size.w / 2 - 1e-6);
        expect(b.x0 + b.width).toBeLessThanOrEqual(def.size.w / 2 + 1e-6);
        expect(b.zFront).toBeGreaterThanOrEqual(-def.size.d / 2 - 1e-6);
        expect(b.zFront + b.depth).toBeLessThanOrEqual(def.size.d / 2 + 1e-6);
        expect(b.height).toBeGreaterThan(0.15);
      }
    }
    const hutch = slotBox(getFurniture('shelf_hutch'), 0);
    expect(hutch.zFront).toBeGreaterThan(0);
  });

  it('mỗi ngăn xếp được ít nhất vài món', () => {
    for (const id of ['shelf_pantry', 'shelf_hutch', 'shelf_ladder']) {
      expect(itemLayout(getFurniture(id), getProduct('noodles')).capacity).toBeGreaterThanOrEqual(3);
    }
    expect(itemLayout(getFurniture('fridge_coke'), getProduct('milk')).capacity).toBeGreaterThanOrEqual(3);
    expect(itemLayout(getFurniture('freezer_chest'), getProduct('icecream')).capacity).toBeGreaterThanOrEqual(3);
  });

  it('mẫu cũ chỉ còn trong bản lưu, cửa hàng mua sắm bán mẫu cổ; ván mở đầu dùng mẫu cổ', () => {
    const legacy = FURNITURE.filter((f) => f.legacy).map((f) => f.id).sort();
    expect(legacy).toEqual(['fridge', 'freezer', 'shelf_large', 'shelf_small'].sort());
    const types = createNewState(1).furniture.map((f) => f.type);
    expect(types).toContain('shelf_hutch');
    expect(types).toContain('fridge_coke');
    expect(types.some((t) => getFurniture(t).legacy)).toBe(false);
  });

  it('model có trong manifest và có file', () => {
    const files = new Set(Object.keys(import.meta.glob('../public/assets/models/**/*.glb', { query: '?url' })).map((k) => k.replace('../public/assets/', '')));
    const m = manifestJson as unknown as { models: string[]; props: string[] };
    for (const f of ['furniture/shelf_pantry.glb', 'furniture/shelf_hutch.glb', 'furniture/shelf_ladder.glb']) expect(m.models, f).toContain(f);
    for (const f of ['props/old_fridge_coke.glb', 'props/old_freezer_chest.glb']) expect(m.props, f).toContain(f);
    for (const f of [...m.models, ...m.props]) expect(files.has(`models/${f}`), f).toBe(true);
  });
});
