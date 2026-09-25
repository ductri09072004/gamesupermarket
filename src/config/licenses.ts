export interface LicenseDef {
  id: number;
  name: string;
  icon: string;
  price: number;
  levelRequired: number;
  description: string;
  /** Giấy phép phải có trước (null = không cần) */
  requires: number | null;
}

export const LICENSES: LicenseDef[] = [
  { id: 0, name: 'Cơ bản', icon: '🛒', price: 0, levelRequired: 1, description: 'Mì, nước, bánh kẹo, gạo, dầu ăn.', requires: null },
  { id: 1, name: 'Sữa & Lạnh', icon: '🥛', price: 400, levelRequired: 2, description: 'Sữa, sữa chua, phô mai, trứng. Mở khoá Tủ lạnh.', requires: 0 },
  { id: 2, name: 'Đông lạnh', icon: '🍦', price: 900, levelRequired: 4, description: 'Kem, há cảo, xúc xích, thịt. Mở khoá Tủ đông.', requires: 1 },
  { id: 3, name: 'Hoá phẩm', icon: '🧴', price: 1500, levelRequired: 6, description: 'Dầu gội, kem đánh răng, bột giặt, giấy.', requires: 2 },
  { id: 4, name: 'Đồ uống cao cấp', icon: '☕', price: 2500, levelRequired: 8, description: 'Cà phê, trà, nước ép, bia, vang.', requires: 3 },
  { id: 5, name: 'Thời trang', icon: '👕', price: 1800, levelRequired: 5, description: 'Áo, quần, váy, mũ, tất. Mở khoá Giá treo quần áo.', requires: 1 },
  { id: 6, name: 'Điện tử', icon: '🎧', price: 3000, levelRequired: 7, description: 'Tai nghe, sạc, pin, loa, đồng hồ... Mở khoá Tủ kính điện tử.', requires: 5 },
];

export function getLicense(id: number): LicenseDef {
  const l = LICENSES[id];
  if (!l) throw new Error(`Unknown license ${id}`);
  return l;
}
