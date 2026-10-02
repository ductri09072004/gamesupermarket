import { h, uiRoot } from './dom';

const SCALE = 80; // km/h cuối thang
const START = -135; // độ, tính từ 12 giờ theo chiều kim đồng hồ
const SWEEP = 270;

const angle = (kmh: number) => START + (SWEEP * Math.min(kmh, SCALE)) / SCALE;
const at = (a: number, r: number): [number, number] => [100 + r * Math.sin((a * Math.PI) / 180), 100 - r * Math.cos((a * Math.PI) / 180)];
const f = (n: number) => n.toFixed(1);

/** Mặt đồng hồ tốc độ kiểu cũ: vành crôm, nền đen ngả nâu, vạch kem, vùng đỏ cuối thang. */
function gaugeSvg(redFrom: number): string {
  let ticks = '';
  for (let v = 0; v <= SCALE; v += 5) {
    const major = v % 10 === 0;
    const [x1, y1] = at(angle(v), 88);
    const [x2, y2] = at(angle(v), major ? 76 : 82);
    ticks += `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="#eadfc2" stroke-width="${major ? 2.4 : 1.2}"/>`;
    if (v % 20 === 0) {
      const [tx, ty] = at(angle(v), 62);
      ticks += `<text x="${f(tx)}" y="${f(ty + 5)}" text-anchor="middle" class="dh-num">${v}</text>`;
    }
  }
  const [rx1, ry1] = at(angle(redFrom), 91);
  const [rx2, ry2] = at(angle(SCALE), 91);
  const red = redFrom < SCALE ? `<path d="M${f(rx1)} ${f(ry1)} A91 91 0 0 1 ${f(rx2)} ${f(ry2)}" fill="none" stroke="#c8402c" stroke-width="4"/>` : '';
  return `<svg viewBox="0 0 200 200" class="dh-gauge" aria-hidden="true">
    <defs>
      <linearGradient id="dhRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1ead6"/><stop offset="0.5" stop-color="#8d8670"/><stop offset="1" stop-color="#d8cfb4"/></linearGradient>
      <radialGradient id="dhFace" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#2a2014"/><stop offset="1" stop-color="#0f0b07"/></radialGradient>
    </defs>
    <circle cx="100" cy="100" r="99" fill="url(#dhRing)"/>
    <circle cx="100" cy="100" r="93" fill="#2b2519"/>
    <circle cx="100" cy="100" r="91" fill="url(#dhFace)"/>
    ${red}${ticks}
    <text x="100" y="86" text-anchor="middle" class="dh-unit">KM/H</text>
    <g class="dh-needle"><line x1="100" y1="112" x2="100" y2="26" stroke="#c8402c" stroke-width="3.2" stroke-linecap="round"/><line x1="100" y1="100" x2="100" y2="116" stroke="#eadfc2" stroke-width="5" stroke-linecap="round"/></g>
    <circle cx="100" cy="100" r="8" fill="url(#dhRing)" stroke="#3b2f1c" stroke-width="1.5"/>
    <path d="M30 70 A80 80 0 0 1 150 28" fill="none" stroke="#fff" stroke-opacity="0.08" stroke-width="14" stroke-linecap="round"/>
  </svg>`;
}

export interface DriveInfo {
  /** Tốc độ (km/h, có dấu: âm = lùi) */
  kmh: number;
  name: string;
  icon: string;
  used: number;
  capacity: number;
  /** 'suất' hoặc 'thùng' */
  unit: string;
}

/**
 * Bảng đồng hồ khi lái xe: đồng hồ kim, cửa sổ số tốc độ + quãng đường như đồng hồ cơ, biển tên xe sơn men,
 * đèn D / R, bộ đếm hàng chở. Dựng một lần, mỗi khung chỉ đổi kim và vài ô chữ.
 */
export class DriveHud {
  private root: HTMLElement;
  private needle: SVGGElement;
  private speedEl = h('span', { class: 'dh-digits' });
  private tripEl = h('span', { class: 'dh-digits small' });
  private nameEl = h('b');
  private lampD = h('i', { class: 'dh-lamp d', text: 'D' });
  private lampR = h('i', { class: 'dh-lamp r', text: 'R' });
  private cargoEl = h('span', { class: 'dh-cargo-n' });
  private cargoUnit = h('small');
  private trip = 0;
  private last = { kmh: NaN, trip: '', cargo: '', name: '' };

  constructor(maxKmh: number) {
    this.root = h('div', { class: 'drive-hud' }, [
      h('div', { class: 'dh-dial', html: gaugeSvg(Math.min(SCALE, Math.round(maxKmh))) }, [
        h('div', { class: 'dh-window' }, [this.speedEl]),
        h('div', { class: 'dh-trip' }, [this.tripEl, h('small', { text: ' km' })]),
      ]),
      h('div', { class: 'dh-side' }, [
        h('div', { class: 'dh-plate' }, [this.nameEl, h('div', { class: 'dh-lamps' }, [this.lampD, this.lampR])]),
        h('div', { class: 'dh-cargo' }, [h('span', { text: 'CHỞ' }), this.cargoEl, this.cargoUnit]),
        h('div', { class: 'dh-keys', html: '<kbd>W</kbd><kbd>S</kbd> ga / lùi · <kbd>A</kbd><kbd>D</kbd> lái · <kbd>Space</kbd> phanh tay · <kbd>E</kbd> xuống xe' }),
      ]),
    ]);
    this.needle = this.root.querySelector('.dh-needle') as SVGGElement;
    uiRoot().append(this.root);
  }

  update(info: DriveInfo, dt: number): void {
    const kmh = Math.abs(info.kmh);
    this.trip += (kmh / 3600) * dt;
    const rounded = Math.round(kmh);
    if (rounded !== this.last.kmh) {
      this.last.kmh = rounded;
      this.speedEl.textContent = String(rounded).padStart(3, '0');
      this.needle.style.transform = `rotate(${angle(kmh)}deg)`;
      const rev = info.kmh < -0.7;
      this.lampD.classList.toggle('on', !rev);
      this.lampR.classList.toggle('on', rev);
    }
    const trip = this.trip.toFixed(1).padStart(6, '0');
    if (trip !== this.last.trip) {
      this.last.trip = trip;
      this.tripEl.textContent = trip;
    }
    const cargo = `${info.used}/${info.capacity}`;
    if (cargo !== this.last.cargo) {
      this.last.cargo = cargo;
      this.cargoEl.textContent = cargo;
      this.cargoUnit.textContent = info.unit;
    }
    const name = `${info.icon} ${info.name}`;
    if (name !== this.last.name) {
      this.last.name = name;
      this.nameEl.textContent = name;
    }
  }

  destroy(): void {
    this.root.remove();
  }
}
