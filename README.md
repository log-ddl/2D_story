# fxcine — Anim Studio

Kịch bản + giọng đọc → tự khớp giọng và chia cảnh → lắp cảnh từ module SVG + hàm toán học → xem trước realtime → xuất MP4 dọc 9:16.

## Chạy

```bash
pnpm install
pnpm tauri dev        # app desktop (đầy đủ: giọng máy, whisper, xuất MP4)
pnpm dev              # chỉ giao diện trong trình duyệt (http://localhost:1420)
```

Cần: Node 20+, Rust, `ffmpeg` (`brew install ffmpeg`). Tùy chọn: `whisper-cli` + file model `.bin` (`brew install whisper-cpp`), Anthropic API key (nhập trong Cài đặt).

Dữ liệu dự án lưu ở `~/Documents/fxcine/projects/<id>/` (JSON + media).

## Kiểm thử

```bash
pnpm test                                   # unit test pipeline/engine/LLM (mock)
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
| `src/backend/` | Lớp lưu trữ Tauri/Web, gọi Claude (SDK chính thức, structured output) |
| `src/ui/` | Giao diện React: Kịch bản, Phân cảnh, Đạo diễn, Dựng & Xuất, Thư viện, Cài đặt, bảng lệnh ⌘K |
| `src-tauri/` | Rust: file dự án, ffmpeg/say/whisper-cli, nhận frame RGBA và mã hóa MP4 (voice + SFX + nhạc nền tự giảm) |
