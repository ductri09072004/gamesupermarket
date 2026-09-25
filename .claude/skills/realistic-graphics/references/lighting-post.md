# Ánh sáng, môi trường & hậu kỳ

Điểm móc hiện có: `src/engine/Renderer.ts` (renderer, tone mapping, held-item scene), `src/world/Lighting.ts`
(hemi + directional trần + mặt trời theo giờ, `skyAt(hour)`), `src/engine/Post.ts` (EffectComposer, OutlinePass,
SMAA/FXAA, GTAO, bloom — bật theo Settings). `scene.environment` hiện là `RoomEnvironment` sinh bằng code.

## Môi trường (HDRI) — thay đổi đáng giá nhất
```ts
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'; // r180+; bản cũ: RGBELoader
const pmrem = new THREE.PMREMGenerator(renderer);
const hdr = await new HDRLoader().loadAsync('assets/hdri/brown_photostudio_02_1k.hdr');
const env = pmrem.fromEquirectangular(hdr).texture;
hdr.dispose(); pmrem.dispose();
scene.environment = env;             // phản xạ + ánh sáng gián tiếp cho mọi MeshStandardMaterial
scene.environmentIntensity = 0.6;    // r163+: chỉnh toàn cục thay vì từng material
```
- Kiểm tra tên loader trong phiên bản three đang cài (`ls node_modules/three/examples/jsm/loaders | grep -i hdr`).
- Giữ `RoomEnvironment` làm fallback khi manifest không có `hdri`.
- Không đặt HDRI làm `scene.background` trong nhà — nền thật là tường; ngoài cửa kính dùng skybox/HDRI riêng mờ.
- Khi có HDRI, giảm `HemisphereLight` (nó cộng dồn và làm phẳng hình khối) — env đã lo ánh sáng khuếch tán.

## Đèn trực tiếp
- Siêu thị thật: nhiều dải huỳnh quang → ánh sáng đều từ trên. Mô phỏng: mesh emissive (thấy được) +
  1 `DirectionalLight` thẳng đứng đổ bóng + 2–4 `RectAreaLight` không đổ bóng
  (`RectAreaLightUniformsLib.init()` / `RectAreaLightTexturesLib` tuỳ bản) cho vệt sáng phản chiếu dài trên sàn bóng.
- Chỉ 1–2 đèn đổ bóng. `shadow.mapSize` theo chất lượng (512/1024/2048), `shadow.radius`/`blurSamples` cho mềm,
  `shadow.bias ≈ -0.0005`, `normalBias ≈ 0.02` để hết sọc (shadow acne) trên kệ.
- Bóng cố định (tường, kệ không di chuyển) có thể "nướng": render 1 lần bóng/AO vào lightmap sàn khi layout đổi
  (`renderer.shadowMap.autoUpdate = false` + `needsUpdate = true` khi build mode đặt/nhấc đồ) — tiết kiệm lớn.

## Bóng tiếp xúc & AO
- GTAO (`GTAOPass`) ở Trung/Cao: radius ~0.3–0.5 m, intensity ~1; tắt ở Thấp.
- Bẫy đã gặp: GTAOPass vẽ mọi thứ (trừ Points/Lines) vào G-buffer pháp tuyến → sprite bong bóng, kính, decal
  trong suốt bị AO phủ thành mảng xám/đen. `src/engine/Post.ts` có `GameGTAOPass` ẩn thêm sprite và mesh
  `transparent && !depthWrite` khi vẽ G-buffer — giữ nguyên khi sửa Post. Tăng `thickness`/`scale` quá tay cũng gây
  mảng đen ở góc trần; chỉnh `radius` (~0.35) là đủ.
- AO giả trong lòng kệ: `backShade()` trong `FurnitureModels.ts` (1 tấm gradient phủ vách sau/kệ) — dùng cho kệ mới.
- Rẻ hơn và luôn bật: decal bóng mờ dưới chân kệ, tủ, khách (plane với radial gradient, `depthWrite:false`,
  `polygonOffset`) — xoá cảm giác đồ vật "trôi".
- Model GLB có `aoMap` nướng sẵn: dùng luôn, rất rẻ.

## Tone mapping & màu
- Giữ ACESFilmic, exposure ~1.0; hoặc thử `AgXToneMapping` (màu bão hoà tự nhiên hơn với nhãn sản phẩm sặc sỡ) —
  so ảnh trước/sau rồi mới quyết.
- `OutputPass` phải đứng cuối composer (lo tone mapping + sRGB) — thiếu nó ảnh sẽ tối/bạc màu khi dùng composer.
- Color grading nhẹ: LUT (`LUTPass` + file `.cube`) ấm cho ban ngày, lạnh xanh cho buổi tối.

## Hậu kỳ theo chất lượng
| Hiệu ứng | Thấp | Trung | Cao |
| --- | --- | --- | --- |
| Pixel ratio | 1 | ≤1.5 | ≤2 |
| AA | FXAA | SMAA | SMAA |
| GTAO | tắt | bật (nửa độ phân giải) | bật |
| Bloom (threshold ~0.9, strength 0.25) | tắt | bật | bật |
| Shadow map | 512 | 1024 | 2048 |
| Texture | 512/1k | 1k | 2k |
Mọi pass mới phải đọc từ Settings — người chơi GPU yếu phải tắt được.

## Không khí
- Ngoài cửa kính: đường phố với HDRI/skybox đổi theo `skyAt(hour)`, xe chạy qua (sprite hoặc box di chuyển).
- Buổi tối: biển hiệu emissive + bloom, đèn đường `SpotLight` không đổ bóng.
- Bụi li ti trong vệt nắng qua cửa (Points với opacity thấp) — chỉ chất lượng Cao.
