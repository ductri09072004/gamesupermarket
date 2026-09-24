import type { Settings } from '../core/GameState';
import { h, modal, uiRoot } from './dom';

export interface MenuHandlers {
  hasSave: boolean;
  onContinue(): void;
  onNewGame(): void;
}

/** Main menu: Tiếp tục / Game mới / Cài đặt. */
export function showMainMenu(handlers: MenuHandlers, settings: Settings, onSettings: (s: Settings) => void): () => void {
  const root = h('div', { class: 'main-menu' });
  const close = () => root.remove();
  const startNew = () => {
    close();
    handlers.onNewGame();
  };
  const confirmNew = () => {
    if (!handlers.hasSave) {
      startNew();
      return;
    }
    const body = h('div', { class: 'pause-menu' }, [
      h('p', { text: 'Bắt đầu game mới sẽ xoá bản lưu hiện tại.' }),
      h('button', { class: 'btn danger block big', text: 'Xoá bản lưu & chơi mới', onClick: () => { m.close(); startNew(); } }),
      h('button', { class: 'btn block big', text: 'Huỷ', onClick: () => m.close() }),
    ]);
    const m = modal('✨ Game mới', body);
  };
  root.append(h('div', { class: 'menu-card' }, [
    h('div', { class: 'logo', text: '🏪' }),
    h('h1', { text: 'Mini Mart Tycoon' }),
    h('p', { class: 'muted', text: 'Giả lập siêu thị isometric 2D' }),
    h('button', { class: 'btn primary block big', text: '▶ Tiếp tục', disabled: !handlers.hasSave, onClick: () => { close(); handlers.onContinue(); } }),
    h('button', { class: 'btn block big', text: '✨ Game mới', onClick: confirmNew }),
    h('button', { class: 'btn block big', text: '⚙️ Cài đặt', onClick: () => showSettings(settings, onSettings) }),
    h('div', { class: 'menu-help', html: '<kbd>WASD</kbd> di chuyển · <kbd>E</kbd> tương tác · <kbd>Q</kbd> đặt thùng · <kbd>F</kbd> mở thùng · <kbd>B</kbd> xây dựng · <kbd>1-3</kbd> tốc độ · <kbd>F3</kbd> debug' }),
  ]));
  uiRoot().append(root);
  return close;
}

export function showSettings(settings: Settings, onChange: (s: Settings) => void, onClose?: () => void): void {
  const toggle = (key: keyof Settings, label: string) => {
    const input = h('input', { attrs: { type: 'checkbox' } });
    input.checked = settings[key];
    input.addEventListener('change', () => {
      settings[key] = input.checked;
      onChange(settings);
    });
    return h('label', { class: 'setting' }, [input, h('span', { text: label })]);
  };
  const body = h('div', { class: 'settings' }, [
    toggle('muted', 'Tắt tiếng'),
    toggle('music', 'Nhạc nền lofi'),
    toggle('cameraFollow', 'Camera theo người chơi'),
    toggle('gameOverEnabled', 'Game Over khi nợ quá 3 ngày'),
  ]);
  modal('⚙️ Cài đặt', body, { onClose });
}

export interface PauseHandlers {
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
