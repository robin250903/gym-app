import Dexie, { type EntityTable } from 'dexie';
import type { Exercise, MetaEntry, Session, WorkoutDay } from './types';

class GymDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  days!: EntityTable<WorkoutDay, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  meta!: EntityTable<MetaEntry, 'key'>;

  constructor() {
    super('gym-app');
    this.version(1).stores({
      exercises: 'id, name',
      days: 'id, order',
      sessions: 'id, startedAt, dayId',
      meta: 'key',
    });
  }
}

export const db = new GymDB();

/** Bittet den Browser, die Daten nicht automatisch zu löschen (iOS räumt sonst evtl. auf). */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
