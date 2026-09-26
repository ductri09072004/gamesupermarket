import { MAX_SLOT_CAPACITY } from '../config/constants';
import { getFurniture, type FurnitureDef } from '../config/furniture';
import { getProduct, type ProductDef } from '../config/products';

/** Hộp slot trong toạ độ cục bộ của nội thất (gốc giữa đáy, mặt trước hướng -Z). */
export interface SlotBox {
  x0: number; // mép trái
  width: number;
  y: number; // mặt đỡ
  height: number; // khoảng trống phía trên
  zFront: number;
  depth: number;
}

export interface ItemLayout {
  cols: number;
  rows: number;
  stacks: number;
  capacity: number;
  pitchX: number;
  pitchZ: number;
}

interface ShelfGeom {
  side: number;
  base: number;
  top: number;
  board: number;
  inset: number;
  /** Bề rộng panel bên phải (bàn phím máy bán hàng) */
  panel?: number;
  /** Treo hàng từ thanh ngang phía trên thay vì đặt trên mặt đỡ */
  hang?: boolean;
}

const GEOM: Record<string, ShelfGeom> = {
  // khớp 4 tấm gỗ dưới của kệ thép steel_frame_shelves_01 (mặt tầng ở 6.5% / 30% / 53.5% / 77% chiều cao)
  shelf: { side: 0.035, base: 0.1, top: 0.004, board: 0.012, inset: 0.03 },
  fridge: { side: 0.07, base: 0.22, top: 0.2, board: 0.02, inset: 0.06 },
  // đáy lòng tủ đông cao 0.55m để đứng xa vẫn thấy hàng (lòng tủ sâu ~32cm như tủ đảo thật)
  freezer: { side: 0.08, base: 0.55, top: 0.05, board: 0, inset: 0.08 },
  // khớp tầng của model kệ kho worn_metal_rack (mặt tầng 0.453 / 0.969 / 1.484m khi cao 2m)
  rack: { side: 0.02, base: 0.423, top: 0.03, board: 0.03, inset: 0.03 },
  clothing: { side: 0.04, base: 0.3, top: 0.2, board: 0, inset: 0.04, hang: true },
  electronics: { side: 0.05, base: 0.5, top: 0.12, board: 0.012, inset: 0.05 },
  vending: { side: 0.05, base: 0.4, top: 0.2, board: 0.015, inset: 0.1, panel: 0.28 },
};

/** Món có thể lồng vào nhau khi treo/xếp (mũ lưỡi trai) → bước theo chiều sâu nhỏ hơn. */
const NEST: Partial<Record<string, number>> = { cap: 0.28 };

export function shelfGeom(def: FurnitureDef): ShelfGeom {
  if (def.kind === 'rack') return GEOM.rack;
  if (def.vending) return GEOM.vending;
  return GEOM[def.storage ?? 'shelf'];
}

/** Độ cao mặt đỡ của từng tầng. */
export function tierHeights(def: FurnitureDef): number[] {
  const g = shelfGeom(def);
  const spacing = (def.size.h - g.base - g.top) / def.tiers;
  return Array.from({ length: def.tiers }, (_, i) => g.base + i * spacing);
}

/** Slot i = tầng (i / columns) × cột (i % columns). Tầng 0 là tầng dưới cùng. */
export function slotBox(def: FurnitureDef, index: number): SlotBox {
  const g = shelfGeom(def);
  const tier = Math.floor(index / def.columns);
  const col = index % def.columns;
  const innerW = def.size.w - g.side * 2 - (g.panel ?? 0);
  const cw = innerW / def.columns;
  const spacing = (def.size.h - g.base - g.top) / def.tiers;
  const y = g.base + tier * spacing + g.board;
  return {
    x0: -def.size.w / 2 + g.side + col * cw,
    width: cw,
    y,
    height: spacing - g.board - 0.02,
    zFront: -def.size.d / 2 + g.inset,
    depth: def.size.d - g.inset * 2,
  };
}

export function itemLayout(def: FurnitureDef, p: ProductDef): ItemLayout {
  const box = slotBox(def, 0);
  const [pw, ph, pd] = p.size;
  const pitchX = pw * 1.08;
  const pitchZ = pd * (NEST[p.shape] ?? 1.08);
  const cols = Math.max(1, Math.floor((box.width - 0.02) / pitchX));
  const rows = Math.max(1, Math.min(def.maxRows, Math.floor(box.depth / pitchZ)));
  const stacks = Math.max(1, Math.min(def.maxStack, Math.floor(box.height / ph)));
  return { cols, rows, stacks, capacity: Math.min(MAX_SLOT_CAPACITY, cols * rows * stacks), pitchX, pitchZ };
}

/** Sản phẩm có lọt ngăn không (máy bán hàng có ngăn hẹp). */
export function fitsSlot(def: FurnitureDef, p: ProductDef): boolean {
  const box = slotBox(def, 0);
  return p.size[0] <= box.width - 0.01 && p.size[1] <= box.height;
}

/** Nội thất có nhận loại hàng của sản phẩm không. */
export function acceptsProduct(def: FurnitureDef, p: ProductDef): boolean {
  if (def.kind !== 'display') return false;
  if (p.storage !== def.storage && !def.accepts.includes(p.storage)) return false;
  return !def.vending || fitsSlot(def, p);
}

/** Sức chứa của 1 slot cho sản phẩm (phụ thuộc kích thước sản phẩm). */
export function slotCapacity(furnType: string, productId: string): number {
  const def = getFurniture(furnType);
  if (def.kind !== 'display') return 0;
  return itemLayout(def, getProduct(productId)).capacity;
}

/**
 * Vị trí (cục bộ) của món thứ i trong slot. Lấp hàng trước (sát mép) trước, trái → phải, rồi lùi vào trong, rồi chồng lên.
 */
export function itemPosition(def: FurnitureDef, slotIndex: number, p: ProductDef, i: number): { x: number; y: number; z: number } {
  const box = slotBox(def, slotIndex);
  const l = itemLayout(def, p);
  const perLayer = l.cols * l.rows;
  const layer = Math.floor(i / perLayer);
  const j = i % perLayer;
  const row = Math.floor(j / l.cols);
  const col = j % l.cols;
  const usedW = l.cols * l.pitchX;
  const hang = shelfGeom(def).hang ? box.height - p.size[1] : 0;
  return {
    x: box.x0 + (box.width - usedW) / 2 + (col + 0.5) * l.pitchX,
    y: box.y + hang + layer * p.size[1],
    z: box.zFront + (row + 0.5) * l.pitchZ,
  };
}
