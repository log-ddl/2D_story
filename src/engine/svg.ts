// Bộ đọc SVG tối giản → cây hình học vẽ được trên Canvas2D.
// Chạy được cả trong WebView lẫn Node (không dùng DOMParser).

export interface SvgNode {
  tag: string;
  attrs: Record<string, string>;
  children: SvgNode[];
  /** Path data đã chuẩn hóa (cho path/rect/circle/ellipse/polygon/line) */
  d?: string;
}

export interface SvgModule {
  id: string;
  viewBox: [number, number, number, number];
  /** Gốc tọa độ khi đặt module (thường là đáy giữa) */
  anchor: [number, number];
  root: SvgNode;
  /** id các nhóm con, để rig/biến thể dùng */
  groups: Record<string, SvgNode>;
}

const SHAPES = new Set(["path", "rect", "circle", "ellipse", "polygon", "polyline", "line"]);
const ALLOWED = new Set(["svg", "g", ...SHAPES]);

export class SvgParseError extends Error {}

function parseAttrs(src: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) attrs[m[1]] = m[3] ?? m[4] ?? "";
  // style="fill:..;stroke:.." → thuộc tính
  if (attrs.style) {
    for (const decl of attrs.style.split(";")) {
      const [k, v] = decl.split(":").map((s) => s?.trim());
      if (k && v && !(k in attrs)) attrs[k] = v;
    }
  }
  return attrs;
}

export function parseSvg(src: string): SvgNode {
  const clean = src.replace(/<\?xml[^>]*>/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<!DOCTYPE[^>]*>/gi, "");
  const tagRe = /<\/?([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g;
  const stack: SvgNode[] = [];
  let root: SvgNode | null = null;
  let m: RegExpExecArray | null;
  let skipDepth = 0;
  while ((m = tagRe.exec(clean))) {
    const [full, tag, rest, selfClose] = m;
    const closing = full.startsWith("</");
    if (closing) {
      if (skipDepth > 0) {
        skipDepth--;
        continue;
      }
      stack.pop();
      continue;
    }
    if (skipDepth > 0 || !ALLOWED.has(tag)) {
      // Bỏ qua thẻ không hỗ trợ (defs, text, filter…) cùng toàn bộ con của nó
      if (!selfClose) skipDepth++;
      continue;
    }
    const node: SvgNode = { tag, attrs: parseAttrs(rest), children: [] };
    if (SHAPES.has(tag)) node.d = shapeToPath(tag, node.attrs);
    if (!root) root = node;
    else stack[stack.length - 1]?.children.push(node);
    if (!selfClose) stack.push(node);
  }
  if (!root || root.tag !== "svg") throw new SvgParseError("Thiếu thẻ <svg> gốc");
  return root;
}

const num = (v: string | undefined, d = 0) => (v === undefined || v === "" ? d : parseFloat(v));

function shapeToPath(tag: string, a: Record<string, string>): string {
  switch (tag) {
    case "path":
      return a.d ?? "";
    case "rect": {
      const x = num(a.x), y = num(a.y), w = num(a.width), h = num(a.height);
      const rx = Math.min(num(a.rx, num(a.ry)), w / 2), ry = Math.min(num(a.ry, rx), h / 2);
      if (!rx) return `M${x} ${y}h${w}v${h}h${-w}Z`;
      return `M${x + rx} ${y}h${w - 2 * rx}a${rx} ${ry} 0 0 1 ${rx} ${ry}v${h - 2 * ry}a${rx} ${ry} 0 0 1 ${-rx} ${ry}h${-(w - 2 * rx)}a${rx} ${ry} 0 0 1 ${-rx} ${-ry}v${-(h - 2 * ry)}a${rx} ${ry} 0 0 1 ${rx} ${-ry}Z`;
    }
    case "circle":
    case "ellipse": {
      const cx = num(a.cx), cy = num(a.cy);
      const rx = tag === "circle" ? num(a.r) : num(a.rx), ry = tag === "circle" ? num(a.r) : num(a.ry);
      return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
    }
    case "polygon":
    case "polyline": {
      const pts = (a.points ?? "").trim().split(/[\s,]+/).map(Number);
      let d = "";
      for (let i = 0; i + 1 < pts.length; i += 2) d += `${i ? "L" : "M"}${pts[i]} ${pts[i + 1]}`;
      return tag === "polygon" ? d + "Z" : d;
    }
    case "line":
      return `M${num(a.x1)} ${num(a.y1)}L${num(a.x2)} ${num(a.y2)}`;
  }
  return "";
}

export function compileModule(id: string, src: string, anchor?: [number, number]): SvgModule {
  const root = parseSvg(src);
  const vb = (root.attrs.viewBox ?? `0 0 ${num(root.attrs.width, 100)} ${num(root.attrs.height, 100)}`)
    .split(/[\s,]+/)
    .map(Number) as [number, number, number, number];
  let anc = anchor;
  if (!anc && root.attrs["data-anchor"]) anc = root.attrs["data-anchor"].split(/[\s,]+/).map(Number) as [number, number];
  if (!anc) anc = [vb[0] + vb[2] / 2, vb[1] + vb[3]];
  const groups: Record<string, SvgNode> = {};
  const walk = (n: SvgNode) => {
    if (n.attrs.id) groups[n.attrs.id] = n;
    n.children.forEach(walk);
  };
  walk(root);
  return { id, viewBox: vb, anchor: anc, root, groups };
}

// ───────── Vẽ ─────────

export type Palette = Record<string, string>;
type Path2DCtor = new (d?: string) => Path2D;

const pathCache = new WeakMap<SvgNode, Path2D>();

let P2D: Path2DCtor | null = typeof Path2D !== "undefined" ? Path2D : null;
/** Cho phép Node (@napi-rs/canvas) cung cấp Path2D */
export function setPath2D(ctor: Path2DCtor) {
  P2D = ctor;
}

function getPath(n: SvgNode): Path2D {
  let p = pathCache.get(n);
  if (!p) {
    if (!P2D) throw new Error("Path2D không khả dụng");
    p = new P2D(n.d ?? "");
    pathCache.set(n, p);
  }
  return p;
}

function resolveColor(v: string | undefined, palette: Palette): string | undefined {
  if (!v) return v;
  const m = /^var\(--([\w-]+)\s*(?:,\s*([^)]+))?\)$/.exec(v.trim());
  if (m) return palette[m[1]] ?? m[2]?.trim() ?? "#ff00ff";
  return v;
}

function applyTransform(ctx: CanvasRenderingContext2D, tr: string) {
  const re = /(\w+)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tr))) {
    const v = m[2].trim().split(/[\s,]+/).map(Number);
    switch (m[1]) {
      case "translate":
        ctx.translate(v[0] ?? 0, v[1] ?? 0);
        break;
      case "scale":
        ctx.scale(v[0] ?? 1, v[1] ?? v[0] ?? 1);
        break;
      case "rotate":
        if (v.length >= 3) {
          ctx.translate(v[1], v[2]);
          ctx.rotate(((v[0] ?? 0) * Math.PI) / 180);
          ctx.translate(-v[1], -v[2]);
        } else ctx.rotate(((v[0] ?? 0) * Math.PI) / 180);
        break;
      case "matrix":
        ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
        break;
    }
  }
}

interface Inherited {
  fill: string | undefined;
  stroke: string | undefined;
  strokeWidth: number;
  opacity: number;
  fillOpacity: number;
  strokeOpacity: number;
}

export interface DrawOptions {
  palette?: Palette;
  /** Ẩn các nhóm có id trong danh sách (dùng cho biến thể) */
  hide?: Set<string>;
  /** Chỉ vẽ nhóm này */
  only?: string;
  /** Biến đổi thêm cho nhóm theo id (khung xương): nhận điểm xoay data-pivot */
  xform?: Record<string, (ctx: CanvasRenderingContext2D, pivot: [number, number]) => void>;
}

export function drawNode(ctx: CanvasRenderingContext2D, n: SvgNode, inh: Inherited, opts: DrawOptions) {
  const a = n.attrs;
  if (a.id && opts.hide?.has(a.id)) return;
  if (a.display === "none" || a.visibility === "hidden") return;
  const pal = opts.palette ?? {};
  const st: Inherited = {
    fill: a.fill !== undefined ? resolveColor(a.fill, pal) : inh.fill,
    stroke: a.stroke !== undefined ? resolveColor(a.stroke, pal) : inh.stroke,
    strokeWidth: a["stroke-width"] !== undefined ? num(a["stroke-width"], 1) : inh.strokeWidth,
    opacity: inh.opacity * num(a.opacity, 1),
    fillOpacity: a["fill-opacity"] !== undefined ? num(a["fill-opacity"], 1) : inh.fillOpacity,
    strokeOpacity: a["stroke-opacity"] !== undefined ? num(a["stroke-opacity"], 1) : inh.strokeOpacity,
  };
  const xf = a.id ? opts.xform?.[a.id] : undefined;
  const hasTr = !!a.transform || !!xf;
  if (hasTr) {
    ctx.save();
    if (a.transform) applyTransform(ctx, a.transform);
    if (xf) xf(ctx, (a["data-pivot"] ?? "0 0").split(/[\s,]+/).map(Number) as [number, number]);
  }
  if (n.d !== undefined) {
    const p = getPath(n);
    if (st.fill && st.fill !== "none") {
      ctx.globalAlpha = st.opacity * st.fillOpacity;
      ctx.fillStyle = st.fill;
      ctx.fill(p, (a["fill-rule"] as CanvasFillRule) ?? "nonzero");
    }
    if (st.stroke && st.stroke !== "none" && st.strokeWidth > 0) {
      ctx.globalAlpha = st.opacity * st.strokeOpacity;
      ctx.strokeStyle = st.stroke;
      ctx.lineWidth = st.strokeWidth;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke(p);
    }
    ctx.globalAlpha = 1;
  }
  for (const c of n.children) drawNode(ctx, c, st, opts);
  if (hasTr) ctx.restore();
}

export const DEFAULT_INHERITED: Inherited = {
  fill: "#000",
  stroke: undefined,
  strokeWidth: 1,
  opacity: 1,
  fillOpacity: 1,
  strokeOpacity: 1,
};

/** Vẽ module sao cho điểm anchor nằm ở (0,0) của hệ tọa độ hiện tại */
export function drawModule(ctx: CanvasRenderingContext2D, m: SvgModule, opts: DrawOptions = {}) {
  ctx.save();
  ctx.translate(-m.anchor[0], -m.anchor[1]);
  const target = opts.only ? m.groups[opts.only] : m.root;
  if (target) drawNode(ctx, target, DEFAULT_INHERITED, opts);
  ctx.restore();
}

// ───────── Linter cho module (dùng khi AI sinh SVG) ─────────

export interface LintIssue {
  level: "error" | "warn";
  message: string;
}

export const STYLE_RULES = {
  outline: "#2b2233",
  minStroke: 3,
  maxStroke: 10,
  maxNodes: 400,
};

export function lintModule(src: string): LintIssue[] {
  const issues: LintIssue[] = [];
  let root: SvgNode;
  try {
    root = parseSvg(src);
  } catch (e) {
    return [{ level: "error", message: (e as Error).message }];
  }
  if (!root.attrs.viewBox) issues.push({ level: "error", message: "Thiếu viewBox" });
  if (/<(image|foreignObject|script)\b/i.test(src)) issues.push({ level: "error", message: "Không được dùng <image>, <foreignObject> hay <script> (chỉ vector thuần)" });
  if (/<text\b/i.test(src)) issues.push({ level: "warn", message: "Có <text>: chữ nên do engine render, sẽ bị bỏ qua" });
  if (/(linear|radial)Gradient/.test(src)) issues.push({ level: "warn", message: "Gradient bị bỏ qua — style chibi dùng màu phẳng" });
  let count = 0;
  let outlined = 0;
  let shapes = 0;
  const walk = (n: SvgNode, stroke?: string) => {
    count++;
    const s = n.attrs.stroke ?? stroke;
    if (n.d !== undefined) {
      shapes++;
      if (!n.d.trim()) issues.push({ level: "error", message: `<${n.tag}> rỗng` });
      if (s && s.toLowerCase() === STYLE_RULES.outline) outlined++;
      const sw = n.attrs["stroke-width"];
      if (sw && (num(sw) < STYLE_RULES.minStroke - 1 || num(sw) > STYLE_RULES.maxStroke)) issues.push({ level: "warn", message: `stroke-width ${sw} ngoài chuẩn ${STYLE_RULES.minStroke}–${STYLE_RULES.maxStroke}` });
    }
    n.children.forEach((c) => walk(c, s));
  };
  walk(root);
  if (count > STYLE_RULES.maxNodes) issues.push({ level: "warn", message: `Quá nhiều phần tử (${count})` });
  if (shapes === 0) issues.push({ level: "error", message: "Không có hình nào" });
  else if (outlined / shapes < 0.5) issues.push({ level: "warn", message: `Ít viền ${STYLE_RULES.outline} (${outlined}/${shapes}) — lệch style` });
  return issues;
}
