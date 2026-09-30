"use client";
// A soft three-note chime made with WebAudio (no audio files).
// Browsers only allow audio after a user gesture, so call unlockAudio() from a click (e.g. Start).

type Ctx = AudioContext;
let ctx: Ctx | null = null;

function getCtx(): Ctx | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  try {
    ctx = new C();
  } catch {
    ctx = null;
  }
  return ctx;
}

export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

export function playChime() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const t0 = c.currentTime + 0.05;
  // Major triad, gently staggered: C5 E5 G5
  [523.25, 659.25, 783.99].forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = f;
    const t = t0 + i * 0.18;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 1.2);
  });
}
