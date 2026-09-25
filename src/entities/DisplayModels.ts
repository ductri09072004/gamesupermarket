import * as THREE from 'three';
import type { FurnitureDef } from '../config/furniture';
import { shelfGeom, tierHeights } from '../systems/SlotLayout';
import { textCanvas } from '../products/LabelTexture';
import { backShade, block, mat } from './FurnitureModels';
import { coolerGlass, cyl, emissive, grille, pegboard, plastic, powder, rblock, steel, wireDeck } from './DisplayMaterials';

/** Kệ gondola, tủ mát cửa kính, tủ đông đảo — dựng bằng khối vát cạnh + vật liệu PBR (gốc giữa đáy, mặt trước -Z). */

const ACCENT = 0x2a9d8f;

/** 4 chân tăng chỉnh dưới đế. */
function feet(g: THREE.Group, x0: number, x1: number, z0: number, z1: number, h: number): void {
  for (const x of [x0, x1]) for (const z of [z0, z1]) g.add(cyl(steel(), 0.014, 0, h, x, z));
}

export function gondola(def: FurnitureDef, g: THREE.Group): void {
  const { w, d, h } = def.size;
  const geo = shelfGeom(def);
  const body = powder(0xeef0f2, 0.45);
  const dark = powder(0x4b5563, 0.55);
  const xi0 = -w / 2 + geo.side;
  const xi1 = w / 2 - geo.side;
  const FOOT = 0.015;
  feet(g, -w / 2 + 0.02, w / 2 - 0.02, -d / 2 + 0.04, d / 2 - 0.04, FOOT);
  // 2 trụ đầu kệ + lưng + pegboard
  for (const [a, b] of [[-w / 2, xi0], [xi1, w / 2]]) g.add(rblock(body, a, b, FOOT, h - geo.top, -d / 2, d / 2, 0.01));
  g.add(rblock(body, xi0, xi1, geo.base, h - geo.top, d / 2 - 0.03, d / 2, 0.004));
  g.add(block(pegboard(), xi0, xi1, geo.base, h - geo.top, d / 2 - 0.036, d / 2 - 0.03, false));
  // đế: tấm chắn chân lùi vào (toe-kick) để nhãn giá tầng dưới cùng không bị che
  g.add(rblock(dark, xi0, xi1, FOOT, geo.base, -d / 2 + 0.035, d / 2 - 0.03, 0.006));
  const rail = plastic(0xdfe4ea, 0.3);
  for (const y of tierHeights(def)) {
    g.add(rblock(body, xi0, xi1, y, y + geo.board, -d / 2 + 0.035, d / 2 - 0.036, 0.006));
    // nẹp giá phía trước tầng (nhãn giá gắn trên mặt nẹp, nằm trước nẹp 2mm)
    g.add(rblock(rail, xi0, xi1, y - 0.045, y + geo.board + 0.004, -d / 2 + 0.02, -d / 2 + 0.035, 0.004, false));
    // tay đỡ 2 bên dưới tấm kệ
    if (y > geo.base + 0.01) for (const x of [xi0, xi1 - 0.012]) g.add(block(dark, x, x + 0.012, y - 0.06, y, -d / 2 + 0.06, d / 2 - 0.036, false));
  }
  // mũ kệ + dải màu thương hiệu
  g.add(rblock(dark, -w / 2, w / 2, h - geo.top, h, -d / 2, d / 2, 0.012));
  g.add(rblock(plastic(ACCENT, 0.4), -w / 2 + 0.02, w / 2 - 0.02, h - geo.top + 0.014, h - 0.014, -d / 2 - 0.003, -d / 2 + 0.01, 0.003, false));
  backShade(def, g, d / 2 - 0.038);
}

function fridgeHeader(): THREE.Material {
  return mat('fridgeHeader', () => {
    const t = textCanvas(512, 64, (c) => {
      const gr = c.createLinearGradient(0, 0, 0, 64);
      gr.addColorStop(0, '#2563eb');
      gr.addColorStop(1, '#1d4ed8');
      c.fillStyle = gr;
      c.fillRect(0, 0, 512, 64);
      c.fillStyle = '#fff';
      c.font = '900 40px "Nunito", Arial';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('❄ LẠNH & TƯƠI', 256, 34);
    });
    return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.6, roughness: 0.3 });
  });
}

export function fridge(def: FurnitureDef, g: THREE.Group): void {
  const { w, d, h } = def.size;
  const geo = shelfGeom(def);
  const shell = powder(0xf3f5f7, 0.4);
  const frame = powder(0x23272d, 0.45);
  const liner = plastic(0xe9eef3, 0.5);
  const xi0 = -w / 2 + geo.side;
  const xi1 = w / 2 - geo.side;
  const top = h - geo.top;
  feet(g, -w / 2 + 0.04, w / 2 - 0.04, -d / 2 + 0.06, d / 2 - 0.06, 0.02);
  for (const [a, b] of [[-w / 2, xi0], [xi1, w / 2]]) g.add(rblock(shell, a, b, 0.02, top, -d / 2, d / 2, 0.012));
  g.add(rblock(shell, -w / 2, w / 2, top, h, -d / 2, d / 2, 0.02));
  g.add(rblock(shell, xi0, xi1, geo.base, top, d / 2 - 0.04, d / 2, 0.004));
  g.add(block(liner, xi0, xi1, geo.base, top, d / 2 - 0.062, d / 2 - 0.04, false));
  backShade(def, g, d / 2 - 0.064, 0.4);
  // chân tủ: khối tối + lưới tản nhiệt mặt trước
  g.add(rblock(powder(0x2f3640, 0.6), xi0, xi1, 0.02, geo.base, -d / 2 + 0.04, d / 2 - 0.04, 0.006));
  g.add(block(grille(), xi0 + 0.02, xi1 - 0.02, 0.05, geo.base - 0.03, -d / 2 + 0.03, -d / 2 + 0.04, false));
  g.add(block(liner, xi0, xi1, geo.base - 0.01, geo.base, -d / 2 + 0.04, d / 2 - 0.04));
  // biển đầu tủ phát sáng
  g.add(block(fridgeHeader(), -w / 2 + 0.06, w / 2 - 0.06, top + 0.035, h - 0.035, -d / 2 - 0.006, -d / 2 - 0.002, false));
  // tầng lưới + thanh chặn trước
  const deckGeo = new THREE.PlaneGeometry(xi1 - xi0, d - 0.14).rotateX(-Math.PI / 2);
  for (const y of tierHeights(def)) {
    if (y > geo.base + 0.01) {
      const deck = new THREE.Mesh(deckGeo, wireDeck());
      deck.position.set(0, y + geo.board, 0.01);
      g.add(deck);
    }
    g.add(rblock(steel(), xi0, xi1, y + geo.board - 0.004, y + geo.board + 0.014, -d / 2 + 0.05, -d / 2 + 0.058, 0.003, false));
  }
  // đèn LED: thanh ngang trên + dải dọc sau trụ giữa
  const led = emissive('coolerLed', 0xeaf6ff, 2.2);
  g.add(block(led, xi0 + 0.04, xi1 - 0.04, top - 0.02, top, -d / 2 + 0.06, -d / 2 + 0.1, false));
  g.add(block(led, -0.012, 0.012, geo.base + 0.02, top - 0.02, -d / 2 + 0.035, -d / 2 + 0.04, false));
  // khung cửa: trụ giữa + 2 cánh kính khung đen, tay nắm inox
  const F = 0.035;
  const z0 = -d / 2 - 0.03;
  const z1 = -d / 2;
  g.add(rblock(frame, -0.02, 0.02, geo.base, top, z0, z1 + 0.03, 0.004));
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -w / 2 + 0.02 : 0.022;
    const x1 = s < 0 ? -0.022 : w / 2 - 0.02;
    const y0 = geo.base + 0.005;
    const y1 = top - 0.005;
    g.add(rblock(frame, x0, x1, y0, y0 + F, z0, z1, 0.006));
    g.add(rblock(frame, x0, x1, y1 - F, y1, z0, z1, 0.006));
    g.add(rblock(frame, x0, x0 + F, y0 + F, y1 - F, z0, z1, 0.006));
    g.add(rblock(frame, x1 - F, x1, y0 + F, y1 - F, z0, z1, 0.006));
    const pane = block(coolerGlass(), x0 + F, x1 - F, y0 + F, y1 - F, z0 + 0.012, z0 + 0.018, false);
    g.add(pane);
    const hx = s < 0 ? x1 - 0.07 : x0 + 0.07;
    g.add(rblock(steel(), hx - 0.012, hx + 0.012, 0.75, 1.45, z0 - 0.045, z0 - 0.02, 0.01, false));
    for (const y of [0.8, 1.4]) g.add(block(steel(), hx - 0.006, hx + 0.006, y - 0.01, y + 0.01, z0 - 0.02, z0, false));
  }
}

export function freezer(def: FurnitureDef, g: THREE.Group): void {
  const { w, d, h } = def.size;
  const geo = shelfGeom(def);
  const shell = powder(0xf6f7f9, 0.35);
  const t = 0.07;
  const PLINTH = 0.06;
  g.add(rblock(powder(0x2f3640, 0.6), -w / 2 + 0.03, w / 2 - 0.03, 0, PLINTH, -d / 2 + 0.03, d / 2 - 0.03, 0.01));
  // 4 thành tủ (rỗng giữa để nhìn thấy hàng)
  g.add(rblock(shell, -w / 2, w / 2, PLINTH, h - 0.03, -d / 2, -d / 2 + t, 0.02));
  g.add(rblock(shell, -w / 2, w / 2, PLINTH, h - 0.03, d / 2 - t, d / 2, 0.02));
  for (const x of [-w / 2, w / 2 - t]) g.add(rblock(shell, x, x + t, PLINTH, h - 0.03, -d / 2 + t - 0.01, d / 2 - t + 0.01, 0.02));
  // lòng tủ: đáy + ốp trong sáng
  const liner = plastic(0xdde8f0, 0.55);
  g.add(block(liner, -w / 2 + t, w / 2 - t, geo.base - 0.02, geo.base, -d / 2 + t, d / 2 - t, false));
  // cản va quanh thân (dải màu thương hiệu lạnh)
  const bumper = plastic(0x2563eb, 0.35);
  g.add(rblock(bumper, -w / 2 - 0.012, w / 2 + 0.012, 0.14, 0.2, -d / 2 - 0.014, -d / 2 + 0.02, 0.012, false));
  g.add(rblock(bumper, -w / 2 - 0.012, w / 2 + 0.012, 0.14, 0.2, d / 2 - 0.02, d / 2 + 0.014, 0.012, false));
  for (const x of [-w / 2 - 0.014, w / 2 - 0.02]) g.add(rblock(bumper, x, x + 0.034, 0.14, 0.2, -d / 2, d / 2, 0.012, false));
  // vách ngăn giữa các ngăn
  const div = powder(0xe3e9ef, 0.4);
  for (let i = 1; i < def.columns; i++) {
    const x = -w / 2 + t + ((w - 2 * t) * i) / def.columns;
    g.add(block(div, x - 0.008, x + 0.008, geo.base, h - 0.1, -d / 2 + t, d / 2 - t, false));
  }
  // viền nhôm miệng tủ + 2 tấm kính lùa (so le độ cao)
  const rim = steel();
  g.add(rblock(rim, -w / 2, w / 2, h - 0.035, h, -d / 2, -d / 2 + t, 0.008));
  g.add(rblock(rim, -w / 2, w / 2, h - 0.035, h, d / 2 - t, d / 2, 0.008));
  for (const x of [-w / 2, w / 2 - t]) g.add(rblock(rim, x, x + t, h - 0.035, h, -d / 2 + t, d / 2 - t, 0.008));
  const edge = plastic(0x9aa3ad, 0.4);
  const half = (w - 2 * t) / 2;
  for (const [i, y] of [[0, h - 0.028], [1, h - 0.014]] as const) {
    const x0 = -w / 2 + t + i * (half - 0.04);
    const x1 = x0 + half + 0.04;
    g.add(block(coolerGlass(), x0, x1, y, y + 0.006, -d / 2 + t, d / 2 - t, false));
    for (const x of [x0, x1 - 0.02]) g.add(block(edge, x, x + 0.02, y - 0.004, y + 0.01, -d / 2 + t, d / 2 - t, false));
  }
}
