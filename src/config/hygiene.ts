/** Vệ sinh cửa hàng & an ninh. Đơn vị: phút trong game (giờ game = 60 phút), giây thực, m. */
export const DIRT = {
  /** Chất bẩn mới / giờ game = base + perCustomer × số khách trong cửa hàng + perArea × diện tích (m²) */
  basePerHour: 0.4,
  perCustomerPerHour: 0.35,
  perAreaPerHour: 0.006,
  /** Tỉ lệ loại: rác sàn / vết đổ / vết bẩn kính */
  weights: { litter: 0.5, spill: 0.3, smudge: 0.2 },
  max: 40,
  /** Mỗi giờ game, mỗi vết bẩn trừ uy tín */
  repPerDirtHour: -0.004,
  /** Thời gian lau/nhặt (giây, chia tốc độ nhân viên) */
  cleanS: { litter: 1.2, spill: 3.5, smudge: 3 },
};

export const SECURITY = {
  /** Xác suất khách lén mang hàng ra không trả tiền */
  theftChance: 0.06,
  /** Hệ số tốc độ chạy của kẻ trộm / bảo vệ so với tốc độ đi thường */
  thiefRun: 1.9,
  guardRun: 2.3,
  /** Khoảng cách bảo vệ/người chơi tóm được (m) */
  catchDist: 1.1,
  /** Còi hú (giây) */
  alarmS: 3.5,
  /** Bảo vệ ôm tối đa N món mỗi chuyến trả hàng */
  carryMax: 8,
  pickS: 0.5,
  repCaught: 0.02,
};
