/** Giao thông & người đi bộ NPC quanh thành phố. Đơn vị: m, m/s, giây. */
export const TRAFFIC = {
  maxCars: 14,
  /** Trung bình mỗi N giây có 1 xe mới vào phố (nếu chưa đủ) */
  spawnEvery: 4,
  /** Xe mới chỉ xuất hiện / biến mất ở chỗ xa người chơi hơn N m */
  spawnHideDist: 45,
  spawnGap: 14,
  /** Mỗi xe chạy ngẫu nhiên [lifeMin, lifeMin + lifeRand] m rồi rời phố */
  lifeMin: 350,
  lifeRand: 700,
  speed: 10,
  cornerSpeed: 4.5,
  lookAhead: 7,
  accel: 3,
  brake: 9,
  /** Bắt đầu giảm tốc khi vật cản cách N m, dừng hẳn cách stopDist */
  brakeDist: 14,
  stopDist: 5,
};

/**
 * Đường một làn, một chiều: chỉ cho xe chạy quanh các khối phố không chung cạnh nhau (quân cờ ô vuông), để mỗi đoạn đường
 * chỉ có một chiều xe. Chỉ số khối = i * 2 + j (i: cột theo V_ROADS, j: hàng theo đường ngang) — (1,0) là khối có cửa hàng.
 */
export const ONE_WAY_BLOCKS = [2, 1, 5] as const;

/**
 * Gỡ kẹt: xe bị chặn đứng quá afterS giây thì lệch lên lề phải (offset: m so với tim làn — đủ để lách qua xe đứng giữa hẻm)
 * và giữ nguyên độ lệch holdM mét rồi mới nhập lại làn. Xe tải giao hàng dùng thêm lùi xe (xem DeliveryTrucks).
 */
export const YIELD = {
  afterS: 4,
  holdM: 12,
  speed: 1.4,
  offset: { car: 2.3, bus: 3 },
  /** Kẹt quá lâu (giây) và đang khuất mắt người chơi → xe biến mất */
  giveUpS: 45,
};

export const PEDESTRIANS = {
  count: 18,
  speed: 1.25,
  /** Cách mép đường (m) — cây & đèn ở 0.45–1.3m */
  inset: 1.6,
  /** Ngoài N m: ẩn hẳn; ngoài animDist: animation cập nhật thưa (tiết kiệm AnimationMixer) */
  hideDist: 55,
  animDist: 25,
};

/** Giờ cao điểm: phố đông nghẹt xe máy, còi inh ỏi. */
export const RUSH_HOURS: ReadonlyArray<readonly [number, number]> = [[7, 9], [17, 19.5]];

/** Mật độ xe theo giờ (nhân với số xe tối đa): cao điểm chủ yếu là xe máy đông lên (ô tô chỉ nhỉnh hơn một chút). */
export const TRAFFIC_DENSITY = { rush: { car: 1.15, moto: 1.6 }, night: 0.3, earlyMorning: 0.7 };

/** Xe máy NPC đã tắt (max = 0); thông số còn dùng cho mô hình và hành vi xe máy. */
export const MOTO_TRAFFIC = {
  max: 0,
  spawnEvery: 1.6,
  speed: 8.5,
  cornerSpeed: 5,
  /** Cách tim đường (m) về phía lề — ô tô đi giữa lòng hẻm, xe máy lách sát lề */
  lane: 1.5,
  cornerR: 3,
  /** Nửa bề ngang / nửa chiều dài thân va chạm */
  hw: 0.4,
  hl: 0.95,
  /** Lắc ngang so với làn (m) và chu kỳ (giây) */
  wobble: 0.22,
  wobbleS: [2.5, 6] as const,
  /** Xác suất chở thêm 1 người ngồi sau */
  pillionChance: 0.3,
  scale: 1.3,
};

/** Xe buýt: theo lịch, dừng ở trạm trước cửa hàng, thả khách. */
export const BUS = {
  firstHour: 6.5,
  lastHour: 21.5,
  everyH: 1.25,
  /** Xe xuất hiện cách trạm N m (đi từ xa tới) */
  approachM: 95,
  speed: 7.5,
  /** Giảm tốc khi vào trạm (m/s²) */
  decel: 1.8,
  dwellS: 9,
  /** Khách xuống xe mỗi chuyến [min, max]; giờ cao điểm cộng thêm rushExtra */
  passengers: [1, 4] as const,
  rushExtra: 2,
  /** Xác suất mỗi hành khách ghé vào cửa hàng (nếu đang mở cửa) */
  shopChance: 0.75,
  hw: 1.32,
  hl: 4.68,
};

/**
 * Xe máy lách vật cản (người chơi, ô tô, xe khác) thay vì dừng chờ: lệch ngang sang bên còn chỗ rồi nhập lại làn.
 * offLeft / offRight: biên độ lệch cho phép so với làn xe máy (m) — hẻm một chiều nên được chạy sang cả nửa trái lòng đường.
 */
export const MOTO_DODGE = {
  /** Bắt đầu để ý vật cản cách N m phía trước */
  look: 11,
  /** Khoảng chừa thêm bên cạnh vật cản (m) */
  margin: 0.35,
  /** Tốc độ đánh lái ngang (m/s) khi lách / khi trở về làn */
  latSpeed: 3.6,
  returnSpeed: 2.2,
  offLeft: 3.2,
  offRight: 0.4,
  /** Hệ số tốc độ khi đang lệch khỏi làn */
  slow: 0.85,
  /** Bóp còi khi lách vật cản gần hơn N m (giây nghỉ giữa 2 lần còi) */
  hornDist: 7,
  hornCooldownS: 5,
};

/** Xe máy tông người chơi đi bộ khi lách không kịp: văng ra một đoạn, choáng một lúc. */
export const MOTO_HIT = {
  /** Chỉ tông khi xe đang chạy nhanh hơn N m/s */
  minSpeed: 1.5,
  /** Vận tốc văng = launch + perSpeed × tốc độ xe (m/s) */
  launch: 6,
  perSpeed: 0.9,
  /** Hệ số hướng văng sang ngang (xa tim xe) */
  sideKick: 0.35,
  /** Tốc độ nảy lên (m/s) */
  lift: 3.4,
  /** Ma sát trượt khi đang văng (1/s) — văng xa ≈ v / friction */
  friction: 2.6,
  /** Choáng không điều khiển được (giây) */
  stunS: 0.9,
  /** Giây nghỉ trước khi có thể bị tông lần nữa */
  cooldownS: 2.5,
  /** Xe máy giảm tốc sau va chạm (nhân) */
  slow: 0.55,
};
