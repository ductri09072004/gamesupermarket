// Mọi con số cân bằng game nằm ở đây. Đơn vị không gian: mét (1 unit = 1m), trục Y hướng lên.

// Lưới
export const CELL = 0.5; // ô NavGrid (m)

// Thời gian
export const MINUTES_PER_SECOND = 1; // 1 giây thực = 1 phút game
export const OPEN_MINUTE = 8 * 60;
export const CLOSE_MINUTE = 22 * 60;
export const HARD_STOP_MINUTE = 23 * 60 + 59;
export const TIME_SPEEDS = [1, 2, 3] as const;
export const LOGIC_HZ = 60;

// Người chơi
export const EYE_HEIGHT = 1.65;
export const CROUCH_EYE_HEIGHT = 1.05;
export const PLAYER_RADIUS = 0.3;
export const WALK_SPEED = 3.2;
export const RUN_SPEED = 5;
export const CROUCH_SPEED = 1.6;
export const CARRY_SPEED_MULT = 0.9;
export const REACH = 2.5;
export const JUMP_VELOCITY = 4.6; // m/s → cao ~0.8m
export const GRAVITY = 13;
export const AIR_CONTROL = 0.25; // tỉ lệ khả năng đổi hướng khi đang bay
export const DEFAULT_FOV = 70;
export const MOUSE_SENSITIVITY = 0.0022;

// NPC
export const CUSTOMER_SPEED = 1.3; // m/s
export const STAFF_SPEED = 1.5;
export const NPC_ANIM_CULL_DISTANCE = 25;

// Kinh tế
export const CURRENCY = '$';
export const START_MONEY = 1500;
export const START_REPUTATION = 2.5;
export const MAX_REPUTATION = 5;
export const PRICE_FLUCTUATION = 0.05;
export const XP_PER_REVENUE = 0.1; // XP = doanh thu / 10
export const XP_BASE = 60;
export const XP_EXPONENT = 1.5;
export const RENT_PER_TILE = 0.4; // $/m²/ngày
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
export const FAST_CHECKOUT_S = 20;
export const SLOW_CHECKOUT_S = 50;

// Cửa hàng (m)
export const INITIAL_STORE_W = 12; // theo trục X
export const INITIAL_STORE_H = 10; // độ sâu theo trục Z
export const MAX_STORE_W = 24;
export const MAX_STORE_H = 20;
export const CEILING_HEIGHT = 3.2;
export const WALL_THICKNESS = 0.2;
export const DOOR_X = 3; // tâm cửa (m)
export const DOOR_WIDTH = 2;
export const SIDEWALK_DEPTH = 3;
export const WAREHOUSE = { x0: 0, z0: -6, w: 10, d: 6, doorX: 5 };
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
export const PICK_TIME_S = 1.0;
export const QUEUE_MAX_TILES = 14;
export const QUEUE_SPACING_CELLS = 2;

// Nhân viên
export const STAFF_UNLOCK_LEVEL = 5;
export const STAFF_SCAN_S = 0.9;
export const STAFF_PAY_S = 2.2;
export const STAFF_STOCK_S = 0.25;
export const RESTOCK_THRESHOLD = 0.3;
/** Nhân viên chăm sóc khách: thời gian hỗ trợ 1 khách ở máy tự tính tiền (s, chia cho tốc độ) */
export const STAFF_HELP_S = 2.5;

// Máy tự tính tiền
/** Khách tự quét 1 món (chậm hơn thu ngân) rồi tự chạm thẻ thanh toán tại máy */
export const SELF_SCAN_S = 2.0;
export const SELF_PAY_S = 3;
/** Xác suất khách lúng túng = BASE + PER_ITEM × số món (+ ELDER nếu lớn tuổi), tối đa MAX */
export const SELF_HELP_BASE = 0.05;
export const SELF_HELP_PER_ITEM = 0.02;
export const SELF_HELP_ELDER = 0.15;
export const SELF_HELP_MAX = 0.3;
/** Lúng túng thì tự mò ra sau N giây (không bắt buộc người chơi giúp; giúp chỉ để nhanh hơn + uy tín) */
export const SELF_HELP_SOLO_S = 8;
/** Sau khi được giúp, các món còn lại quét nhanh gấp N lần */
export const SELF_ASSIST_SPEEDUP = 3;
/** Khách hơi thích quầy có người: máy tự tính được tính như dài thêm N người khi chọn hàng */
export const SELF_QUEUE_BIAS = 0.6;
export const REP_SELF_HELPED = 0.02;

// Đèn & ngày đêm
/** Số PointLight thật (không đổ bóng) gán cho các đèn trần gần camera — cố định để không phải biên dịch lại shader */
export const LAMP_POOL = 8;
/** Độ sáng trong cửa hàng (0..1) dưới mức này thì khách chê tối và bỏ về */
export const DARK_THRESHOLD = 0.3;
export const REP_TOO_DARK = -0.02;

// Chế độ developer
export const DEV_MONEY = 1_000_000;
export const DEV_MONEY_BONUS = 100_000;

// Kệ
export const MAX_SLOT_ROWS = 3;
export const MAX_SLOT_CAPACITY = 40;
export const MAX_PRODUCT_INSTANCES = 5000;

// Lưu game
export const SAVE_KEY = 'minimart-tycoon-3d-save';
export const SAVE_VERSION = 4;

// Thu ngân
export const DENOMINATIONS = [50, 20, 10, 5, 1, 0.25, 0.1, 0.05, 0.01];

/** Cường độ ánh sáng môi trường khi dùng HDRI thật (RoomEnvironment code dùng 0.35). */
export const ENV_INTENSITY = 0.5;
/** Kích thước thật (m) mà 1 lần lặp texture PBR phủ — khớp dimensions trên Poly Haven. */
export const PBR_TILE_M = { floor: 1.5, wall: 1.0, concrete: 3.0 };
/** Độ đậm bóng tiếp xúc giả dưới kệ/tủ */
export const CONTACT_SHADOW_OPACITY = 0.55;
