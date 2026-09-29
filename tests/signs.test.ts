import { describe, expect, it } from 'vitest';
import manifestJson from '../public/assets/manifest.json';
import credits from '../public/assets/CREDITS.md?raw';
import { SHOP_NAMES, SHOP_SIGNS } from '../src/config/city';
import { SIGN_WEAR } from '../src/world/SignWear';

describe('biển hiệu', () => {
  const files = new Set(Object.keys(import.meta.glob('../public/assets/**/*.{glb,png,woff2}', { query: '?url' })).map((k) => k.replace('../public/assets/', '')));

  const fontFiles = new Set(Object.keys(import.meta.glob('../public/assets/fonts/*.woff2', { query: '?url' })).map((k) => k.replace('../public/assets/', '')));

  it('mọi tên tiệm đều có kiểu biển riêng', () => {
    for (const n of SHOP_NAMES) expect(SHOP_SIGNS[n], n).toBeDefined();
  });

  it('model biển/mái hiên khai báo có file và ghi tác giả (CC-BY)', () => {
    const city = (manifestJson as unknown as { city: string[] }).city.filter((c) => c.startsWith('city/sign_') || c.startsWith('city/awning_'));
    expect(city.length).toBeGreaterThan(0);
    for (const c of city) {
      expect(files.has(`models/${c}`), c).toBe(true);
      expect(credits.includes(`models/${c}`), `credit ${c}`).toBe(true);
    }
  });

  it('ảnh vết gỉ và phông chữ có đủ bộ ký tự tiếng Việt', () => {
    for (const w of SIGN_WEAR) expect(files.has(`textures/signs/${w}.png`), w).toBe(true);
    for (const w of ['fonts/BeVietnamPro-800-vietnamese.woff2', 'fonts/Baloo2-800-vietnamese.woff2', 'fonts/Lobster-400-vietnamese.woff2', 'fonts/AlfaSlabOne-400-vietnamese.woff2']) {
      expect(fontFiles.has(w), w).toBe(true);
    }
  });
});
