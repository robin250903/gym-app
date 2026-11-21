import type { Session, SetEntry } from '../db/types';
import type { LoggedSet } from './progression';
import { epley1RM } from './records';

export const isFinished = (s: Session): boolean => s.endedAt != null;

/** Erledigte Sätze mit Wiederholungen → LoggedSet */
export function doneSets(sets: SetEntry[]): LoggedSet[] {
  return sets
    .filter((s) => s.done && s.reps != null)
    .map((s) => ({ weight: s.weight, reps: s.reps as number }));
}

export interface ExerciseSessionEntry {
  session: Session;
  sets: LoggedSet[];
}

/**
 * Verlauf einer Übung über alle Trainingstage hinweg (neuestes zuerst).
 * Nur beendete Trainings, nur erledigte Sätze.
 */
export function exerciseHistory(
  sessions: Session[],
  exerciseId: string,
  excludeSessionId?: string,
  /** nur Trainings, die vor diesem Zeitpunkt begonnen haben */
  before?: number,
): ExerciseSessionEntry[] {
  const out: ExerciseSessionEntry[] = [];
  for (const s of sessions) {
    if (!isFinished(s) || s.id === excludeSessionId) continue;
    if (before != null && s.startedAt >= before) continue;
    const sets = s.blocks.filter((b) => b.exerciseId === exerciseId).flatMap((b) => doneSets(b.sets));
    if (sets.length) out.push({ session: s, sets });
  }
  return out.sort((a, b) => b.session.startedAt - a.session.startedAt);
}

/** Zuletzt genutzte Variante eines Slots (über alle Trainings). */
export function lastVariantForSlot(sessions: Session[], slotId: string, excludeSessionId?: string): string | undefined {
  let best: { at: number; id: string } | undefined;
  for (const s of sessions) {
    if (s.id === excludeSessionId) continue;
    const block = s.blocks.find((b) => b.slotId === slotId && b.sets.some((x) => x.done));
    if (block && (!best || s.startedAt > best.at)) best = { at: s.startedAt, id: block.exerciseId };
  }
  return best?.id;
}

export function volume(sets: LoggedSet[]): number {
  return sets.reduce((sum, s) => sum + (s.weight ?? 0) * s.reps, 0);
}

export function sessionVolume(session: Session): number {
  return session.blocks.reduce((sum, b) => sum + volume(doneSets(b.sets)), 0);
}

export interface ProgressPoint {
  at: number;
  bestWeight: number;
  best1RM: number;
  volume: number;
}

/** Datenpunkte für die Fortschritts-Diagramme (ältestes zuerst). */
export function progressPoints(history: ExerciseSessionEntry[]): ProgressPoint[] {
  return [...history]
    .sort((a, b) => a.session.startedAt - b.session.startedAt)
    .map(({ session, sets }) => ({
      at: session.startedAt,
      bestWeight: Math.max(0, ...sets.map((s) => s.weight ?? 0)),
      best1RM: Math.max(0, ...sets.map((s) => epley1RM(s.weight, s.reps))),
      volume: volume(sets),
    }));
}

export interface PersonalRecords {
  maxWeight?: { weight: number; reps: number; at: number };
  best1RM?: { value: number; weight: number; reps: number; at: number };
  /** Gewicht → meiste Wdh (absteigend nach Gewicht) */
  repsAtWeight: { weight: number; reps: number; at: number }[];
}

export function personalRecords(history: ExerciseSessionEntry[]): PersonalRecords {
  const pr: PersonalRecords = { repsAtWeight: [] };
  const byWeight = new Map<number, { reps: number; at: number }>();
  const chronological = [...history].sort((a, b) => a.session.startedAt - b.session.startedAt);
  for (const { session, sets } of chronological) {
    const at = session.startedAt;
    for (const s of sets) {
      const w = s.weight ?? 0;
      if (!pr.maxWeight || w > pr.maxWeight.weight || (w === pr.maxWeight.weight && s.reps > pr.maxWeight.reps)) {
        pr.maxWeight = { weight: w, reps: s.reps, at };
      }
      const e = epley1RM(s.weight, s.reps);
      if (e > 0 && (!pr.best1RM || e > pr.best1RM.value)) pr.best1RM = { value: e, weight: w, reps: s.reps, at };
      const cur = byWeight.get(w);
      if (!cur || s.reps > cur.reps) byWeight.set(w, { reps: s.reps, at });
    }
  }
  pr.repsAtWeight = [...byWeight.entries()]
    .map(([weight, v]) => ({ weight, ...v }))
    .sort((a, b) => b.weight - a.weight);
  return pr;
}
