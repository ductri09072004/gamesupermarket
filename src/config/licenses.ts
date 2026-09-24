export interface LicenseDef {
  id: number;
  name: string;
  icon: string;
  price: number;
  levelRequired: number;
  description: string;
}

export const LICENSES: LicenseDef[] = [
  { id: 0, name: 'Cơ bản', icon: '🛒', price: 0, levelRequired: 1, description: 'Mì, nước, bánh kẹo, gạo, dầu ăn.' },
  { id: 1, name: 'Sữa & Lạnh', icon: '🥛', price: 400, levelRequired: 2, description: 'Sữa, sữa chua, phô mai, trứng. Mở khoá Tủ lạnh.' },
  { id: 2, name: 'Đông lạnh', icon: '🍦', price: 900, levelRequired: 4, description: 'Kem, há cảo, xúc xích, thịt. Mở khoá Tủ đông.' },
  { id: 3, name: 'Hoá phẩm', icon: '🧴', price: 1500, levelRequired: 6, description: 'Dầu gội, kem đánh răng, bột giặt, giấy.' },
  { id: 4, name: 'Đồ uống cao cấp', icon: '☕', price: 2500, levelRequired: 8, description: 'Cà phê, trà, nước ép, bia.' },
];

export function getLicense(id: number): LicenseDef {
  const l = LICENSES[id];
  if (!l) throw new Error(`Unknown license ${id}`);
  return l;
}
