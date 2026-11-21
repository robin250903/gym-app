import type { Exercise, Session, SessionBlock, Slot, WorkoutDay } from '../db/types';
import { uid } from '../lib/format';
import { exerciseHistory, lastVariantForSlot } from './history';
import { suggest, type Suggestion } from './progression';

/** Vorschlag für eine Übung auf Basis aller bisherigen Trainings. */
export function suggestionFor(
  exercise: Exercise,
  plannedSets: number,
  sessions: Session[],
  excludeSessionId?: string,
): Suggestion {
  const history = exerciseHistory(sessions, exercise.id, excludeSessionId).map((h) => h.sets);
  return suggest({
    repMin: exercise.repMin,
    repMax: exercise.repMax,
    weightMode: exercise.weightMode,
    startWeight: exercise.startWeight,
    sets: Math.max(1, plannedSets),
    history,
  });
}

export function setsFromSuggestion(s: Suggestion) {
  return s.sets.map((t) => ({ id: uid(), weight: t.weight, reps: t.reps, done: false }));
}

export function buildBlock(
  slot: Pick<Slot, 'id' | 'category' | 'sets'> | null,
  exercise: Exercise,
  sessions: Session[],
  excludeSessionId?: string,
  plannedSets = slot?.sets ?? 3,
): SessionBlock {
  const sug = suggestionFor(exercise, plannedSets, sessions, excludeSessionId);
  return {
    id: uid(),
    slotId: slot?.id ?? null,
    category: slot?.category ?? '',
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    plannedSets,
    sets: setsFromSuggestion(sug),
  };
}

/** Legt ein neues Training für einen Trainingstag an (noch nicht gespeichert). */
export function createSession(day: WorkoutDay, exercises: Map<string, Exercise>, sessions: Session[]): Session {
  const blocks: SessionBlock[] = [];
  for (const slot of day.slots) {
    const available = slot.variantIds.filter((id) => exercises.has(id));
    if (!available.length) continue;
    const last = lastVariantForSlot(sessions, slot.id);
    const exId = last && available.includes(last) ? last : available[0];
    blocks.push(buildBlock(slot, exercises.get(exId)!, sessions));
  }
  return { id: uid(), dayId: day.id, dayName: day.name, startedAt: Date.now(), endedAt: null, blocks };
}

/** Welcher aktive Trainingstag ist heute laut Wochenplan dran? */
export function todaysDays(days: WorkoutDay[], weekday: number): WorkoutDay[] {
  return days.filter((d) => d.active && d.weekdays.includes(weekday));
}
