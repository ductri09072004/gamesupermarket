import { vehicleDef } from '../config/vehicles';
import type { World } from '../game/World';
import { mapPois, type Poi } from '../world/MapPois';
import { h, uiRoot } from './dom';
import { renderMapBase, type MapBase } from './mapRender';

interface View {
  cx: number;
  cz: number;
  /** Điểm ảnh trên mỗi mét */
  s: number;
}

const MINI = 120;
const MINI_SCALE = 2.2;
const GROUP_COLOR: Record<Poi['group'], string> = { main: '#d9382c', cross: '#3a6ea5', alley: '#8a5a2b', vehicle: '#e0a21b' };

/**
 * Bản đồ: bản đồ nhỏ ở góc phải màn hình (luôn hiện, lấy người chơi làm tâm) và bản đồ lớn mở bằng phím M
 * (cuộn để thu phóng, kéo để di chuyển, nhấp đúp để chỉ đường tới một điểm / địa điểm).
 */
export class MapUI {
  private mini: HTMLElement;
  private miniCanvas: HTMLCanvasElement;
  private info: HTMLElement;
  private overlay: HTMLElement | null = null;
  private big: HTMLCanvasElement | null = null;
  private tip: HTMLElement | null = null;
  private list: HTMLElement | null = null;
  private routeInfo: HTMLElement | null = null;
  private base: MapBase | null = null;
  private baseKey = '';
  private view: View = { cx: 0, cz: 0, s: 3 };
  private fitScale = 3;
  private frame = 0;
  private drag: { x: number; y: number; moved: boolean } | null = null;
  private pois: Poi[] = [];
  private offs: Array<() => void> = [];
  onClose: () => void = () => {};

  constructor(private w: World) {
    this.miniCanvas = h('canvas', { class: 'mm-canvas' }) as HTMLCanvasElement;
    this.miniCanvas.width = MINI * 2;
    this.miniCanvas.height = MINI * 2;
    this.info = h('div', { class: 'mm-info' });
    this.mini = h('div', { class: 'minimap', title: 'Bản đồ (M)' }, [
      h('div', { class: 'mm-disc' }, [this.miniCanvas, h('span', { class: 'mm-n', text: 'B' })]),
      this.info,
    ]);
    this.mini.addEventListener('click', () => { if (!this.isOpen) this.open(); });
    uiRoot().append(this.mini);
    this.offs.push(() => this.mini.remove());
    w.waypoint.onChange = () => { this.renderInfo(); this.renderRouteInfo(); };
    this.renderInfo();
  }

  get isOpen(): boolean {
    return this.overlay !== null;
  }

  private ensureBase(): MapBase {
    const L = this.w.city.layout;
    const d = this.w.s.data;
    const key = `${d.storeW}x${d.storeH}`;
    if (!this.base || this.baseLayout !== L || this.baseKey !== key) {
      this.base = renderMapBase(L, d.storeW, d.storeH);
      this.baseLayout = L;
      this.baseKey = key;
    }
    return this.base;
  }
  private baseLayout: unknown = null;

  private here(): { x: number; z: number; yaw: number } {
    const w = this.w;
    return w.mode === 'drive' ? { x: w.driving.state.x, z: w.driving.state.z, yaw: w.driving.state.yaw } : { x: w.player.x, z: w.player.z, yaw: w.player.yaw };
  }

  /** Gọi mỗi khung hình: vẽ lại bản đồ nhỏ (vài khung một lần cho nhẹ). */
  update(): void {
    this.mini.style.display = this.overlay ? 'none' : '';
    if ((this.frame++ & 3) !== 0 || this.overlay) return;
    const p = this.here();
    this.draw(this.miniCanvas, { cx: p.x, cz: p.z, s: MINI_SCALE * 2 }, false);
    this.renderInfo();
  }

  private renderInfo(): void {
    const wp = this.w.waypoint;
    if (!wp.dest) {
      this.info.textContent = 'M · bản đồ';
      this.info.classList.remove('active');
      return;
    }
    this.info.classList.add('active');
    this.info.textContent = wp.unreachable ? `${wp.dest.label} · không có đường` : `${wp.dest.label} · ${Math.round(wp.remaining())} m`;
  }

  private renderRouteInfo(): void {
    if (!this.routeInfo) return;
    const wp = this.w.waypoint;
    if (!wp.dest) this.routeInfo.textContent = 'Nhấp đúp lên bản đồ (hoặc chọn một địa điểm) để chỉ đường.';
    else if (wp.unreachable) this.routeInfo.textContent = `Không tìm được đường tới “${wp.dest.label}”.`;
    else this.routeInfo.textContent = `Đang chỉ đường tới “${wp.dest.label}”: ${Math.round(wp.remaining())} m · khoảng ${Math.max(1, Math.round(wp.remaining() / 3.2 / 60 * 10) / 10)} phút đi bộ.`;
  }

  // ---------------------------------------------------------------------------------------------------- vẽ

  private draw(canvas: HTMLCanvasElement, v: View, full: boolean): void {
    const g = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    const base = this.ensureBase();
    g.fillStyle = '#2a2f26';
    g.fillRect(0, 0, W, H);
    // vùng ảnh nền cần lấy
    const ppm = base.ppm;
    const sw = W / v.s;
    const sh = H / v.s;
    const sx = (v.cx - sw / 2 - base.x0) * ppm;
    const sy = (v.cz - sh / 2 - base.z0) * ppm;
    g.imageSmoothingEnabled = true;
    const cw = base.canvas.width;
    const ch = base.canvas.height;
    // cắt phần nằm ngoài ảnh nền (trình duyệt cũ không tự cắt)
    const x0 = Math.max(0, sx);
    const y0 = Math.max(0, sy);
    const x1 = Math.min(cw, sx + sw * ppm);
    const y1 = Math.min(ch, sy + sh * ppm);
    if (x1 > x0 && y1 > y0) g.drawImage(base.canvas, x0, y0, x1 - x0, y1 - y0, ((x0 - sx) / ppm) * v.s, ((y0 - sy) / ppm) * v.s, ((x1 - x0) / ppm) * v.s, ((y1 - y0) / ppm) * v.s);
    const sc = (x: number, z: number): [number, number] => [(x - v.cx) * v.s + W / 2, (z - v.cz) * v.s + H / 2];
    const k = full ? 1 : 2; // bản đồ nhỏ vẽ ở độ phân giải gấp đôi
    const wp = this.w.waypoint;
    const me = this.here();

    // đường đi
    if (wp.dest && wp.route) {
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.beginPath();
      [me, ...wp.route.pts.slice(1)].forEach((p, i) => { const [x, y] = sc(p.x, p.z); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.strokeStyle = 'rgba(30,20,0,0.65)';
      g.lineWidth = 6 * k;
      g.stroke();
      g.strokeStyle = '#ffc933';
      g.lineWidth = 3.4 * k;
      g.setLineDash([9 * k, 6 * k]);
      g.lineDashOffset = -(performance.now() / 60) % (15 * k);
      g.stroke();
      g.setLineDash([]);
    }
    // địa điểm (bản đồ lớn)
    if (full) {
      const zoomed = v.s > this.fitScale * 1.9;
      for (const p of this.pois) {
        if ((p.group === 'alley' || p.group === 'cross') && !zoomed) continue;
        const [x, y] = sc(p.x, p.z);
        if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
        g.fillStyle = GROUP_COLOR[p.group];
        g.strokeStyle = '#fff';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(x, y, p.group === 'main' || p.group === 'vehicle' ? 6 : 4, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        if (p.group === 'main' || p.group === 'vehicle' || zoomed) {
          g.font = '700 12px "Be Vietnam Pro", Arial, sans-serif';
          g.textAlign = 'left';
          g.textBaseline = 'middle';
          g.lineWidth = 3.5;
          g.strokeStyle = 'rgba(20,16,10,0.85)';
          g.strokeText(p.label, x + 9, y);
          g.fillStyle = '#fff6dc';
          g.fillText(p.label, x + 9, y);
        }
      }
    }
    // xe của người chơi
    for (const veh of this.w.s.data.vehicles) {
      const [x, y] = sc(veh.x, veh.z);
      const d = vehicleDef(veh);
      const wm = Math.max(5 * k, d.size[0] * v.s * 0.9);
      g.fillStyle = '#e0a21b';
      g.strokeStyle = '#3b2616';
      g.lineWidth = 1.5 * k;
      g.fillRect(x - wm / 2, y - wm / 2, wm, wm);
      g.strokeRect(x - wm / 2, y - wm / 2, wm, wm);
    }
    // điểm đến
    if (wp.dest) {
      const [x, y] = sc(wp.dest.x, wp.dest.z);
      g.fillStyle = '#d9382c';
      g.strokeStyle = '#fff';
      g.lineWidth = 2.5 * k;
      g.beginPath();
      g.arc(x, y - 9 * k, 6.5 * k, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(x - 4.5 * k, y - 5 * k);
      g.lineTo(x, y);
      g.lineTo(x + 4.5 * k, y - 5 * k);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(x, y - 9 * k, 2.4 * k, 0, Math.PI * 2);
      g.fill();
    }
    // người chơi: mũi tên theo hướng nhìn (hướng tiến = (-sin yaw, -cos yaw))
    const [px, py] = sc(me.x, me.z);
    const ang = Math.atan2(-Math.cos(me.yaw), -Math.sin(me.yaw));
    g.save();
    g.translate(px, py);
    g.rotate(ang);
    g.fillStyle = '#2f6fe0';
    g.strokeStyle = '#fff';
    g.lineWidth = 2 * k;
    g.beginPath();
    g.moveTo(8 * k, 0);
    g.lineTo(-5.5 * k, 5.5 * k);
    g.lineTo(-2.5 * k, 0);
    g.lineTo(-5.5 * k, -5.5 * k);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }

  // ------------------------------------------------------------------------------------------ bản đồ lớn

  open(): void {
    if (this.overlay) return;
    const w = this.w;
    this.pois = mapPois(w.city.layout, { vehicles: w.s.data.vehicles });
    const base = this.ensureBase();
    this.big = h('canvas', { class: 'mp-canvas' }) as HTMLCanvasElement;
    this.tip = h('div', { class: 'mp-tip' });
    this.routeInfo = h('div', { class: 'mp-route' });
    this.list = h('div', { class: 'mp-list' });
    const groups: Array<[Poi['group'], string]> = [['main', 'Địa điểm'], ['vehicle', 'Xe của bạn'], ['cross', 'Ngã tư'], ['alley', 'Hẻm']];
    for (const [gr, title] of groups) {
      const items = this.pois.filter((p) => p.group === gr);
      if (!items.length) continue;
      const det = h('details', { class: 'mp-group' }, [h('summary', { text: `${title} (${items.length})` })]);
      if (gr === 'main' || gr === 'vehicle') det.open = true;
      for (const p of items) det.append(h('button', { class: 'mp-poi', text: p.label, onClick: () => this.pick(p, true) }));
      this.list.append(det);
    }
    const panel = h('div', { class: 'mp-panel' }, [
      h('div', { class: 'mp-head' }, [
        h('b', { text: 'Bản đồ phố' }),
        h('span', { class: 'mp-hint', text: 'Cuộn: thu phóng · Kéo: di chuyển · Nhấp đúp: chỉ đường · M / Esc: đóng' }),
        h('button', { class: 'mp-clear', text: 'Xoá đường đi', onClick: () => w.waypoint.clear() }),
        h('button', { class: 'mp-close', text: '✕', onClick: () => this.close() }),
      ]),
      h('div', { class: 'mp-body' }, [h('div', { class: 'mp-map' }, [this.big, this.tip]), this.list]),
      this.routeInfo,
    ]);
    this.overlay = h('div', { class: 'map-overlay' }, [panel]);
    uiRoot().append(this.overlay);
    // khung nhìn ban đầu: lấy người chơi làm tâm, vừa đủ thấy vài khối phố
    const me = this.here();
    this.view = { cx: me.x, cz: me.z, s: 5 };
    requestAnimationFrame(() => this.resize(base));
    this.bindBig();
    this.renderRouteInfo();
    this.loop();
  }

  private resize(base: MapBase): void {
    if (!this.big) return;
    const r = this.big.parentElement!.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.big.width = Math.max(200, Math.round(r.width * dpr));
    this.big.height = Math.max(200, Math.round(r.height * dpr));
    // thu vừa cả bản đồ
    this.fitScale = Math.min(this.big.width / (base.canvas.width / base.ppm), this.big.height / (base.canvas.height / base.ppm));
    this.view.s = Math.max(this.fitScale * 2.2, 3 * dpr);
  }

  private bindBig(): void {
    const c = this.big!;
    const dpr = () => c.width / c.getBoundingClientRect().width;
    const toWorld = (e: MouseEvent) => {
      const r = c.getBoundingClientRect();
      const px = (e.clientX - r.left) * dpr();
      const py = (e.clientY - r.top) * dpr();
      return { px, py, x: this.view.cx + (px - c.width / 2) / this.view.s, z: this.view.cz + (py - c.height / 2) / this.view.s };
    };
    const nearest = (px: number, py: number): Poi | null => {
      let best: Poi | null = null;
      let bd = (12 * dpr()) ** 2;
      const zoomed = this.view.s > this.fitScale * 1.9;
      for (const p of this.pois) {
        if ((p.group === 'alley' || p.group === 'cross') && !zoomed) continue;
        const sx = (p.x - this.view.cx) * this.view.s + c.width / 2;
        const sy = (p.z - this.view.cz) * this.view.s + c.height / 2;
        const d = (sx - px) ** 2 + (sy - py) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    };
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const before = toWorld(e);
      const f = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      this.view.s = Math.max(this.fitScale * 0.9, Math.min(this.fitScale * 14, this.view.s * f));
      // giữ điểm dưới con trỏ đứng yên
      this.view.cx = before.x - (before.px - c.width / 2) / this.view.s;
      this.view.cz = before.z - (before.py - c.height / 2) / this.view.s;
    }, { passive: false });
    c.addEventListener('mousedown', (e) => { this.drag = { x: e.clientX, y: e.clientY, moved: false }; });
    window.addEventListener('mouseup', this.onUp);
    c.addEventListener('mousemove', (e) => {
      if (this.drag) {
        const dx = e.clientX - this.drag.x;
        const dy = e.clientY - this.drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) this.drag.moved = true;
        this.view.cx -= (dx * dpr()) / this.view.s;
        this.view.cz -= (dy * dpr()) / this.view.s;
        this.drag.x = e.clientX;
        this.drag.y = e.clientY;
      }
      const t = toWorld(e);
      const p = nearest(t.px, t.py);
      if (p && this.tip) {
        this.tip.textContent = p.label;
        this.tip.style.display = 'block';
        const r = c.getBoundingClientRect();
        this.tip.style.left = `${e.clientX - r.left + 12}px`;
        this.tip.style.top = `${e.clientY - r.top + 12}px`;
      } else if (this.tip) this.tip.style.display = 'none';
    });
    c.addEventListener('dblclick', (e) => {
      const t = toWorld(e);
      const p = nearest(t.px, t.py);
      if (p) this.pick(p, false);
      else this.pickPoint(t.x, t.z);
    });
    window.addEventListener('keydown', this.onKey, true);
  }

  private onUp = (): void => { this.drag = null; };

  private onKey = (e: KeyboardEvent): void => {
    if (e.code === 'Escape' || e.code === 'KeyM') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    }
  };

  /** Chọn một địa điểm (bấm trong danh sách hoặc nhấp đúp vào chấm). */
  private pick(p: Poi, recenter: boolean): void {
    if (recenter) { this.view.cx = p.x; this.view.cz = p.z; }
    this.setDest({ x: p.x, z: p.z, label: p.label });
  }

  private pickPoint(x: number, z: number): void {
    this.setDest({ x, z, label: `Điểm đã chọn (${Math.round(x)}, ${Math.round(z)})` });
  }

  private setDest(d: { x: number; z: number; label: string }): void {
    if (!this.w.waypoint.set(d)) this.w.toast('Không tìm được đường tới đó (bị nhà chắn?)', 'error');
    this.renderRouteInfo();
  }

  private loop = (): void => {
    if (!this.overlay || !this.big) return;
    this.draw(this.big, this.view, true);
    requestAnimationFrame(this.loop);
  };

  close(): void {
    if (!this.overlay) return;
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('mouseup', this.onUp);
    this.overlay.remove();
    this.overlay = null;
    this.big = null;
    this.tip = null;
    this.list = null;
    this.routeInfo = null;
    this.onClose();
  }

  destroy(): void {
    this.close();
    this.offs.forEach((f) => f());
  }
}
