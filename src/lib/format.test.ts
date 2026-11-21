import { describe, expect, it } from 'vitest';
import { fmtSets, parseDecimal } from './format';

describe('Zahleneingabe', () => {
  it('akzeptiert Komma und Punkt', () => {
    expect(parseDecimal('12,5')).toBe(12.5);
    expect(parseDecimal('12.5')).toBe(12.5);
    expect(parseDecimal(' 90 ')).toBe(90);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
  });
});

describe('Satz-Darstellung „Letztes Mal“', () => {
  it('gruppiert nach Gewicht', () => {
    expect(fmtSets([{ weight: 90, reps: 10 }, { weight: 90, reps: 9 }, { weight: 90, reps: 8 }])).toBe(
      '90 kg × 10 / 9 / 8',
    );
    expect(fmtSets([{ weight: 12.5, reps: 8 }, { weight: 10, reps: 15 }, { weight: 10, reps: 15 }])).toBe(
      '12,5 kg × 8 · 10 kg × 15 / 15',
    );
  });

  it('Körpergewicht', () => {
    expect(fmtSets([{ weight: 0, reps: 10 }], { kind: 'koerpergewicht', step: 2.5 })).toBe('KG × 10');
    expect(fmtSets([{ weight: 5, reps: 8 }], { kind: 'koerpergewicht', step: 2.5 })).toBe('KG + 5 kg × 8');
  });
});
