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

/** Dòng xe máy: đông hơn ô tô, luồn sát lề đường, đi lắc lư. Đơn vị: m, m/s, giây. */
export const MOTO_TRAFFIC = {
  max: 24,
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
