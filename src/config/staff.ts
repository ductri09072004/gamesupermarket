import type { StaffRole } from '../core/GameState';

export const STAFF_ROLES: Record<StaffRole, { name: string; icon: string; wage: [number, number]; desc: string }> = {
  cashier: { name: 'Thu ngân', icon: '🧾', wage: [55, 80], desc: 'Tự động tính tiền ở quầy trống.' },
  stocker: { name: 'Xếp kệ', icon: '📦', wage: [45, 70], desc: 'Châm hàng vào kệ còn dưới 30%.' },
};

export const FIRST_NAMES = ['An', 'Bình', 'Chi', 'Dũng', 'Giang', 'Hà', 'Hùng', 'Khoa', 'Lan', 'Linh', 'Minh', 'My', 'Nam', 'Ngọc', 'Phúc', 'Quân', 'Tâm', 'Thảo', 'Trang', 'Tú', 'Vy', 'Yến'];
export const LAST_NAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ'];
export const MAX_STAFF = 6;
