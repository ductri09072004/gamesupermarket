import { h, modal } from './dom';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

/** Gọi sớm (main.ts): trình duyệt chỉ bắn beforeinstallprompt một lần, có thể trước khi menu hiện. */
export function watchInstall(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((fn) => fn());
  });
}

export function isInstalled(): boolean {
  return window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches
    || (navigator as { standalone?: boolean }).standalone === true;
}

/** Nút "Cài game về máy": cài thẳng nếu trình duyệt cho phép, không thì hiện hướng dẫn thủ công. Đã cài rồi → không có nút. */
export function installButton(): HTMLButtonElement | null {
  if (isInstalled() || !('serviceWorker' in navigator)) return null;
  const btn = h('button', { class: 'btn block big', text: 'Cài game về máy', onClick: () => void install() });
  const sync = () => { btn.hidden = isInstalled(); };
  listeners.add(sync);
  return btn;
}

async function install(): Promise<void> {
  if (deferred) {
    const ev = deferred;
    deferred = null;
    await ev.prompt();
    await ev.userChoice;
    return;
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const steps = ios
    ? ['Mở game bằng Safari.', 'Bấm nút Chia sẻ ở thanh dưới.', 'Chọn "Thêm vào Màn hình chính".']
    : ['Mở menu của trình duyệt (⋮ hoặc …).', 'Chọn "Cài đặt ứng dụng" / "Cài đặt Tạp Hoá Đầu Hẻm" (Chrome, Edge).', 'Firefox chưa hỗ trợ cài đặt — hãy dùng Chrome hoặc Edge.'];
  const body = h('div', { class: 'pause-menu' }, [
    h('p', { text: 'Trình duyệt chưa cho cài tự động. Làm thủ công:' }),
    h('ol', { class: 'muted' }, steps.map((s) => h('li', { text: s }))),
    h('p', { class: 'muted', text: 'Cài xong game mở như một ứng dụng riêng, vào nhanh hơn và chơi được khi mất mạng (sau khi đã mở game online ít nhất hai lần).' }),
    h('button', { class: 'btn block big', text: 'Đóng', onClick: () => m.close() }),
  ]);
  const m = modal('Cài game về máy', body);
}
