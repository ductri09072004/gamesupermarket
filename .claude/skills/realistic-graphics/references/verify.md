# Kiểm chứng đồ họa

## Harness Playwright (headless)
Chromium có sẵn (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). Chạy `npm run build` rồi
`npx vite preview --port 4174 --strictPort &`. Launch với
`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
Trong trang: `window.__game` — dừng `loop.stop()`, bước logic bằng `__game.update(1/60)`, render bằng
`__game.render(1/60)`, đặt người chơi `__game.current.player.teleport(x, z, yaw)` + `.pitch`.
Ẩn overlay `.click-to-play` trước khi chụp.

## Góc chụp chuẩn (store 12×10 m mặc định)
- Lối vào nhìn vào trong: teleport(6, 9.3, 0), pitch -0.12
- Dãy kệ: teleport(3.5, 3.5, 0), pitch -0.2
- Quầy thu ngân: teleport(5.5, 8, π), pitch -0.3
- Cận kệ đầy hàng: teleport(2.2, 2.3, 0), pitch -0.35
Đặt tên `before-<góc>.png` / `after-<góc>.png` để so sánh.

## Số đo
`__game.r.renderer.info.render` → `calls`, `triangles`; `.memory` → `geometries`, `textures`.
SwiftShader chậm nên FPS headless vô nghĩa — chỉ so draw calls/triangles/textures; FPS thật cần người dùng thử
trên máy (F3 hiện FPS).

## Checklist
- [ ] `npm run build` + `npm test` sạch
- [ ] Không lỗi/cảnh báo console (kể cả 404 asset, cảnh báo shader)
- [ ] Settings Thấp tắt được mọi hiệu ứng mới
- [ ] Game vẫn chạy khi `manifest.json` rỗng (fallback code)
- [ ] CREDITS.md ghi đủ nguồn/license cho asset mới
