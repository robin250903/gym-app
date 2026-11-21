import { describe, expect, it } from 'vitest';
import { detectRecords, epley1RM } from './records';
import { personalRecords, progressPoints, volume } from './history';
import type { Session } from '../db/types';

describe('Epley-1RM', () => {
  it('berechnet Gewicht × (1 + Wdh / 30)', () => {
    expect(epley1RM(90, 10)).toBeCloseTo(120);
    expect(epley1RM(100, 0)).toBe(0);
    expect(epley1RM(null, 10)).toBe(0);
  });
});

describe('Rekord-Erkennung', () => {
  const prior = [
    { weight: 90, reps: 10 },
    { weight: 90, reps: 9 },
    { weight: 85, reps: 12 },
  ];

  it('erstes Training überhaupt → keine Rekorde', () => {
    expect(detectRecords([], [{ weight: 50, reps: 10 }])).toEqual([[]]);
  });

  it('höheres Gewicht → Gewichts-Rekord (+ 1RM falls besser)', () => {
    const [r] = detectRecords(prior, [{ weight: 92.5, reps: 6 }]);
    expect(r).toContain('gewicht');
    expect(r).not.toContain('1rm'); // 92,5 × 1,2 = 111 < 120
  });

  it('mehr Wiederholungen bei bekanntem Gewicht → Wdh-Rekord', () => {
    // 85 × 13 → 1RM 121,8 > 120, also zusätzlich 1RM-Rekord
    expect(detectRecords(prior, [{ weight: 85, reps: 13 }])[0]).toEqual(['wdh', '1rm']);
    const [r] = detectRecords([...prior, { weight: 70, reps: 12 }], [{ weight: 70, reps: 13 }]);
    expect(r).toEqual(['wdh']);
  });

  it('besseres geschätztes 1RM → 1RM-Rekord', () => {
    const [r] = detectRecords(prior, [{ weight: 90, reps: 11 }]);
    expect(r).toEqual(['wdh', '1rm']);
  });

  it('kein Rekord bei schlechterer Leistung', () => {
    expect(detectRecords(prior, [{ weight: 90, reps: 8 }])).toEqual([[]]);
  });

  it('derselbe Rekord wird im Training nicht doppelt markiert', () => {
    const res = detectRecords(prior, [
      { weight: 92.5, reps: 7 },
      { weight: 92.5, reps: 6 },
      null,
    ]);
    expect(res[0]).toContain('gewicht');
    expect(res[1]).toEqual([]);
    expect(res[2]).toEqual([]);
  });

  it('Körpergewicht (0 kg): mehr Wdh ist ein Rekord, Gewicht 0 nicht', () => {
    const [r] = detectRecords([{ weight: 0, reps: 8 }], [{ weight: 0, reps: 9 }]);
    expect(r).toEqual(['wdh']);
  });
});

describe('Statistik', () => {
  const mk = (id: string, at: number, sets: [number, number][]): { session: Session; sets: { weight: number; reps: number }[] } => ({
    session: { id, dayId: null, dayName: 'X', startedAt: at, endedAt: at + 1, blocks: [] },
    sets: sets.map(([weight, reps]) => ({ weight, reps })),
  });

  it('Volumen = Summe Gewicht × Wdh', () => {
    expect(volume([{ weight: 90, reps: 10 }, { weight: 90, reps: 8 }])).toBe(1620);
  });

  it('Datenpunkte chronologisch mit bestem Gewicht, 1RM und Volumen', () => {
    const pts = progressPoints([mk('b', 2, [[92.5, 6]]), mk('a', 1, [[90, 10], [90, 9]])]);
    expect(pts.map((p) => p.at)).toEqual([1, 2]);
    expect(pts[0].bestWeight).toBe(90);
    expect(pts[0].best1RM).toBeCloseTo(120);
    expect(pts[0].volume).toBe(1710);
  });

  it('persönliche Rekorde', () => {
    const pr = personalRecords([mk('a', 1, [[90, 10]]), mk('b', 2, [[92.5, 6], [85, 12]])]);
    expect(pr.maxWeight).toMatchObject({ weight: 92.5, reps: 6, at: 2 });
    expect(pr.best1RM).toMatchObject({ weight: 90, reps: 10 });
    expect(pr.repsAtWeight.map((x) => x.weight)).toEqual([92.5, 90, 85]);
  });
});
