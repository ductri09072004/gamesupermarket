import { STREET_NAMES, VN_PASTELS } from '../config/city';
import { STORE_FRONT_Z } from '../config/constants';
import { houseRect, V_ROADS, type CityLayout, type Rect } from '../world/CityLayout';

/** Ảnh nền tĩnh của bản đồ (vẽ một lần, dùng cho cả bản đồ nhỏ & lớn): đường, vỉa hè, nhà, hẻm, cửa hàng, kho, tên đường. */
export interface MapBase {
  canvas: HTMLCanvasElement;
  /** Số điểm ảnh trên mỗi mét */
  ppm: number;
  x0: number;
  z0: number;
}

const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export function renderMapBase(L: CityLayout, storeW: number, storeH: number, ppm = 4): MapBase {
  const b = L.bounds;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((b.x1 - b.x0) * ppm);
  canvas.height = Math.ceil((b.z1 - b.z0) * ppm);
  const g = canvas.getContext('2d')!;
  const X = (x: number) => (x - b.x0) * ppm;
  const Z = (z: number) => (z - b.z0) * ppm;
  const fill = (r: Rect, color: string) => { g.fillStyle = color; g.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * ppm, (r.z1 - r.z0) * ppm); };
  const stroke = (r: Rect, color: string, w = 1) => { g.strokeStyle = color; g.lineWidth = w; g.strokeRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * ppm, (r.z1 - r.z0) * ppm); };

  fill(b, '#7d8a58'); // cỏ ngoài phố
  for (const k of L.blocks) fill(k, '#d3c9b0'); // vỉa hè quanh mỗi khối
  for (const r of L.roads) fill(r, '#5b5a5e');
  // vạch tim đường
  g.strokeStyle = 'rgba(240,235,215,0.55)';
  g.lineWidth = 1;
  g.setLineDash([ppm * 2, ppm * 2]);
  for (const c of L.centerLines) {
    g.beginPath();
    if (c.axis === 'x') { g.moveTo(X(c.from), Z(c.c)); g.lineTo(X(c.to), Z(c.c)); } else { g.moveTo(X(c.c), Z(c.from)); g.lineTo(X(c.c), Z(c.to)); }
    g.stroke();
  }
  g.setLineDash([]);
  // nhà
  for (const p of L.placements) {
    if (p.kind !== 'building') continue;
    const r = houseRect(p);
    fill(r, css(VN_PASTELS[p.variant % VN_PASTELS.length]));
    stroke(r, 'rgba(90,70,45,0.55)', 0.8);
  }
  // hẻm: dải sáng cắt giữa các nhà
  for (const a of L.alleys) {
    fill(a.rect, '#efe6cf');
    g.strokeStyle = 'rgba(120,100,70,0.6)';
    g.lineWidth = 0.7;
    g.strokeRect(X(a.rect.x0), Z(a.rect.z0), (a.rect.x1 - a.rect.x0) * ppm, (a.rect.z1 - a.rect.z0) * ppm);
  }
  // bãi đỗ, kho sỉ
  fill(L.lot, '#8f8c88');
  stroke(L.lot, '#e9e4d0', 1);
  fill(L.depot.shed, '#a8774f');
  fill(L.depot.pad, '#e9c34a');
  stroke(L.depot.shed, '#5a3a22', 1.2);
  // cửa hàng
  const front = STORE_FRONT_Z;
  const store: Rect = { x0: 0, x1: storeW, z0: front - storeH, z1: front };
  fill(store, '#f1d9a8');
  stroke(store, '#b8402d', 2.4);
  // nhà trạm xe buýt
  fill(L.busStop.shelter, '#3f7d5a');

  // tên đường
  g.fillStyle = '#f3ecd8';
  g.strokeStyle = 'rgba(30,25,20,0.8)';
  g.lineJoin = 'round';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `800 ${Math.round(2.4 * ppm)}px "Be Vietnam Pro", Arial, sans-serif`;
  const label = (text: string, x: number, z: number, rot: number) => {
    g.save();
    g.translate(X(x), Z(z));
    g.rotate(rot);
    g.lineWidth = 3;
    g.strokeText(text, 0, 0);
    g.fillText(text, 0, 0);
    g.restore();
  };
  L.hz.forEach((Zc, j) => {
    for (let x = b.x0 + 40; x < b.x1 - 30; x += 70) label(STREET_NAMES.horizontal[j], x, Zc, 0);
  });
  V_ROADS.forEach((Xc, i) => {
    for (const z of [(L.hz[0] + L.hz[1]) / 2, (L.hz[1] + L.hz[2]) / 2]) label(STREET_NAMES.vertical[i], Xc, z, -Math.PI / 2);
  });
  return { canvas, ppm, x0: b.x0, z0: b.z0 };
}
