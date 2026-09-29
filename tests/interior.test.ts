import { describe, expect, it } from 'vitest';
import manifestJson from '../public/assets/manifest.json';
import credits from '../public/assets/CREDITS.md?raw';
import { SEASON } from '../src/config/constants';
import { tetSeason } from '../src/systems/SeasonSystem';

describe('mùa Tết', () => {
  it('bật những ngày cuối năm và đầu năm, tắt ở giữa; lặp theo chu kỳ', () => {
    const on = Array.from({ length: SEASON.yearDays }, (_, i) => tetSeason(i + 1));
    expect(on.filter(Boolean).length).toBe(SEASON.tetBefore + SEASON.tetAfter);
    expect(tetSeason(1)).toBe(true);
    expect(tetSeason(SEASON.yearDays)).toBe(true);
    expect(tetSeason(15)).toBe(false);
    expect(tetSeason(1 + SEASON.yearDays * 3)).toBe(true);
    expect(tetSeason(0)).toBe(tetSeason(1));
  });
});

describe('model & texture nội thất', () => {
  const manifest = manifestJson as unknown as { props: string[]; textures: Record<string, { maps: Record<string, string> }> };
  // đường dẫn tương đối trong public/assets của mọi file glb/jpg có thật
  const files = new Set(Object.keys(import.meta.glob('../public/assets/**/*.{glb,jpg}', { query: '?url' })).map((k) => k.replace('../public/assets/', '')));

  it('mọi prop khai báo trong manifest đều có file', () => {
    for (const p of manifest.props) expect(files.has(`models/${p}`), p).toBe(true);
  });

  it('mọi model in_*.glb có ghi tác giả trong CREDITS (CC-BY bắt buộc)', () => {
    for (const p of manifest.props.filter((x) => x.startsWith('props/in_'))) expect(credits.includes(p.replace('props/', 'models/props/')), p).toBe(true);
  });

  it('mọi texture PBR trong manifest có file và có credit', () => {
    for (const [slot, t] of Object.entries(manifest.textures)) {
      for (const path of Object.values(t.maps)) {
        expect(files.has(path), `${slot}: ${path}`).toBe(true);
        expect(credits.includes(path), `credit ${path}`).toBe(true);
      }
    }
  });
});
