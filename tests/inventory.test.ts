import { describe, expect, it } from 'vitest';
import { makeFurniture, type BoxData } from '../src/core/GameState';
import { itemLayout, itemPosition, slotBox, slotCapacity } from '../src/systems/SlotLayout';
import { getFurniture } from '../src/config/furniture';
import { PRODUCTS, getProduct } from '../src/config/products';
import {
  canStockSlot, findStockSlot, productQty, rackCanAdd, restockTargets, stockOne, takeBackOne, takeFromShelf,
} from '../src/systems/InventorySystem';

function box(productId: string, qty: number, open = true): BoxData {
  return { uid: 'b1', productId, qty, open, gx: 0, gy: 0, location: 'held', holderId: null };
}

describe('Luật xếp kệ', () => {
  it('thùng đóng không xếp được', () => {
    const shelf = makeFurniture('f', 'shelf_large', 0, 0);
    const r = stockOne(box('noodles', 5, false), shelf);
    expect(r.ok).toBe(false);
  });

  it('xếp vào slot trống, đầy thì sang slot khác', () => {
    const shelf = makeFurniture('f', 'shelf_large', 0, 0);
    const cap = slotCapacity('shelf_large', 'rice');
    const b = box('rice', cap + 3);
    for (let i = 0; i < cap; i++) expect(stockOne(b, shelf).ok).toBe(true);
    expect(shelf.slots[0]).toEqual({ productId: 'rice', qty: cap });
    expect(stockOne(b, shelf).ok).toBe(true);
    expect(shelf.slots[1]).toEqual({ productId: 'rice', qty: 1 });
    expect(b.qty).toBe(2);
  });

  it('xếp vào slot chỉ định: slot khác sản phẩm bị từ chối', () => {
    const shelf = makeFurniture('f', 'shelf_large', 0, 0);
    expect(stockOne(box('water', 3), shelf, 2).ok).toBe(true);
    const r = stockOne(box('soda', 3), shelf, 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('khác');
    expect(canStockSlot(shelf, 3, 'soda').ok).toBe(true);
  });

  it('sai loại storage → báo lý do', () => {
    const shelf = makeFurniture('f', 'shelf_small', 0, 0);
    const r = stockOne(box('milk', 5), shelf);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('tủ lạnh');
    const fridge = makeFurniture('g', 'fridge', 0, 0);
    expect(stockOne(box('milk', 5), fridge).ok).toBe(true);
    expect(stockOne(box('icecream', 5), fridge).ok).toBe(false);
  });

  it('không xếp khi hết slot trống', () => {
    const shelf = makeFurniture('f', 'shelf_small', 0, 0);
    for (const id of ['noodles', 'water', 'soda', 'chips']) stockOne(box(id, 1), shelf);
    const r = stockOne(box('candy', 3), shelf);
    expect(r.ok).toBe(false);
  });

  it('slot rỗng (qty 0) nhận sản phẩm khác', () => {
    const shelf = makeFurniture('f', 'shelf_small', 0, 0);
    for (const id of ['noodles', 'water', 'soda', 'chips']) stockOne(box(id, 1), shelf);
    takeFromShelf(shelf, 'noodles', 1);
    expect(stockOne(box('candy', 3), shelf).ok).toBe(true);
    expect(shelf.slots[0].productId).toBe('candy');
  });

  it('lấy lại hàng vào thùng (Shift+E)', () => {
    const shelf = makeFurniture('f', 'shelf_large', 0, 0);
    const b = box('noodles', 3);
    stockOne(b, shelf);
    stockOne(b, shelf);
    expect(takeBackOne(b, shelf).ok).toBe(true);
    expect(b.qty).toBe(2);
    const empty = box('water', 0);
    expect(takeBackOne(empty, shelf).ok).toBe(true);
    expect(empty.productId).toBe('noodles');
    expect(productQty(shelf, 'noodles')).toBe(0);
    expect(takeBackOne(box('water', 0), shelf).ok).toBe(false);
  });

  it('thùng đầy không lấy lại được', () => {
    const shelf = makeFurniture('f', 'shelf_large', 0, 0);
    stockOne(box('rice', 5), shelf);
    const full = box('rice', 10);
    expect(takeBackOne(full, shelf).ok).toBe(false);
  });

  it('khách lấy hàng qua nhiều slot', () => {
    const shelf = makeFurniture('f', 'shelf_large', 0, 0);
    const n = slotCapacity('shelf_large', 'noodles') + 2;
    const b = box('noodles', n);
    while (b.qty > 0) stockOne(b, shelf);
    expect(takeFromShelf(shelf, 'noodles', 999)).toBe(n);
    expect(productQty(shelf, 'noodles')).toBe(0);
  });

  it('mục tiêu châm hàng < 30%', () => {
    const shelf = makeFurniture('f', 'shelf_large', 0, 0);
    shelf.slots[0] = { productId: 'noodles', qty: 1 };
    shelf.slots[1] = { productId: 'water', qty: slotCapacity('shelf_large', 'water') };
    const t = restockTargets([shelf], 0.3);
    expect(t).toHaveLength(1);
    expect(t[0].productId).toBe('noodles');
  });

  it('kệ kho chứa tối đa 6 thùng', () => {
    const rack = makeFurniture('r', 'rack', 0, 0);
    expect(rackCanAdd(rack)).toBe(true);
    rack.boxes = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(rackCanAdd(rack)).toBe(false);
    expect(findStockSlot(rack, 'noodles').ok).toBe(false);
  });
});

describe('Bố cục slot theo kích thước sản phẩm', () => {
  it('mọi sản phẩm vừa slot của loại kệ đúng storage, sức chứa hợp lý', () => {
    for (const p of PRODUCTS) {
      const type = p.storage === 'shelf' ? 'shelf_large' : p.storage;
      const cap = slotCapacity(type, p.id);
      expect(cap, p.id).toBeGreaterThanOrEqual(4);
      expect(cap, p.id).toBeLessThanOrEqual(40);
    }
    expect(slotCapacity('shelf_large', 'soda')).toBeGreaterThan(slotCapacity('shelf_large', 'detergent'));
  });

  it('vị trí từng món nằm trong hộp slot và không trùng nhau', () => {
    const def = getFurniture('shelf_large');
    for (const id of ['soda', 'rice', 'tissue']) {
      const p = getProduct(id);
      const l = itemLayout(def, p);
      const b = slotBox(def, 5);
      const seen = new Set<string>();
      for (let i = 0; i < l.capacity; i++) {
        const q = itemPosition(def, 5, p, i);
        expect(q.x - p.size[0] / 2).toBeGreaterThanOrEqual(b.x0 - 1e-6);
        expect(q.x + p.size[0] / 2).toBeLessThanOrEqual(b.x0 + b.width + 1e-6);
        expect(q.z + p.size[2] / 2).toBeLessThanOrEqual(b.zFront + b.depth + 1e-6);
        expect(q.y + p.size[1]).toBeLessThanOrEqual(b.y + b.height + 1e-6);
        seen.add(`${q.x.toFixed(3)},${q.y.toFixed(3)},${q.z.toFixed(3)}`);
      }
      expect(seen.size).toBe(l.capacity);
    }
  });
});
