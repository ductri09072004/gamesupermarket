/**
 * Nhân vật người tỉ lệ thật trong public/assets/models/characters: bộ Mixamo (mx_*, chung khung xương, clip chung trong mx_clips.glb)
 * cùng Quaternius (CC0) cũ. Thiếu file thì dùng người khối.
 * Tên clip chuẩn hoá: Idle, Walk, Run, Walk_Carry, Interact, Punch, Hit, Wave, Look, Give, Talk.
 */
export const CUSTOMER_MODELS = [
  'mx_Bryce', 'mx_Brian', 'mx_Josh', 'mx_Leonard', 'mx_Lewis',
  'mx_Louise', 'mx_Megan', 'mx_Sophie', 'mx_Elizabeth', 'mx_Martha', 'mx_Jody',
];
/** Nhân viên theo vai trò: thu ngân, xếp kệ, chăm sóc khách (vest), lao công (đồng phục xanh), bảo vệ (đồ đen, mũ) */
export const STAFF_MODELS: Record<'cashier' | 'stocker' | 'helper' | 'cleaner' | 'guard', string> = {
  cashier: 'mx_Suzie', stocker: 'mx_Pete', helper: 'mx_Joe', cleaner: 'mx_Chad', guard: 'mx_Alex',
};
/** Model nữ (chiều cao chuẩn thấp hơn) */
export const FEMALE_MODELS = new Set(['mx_Louise', 'mx_Megan', 'mx_Sophie', 'mx_Elizabeth', 'mx_Martha', 'mx_Jody', 'mx_Suzie']);
/** Model có áo/quần đổi màu ngẫu nhiên được (vật liệu tên Shirt / Pants) — bộ Mixamo dùng texture riêng nên không có */
export const RECOLOR_MODELS = new Set<string>();
/** Khách lớn tuổi (dễ bí khi dùng máy tự tính tiền) */
export const ELDER_MODELS = new Set(['mx_Brian']);
/** Tiền tố model dùng chung bộ clip (Mixamo): clip nằm trong 'mx_clips', nạp một lần */
export const SHARED_CLIPS = { prefix: 'mx_', file: 'mx_clips' };
/** Chiều cao thật (m) sau khi chuẩn hoá */
export const CHARACTER_HEIGHT = { male: 1.78, female: 1.68 };
/**
 * Tốc độ đi (m/s) khớp với clip Walk ở timeScale = 1 (đo tốc độ bàn chân lúc chạm đất) — tránh trượt chân.
 * modular = bộ "CharacterArmature" (tay Wrist), animated = bộ "HumanArmature" (tay Palm).
 */
export const WALK_CLIP_SPEED = { modular: 1.23, animated: 1.63, mixamo: 1.25 };
/** Tên clip đã chuẩn hoá; carry/pick có thể không có → dùng clip thay thế */
export const CLIPS = { idle: 'Idle', walk: 'Walk', carry: 'Walk_Carry', pick: 'Interact', punch: 'Punch', hit: 'Hit' } as const;
/** Xương gắn đồ cầm tay, thử lần lượt theo bộ khung */
export const HAND_BONES = { L: ['mixamorig:LeftHand', 'Fist.L', 'Wrist.L', 'Palm.L'], R: ['mixamorig:RightHand', 'Fist.R', 'Wrist.R', 'Palm.R'] } as const;
