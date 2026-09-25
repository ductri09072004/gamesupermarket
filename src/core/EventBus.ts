import type { DayReport } from '../systems/DayReport';

export type SoundName =
  | 'beep' | 'ching' | 'door' | 'doorbell' | 'click' | 'error' | 'pop' | 'place' | 'levelup' | 'whoosh' | 'coin'
  | 'tock' | 'footstep' | 'truck' | 'drawerOpen' | 'drawerClose' | 'fold' | 'thud' | 'scan' | 'paper';

export interface GameEvents {
  'money:changed': { money: number; delta: number; reason: string };
  'time:changed': { day: number; minutes: number };
  'time:speed': { speed: number };
  'time:paused': { paused: boolean };
  'day:closing': { day: number };
  'day:canEnd': { canEnd: boolean };
  'day:ended': { report: DayReport };
  'day:started': { day: number };
  'xp:changed': { xp: number; level: number; needed: number };
  'level:up': { level: number };
  'reputation:changed': { reputation: number; delta: number };
  'store:toggled': { open: boolean };
  'inventory:changed': { furnitureUid: string };
  'boxes:changed': Record<string, never>;
  'order:placed': { orderId: string };
  'order:arrived': { orderId: string; boxUids: string[] };
  'price:changed': { productId: string; price: number };
  'license:bought': { id: number };
  'furniture:changed': Record<string, never>;
  'grid:changed': { reason: 'furniture' | 'expansion' | 'load' };
  'staff:changed': Record<string, never>;
  'customer:checkout': { customerId: string; amount: number };
  'customer:count': { count: number };
  /** gx/gy: toạ độ world X/Z (m) */
  'sale': { amount: number; gx: number; gy: number };
  'float:text': { text: string; gx: number; gy: number; color?: string };
  'delivery:truck': Record<string, never>;
  'toast': { message: string; kind?: 'info' | 'error' | 'success' };
  'ui:modal': { name: string; open: boolean };
  'ui:openPc': { app?: string };
  'ui:openPrice': { furnitureUid: string | null; slot?: number };
  'ui:pointerLock': { locked: boolean };
  'player:interact': { kind: string };
  'checkout:mode': { active: boolean; counterUid: string | null };
  'build:mode': { active: boolean };
  'build:hold': { furnitureId: string };
  'tutorial:done': { step: string };
  'sound': { name: SoundName; pos?: { x: number; y: number; z: number }; pitch?: number; volume?: number };
  'settings:changed': Record<string, never>;
  'game:over': Record<string, never>;
  'game:save': Record<string, never>;
  'game:saved': Record<string, never>;
  'game:quitToMenu': Record<string, never>;
  'debug:toggle': { on: boolean };
}

type Handler<T> = (payload: T) => void;

export class EventBus<E extends object = GameEvents> {
  private handlers = new Map<keyof E, Set<Handler<never>>>();

  on<K extends keyof E>(event: K, handler: Handler<E[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(event, handler);
  }

  once<K extends keyof E>(event: K, handler: Handler<E[K]>): () => void {
    const off = this.on(event, (p) => {
      off();
      handler(p);
    });
    return off;
  }

  off<K extends keyof E>(event: K, handler: Handler<E[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of [...set]) (h as Handler<E[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const bus = new EventBus<GameEvents>();
