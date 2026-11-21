// Ton für das Timer-Ende über Web Audio.
// iOS erlaubt Audio erst nach einer Nutzerinteraktion → unlockAudio() beim ersten Tap.
// Hinweis: Ist das iPhone stumm geschaltet, bleibt es still – dafür gibt es das optische Signal.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    // Musik anderer Apps (z. B. Spotify) soll weiterlaufen
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'ambient';
  } catch {
    /* ignorieren */
  }
  ctx = new AC();
  return ctx;
}

export function unlockAudio(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state !== 'running') void c.resume().catch(() => {});
  // stiller Puffer „entsperrt“ Audio auf iOS
  const buf = c.createBuffer(1, 1, 22050);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start(0);
}

/** Installiert einmalige Listener, die Audio beim ersten Tap freischalten. */
export function installAudioUnlock(): void {
  const handler = () => unlockAudio();
  window.addEventListener('touchend', handler, { passive: true });
  window.addEventListener('click', handler);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') void ctx.resume().catch(() => {});
  });
}

/** Drei kurze Pieptöne. */
export function playAlarm(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state !== 'running') void c.resume().catch(() => {});
  const t0 = c.currentTime + 0.05;
  for (let i = 0; i < 3; i++) {
    const start = t0 + i * 0.28;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = i === 2 ? 1320 : 880;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.6, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.25);
  }
}
