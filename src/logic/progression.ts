/**
 * Doppelte Progression: erst Wiederholungen, dann Gewicht.
 *
 * Reine Logik ohne Datenbank- oder UI-Abhängigkeit, damit sie gut testbar ist.
 * Eingabe ist der Verlauf einer Übung (nur erledigte Arbeitssätze), Ausgabe ein
 * Vorschlag mit Gewicht + Ziel-Wiederholungen pro Satz.
 */
import type { WeightMode } from '../db/types';
import { fmtWeight } from '../lib/format';
import { nextWeight, sameWeight } from './weights';

export interface LoggedSet {
  weight: number | null;
  reps: number;
}

export interface TargetSet {
  weight: number | null;
  reps: number;
}

export interface ProgressionInput {
  repMin: number;
  repMax: number;
  weightMode: WeightMode;
  startWeight: number | null;
  /** Geplante Anzahl Arbeitssätze */
  sets: number;
  /** Erledigte Sätze vergangener Trainings, neuestes Training zuerst */
  history: LoggedSet[][];
}

export type SuggestionKind =
  | 'start' // noch kein Training → Startgewicht
  | 'reps' // gleiches Gewicht, mehr Wiederholungen
  | 'increase' // alle Sätze mit neuem Gewicht
  | 'mixed' // gemischte Sätze nach großem Gewichtssprung
  | 'max'; // oberes Ende erreicht, aber kein höheres Gewicht verfügbar

export interface Suggestion {
  kind: SuggestionKind;
  sets: TargetSet[];
  headline: string;
  /** Alternative „Gewicht beibehalten“ (nur wenn ein neues Gewicht vorgeschlagen wird) */
  hold?: TargetSet[];
  /** Dezenter Hinweis, z. B. wenn das Gewicht zu hoch scheint */
  warning?: string;
}

/** Sprünge über 10 % gelten als „groß“ → gemischte Sätze. */
export const BIG_JUMP_RATIO = 0.1;

/** „Deutlich verfehlt“ = mindestens ein Satz am Arbeitsgewicht 2+ Wdh unter dem unteren Ende. */
export const CLEAR_MISS_MARGIN = 2;

export function isBigJump(from: number | null, to: number | null, mode: WeightMode): boolean {
  if (mode.kind === 'koerpergewicht') return false; // Zusatzgewicht ist relativ zum Körper klein
  if (from == null || to == null || from <= 0) return false;
  return (to - from) / from > BIG_JUMP_RATIO + 1e-9;
}

const kg = (w: number | null, mode: WeightMode) => fmtWeight(w, mode);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function topWeight(sets: LoggedSet[]): number | null {
  let top: number | null = null;
  for (const s of sets) if (s.weight != null && (top == null || s.weight > top)) top = s.weight;
  return top;
}

/** Hat dieses Training das untere Ende am Arbeitsgewicht deutlich verfehlt? */
export function clearlyMissed(sets: LoggedSet[], repMin: number): boolean {
  if (sets.length === 0) return false;
  const top = topWeight(sets);
  return sets
    .filter((s) => sameWeight(s.weight, top))
    .some((s) => s.reps <= repMin - CLEAR_MISS_MARGIN);
}

function tooHeavyWarning(input: ProgressionInput): string | undefined {
  const [a, b] = input.history;
  if (!a?.length || !b?.length) return undefined;
  if (!sameWeight(topWeight(a), topWeight(b))) return undefined;
  if (clearlyMissed(a, input.repMin) && clearlyMissed(b, input.repMin)) {
    return 'Gewicht evtl. etwas zu hoch?';
  }
  return undefined;
}

function setList(indices: number[]): string {
  const nums = indices.map((i) => i + 1);
  if (nums.length === 1) return `Satz ${nums[0]}`;
  return `Satz ${nums.slice(0, -1).join(', ')} und ${nums[nums.length - 1]}`;
}

function distinctWeights(sets: LoggedSet[]): (number | null)[] {
  const out: (number | null)[] = [];
  for (const s of sets) if (!out.some((w) => sameWeight(w, s.weight))) out.push(s.weight);
  return out;
}

/** Häufigstes Gewicht (bei Gleichstand das höhere). */
function dominantWeight(sets: LoggedSet[]): number | null {
  let best: number | null = null;
  let bestCount = -1;
  for (const w of distinctWeights(sets)) {
    const c = sets.filter((s) => sameWeight(s.weight, w)).length;
    if (c > bestCount || (c === bestCount && (w ?? 0) > (best ?? 0))) {
      best = w;
      bestCount = c;
    }
  }
  return best;
}

export function suggest(input: ProgressionInput): Suggestion {
  const { repMin, repMax, weightMode: mode, sets: n } = input;
  const last = input.history[0] ?? [];
  const warning = tooHeavyWarning(input);

  // 6. Noch kein Training → Startgewicht, Ziel unteres Ende
  if (last.length === 0) {
    const w = input.startWeight;
    return {
      kind: 'start',
      sets: Array.from({ length: n }, () => ({ weight: w, reps: repMin })),
      headline:
        w == null && mode.kind !== 'koerpergewicht'
          ? `Erstes Training – Gewicht eintragen, Ziel: ${repMin} Wdh`
          : `Erstes Training – Ziel: ${repMin} Wdh`,
    };
  }

  const weights = distinctWeights(last);

  // 3. Laufende Umstellung mit gemischten Sätzen (z. B. 12,5 kg + 10 kg)?
  if (weights.length === 2) {
    const high = topWeight(last);
    const low = weights.find((w) => !sameWeight(w, high)) ?? null;
    if (sameWeight(nextWeight(low, mode), high)) {
      return mixedContinuation(input, last, high, low, warning);
    }
  }

  const w = weights.length === 1 ? weights[0] : dominantWeight(last);
  const atW = weights.length === 1 ? last : last.filter((s) => sameWeight(s.weight, w));
  const allTop = atW.length >= n && atW.every((s) => s.reps >= repMax);

  // 1. Noch nicht alle Sätze am oberen Ende → gleiches Gewicht, +1 Wdh
  if (!allTop) {
    const targets: TargetSet[] = [];
    const improve: number[] = [];
    for (let i = 0; i < n; i++) {
      const base = atW[i]?.reps ?? atW[atW.length - 1]?.reps ?? repMin;
      if (base >= repMax) targets.push({ weight: w, reps: repMax });
      else {
        targets.push({ weight: w, reps: base + 1 });
        improve.push(i);
      }
    }
    const headline =
      improve.length === n ? '+1 Wdh pro Satz' : `+1 Wdh in ${setList(improve)}`;
    return { kind: 'reps', sets: targets, headline, warning };
  }

  // 2. Alle Sätze am oberen Ende → nächstes Gewicht
  const hold = Array.from({ length: n }, () => ({ weight: w, reps: repMax }));
  const next = nextWeight(w, mode);
  if (next == null) {
    return {
      kind: 'max',
      sets: hold,
      headline:
        mode.kind === 'liste'
          ? 'Oberes Ende erreicht – kein höheres Gewicht in der Liste'
          : 'Oberes Ende erreicht 💪',
      warning,
    };
  }

  if (isBigJump(w, next, mode) && n > 1) {
    return {
      kind: 'mixed',
      sets: [{ weight: next, reps: repMin }, ...hold.slice(1)],
      headline: `Neues Gewicht 💪 – Satz 1 mit ${kg(next, mode)}, Ziel: ${repMin} Wdh`,
      hold,
      warning,
    };
  }

  return {
    kind: 'increase',
    sets: Array.from({ length: n }, () => ({ weight: next, reps: repMin })),
    headline: `Neues Gewicht 💪 – Ziel: ${repMin} Wdh`,
    hold,
    warning,
  };
}

/**
 * Gemischte Sätze: Die ersten k Sätze liefen mit dem neuen (hohen) Gewicht.
 * Haben alle davon das untere Ende geschafft, kommt ein weiterer Satz mit dem
 * neuen Gewicht dazu – bis alle Sätze umgestellt sind.
 */
function mixedContinuation(
  input: ProgressionInput,
  last: LoggedSet[],
  high: number | null,
  low: number | null,
  warning: string | undefined,
): Suggestion {
  const { repMin, repMax, weightMode: mode, sets: n } = input;
  const highSets = last.filter((s) => sameWeight(s.weight, high));
  const lowSets = last.filter((s) => !sameWeight(s.weight, high));
  const k = highSets.length;
  const hitMin = highSets.every((s) => s.reps >= repMin);
  const newK = clamp(hitMin ? k + 1 : k, 1, n);

  const targets: TargetSet[] = [];
  for (let i = 0; i < newK; i++) {
    const prev = highSets[i]?.reps;
    const reps = prev == null ? repMin : clamp(hitMin ? prev + 1 : repMin, repMin, repMax);
    targets.push({ weight: high, reps });
  }
  for (let j = 0; targets.length < n; j++) {
    const prev = lowSets[j]?.reps ?? lowSets[lowSets.length - 1]?.reps ?? repMax;
    targets.push({ weight: low, reps: Math.min(prev, repMax) });
  }

  const hold: TargetSet[] = Array.from({ length: n }, (_, i) => {
    const s = last[i] ?? last[last.length - 1];
    return { weight: s.weight, reps: clamp(s.reps, repMin, repMax) };
  });

  let headline: string;
  if (!hitMin) headline = `Weiter gemischt – Ziel: ${repMin} Wdh mit ${kg(high, mode)}`;
  else if (newK === n) headline = `Alle Sätze mit ${kg(high, mode)} 💪`;
  else headline = `Neues Gewicht 💪 – jetzt ${newK} Sätze mit ${kg(high, mode)}`;

  return { kind: 'mixed', sets: targets, headline, hold: hitMin ? hold : undefined, warning };
}
