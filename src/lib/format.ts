import type { WeightMode } from '../db/types';

const nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

export const fmtNum = (n: number): string => nf.format(n);
export const fmtInt = (n: number): string => nf0.format(n);

/** Rundet Gewichte, um Fließkomma-Artefakte (z. B. 12.499999) zu vermeiden. */
export const roundW = (n: number): number => Math.round(n * 1000) / 1000;

/** Akzeptiert Komma und Punkt: "12,5" → 12.5. Leere Eingabe → null. */
export function parseDecimal(input: string): number | null {
  const t = input.trim().replace(/\s/g, '').replace(',', '.');
  if (t === '' || t === '.' || t === '-') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function fmtWeight(w: number | null, mode?: WeightMode): string {
  if (mode?.kind === 'koerpergewicht') {
    if (w == null || w === 0) return 'KG';
    return `KG + ${nf.format(w)} kg`;
  }
  return w == null ? '? kg' : `${nf.format(w)} kg`;
}

/**
 * Kompakte Satz-Darstellung, gruppiert nach Gewicht:
 * "90 kg × 10 / 9 / 8" oder "12,5 kg × 8 · 10 kg × 15 / 15"
 */
export function fmtSets(
  sets: { weight: number | null; reps: number | null }[],
  mode?: WeightMode,
): string {
  if (sets.length === 0) return '–';
  const groups: { weight: number | null; reps: (number | null)[] }[] = [];
  for (const s of sets) {
    const g = groups[groups.length - 1];
    if (g && g.weight === s.weight) g.reps.push(s.reps);
    else groups.push({ weight: s.weight, reps: [s.reps] });
  }
  return groups
    .map((g) => `${fmtWeight(g.weight, mode)} × ${g.reps.map((r) => (r == null ? '?' : r)).join(' / ')}`)
    .join(' · ');
}

const weekdayFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
const dateFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

export const fmtDate = (ts: number): string => `${weekdayFmt.format(ts)}, ${dateFmt.format(ts)}`;
export const fmtShortDate = (ts: number): string => shortDateFmt.format(ts);
export const fmtTime = (ts: number): string => timeFmt.format(ts);

export function fmtDuration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} h`;
}

/** Sekunden als m:ss */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const WEEKDAYS_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
/** Anzeige-Reihenfolge Mo … So */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
