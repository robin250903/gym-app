// Erzeugt eine WAV-Datei: `silenceSec` Sekunden Stille, danach das Piep-Signal.
// Reine Funktion ohne DOM, damit sie testbar ist.

export const WAV_RATE = 8000; // reicht für Töne bis ~4 kHz und hält die Datei klein (16 KB pro Sekunde)

/** Ein Durchgang: zwei tiefe, ein hoher Piep (wie playAlarm in sound.ts). */
const PATTERN = [
  { at: 0, freq: 880 },
  { at: 0.28, freq: 880 },
  { at: 0.56, freq: 1320 },
];
const BEEP_LEN = 0.22;
/** Das Muster zweimal, damit man es im Gym nicht überhört. */
const REPEATS = [0, 1.1];
/** Länge des Signals am Ende (inkl. kurzem Ausklang). */
export const ALARM_TAIL_SEC = 2.2;

export function buildAlarmWav(silenceSec: number): ArrayBuffer {
  const silence = Math.max(0, Math.round(silenceSec * WAV_RATE));
  const total = silence + Math.round(ALARM_TAIL_SEC * WAV_RATE);
  const dataBytes = total * 2;
  const buf = new ArrayBuffer(44 + dataBytes); // mit 0 initialisiert = Stille
  const v = new DataView(buf);

  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true); // Größe fmt-Chunk
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, WAV_RATE, true);
  v.setUint32(28, WAV_RATE * 2, true); // Bytes pro Sekunde
  v.setUint16(32, 2, true); // Block-Align
  v.setUint16(34, 16, true); // Bits pro Sample
  str(36, 'data');
  v.setUint32(40, dataBytes, true);

  const beepSamples = Math.round(BEEP_LEN * WAV_RATE);
  const attack = Math.round(0.01 * WAV_RATE);
  for (const rep of REPEATS) {
    for (const { at, freq } of PATTERN) {
      const start = silence + Math.round((rep + at) * WAV_RATE);
      for (let i = 0; i < beepSamples && start + i < total; i++) {
        const env = i < attack ? i / attack : Math.exp((-6 * (i - attack)) / beepSamples);
        const sample = Math.sin((2 * Math.PI * freq * i) / WAV_RATE) * env * 0.7;
        v.setInt16(44 + (start + i) * 2, Math.round(sample * 32767), true);
      }
    }
  }
  return buf;
}
