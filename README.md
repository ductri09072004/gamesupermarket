# 🏪 Mini Mart Tycoon

Game giả lập vận hành siêu thị 2D isometric chạy trên trình duyệt — **Phaser 3 + TypeScript (strict) + Vite**, logic được unit test bằng **Vitest**. Toàn bộ đồ hoạ được vẽ bằng code (không dùng file ảnh), âm thanh và nhạc nền lofi tổng hợp bằng WebAudio.

Spec đầy đủ nằm trong [`CLAUDE.md`](./CLAUDE.md).

## Chạy game

```bash
npm install
npm run dev      # mở http://localhost:5173
npm run build    # type-check + build production vào dist/
npm test         # unit test (vitest)
npm run lint     # tsc --noEmit
```

## Cách chơi

Vòng lặp: **Đặt hàng → Nhận thùng → Xếp kệ → Đặt giá → Mở cửa → Tính tiền → Mở rộng**.

| Phím | Chức năng |
| --- | --- |
| `W A S D` / mũi tên | Di chuyển (xoay theo trục isometric) |
| `E` | Tương tác vật phía trước (nhặt thùng, xếp kệ — giữ để xếp liên tục, máy tính, quầy, biển mở cửa…) |
| `Shift + E` | Lấy hàng từ kệ trở lại thùng đang cầm |
| `Q` | Đặt thùng xuống |
| `F` | Mở / đóng thùng |
| Click trái vào kệ | Bảng đặt giá |
| `B` | Chế độ xây dựng (`R` xoay, `Delete` bán lại 50%, `Esc` huỷ) |
| `1` `2` `3` | Tốc độ thời gian |
| `C` | Bật/tắt camera theo người chơi |
| Cuộn chuột / kéo chuột phải | Zoom / pan camera |
| `Space`, số, `Enter` | Ở quầy thu ngân: quét món, gõ máy POS, xác nhận |
| `Esc` | Rời quầy / đóng máy tính / menu tạm dừng |
| `F3` | Debug: toạ độ lưới, đường đi của khách, depth, FPS |

## Tính năng

- Lưới isometric 2:1, depth sort cho vật nhiều ô, tường chỉ vẽ ở 2 cạnh sau, cửa kính phía trước.
- Máy tính giả lập desktop: Market, Pricing, Furniture, Licenses, Expansion, Staff, Bank.
- Thùng hàng giao tới vỉa hè sau 10–20 giây, xếp kệ theo luật storage (kệ / tủ lạnh / tủ đông).
- Khách hàng AI (state machine + A* 8 hướng) theo giờ cao điểm × danh tiếng × diện tích, phản ứng giá "Đắt quá!", "Hết hàng :(", xếp hàng, bỏ về sau 60 giây.
- Quầy thu ngân: băng chuyền, quét món, thối tiền mặt bằng ngăn kéo, máy POS cho thẻ.
- Báo cáo cuối ngày (doanh thu, giá vốn, tiền thuê, điện, lương…), XP / cấp độ, giấy phép, Game Over khi nợ quá 3 ngày.
- Build mode (ghost xanh/đỏ, kiểm tra A* không chặn đường tới quầy), mở rộng tới 24×20, kho phía sau với kệ kho.
- Nhân viên thu ngân & xếp kệ (NPC tự động), ánh sáng theo giờ, tutorial ngày 1, lưu game localStorage có `version` để migrate.

## Cấu trúc

```
src/
  config/     # constants, products, furniture, licenses, staff — mọi số cân bằng game
  core/       # EventBus có kiểu, GameState, SaveSystem, Services, Input, Audio
  iso/        # IsoMath, IsoGrid, Footprint, DepthSort, Pathfinding (A*)
  systems/    # logic thuần (không phụ thuộc Phaser) — được unit test
  entities/   # Player, Customer, Staff, Box, Shelf (FurnitureView), Checkout
  render/     # vẽ texture placeholder bằng Graphics → generateTexture
  scenes/     # Boot, Preload, Game (+ game/ controllers), UI
  ui/         # DOM overlay: HUD, máy tính & apps, bảng giá, quầy thu ngân, báo cáo, menu
tests/        # vitest
```

Muốn thay placeholder bằng ảnh PNG: nạp ảnh trong `PreloadScene` với cùng texture key (ví dụ `tile_floor_a`, `furn_shelf_large_0`, `char_…`) — các hàm vẽ sẽ bỏ qua key đã tồn tại.
