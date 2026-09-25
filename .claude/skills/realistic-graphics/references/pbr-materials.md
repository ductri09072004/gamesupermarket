# Vật liệu PBR cho siêu thị

## Quy tắc chung
- `MeshStandardMaterial` cho hầu hết; `MeshPhysicalMaterial` chỉ cho kính, sơn bóng có clearcoat, nhựa trong
  (tốn hơn — không dùng cho sản phẩm instanced số lượng lớn trừ chai nước).
- colorSpace: `map`, `emissiveMap` → `THREE.SRGBColorSpace`; `normalMap`, `roughnessMap`, `metalnessMap`, `aoMap`
  → `THREE.NoColorSpace` (mặc định của TextureLoader, đừng set sRGB cho chúng).
- `aoMap` cần UV (r151+ dùng `uv` thường qua `aoMap.channel = 0`) — không cần `uv2` nữa.
- Texture lặp: `wrapS = wrapT = RepeatWrapping`, `repeat` = kích thước bề mặt (m) / kích thước texture (m),
  `anisotropy = renderer.capabilities.getMaxAnisotropy()` (giới hạn 8 ở chất lượng Trung) — sàn nhìn xiên sẽ hết nhoè.
- Không vật nào có roughness 0 hay 1 tuyệt đối; metalness chỉ 0 hoặc ~1 (kim loại trần), sơn trên kim loại là 0.
- Chống lặp lộ liễu trên sàn rộng: trộn 2 tỉ lệ texture hoặc thêm lớp decal bẩn/vết xe đẩy theo world-space.
- Dùng chung material giữa các instance (cache theo key như `mat()` trong `FurnitureModels.ts`) — mỗi material
  mới là thêm program/uniform upload.

## Bảng thông số
| Bề mặt | color | roughness | metalness | Map nên có | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| Gạch men sàn | trắng ngà | 0.15–0.3 | 0 | diff, nor, rough | roughness thấp để phản chiếu mờ đèn trần (CLAUDE.md §12); ron gạch roughness cao hơn qua map |
| Bê tông kho | xám | 0.85 | 0 | diff, nor, rough, ao | |
| Tường sơn | màu sơn | 0.9 | 0 | nor (vữa), rough | chân tường gạch/nhựa roughness 0.4 |
| Trần thạch cao | trắng | 0.95 | 0 | diff lưới ô trần | |
| Thép sơn tĩnh điện (kệ) | màu sơn | 0.45–0.55 | 0 | nor nhẹ (vân sơn) | pegboard: alphaTest hoặc normal lỗ |
| Inox/chrome (giá treo, tay nắm) | #d9dee4 | 0.15–0.25 | 1 | rough (vệt xước) | cần env map tốt, không có HDRI sẽ trông đen/xám |
| Nhôm lon | theo nhãn | 0.25–0.35 | 0.7–0.9 | nhãn + rough | nắp/đáy metalness 1 |
| Kính tủ | #dff3ff | 0.02–0.05 | 0 | — | Physical: `transmission` đắt; rẻ hơn: transparent opacity 0.12–0.2 + `envMapIntensity` 1.5, `depthWrite:false` |
| Nhựa PET (chai nước) | trong | 0.1 | 0 | — | opacity 0.35–0.5, `side: DoubleSide` nếu thấy lòng chai |
| Nhựa đục (vỏ đồ điện tử) | | 0.35–0.5 | 0 | | |
| Carton / hộp giấy | nâu/nhãn | 0.8 | 0 | nor vân giấy | cạnh vát nhẹ, băng keo roughness 0.3 |
| Vải (quần áo) | | 0.9–1 | 0 | nor vân dệt | `sheen` (Physical) đẹp nhưng đắt — chỉ bật ở chất lượng Cao |
| Gỗ (bàn máy tính) | | 0.55–0.7 | 0 | diff, nor, rough | |
| Màn hình LCD/biển đèn | đen | 0.2 | 0 | emissiveMap | emissiveIntensity 1–2 để bloom bắt được |

## Nâng cấp sản phẩm instanced (không phá hiệu năng)
- Vẫn 1 `InstancedMesh`/sản phẩm; thêm `normalMap`/`roughnessMap` *dùng chung* cho cả nhóm shape (một normal map
  "nếp nhăn túi" cho mọi `bag`, "gờ lon" cho mọi `can`) — chi phí gần như bằng 0.
- Nhãn canvas: vẽ thêm lớp bóng (gradient highlight dọc thân lon/chai), chữ có viền, ảnh minh hoạ vector; đặt
  canvas 1024 cho chất lượng Cao, 512 cho Trung, 256 cho Thấp.
- Biến thể nhỏ giữa instance: `instanceColor` nhân rất nhẹ (0.95–1.0) + xoay Y ngẫu nhiên ±3° — kệ nhìn "có người
  xếp" chứ không như render.
