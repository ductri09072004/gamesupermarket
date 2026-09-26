/**
 * Thành phố quanh cửa hàng. Model Quaternius (CC0) trong public/assets/models/city, kích thước thật (m) đo sau khi
 * chuyển đổi: [rộng X, cao, sâu Z], mặt tiền quay +Z.
 */
export const BUILDINGS: Record<string, [number, number, number]> = {
  '1Story': [5.39, 4.18, 5.44], '1Story_GableRoof': [5.26, 5.06, 5.95], '1Story_Sign': [5.39, 4.48, 5.39],
  '2Story': [5.4, 6.86, 6.33], '2Story_2': [5.4, 6.91, 5.44], '2Story_Balcony': [5.4, 7.36, 6.33],
  '2Story_Columns': [5.4, 6.92, 6.22], '2Story_Sign': [5.39, 6.89, 5.39], '2Story_Slim': [2.79, 6.89, 5.39],
  '2Story_Wide': [9.56, 6.87, 5.64], '2Story_Wide_2Doors': [17.07, 6.87, 5.64], '3Story_Balcony': [5.4, 10.53, 6.27],
  '3Story_Slim': [2.79, 9.98, 5.39], '3Story_Small': [4.77, 9.62, 4.94], '4Story': [6.05, 12.73, 6.33],
  '4Story_Center': [6.05, 12.73, 6.33], '4Story_Wide_2Doors': [17.07, 12.88, 6.74], '6Story_Stack': [5.4, 19.51, 6.25],
};
/** Nhà mặt phố thấp tầng làm cửa hiệu cạnh siêu thị */
export const SHOP_BUILDINGS = ['1Story_Sign', '2Story_Sign', '1Story', '2Story_Wide', '2Story', '2Story_Columns', '1Story_GableRoof', '2Story_2'];
/** Nhà cao tầng lấp lõi khối phố (skyline) */
export const INFILL_BUILDINGS = ['3Story_Balcony', '4Story', '4Story_Center', '4Story_Wide_2Doors', '6Story_Stack', '3Story_Small', '2Story_Balcony', '2Story_Wide'];
/** Biển hiệu các cửa hiệu hàng xóm */
export const SHOP_NAMES = ['TIỆM BÁNH', 'CÀ PHÊ', 'NHÀ THUỐC', 'PHỞ 24H', 'TIỆM HOA', 'SỬA XE', 'TẠP HOÁ', 'TIỆM TÓC', 'TRÀ SỮA', 'GIẶT ỦI'];
/** Bảng màu (atlas 32×32) dùng chung cho mọi nhà — phối ngẫu nhiên để phố nhiều màu. */
export const BUILDING_TEXTURES = ['Blue', 'Dark', 'DarkBlue', 'Green', 'Grey', 'Light', 'Light2', 'Red', 'Yellow'];
export const TREES = ['CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'CommonTree_4', 'CommonTree_5', 'BirchTree_1'];
export const BUSHES = ['Bush_1', 'Bush_2'];
export const PARKED_CARS = ['NormalCar2', 'SUV', 'Taxi', 'NormalCar1'];
export const PROPS = ['Streetlight_Single', 'Streetlight_Double', 'TrafficLight', 'TrafficCone', 'Sign_Stop', 'Sign_NoParking'];

export const ROAD_WIDTH = 8;
export const WALK_WIDTH = 3;
/** Khoảng cách đèn đường / cây dọc vỉa hè (m) */
export const LAMP_SPACING = 26;
export const TREE_SPACING = 13;
/** Hạt giống cố định → thành phố giống nhau mỗi lần chơi */
export const CITY_SEED = 20240917;
