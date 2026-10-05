# 🏪 Tạp Hoá Đầu Hẻm

Game giả lập siêu thị **góc nhìn thứ nhất** chạy trên trình duyệt — **Three.js + TypeScript (strict) + Vite**, logic được unit test bằng **Vitest**. Bản 2D isometric (Phaser) nằm ở nhánh `claude/zealous-wozniak-1us62r`.

Spec đầy đủ: [`CLAUDE.md`](./CLAUDE.md).

## Chạy game

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + build production vào dist/
npm test         # unit test (vitest)
```

## Deploy (Vercel, tự động)

Workflow [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml): mỗi lần push chạy `npm test` + `npm run build`, rồi deploy bằng Vercel CLI — nhánh mặc định của repo lên **production**, các nhánh khác / PR lên **preview** (URL in trong log job).

Thiết lập một lần:

1. Tạo project trên Vercel (Import repo, hoặc chạy `npx vercel link` trong thư mục dự án) → mở `.vercel/project.json` lấy `orgId` và `projectId`.
2. Tạo token tại Vercel → Account Settings → Tokens.
3. GitHub repo → Settings → Secrets and variables → Actions, thêm 3 secret: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
4. Trong Vercel → Project → Settings → Git, nên **ngắt kết nối Git** (hoặc tắt auto-deploy) để không deploy hai lần.

Cấu hình build nằm ở [`vercel.json`](./vercel.json).

## Điều khiển

| Phím / chuột | Chức năng |
| --- | --- |
| `W A S D` | Đi · `Shift` chạy · `Space` nhảy · `Ctrl` ngồi xổm để nhìn tầng kệ thấp |
| Chuột | Nhìn (click vào màn hình để khoá chuột) |
| **Chuột trái** | Nhặt thùng · **mở thùng đang cầm** · đặt 1 món lên kệ khi nhìn vào ngăn (giữ để đặt liên tục) · đặt giá (nhìn nhãn giá / kệ) · dùng máy tính · vào quầy thu ngân · lật biển Mở/Đóng cửa · bật/tắt đèn · lau rác · nhặt đồ rơi |
| **Giữ chuột trái 2 giây** | Nhìn vào kệ / nội thất rồi giữ → dời chỗ (vòng tiến độ quanh tâm ngắm; hàng đi theo kệ) |
| Chuột phải | Lấy lại 1 món từ ngăn về thùng |
| `C` · `G` · `R` | **Đóng** thùng đang cầm · **đặt** thùng xuống (lên nóc thùng khác thì xếp chồng) · **quăng** thùng về phía trước |
| `F` | Lên xe (nhìn vào xe) / xuống xe (khi đang lái) |
| Chuột trái vào xe | Tay trống: **dỡ** 1 thùng từ xe xuống tay · tay đang cầm thùng: **chất** thùng lên xe |
| `Tab` | Mở app Bảng giá nhanh |
| `M` | Mở bản đồ lớn (cuộn: thu phóng, kéo: di chuyển, **nhấp đúp**: chỉ đường) |
| `Enter` | Kết thúc ngày (sau 22:00, khi hết khách) — có thông báo trên màn hình |
| `T` | Tua nhanh 3× (bật/tắt) |
| Ở quầy | Click món trên băng chuyền (hoặc `Space`) để quét · click khay tiền để thối · `Enter` xác nhận · `Backspace` bỏ tờ vừa lấy · `Esc` rời quầy |
| `E` | Phím tương tác dự phòng (giống chuột trái, trừ mở thùng) |
| Lái xe | `W S` ga / lùi · `A D` lái · `Space` phanh tay · `F` xuống xe |
| `Esc` · `F3` · `F4` | Menu · debug (FPS, draw calls, triangles, đường đi khách) · Product Gallery |

(Đã bỏ chế độ xây dựng `B`: đặt nội thất bằng cách bê thùng nội thất giao tới và lắp; dời bằng giữ chuột trái.)

## Điểm chính

- **56 mặt hàng** chia 7 nhóm giấy phép (thêm **Thời trang**: áo thun, hoodie, quần jean, váy, mũ, tất; **Điện tử**: tai nghe, củ sạc, pin dự phòng, chuột, bóng đèn LED, pin AA, loa, đồng hồ thông minh), **sản phẩm sinh bằng code**: 10 kiểu (hộp bo góc, lon, chai, hũ, túi phồng, hộp sữa mái nhà, tuýp, áo/váy treo móc, quần treo kẹp, mũ lưỡi trai) với kích thước thật; nhãn canvas có tên hãng hư cấu, hoạ tiết, dung tích và mã vạch **EAN-13 đúng chuẩn**. Hiển thị trên kệ bằng `InstancedMesh` (1 mesh / sản phẩm).
- **Nội thất chuyên dụng**: *Giá treo quần áo* (3 thanh treo face-out, cần giấy phép Thời trang), *Tủ kính điện tử* (kệ kính 4 tầng có đèn LED, cần giấy phép Điện tử), *Máy bán hàng tự động* (16 ngăn lò xo, nhận đồ uống/đồ kệ vừa ngăn — khách tự mua & trả tiền ngay tại máy, không qua quầy).
- **Kệ theo tầng & ngăn**: mỗi ngăn tự tính lưới vị trí theo kích thước sản phẩm; khung highlight + bóng mờ món kế tiếp; món bay vào kệ với tween, lắc nhẹ, tiếng "tộc" đổi cao độ.
- **Quầy thu ngân 3D**: khách đặt từng món lên băng chuyền, món bay qua máy quét (laser nháy, bíp), **hoá đơn viết tay** trên quầy (ghi món đã quét, tổng, tiền khách đưa, tiền phải thối), **khay tiền giấy** bên phải mặt quầy với các khay mệnh giá, chỉ tiền giấy (200đ → 100.000đ), tiền thối xếp trên quầy; lẻ dưới 200đ không phải thối.
- **Không khí**: tone mapping ACES, bóng đổ, môi trường phòng (PMREM), dải đèn trần phát sáng + bloom, cửa gỗ hai cánh (chống mở lúc mở tiệm, đóng khi đóng cửa), ánh sáng ngoài trời đổi theo giờ, đèn đường & biển hiệu sáng ban đêm, âm thanh 3D (tiếng máy lạnh tủ đông, chuông cửa, bước chân, nhạc nền, tiếng đám đông).
- Logic cũ (tiền, giá, khách, kho, thời gian, lưu game) được giữ lại trong `src/systems` — không import Three.

### Thành phố & xe
- **Bản đồ thành phố** quanh cửa hàng: lưới 3 đường ngang × 4 đường dọc, vỉa hè lát gạch, cỏ, ~100 ngôi nhà, cây, đèn đường,
  đèn giao thông, xe đỗ ven đường — nhà phố Việt (Sketchfab, CC-BY), cây/xe/đèn đường model thật + texture PBR Poly Haven cho đường nhựa/vỉa hè/cỏ.
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
  systems/    logic thuần: Time, Economy, Inventory, SlotLayout, Order, Pricing, Checkout, Customer, Staff, Shop, Day
  engine/     Renderer (ACES, shadow), Post (Outline, Bloom, GTAO, SMAA/FXAA), Loop (fixed-step 60Hz), Input (pointer lock), Audio, SoundBank, Assets
  world/      NavGrid (0.5m), Pathfinding (A* + string-pulling), Colliders (AABB), Store, Exterior, Decor, Lighting, Queue
  products/   PackagingFactory, LabelTexture, Ean13, ProductInstances, Gallery
  player/     PlayerController, Interaction (raycast), HeldItem, CameraTween
  entities/   Shelf (FurnitureView), FurnitureModels, CheckoutCounter, Box, Human, Walker, Customer, Staff, Basket, Bubble, OpenSign
  game/       Game, World, GameUI, PlayInput, Actions, Checkout, CashDrawer, Customer/Staff/Furniture/Box managers, Effects
  build/      FpPlace (bê / dời nội thất)
  ui/         DOM overlay: HUD, máy tính & apps, bảng giá nổi, thanh thu ngân, báo cáo ngày, menu, cài đặt, tutorial
tests/        vitest
```

## Đo hiệu năng (mục tiêu 60 FPS ổn định)

- **F3** trong game: đồ thị thời gian từng khung (xanh ≤ 20ms, vàng, cam > 25ms, đỏ > 50ms; cột xanh dương = CPU logic), FPS, "1% thấp", số khung giật, draw calls. Vạch trắng = sự kiện (lên xe, mở menu...).
- **F7** đặt lại bộ đo · **F8** tải báo cáo JSON (máy/GPU, thống kê, kết luận đạt/không, 40 khung chậm nhất kèm sự kiện xung quanh).
- **Bench tự động**: mở `http://localhost:5173/?bench=drive` (hoặc địa chỉ đã deploy kèm `?bench=drive`) trong một **tab Chrome/Edge đang hiển thị**, không thu nhỏ. Game tự chạy kịch bản ~75 giây (đứng tiệm → mở cửa → máy tính → mua xe → lên xe → lái một vòng → xuống xe), in bảng kết quả theo từng pha và tải file JSON. Không ghi đè bản lưu nào.
- Ngưỡng và kết luận đạt/không nằm ở `src/config/perf.ts`, logic thống kê ở `src/systems/PerfStats.ts` (có test).
- Laptop có 2 GPU: Windows → Settings → System → Display → Graphics → thêm trình duyệt → "High performance" để chạy bằng GPU rời. Báo cáo ghi rõ GPU nào đang được dùng.

### Ngân hàng & mua sắm trong máy tính
- **Vay vốn** (app Ngân hàng): hạn mức = 1.000.000đ × cấp người chơi; 3 gói kỳ hạn (3 / 7 / 14 ngày, lãi 1,0 / 1,2 / 1,5 %/ngày, lãi đơn), tối đa 3 khoản cùng lúc. Đáo hạn cuối ngày tự trừ gốc + lãi (thiếu tiền thì ghi nợ như chi phí khác); tất toán sớm chỉ tính lãi số ngày đã vay. Lãi vay xuất hiện trong báo cáo cuối ngày.
- **Nội thất** thêm vào giỏ như hàng hoá, bấm Mua mới trả tiền (một đơn, xe tải giao các thùng).
- Ảnh sản phẩm / nội thất / xe / giấy phép trong máy tính là mô hình 3D thật chụp sẵn (`src/ui/productThumb.ts`).

### Phố & hẻm
- **Đường trước cửa hàng rộng 1,5 làn** (6,9m): 1 làn chạy xe + nửa làn ven vỉa hè làm chỗ đỗ, có vạch đứt ngăn. Xe mua về (và "Gọi về trước cửa hàng") đỗ song song sát vỉa hè ngay trước cửa hàng.
- **Hẻm nhỏ giữa các nhà** (`src/world/Alleys.ts`, rộng 1,5m — vừa 2 xe máy): hẻm **thông hai đầu**, hẻm **cụt** (bít bằng mặt hông nhà), **ngõ nhánh** rẽ từ hẻm lớn; sàn **dốc lên xuống** (người chơi đi bám theo dốc). Dấu vết sinh hoạt: cây chậu, dây phơi quần áo, túi/thùng rác, xô, dép, bàn thờ treo tường có đèn đỏ ban đêm, đèn lồng, xe máy dựng sát tường, bộ ghế đẩu + bàn cuối hẻm cụt.

### Bản đồ & chỉ đường
- **Bản đồ nhỏ** ở góc phải màn hình (lấy người chơi làm tâm, hiện tên điểm đến + quãng đường còn lại); bấm vào hoặc nhấn `M` để mở bản đồ lớn.
- Bản đồ lớn có đường, nhà, hẻm, cửa hàng, kho sỉ, trạm buýt, tên đường và danh sách địa điểm (ngã tư, đầu từng hẻm, xe của bạn). **Nhấp đúp** lên bản đồ để chỉ đường: game tìm đường đi bộ (A* trên lưới thành phố, đi được cả vào hẻm), vẽ đường vàng trên bản đồ và **mũi tên vàng + cột sáng** ngoài đời thật; tới nơi sẽ báo.
