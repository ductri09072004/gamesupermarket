// Mọi con số cân bằng game nằm ở đây.

// Isometric
export const TILE_W = 64;
export const TILE_H = 32;

// Thời gian
export const MINUTES_PER_SECOND = 1; // 1 giây thực = 1 phút game
export const OPEN_MINUTE = 8 * 60;
export const CLOSE_MINUTE = 22 * 60;
export const HARD_STOP_MINUTE = 23 * 60 + 59;
export const TIME_SPEEDS = [1, 2, 3] as const;

// Nhân vật
export const PLAYER_SPEED = 3; // ô / giây
export const CARRY_SPEED_MULT = 0.85;
export const CHARACTER_RADIUS = 0.22;
export const CUSTOMER_SPEED = 2.2;
export const STAFF_SPEED = 2.6;
export const INTERACT_RANGE = 1.5;
export const STOCK_REPEAT_MS = 150;

// Kinh tế
export const CURRENCY = '$';
export const START_MONEY = 1500;
export const START_REPUTATION = 2.5;
export const MAX_REPUTATION = 5;
export const PRICE_FLUCTUATION = 0.05;
export const XP_PER_REVENUE = 0.1; // XP = doanh thu / 10
export const XP_BASE = 60;
export const XP_EXPONENT = 1.5;
export const RENT_PER_TILE = 0.4;
export const ELECTRICITY_BASE = 8;
export const FURNITURE_SELL_REFUND = 0.5;
export const DEBT_DAYS_GAME_OVER = 3;
export const TRANSACTION_HISTORY = 100;

// Danh tiếng
export const REP_TOO_EXPENSIVE = -0.01;
export const REP_OUT_OF_STOCK = -0.005;
export const REP_WALKOUT = -0.1;
export const REP_SHORT_CHANGE = -0.15;
export const REP_FAST_CHECKOUT = 0.04;
export const REP_NORMAL_CHECKOUT = 0.015;
export const REP_SLOW_CHECKOUT = -0.02;
export const FAST_CHECKOUT_S = 15;
export const SLOW_CHECKOUT_S = 40;

// Bản đồ
export const INITIAL_STORE_W = 12;
export const INITIAL_STORE_H = 10;
export const MAX_STORE_W = 24;
export const MAX_STORE_H = 20;
export const DOOR_X = 2;
export const WAREHOUSE = { x0: -6, y0: 0, w: 5, h: 5, doorY: 2 };
export const WAREHOUSE_PRICE = 800;
export const WAREHOUSE_LEVEL = 3;
export const EXPANSION_STEP = 2;
export const EXPANSION_BASE_PRICE = 600;
export const EXPANSION_PRICE_GROWTH = 1.35;

// Giao hàng
export const DELIVERY_MIN_MS = 10_000;
export const DELIVERY_MAX_MS = 20_000;
export const DELIVERY_STACK = 3;

// Khách hàng
export const MAX_CUSTOMERS = 25;
export const QUEUE_PATIENCE_S = 60;
export const BASE_CUSTOMERS_PER_HOUR = 4.5;
export const PEAK_HOURS: Array<[number, number]> = [[11, 13], [17, 20]];
export const PEAK_MULT = 1.8;
export const EARLY_MULT = 0.8;
export const MIN_WISH = 1;
export const MAX_WISH = 6;
export const PICK_TIME_S = 0.8;
export const QUEUE_MAX_TILES = 10;

// Nhân viên
export const STAFF_UNLOCK_LEVEL = 5;
export const STAFF_SCAN_S = 0.9;
export const STAFF_PAY_S = 2.2;
export const STAFF_STOCK_S = 0.4;
export const RESTOCK_THRESHOLD = 0.3;

// Camera
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2;
export const CHECKOUT_ZOOM = 1.5;

// Lưu game
export const SAVE_KEY = 'minimart-tycoon-save';
export const SAVE_VERSION = 2;

// Thu ngân
export const DENOMINATIONS = [50, 20, 10, 5, 1, 0.25, 0.1, 0.05, 0.01];
