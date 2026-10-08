import { NPC_CAR_MODELS } from './fleet';
/**
 * Thành phố quanh cửa hàng. Model trong public/assets/models/city, kích thước thật (m): [rộng X, cao, sâu Z], mặt tiền quay +Z.
 * Toàn bộ nhà là nhà phố Việt Nam (không còn kiến trúc nước ngoài).
 */
export const BUILDINGS: Record<string, [number, number, number]> = {};
/**
 * Nhà phố Việt Nam (Sketchfab, CC-BY — xem CREDITS.md), đã chuẩn hoá: mét, gốc giữa đáy, mặt tiền +Z.
 * Màu phẳng — tường sáng được nhuộm màu pastel theo `variant`.
 */
export const VN_HOUSES: Record<string, [number, number, number]> = {
  vn_tube_1: [4.5, 8.6, 10.61], vn_tube_2: [5, 10.8, 10.39], vn_tube_3: [4.71, 15.05, 13.46],
  vn_tube_hanoi: [4.6, 7.5, 8.96], vn_house_2f: [4.57, 7.61, 10.62], vn_house_urban: [4.51, 8.92, 9.23],
  vn_tube_4: [4.5, 8.6, 10.92], vn_tube_5: [4.5, 7.14, 10.55], vn_tube_6: [3.84, 9.75, 9.67],
  vn_house_urban2: [4.5, 7.8, 9.53], vn_house_urban3: [4.7, 11.21, 10.4],
};
Object.assign(BUILDINGS, VN_HOUSES);
export const isVnHouse = (model: string): boolean => model in VN_HOUSES;
/** Biến thể màu xe máy: bộ lọc canvas áp lên texture gốc (xanh ngọc) → đỏ, xanh dương, vàng, trắng, đen */
export const SCOOTER_FILTERS = ['none', 'hue-rotate(200deg)', 'hue-rotate(80deg) saturate(1.3)', 'hue-rotate(-100deg)', 'saturate(0) brightness(1.35)', 'saturate(0) brightness(0.45)'];
/** Màu sơn nhà phố Việt đã phai: vàng kem, vàng đất, be, xanh bạc hà, hồng cam, xanh trời, nâu nhạt, trắng ngà */
export const VN_PASTELS = [0xf7e3a1, 0xe8c98a, 0xf1dcc0, 0xd8e6cf, 0xf0c8b0, 0xcfdfe8, 0xe3d2b0, 0xffffff];

/** Nhà mặt phố thấp tầng làm cửa hiệu cạnh siêu thị — toàn nhà ống Việt cho phố trước mặt người chơi */
export const SHOP_BUILDINGS = ['vn_tube_1', 'vn_tube_2', 'vn_tube_hanoi', 'vn_house_2f', 'vn_house_urban', 'vn_tube_4', 'vn_tube_5', 'vn_house_urban2', 'vn_tube_6'];
/** Mọi nhà phố Việt, dùng lấp kín các khối phố (kéo giãn vừa khít, xem world/CityFill) */
export const STREET_BUILDINGS = Object.keys(VN_HOUSES);

/** Đồ vỉa hè Việt Nam (CC-BY): [rộng, cao, sâu] m, mặt trước +Z */
export const VN_PROPS = {
  vn_banhmi_cart: [1.89, 2, 0.8], vn_stool_red: [0.45, 0.45, 0.45], vn_stool_blue: [0.41, 0.47, 0.41], vn_scooter: [0.62, 1.15, 1.39],
  vn_hutieu_cart: [2.13, 2.1, 1.2], vn_meat_stall: [5.63, 2, 1.53], vn_veg_market: [2.8, 0.52, 2.78], vn_bread_basket: [0.52, 0.42, 0.45],
  vn_table: [0.73, 0.45, 0.36], vn_coconut: [0.21, 0.22, 0.25], vn_hammock: [2.9, 1, 2.32], vn_lanterns: [1.49, 0.55, 0.34],
  vn_ac_unit: [0.53, 0.7, 0.31], vn_non_la: [0.46, 0.2, 0.46], vn_clothesline: [3.72, 1.7, 5.9],
} as const satisfies Record<string, readonly [number, number, number]>;
export type VnProp = keyof typeof VN_PROPS;
/** Giờ bán của hàng rong (giờ game): sáng xôi/bánh mì & chợ cóc, chiều dừa, tối hủ tiếu gõ, cà phê võng cả ngày */
export const VENDOR_HOURS = { morning: [6, 11.5], market: [6, 12.5], afternoon: [11, 18], evening: [16.5, 24], allday: [0, 24] } as const;
export type VendorShift = keyof typeof VENDOR_HOURS;
/**
 * Hàng rong cạnh tranh: khi sạp đang bán, khách định mua các món này có thể mua ngoài sạp thay vì trong siêu thị.
 * `say`: câu khách nói khi bỏ món.
 */
export const VENDOR_GOODS: Record<VendorShift, { goods: string[]; say: string }> = {
  morning: { goods: ['bread', 'soymilk', 'cookies'], say: '🥖 Ăn bánh mì ngoài xe rồi!' },
  market: { goods: ['meat', 'eggs', 'sausage'], say: '🥩 Mua ngoài chợ cóc rẻ hơn' },
  afternoon: { goods: ['juice', 'soda', 'water'], say: '🥥 Uống dừa ngoài kia rồi' },
  evening: { goods: ['noodles', 'cupnoodle', 'dumplings'], say: '🍜 Ăn hủ tiếu gõ rồi, khỏi mua mì' },
  allday: { goods: ['coffee', 'milktea', 'tea'], say: '☕ Ghé cà phê võng rồi' },
};
/**
 * Gánh hàng rong đi bộ (nón lá, đòn gánh): rao dọc vỉa hè các khối phố. Khi đi ngang trước cửa hàng (trong `nearDoor` m)
 * khách có thể mua món trên gánh thay vì trong siêu thị. Nghỉ khi trời mưa.
 */
export const WALKING_VENDOR = {
  count: 3,
  speed: 0.85,
  hours: [[6, 11], [15, 19.5]] as ReadonlyArray<readonly [number, number]>,
  goods: ['candy', 'chips', 'springroll', 'icecream'],
  say: '🧺 Mua của cô gánh hàng rong rồi',
  nearDoor: 14,
  /** Cách N giây (ngẫu nhiên [min, max]) lại dừng rao 1 tiếng */
  callEvery: [9, 20] as readonly [number, number],
  callPauseS: 1.6,
};
/** Xác suất khách bỏ món cho hàng rong; bán ≤ VENDOR_CHEAP × giá thị trường thì còn VENDOR_TAKE_CHEAP */
export const VENDOR_TAKE = 0.35;
export const VENDOR_TAKE_CHEAP = 0.12;
export const VENDOR_CHEAP = 0.9;
/**
 * Vị trí quán vỉa hè & bãi xe máy (toạ độ X, m). Phía cửa hàng phải nằm ngoài lưới đi lại của khách
 * (x < -8.2 hoặc > 32), để khách không đi xuyên ghế/xe.
 */
export const STREET_LIFE = {
  near: {
    stalls: [{ x: -16, shift: 'morning' }, { x: -27, shift: 'evening' }] as Array<{ x: number; shift: VendorShift }>,
    parking: [[-31, -21], [-12.5, -8.6]] as Array<[number, number]>,
  },
  far: {
    stalls: [{ x: 8, shift: 'morning' }, { x: 21, shift: 'evening' }, { x: 36, shift: 'afternoon' }, { x: -12, shift: 'market' }, { x: 47, shift: 'allday' }] as Array<{ x: number; shift: VendorShift }>,
    parking: [[-6, 5], [12, 18], [25, 32], [40, 44], [52, 57]] as Array<[number, number]>,
  },
};
/** Xe máy lấn chiếm vỉa hè: tỉ lệ ô vỉa hè có xe dựng sát mặt tiền; tỉ lệ xe đỗ tràn nửa xuống lòng đường */
export const SIDEWALK_BIKES = { facadeChance: 0.55, spillChance: 0.5 };
/** Cột điện bê tông & dây điện chằng chịt */
export const POLE = { seed: 424242, height: 8.5, spacing: 22, inset: 0.35, walk: 3, wireRadius: 0.012 };
/** Hư hỏng mặt đường: miếng vá / nắp cống trên mỗi 100m đường */
export const ROAD_DAMAGE = { seed: 777, patchesPer100m: 6, manholesPer100m: 2 };
/** Biển hiệu các cửa hiệu hàng xóm */
/** Dòng phụ & kiểu biển cho từng loại tiệm (bg/ink/accent là màu CSS) — xem world/SignFactory */
export const SHOP_SIGNS: Record<string, { sub: string; style: 'lightbox' | 'enamel' | 'paint' | 'alu'; bg: string; ink: string; accent: string }> = {
  'TIỆM BÁNH': { sub: 'Bánh mì · Bánh ngọt · Bánh kem', style: 'paint', bg: '#f6e3c4', ink: '#a3311f', accent: '#7a4a1f' },
  'CÀ PHÊ': { sub: 'Cà phê phin · Trà đá · Sinh tố', style: 'paint', bg: '#3b2a20', ink: '#f4e3b8', accent: '#d9a441' },
  'NHÀ THUỐC': { sub: 'Thuốc tây · Dụng cụ y tế', style: 'lightbox', bg: '#1f8a4c', ink: '#1f8a4c', accent: '#1f8a4c' },
  'PHỞ 24H': { sub: 'Phở bò · Phở gà · Mở cả ngày', style: 'enamel', bg: '#b3261e', ink: '#ffe9a8', accent: '#fff4d6' },
  'TIỆM HOA': { sub: 'Hoa tươi · Hoa cưới · Giao tận nơi', style: 'paint', bg: '#f3d6dc', ink: '#8a1f46', accent: '#2d6a3e' },
  'SỬA XE': { sub: 'Vá vỏ · Thay nhớt · Rửa xe', style: 'enamel', bg: '#f0b323', ink: '#1c1c1c', accent: '#1c1c1c' },
  'TẠP HOÁ': { sub: 'Bán sỉ & lẻ · Giá rẻ mỗi ngày', style: 'enamel', bg: '#1a5fa8', ink: '#ffffff', accent: '#ffd23f' },
  'TIỆM TÓC': { sub: 'Cắt · Uốn · Nhuộm · Gội đầu', style: 'alu', bg: '#22303f', ink: '#f1f1ee', accent: '#e6b422' },
  'TRÀ SỮA': { sub: 'Trà sữa · Trân châu · Trà trái cây', style: 'lightbox', bg: '#c2255c', ink: '#c2255c', accent: '#f08c00' },
  'GIẶT ỦI': { sub: 'Giặt sấy · Ủi · Lấy liền', style: 'alu', bg: '#1a5276', ink: '#ffffff', accent: '#9bd3f0' },
};
export const SHOP_NAMES = ['TIỆM BÁNH', 'CÀ PHÊ', 'NHÀ THUỐC', 'PHỞ 24H', 'TIỆM HOA', 'SỬA XE', 'TẠP HOÁ', 'TIỆM TÓC', 'TRÀ SỮA', 'GIẶT ỦI'];
/** Poly Haven CC0: 60% cây gọn cao 6m, xen 20% tán rộng 4.8m và 20% jacaranda 7m. */
export const TREES = ['tree_small_02', 'tree_small_02', 'tree_small_02', 'island_tree_01', 'jacaranda_tree'];
export const TREE_LOD_DISTANCE = 45;
export const BUSHES = ['Bush_1', 'Bush_2'];
/** Ô tô đỗ trong bãi & chạy ngoài phố: xe cổ (Volga, Willys, Cadillac…) — cùng bộ với xe người chơi có thể mua */
export const PARKED_CARS = NPC_CAR_MODELS.map((v) => v.model);
export const PROPS = ['Streetlight_Single', 'Streetlight_Double', 'TrafficLight', 'TrafficCone', 'Sign_Stop', 'Sign_NoParking'];

/** Hẻm chật: mặt đường chỉ vừa 1 làn ô tô (~1.9m) + xe máy lách sát lề */
export const ROAD_WIDTH = 4.6;
/** Đường trước cửa hàng rộng 1,5 làn: 1 làn chạy xe (4.6m) + nửa làn ven vỉa hè (2.3m) để đỗ xe trước cửa */
export const MAIN_ROAD_WIDTH = ROAD_WIDTH * 1.5;
export const MAIN_PARK_STRIP = MAIN_ROAD_WIDTH - ROAD_WIDTH;
export const WALK_WIDTH = 3;
/** Khoảng cách đèn đường / cây dọc vỉa hè (m) */
export const LAMP_SPACING = 26;
export const TREE_SPACING = 13;
/** Hạt giống cố định → thành phố giống nhau mỗi lần chơi */
export const CITY_SEED = 20240917;

/** Hẻm nhỏ giữa các nhà: vừa 2 xe máy đi ngược chiều (2 × 0.62m + chừa tay lái) */
export const ALLEY = {
  width: 1.5,
  /** Khoảng cách tối thiểu giữa 2 hẻm song song (m) */
  spacing: 18,
  /** Hạt giống riêng — không làm xáo trộn bố cục nhà */
  seed: 5151,
} as const;

/** Tên đường (biển tên đường ở ngã tư / đầu đường): ba đường ngang (đường chính trước cửa hàng là giữa) và bốn đường dọc */
export const STREET_NAMES = {
  horizontal: ['NGUYỄN TRÃI', 'LÊ LỢI', 'TRẦN PHÚ'],
  vertical: ['HAI BÀ TRƯNG', 'PHAN CHU TRINH', 'LÝ THƯỜNG KIỆT', 'NGUYỄN HUỆ'],
} as const;
