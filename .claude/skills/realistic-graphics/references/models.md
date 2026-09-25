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
