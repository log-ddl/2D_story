// Đồng hồ phát lại tách khỏi React state để không re-render 60 lần/giây.
// Khi có voice, thời gian bám theo <audio> (chuẩn nhất); không có thì theo performance.now().

type Listener = () => void;

class Clock {
  time = 0;
  playing = false;
  duration = 0;
  loop: [number, number] | null = null;
  private audio: HTMLAudioElement | null = null;
  private t0 = 0;
  private base = 0;
  private listeners = new Set<Listener>();
  private raf = 0;

  setAudio(url: string | null) {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
    }
    this.audio = url ? new Audio(url) : null;
    if (this.audio) this.audio.preload = "auto";
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }

  now(): number {
    if (!this.playing) return this.time;
    if (this.audio && !this.audio.paused) return this.audio.currentTime;
    return this.base + (performance.now() - this.t0) / 1000;
  }

  private tick = () => {
    if (!this.playing) return;
    let t = this.now();
    const end = this.loop ? this.loop[1] : this.duration;
    if (t >= end) {
      if (this.loop) {
        this.seek(this.loop[0]);
        t = this.loop[0];
        if (this.audio) void this.audio.play().catch(() => {});
      } else {
        this.pause();
        this.time = end;
        this.emit();
        return;
      }
    }
    this.time = t;
    this.emit();
    this.raf = requestAnimationFrame(this.tick);
  };

  play(loop: [number, number] | null = null) {
    this.loop = loop;
    if (loop && (this.time < loop[0] || this.time >= loop[1])) this.time = loop[0];
    if (!loop && this.time >= this.duration - 0.05) this.time = 0;
    this.playing = true;
    this.base = this.time;
    this.t0 = performance.now();
    if (this.audio) {
      this.audio.currentTime = this.time;
      void this.audio.play().catch(() => {});
    }
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.tick);
    this.emit();
  }

  pause() {
    this.time = this.now();
    this.playing = false;
    this.audio?.pause();
    cancelAnimationFrame(this.raf);
    this.emit();
  }

  toggle(loop: [number, number] | null = null) {
    if (this.playing) this.pause();
    else this.play(loop);
  }

  seek(t: number) {
    this.time = Math.max(0, Math.min(this.duration || t, t));
    this.base = this.time;
    this.t0 = performance.now();
    if (this.audio) this.audio.currentTime = this.time;
    this.emit();
  }
}

export const clock = new Clock();
