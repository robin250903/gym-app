import { db } from './db';
import type { Exercise, ExerciseType, RestDayNotes, WeightMode, WorkoutDay } from './types';

// Verfügbare Kurzhanteln (in den Einstellungen pro Übung änderbar)
const KH_CURLS = [10, 12.5, 15, 17.5];
const KH_PRESS = [10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30];

const step = (s: number): WeightMode => ({ kind: 'schritt', step: s });
const list = (w: number[]): WeightMode => ({ kind: 'liste', weights: w });
const bw: WeightMode = { kind: 'koerpergewicht', step: 2.5 };

// Standard-Bereiche aus dem Plan
const SCHWER = { repMin: 6, repMax: 10 };
const MITTEL = { repMin: 8, repMax: 12 };
const ISO = { repMin: 10, repMax: 15 };
const KH_CURL = { repMin: 8, repMax: 15 };

function ex(
  id: string,
  name: string,
  type: ExerciseType,
  equipment: string,
  weightMode: WeightMode,
  range: { repMin: number; repMax: number },
  restSec: number,
  startWeight: number | null,
  notes = '',
): Exercise {
  return { id, name, type, equipment, weightMode, ...range, restSec, startWeight, notes };
}

export const SEED_EXERCISES: Exercise[] = [
  // Push
  ex('bankdruecken', 'Bankdrücken Langhantel', 'grundübung', 'Langhantel', step(2.5), SCHWER, 180, 90),
  ex('schraegbank', 'Schrägbankdrücken', 'grundübung', '', step(2.5), MITTEL, 120, 40),
  ex('schulterdruecken-maschine', 'Schulterdrücken Maschine', 'grundübung', 'Maschine', step(2.5), SCHWER, 120, 30),
  ex('schulterdruecken-kh', 'Schulterdrücken Kurzhantel', 'grundübung', 'Kurzhantel', list(KH_PRESS), SCHWER, 120, null),
  ex('seitheben', 'Seitheben', 'isolation', 'Kurzhantel', step(1), ISO, 75, 14),
  ex('kabel-fly', 'Kabel-Fly mit Bank', 'isolation', 'Kabel', step(2.5), ISO, 75, 10),
  ex('trizeps-kabel-dreieck', 'Trizepsdrücken Kabel, Dreieckgriff', 'isolation', 'Kabel', step(5), ISO, 75, 68),
  // Pull
  ex('rudern-breit', 'Rudern breit', 'grundübung', '', step(2.5), SCHWER, 150, 90),
  ex('tbar-rudern', 'T-Bar-Rudern', 'grundübung', 'T-Bar', step(2.5), SCHWER, 150, 30),
  ex('latziehen-eng', 'Latziehen eng', 'grundübung', 'Kabel', step(5), MITTEL, 120, 59),
  ex('rudern-eng', 'Rudern eng', 'grundübung', '', step(2.5), MITTEL, 120, 45),
  ex('latziehen-breit', 'Latziehen breit', 'grundübung', 'Kabel', step(5), MITTEL, 120, 54),
  ex('hyperextensions', 'Hyperextensions', 'isolation', 'Körpergewicht', bw, ISO, 90, null),
  ex('rear-delt-row', 'Rear Delt Row', 'isolation', '', step(2.5), ISO, 75, 3.4),
  ex('reverse-butterfly', 'Reverse Butterfly', 'isolation', 'Maschine', step(2.5), ISO, 75, 45),
  ex('preacher-curls', 'Preacher Curls einarmig, Kurzhantel', 'isolation', 'Kurzhantel', list(KH_CURLS), KH_CURL, 75, 12.5),
  ex('hammercurls', 'Hammercurls', 'isolation', 'Kurzhantel', list(KH_CURLS), KH_CURL, 75, null),
  // Unterkörper
  ex('kreuzheben', 'Kreuzheben', 'grundübung', 'Langhantel', step(2.5), SCHWER, 180, 50),
  ex('beinpresse-moemlingen', 'Beinpresse Mömlingen', 'grundübung', 'Maschine', step(2.5), SCHWER, 150, 145),
  ex('beinpresse-grosswallstadt', 'Beinpresse Großwallstadt', 'grundübung', 'Maschine', step(2.5), SCHWER, 150, 108),
  ex('beinbeuger-sitzend', 'Beinbeuger sitzend', 'isolation', 'Maschine', step(5), ISO, 90, 97,
    'Einstellung: Rücken 3, Oberschenkel 4, Fuß 3 und 6'),
  ex('beinbeuger-liegend', 'Beinbeuger liegend', 'isolation', 'Maschine', step(5), ISO, 90, 54),
  ex('beinstrecker', 'Beinstrecker', 'isolation', 'Maschine', step(5), ISO, 90, 91),
  ex('hip-thrust', 'Hip Thrust', 'grundübung', '', step(2.5), MITTEL, 120, 30),
  ex('wadenheben-stehend', 'Wadenheben stehend', 'isolation', 'Maschine', step(5), ISO, 60, 100),
  ex('wadenheben-beinpresse', 'Wadenheben an der Beinpresse', 'isolation', 'Maschine', step(2.5), ISO, 60, 136),
  // Oberkörper A
  ex('rudern', 'Rudern', 'grundübung', '', step(2.5), SCHWER, 150, 50),
  ex('klimmzuege', 'Klimmzüge', 'grundübung', 'Körpergewicht', bw, SCHWER, 120, 0),
  ex('incline-curls', 'Incline Curls Kurzhantel', 'isolation', 'Kurzhantel', list(KH_CURLS), KH_CURL, 75, 10),
  ex('trizeps-ueberkopf-kabel', 'Trizeps überkopf Kabel', 'isolation', 'Kabel', step(5), ISO, 75, 59),
];

const slot = (id: string, category: string, sets: number, ...variantIds: string[]) => ({
  id,
  category,
  sets,
  variantIds,
});

export const SEED_DAYS: WorkoutDay[] = [
  {
    id: 'pull',
    name: 'Pull',
    weekdays: [1],
    active: true,
    order: 0,
    slots: [
      slot('pull-1', 'Horizontale Zugbewegung breit', 3, 'rudern-breit', 'tbar-rudern'),
      slot('pull-2', 'Vertikale Zugbewegung eng', 3, 'latziehen-eng'),
      slot('pull-3', 'Horizontale Zugbewegung eng', 2, 'rudern-eng'),
      slot('pull-4', 'Vertikale Zugbewegung breit', 2, 'latziehen-breit'),
      slot('pull-5', 'Unterer Rücken', 3, 'hyperextensions'),
      slot('pull-6', 'Hintere Schulter', 3, 'rear-delt-row', 'reverse-butterfly'),
      slot('pull-7', 'Bizeps', 3, 'preacher-curls'),
      slot('pull-8', 'Bizeps 2', 2, 'hammercurls'),
    ],
  },
  {
    id: 'push',
    name: 'Push',
    weekdays: [2],
    active: true,
    order: 1,
    slots: [
      slot('push-1', 'Horizontale Druckbewegung', 3, 'bankdruecken'),
      slot('push-2', 'Schrägbank', 3, 'schraegbank'),
      slot('push-3', 'Vertikale Druckbewegung', 2, 'schulterdruecken-maschine', 'schulterdruecken-kh'),
      slot('push-4', 'Seitheben', 4, 'seitheben'),
      slot('push-5', 'Fly', 2, 'kabel-fly'),
      slot('push-6', 'Trizeps', 3, 'trizeps-kabel-dreieck'),
    ],
  },
  {
    id: 'unterkoerper',
    name: 'Unterkörper',
    weekdays: [4],
    active: false,
    order: 2,
    slots: [
      slot('uk-1', 'Kreuzhebevariation', 3, 'kreuzheben'),
      slot('uk-2', 'Beinpresse', 3, 'beinpresse-moemlingen', 'beinpresse-grosswallstadt'),
      slot('uk-3', 'Beinbeuger', 3, 'beinbeuger-sitzend', 'beinbeuger-liegend'),
      slot('uk-4', 'Beinstrecker', 2, 'beinstrecker'),
      slot('uk-5', 'Hip Thrust', 3, 'hip-thrust'),
      slot('uk-6', 'Waden', 4, 'wadenheben-stehend', 'wadenheben-beinpresse'),
    ],
  },
  {
    id: 'oberkoerper-a',
    name: 'Oberkörper A',
    weekdays: [6],
    active: true,
    order: 3,
    slots: [
      slot('oka-1', 'Horizontale Druckbewegung', 3, 'bankdruecken'),
      slot('oka-2', 'Horizontale Zugbewegung', 3, 'rudern'),
      slot('oka-3', 'Vertikale Druckbewegung', 3, 'schulterdruecken-maschine'),
      slot('oka-4', 'Vertikale Zugbewegung', 2, 'latziehen-breit', 'klimmzuege'),
      slot('oka-5', 'Seitheben', 4, 'seitheben'),
      slot('oka-6', 'Bizeps', 3, 'incline-curls'),
      slot('oka-7', 'Trizeps', 3, 'trizeps-ueberkopf-kabel'),
    ],
  },
];

export const SEED_REST_DAY_NOTES: RestDayNotes = {
  '3': 'Fußball ⚽',
  '5': 'Fußball ⚽',
  '0': 'Fußball ⚽',
};

/** Spielt beim allerersten Start den Trainingsplan ein. */
export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', db.exercises, db.days, db.meta, async () => {
    if (await db.meta.get('seeded')) return;
    await db.exercises.bulkPut(SEED_EXERCISES);
    await db.days.bulkPut(SEED_DAYS);
    await db.meta.put({ key: 'restDayNotes', value: SEED_REST_DAY_NOTES });
    await db.meta.put({ key: 'seeded', value: true });
  });
}
