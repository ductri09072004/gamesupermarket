import { describe, expect, it } from 'vitest';
import manifestJson from '../public/assets/manifest.json';
import credits from '../public/assets/CREDITS.md?raw';
import { CUSTOMER_MODELS, FEMALE_MODELS, SHARED_CLIPS, STAFF_MODELS } from '../src/config/characters';
import { STAFF_ROLES } from '../src/config/staff';

describe('nhân vật Mixamo', () => {
  const listed = new Set((manifestJson as unknown as { characters: string[] }).characters.map((p) => p.replace('characters/', '').replace('.glb', '')));
  const files = new Set(Object.keys(import.meta.glob('../public/assets/models/characters/*.glb', { query: '?url' })).map((k) => k.split('/').pop()!.replace('.glb', '')));

  it('bộ clip chung và mọi nhân vật khách / nhân viên được khai báo và có file', () => {
    expect(listed.has(SHARED_CLIPS.file)).toBe(true);
    for (const m of [...CUSTOMER_MODELS, ...Object.values(STAFF_MODELS)]) {
      expect(listed.has(m), m).toBe(true);
      expect(files.has(m), m).toBe(true);
    }
    expect(files.has(SHARED_CLIPS.file)).toBe(true);
  });

  it('mỗi vai trò nhân viên có một model riêng', () => {
    for (const role of Object.keys(STAFF_ROLES)) expect(STAFF_MODELS[role as keyof typeof STAFF_MODELS], role).toBeTruthy();
    expect(new Set(Object.values(STAFF_MODELS)).size).toBe(Object.keys(STAFF_ROLES).length);
  });

  it('model nữ nằm trong danh sách nhân vật và có ghi nguồn Mixamo', () => {
    const all = new Set([...CUSTOMER_MODELS, ...Object.values(STAFF_MODELS)]);
    for (const f of FEMALE_MODELS) expect(all.has(f), f).toBe(true);
    expect(credits.includes('Mixamo')).toBe(true);
  });
});
