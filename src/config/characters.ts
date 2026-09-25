/** Nhân vật rig Quaternius (CC0) trong public/assets/models/characters — thiếu file thì dùng người khối. */
export const CUSTOMER_MODELS = [
  'Casual_Male', 'Casual_Female', 'Casual2_Male', 'Casual2_Female', 'Casual3_Male', 'Casual3_Female',
  'OldClassy_Male', 'OldClassy_Female', 'Suit_Male', 'Suit_Female',
];
export const STAFF_MODELS = ['Worker_Male', 'Worker_Female'];
/** Model có áo/quần đổi màu ngẫu nhiên được (đồ thường ngày); các model còn lại giữ trang phục gốc. */
export const RECOLOR_MODELS = new Set(['Casual_Male', 'Casual_Female', 'Casual2_Male', 'Casual2_Female', 'Casual3_Male', 'Casual3_Female']);
/** Chiều cao thật (m) của model không đội mũ sau khi chuẩn hoá. */
export const CHARACTER_HEIGHT = 1.72;
/** Tốc độ đi (m/s) khớp với clip Walk ở timeScale = 1 — tránh trượt chân. */
export const WALK_CLIP_SPEED = 1.35;
/** Tên clip trong file nguồn animation */
export const CLIPS = { idle: 'Idle', walk: 'Walk', carry: 'Walk_Carry', pick: 'PickUp' } as const;
