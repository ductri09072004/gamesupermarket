# Đo hiệu năng, giữ nguyên đồ họa

Chạy Vite rồi mở `/scripts/performance/lite.html` trong **tab đang hoạt động**. Công cụ dùng ván thử seed 7, giữa trưa, preset Siêu nhẹ, không ghi save. Mỗi góc camera làm nóng 5 giây rồi đo 12 giây. Không chạy build/test hoặc tải nặng trong thời gian đo. Tab nền có thể bị trình duyệt giới hạn còn 1 FPS và không cho kết quả hợp lệ.

Các góc nhìn:

- Cửa hàng: camera `(4, 1.65, 19)`, nhìn `(1, 1.2, 20)`.
- Phố: camera `(6, 8, 24)`, nhìn `(48, 2, 22)`.

JSON hiển thị chứa FPS, thời gian khung hình, CPU, draw calls, tam giác và bộ đếm geometry/texture của Three.js. Bộ đếm này không phải số MB RAM/VRAM. Xe và khách chuyển động ngẫu nhiên nên số đo giữa các lần chạy có thể khác nhau.

Nút kiểm tra đổi đồ họa chạy Cao → Siêu nhẹ → Vừa → Siêu nhẹ → Thấp → Siêu nhẹ, sau đó dựng lại phố Siêu nhẹ hai lần. Các lần cuối giúp phát hiện tài nguyên tăng liên tục. `?lifetimeOnly` bỏ lượt đo FPS để kiểm tra vòng đời ngay. Nút Ẩn/hiện kết quả giúp đối chiếu hình ảnh. `?baseline` bỏ qua culling phố và sản phẩm để so sánh riêng tối ưu culling; các tối ưu vòng đời hậu kỳ vẫn hoạt động.

## Kết quả ngày 08/10/2026

GPU tích hợp AMD Radeon Graphics, WebGL2, viewport và render buffer **714 × 668** ở cả trước và sau. Các thông số preset giữ nguyên: pixelRatio 1, SMAA bật, vật liệu PBR, chi tiết nhà và LOD cây như trước. Không hạ độ phân giải, không giảm số xe/người, không đổi tầm nhìn.

| Góc nhìn | FPS trung bình trước | FPS trung bình sau | Tam giác/khung trước | Tam giác/khung sau | Draw calls trước/sau |
|---|---:|---:|---:|---:|---:|
| Cửa hàng | 16.94 | 24.95 | 1,766,139 | 1,195,926 | 569 / 489 |
| Phố | 16.79 | 24.54 | 2,400,356 | 1,667,586 | 783 / 726 |

Đây là hai lượt đo ngắn trước/sau trên máy hiện tại, không phải cam kết FPS trên mọi thiết bị. Giảm khoảng 30–32% tam giác gửi lên GPU. Lượt phố vẫn có một khung 244ms; FPS và độ ổn định chưa đạt mục tiêu 60 FPS. Các lượt chạy đồng thời với build/test hoặc tab nền bị loại khỏi so sánh.

## Thay đổi

- Culling riêng từng instance tĩnh theo bounding box; giữ nguyên geometry, material, màu và toàn bộ bounds để vật thể trở lại đúng khi quay camera. Chỉ dùng ở preset không đổ bóng để không mất bóng ngoài màn hình. Đèn giao thông động không tham gia việc đóng gói lại instance.
- Sản phẩm trên kệ sử dụng frustum culling; bounds được cập nhật khi bố trí/số lượng thay đổi.
- Chỉ tạo các pass hậu kỳ đang bật; giải phóng pass và render target cũ khi đổi chất lượng. Viền tương tác và khử răng cưa giữ nguyên.
- Giải phóng instance buffer, geometry/material và texture sinh riêng (nền, atlas biển tên đường, chi tiết hẻm, kho sỉ), cùng shadow light của thế giới cũ; bảo vệ tài nguyên asset/PBR/biển hiệu cache dùng chung. Kiểm tra thực tế đã phát hiện texture tăng khoảng 33–35 mỗi lần dựng phố trước khi bổ sung xử lý texture.
- NPC rig giải phóng skeleton/bone texture và binding của mixer khi rời cảnh; đồ nghề gánh hàng rong cũng giải phóng tài nguyên sinh riêng. Geometry/material nhân vật dùng chung vẫn giữ lại.
- Giới hạn render 60 FPS trong ván và 30 FPS ở menu; tạm dừng vòng lặp khi tab ẩn, tiếp tục không chạy bù thời gian ẩn. Logic vẫn 60Hz.

Regression kiểm tra camera quay đi/quay lại, màu đèn động, vòng đời tài nguyên, hậu kỳ và nhịp khung hình ở màn hình 144Hz.

Kiểm tra cuối: TypeScript, build production và 283 bài test / 51 file đều qua.

Sau bản sửa texture và skeleton, ba lần dựng lại phố Siêu nhẹ cuối giữ nguyên **257 geometry / 190 texture** (trước sửa texture vẫn tăng mỗi lần). Chuyển từ Cao/Vừa/Thấp trở về Siêu nhẹ không giữ render target của các hiệu ứng đã tắt. Các cache nhân vật/asset có thể tăng ở lần đầu gặp model hoặc biến thể mới; không coi cache hữu hạn này là texture sinh riêng bị rò rỉ.
