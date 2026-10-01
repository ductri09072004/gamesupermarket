import type { Settings } from '../core/GameState';
import type { SlotInfo } from '../core/SaveSlots';
import { h, modal, uiRoot } from './dom';
import { icon } from './icons';
import { installButton } from './install';
import { showSettings } from './settings';
import { showSlotPicker, type SlotMode } from './slotPicker';

export { showSettings };

export interface MenuHandlers {
  slots(): SlotInfo[];
  lastSlot(): number | null;
  onContinue(): void;
  onLoad(slot: number): void;
  onDelete(slot: number): void;
  onNewGame(slot: number): void;
  onDevGame(slot: number): void;
}

/** Main menu: Tiếp tục / Hồ sơ đã lưu / Game mới (chọn trong 5 hồ sơ) / Cài đặt. */
export function showMainMenu(handlers: MenuHandlers, settings: Settings, onSettings: (s: Settings) => void): () => void {
  const root = h('div', { class: 'main-menu' });
  const close = () => root.remove();
  const chooseSlot = (mode: SlotMode) => () => showSlotPicker(mode, {
    slots: handlers.slots,
    onPick: (slot) => {
      close();
      if (mode === 'load') handlers.onLoad(slot);
      else if (mode === 'dev') handlers.onDevGame(slot);
      else handlers.onNewGame(slot);
    },
    onDelete: (slot) => { handlers.onDelete(slot); render(); },
  });
  const build = () => {
    const last = handlers.lastSlot();
    const info = last === null ? null : handlers.slots().find((s) => s.slot === last);
    return h('div', { class: 'menu-card' }, [
      h('div', { class: 'brand' }, [h('span', { class: 'brand-mark', text: 'TH' }), h('div', {}, [h('h1', { text: 'Tạp Hoá Đầu Hẻm' }), h('p', { class: 'muted', text: 'Giả lập tiệm tạp hoá Việt Nam thập niên 90' })])]),
      h('button', { class: 'btn primary block big', disabled: last === null, onClick: () => { close(); handlers.onContinue(); } }, [
        h('span', { text: 'Tiếp tục' }),
        info ? h('small', { class: 'btn-sub', text: `Hồ sơ ${info.slot} · Ngày ${info.day}` }) : null,
      ]),
      h('button', { class: 'btn block big', text: 'Hồ sơ đã lưu', disabled: handlers.slots().every((s) => s.empty), onClick: chooseSlot('load') }),
      h('button', { class: 'btn block big', text: 'Game mới', onClick: chooseSlot('new') }),
      h('button', { class: 'btn block big', text: 'Cài đặt', onClick: () => showSettings(settings, onSettings) }),
      installButton(),
      h('button', { class: 'btn ghost block', text: 'Chế độ developer', onClick: chooseSlot('dev') }),
      h('div', { class: 'menu-help', html: '<kbd>WASD</kbd> đi · <kbd>Shift</kbd> chạy · <kbd>Space</kbd> nhảy · <kbd>Ctrl</kbd> ngồi · <kbd>Chuột trái</kbd> tương tác / đặt hàng · <kbd>F</kbd> mở thùng · <kbd>Q</kbd> thả · <kbd>M</kbd> dời kệ · <kbd>B</kbd> xây dựng · <kbd>T</kbd> tua nhanh 3× · <kbd>F3</kbd> debug · <kbd>F4</kbd> xem sản phẩm' }),
    ]);
  };
  const render = () => root.replaceChildren(build());
  render();
  uiRoot().append(root);
  return close;
}

export interface PauseHandlers {
  canEndDay?: boolean;
  onEndDay?(): void;
  onResume(): void;
  onSave(): void;
  onBuild(): void;
  onSettings(): void;
  onQuit(): void;
}

export function showPauseMenu(h2: PauseHandlers): void {
  let resumeOnClose = true;
  const act = (fn: () => void, resume = true) => () => {
    resumeOnClose = resume;
    m.close();
    fn();
  };
  const body = h('div', { class: 'pause-menu' }, [
    h('button', { class: 'btn primary block big', text: 'Tiếp tục chơi', onClick: act(() => {}) }),
    h2.canEndDay ? h('button', { class: 'btn block big', text: 'Kết thúc ngày', onClick: act(() => h2.onEndDay?.(), false) }) : null,
    h('button', { class: 'btn block big', html: `${icon('hammer', 16)}<span>Xây dựng</span><kbd>B</kbd>`, onClick: act(h2.onBuild, false) }),
    h('button', { class: 'btn block big', html: `${icon('save', 16)}<span>Lưu game</span>`, onClick: act(h2.onSave) }),
    h('button', { class: 'btn block big', html: `${icon('gear', 16)}<span>Cài đặt</span>`, onClick: act(h2.onSettings, false) }),
    h('button', { class: 'btn block big danger', html: `${icon('exit', 16)}<span>Về menu chính</span>`, onClick: act(h2.onQuit, false) }),
  ]);
  const m = modal('Tạm dừng', body, { onClose: () => { if (resumeOnClose) h2.onResume(); } });
}

export function showGameOver(day: number, onMenu: () => void): void {
  const body = h('div', { class: 'game-over' }, [
    h('p', { text: `Cửa hàng đã phá sản sau ${day} ngày vì nợ quá 3 ngày liên tiếp.` }),
    h('button', { class: 'btn primary block big', text: 'Về menu chính', onClick: () => { m.close(); } }),
  ]);
  const m = modal('Game Over', body, { onClose: onMenu, closable: false });
}
