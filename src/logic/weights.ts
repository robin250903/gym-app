import type { WeightMode } from '../db/types';
import { roundW } from '../lib/format';

const EPS = 1e-6;

export function sortedList(mode: Extract<WeightMode, { kind: 'liste' }>): number[] {
  return [...mode.weights].sort((a, b) => a - b);
}

/** Nächstes (höheres) Gewicht laut Gewichtsmodus. null = es gibt kein höheres. */
export function nextWeight(w: number | null, mode: WeightMode): number | null {
  if (w == null) return null;
  switch (mode.kind) {
    case 'schritt':
    case 'koerpergewicht':
      return mode.step > 0 ? roundW(w + mode.step) : null;
    case 'liste':
      return sortedList(mode).find((x) => x > w + EPS) ?? null;
  }
}

/** Nächstniedrigeres Gewicht (für den Minus-Button). */
export function prevWeight(w: number | null, mode: WeightMode): number | null {
  if (w == null) return null;
  switch (mode.kind) {
    case 'schritt':
      return mode.step > 0 ? Math.max(0, roundW(w - mode.step)) : w;
    case 'koerpergewicht':
      return mode.step > 0 ? Math.max(0, roundW(w - mode.step)) : w;
    case 'liste': {
      const lower = sortedList(mode).filter((x) => x < w - EPS);
      return lower.length ? lower[lower.length - 1] : w;
    }
  }
}

/** Plus-Button: bei Listen-Modus und unbekanntem Gewicht das kleinste Gewicht. */
export function stepUp(w: number | null, mode: WeightMode): number {
  if (w == null) {
    if (mode.kind === 'liste') return sortedList(mode)[0] ?? 0;
    return mode.kind === 'koerpergewicht' ? mode.step : 0;
  }
  return nextWeight(w, mode) ?? w;
}

export function stepDown(w: number | null, mode: WeightMode): number {
  if (w == null) return mode.kind === 'liste' ? (sortedList(mode)[0] ?? 0) : 0;
  return prevWeight(w, mode) ?? w;
}

export const sameWeight = (a: number | null, b: number | null): boolean =>
  a == null || b == null ? a === b : Math.abs(a - b) < EPS;
