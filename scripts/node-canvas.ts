// Cho engine chạy trong Node (snapshot, test, render không cần app).
import { createCanvas, GlobalFonts, Path2D } from "@napi-rs/canvas";
import { setPath2D } from "../src/engine/svg";

setPath2D(Path2D as unknown as new (d?: string) => globalThis.Path2D);
for (const dir of ["/System/Library/Fonts", "/System/Library/Fonts/Supplemental", "/Library/Fonts"]) {
  try {
    GlobalFonts.loadFontsFromDir(dir);
  } catch {
    /* thư mục không tồn tại */
  }
}

export function nodeCanvas(w: number, h: number) {
  return createCanvas(w, h);
}
