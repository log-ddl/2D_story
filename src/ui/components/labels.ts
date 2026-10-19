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
export const OVERLAY_LABEL = { banner: "Bảng treo", title: "Chữ lớn", stamp: "Dấu mộc", label: "Nhãn", counter: "Bộ đếm" } as const;
export const TRANSITION_LABEL = { cut: "Cắt", fade: "Mờ dần", whip: "Lia nhanh" } as const;
