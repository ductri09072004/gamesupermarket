# Project: "Mini Mart Tycoon 3D" — first-person supermarket simulator (web)

## 1. Tầm nhìn
Game giả lập vận hành siêu thị góc nhìn thứ nhất trên trình duyệt, cảm giác gần với Supermarket Simulator:
người chơi tự tay bê thùng, xếp từng món lên kệ, dán giá, quét mã và thối tiền cho khách.
Ưu tiên số 1 là CẢM GIÁC CHẠM (tactile feel): mọi hành động phải có phản hồi hình, tiếng và chuyển động.
Ưu tiên số 2 là VẺ CHÂN THỰC ẤM CÚNG: ánh sáng đẹp, sản phẩm có nhãn rõ ràng, cửa hàng có không khí.
Vòng lặp cốt lõi giữ nguyên: ĐẶT HÀNG → NHẬN THÙNG → XẾP KỆ → ĐẶT GIÁ → KHÁCH MUA → THU NGÂN → MỞ RỘNG.

## 2. Tech stack
- Three.js (bản mới nhất) + TypeScript strict + Vite. Vitest cho logic.
- Loader: GLTFLoader (+ DRACOLoader nếu model nén), RGBELoader cho HDRI.
- Điều khiển: PointerLockControls. Va chạm: AABB tự viết (mọi nội thất đặt thẳng trục, xoay 90°), KHÔNG dùng engine vật lý ở giai đoạn đầu.
- Hậu kỳ: EffectComposer với RenderPass, OutlinePass (viền vật đang nhìn), SMAA/FXAA; tuỳ chọn SSAO và bloom nhẹ (tắt được).
- UI: DOM overlay (HTML + CSS thuần) cho HUD, menu PC, báo cáo ngày. Font "Nunito".
- Âm thanh: Three.js AudioListener/PositionalAudio cho âm 3D, file âm thanh trong public/assets/audio.

## 3. Tái sử dụng code cũ
- GIỮ NGUYÊN (chỉ sửa nếu cần): src/core (EventBus, GameState, SaveSystem), src/config, src/systems
  (Time, Economy, Inventory, Order, Pricing, Checkout, Staff), toàn bộ tests/.
- GIỮ VÀ CHUYỂN ĐỔI: Pathfinding A* trên lưới sàn (mỗi ô = 0.5m), dùng cho khách và nhân viên.
- XOÁ: mọi code Phaser, thư mục iso/, scenes/ cũ, texture vẽ bằng Graphics.
- Save cũ không cần tương thích; tăng SAVE_VERSION.

## 4. Kiến trúc thư mục mới
src/
  main.ts
  engine/
    Renderer.ts        # WebGLRenderer, shadow, tone mapping ACESFilmic, sRGB, resize, pixel ratio ≤ 2
    Post.ts            # EffectComposer + các pass, bật/tắt theo Settings
    Assets.ts          # nạp & cache GLB/texture/audio, màn hình loading có thanh %
    Input.ts           # bàn phím/chuột, pointer lock, trạng thái "đang ở UI"
    Audio.ts
    Loop.ts            # vòng lặp fixed-step cho logic (60Hz) + render theo requestAnimationFrame
  world/
    Store.ts           # dựng sàn/tường/trần/cửa/đèn theo kích thước cửa hàng, hỗ trợ mở rộng
    Lighting.ts        # đèn trần, ánh sáng theo giờ, cửa sổ
    Colliders.ts       # danh sách AABB, hàm resolve va chạm cho capsule người chơi
    NavGrid.ts         # lưới đi lại cho A*, cập nhật khi đặt/nhấc nội thất
  products/
    PackagingFactory.ts  # sinh mesh sản phẩm theo shape + nhãn canvas
    LabelTexture.ts      # vẽ nhãn: nền, tên hãng, tên SP, dung tích, mã vạch, logo hình học
    ProductInstances.ts  # InstancedMesh cho toàn bộ sản phẩm trên kệ
  player/
    PlayerController.ts  # di chuyển, headbob, ngồi xổm
    Interaction.ts       # raycast từ tâm màn hình, highlight, gợi ý phím
    HeldItem.ts          # vật đang cầm (thùng / món hàng / súng dán giá) hiển thị trước camera
  entities/  Shelf.ts  Box.ts  CheckoutCounter.ts  Customer.ts  Staff.ts  Computer.ts
  build/     BuildMode.ts
  ui/        hud.ts crosshair.ts computer/*.ts checkoutPanel.ts dayReport.ts settings.ts styles.css
Quy tắc: logic trong systems/ không import three. Entity 3D chỉ đọc state và gọi system. Mọi số cân bằng nằm trong config/.
Mỗi file < 300 dòng. Sau mỗi phase: `npm run build` + `npm test` sạch lỗi.

## 5. Đơn vị & không gian
- 1 đơn vị = 1 mét. Trục Y hướng lên. Tầm mắt người chơi 1.65m, bán kính capsule 0.3m, tốc độ đi 3.2 m/s, chạy (Shift) 5 m/s.
- Cửa hàng khởi đầu 12m × 10m, cao trần 3.2m; mở rộng từng nấc 2m theo chiều ngang hoặc sâu, tối đa 24m × 20m.
- Phía trước: vỉa hè + khu giao hàng. Phía sau (mở khoá sau): kho 6m × 10m.
- Mọi model nạp vào phải được chuẩn hoá: tính bounding box, scale về kích thước thật cấu hình trong furniture.ts,
  đặt gốc ở giữa đáy, xoay để mặt trước hướng -Z. Viết helper normalizeModel() dùng chung.

## 6. Sản phẩm chân thực bằng code (quan trọng)
config/products.ts mở rộng mỗi sản phẩm với:
{ shape: 'box'|'can'|'bottle'|'jar'|'bag'|'carton'|'tube', size: [w,h,d] (mét, kích thước thật),
  brand, label: { bg, accent, text, pattern: 'stripes'|'dots'|'wave'|'solid' }, volumeText: '500ml' }
- PackagingFactory tạo geometry theo shape:
  box = BoxGeometry bo góc nhẹ; can = CylinderGeometry có viền nắp; bottle = LatheGeometry (thân, cổ, nắp riêng màu);
  jar = cylinder + nắp; bag = box bị "phồng" (dịch đỉnh bằng noise) + mép răng cưa; carton = hộp sữa mái nhà; tube = kem đánh răng.
- LabelTexture vẽ lên canvas 512×512: nền theo bg, hoạ tiết pattern, tên hãng lớn, tên sản phẩm, dung tích,
  mã vạch EAN-13 giả (vẽ đúng dạng vạch từ id), logo hình học đơn giản. UV map nhãn quanh thân lon/chai, mặt trước hộp.
- Vật liệu: MeshStandardMaterial; lon kim loại (metalness 0.8, roughness 0.3), chai nhựa (roughness 0.2, trong suốt nhẹ nếu là nước),
  giấy/carton (roughness 0.8). Cache texture theo productId.
- Hiển thị trên kệ bằng InstancedMesh: 1 InstancedMesh cho mỗi sản phẩm, tối đa 5000 món toàn cửa hàng, vẫn 60fps.
- Có trang "Product Gallery" (debug, phím F4) xoay xem tất cả sản phẩm để kiểm tra nhãn.

## 7. Kệ & xếp hàng
- Mỗi kệ có nhiều tầng; mỗi tầng chia "slot"; mỗi slot tự tính lưới vị trí (cột × hàng sâu × chồng) theo size sản phẩm.
- Xếp hàng: người chơi cầm thùng đã mở, nhìn vào slot (slot được highlight khung trắng mờ), click trái đặt 1 món.
  Món bay từ thùng vào vị trí trống kế tiếp với tween 0.12s (ease-out), tiếng "tộc" nhẹ; giữ chuột để đặt liên tục.
  Click phải lấy 1 món từ slot về thùng.
- Slot trống nhận bất kỳ sản phẩm đúng loại storage; slot đã có hàng chỉ nhận cùng sản phẩm. Sai thì hiện thông báo ngắn giữa màn hình.
- Nhãn giá (price tag) 3D nhỏ ở mép tầng trước mỗi slot, text vẽ canvas; đổi màu vàng nếu giá > thị trường 20%, đỏ nếu lỗ.

## 8. Tương tác người chơi
- Crosshair chấm nhỏ; raycast từ tâm màn hình, tầm với 2.5m. Vật tương tác được có OutlinePass trắng + gợi ý phím dưới crosshair.
- Phím: WASD đi, Shift chạy, Ctrl ngồi (nhìn tầng kệ thấp), E nhặt/tương tác, Q thả thùng, F mở/đóng thùng,
  Chuột trái đặt hàng/dùng, Chuột phải lấy lại, Tab mở máy tính bảng giá nhanh, Esc menu.
- Vật đang cầm vẽ ở layer riêng trước camera (không xuyên tường), có sway nhẹ khi đi và nhìn.
- Headbob nhẹ khi đi (tắt được), tiếng bước chân theo nhịp. FOV 70, chỉnh được trong Settings.
- Thùng hàng: mesh carton có băng keo, nhãn in tên + icon sản phẩm + số lượng. Thùng đặt xuống sàn/kệ kho, xếp chồng được (snap trên nóc thùng khác).
  Thùng rỗng: gập lại, vứt vào thùng rác (E) có animation.

## 9. Máy tính, đặt hàng, giá
- Màn hình máy tính là DOM overlay mô phỏng hệ điều hành (giữ các app Market, Furniture, Licenses, Expansion, Staff, Bank, Pricing như bản 2D).
  Khi tương tác: camera tween sát vào màn hình máy tính rồi hiện DOM, thoát thì tween ngược lại.
- Hàng giao: xe tải nhỏ dừng ngoài cửa (có thể chỉ là âm thanh + thùng rơi xuống ô giao hàng), thùng xuất hiện chồng với tween.
- PricingSystem giữ nguyên công thức ratio. Đặt giá bằng "súng dán giá": nhìn vào nhãn giá trên kệ + E → bảng nhập giá nhỏ nổi cạnh crosshair.

## 10. Khách hàng 3D
- Model nhân vật GLB có AnimationMixer với clip Idle / Walk (+ Pick nếu có); tốc độ animation khớp tốc độ di chuyển.
  Ngẫu nhiên hoá màu áo/quần bằng cách clone material và đổi color.
- State machine giữ nguyên như bản 2D. Đi theo A* trên NavGrid, làm mượt đường (string-pulling), xoay người mượt về hướng đi.
- Khi lấy hàng: dừng trước kệ, quay vào kệ, animation với tay, món biến mất khỏi kệ và xuất hiện trong giỏ trên tay khách.
- Bong bóng suy nghĩ billboard (sprite) phía trên đầu: icon sản phẩm đang tìm, "Đắt quá!", "Hết hàng".
- Tối đa 25 khách; model dùng chung geometry (SkeletonUtils.clone), tắt animation của khách ở xa > 25m.

## 11. Thu ngân 3D (trải nghiệm quan trọng nhất)
- Người chơi đi vào sau quầy + E → camera khoá vào góc nhìn quầy (vẫn xoay nhẹ được), hiện chuột.
- Khách đặt từng món lên băng chuyền (animation). Người chơi click từng món: món bay qua máy quét, tia laser đỏ nháy, tiếng bíp,
  màn hình LCD 3D trên quầy (canvas texture) hiện tên món + tổng tiền cập nhật, món rơi vào túi.
- Tiền mặt: khách đưa tiền (mesh tờ tiền trên quầy), ngăn kéo 3D trượt ra với các khay mệnh giá; click khay để lấy tiền thối,
  tiền thối hiện xếp trên quầy, click để bỏ bớt; nút xác nhận. Màn hình hiện "Cần thối / Đã thối".
- Thẻ: khách đưa thẻ, máy POS 3D với phím bấm được (raycast), gõ số tiền rồi OK; bàn phím số cũng dùng được.
- Hoàn tất: tiếng ngăn kéo đóng + "ching", số tiền nổi lên, khách cầm túi đi ra, khách sau tiến lên.

## 12. Ánh sáng & không khí
- Renderer: toneMapping ACESFilmic, exposure 1.0, outputColorSpace sRGB, shadowMap PCFSoft.
- scene.environment từ HDRI trong nhà (PMREM). Đèn trần: dải đèn huỳnh quang (mesh emissive) + vài RectAreaLight hoặc SpotLight;
  chỉ 1–2 đèn đổ bóng để giữ hiệu năng.
- Cửa kính phía trước nhìn ra đường; ánh sáng ngoài đổi theo giờ (sáng → vàng chiều → tối xanh); đèn biển hiệu bật lúc tối.
- Sàn gạch có roughness thấp để phản chiếu mờ ánh đèn. Tường có chân tường, biển tên khu vực ("Đồ uống", "Đông lạnh").
- Âm thanh nền: nhạc siêu thị nhẹ, tiếng máy lạnh tủ đông (positional), chuông cửa khi khách vào.

## 13. Build mode 3D
- Phím B: camera chuyển sang nhìn từ trên xuống (orthographic hoặc perspective cao), hiện lưới 0.5m.
- Ghost model xanh/đỏ theo chuột, R xoay 90°, click đặt, click nhấc, Delete bán 50%.
- Kiểm tra A* từ cửa tới quầy trước khi cho đặt. Không nhấc kệ đang có hàng.

## 14. Hiệu năng (bắt buộc)
- Mục tiêu 60fps trên laptop tích hợp GPU với 25 khách và 3000 món trên kệ.
- InstancedMesh cho sản phẩm, merge geometry tĩnh của tường/sàn, frustum culling mặc định, giới hạn đèn đổ bóng.
- Settings chất lượng Thấp/Trung/Cao (shadow map size, SSAO, pixel ratio, bloom).
- Debug F3: hiển thị FPS, draw calls, triangles (renderer.info).

## 15. Definition of Done mỗi phase
Build + test sạch, không lỗi console khi chơi 3 phút, FPS ≥ 55 ở chất lượng Trung, tóm tắt thay đổi + cách test.
