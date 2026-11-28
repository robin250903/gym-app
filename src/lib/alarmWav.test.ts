import { describe, expect, it } from 'vitest';
import { ALARM_TAIL_SEC, buildAlarmWav, WAV_RATE } from './alarmWav';

describe('buildAlarmWav', () => {
  it('hat einen gültigen WAV-Header und die richtige Länge', () => {
    const buf = buildAlarmWav(90);
    const v = new DataView(buf);
    const tag = (off: number) => String.fromCharCode(...new Uint8Array(buf, off, 4));
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(tag(36)).toBe('data');
    expect(v.getUint32(24, true)).toBe(WAV_RATE);
    const samples = v.getUint32(40, true) / 2;
    expect(samples / WAV_RATE).toBeCloseTo(90 + ALARM_TAIL_SEC, 2);
    expect(buf.byteLength).toBe(44 + samples * 2);
  });

  it('ist bis zum Ende der Pause still und piept danach', () => {
    const buf = buildAlarmWav(3);
    const pcm = new Int16Array(buf, 44);
    const silent = pcm.subarray(0, 3 * WAV_RATE);
    expect(silent.every((s) => s === 0)).toBe(true);
    const tail = pcm.subarray(3 * WAV_RATE);
    expect(Math.max(...tail)).toBeGreaterThan(10_000);
  });
});
