# Project: "Mini Mart Tycoon" — 2D isometric supermarket simulator

## 1. Tầm nhìn

Game giả lập vận hành siêu thị (lấy cảm hứng từ Supermarket Simulator) ở dạng 2D isometric, chạy trên trình duyệt.

Người chơi điều khiển một nhân vật chủ tiệm: đặt hàng qua máy tính, bê thùng hàng lên kệ, đặt giá bán,

tính tiền cho khách ở quầy thu ngân, mở rộng cửa hàng và thuê nhân viên.

Vòng lặp cốt lõi: ĐẶT HÀNG → NHẬN THÙNG → XẾP KỆ → ĐẶT GIÁ → KHÁCH MUA → THU NGÂN → CÓ TIỀN → MỞ RỘNG.

## 2. Tech stack (bắt buộc)

- Phaser 3 (bản 3.x mới nhất) + TypeScript (strict mode) + Vite.

- Vitest cho unit test phần logic (economy, pricing, pathfinding, inventory).

- UI menu phức tạp (máy tính đặt hàng, bảng giá, báo cáo cuối ngày) làm bằng DOM overlay (HTML + CSS thuần,

  không React) đặt đè lên canvas. HUD đơn giản (tiền, giờ, ngày) cũng làm bằng DOM.

- KHÔNG dùng asset ảnh bên ngoài ở giai đoạn đầu: mọi sprite được vẽ bằng code (Phaser Graphics →

  generateTexture) trong PreloadScene. Thiết kế sao cho sau này thay bằng file PNG chỉ cần sửa 1 chỗ (texture key).

- Lưu game bằng localStorage (JSON, có trường `version` để migrate).

## 3. Kiến trúc & quy ước code

Cấu trúc thư mục:

src/

  main.ts                 # khởi tạo Phaser game

  config/

    constants.ts          # TILE_W=64, TILE_H=32, tốc độ, giờ mở cửa... (mọi con số cân bằng game để ở đây)

    products.ts           # dữ liệu sản phẩm

    furniture.ts          # dữ liệu nội thất (kệ, tủ lạnh, quầy...)

    licenses.ts           # giấy phép mở khoá sản phẩm

  core/

    EventBus.ts           # event emitter toàn cục (typed events)

    GameState.ts          # state trung tâm, serializable, là nguồn sự thật duy nhất

    SaveSystem.ts

  iso/

    IsoMath.ts            # chuyển đổi toạ độ grid <-> screen

    IsoGrid.ts            # lưới ô, trạng thái walkable/occupied

    DepthSort.ts

    Pathfinding.ts        # A* trên lưới

  systems/

    TimeSystem.ts         # giờ trong ngày, ngày, tốc độ thời gian

    EconomySystem.ts      # tiền, giao dịch, hoá đơn

    InventorySystem.ts    # hàng trên kệ, hàng trong kho, thùng hàng

    OrderSystem.ts        # đặt hàng, giao hàng

    CustomerSystem.ts     # sinh khách, AI khách

    PricingSystem.ts      # logic khách chấp nhận giá

    CheckoutSystem.ts     # quét hàng, thanh toán, thối tiền

    StaffSystem.ts        # nhân viên

    BuildSystem.ts        # chế độ xây dựng/đặt nội thất

  entities/

    Player.ts  Customer.ts  Box.ts  Shelf.ts  Checkout.ts  Staff.ts

  scenes/

    BootScene.ts  PreloadScene.ts  GameScene.ts  UIScene.ts

  ui/                     # DOM overlay

    hud.ts  computer.ts  pricePanel.ts  checkoutPanel.ts  dayReport.ts  styles.css

tests/                    # vitest

Quy tắc:

- Logic game (systems) KHÔNG phụ thuộc Phaser nếu có thể → dễ unit test. Entity/scene chỉ hiển thị và gọi system.

- Giao tiếp giữa system/UI qua EventBus với tên event có kiểu (ví dụ 'money:changed', 'customer:checkout').

- Không hard-code số cân bằng game trong logic; lấy từ config/.

- Mỗi file < 300 dòng; tách nhỏ khi vượt.

- Sau mỗi thay đổi: chạy `npm run build` và `npm test`, sửa hết lỗi TypeScript trước khi báo xong.

- Không xoá tính năng đã có khi làm phase mới. Nếu cần refactor lớn, hỏi trước.

## 4. Hệ toạ độ isometric

- Ô hình thoi tỉ lệ 2:1: TILE_W = 64, TILE_H = 32.

- gridToScreen(gx, gy): x = (gx - gy) * TILE_W/2 + originX ; y = (gx + gy) * TILE_H/2 + originY

- screenToGrid(sx, sy): dùng công thức nghịch đảo rồi Math.floor; phải tính theo world coords (có camera scroll/zoom).

- Depth sort: depth = (gx + gy) * 10 + layerOffset; vật thể nhiều ô dùng ô "xa camera nhất" (gx+gy lớn nhất) của footprint.

  Nhân vật di chuyển giữa các ô dùng toạ độ thực (float) để depth mượt.

- Di chuyển bằng WASD phải được xoay theo trục isometric: W = lên màn hình (gx-1, gy-1), S = xuống,

  A = trái (gx-1, gy+1), D = phải (gx+1, gy-1); chuẩn hoá vector để đi chéo không nhanh hơn.

- Camera: kéo chuột phải/giữa để pan, cuộn chuột để zoom (0.5x–2x), camera follow người chơi (có thể tắt).

- Tường chỉ vẽ ở 2 cạnh phía sau (cạnh trên-trái và trên-phải) để không che tầm nhìn; cửa ra vào ở cạnh trước.

## 5. Bản đồ

- Khu cửa hàng ban đầu: lưới 12x10 ô bên trong tường. Có thể mở rộng lên tối đa 24x20 qua các gói "Mở rộng".

- Bên ngoài: vỉa hè phía trước (nơi khách đi vào và thùng hàng được giao tới), khu kho nhỏ phía sau (mở khoá sau).

- Mỗi ô có: floorType, occupiedBy (id nội thất | null), walkable.

## 6. Người chơi

- Di chuyển WASD, tốc độ 3 ô/giây, animation 4 hướng (placeholder: hình khối người đơn giản khác màu theo hướng).

- Phím E: tương tác với vật gần nhất trong bán kính 1.5 ô phía trước mặt (hiện gợi ý "[E] Nhặt thùng" ...).

- Có thể cầm tối đa 1 thùng hàng. Khi cầm thùng, đứng cạnh kệ phù hợp và nhấn E (hoặc giữ E) để xếp từng món lên kệ.

- Phím Q: đặt thùng xuống đất. Phím F: mở/đóng thùng (thùng rỗng có thể vứt vào thùng rác).

- Chuột trái click vào kệ: mở bảng đặt giá cho sản phẩm trên kệ đó.

## 7. Sản phẩm (config/products.ts)

Mỗi sản phẩm: { id, name, category, storage: 'shelf'|'fridge'|'freezer', unitsPerBox, costPerUnit,

marketPrice, licenseId, color (cho placeholder) }.

Dữ liệu khởi đầu (giá USD, có thể đổi đơn vị tiền trong constants):

- Nhóm Cơ bản (license 0): Mì gói, Nước suối, Bánh quy, Nước ngọt lon, Gạo túi 1kg, Dầu ăn, Snack khoai tây, Kẹo.

- Nhóm Sữa & Lạnh (license 1): Sữa tươi, Sữa chua, Phô mai, Trứng (fridge).

- Nhóm Đông lạnh (license 2): Kem, Há cảo, Xúc xích, Thịt đông lạnh (freezer).

- Nhóm Hoá phẩm (license 3): Dầu gội, Kem đánh răng, Bột giặt, Giấy vệ sinh.

- Nhóm Đồ uống cao cấp (license 4): Cà phê, Trà, Nước ép, Bia.

Hãy điền số liệu hợp lý: costPerUnit 0.5–8$, marketPrice ≈ cost × 1.3–1.6, unitsPerBox 6–24.

Market price dao động ±5% mỗi ngày (ngẫu nhiên có seed).

## 8. Nội thất (config/furniture.ts)

Mỗi loại: { id, name, footprint {w,h}, price, capacity (số "slot" sản phẩm), storage type, licenseRequired }.

- Kệ nhỏ 1x1 (2 slot), Kệ lớn 2x1 (4 slot), Tủ lạnh 2x1 (fridge, 3 slot), Tủ đông 2x1 (freezer, 3 slot),

  Quầy thu ngân 2x1, Thùng rác 1x1, Kệ kho 2x1 (chỉ đặt trong kho, chứa thùng).

- Mỗi slot chứa 1 loại sản phẩm, tối đa N món (ví dụ 12). Slot trống có thể nhận bất kỳ sản phẩm đúng loại storage.

- Nội thất xoay được 4 hướng (phím R trong Build mode); với placeholder chỉ cần 2 hình (lật ngang).

## 9. Đặt hàng & giao hàng

- Máy tính trên bàn trong cửa hàng (tương tác E) mở giao diện "PC" dạng desktop giả lập với các app:

  1) Market: danh sách sản phẩm đã mở khoá, giỏ hàng, số thùng, tổng tiền, nút Mua.

  2) Furniture: mua nội thất (mua xong vào Build mode để đặt).

  3) Licenses: mua giấy phép mở khoá nhóm hàng (yêu cầu cấp độ cửa hàng).

  4) Expansion: mua mở rộng diện tích.

  5) Staff: thuê/sa thải nhân viên.

  6) Bank: xem số dư, lịch sử giao dịch, vay (tuỳ chọn).

- Đơn hàng giao sau 10–20 giây thực, thùng xuất hiện xếp chồng ở ô giao hàng trên vỉa hè.

  Thùng hiển thị màu + nhãn sản phẩm; hover hiện tooltip "Mì gói ×20".

## 10. Giá bán & khách hàng

- PricingSystem: ratio = sellPrice / marketPrice.

  ratio ≤ 1.0 → xác suất mua 100%; 1.0 < ratio ≤ 1.5 → xác suất giảm tuyến tính từ 100% xuống 20%;

  ratio > 1.5 → 0% và khách hiện bong bóng "Đắt quá!" (-1 danh tiếng nhỏ).

  Giá quá thấp (< cost) vẫn bán được nhưng lỗ — hiển thị cảnh báo đỏ trong bảng giá.

- Khách sinh ra theo nhịp phụ thuộc giờ trong ngày (cao điểm 11–13h và 17–20h) × danh tiếng × diện tích.

- AI khách (state machine): ENTER → BROWSE (chọn 1–6 món từ danh sách mong muốn, chỉ gồm sản phẩm đã mở khoá)

  → đi tới kệ chứa món đó (A*) → nếu kệ hết hàng: bong bóng "Hết hàng :(" và bỏ qua → nếu giá chấp nhận: lấy hàng

  → QUEUE ở quầy thu ngân (xếp hàng theo ô định sẵn) → CHECKOUT → LEAVE.

  Nếu chờ quá 60 giây ở hàng đợi: bỏ về, giảm danh tiếng.

- Mỗi khách có sprite placeholder ngẫu nhiên (màu áo/tóc), bong bóng suy nghĩ hiện icon sản phẩm đang tìm.

- Tránh va chạm đơn giản: khách không đi xuyên nhau khi đứng yên trong hàng; khi di chuyển cho phép chồng nhẹ.

## 11. Thu ngân (phần "cảm giác" quan trọng nhất)

- Người chơi đứng vào ô sau quầy và nhấn E → chuyển sang chế độ thu ngân: mở checkoutPanel (DOM) ở dưới màn hình.

- Các món của khách hiện trên băng chuyền; click từng món để "quét" (tiếng bíp, món bay vào túi, tổng tiền cộng dần).

- Sau khi quét hết, khách chọn thanh toán:

  a) Tiền mặt: khách đưa số tiền (ví dụ tổng 13.40$, đưa 20$). Người chơi click các tờ tiền/đồng xu

     trong ngăn kéo để thối (hiện "Đã thối: x / Cần thối: y"), bấm Xác nhận. Thối sai → mất khoản chênh lệch hoặc khách phàn nàn.

  b) Thẻ: bàn phím POS, người chơi gõ đúng số tiền rồi Enter. Gõ sai → báo lỗi, gõ lại.

- Thưởng tốc độ: thanh toán nhanh → khách vui (+danh tiếng).

- Nhấn Esc để rời quầy.

## 12. Thời gian, ngày & kinh tế

- 1 giây thực = 1 phút trong game. Cửa hàng mở 8:00–22:00. Nút tốc độ 1x / 2x / 3x (chỉ khi không ở quầy thu ngân).

- Người chơi bật/tắt biển "Mở cửa" ở cửa ra vào. Sau 22:00 không có khách mới; khi khách cuối rời đi → nút "Kết thúc ngày".

- Báo cáo cuối ngày (DOM modal): doanh thu, giá vốn, lợi nhuận gộp, số khách, khách bỏ về, chi phí (tiền điện

  theo số tủ lạnh/đông, lương nhân viên, tiền thuê theo diện tích), lợi nhuận ròng, thay đổi danh tiếng, XP.

- Tiền khởi đầu: 1500$. Hết tiền và nợ quá 3 ngày → Game Over (có thể tắt trong settings).

- Cấp độ cửa hàng (Store Level) tăng theo XP (XP = doanh thu/10). Level mở khoá license và mở rộng.

## 13. Nhân viên (mở khoá ở Level 5+)

- Thu ngân: ngồi quầy tự động tính tiền (chậm hơn người chơi khá giỏi), lương/ngày.

- Nhân viên xếp kệ: tự lấy thùng từ kho/vỉa hè và châm hàng vào kệ còn dưới 30%.

- Hiển thị trạng thái nhân viên, có thể sa thải.

## 14. Build mode

- Phím B bật/tắt. Hiện lưới, nội thất đang cầm đi theo chuột ở dạng "ghost": xanh = đặt được, đỏ = không.

- Click trái đặt, R xoay, click vào nội thất có sẵn để nhấc lên di chuyển, Delete để bán lại (hoàn 50%).

- Không được chặn hoàn toàn đường đi từ cửa vào tới quầy thu ngân (kiểm tra bằng A* trước khi cho đặt).

- Không cho nhấc kệ đang có hàng (hoặc hàng tự vào thùng).

## 15. Hình ảnh & cảm giác (juice)

- Palette pastel sáng, nền sàn gạch caro 2 màu, tường màu kem, viền đậm 2px cho vật thể.

- Placeholder: kệ = hộp isometric (vẽ 3 mặt với 3 sắc độ), sản phẩm = ô vuông nhỏ màu theo product.color xếp trên kệ.

- Tween: tiền bay lên "+$4.20" khi bán, thùng nảy nhẹ khi đặt xuống, kệ rung nhẹ khi xếp hàng.

- Âm thanh tổng hợp bằng WebAudio (không file): bíp quét mã, tiếng "ching" tiền, tiếng cửa mở. Có nút tắt tiếng.

- Font: dùng Google Font "Nunito" cho UI.

## 16. Lưu game

- Auto-save cuối mỗi ngày + nút Save thủ công. Lưu: tiền, ngày, level, XP, danh tiếng, license, layout nội thất,

  hàng trên kệ, thùng đang nằm trên sàn, giá bán, nhân viên, settings.

- Main menu: Tiếp tục / Game mới / Cài đặt.

## 17. Definition of Done cho mỗi phase

- `npm run build` không lỗi, `npm test` pass, không có lỗi console khi chơi 3 phút.

- Tóm tắt ngắn: đã làm gì, file nào thay đổi, cách test thủ công.
