---
name: realistic-graphics
description: Nâng đồ họa Mini Mart Tycoon 3D (Three.js) từ "hình khối sinh bằng code" lên chân thực - thay bằng asset thật (texture PBR, HDRI, model GLB CC0), vật liệu vật lý đúng, ánh sáng/đổ bóng/AO, hậu kỳ và chi tiết không khí, trong khi vẫn giữ 60fps. Dùng skill này bất cứ khi nào người dùng nói đồ họa xấu/giả/"trông như khối hộp", muốn "chân thực hơn", "đẹp hơn", "realistic", "như Supermarket Simulator", muốn thêm texture, model, HDRI, ánh sáng, bóng đổ, phản chiếu, hậu kỳ, hoặc thay model nhân vật/kệ/sản phẩm - kể cả khi họ chỉ nói chung chung "cải thiện hình ảnh".
---

# Đồ họa chân thực cho Mini Mart Tycoon 3D

Game hiện dựng mọi thứ bằng code: kệ/tủ là các `BoxGeometry` ghép lại, sàn/tường là texture vẽ canvas,
nhân vật là khối đơn giản, ánh sáng là `RoomEnvironment` + vài đèn. Cảm giác "giả" đến từ 4 nguồn, xếp theo
mức ảnh hưởng tới mắt người chơi — hãy xử lý theo đúng thứ tự này vì cái trên nhân hiệu quả của cái dưới:

1. **Ánh sáng & môi trường** – phản xạ phẳng, không có bóng tiếp xúc, không có AO → vật "trôi" và bóng nhựa.
2. **Vật liệu bề mặt** – màu phẳng, không có normal/roughness map → mọi thứ như đất sét tô màu.
3. **Hình khối** – cạnh sắc 90°, không có vát, không có chi tiết nhỏ (ốc vít, khe, gờ, nhãn dán).
4. **Hậu kỳ & không khí** – thiếu tone/màu, bloom nhẹ ở đèn, bụi, vết bẩn, biển hiệu.

Một HDRI tốt + AO + texture sàn PBR thường cải thiện nhiều hơn cả chục model mới. Đừng nhảy vào thay model trước.

## Quy trình

### 1. Chụp ảnh "trước" và đo
Trước khi sửa, chụp 3–4 góc cố định (lối vào, dãy kệ, quầy thu ngân, kho) bằng harness Playwright
(xem `references/verify.md`) và ghi `renderer.info` (draw calls, triangles, textures). Mọi thay đổi phải so được
trước/sau ở cùng góc máy — "trông đẹp hơn" mà không có ảnh so sánh thì không kiểm chứng được.

### 2. Lấy asset thật (nếu mạng cho phép)
Chỉ dùng asset **CC0** (Poly Haven, ambientCG, Kenney, Quaternius) — game có thể được phát hành, nên license
phải sạch và không cần ghi công bắt buộc; vẫn ghi nguồn vào `public/assets/CREDITS.md`.
- Chạy `python3 .claude/skills/realistic-graphics/scripts/fetch_polyhaven.py --help` để tải HDRI/texture Poly Haven
  vào `public/assets/` và tự cập nhật `manifest.json` + `CREDITS.md`.
- Môi trường cloud có thể chặn các host này. Kiểm tra nhanh:
  `curl -s -o /dev/null -w '%{http_code}' -m 10 https://api.polyhaven.com/assets?t=hdris`.
  Nếu bị chặn (000/403), báo người dùng thêm host vào Network access của environment
  (danh sách host ở `references/asset-sources.md`) — rồi làm tiếp các bước không cần asset (ánh sáng, AO,
  vát cạnh, texture canvas tốt hơn) thay vì dừng lại.
- Chi tiết chọn độ phân giải, định dạng, đặt tên: `references/asset-sources.md`.
- Lần đầu dùng: `src/engine/Assets.ts` mới chỉ đọc `manifest.models`. Cần mở rộng để đọc `manifest.hdri`
  (→ `scene.environment`) và `manifest.textures.<slot>` (→ vật liệu sàn/tường/kim loại…), với fallback về
  texture canvas trong `src/world/Textures.ts` khi thiếu key. Kiểm tra xem việc này đã làm chưa trước khi thêm.

### 3. Ánh sáng, môi trường, bóng
Đọc `references/lighting-post.md`. Trọng tâm: HDRI nội thất qua PMREM làm `scene.environment`,
`envMapIntensity` theo từng vật liệu, SSAO/GTAO bật ở chất lượng Trung/Cao, bóng đổ mềm cho 1–2 đèn,
"contact shadow" giả dưới kệ/khách (decal tối mờ) — rẻ hơn nhiều so với tăng shadow map.

### 4. Vật liệu PBR
Đọc `references/pbr-materials.md` — bảng thông số cho từng loại bề mặt trong siêu thị (gạch men, sơn tường,
thép sơn tĩnh điện, inox, kính, nhựa, carton, vải, nhôm lon). Quy tắc quan trọng nhất: map màu (`map`,
`emissiveMap`) là sRGB, còn normal/roughness/metalness/AO là Linear — sai colorSpace là nguyên nhân số 1 khiến
texture thật trông "bạc màu" hoặc "cháy".

### 5. Model GLB thay cho khối code
Đọc `references/models.md`. Đường ống có sẵn: đặt `.glb` vào `public/assets/models/furniture/<id>.glb`, thêm vào
`manifest.json`, `Shelf.ts` tự gọi `normalizeModel()` và dùng thay model code. Nhưng slot/nhãn giá/hit box vẫn
tính từ `SlotLayout` — model mới phải khớp kích thước & vị trí tầng trong `config/furniture.ts`, nếu không hàng
sẽ lơ lửng. Luôn giữ model code làm fallback khi thiếu file (game phải chạy được khi `manifest.json` rỗng).

### 6. Hậu kỳ & chi tiết không khí
`references/lighting-post.md` (phần hậu kỳ) + các chi tiết rẻ mà đáng giá: vát cạnh (`RoundedBoxGeometry`) cho
mọi khối lớn, decal vết bẩn/vệt bánh xe đẩy trên sàn, poster khuyến mãi, ổ điện, bình cứu hoả, camera an ninh,
dải đèn phát sáng có bloom nhẹ.

### 7. Kiểm chứng
Chụp lại đúng các góc ở bước 1, so sánh, ghi `renderer.info` mới. Chạy `npm run build` + `npm test`.
Chạy game 3 phút không lỗi console. Nếu draw calls tăng > 30% hoặc có vật liệu mới trên mỗi instance thì xem lại
(merge geometry tĩnh, dùng chung material, atlas texture).

## Ràng buộc của dự án (từ CLAUDE.md)
- `src/systems/` không import three; số cân bằng ở `src/config/`; mỗi file < 300 dòng — tách module khi thêm
  loader/vật liệu (ví dụ `src/engine/Environment.ts`, `src/world/Materials.ts`).
- Hiệu năng: 60fps trên GPU tích hợp với 25 khách + 3000 món. Sản phẩm trên kệ là `InstancedMesh` (1/sản phẩm)
  — đừng phá instancing khi làm đẹp sản phẩm; nâng chất lượng qua texture nhãn và geometry dùng chung.
- Settings Thấp/Trung/Cao phải điều khiển được mọi hiệu ứng tốn kém (AO, bloom, độ phân giải texture, shadow).
- Asset nặng thì nén: texture ≤ 2K (sàn/tường 1K lặp là đủ), ưu tiên KTX2/WebP; GLB nén meshopt/Draco.
- Tên hãng sản phẩm luôn hư cấu; không dùng logo/thương hiệu thật trong texture tải về.

## Khi xong
Tóm tắt cho người dùng: đã thay gì, ảnh trước/sau, draw calls/triangles trước/sau, asset nào đã thêm (nguồn +
license), và host mạng nào cần mở nếu còn asset chưa tải được.
