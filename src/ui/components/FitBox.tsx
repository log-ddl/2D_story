import { useEffect, useRef, useState, type ReactNode } from "react";

/** Khung giữ đúng tỷ lệ, co vừa cả chiều rộng lẫn chiều cao của vùng chứa */
export function FitBox({ ratio, children }: { ratio: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<[number, number]>([0, 0]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const W = el.clientWidth;
      const H = el.clientHeight;
      const w = Math.min(W, H * ratio);
      setSize([Math.floor(w), Math.floor(w / ratio)]);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratio]);
  return (
    <div ref={ref} className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden">
      {size[0] > 0 && <div style={{ width: size[0], height: size[1] }}>{children}</div>}
    </div>
  );
}
