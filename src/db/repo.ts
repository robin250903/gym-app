// Datenzugriff: alle Schreiboperationen an einer Stelle.
import { db } from './db';
import type { Exercise, RestDayNotes, Session, WorkoutDay } from './types';
import { SEED_REST_DAY_NOTES } from './seed';

export const saveSession = (s: Session) => db.sessions.put(s);
export const deleteSession = (id: string) => db.sessions.delete(id);

/** Beendet ein Training: nicht abgehakte Sätze und leere Übungen fallen weg. */
export async function finishSession(s: Session): Promise<Session> {
  const finished: Session = {
    ...s,
    endedAt: Date.now(),
    blocks: s.blocks
      .map((b) => ({ ...b, sets: b.sets.filter((x) => x.done) }))
      .filter((b) => b.sets.length > 0),
  };
  await db.sessions.put(finished);
  return finished;
}

export const saveExercise = (e: Exercise) => db.exercises.put(e);

/** Löscht eine Übung aus der Bibliothek und aus allen Trainingstagen. Der Verlauf bleibt erhalten. */
export async function deleteExercise(id: string): Promise<void> {
  await db.transaction('rw', db.exercises, db.days, async () => {
    await db.exercises.delete(id);
    const days = await db.days.toArray();
    for (const d of days) {
      if (!d.slots.some((s) => s.variantIds.includes(id))) continue;
      await db.days.put({
        ...d,
        slots: d.slots.map((s) => ({ ...s, variantIds: s.variantIds.filter((v) => v !== id) })),
      });
    }
  });
}

export const saveDay = (d: WorkoutDay) => db.days.put(d);
export const deleteDay = (id: string) => db.days.delete(id);

export async function getRestDayNotes(): Promise<RestDayNotes> {
  const m = await db.meta.get('restDayNotes');
  return (m?.value as RestDayNotes | undefined) ?? SEED_REST_DAY_NOTES;
}

export const setRestDayNotes = (notes: RestDayNotes) => db.meta.put({ key: 'restDayNotes', value: notes });
