import { describe, expect, it } from 'vitest';
import { makeFurniture, type BoxData } from '../src/core/GameState';
import {
  findStockSlot, productQty, rackCanAdd, restockTargets, stockOne, takeBackOne, takeFromShelf,
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

  it('xếp vào slot trống, sau đó vào slot cùng sản phẩm', () => {
    const shelf = makeFurniture('f', 'shelf_large', 0, 0);
    const b = box('noodles', 20);
    for (let i = 0; i < 12; i++) expect(stockOne(b, shelf).ok).toBe(true);
    expect(shelf.slots[0]).toEqual({ productId: 'noodles', qty: 12 });
    expect(stockOne(b, shelf).ok).toBe(true);
    expect(shelf.slots[1]).toEqual({ productId: 'noodles', qty: 1 });
    expect(b.qty).toBe(7);
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
    stockOne(box('noodles', 1), shelf);
    stockOne(box('water', 1), shelf);
    const r = stockOne(box('candy', 3), shelf);
    expect(r.ok).toBe(false);
  });

  it('slot rỗng (qty 0) nhận sản phẩm khác', () => {
    const shelf = makeFurniture('f', 'shelf_small', 0, 0);
    stockOne(box('noodles', 1), shelf);
    stockOne(box('water', 1), shelf);
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
    const b = box('noodles', 14);
    while (b.qty > 0) stockOne(b, shelf);
    expect(takeFromShelf(shelf, 'noodles', 20)).toBe(14);
    expect(productQty(shelf, 'noodles')).toBe(0);
  });

  it('mục tiêu châm hàng < 30%', () => {
    const shelf = makeFurniture('f', 'shelf_large', 0, 0);
    shelf.slots[0] = { productId: 'noodles', qty: 2 };
    shelf.slots[1] = { productId: 'water', qty: 10 };
    const t = restockTargets([shelf], 0.3);
    expect(t).toHaveLength(1);
    expect(t[0].productId).toBe('noodles');
  });

  it('kệ kho chứa tối đa 4 thùng', () => {
    const rack = makeFurniture('r', 'rack', 0, 0);
    expect(rackCanAdd(rack)).toBe(true);
    rack.boxes = ['a', 'b', 'c', 'd'];
    expect(rackCanAdd(rack)).toBe(false);
    expect(findStockSlot(rack, 'noodles').ok).toBe(false);
  });
});
