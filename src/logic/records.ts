import { roundW } from '../lib/format';
import type { LoggedSet } from './progression';

/** Geschätztes 1RM nach Epley: Gewicht × (1 + Wdh / 30) */
export function epley1RM(weight: number | null, reps: number): number {
  if (weight == null || weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

export type RecordType = 'gewicht' | 'wdh' | '1rm';

export const RECORD_LABEL: Record<RecordType, string> = {
  gewicht: 'Höchstes Gewicht',
  wdh: 'Meiste Wdh bei diesem Gewicht',
  '1rm': 'Bestes geschätztes 1RM',
};

export interface Baseline {
  hasHistory: boolean;
  maxWeight: number;
  best1RM: number;
  /** Gewicht (gerundet) → meiste Wiederholungen */
  repsAtWeight: Map<number, number>;
}

export function emptyBaseline(): Baseline {
  return { hasHistory: false, maxWeight: 0, best1RM: 0, repsAtWeight: new Map() };
}

export function addToBaseline(b: Baseline, s: LoggedSet): void {
  b.hasHistory = true;
  const w = s.weight == null ? null : roundW(s.weight);
  if (w != null) {
    b.maxWeight = Math.max(b.maxWeight, w);
    b.best1RM = Math.max(b.best1RM, epley1RM(w, s.reps));
    b.repsAtWeight.set(w, Math.max(b.repsAtWeight.get(w) ?? 0, s.reps));
  }
}

export function buildBaseline(sets: LoggedSet[]): Baseline {
  const b = emptyBaseline();
  for (const s of sets) addToBaseline(b, s);
  return b;
}

/** Welche Rekorde stellt dieser Satz gegenüber der Baseline auf? */
export function recordsForSet(b: Baseline, s: LoggedSet): RecordType[] {
  if (!b.hasHistory || s.weight == null || s.reps <= 0) return [];
  const w = roundW(s.weight);
  const out: RecordType[] = [];
  if (w > 0 && w > b.maxWeight + 1e-9) out.push('gewicht');
  const prevReps = b.repsAtWeight.get(w);
  if (prevReps != null && s.reps > prevReps) out.push('wdh');
  const e = epley1RM(w, s.reps);
  if (e > 0 && e > b.best1RM + 1e-9) out.push('1rm');
  return out;
}

/**
 * Rekorde für die Sätze des aktuellen Trainings.
 * `prior` = alle Sätze früherer Trainings dieser Übung.
 * `current` = Sätze des laufenden Trainings, null für noch nicht erledigte.
 * Jeder Satz wird gegen frühere Trainings UND frühere Sätze dieses Trainings
 * verglichen, damit derselbe Rekord nicht mehrfach markiert wird.
 * Beim allerersten Training gibt es keine Rekorde.
 */
export function detectRecords(prior: LoggedSet[], current: (LoggedSet | null)[]): RecordType[][] {
  const b = buildBaseline(prior);
  return current.map((s) => {
    if (!s) return [];
    const rec = recordsForSet(b, s);
    if (b.hasHistory) addToBaseline(b, s);
    return rec;
  });
}
