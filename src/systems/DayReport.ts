import { DEBT_DAYS_GAME_OVER, ELECTRICITY_BASE, RENT_PER_TILE, WAREHOUSE } from '../config/constants';
import { getFurniture } from '../config/furniture';
import type { SaveData } from '../core/GameState';
import { round2 } from '../core/Random';
import { totalWages } from './StaffSystem';

export interface Expenses {
  rent: number;
  electricity: number;
  wages: number;
}

export interface DayReport {
  day: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  customers: number;
  walkouts: number;
  itemsSold: number;
  changeLoss: number;
  expenses: Expenses;
  totalExpenses: number;
  netProfit: number;
  repStart: number;
  repEnd: number;
  xpGained: number;
  level: number;
  moneyEnd: number;
  debtDays: number;
  gameOver: boolean;
}

export function computeExpenses(d: SaveData): Expenses {
  const warehouseTiles = d.warehouseUnlocked ? WAREHOUSE.w * WAREHOUSE.d : 0;
  const rent = round2((d.storeW * d.storeH + warehouseTiles) * RENT_PER_TILE);
  const electricity = round2(ELECTRICITY_BASE + d.furniture.reduce((a, f) => a + getFurniture(f.type).electricity, 0));
  return { rent, electricity, wages: round2(totalWages(d.staff)) };
}

export function nextDebtDays(money: number, debtDays: number): number {
  return money < 0 ? debtDays + 1 : 0;
}

export function isGameOver(debtDays: number, enabled: boolean): boolean {
  return enabled && debtDays > DEBT_DAYS_GAME_OVER;
}

/** Tạo báo cáo (gọi sau khi đã trừ chi phí). */
export function buildReport(d: SaveData, expenses: Expenses): DayReport {
  const s = d.stats;
  const totalExpenses = round2(expenses.rent + expenses.electricity + expenses.wages);
  const grossProfit = round2(s.revenue - s.cogs);
  return {
    day: d.day,
    revenue: s.revenue,
    cogs: round2(s.cogs),
    grossProfit,
    customers: s.customers,
    walkouts: s.walkouts,
    itemsSold: s.itemsSold,
    changeLoss: round2(s.changeLoss),
    expenses,
    totalExpenses,
    netProfit: round2(grossProfit - totalExpenses - s.changeLoss),
    repStart: s.repStart,
    repEnd: d.reputation,
    xpGained: Math.round(s.xpGained),
    level: d.level,
    moneyEnd: d.money,
    debtDays: d.debtDays,
    gameOver: d.gameOver,
  };
}
