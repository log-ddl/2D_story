# fxcine — Kế hoạch thực hiện

> Kịch bản + voice → tự chia cảnh khớp giọng → lắp ghép cảnh từ **module SVG + hàm toán học** → preview realtime 60fps → xuất video 9:16.
> App desktop **Tauri**. 100% vector, không dùng ảnh raster do AI sinh.

## 1. Nguyên tắc cốt lõi

1. **Mọi thứ là vector + tham số.** Bối cảnh, nhân vật, bản đồ, đạo cụ là module SVG. Chuyển động, thời tiết và camera là hàm toán học theo thời gian `t`.
2. **Một engine duy nhất cho cả preview lẫn xuất.** Code vẽ khung hình lúc xem trước cũng là code vẽ khung hình khi export, nên kết quả giống hệt nhau.
3. **Tất định (deterministic).** Mỗi frame = `render(scene, t)`. Ngẫu nhiên chỉ đi qua PRNG có seed, cấm `Math.random`. Cùng seed thì ra cùng hình.
4. **Voice là trục thời gian.** Cắt cảnh, chữ hiện và nhép miệng đều căn theo timestamp của từng từ.
5. **Cảnh = JSON có cấu trúc.** Engine không phụ thuộc UI, test được độc lập.

## 2. Kiến trúc

```
┌──────────────────── Tauri app ─────────────────────────┐
│ WebView (React + TS)                                   │
│  ├─ UI: Kịch bản │ Phân cảnh │ Đạo diễn │ Xuất          │
│  └─ ENGINE (TS thuần): scene graph → Canvas2D 60fps    │
│        rig · procedural · camera · text · particles    │
├──────────────────────── IPC ───────────────────────────┤
│ Rust core                                              │
│  ├─ Project I/O (thư mục dự án: JSON + SVG)            │
│  ├─ Audio: decode (symphonia), waveform, alignment     │
│  ├─ LLM client (Claude), TTS client, khóa trong keychain│
│  └─ Export: nhận frame → ffmpeg sidecar → MP4          │
└────────────────────────────────────────────────────────┘
```

| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| Vỏ app | **Tauri 2** | Nhẹ, chạy trên macOS và Windows |
| UI | React + TypeScript + Tailwind | Giao diện tối như ảnh mẫu |
| Engine vẽ | **Canvas2D + `Path2D`** (cache path, không parse SVG mỗi frame) | Nếu không đủ 60fps thì chuyển sang PixiJS/WebGL, giữ nguyên scene graph |
| Hàm toán học | easing, spring, sin/noise (simplex), PRNG `mulberry32` | Thư viện `engine/math` tự viết, kèm test |
| Bản đồ | GeoJSON → `d3-geo` (phép chiếu) → đơn giản hóa → path đã style | Đường viền đúng địa lý, nét vẽ chibi |
| Chữ | Font nhúng, vẽ bằng Canvas, hoặc `opentype.js` → path | Bảng chữ, nhãn, phụ đề |
| Alignment | `whisper-rs` (whisper.cpp, chạy local, timestamp từng từ) + adapter API đám mây | Không cần cài Python |
| TTS | Adapter (ElevenLabs có trả sẵn timestamp, …) | Tùy chọn. Có thể upload voice thay thế |
| LLM | Claude: `claude-sonnet-5-5` chia cảnh + điền tham số, `claude-opus-5-5` sinh module SVG + QA hình | Structured output JSON |
| Xuất video | **WebCodecs** `VideoEncoder` trong WebView. Dự phòng: gửi frame thô qua IPC → ffmpeg sidecar | **Cần spike kiểm chứng ở P0** (WKWebView trên macOS) |
| Lưu trữ | Mỗi dự án là một thư mục `*.fxcine/` (JSON + SVG + audio) | Dễ backup, dễ dùng git |

### Cấu trúc repo
```
fxcine/
├─ src-tauri/          Rust core
├─ app/                React UI
├─ packages/
│  ├─ engine/          scene graph, renderer, rig, procedural (TS thuần, không phụ thuộc DOM ngoài canvas)
│  └─ schema/          kiểu dữ liệu + validator (zod) cho Scene/Asset/Rig
└─ library/            module SVG + manifest (style chibi)
```

## 3. Hệ thống module SVG

### Định dạng một module
- SVG có quy ước: `viewBox` chuẩn, mỗi bộ phận là một `<g id="…">`.
  - `data-pivot="x,y"`: điểm xoay của khớp.
  - `data-anchor="mark_A"`: điểm đứng hoặc điểm gắn.
  - Màu dùng **slot** (`var(--skin)`, `--hair`, `--cloth`) để đổi phối màu mà không cần vẽ lại.
- `manifest.json`: loại module, danh sách bộ phận, biến thể, tham số, tag.
- **Linter** kiểm tra: parse được, đủ id bắt buộc, độ dày nét đúng chuẩn style, màu chỉ dùng slot/palette.

### Nhân vật = Rig
```
Rig {
  bones: cây khớp (hông → thân → cổ → đầu; vai → tay trên → tay dưới → bàn tay)
  slots: phần SVG gắn vào bone (thân, áo, mũ, râu, vương miện…)
  face:  { eyes, brows, mouth } — tham số liên tục, không chỉ thay ảnh
  poses: bộ góc khớp có tên (đứng, chỉ tay, giơ hai tay, ngồi ngai…)
  expressions: bộ tham số mặt có tên (lo, vui, giận, ngạc nhiên…)
}
```
- **Tư thế**: nội suy góc khớp giữa các pose, nên đổi tư thế mượt chứ không giật.
- **Nét mặt**: lông mày, mắt, miệng là đường cong bezier có tham số (độ cong, độ mở, độ nghiêng). Nét mặt chỉ là một bộ giá trị.
- **Nhép miệng**: `mouth.open = f(âm lượng voice tại t)` (bản 1), sau đó dùng viseme từ âm vị (bản 2).
- **Chớp mắt / thở / nhún**: hàm theo `t` + seed.
- **Bộ sinh nhân vật phụ**: một rig gốc + tổ hợp slot (mũ, râu, khiên, màu da) theo seed để ra cả đội lính khác nhau.

### Bối cảnh, thời tiết, camera
- Bối cảnh gồm các lớp có độ sâu (`depth`) để làm parallax, có mark đứng A/B/C và vùng đặt chữ.
- Thời tiết là hệ hạt có seed: mưa, tuyết, lấp lánh, bụi, lá rơi. Ánh sáng là lớp phủ màu/gradient.
- Camera có `shot` (toàn/trung/cận) và `move` (đẩy vào, kéo ra, lia, rung). Đường đi tính bằng easing theo `duration`. `focus` tự động nhắm vào nhân vật đang nói.

### Vai trò của AI
| AI làm | Cách kiểm soát |
|---|---|
| Chia cảnh và điền tham số cảnh từ thư viện đang có | JSON schema + validator |
| **Sinh module SVG mới** (đạo cụ, phụ kiện, bối cảnh đơn giản) | Prompt kèm quy ước style và ví dụ, linter tự sửa lỗi, người duyệt (`draft → approved`) |
| Sinh biến thể từ template (nhân vật phụ, đổi trang phục) | AI chọn tham số và tổ hợp slot, không vẽ lại từ đầu |
| QA hình | Render frame → Claude so với mô tả cảnh |

> **Lưu ý thực tế:** LLM vẽ SVG nhân vật chibi phức tạp từ đầu thường chưa đẹp. Bộ **template gốc** (rig nhân vật, vài bối cảnh mẫu) nên do người thiết kế, hoặc AI vẽ rồi người tinh chỉnh. Sau đó AI chủ yếu **tổ hợp và biến đổi tham số**, và chỉ vẽ mới các module đơn giản.

## 4. Mô hình dữ liệu

```
Project/  (thư mục *.fxcine)
├─ project.json   { name, style_pack, palette, fps: 30|60, aspect: "9:16" }
├─ library/       module SVG riêng của dự án (bổ sung cho thư viện chung)
└─ episodes/<id>/
   ├─ audio.wav
   ├─ alignment.json  { words: [{text, start, end, conf}] }
   └─ episode.json    { title, script_text, scenes: [Scene] }

Scene {
  id: "s001", beat: question|number|escalate|climax|aftermath|twist|cta,
  word_start, word_end, start, end, duration,
  narration, narration_vi, description,
  background: { module, variant, weather, lighting },
  camera: { shot, move, focus, ease },
  characters: [{ rig, skin/slots, mark, pose, expression, speaking }],
  props: [{ module, x, y, scale, rot }],
  overlays: [{ text, style, at_word, anim }],
  seed, status, qa_issues[]
}
```

## 5. Quy trình theo các bước trên sidebar

| Bước | Việc |
|---|---|
| **01 Kịch bản** | Nhập kịch bản (hoặc nhờ LLM viết) và voice (upload hoặc TTS). Alignment ra timestamp từng từ. So kịch bản với lời thực đọc rồi cảnh báo chỗ lệch. Chuẩn hóa số thành chữ trước khi align ("476" → "four seventy-six"). |
| **02 Phân cảnh** | LLM chia cảnh theo nghĩa và gắn nhịp (khoảng từ). Tính thời gian: cắt ở giữa khoảng lặng, làm tròn theo frame trên timestamp tuyệt đối, gộp cảnh <1.2s, tách cảnh >4s. LLM chọn module/rig/pose từ thư viện; thiếu module thì tạo yêu cầu sinh SVG. |
| **03 Đạo diễn** | Inspector chỉnh tham số, thấy kết quả ngay ở 60fps. Timeline có sóng âm, kéo ranh giới cảnh thì hít vào khoảng lặng gần nhất. Kéo nhân vật trên canvas để đổi mark. |
| **04 Dựng** | Engine render từng frame theo bước thời gian cố định (không phụ thuộc tốc độ máy). |
| **05 Hậu kỳ & Xuất** | Phụ đề là lớp riêng, nhạc nền tự giảm khi có giọng (ducking), SFX theo nhịp. Xuất MP4 9:16 + SRT ở 1080×1920 hoặc 4K (vector nên không vỡ nét). |

## 6. Lộ trình

| Giai đoạn | Nội dung | Kết quả kiểm chứng |
|---|---|---|
| **P0 Nền móng + spike rủi ro** (1–1.5 tuần) | Khung Tauri + React. Engine tối thiểu: 1 bối cảnh + 1 nhân vật có rig, camera đẩy vào. **Xuất thử 5s MP4** qua WebCodecs (dự phòng ffmpeg sidecar). Đo fps. | 60fps ở 1080×1920 trên máy thật; file MP4 khớp với preview |
| **P1 Kịch bản + voice → cảnh có thời gian** (1.5–2 tuần) | Decode audio + waveform, whisper-rs alignment, LLM chia cảnh, tính duration, timeline | Tập Rome ra ~20 cảnh có `start/end/duration` thật, tổng khớp độ dài voice |
| **P2 Hệ module SVG + rig** (2–3 tuần) | Định dạng module + linter, rig (bone/pose/expression nội suy), bộ sinh nhân vật phụ, thư viện khởi đầu cho tập Rome (điện ngai, trại lính, bản đồ Ý, Romulus, Orestes, Odoacer, lính) | Lắp đủ 20 cảnh của tập Rome từ thư viện |
| **P3 Procedural + giao diện Phân cảnh** (2 tuần) | Camera/parallax, thời tiết/hạt, nhép miệng theo âm lượng, chớp mắt/thở, overlay chữ theo `at_word`, phụ đề; màn Phân cảnh + inspector + timeline | Preview toàn tập ở 60fps, khớp voice |
| **P4 Xuất video** (1 tuần) | Render toàn tập, mix audio (voice + nhạc + SFX), MP4 + SRT, thanh tiến độ | MP4 9:16 hoàn chỉnh |
| **P5 AI sinh SVG + QA** (2 tuần) | Claude sinh module SVG theo quy ước + vòng lặp linter + màn duyệt; QA tự động (cảnh quá ngắn/dài, thiếu module, chữ tràn, voice lệch); Claude soi frame; bảng lệnh | Bộ lọc "Có cảnh báo" hoạt động; tạo được đạo cụ mới bằng 1 câu lệnh |
| **Sau MVP** | Nhép miệng theo viseme, đa ngôn ngữ (cùng hình, đổi voice + phụ đề), thêm style ngoài chibi, mảng 3D phim & game | — |

## 7. Rủi ro & cách xử lý

| Rủi ro | Xử lý |
|---|---|
| Xuất video trong WebView (WebCodecs trên WKWebView) | Spike ngay ở P0; dự phòng gửi frame qua IPC sang ffmpeg sidecar |
| Canvas2D không đủ 60fps khi cảnh đông | Cache `Path2D`, raster sẵn lớp nền tĩnh theo mức zoom, chỉ vẽ lại lớp động; cuối cùng mới chuyển WebGL |
| AI vẽ SVG xấu hoặc lệch style | Template gốc do người làm, AI chủ yếu tổ hợp tham số; linter + duyệt |
| Preview và export lệch nhau | Một engine, hàm thuần `render(scene, t)`, PRNG có seed, test snapshot frame |
| Alignment sai ở số và tên riêng | Kịch bản làm chuẩn, chuẩn hóa số, cảnh báo khi `conf` thấp |
| Khối lượng vẽ thư viện ban đầu | Bắt đầu chỉ với đủ asset cho 1 tập (Rome), mở rộng dần theo nhu cầu |

## 8. Cần chốt trước khi code

1. **Ai làm template gốc** (rig nhân vật chibi, bối cảnh mẫu): bạn/họa sĩ thiết kế, hay để AI vẽ rồi tinh chỉnh?
2. **Alignment**: chạy local (whisper.cpp, miễn phí, chậm hơn) hay API đám mây?
3. **Nền tảng ưu tiên**: macOS trước hay Windows trước? Việc này ảnh hưởng đến spike WebCodecs.

## 9. Trạng thái triển khai (2026-10-19)

Đã làm xong P0–P5 ở mức MVP chạy được:

| Hạng mục | Trạng thái | Kiểm chứng |
|---|---|---|
| Khung Tauri 2 + React + engine Canvas2D | Xong | App desktop chạy, đọc/ghi dự án qua IPC |
| Engine vector (rig, nét mặt, camera, parallax, thời tiết, ánh sáng, chữ, phụ đề, chuyển cảnh) | Xong | ~10ms/frame ở 1080×1920 (đủ 60fps khi preview) |
| Thư viện: 38 module SVG, 8 bối cảnh, 6 nhân vật Rome | Xong | `pnpm snap` |
| Khớp giọng: ước lượng / khoảng lặng (DP) / whisper.cpp / timestamp TTS | Xong | Lệch đầu câu trung vị ~0.005s với 4 giọng `say` |
| Chia cảnh: luật offline + Claude (structured output) | Xong | Unit test; Claude mới test bằng API giả lập (chưa gọi API thật) |
| UI: Kịch bản, Phân cảnh, Đạo diễn, Xuất, Thư viện, Cài đặt, ⌘K, hoàn tác | Xong | Thử trong trình duyệt |
| Xuất MP4 (voice + SFX + nhạc sidechain) + SRT | Xong | `cargo test` + self-test desktop: 57s video 720p xuất trong 29s |
| AI vẽ module SVG + linter + duyệt; Claude soi khung hình | Xong (chưa thử API thật) | Test giả lập |

Khác với kế hoạch ban đầu:
- Mã nguồn để chung trong `src/` (engine/pipeline/ui) thay vì tách `packages/`.
- Bản đồ là module SVG vẽ tay, chưa dùng GeoJSON + d3-geo.
- Xuất video dùng đường frame RGBA qua IPC → ffmpeg (đã kiểm chứng), chưa dùng WebCodecs.
- Gọi Claude bằng SDK TypeScript ngay trong WebView (key lưu cục bộ), mặc định `claude-opus-5-5`.

Việc tiếp theo nên làm: thử Claude với API key thật; nhép miệng theo viseme; tăng tốc xuất 1080p (gửi JPEG/WebCodecs thay frame thô); thêm bối cảnh/nhân vật ngoài La Mã; đóng gói `.app` có ký số.

### Cập nhật 2026-10-19 (vòng 2)
- Quy trình 5 bước: Kịch bản → Nhân vật & Bối cảnh → Phân cảnh → Tinh chỉnh → Xuất. Timeline chỉ còn ở bước Tinh chỉnh.
- Bộ não chuyển từ API sang CLI (`claude` / `codex` / `agy`). Đã chạy thật với `agy`: đề xuất dàn + chia cảnh ~1–1.5 phút/lượt. `codex` chưa thử vì máy chưa cài.
- Khung 9:16, 16:9, 1:1, 4:5: bối cảnh vẽ trong không gian dọc, khung ngang/vuông cắt quanh vùng quan tâm và giãn vị trí theo chiều ngang.
- Phong cách: tông màu (ấm/lạnh/pastel/đen trắng/cổ điển) + 3 kiểu phụ đề.
