# fxcine — Anim Studio

Quy trình 5 bước: **Kịch bản** (+ giọng đọc, khung 9:16 / 16:9 / 1:1 / 4:5) → **Nhân vật & Bối cảnh** (bộ não đề xuất, lưu để dùng lại) → **Phân cảnh** (khớp giọng từng từ) → **Tinh chỉnh** (timeline) → **Xuất** MP4.

"Bộ não" là CLI AI đã cài và đăng nhập trên máy: `claude` (Claude Code), `codex` hoặc `agy` (Antigravity) — chọn trong Cài đặt. App gọi CLI ở chế độ không tương tác với JSON schema; không cần API key trong app.

## Khả năng hoạt hình

- **Hành động + keyframe:** mỗi cảnh có danh sách hành động gắn vào từ trong lời dẫn (đi tới, đi vào/ra khung, lại gần, nhìn, chỉ tay (IK), nhảy, nhún, run, ngã, đứng dậy, xoay, đổi tư thế/nét mặt, phóng to/thu nhỏ, hiện/mờ dần, đồ vật rơi nảy). Chuyển động phụ: áo choàng, đuôi; miệng đổi hình theo âm vị.
- **Nhân vật:** dựng bằng tham số (người chibi) hoặc **SVG có khung xương** (`body/head/arm_L/arm_R/leg_L/leg_R` + `data-pivot`), bộ não vẽ được nhân vật mới theo mô tả (con vật, robot…).
- **Bối cảnh:** 19 bối cảnh dựng từ module + bộ sinh có tham số (thành phố, rừng, núi, sa mạc, vũ trụ, lớp học, văn phòng, trường quay, phòng khách…).
- **Bộ giải thích:** biểu đồ cột, dòng thời gian, đường đi trên bản đồ, đối đầu VS, bộ đếm số.

## Chạy

```bash
pnpm install
pnpm tauri dev        # app desktop (đầy đủ: giọng máy, whisper, xuất MP4)
pnpm dev              # chỉ giao diện trong trình duyệt (http://localhost:1420)
```

Cần: Node 20+, Rust, `ffmpeg` (`brew install ffmpeg`). Tùy chọn: một CLI bộ não (`claude` / `codex` / `agy`), `whisper-cli` + file model `.bin` (`brew install whisper-cpp`).

Dữ liệu dự án lưu ở `~/Documents/fxcine/projects/<id>/` (JSON + media).

## Kiểm thử

```bash
pnpm test                                   # unit test pipeline/engine/bộ não (CLI giả lập)
npx tsx scripts/brain-live.ts agy           # gọi CLI bộ não thật cho tập mẫu → out/brain-live.json
npx tsx scripts/aspects.ts                  # một cảnh ở 4 tỷ lệ khung → out/aspects.png
npx tsx scripts/actions-snap.ts             # dải khung hình một cảnh có hành động → out/actions.png
npx tsx scripts/brain-character.ts agy "mô tả"   # bộ não vẽ nhân vật có khung xương → out/brain-char.png
cd src-tauri && cargo test                  # Rust, gồm xuất MP4 thật qua ffmpeg
pnpm snap                                   # ảnh kiểm tra nhân vật/tư thế/bối cảnh → out/
npx tsx scripts/align-check.ts Daniel       # đo độ chính xác khớp giọng (macOS say)
npx tsx scripts/render-episode.ts out/voice/demo.wav out/demo.mp4 1280   # render tập mẫu không cần app
FXCINE_SELFTEST=/tmp/t.mp4 src-tauri/target/debug/fxcine                 # tự kiểm tra đường desktop
```

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `src/engine/` | Engine vẽ thuần TS: `render(scene, t)`, camera/parallax, rig nhân vật chibi (tư thế, nét mặt, nhép miệng, chớp mắt), hạt thời tiết, ánh sáng, chữ/phụ đề, bộ đọc SVG + linter |
| `src/library/` | Module SVG gốc, bối cảnh (composition), dàn nhân vật, tập mẫu Rome |
| `src/pipeline/` | Tách từ/số, căn thời gian (ước lượng, khoảng lặng + quy hoạch động, whisper, TTS), chia cảnh (luật / Claude), QA, SFX tổng hợp, SRT |
| `src/brain/` | Bộ não: prompt + JSON schema cho đề xuất nhân vật/bối cảnh/phong cách, chia cảnh, vẽ SVG, dịch |
| `src/backend/` | Lớp lưu trữ Tauri/Web |
| `src/ui/` | Giao diện React: Kịch bản, Phân cảnh, Đạo diễn, Dựng & Xuất, Thư viện, Cài đặt, bảng lệnh ⌘K |
| `src-tauri/` | Rust: file dự án, gọi CLI bộ não (kèm môi trường shell đăng nhập), ffmpeg/say/whisper-cli, nhận frame RGBA và mã hóa MP4 (voice + SFX + nhạc nền tự giảm) |
