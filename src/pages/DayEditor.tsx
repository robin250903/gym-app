import { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { db } from '../db/db';
import { useExerciseMap, useExercises } from '../db/hooks';
import { deleteDay, saveDay, saveExercise } from '../db/repo';
import type { Slot, WorkoutDay } from '../db/types';
import { uid, WEEKDAYS_SHORT, WEEK_ORDER } from '../lib/format';
import { navigate } from '../lib/router';
import { newExercise } from './ExerciseEditor';

const NEW_EXERCISE = '__neu__';

export function DayEditor({ id }: { id: string }) {
  const exercises = useExercises();
  const exMap = useExerciseMap();
  const [day, setDay] = useState<WorkoutDay | null | undefined>(undefined);

  useEffect(() => {
    void db.days.get(id).then((d) => setDay(d ?? null));
  }, [id]);

  if (day === undefined || !exercises || !exMap) return <div className="page" />;
  if (day === null) {
    return (
      <div className="page">
        <Header title="Trainingstag" onBack={() => navigate('einstellungen')} />
        <p className="muted center">Trainingstag nicht gefunden.</p>
      </div>
    );
  }

  const patch = (p: Partial<WorkoutDay>) => {
    const next = { ...day, ...p };
    setDay(next);
    void saveDay(next);
  };
  const patchSlot = (slotId: string, p: Partial<Slot>) =>
    patch({ slots: day.slots.map((s) => (s.id === slotId ? { ...s, ...p } : s)) });
  const moveSlot = (idx: number, dir: -1 | 1) => {
    const slots = [...day.slots];
    const j = idx + dir;
    if (j < 0 || j >= slots.length) return;
    [slots[idx], slots[j]] = [slots[j], slots[idx]];
    patch({ slots });
  };

  const addVariant = async (slot: Slot, value: string) => {
    if (!value) return;
    let exId = value;
    if (value === NEW_EXERCISE) {
      const name = prompt('Name der neuen Übung?')?.trim();
      if (!name) return;
      const ex = newExercise(name);
      await saveExercise(ex);
      exId = ex.id;
    }
    if (!slot.variantIds.includes(exId)) patchSlot(slot.id, { variantIds: [...slot.variantIds, exId] });
  };

  const remove = async () => {
    if (!confirm(`Trainingstag „${day.name}“ löschen? Bisherige Trainings bleiben im Verlauf erhalten.`)) return;
    await deleteDay(day.id);
    navigate('einstellungen', true);
  };

  return (
    <div className="page">
      <Header title={day.name || 'Trainingstag'} onBack={() => navigate('einstellungen')} />

      <section className="card form">
        <label className="field">
          <span className="field-label">Name</span>
          <input type="text" value={day.name} onChange={(e) => patch({ name: e.target.value })} />
        </label>

        <div className="field">
          <span className="field-label">Wochentage</span>
          <div className="chips">
            {WEEK_ORDER.map((w) => {
              const on = day.weekdays.includes(w);
              return (
                <button
                  key={w}
                  className={`chip day ${on ? 'active' : ''}`}
                  aria-pressed={on}
                  onClick={() => patch({ weekdays: on ? day.weekdays.filter((x) => x !== w) : [...day.weekdays, w] })}
                >
                  {WEEKDAYS_SHORT[w]}
                </button>
              );
            })}
          </div>
        </div>

        <label className="toggle">
          <input type="checkbox" checked={day.active} onChange={(e) => patch({ active: e.target.checked })} />
          <span>{day.active ? 'Aktiv' : 'Pausiert – wird nie als „heute dran“ vorgeschlagen'}</span>
        </label>
      </section>

      <h2 className="section-title">Übungen / Slots</h2>
      {day.slots.map((slot, i) => (
        <section key={slot.id} className="card form slot-card">
          <div className="slot-head">
            <span className="slot-num">{i + 1}</span>
            <input
              type="text"
              className="slot-category"
              value={slot.category}
              placeholder="Bewegungskategorie"
              onChange={(e) => patchSlot(slot.id, { category: e.target.value })}
            />
            <button className="btn-icon" disabled={i === 0} onClick={() => moveSlot(i, -1)} aria-label="Nach oben">
              ↑
            </button>
            <button className="btn-icon" disabled={i === day.slots.length - 1} onClick={() => moveSlot(i, 1)} aria-label="Nach unten">
              ↓
            </button>
          </div>

          <div className="field inline">
            <span className="field-label">Arbeitssätze</span>
            <div className="mini-stepper">
              <button className="btn-icon" onClick={() => patchSlot(slot.id, { sets: Math.max(1, slot.sets - 1) })} aria-label="Weniger Sätze">
                −
              </button>
              <strong>{slot.sets}</strong>
              <button className="btn-icon" onClick={() => patchSlot(slot.id, { sets: Math.min(10, slot.sets + 1) })} aria-label="Mehr Sätze">
                +
              </button>
            </div>
          </div>

          <div className="field">
            <span className="field-label">Varianten</span>
            {slot.variantIds.length === 0 && <p className="warning">Keine Übung – dieser Slot wird beim Training übersprungen.</p>}
            {slot.variantIds.map((vid) => (
              <div key={vid} className="variant-row">
                <button className="variant-name" onClick={() => navigate(`einstellungen/uebung/${vid}`)}>
                  {exMap.get(vid)?.name ?? 'Unbekannte Übung'} ›
                </button>
                <button
                  className="btn-icon"
                  aria-label="Variante entfernen"
                  onClick={() => patchSlot(slot.id, { variantIds: slot.variantIds.filter((x) => x !== vid) })}
                >
                  ✕
                </button>
              </div>
            ))}
            <select value="" onChange={(e) => void addVariant(slot, e.target.value)}>
              <option value="">+ Variante hinzufügen …</option>
              <option value={NEW_EXERCISE}>Neue Übung anlegen …</option>
              {exercises
                .filter((e) => !slot.variantIds.includes(e.id))
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </select>
          </div>

          <button
            className="btn small danger-ghost"
            onClick={() => confirm(`Slot „${slot.category || i + 1}“ entfernen?`) && patch({ slots: day.slots.filter((s) => s.id !== slot.id) })}
          >
            Slot entfernen
          </button>
        </section>
      ))}

      <button
        className="btn ghost block"
        onClick={() => patch({ slots: [...day.slots, { id: uid(), category: '', sets: 3, variantIds: [] }] })}
      >
        + Slot hinzufügen
      </button>

      <button className="btn danger-ghost block" onClick={remove}>
        Trainingstag löschen
      </button>
    </div>
  );
}
