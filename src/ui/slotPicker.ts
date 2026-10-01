import type { SlotInfo } from '../core/SaveSlots';
import { h, modal, money } from './dom';

export type SlotMode = 'load' | 'new' | 'dev';

export interface SlotPickerHandlers {
  /** Danh sách mới nhất (đọc lại sau mỗi lần xoá) */
  slots(): SlotInfo[];
  onPick(slot: number): void;
  onDelete(slot: number): void;
}

const TITLES: Record<SlotMode, string> = { load: 'Hồ sơ đã lưu', new: 'Game mới — chọn hồ sơ', dev: 'Chế độ developer — chọn hồ sơ' };

function stamp(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Danh sách hồ sơ: tải (load) hoặc chọn chỗ bắt đầu ván mới (new/dev, ô có dữ liệu thì phải xác nhận ghi đè). */
export function showSlotPicker(mode: SlotMode, hd: SlotPickerHandlers): void {
  const list = h('div', { class: 'slot-list' });
  const m = modal(TITLES[mode], h('div', { class: 'pause-menu slot-picker' }, [list]));
  const pick = (slot: number) => { m.close(); hd.onPick(slot); };

  /** Nút nguy hiểm hai bước: bấm lần 1 đổi chữ, bấm lần 2 mới làm */
  const confirmBtn = (label: string, sure: string, run: () => void, primary = false) => {
    const b = h('button', { class: `btn ${primary ? '' : 'danger'}`, text: label });
    let armed = false;
    b.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        b.textContent = sure;
        setTimeout(() => { armed = false; b.textContent = label; }, 3000);
        return;
      }
      run();
    });
    return b;
  };

  const render = () => {
    list.replaceChildren(...hd.slots().map((s) => {
      const info = s.empty
        ? h('div', { class: 'slot-info' }, [h('b', { text: `Hồ sơ ${s.slot}` }), h('span', { class: 'muted', text: 'Trống' })])
        : h('div', { class: 'slot-info' }, [
          h('b', { text: `Hồ sơ ${s.slot}${s.devMode ? ' · DEV' : ''}` }),
          h('span', { class: 'muted', text: `Ngày ${s.day} · ${money(s.money)} · Cấp ${s.level}${s.savedAt ? ` · ${stamp(s.savedAt)}` : ''}` }),
        ]);
      const acts = h('div', { class: 'slot-acts' });
      if (mode === 'load') {
        if (!s.empty) {
          acts.append(h('button', { class: 'btn primary', text: 'Chơi', onClick: () => pick(s.slot) }));
          acts.append(confirmBtn('Xoá', 'Chắc chắn?', () => { hd.onDelete(s.slot); render(); }));
        }
      } else if (s.empty) {
        acts.append(h('button', { class: 'btn primary', text: 'Chơi tại đây', onClick: () => pick(s.slot) }));
      } else {
        acts.append(confirmBtn('Ghi đè', 'Xoá & chơi mới', () => pick(s.slot)));
      }
      return h('div', { class: `slot-row ${s.empty ? 'empty' : ''}` }, [info, acts]);
    }));
    if (mode === 'load' && hd.slots().every((s) => s.empty)) list.append(h('p', { class: 'muted', text: 'Chưa có hồ sơ nào được lưu.' }));
  };
  render();
}
