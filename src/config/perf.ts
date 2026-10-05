/** Mục tiêu hiệu năng: 60 FPS ổn định, không giật khi lái xe / mở menu / mua đồ. Đơn vị: mili-giây, FPS. */
export const PERF = {
  /** Thời gian 1 khung ở 60 FPS */
  frameMs: 1000 / 60,
  /** Khung > janks coi là "giật" (người chơi bắt đầu thấy); > hitchMs là "khựng" rõ rệt; > freezeMs là "đứng hình" */
  jankMs: 25,
  hitchMs: 50,
  freezeMs: 100,
  /** Đạt khi: FPS trung bình ≥ minAvgFps, 1% khung chậm nhất ≥ minLowFps, không khung nào ≥ hitchMs, khung giật ≤ maxJankRatio */
  minAvgFps: 58,
  minLowFps: 50,
  maxJankRatio: 0.005,
  /** Số khung vẽ trên đồ thị / cửa sổ tính thống kê trực tiếp */
  graphFrames: 240,
  liveWindow: 600,
  /** Số khung giữ cho báo cáo (≈ 10 phút ở 60 FPS) */
  sessionFrames: 36000,
  /** Báo cáo liệt kê N khung chậm nhất, kèm các sự kiện trong ±contextMs quanh khung đó */
  worstFrames: 40,
  contextMs: 1500,
};
