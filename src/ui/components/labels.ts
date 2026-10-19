import type { Beat } from "../../schema";

export const BEAT_LABEL: Record<Beat, string> = {
  question: "Câu hỏi",
  number: "Con số",
  escalate: "Leo thang",
  climax: "Cao trào",
  aftermath: "Hậu quả",
  twist: "Có thật không?",
  cta: "Kêu gọi",
  context: "Bối cảnh",
};

export const BEAT_COLOR: Record<Beat, string> = {
  question: "#ff9a3c",
  number: "#f2c14e",
  escalate: "#ff6b4a",
  climax: "#ef5a5a",
  aftermath: "#7fc8a9",
  twist: "#b48cff",
  cta: "#6aa7ff",
  context: "#a7a0ad",
};

export const SHOT_LABEL = { wide: "Toàn", medium: "Trung", close: "Cận" } as const;
export const MOVE_LABEL = { static: "Đứng yên", push_in: "Đẩy vào", pull_out: "Kéo ra", pan_left: "Lia trái", pan_right: "Lia phải", tilt_up: "Ngước lên", shake: "Rung" } as const;
export const WEATHER_LABEL = { clear: "Quang", sparkles: "Lấp lánh", rain: "Mưa", snow: "Tuyết", dust: "Bụi", embers: "Tàn lửa", coins: "Mưa vàng", confetti: "Pháo giấy", leaves: "Lá bay" } as const;
export const LIGHT_LABEL = { auto: "Theo bối cảnh", day: "Ban ngày", dusk: "Hoàng hôn", night: "Ban đêm", spotlight: "Đèn rọi", dramatic: "Kịch tính" } as const;
export const OVERLAY_LABEL = { banner: "Bảng treo", title: "Chữ lớn", stamp: "Dấu mộc", label: "Nhãn", counter: "Bộ đếm", chart: "Biểu đồ cột", timeline: "Dòng thời gian", route: "Đường đi (bản đồ)", versus: "Đối đầu" } as const;

export const OVERLAY_HINT: Partial<Record<string, string>> = {
  chart: "Rome:1229; Byzantium:1123",
  timeline: "753 BC|476 AD|1453 AD",
  route: "Roma > Ravenna",
  versus: "Rome VS Carthage",
};

export const VERB_LABEL = {
  move: "Đi tới mark",
  approach: "Đi lại gần",
  enter: "Đi vào khung",
  exit: "Đi ra khỏi khung",
  turn: "Quay người",
  look: "Nhìn về phía",
  jump: "Nhảy",
  hop: "Nhún nhảy",
  shake: "Run / lắc",
  fall: "Ngã xuống",
  rise: "Đứng dậy",
  spin: "Xoay vòng",
  pose: "Đổi tư thế",
  emote: "Đổi nét mặt",
  point_at: "Chỉ tay vào",
  grow: "Phóng to",
  shrink: "Thu nhỏ",
  fade_in: "Hiện dần",
  fade_out: "Mờ dần",
  drop: "Rơi xuống (nảy)",
  sink: "Chìm xuống",
} as const;
export const TRANSITION_LABEL = { cut: "Cắt", fade: "Mờ dần", whip: "Lia nhanh" } as const;
