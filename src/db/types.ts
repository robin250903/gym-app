// Datenmodell der App. Alles liegt lokal in IndexedDB (siehe db.ts).

export type ExerciseType = 'grundübung' | 'isolation';

/** Wie sich das Gewicht einer Übung verändern lässt. */
export type WeightMode =
  /** Fester Sprung, z. B. 2,5 kg (Langhantel) oder Steckgewicht-Stufen */
  | { kind: 'schritt'; step: number }
  /** Nur diese Gewichte sind verfügbar, z. B. Kurzhanteln */
  | { kind: 'liste'; weights: number[] }
  /** Körpergewicht; `weight` eines Satzes = Zusatzgewicht (0 = ohne) */
  | { kind: 'koerpergewicht'; step: number };

export interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;
  equipment: string;
  weightMode: WeightMode;
  repMin: number;
  repMax: number;
  /** Standard-Pausenzeit in Sekunden */
  restSec: number;
  notes: string;
  /** Startgewicht, solange es noch kein Training gibt. null = „offen“ */
  startWeight: number | null;
}

export interface Slot {
  id: string;
  /** Bewegungskategorie, z. B. „Horizontale Zugbewegung breit“ */
  category: string;
  /** Anzahl Arbeitssätze */
  sets: number;
  /** IDs der Übungen, zwischen denen beim Training gewählt werden kann */
  variantIds: string[];
}

export interface WorkoutDay {
  id: string;
  name: string;
  /** Wochentage nach JS-Konvention: 0 = So, 1 = Mo, … 6 = Sa */
  weekdays: number[];
  slots: Slot[];
  active: boolean;
  order: number;
}

export interface SetEntry {
  id: string;
  /** Gewicht in kg (bei Körpergewicht: Zusatzgewicht). null = noch nicht eingetragen */
  weight: number | null;
  reps: number | null;
  done: boolean;
  /** Für später (RIR pro Satz) */
  rir?: number | null;
}

/** Eine Übung innerhalb eines Trainings (entspricht einem Slot des Trainingstags). */
export interface SessionBlock {
  id: string;
  slotId: string | null;
  category: string;
  exerciseId: string;
  /** Name als Kopie, damit der Verlauf auch nach Löschen der Übung lesbar bleibt */
  exerciseName: string;
  plannedSets: number;
  sets: SetEntry[];
}

export interface Session {
  id: string;
  dayId: string | null;
  dayName: string;
  startedAt: number;
  /** null = Training läuft noch */
  endedAt: number | null;
  blocks: SessionBlock[];
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

/** Hinweis pro Wochentag ohne Training, z. B. { "3": "Fußball ⚽" } */
export type RestDayNotes = Record<string, string>;

export interface BackupFile {
  app: 'gym-app';
  version: 1;
  exportedAt: string;
  exercises: Exercise[];
  days: WorkoutDay[];
  sessions: Session[];
  meta: MetaEntry[];
}
