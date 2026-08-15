/** Ding suave estilo iOS al llegar una notificación. */

let sharedCtx: AudioContext | null = null;

export function playNotificationDing(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    sharedCtx ??= new AudioCtx();
    const ctx = sharedCtx;
    void ctx.resume();

    const now = ctx.currentTime;

    function tone(freq: number, start: number, duration: number, peak: number) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.05);
    }

    // Dos tonos cortos (tipo “ding-ding” iOS)
    tone(1046.5, now, 0.14, 0.16);
    tone(1568, now + 0.11, 0.28, 0.12);
  } catch {
    /* ignore autoplay / AudioContext errors */
  }
}
