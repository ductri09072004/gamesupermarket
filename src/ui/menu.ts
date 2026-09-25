import type { Settings } from '../core/GameState';
import { h, modal, uiRoot } from './dom';
import { showSettings } from './settings';

export { showSettings };

export interface MenuHandlers {
  hasSave: boolean;
  onContinue(): void;
  onNewGame(): void;
  onDevGame(): void;
}

/** Main menu: Tiếp tục / Game mới / Cài đặt. */
export function showMainMenu(handlers: MenuHandlers, settings: Settings, onSettings: (s: Settings) => void): () => void {
  const root = h('div', { class: 'main-menu' });
  const close = () => root.remove();
  const confirmNew = (dev: boolean) => () => {
    const start = () => {
      close();
      if (dev) handlers.onDevGame();
      else handlers.onNewGame();
    };
    if (!handlers.hasSave) {
      start();
      return;
    }
    const body = h('div', { class: 'pause-menu' }, [
      h('p', { text: 'Bắt đầu game mới sẽ xoá bản lưu hiện tại.' }),
      dev ? h('p', { class: 'muted', text: 'Chế độ developer: $1,000,000, mọi giấy phép, không giới hạn cấp độ để mua đồ / mở rộng / thuê nhân viên, không phá sản.' }) : null,
      h('button', { class: 'btn danger block big', text: 'Xoá bản lưu & chơi mới', onClick: () => { m.close(); start(); } }),
      h('button', { class: 'btn block big', text: 'Huỷ', onClick: () => m.close() }),
    ]);
    const m = modal(dev ? '🛠️ Chế độ developer' : '✨ Game mới', body);
  };
  root.append(h('div', { class: 'menu-card' }, [
    h('div', { class: 'logo', text: '🏪' }),
    h('h1', { text: 'Mini Mart Tycoon 3D' }),
    h('p', { class: 'muted', text: 'Giả lập siêu thị góc nhìn thứ nhất' }),
    h('button', { class: 'btn primary block big', text: '▶ Tiếp tục', disabled: !handlers.hasSave, onClick: () => { close(); handlers.onContinue(); } }),
    h('button', { class: 'btn block big', text: '✨ Game mới', onClick: confirmNew(false) }),
    h('button', { class: 'btn block big', text: '🛠️ Chế độ developer', onClick: confirmNew(true) }),
    h('button', { class: 'btn block big', text: '⚙️ Cài đặt', onClick: () => showSettings(settings, onSettings) }),
    h('div', { class: 'menu-help', html: '<kbd>WASD</kbd> đi · <kbd>Shift</kbd> chạy · <kbd>Space</kbd> nhảy · <kbd>Ctrl</kbd> ngồi · <kbd>E</kbd> tương tác · <kbd>Chuột trái</kbd> đặt hàng · <kbd>F</kbd> mở thùng · <kbd>Q</kbd> thả · <kbd>M</kbd> dời kệ · <kbd>B</kbd> xây dựng · <kbd>1-3</kbd> tốc độ · <kbd>F3</kbd> debug · <kbd>F4</kbd> xem sản phẩm' }),
  ]));
  uiRoot().append(root);
  return close;
}

export interface PauseHandlers {
  canEndDay?: boolean;
  onEndDay?(): void;
  onResume(): void;
  onSave(): void;
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
    h('button', { class: 'btn primary block big', text: '▶ Tiếp tục chơi', onClick: act(() => {}) }),
    h2.canEndDay ? h('button', { class: 'btn block big', text: '🌙 Kết thúc ngày', onClick: act(() => h2.onEndDay?.(), false) }) : null,
    h('button', { class: 'btn block big', text: '💾 Lưu game', onClick: act(h2.onSave) }),
    h('button', { class: 'btn block big', text: '⚙️ Cài đặt', onClick: act(h2.onSettings, false) }),
    h('button', { class: 'btn block big danger', text: '🚪 Về menu chính', onClick: act(h2.onQuit, false) }),
  ]);
  const m = modal('☰ Tạm dừng', body, { onClose: () => { if (resumeOnClose) h2.onResume(); } });
}

export function showGameOver(day: number, onMenu: () => void): void {
  const body = h('div', { class: 'game-over' }, [
    h('div', { class: 'logo', text: '💸' }),
    h('p', { text: `Cửa hàng đã phá sản sau ${day} ngày vì nợ quá 3 ngày liên tiếp.` }),
    h('button', { class: 'btn primary block big', text: 'Về menu chính', onClick: () => { m.close(); } }),
  ]);
  const m = modal('Game Over', body, { onClose: onMenu, closable: false });
}
