// Live-Abfragen: Komponenten aktualisieren sich automatisch bei DB-Änderungen.
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from './db';
import type { Exercise, RestDayNotes } from './types';
import { SEED_REST_DAY_NOTES } from './seed';

export const useExercises = () =>
  useLiveQuery(async () => (await db.exercises.toArray()).sort((a, b) => a.name.localeCompare(b.name, 'de')));

export function useExerciseMap(): Map<string, Exercise> | undefined {
  const list = useExercises();
  return useMemo(() => (list ? new Map(list.map((e) => [e.id, e])) : undefined), [list]);
}

export const useDays = () => useLiveQuery(() => db.days.orderBy('order').toArray());

/** Alle Trainings, neuestes zuerst */
export const useSessions = () => useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().toArray());

export const useRestDayNotes = () =>
  useLiveQuery(async () => ((await db.meta.get('restDayNotes'))?.value as RestDayNotes | undefined) ?? SEED_REST_DAY_NOTES);
