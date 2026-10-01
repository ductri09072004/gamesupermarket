import { SAVE_KEY, SAVE_SLOTS } from '../config/constants';
import { defaultStorage, SaveSystem, type StorageLike } from './SaveSystem';

/** Tóm tắt một hồ sơ để hiện trong danh sách (không giữ cả SaveData). */
export interface SlotInfo {
  slot: number;
  empty: boolean;
  day: number;
  money: number;
  level: number;
  devMode: boolean;
  /** Lần lưu gần nhất (ms epoch); null nếu chưa biết (hồ sơ nhập từ bản lưu cũ) */
  savedAt: number | null;
}

interface Meta {
  last: number | null;
  times: Record<string, number>;
}

/** Tối đa SAVE_SLOTS hồ sơ độc lập; nhớ hồ sơ chơi gần nhất để nút "Tiếp tục" mở đúng chỗ. */
export class SaveSlots {
  private active: number | null = null;
  private metaKey = `${SAVE_KEY}-slots`;

  constructor(private storage: StorageLike | null = defaultStorage()) {
    this.adoptLegacy();
  }

  private key(slot: number): string {
    return `${SAVE_KEY}-slot${slot}`;
  }

  system(slot: number): SaveSystem {
    return new SaveSystem(this.storage, this.key(slot));
  }

  /** Bản lưu một-ô cũ (trước khi có hồ sơ) → chuyển thành hồ sơ 1 nếu hồ sơ 1 còn trống. */
  private adoptLegacy(): void {
    try {
      const old = this.storage?.getItem(SAVE_KEY);
      if (!old) return;
      if (!this.storage?.getItem(this.key(1))) this.storage?.setItem(this.key(1), old);
      this.storage?.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  }

  private readMeta(): Meta {
    try {
      const raw = this.storage?.getItem(this.metaKey);
      if (raw) {
        const m = JSON.parse(raw) as Partial<Meta>;
        return { last: typeof m.last === 'number' ? m.last : null, times: m.times ?? {} };
      }
    } catch {
      /* hỏng → coi như chưa có */
    }
    return { last: null, times: {} };
  }

  private writeMeta(m: Meta): void {
    try {
      this.storage?.setItem(this.metaKey, JSON.stringify(m));
    } catch {
      /* ignore */
    }
  }

  list(): SlotInfo[] {
    const meta = this.readMeta();
    return Array.from({ length: SAVE_SLOTS }, (_, i) => {
      const slot = i + 1;
      const d = this.system(slot).load();
      return {
        slot,
        empty: !d,
        day: d?.day ?? 0,
        money: d?.money ?? 0,
        level: d?.level ?? 0,
        devMode: !!d?.devMode,
        savedAt: d ? meta.times[slot] ?? null : null,
      };
    });
  }

  /** Hồ sơ chơi gần nhất còn dữ liệu; không có thì hồ sơ lưu mới nhất; không có gì → null. */
  lastSlot(): number | null {
    const filled = this.list().filter((s) => !s.empty);
    if (!filled.length) return null;
    const meta = this.readMeta();
    if (meta.last !== null && filled.some((s) => s.slot === meta.last)) return meta.last;
    return filled.reduce((a, b) => ((b.savedAt ?? 0) > (a.savedAt ?? 0) ? b : a)).slot;
  }

  firstEmpty(): number | null {
    return this.list().find((s) => s.empty)?.slot ?? null;
  }

  /** Hồ sơ đang chơi; null (menu / cảnh demo) thì không lưu đi đâu cả. */
  setActive(slot: number | null): void {
    this.active = slot;
    if (slot === null) return;
    const m = this.readMeta();
    m.last = slot;
    this.writeMeta(m);
  }

  activeSystem(): SaveSystem {
    return this.active === null ? new SaveSystem(null) : this.system(this.active);
  }

  markSaved(): void {
    if (this.active === null) return;
    const m = this.readMeta();
    m.last = this.active;
    m.times[this.active] = Date.now();
    this.writeMeta(m);
  }

  clear(slot: number): void {
    this.system(slot).clear();
    const m = this.readMeta();
    delete m.times[slot];
    if (m.last === slot) m.last = null;
    this.writeMeta(m);
  }
}

export const saveSlots = new SaveSlots();
