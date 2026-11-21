import { describe, expect, it } from 'vitest';
import type { WeightMode } from '../db/types';
import { suggest, type LoggedSet, type ProgressionInput } from './progression';
import { nextWeight, prevWeight } from './weights';

const step25: WeightMode = { kind: 'schritt', step: 2.5 };
const khList: WeightMode = { kind: 'liste', weights: [10, 12.5, 15, 17.5] };
const bw: WeightMode = { kind: 'koerpergewicht', step: 2.5 };

const sets = (weight: number | null, ...reps: number[]): LoggedSet[] => reps.map((r) => ({ weight, reps: r }));

function input(partial: Partial<ProgressionInput>): ProgressionInput {
  return {
    repMin: 6,
    repMax: 10,
    weightMode: step25,
    startWeight: 90,
    sets: 3,
    history: [],
    ...partial,
  };
}

describe('Gewichtsschritte', () => {
  it('Schritt-Modus addiert den Schritt ohne Rundungsfehler', () => {
    expect(nextWeight(90, step25)).toBe(92.5);
    expect(nextWeight(3.4, step25)).toBe(5.9);
    expect(prevWeight(2, step25)).toBe(0);
  });

  it('Listen-Modus springt nur zwischen verfügbaren Gewichten', () => {
    expect(nextWeight(10, khList)).toBe(12.5);
    expect(nextWeight(11, khList)).toBe(12.5);
    expect(nextWeight(17.5, khList)).toBeNull();
    expect(prevWeight(12.5, khList)).toBe(10);
    expect(prevWeight(10, khList)).toBe(10);
  });
});

describe('Startgewicht (kein vorheriges Training)', () => {
  it('nutzt Startgewicht und unteres Ende', () => {
    const s = suggest(input({}));
    expect(s.kind).toBe('start');
    expect(s.sets).toEqual([
      { weight: 90, reps: 6 },
      { weight: 90, reps: 6 },
      { weight: 90, reps: 6 },
    ]);
  });

  it('„offenes“ Startgewicht bleibt leer', () => {
    const s = suggest(input({ startWeight: null, sets: 2 }));
    expect(s.sets).toEqual([
      { weight: null, reps: 6 },
      { weight: null, reps: 6 },
    ]);
    expect(s.headline).toContain('Gewicht eintragen');
  });
});

describe('Erst Wiederholungen, dann Gewicht', () => {
  it('Gewicht bleibt, +1 Wdh in Sätzen unter dem oberen Ende', () => {
    const s = suggest(input({ history: [sets(90, 10, 9, 8)] }));
    expect(s.kind).toBe('reps');
    expect(s.sets).toEqual([
      { weight: 90, reps: 10 },
      { weight: 90, reps: 10 },
      { weight: 90, reps: 9 },
    ]);
    expect(s.headline).toBe('+1 Wdh in Satz 2 und 3');
    expect(s.hold).toBeUndefined();
  });

  it('+1 Wdh pro Satz, wenn kein Satz am oberen Ende ist', () => {
    const s = suggest(input({ history: [sets(90, 7, 7, 6)] }));
    expect(s.sets.map((x) => x.reps)).toEqual([8, 8, 7]);
    expect(s.headline).toBe('+1 Wdh pro Satz');
  });

  it('weniger Sätze als geplant → kein Gewichtssprung', () => {
    const s = suggest(input({ history: [sets(90, 10, 10)] }));
    expect(s.kind).toBe('reps');
    expect(s.sets.every((x) => x.weight === 90)).toBe(true);
  });
});

describe('Alle Sätze am oberen Ende → nächstes Gewicht', () => {
  it('Schritt-Modus: +2,5 kg, Ziel springt aufs untere Ende', () => {
    const s = suggest(input({ history: [sets(90, 10, 10, 10)] }));
    expect(s.kind).toBe('increase');
    expect(s.sets).toEqual([
      { weight: 92.5, reps: 6 },
      { weight: 92.5, reps: 6 },
      { weight: 92.5, reps: 6 },
    ]);
    expect(s.headline).toBe('Neues Gewicht 💪 – Ziel: 6 Wdh');
  });

  it('„Gewicht beibehalten“ bietet das alte Gewicht an', () => {
    const s = suggest(input({ history: [sets(90, 10, 10, 10)] }));
    expect(s.hold).toEqual([
      { weight: 90, reps: 10 },
      { weight: 90, reps: 10 },
      { weight: 90, reps: 10 },
    ]);
  });

  it('Listen-Modus: höchstes Gewicht erreicht → bleibt beim Gewicht', () => {
    const s = suggest(input({ weightMode: khList, repMin: 8, repMax: 15, history: [sets(17.5, 15, 15, 15)] }));
    expect(s.kind).toBe('max');
    expect(s.sets.every((x) => x.weight === 17.5 && x.reps === 15)).toBe(true);
  });

  it('Körpergewicht: Zusatzgewicht steigt, nie gemischte Sätze', () => {
    const s = suggest(input({ weightMode: bw, history: [sets(0, 10, 10, 10)] }));
    expect(s.kind).toBe('increase');
    expect(s.sets.every((x) => x.weight === 2.5 && x.reps === 6)).toBe(true);
  });
});

describe('Großer Sprung (> 10 %) → gemischte Sätze, z. B. Kurzhantel 10 → 12,5 kg', () => {
  const base = { weightMode: khList, repMin: 8, repMax: 15, startWeight: 10, sets: 3 };

  it('Session 1: nur Satz 1 mit 12,5 kg, Rest mit 10 kg', () => {
    const s = suggest(input({ ...base, history: [sets(10, 15, 15, 15)] }));
    expect(s.kind).toBe('mixed');
    expect(s.sets).toEqual([
      { weight: 12.5, reps: 8 },
      { weight: 10, reps: 15 },
      { weight: 10, reps: 15 },
    ]);
    expect(s.headline).toContain('Satz 1 mit 12,5 kg');
    expect(s.hold?.every((x) => x.weight === 10)).toBe(true);
  });

  it('Session 2: unteres Ende geschafft → zweiter Satz mit 12,5 kg', () => {
    const last = [{ weight: 12.5, reps: 8 }, ...sets(10, 15, 15)];
    const s = suggest(input({ ...base, history: [last, sets(10, 15, 15, 15)] }));
    expect(s.kind).toBe('mixed');
    expect(s.sets).toEqual([
      { weight: 12.5, reps: 9 },
      { weight: 12.5, reps: 8 },
      { weight: 10, reps: 15 },
    ]);
  });

  it('Session 3: alle Sätze umgestellt', () => {
    const last = [...sets(12.5, 9, 8), { weight: 10, reps: 15 }];
    const s = suggest(input({ ...base, history: [last] }));
    expect(s.sets).toEqual([
      { weight: 12.5, reps: 10 },
      { weight: 12.5, reps: 9 },
      { weight: 12.5, reps: 8 },
    ]);
    expect(s.headline).toBe('Alle Sätze mit 12,5 kg 💪');
  });

  it('danach normale doppelte Progression mit 12,5 kg', () => {
    const s = suggest(input({ ...base, history: [sets(12.5, 10, 9, 8)] }));
    expect(s.kind).toBe('reps');
    expect(s.sets.map((x) => x.reps)).toEqual([11, 10, 9]);
  });

  it('unteres Ende mit neuem Gewicht verfehlt → gleiche Aufteilung nochmal', () => {
    const last = [{ weight: 12.5, reps: 6 }, ...sets(10, 15, 15)];
    const s = suggest(input({ ...base, history: [last] }));
    expect(s.sets).toEqual([
      { weight: 12.5, reps: 8 },
      { weight: 10, reps: 15 },
      { weight: 10, reps: 15 },
    ]);
    expect(s.headline).toContain('Weiter gemischt');
  });

  it('kleiner Sprung (90 → 92,5 kg = 2,8 %) → keine gemischten Sätze', () => {
    const s = suggest(input({ history: [sets(90, 10, 10, 10)] }));
    expect(s.kind).toBe('increase');
  });

  it('nur ein Satz geplant → direkt neues Gewicht', () => {
    const s = suggest(input({ ...base, sets: 1, history: [sets(10, 15)] }));
    expect(s.kind).toBe('increase');
    expect(s.sets).toEqual([{ weight: 12.5, reps: 8 }]);
  });
});

describe('Hinweis „Gewicht evtl. zu hoch?“', () => {
  it('erscheint nach zwei deutlich verfehlten Trainings mit gleichem Gewicht', () => {
    const s = suggest(input({ history: [sets(92.5, 5, 4, 4), sets(92.5, 4, 4, 3)] }));
    expect(s.warning).toBe('Gewicht evtl. etwas zu hoch?');
    // keine automatische Reduktion
    expect(s.sets.every((x) => x.weight === 92.5)).toBe(true);
  });

  it('erscheint nicht nach nur einem verfehlten Training', () => {
    const s = suggest(input({ history: [sets(92.5, 4, 4, 3), sets(90, 10, 10, 10)] }));
    expect(s.warning).toBeUndefined();
  });

  it('knapp verfehlt (1 Wdh unter dem unteren Ende) zählt nicht als deutlich', () => {
    const s = suggest(input({ history: [sets(92.5, 6, 5, 5), sets(92.5, 6, 5, 5)] }));
    expect(s.warning).toBeUndefined();
  });
});
