# Nguồn asset CC0 & cách chọn

| Nguồn | Có gì hữu ích cho siêu thị | Host cần mở mạng | Ghi chú |
| --- | --- | --- | --- |
| Poly Haven | HDRI nội thất (studio, kho, cửa hàng), texture gạch/bê tông/gỗ/kim loại, vài model đồ vật | `api.polyhaven.com`, `dl.polyhaven.org` | Có API JSON, script `fetch_polyhaven.py` dùng nó |
| ambientCG | Texture PBR rất nhiều: Tiles, PaintedPlaster, Metal, Cardboard, Fabric, Plastic | `ambientcg.com`, `acg-download.struffelproductions.com` | Tải zip theo `assetId` + độ phân giải (`1K-JPG`) |
| Kenney | Model low-poly đồ nội thất, thực phẩm, nhân vật | `kenney.nl` | Phong cách hoạt hình — hợp làm placeholder hơn là "chân thực" |
| Quaternius | Nhân vật rig sẵn + animation Idle/Walk (CC0) | `quaternius.com` | Hợp cho khách/nhân viên (thay `Human.ts`) |
| glTF Sample Assets (Khronos) | Model mẫu để test loader/vật liệu | `raw.githubusercontent.com` | Thường được mở sẵn; license từng model khác nhau — đọc kỹ |

Không dùng: Sketchfab/TurboSquid trừ khi người dùng tự cung cấp file và xác nhận license; Mixamo (license không phải CC0,
không được phân phối lại model gốc).

## Gợi ý asset cụ thể (Poly Haven id)
- HDRI nội thất cho `scene.environment`: `brown_photostudio_02`, `studio_small_08`, `empty_warehouse_01`,
  `artist_workshop`. Ngoài trời cho cửa kính: `kloofendal_48d_partly_cloudy_puresky`.
- Sàn gạch: `tiles_0x`, `floor_tiles_06`, `white_tiles`; bê tông kho: `concrete_floor_02`; nhựa đường: `asphalt_02`.
- Tường: `painted_plaster_wall`, `plastered_wall_04`; gạch ốp chân tường: `tiles_02`.
- Kim loại kệ: `metal_plate`, `corrugated_iron` (kho); gỗ: `wood_table_001`.
Tên id có thể thay đổi — liệt kê bằng `fetch_polyhaven.py list --type textures --search tiles`.

## Độ phân giải & định dạng
- HDRI môi trường: **1k** `.hdr` là đủ (PMREM làm mờ); 2k chỉ khi thấy rõ trên kính/inox.
- Texture lặp (sàn, tường): **1k**, `repeat` theo mét (sàn 1 tile ≈ 0.6 m). Texture nhìn gần (quầy, POS): 2k.
- Bộ map cần: `diff` (sRGB), `nor_gl` (normal OpenGL — Three.js dùng quy ước OpenGL, *không* dùng `nor_dx`),
  `rough`, `ao` hoặc gói `arm` (AO/Rough/Metal trong 3 kênh R/G/B → gán cùng 1 texture cho `aoMap`,
  `roughnessMap`, `metalnessMap`).
- Tổng dung lượng asset nên < 30 MB để màn hình loading không quá lâu.

## Vị trí file & đăng ký
```
public/assets/
  hdri/<id>_1k.hdr
  textures/<slot>/<id>_1k_{diff,nor_gl,rough,ao,arm}.jpg   # <slot>: floor, wall, ceiling, metal, wood, concrete...
  models/furniture/<furnitureId>.glb
  models/characters/<name>.glb
  manifest.json   # { "models": [...], "hdri": "hdri/x_1k.hdr", "textures": { "floor": { "id": "...", "maps": {...} } } }
  CREDITS.md      # mỗi file: nguồn + URL + license CC0
```
`manifest.json` là nguồn duy nhất cho biết file nào tồn tại — code chỉ nạp những gì có trong đó, nên không bao giờ
sinh 404 trên console, và thiếu asset thì quay về texture/model sinh bằng code.
