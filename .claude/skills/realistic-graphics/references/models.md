# Model GLB thay cho hình khối code

## Đường ống có sẵn
- `src/engine/Assets.ts`: `loadManifest()` nạp các `.glb` trong `manifest.models`; `model(file)` trả bản clone;
  `normalizeModel(obj, size, frontYaw)` scale về kích thước thật, gốc giữa đáy, mặt trước -Z.
- `src/entities/Shelf.ts`: nếu có `<def.model>` (mặc định `<furnitureId>.glb`) thì dùng thay `buildFurnitureModel()`.
- Slot, nhãn giá, hit box vẫn tính từ `src/systems/SlotLayout.ts` (`GEOM` per storage: side/base/top/board/inset).

## Quy trình thay model một nội thất
1. Tìm/nhận model CC0; mở kiểm tra kích thước thật (m), hướng mặt trước, số tam giác (< 5k cho kệ, < 15k cho quầy).
2. Nén & dọn: `npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp --texture-size 1024`
   (cần mạng npm; nếu dùng meshopt/Draco thì gắn `MeshoptDecoder`/`DRACOLoader` vào GLTFLoader trong `Assets.ts`).
3. Đặt vào `public/assets/models/furniture/<id>.glb`, thêm vào `manifest.json`, ghi `CREDITS.md`.
4. Đo vị trí các tầng kệ trong model (Box3 từng mesh tên "shelf"/"board") và chỉnh `GEOM`/`size`/`tiers` trong
   config cho khớp — nếu lệch, hàng sẽ lơ lửng hoặc chìm vào tấm kệ. Ưu tiên chỉnh config hơn là biến dạng model.
5. Chụp ảnh kệ đầy hàng ở góc gần để kiểm tra hàng nằm đúng trên mặt tầng.
6. Kiểm tra build mode (ghost model), di chuyển kệ (M), bán kệ vẫn hoạt động.

## Kệ & tủ trưng bày — ĐÃ LÀM (lai: GLB + code)
- Kệ kho: `models/furniture/rack.glb` = Poly Haven `worn_metal_rack` ×2 ghép cạnh nhau (script gltf-transform:
  thêm node thứ 2 dùng chung mesh, `doubleSided=false`, texture WebP 1K → 530 KB). `GEOM.rack` trong SlotLayout đã
  chỉnh để mặt tầng khớp model (0.453 / 0.969 / 1.484 m).
- Kệ gondola / tủ mát / tủ đông: KHÔNG có model CC0 đạt chất lượng (đã rà Poly Haven, Poly Pizza — chỉ có freezer CC-BY
  thô, itch.io — PSX/voxel/trả phí). Dựng bằng code trong `src/entities/DisplayModels.ts`: khối vát cạnh (`rblock`),
  thép sơn tĩnh điện dùng normal+roughness ambientCG `Metal028` (slot `powder`), inox là roughness vệt xước vẽ canvas
  (texture Metal012 của ambientCG có vết loang trông như bẩn → bỏ), mặt kệ lưới = 1 tấm alphaTest.
- `src/entities/MergeStatic.ts`: gộp mesh tĩnh theo vật liệu, cache theo `def.id` (~8 draw call/kệ thay vì ~30),
  UV chiếu hộp theo mét cho vật liệu có `userData.tile` → vân texture đều trên mọi khối.
- Bẫy: nhãn giá đặt ở `zFront - 0.012` → nẹp giá phải nằm SAU mặt đó (trước đây nẹp che mất nhãn trên kệ gondola).
- Muốn đẹp hơn nữa phải mua bộ kệ/tủ (Sketchfab Store, CGTrader); thả `<id>.glb` vào `models/furniture/` là tự thay.

## Quầy thu ngân & máy tự tính tiền — ĐÃ LÀM (code)
- `CheckoutCounter.ts`: vỏ tĩnh gộp qua `mergedModel('counter:<id>')` — ốp gỗ sồi (Poly Haven `oak_veneer_01`, slot
  `wood`), mặt đá nhân tạo, nẹp inox, ray băng chuyền. Phần động (băng chuyền cuộn, laser, LCD, ngăn kéo, POS) giữ
  riêng vì có animation/raycast; mọi điểm neo (beltStart, scanPoint, drawer...) không đổi.
- `SelfCheckoutModel.ts`: máy tự tính tiền, màn hình canvas riêng từng máy + đèn gọi nhân viên (material riêng).

## Nhân vật (khách, nhân viên) — ĐÃ LÀM
Đang dùng Quaternius *Ultimate Animated Character Pack* (CC0) trong `public/assets/models/characters/`:
`src/entities/RiggedHuman.ts` (AnimationMixer Idle/Walk/Walk_Carry/PickUp, cùng API với `Human` qua interface
`HumanBody`, fallback người khối qua `createHuman()`), registry `CharacterModels.ts`, danh sách model ở
`src/config/characters.ts`. Nguồn tải là thư mục Google Drive (cần mở `drive.google.com`,
`drive.usercontent.google.com`); link thư mục nằm trên trang pack của quaternius.com.
Chuẩn bị file: `node scripts/prep_characters.mjs <thư mục .gltf> public/assets/models/characters`
(cần `npm i @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions` ở thư mục tạm).

Bẫy đã gặp:
- Xoá animation trong gltf-transform phải xoá cả channel + sampler, nếu không accessor vẫn nằm trong file (850 KB → 150 KB).
- Mọi model cùng khung xương → chỉ 1 file giữ clip, các file khác chỉ giữ mesh.
- Vật liệu gốc `doubleSided` → shadow acne lốm đốm trên người; đặt `side = FrontSide`, `shadowSide = BackSide`.
- GLTFLoader làm sạch tên node (`Fist.L` → `FistL`): dùng `THREE.PropertyBinding.sanitizeNodeName()`.
- Model Quaternius nhìn về +Z (game quy ước -Z) → xoay π. Đồ gắn vào xương tay phải bù tỉ lệ và giữ hướng
  theo thân (`alignHands()`), nếu không giỏ sẽ xuyên qua cẳng tay.
- Phong cách pack là chibi (đầu to). Muốn tỉ lệ người thật hơn: *Universal Base Characters* + *Universal
  Animation Library* của Quaternius (cùng nguồn Drive).

## Thành phố & xe — ĐÃ LÀM
Nhà (Ultimate Textured Building Pack), cây/bụi (Ultimate Nature), ô tô (Cars), đèn đường/biển báo (Modular
Streets, Public Transport) của Quaternius trong `public/assets/models/city/`, đặt bằng `src/world/CityLayout.ts`
(thuần dữ liệu, có test) + `CityInstances.ts` (InstancedMesh chia ô 70 m để frustum culling có tác dụng).
Xe máy & bán tải dựng bằng code (`src/entities/VehicleModels.ts`) vì chưa tải được model CC0; thả
`city/vehicle_moto.glb` / `city/vehicle_pickup.glb` (mặt trước -Z, gốc giữa đáy) vào manifest.city là tự thay.

Các gói này chỉ có FBX/OBJ. Quy trình chuyển (scripts/fbx/):
1. Liệt kê thư mục Drive: `python3 scripts/gdrive_list.py <folderId>`; tải file:
   `curl -sL "https://drive.usercontent.google.com/download?id=<id>&export=download&confirm=t" -o X.fbx`.
2. Đặt FBX + texture vào `src/`, symlink `three` → node_modules/three, chạy `python3 -m http.server 8765`,
   rồi `node conv.mjs <thư mục ra>`: FBXLoader + GLTFExporter trong Chromium headless, đưa về mét, gốc giữa đáy.
3. `node compress.mjs <vào> <ra> <tên...>` (weld + quantize, cần gltf-transform).

Bẫy đã gặp:
- GLTFExporter bỏ UV nếu vật liệu không có map → gắn texture giả 1×1 lúc xuất, gán atlas thật lúc chạy.
- Màu FBX của Quaternius đã là linear nhưng FBXLoader lại đổi sRGB→linear → quá tối: `color.convertLinearToSRGB()`.
- Mesh FBX có hàng trăm group xen kẽ vật liệu → gom tam giác theo tên vật liệu (1 mesh/vật liệu), nếu không 1 ô tô = 130 draw call.
- UV từ FBX theo quy ước flipY = true (khác glTF) và vượt [0,1] → atlas để flipY mặc định, RepeatWrapping, lọc Nearest.
- Tỉ lệ mỗi gói khác nhau (nhà ~0.025, cây 0.026, ô tô 0.01, đèn đường 0.045); xe buýt gói Public Transport sai tỉ lệ → bỏ.
- Trang artifact không nhận .glb/.hdr: bản online chuyển GLB → glTF JSON (buffer base64) đặt đuôi .json.

### Ghi chú cũ
- `src/entities/Human.ts` dựng người bằng khối; `Walker.ts`/`Customer.ts` điều khiển. Model rig (Quaternius CC0)
  cần: `SkeletonUtils.clone` cho mỗi khách, 1 `AnimationMixer`/khách với clip Idle/Walk (+ Pick), tốc độ clip khớp
  `CUSTOMER_SPEED`, tắt mixer khi xa > `NPC_ANIM_CULL_DISTANCE`.
- Giữ API công khai của `Human` (`handL` để gắn giỏ, `reach()`, `holding`) để phần logic không phải đổi.
- Random màu áo/quần: clone material theo khách rồi đổi `color` (CLAUDE.md §10) — chỉ clone material áo/quần, còn
  lại dùng chung.

## Sản phẩm
Không thay sản phẩm bằng GLB từng món: 56 sản phẩm × tối đa 5000 instance cần geometry nhẹ (< 300 tam giác) và
chung material. Nâng chất lượng bằng nhãn canvas đẹp hơn + normal/roughness map dùng chung theo shape
(`references/pbr-materials.md`). Chỉ món nhìn cận (vật đang cầm trên tay, món trên băng chuyền) mới đáng dùng
geometry chi tiết hơn — có thể làm LOD: instanced đơn giản trên kệ, mesh chi tiết khi cầm.

## Chi tiết nhỏ tạo cảm giác thật (có thể làm bằng code, không cần asset)
- Vát mọi cạnh khối lớn (`RoundedBoxGeometry`, radius 0.005–0.015) — cạnh sắc 90° là dấu hiệu "CG" rõ nhất.
- Gờ, khe, ốc vít, chân tăng chỉnh ở chân kệ; nẹp giá nhựa trong suốt phía trước tầng kệ.
- Wobbler/biển khuyến mãi cắm kệ, bảng "SALE", sticker giá trên thùng.
- Decal: vết bẩn sàn quanh cửa, vệt bánh xe, vết xước trên quầy.
