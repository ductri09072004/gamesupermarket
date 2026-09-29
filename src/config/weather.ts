/** Thời tiết: mưa chiều kiểu nhiệt đới, đường ngập, ảnh hưởng khách / hàng rong / lái xe. Giờ = giờ game, mực nước = mét. */
export const WEATHER = {
  seedSalt: 90817,
  /** Ngày đầu (hướng dẫn) không mưa */
  firstRainDay: 2,
  rainDayChance: 0.4,
  /** Giờ bắt đầu mưa nằm trong khoảng này */
  startWindow: [10, 18] as const,
  durationH: [1.5, 4] as const,
  peak: [0.55, 1] as const,
  rampUpH: 0.4,
  rampDownH: 0.7,
  /** Mây kéo tới trước khi mưa N giờ; tan sau khi tạnh N giờ */
  cloudBeforeH: 0.8,
  cloudAfterH: 1,
  /** Mặt đường còn ướt thêm N giờ sau khi tạnh */
  dryH: 1.5,
  /** Cường độ mưa từ mức này coi là "đang mưa": hàng rong dọn về, người đi bộ thưa */
  rainy: 0.25,
  /** Số khách giảm tối đa (mưa 1.0) và khi đường ngập sâu nhất */
  spawnDrop: 0.3,
  floodSpawnDrop: 0.2,
  /** Vết bẩn / giờ tăng thêm (theo độ ướt 1.0) và thiên về vết đổ (nước, bùn) */
  dirtBoost: 1,
  spillBias: 3,
  /** Mặt đường ướt: lốp bám kém, phanh dài hơn */
  grip: 0.4,
  brake: 0.3,
  /** Xe NPC chạy chậm lại (theo mưa) */
  trafficSlow: 0.25,
  /** Sét đánh (mưa từ mức này): cách nhau [min, max] giây thực */
  thunderFrom: 0.7,
  thunderGapS: [14, 40] as const,
};

/** Ngập đường: chỉ mưa rất to mới ngập; nước rút dần sau đó. */
export const FLOOD = {
  from: 0.5,
  /** m/giờ khi mưa 1.0 (tỉ lệ theo (mưa − from) / (1 − from)) */
  fillPerHour: 0.28,
  drainPerHour: 0.08,
  max: 0.3,
  /** Mực nước xe bắt đầu lết / chết máy (m) */
  wade: {
    moto: { slow: 0.05, stall: 0.15 },
    car: { slow: 0.1, stall: 0.27 },
    pickup: { slow: 0.14, stall: 0.3 },
  } as Record<string, { slow: number; stall: number }>,
  /** Tốc độ tối đa khi lội nước (× tốc độ tối đa) */
  slowSpeed: 0.45,
  /** Xe máy chết máy: đứng yên N giây rồi nổ lại được */
  stallS: 3.5,
};
