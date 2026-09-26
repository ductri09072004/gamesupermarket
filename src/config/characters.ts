/**
 * Nhân vật người tỉ lệ thật — Quaternius (CC0) trong public/assets/models/characters. Thiếu file thì dùng người khối.
 * 2 bộ khung xương: "CharacterArmature" (Ultimate Modular, tay = Wrist) và "HumanArmature" (Animated Men/Women, tay = Palm).
 * Tên clip đã chuẩn hoá lúc xử lý: Idle, Walk, Run, Interact, Punch, Hit, Wave.
 */
export const CUSTOMER_MODELS = [
  'Casual_Character', 'Punk', 'Beach_Character', 'Animated_Woman2', 'Animated_Woman3',
  'Man', 'Man_in_Suit', 'Woman_Casual', 'Woman_in_Dress', 'Woman_Tank_Top',
];
/** Nhân viên: [nam, nữ] — nữ dùng model thường ngày nhuộm áo đồng phục */
export const STAFF_MODELS = ['Worker', 'Woman_Casual'];
/** Model nữ (chiều cao chuẩn thấp hơn) */
export const FEMALE_MODELS = new Set(['Animated_Woman2', 'Animated_Woman3', 'Woman_Casual', 'Woman_in_Dress', 'Woman_Tank_Top', 'Beach_Character']);
/** Model có áo/quần đổi màu ngẫu nhiên được (vật liệu tên Shirt / Pants) */
export const RECOLOR_MODELS = new Set(['Man', 'Woman_Casual', 'Woman_Tank_Top']);
/** Khách lớn tuổi (dễ bí khi dùng máy tự tính tiền) */
export const ELDER_MODELS = new Set(['Man_in_Suit']);
/** Chiều cao thật (m) sau khi chuẩn hoá */
export const CHARACTER_HEIGHT = { male: 1.78, female: 1.68 };
/**
 * Tốc độ đi (m/s) khớp với clip Walk ở timeScale = 1 (đo tốc độ bàn chân lúc chạm đất) — tránh trượt chân.
 * modular = bộ "CharacterArmature" (tay Wrist), animated = bộ "HumanArmature" (tay Palm).
 */
export const WALK_CLIP_SPEED = { modular: 1.23, animated: 1.63 };
/** Tên clip đã chuẩn hoá; carry/pick có thể không có → dùng clip thay thế */
export const CLIPS = { idle: 'Idle', walk: 'Walk', carry: 'Walk_Carry', pick: 'Interact', punch: 'Punch', hit: 'Hit' } as const;
/** Xương gắn đồ cầm tay, thử lần lượt theo bộ khung */
export const HAND_BONES = { L: ['Fist.L', 'Wrist.L', 'Palm.L'], R: ['Fist.R', 'Wrist.R', 'Palm.R'] } as const;
