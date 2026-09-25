# 🏪 Mini Mart Tycoon 3D

Game giả lập siêu thị **góc nhìn thứ nhất** chạy trên trình duyệt — **Three.js + TypeScript (strict) + Vite**, logic được unit test bằng **Vitest**. Bản 2D isometric (Phaser) nằm ở nhánh `claude/zealous-wozniak-1us62r`.

Spec đầy đủ: [`CLAUDE.md`](./CLAUDE.md).

## Chạy game

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + build production vào dist/
npm test         # unit test (vitest)
```

## Điều khiển

| Phím | Chức năng |
| --- | --- |
| `W A S D` | Đi · `Shift` chạy · `Space` nhảy · `Ctrl` (hoặc `C`) ngồi xổm để nhìn tầng kệ thấp |
| Chuột | Nhìn (click vào màn hình để khoá chuột) |
| `E` | Nhặt thùng · dùng máy tính · vào quầy thu ngân · bật/tắt biển Mở cửa · đặt giá (nhìn nhãn giá hoặc ngăn kệ) |
| Chuột trái / phải | Cầm thùng đã mở, nhìn vào ngăn kệ: đặt 1 món (giữ để đặt liên tục) / lấy lại 1 món |
| `F` · `Q` | Mở/đóng thùng · thả thùng (thả lên nóc thùng khác để xếp chồng) |
| `Tab` | Mở app Pricing chỉnh giá nhanh |
| `M` | Nhìn vào kệ/nội thất rồi nhấn M để dời nhanh — kệ đang có hàng vẫn dời được, hàng đi theo kệ |
| `B` | Build mode: camera nhìn từ trên, `R` xoay, click đặt/nhấc, `Delete` bán lại 50% (hàng còn trên kệ tự đóng vào thùng) |
| `1` `2` `3` | Tốc độ thời gian · `N` kết thúc ngày (sau 22:00) |
| Ở quầy | Click món trên băng chuyền (hoặc `Space`) để quét · click khay tiền để thối · bấm phím máy POS hoặc gõ số + `Enter` |
| `Esc` · `F3` · `F4` | Menu · debug (FPS, draw calls, triangles, đường đi khách) · Product Gallery |

## Điểm chính

- **56 mặt hàng** chia 7 nhóm giấy phép (thêm **Thời trang**: áo thun, hoodie, quần jean, váy, mũ, tất; **Điện tử**: tai nghe, củ sạc, pin dự phòng, chuột, bóng đèn LED, pin AA, loa, đồng hồ thông minh), **sản phẩm sinh bằng code**: 10 kiểu (hộp bo góc, lon, chai, hũ, túi phồng, hộp sữa mái nhà, tuýp, áo/váy treo móc, quần treo kẹp, mũ lưỡi trai) với kích thước thật; nhãn canvas có tên hãng hư cấu, hoạ tiết, dung tích và mã vạch **EAN-13 đúng chuẩn**. Hiển thị trên kệ bằng `InstancedMesh` (1 mesh / sản phẩm).
- **Nội thất chuyên dụng**: *Giá treo quần áo* (3 thanh treo face-out, cần giấy phép Thời trang), *Tủ kính điện tử* (kệ kính 4 tầng có đèn LED, cần giấy phép Điện tử), *Máy bán hàng tự động* (16 ngăn lò xo, nhận đồ uống/đồ kệ vừa ngăn — khách tự mua & trả tiền ngay tại máy, không qua quầy).
- **Kệ theo tầng & ngăn**: mỗi ngăn tự tính lưới vị trí theo kích thước sản phẩm; khung highlight + bóng mờ món kế tiếp; món bay vào kệ với tween, lắc nhẹ, tiếng "tộc" đổi cao độ.
- **Quầy thu ngân 3D**: khách đặt từng món lên băng chuyền, món bay qua máy quét (laser nháy, bíp), màn hình LCD canvas, ngăn kéo tiền trượt ra với các khay mệnh giá, tiền thối xếp trên quầy, máy POS có phím bấm được.
- **Không khí**: tone mapping ACES, bóng đổ, môi trường phòng (PMREM), dải đèn trần phát sáng + bloom, cửa kính trượt tự động, ánh sáng ngoài trời đổi theo giờ, đèn đường & biển hiệu sáng ban đêm, âm thanh 3D (tiếng máy lạnh tủ đông, chuông cửa, bước chân, nhạc nền, tiếng đám đông).
- Logic cũ (tiền, giá, khách, kho, thời gian, lưu game) được giữ lại trong `src/systems` — không import Three.

### Thành phố & xe
- **Bản đồ thành phố** quanh cửa hàng: lưới 3 đường ngang × 4 đường dọc, vỉa hè lát gạch, cỏ, ~100 ngôi nhà, cây, đèn đường,
  đèn giao thông, xe đỗ ven đường — model thật (Quaternius, CC0) + texture PBR Poly Haven cho đường nhựa/vỉa hè/cỏ.
- **Garage** (app 🚗 trên máy tính): mua **xe máy** (chở tối đa 2 thùng), **ô tô con** (8 suất), **bán tải** (20 suất).
  Thùng cồng kềnh (gạo, bánh mì, giấy vệ sinh, bột giặt, hoodie, loa…) tính 2 suất; xe máy đếm theo thùng.
- **Kho sỉ** (khối nhà bên phải, sau ngã tư): quầy tự phục vụ bán rẻ hơn 20% so với đặt online, thùng có ngay ở bãi vạch vàng
  — tự chất lên xe và chở về.
- Phím: nhìn vào xe <kbd>E</kbd> lên xe (đang cầm thùng thì <kbd>E</kbd> chất lên xe), <kbd>G</kbd> dỡ 1 thùng xuống tay;
  khi lái: <kbd>W</kbd>/<kbd>S</kbd> ga · phanh/lùi, <kbd>A</kbd>/<kbd>D</kbd> lái, <kbd>Space</kbd> phanh tay,
  chuột xoay camera, <kbd>E</kbd> xuống xe. Xe kẹt: Garage → "Gọi về bãi đỗ".

## Asset

Môi trường build không truy cập được kenney.nl / polyhaven nên **mọi model, texture, âm thanh đều sinh bằng code**. Muốn dùng model GLB thật (CC0), đặt file vào `public/assets/models/` và khai báo trong `public/assets/manifest.json` — xem `public/assets/CREDITS.md`. `normalizeModel()` sẽ tự scale về kích thước thật, đặt gốc giữa đáy, mặt trước hướng -Z.

## Cấu trúc

```
src/
  config/     constants, feel (game feel), products (shape/size/brand/label), furniture (size/tầng/ngăn), licenses, staff
  core/       EventBus, GameState, SaveSystem (version 3), Services, Random
  systems/    logic thuần: Time, Economy, Inventory, SlotLayout, Order, Pricing, Checkout, Customer, Staff, Build, Shop, Day
  engine/     Renderer (ACES, shadow), Post (Outline, Bloom, GTAO, SMAA/FXAA), Loop (fixed-step 60Hz), Input (pointer lock), Audio, SoundBank, Assets
  world/      NavGrid (0.5m), Pathfinding (A* + string-pulling), Colliders (AABB), Store, Exterior, Decor, Lighting, Queue
  products/   PackagingFactory, LabelTexture, Ean13, ProductInstances, Gallery
  player/     PlayerController, Interaction (raycast), HeldItem, CameraTween
  entities/   Shelf (FurnitureView), FurnitureModels, CheckoutCounter, Box, Human, Walker, Customer, Staff, Basket, Bubble, OpenSign
  game/       Game, World, GameUI, PlayInput, Actions, Checkout, CashDrawer, Customer/Staff/Furniture/Box managers, Effects
  build/      BuildMode
  ui/         DOM overlay: HUD, máy tính & apps, bảng giá nổi, thanh thu ngân, báo cáo ngày, menu, cài đặt, tutorial
tests/        vitest
```
