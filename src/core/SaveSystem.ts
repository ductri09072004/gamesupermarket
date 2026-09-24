import { SAVE_KEY, SAVE_VERSION } from '../config/constants';
import { createNewState, type SaveData } from './GameState';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** migrations[v] nâng dữ liệu từ version v lên v+1 */
const migrations: Record<number, Migration> = {
  1: (d) => ({ ...d, furnitureStock: d.furnitureStock ?? [], tutorial: d.tutorial ?? {}, version: 2 }),
};

export function migrate(raw: Record<string, unknown>): SaveData {
  let data = raw;
  let v = typeof data.version === 'number' ? data.version : 1;
  while (v < SAVE_VERSION) {
    const m = migrations[v];
    if (!m) throw new Error(`No migration from version ${v}`);
    data = m(data);
    v += 1;
  }
  // Bổ sung các trường thiếu bằng giá trị mặc định
  const defaults = createNewState(typeof data.seed === 'number' ? data.seed : 1);
  const merged = { ...defaults, ...data, version: SAVE_VERSION } as SaveData;
  merged.settings = { ...defaults.settings, ...(merged.settings ?? {}) };
  merged.stats = { ...defaults.stats, ...(merged.stats ?? {}) };
  merged.prices = { ...defaults.prices, ...(merged.prices ?? {}) };
  return merged;
}

export function serialize(data: SaveData): string {
  return JSON.stringify({ ...data, version: SAVE_VERSION });
}

export function deserialize(json: string): SaveData {
  const raw = JSON.parse(json) as Record<string, unknown>;
  return migrate(raw);
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export class SaveSystem {
  constructor(private storage: StorageLike | null = defaultStorage(), private key = SAVE_KEY) {}

  hasSave(): boolean {
    try {
      return !!this.storage?.getItem(this.key);
    } catch {
      return false;
    }
  }

  save(data: SaveData): boolean {
    try {
      this.storage?.setItem(this.key, serialize(data));
      return true;
    } catch {
      return false;
    }
  }

  load(): SaveData | null {
    try {
      const json = this.storage?.getItem(this.key);
      return json ? deserialize(json) : null;
    } catch {
      return null;
    }
  }

  clear(): void {
    try {
      this.storage?.removeItem(this.key);
    } catch {
      /* ignore */
    }
  }
}
