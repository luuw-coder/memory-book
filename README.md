# Memory Book — Sổ ghi nhớ cá nhân

Website ghi chú chạy trực tiếp trên trình duyệt, không cần API key, Firebase hay backend.

## Chạy thử
1. Tải hoặc clone repository.
2. Mở `index.html` bằng trình duyệt hiện đại.
3. Dữ liệu được lưu trong IndexedDB của trình duyệt.

Khuyến nghị chạy qua GitHub Pages hoặc máy chủ tĩnh để có môi trường ổn định.

## Triển khai GitHub Pages
1. Đưa `index.html`, `styles.css`, `app.js` và `README.md` lên thư mục gốc của repository.
2. Vào **Settings → Pages**.
3. Trong **Build and deployment**, chọn **Deploy from a branch**.
4. Chọn nhánh `main`, thư mục `/ (root)`, rồi nhấn **Save**.
5. Chờ GitHub tạo địa chỉ website.

## Lưu trữ và quyền riêng tư
- Nội dung ghi chú nằm trong IndexedDB của trình duyệt trên thiết bị hiện tại.
- Nội dung ghi chú không được gửi lên GitHub.
- Dùng **Cài đặt → Xuất toàn bộ JSON** để sao lưu định kỳ.
- Khi đổi máy/trình duyệt, hãy nhập file JSON đã sao lưu.
- Xóa dữ liệu website trong trình duyệt có thể làm mất ghi chú nếu chưa sao lưu.

## Ghi chú
Bản hiện tại hỗ trợ tạo/sửa/tự lưu, danh mục, Tags, ghim, yêu thích, tìm kiếm, lọc, thùng rác/khôi phục, giao diện sáng/tối và sao lưu JSON.
