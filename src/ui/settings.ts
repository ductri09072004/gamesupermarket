import type { Quality, Settings } from '../core/GameState';
import { h, modal } from './dom';

/** Cài đặt: chất lượng, FOV, độ nhạy chuột, headbob, âm lượng từng kênh. */
export function showSettings(st: Settings, onChange: (s: Settings) => void, onClose?: () => void): void {
  const toggle = (key: 'muted' | 'music' | 'headbob' | 'gameOverEnabled', label: string) => {
    const input = h('input', { attrs: { type: 'checkbox', id: `set-${key}` } });
    input.checked = st[key];
    input.addEventListener('change', () => {
      st[key] = input.checked;
      onChange(st);
    });
    return h('label', { class: 'setting' }, [input, h('span', { text: label })]);
  };
  const slider = (key: 'fov' | 'sensitivity' | 'volMaster' | 'volSfx' | 'volMusic' | 'volAmbient', label: string, min: number, max: number, step: number, fmt: (v: number) => string) => {
    const val = h('span', { class: 'set-val', text: fmt(st[key]) });
    const input = h('input', { attrs: { type: 'range', min: String(min), max: String(max), step: String(step), id: `set-${key}` } });
    input.value = String(st[key]);
    input.addEventListener('input', () => {
      st[key] = Number(input.value);
      val.textContent = fmt(st[key]);
      onChange(st);
    });
    return h('label', { class: 'setting range' }, [h('span', { text: label }), input, val]);
  };
  const quality = h('div', { class: 'seg' }, (['low', 'medium', 'high'] as Quality[]).map((q) => {
    const b = h('button', { class: `btn small ${st.quality === q ? 'primary' : ''}`, text: { low: 'Thấp', medium: 'Trung', high: 'Cao' }[q] });
    b.addEventListener('click', () => {
      st.quality = q;
      quality.querySelectorAll('button').forEach((x) => x.classList.remove('primary'));
      b.classList.add('primary');
      onChange(st);
    });
    return b;
  }));
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const body = h('div', { class: 'settings' }, [
    h('div', { class: 'setting' }, [h('span', { text: 'Chất lượng đồ hoạ' }), quality]),
    slider('fov', 'Góc nhìn (FOV)', 55, 100, 1, (v) => `${v}°`),
    slider('sensitivity', 'Độ nhạy chuột', 0.3, 2.5, 0.05, (v) => `${v.toFixed(2)}×`),
    toggle('headbob', 'Rung đầu khi đi (headbob)'),
    slider('volMaster', 'Âm lượng tổng', 0, 1, 0.05, pct),
    slider('volSfx', 'Hiệu ứng', 0, 1, 0.05, pct),
    slider('volMusic', 'Nhạc nền', 0, 1, 0.05, pct),
    slider('volAmbient', 'Môi trường', 0, 1, 0.05, pct),
    toggle('music', 'Bật nhạc nền'),
    toggle('muted', 'Tắt tiếng'),
    toggle('gameOverEnabled', 'Game Over khi nợ quá 3 ngày'),
  ]);
  modal('⚙️ Cài đặt', body, { onClose });
}
