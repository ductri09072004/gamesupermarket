import type { Quality, Settings } from '../core/GameState';
import { h, modal } from './dom';

type Toggle = 'muted' | 'music' | 'headbob' | 'gameOverEnabled';
type Slider = 'fov' | 'sensitivity' | 'volMaster' | 'volSfx' | 'volMusic' | 'volAmbient';

/** Cài đặt gom theo nhóm (đồ hoạ, điều khiển, âm thanh, trò chơi); mỗi dòng một điều khiển gọn. */
export function showSettings(st: Settings, onChange: (s: Settings) => void, onClose?: () => void): void {
  const row = (label: string, control: HTMLElement, hint?: string) =>
    h('div', { class: 'set-row' }, [h('div', { class: 'set-label' }, [h('span', { text: label }), hint ? h('small', { text: hint }) : null]), control]);

  const toggle = (key: Toggle, label: string, hint?: string) => {
    const input = h('input', { attrs: { type: 'checkbox', id: `set-${key}` } });
    input.checked = st[key];
    input.addEventListener('change', () => {
      st[key] = input.checked;
      onChange(st);
    });
    return row(label, h('label', { class: 'switch' }, [input, h('span', { class: 'switch-track' })]), hint);
  };

  const slider = (key: Slider, label: string, min: number, max: number, step: number, fmt: (v: number) => string) => {
    const val = h('span', { class: 'set-val', text: fmt(st[key]) });
    const input = h('input', { attrs: { type: 'range', min: String(min), max: String(max), step: String(step), id: `set-${key}` } });
    input.value = String(st[key]);
    input.addEventListener('input', () => {
      st[key] = Number(input.value);
      val.textContent = fmt(st[key]);
      onChange(st);
    });
    return row(label, h('div', { class: 'set-range' }, [input, val]));
  };

  const quality = h('div', { class: 'seg' }, (['lite', 'low', 'medium', 'high'] as Quality[]).map((q) => {
    const b = h('button', { class: `seg-btn ${st.quality === q ? 'on' : ''}`, text: { lite: 'Siêu nhẹ', low: 'Thấp', medium: 'Trung', high: 'Cao' }[q] });
    b.addEventListener('click', () => {
      st.quality = q;
      quality.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      onChange(st);
    });
    return b;
  }));

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const section = (title: string, rows: HTMLElement[]) => h('section', { class: 'set-section' }, [h('h4', { text: title }), ...rows]);
  const body = h('div', { class: 'settings' }, [
    section('Đồ hoạ', [
      row('Chất lượng', quality),
      slider('fov', 'Góc nhìn', 55, 100, 1, (v) => `${v}°`),
    ]),
    section('Điều khiển', [
      slider('sensitivity', 'Độ nhạy chuột', 0.3, 2.5, 0.05, (v) => `${v.toFixed(2)}×`),
      toggle('headbob', 'Rung đầu khi đi bộ'),
    ]),
    section('Âm thanh', [
      toggle('muted', 'Tắt tiếng'),
      toggle('music', 'Nhạc nền'),
      slider('volMaster', 'Âm lượng chung', 0, 1, 0.05, pct),
      slider('volSfx', 'Hiệu ứng', 0, 1, 0.05, pct),
      slider('volMusic', 'Nhạc', 0, 1, 0.05, pct),
      slider('volAmbient', 'Môi trường', 0, 1, 0.05, pct),
    ]),
    section('Trò chơi', [toggle('gameOverEnabled', 'Phá sản khi nợ quá 3 ngày', 'Tắt để chơi thoải mái, không bị Game Over')]),
  ]);
  modal('Cài đặt', body, { onClose });
}
