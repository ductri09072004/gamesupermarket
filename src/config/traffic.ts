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

export const PEDESTRIANS = {
  count: 18,
  speed: 1.25,
  /** Cách mép đường (m) — cây & đèn ở 0.45–1.3m */
  inset: 1.6,
  /** Ngoài N m: ẩn hẳn; ngoài animDist: animation cập nhật thưa (tiết kiệm AnimationMixer) */
  hideDist: 55,
  animDist: 25,
};
