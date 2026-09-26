/** Vật lý thùng hàng (cannon-es) & va chạm xe (tự viết). Đơn vị SI: m, kg, s. */
export const BOX_PHYSICS = {
  gravity: -9.82,
  /** Khối lượng thùng = rỗng + mỗi món (kg) */
  emptyMass: 0.6,
  perItemMass: 0.25,
  friction: 0.45,
  restitution: 0.08,
  linearDamping: 0.15,
  angularDamping: 0.25,
  /** Chỉ mô phỏng vật cản tĩnh trong bán kính này quanh cửa hàng (m) */
  staticRadius: 45,
  /** Chiều cao hộp va chạm tĩnh dựng từ AABB 2D (tường, kệ, nhà) */
  staticHeight: 2.6,
  /** Tốc độ ném khi thả thùng (m/s) */
  throwSpeed: 1.2,
};

export const CAR_IMPACT = {
  /** Hệ số nảy khi va chạm (0 = dính, 1 = nảy hoàn toàn) */
  restitution: 0.28,
  friction: 0.35,
  /** Khối lượng (kg) theo loại */
  mass: { moto: 180, car: 1250, pickup: 1900, traffic: 1300, truck: 6500 },
  /** Lực bám lốp dập tắt trượt ngang / xoay sau va chạm (1/s) */
  slipGrip: 3.2,
  spinDamping: 2.6,
  /** Xe NPC bị đâm: ma sát trượt (m/s²), đứng yên N giây rồi mới nhập làn lại */
  knockedFriction: 6,
  recoverAfterS: 2.5,
  recoverS: 1.6,
  /** Va chạm dưới tốc độ tương đối này (m/s) không kêu / không rung */
  quietSpeed: 1.5,
};
