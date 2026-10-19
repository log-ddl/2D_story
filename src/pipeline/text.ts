// Xử lý văn bản: tách từ, đếm âm tiết, đổi số thành chữ (để khớp với giọng đọc).

export interface Token {
  /** Chữ hiển thị (giữ dấu câu dính kèm) */
  text: string;
  /** Dạng chuẩn hóa để so khớp: chữ thường, bỏ dấu câu, số → chữ */
  norm: string;
  /** Dấu câu sau từ: "." "," "?" "!" ":" ";" "—" hoặc "" */
  punct: string;
  syllables: number;
}

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function under1000(n: number): string[] {
  const out: string[] = [];
  if (n >= 100) {
    out.push(ONES[Math.floor(n / 100)], "hundred");
    n %= 100;
  }
  if (n >= 20) {
    out.push(TENS[Math.floor(n / 10)]);
    if (n % 10) out.push(ONES[n % 10]);
  } else if (n > 0 || out.length === 0) out.push(ONES[n]);
  return out;
}

/** 476 → "four seventy six" (kiểu đọc năm), 6000 → "six thousand" */
export function numberToWords(raw: string): string[] {
  const clean = raw.replace(/,/g, "");
  const ord = /(st|nd|rd|th)$/i.test(clean);
  const n = parseInt(clean, 10);
  if (!Number.isFinite(n)) return [raw.toLowerCase()];
  let words: string[];
  if (n >= 1000000) words = [...under1000(Math.floor(n / 1000000)), "million", ...(n % 1000000 ? numberToWords(String(n % 1000000)) : [])];
  else if (n >= 10000 || (n >= 1000 && n % 1000 === 0)) words = [...under1000(Math.floor(n / 1000)), "thousand", ...(n % 1000 ? under1000(n % 1000) : [])];
  else if (n >= 1100 && n < 10000 && n % 100 !== 0) words = [...under1000(Math.floor(n / 100)), ...under1000(n % 100)];
  else if (n >= 100 && n < 1000 && !/,/.test(raw) && n % 100 !== 0) words = [...under1000(Math.floor(n / 100)), ...under1000(n % 100)];
  else if (n >= 1000) words = [...under1000(Math.floor(n / 1000)), "thousand", ...(n % 1000 ? under1000(n % 1000) : [])];
  else words = under1000(n);
  if (ord) words[words.length - 1] = toOrdinal(words[words.length - 1]);
  return words;
}

const ORDINAL: Record<string, string> = { one: "first", two: "second", three: "third", five: "fifth", eight: "eighth", nine: "ninth", twelve: "twelfth" };
function toOrdinal(w: string): string {
  if (ORDINAL[w]) return ORDINAL[w];
  if (w.endsWith("y")) return w.slice(0, -1) + "ieth";
  return w + "th";
}

export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-zà-ỹ]/g, "");
  if (!w) return 1;
  if (/[à-ỹ]/.test(w)) return 1; // tiếng Việt: mỗi từ là 1 âm tiết
  if (w.length <= 3) return 1;
  const m = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, m?.length ?? 1);
}

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const parts = text.replace(/\s+/g, " ").trim().split(" ");
  for (const p of parts) {
    if (!p) continue;
    const m = /^(["'“‘(]*)(.*?)([.,!?;:…"'”’)—-]*)$/.exec(p)!;
    const core = m[2] || p;
    const punct = (m[3] ?? "").replace(/["'”’)]/g, "").slice(-1);
    if (/^\d[\d,]*(st|nd|rd|th)?$/i.test(core)) {
      const words = numberToWords(core);
      const syl = words.reduce((s, w) => s + countSyllables(w), 0);
      out.push({ text: p, norm: words.join(" "), punct, syllables: syl });
    } else {
      const norm = core.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
      if (!norm) {
        if (out.length && punct) out[out.length - 1].punct = punct;
        continue;
      }
      out.push({ text: p, norm, punct, syllables: countSyllables(norm) });
    }
  }
  return out;
}

/** Tách câu, giữ dấu câu */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+(?=[A-ZÀ-Ỹ"“0-9])/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Thời gian ngắt nghỉ sau dấu câu (giây) — dùng cho ước lượng khi chưa có audio */
export function pauseAfter(punct: string): number {
  switch (punct) {
    case ".":
    case "!":
    case "?":
    case "…":
      return 0.38;
    case ",":
    case ";":
    case ":":
    case "—":
    case "-":
      return 0.18;
    default:
      return 0.02;
  }
}
