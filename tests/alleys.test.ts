import { describe, expect, it } from 'vitest';
import { ALLEY } from '../src/config/city';
import { alleyHeight, alleyLength, alleyPoint, groundAt } from '../src/world/Alleys';
import { cityLayout, houseRect, rectsOverlap } from '../src/world/CityLayout';

const L = cityLayout(10, 12);
const houses = L.placements.filter((p) => p.kind === 'building').map(houseRect);
const covered = (x: number, z: number) => houses.some((h) => x >= h.x0 - 0.05 && x <= h.x1 + 0.05 && z >= h.z0 - 0.05 && z <= h.z1 + 0.05);

describe('hẻm nhỏ giữa các nhà', () => {
  it('có hẻm thông hai đầu, hẻm cụt và ngõ nhánh', () => {
    const n = (k: string) => L.alleys.filter((a) => a.kind === k).length;
    expect(n('through')).toBeGreaterThanOrEqual(2);
    expect(n('dead')).toBeGreaterThanOrEqual(4);
    expect(n('branch')).toBeGreaterThanOrEqual(2);
  });

  it('hẻm rộng đủ 2 xe máy (1.5m), không đè nhà hay lòng đường', () => {
    for (const a of L.alleys) {
      const w = a.axis === 'z' ? a.rect.x1 - a.rect.x0 : a.rect.z1 - a.rect.z0;
      expect(w).toBeCloseTo(ALLEY.width, 5);
      for (const h of houses) expect(rectsOverlap(a.rect, h, -0.02)).toBe(false);
      for (const r of L.roads) expect(rectsOverlap(a.rect, r)).toBe(false);
    }
  });

  it('hẻm thông ra vỉa hè hai đầu; hẻm cụt bị bít bằng nhà ở đầu kín', () => {
    for (const a of L.alleys) {
      const len = alleyLength(a);
      const end = (s: number) => alleyPoint(a, s);
      if (a.kind === 'through') {
        // hai đầu mở: không có nhà chắn ngay phía ngoài (vỉa hè) — và hai bên sườn có nhà
        for (const s of [-0.8, len + 0.8]) {
          const p = end(s);
          expect(covered(p.x, p.z)).toBe(false);
        }
      }
      if (a.deadEnd) {
        const s = a.deadEnd === 'max' ? len + 0.8 : -0.8;
        const p = end(s);
        expect(covered(p.x, p.z), `${a.kind} cụt phải có nhà ở cuối`).toBe(true);
      }
    }
  });

  it('sàn hẻm có dốc lên xuống nhưng đi bộ được (≤ 20%), hai đầu nối phẳng với vỉa hè', () => {
    let high = 0;
    for (const a of L.alleys) {
      const len = alleyLength(a);
      let prev = alleyHeight(a, alleyPoint(a, 0).x, alleyPoint(a, 0).z);
      for (let s = 0.5; s <= len; s += 0.5) {
        const p = alleyPoint(a, s);
        const h = alleyHeight(a, p.x, p.z);
        expect(Math.abs(h - prev) / 0.5).toBeLessThan(0.2);
        high = Math.max(high, h);
        prev = h;
      }
      if (a.kind === 'through') {
        expect(alleyHeight(a, alleyPoint(a, 0).x, alleyPoint(a, 0).z)).toBeCloseTo(0, 5);
        expect(alleyHeight(a, alleyPoint(a, len).x, alleyPoint(a, len).z)).toBeCloseTo(0, 5);
      }
    }
    expect(high).toBeGreaterThan(0.4);
    // hẻm thông có đoạn cao rồi xuống lại
    const t = L.alleys.find((a) => a.kind === 'through')!;
    const hs = Array.from({ length: 20 }, (_, i) => alleyHeight(t, alleyPoint(t, (i / 19) * alleyLength(t)).x, alleyPoint(t, (i / 19) * alleyLength(t)).z));
    expect(Math.max(...hs)).toBeGreaterThan(hs[0] + 0.3);
    expect(Math.max(...hs)).toBeGreaterThan(hs[19] + 0.3);
  });

  it('groundAt: ngoài hẻm phẳng 0, trong hẻm theo dốc', () => {
    expect(groundAt(L.alleys, 0, 0)).toBe(0);
    const a = L.alleys.find((x) => alleyHeight(x, alleyPoint(x, alleyLength(x) / 2).x, alleyPoint(x, alleyLength(x) / 2).z) > 0.3)!;
    const p = alleyPoint(a, alleyLength(a) / 2);
    expect(groundAt(L.alleys, p.x, p.z)).toBeGreaterThan(0.3);
  });

  it('có dấu vết sinh hoạt trong hẻm: cây chậu, dây phơi, bàn thờ, ghế đẩu, xe máy', () => {
    const kinds = new Set(L.alleyDecor.map((d) => d.kind));
    for (const k of ['plant', 'laundry', 'shrine', 'trash']) expect(kinds.has(k as never)).toBe(true);
    const inAlley = (x: number, z: number) => L.alleys.some((a) => x >= a.rect.x0 - 0.01 && x <= a.rect.x1 + 0.01 && z >= a.rect.z0 - 0.01 && z <= a.rect.z1 + 0.01);
    const props = L.placements.filter((p) => p.kind === 'prop' && inAlley(p.x, p.z));
    expect(props.some((p) => p.model === 'vn_stool_red')).toBe(true);
    expect(props.some((p) => p.model === 'vn_scooter')).toBe(true);
  });
});
