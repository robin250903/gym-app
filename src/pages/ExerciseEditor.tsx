import { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { NumInput } from '../components/NumInput';
import { db } from '../db/db';
import { useDays } from '../db/hooks';
import { deleteExercise, saveExercise } from '../db/repo';
import type { Exercise, ExerciseType, WeightMode } from '../db/types';
import { fmtNum, parseDecimal, uid } from '../lib/format';
import { navigate } from '../lib/router';

/** Standardwerte nach Übungstyp (siehe Plan, Abschnitt 5) */
export const TYPE_DEFAULTS: Record<ExerciseType, { repMin: number; repMax: number; restSec: number }> = {
  grundübung: { repMin: 6, repMax: 10, restSec: 150 },
  isolation: { repMin: 10, repMax: 15, restSec: 75 },
};

export function newExercise(name: string, type: ExerciseType = 'isolation'): Exercise {
  return {
    id: uid(),
    name,
    type,
    equipment: '',
    weightMode: { kind: 'schritt', step: 2.5 },
    ...TYPE_DEFAULTS[type],
    notes: '',
    startWeight: null,
  };
}

export function ExerciseEditor({ id }: { id: string }) {
  const days = useDays();
  const [ex, setEx] = useState<Exercise | null | undefined>(undefined);
  const [newWeight, setNewWeight] = useState('');

  useEffect(() => {
    void db.exercises.get(id).then((e) => setEx(e ?? null));
  }, [id]);

  if (ex === undefined || !days) return <div className="page" />;
  if (ex === null) {
    return (
      <div className="page">
        <Header title="Übung" onBack={() => navigate('einstellungen')} />
        <p className="muted center">Übung nicht gefunden.</p>
      </div>
    );
  }

  const patch = (p: Partial<Exercise>) => {
    const next = { ...ex, ...p };
    setEx(next);
    void saveExercise(next);
  };
  const setMode = (m: WeightMode) => patch({ weightMode: m });
  const usedIn = days.filter((d) => d.slots.some((s) => s.variantIds.includes(ex.id)));

  const remove = async () => {
    const where = usedIn.length ? `\n\nSie wird aus diesen Trainingstagen entfernt: ${usedIn.map((d) => d.name).join(', ')}.` : '';
    if (!confirm(`Übung „${ex.name}“ löschen?${where}\n\nBisherige Trainings bleiben im Verlauf erhalten.`)) return;
    await deleteExercise(ex.id);
    navigate('einstellungen', true);
  };

  const addListWeight = () => {
    if (ex.weightMode.kind !== 'liste') return;
    const w = parseDecimal(newWeight);
    if (w == null || w < 0) return;
    const weights = [...new Set([...ex.weightMode.weights, w])].sort((a, b) => a - b);
    setMode({ kind: 'liste', weights });
    setNewWeight('');
  };

  return (
    <div className="page">
      <Header title={ex.name || 'Übung'} onBack={() => navigate('einstellungen')} />

      <section className="card form">
        <label className="field">
          <span className="field-label">Name</span>
          <input type="text" value={ex.name} onChange={(e) => patch({ name: e.target.value })} />
        </label>

        <label className="field">
          <span className="field-label">Typ</span>
          <select value={ex.type} onChange={(e) => patch({ type: e.target.value as ExerciseType })}>
            <option value="grundübung">Grundübung</option>
            <option value="isolation">Isolation</option>
          </select>
        </label>
        <button
          className="btn small ghost"
          onClick={() => {
            if (confirm('Wdh-Bereich und Pause auf die Standardwerte des Typs setzen?')) patch(TYPE_DEFAULTS[ex.type]);
          }}
        >
          Standardwerte für {ex.type === 'grundübung' ? 'Grundübung' : 'Isolation'} übernehmen
        </button>

        <label className="field">
          <span className="field-label">Equipment</span>
          <input type="text" value={ex.equipment} placeholder="z. B. Langhantel, Kabel" onChange={(e) => patch({ equipment: e.target.value })} />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field-label">Wdh min</span>
            <NumInput integer value={ex.repMin} onChange={(v) => v != null && patch({ repMin: v })} />
          </label>
          <label className="field">
            <span className="field-label">Wdh max</span>
            <NumInput integer value={ex.repMax} onChange={(v) => v != null && patch({ repMax: v })} />
          </label>
          <label className="field">
            <span className="field-label">Pause</span>
            <NumInput integer value={ex.restSec} suffix="s" onChange={(v) => v != null && patch({ restSec: v })} />
          </label>
        </div>
        {ex.repMin > ex.repMax && <p className="warning">Wdh min ist größer als Wdh max.</p>}

        <label className="field">
          <span className="field-label">Gewichtsmodus</span>
          <select
            value={ex.weightMode.kind}
            onChange={(e) => {
              const k = e.target.value as WeightMode['kind'];
              if (k === 'liste') setMode({ kind: 'liste', weights: [10, 12.5, 15, 17.5] });
              else if (k === 'koerpergewicht') setMode({ kind: 'koerpergewicht', step: 2.5 });
              else setMode({ kind: 'schritt', step: 2.5 });
            }}
          >
            <option value="schritt">Fester Schritt (Langhantel, Steckgewicht)</option>
            <option value="liste">Liste verfügbarer Gewichte (Kurzhanteln)</option>
            <option value="koerpergewicht">Körpergewicht (+ Zusatzgewicht)</option>
          </select>
        </label>

        {ex.weightMode.kind !== 'liste' ? (
          <label className="field">
            <span className="field-label">{ex.weightMode.kind === 'koerpergewicht' ? 'Schritt Zusatzgewicht' : 'Schritt'}</span>
            <NumInput
              value={ex.weightMode.step}
              suffix="kg"
              onChange={(v) => v != null && v > 0 && setMode({ ...(ex.weightMode as { kind: 'schritt' | 'koerpergewicht'; step: number }), step: v })}
            />
          </label>
        ) : (
          <div className="field">
            <span className="field-label">Verfügbare Gewichte</span>
            <div className="chips wrap">
              {ex.weightMode.weights.map((w) => (
                <button
                  key={w}
                  className="chip active"
                  aria-label={`${fmtNum(w)} kg entfernen`}
                  onClick={() =>
                    ex.weightMode.kind === 'liste' &&
                    setMode({ kind: 'liste', weights: ex.weightMode.weights.filter((x) => x !== w) })
                  }
                >
                  {fmtNum(w)} kg ✕
                </button>
              ))}
            </div>
            <div className="add-row">
              <input
                type="text"
                inputMode="decimal"
                placeholder="z. B. 20"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addListWeight()}
              />
              <button className="btn" onClick={addListWeight}>
                Hinzufügen
              </button>
            </div>
          </div>
        )}

        <label className="field">
          <span className="field-label">
            Startgewicht {ex.weightMode.kind === 'koerpergewicht' ? '(Zusatz)' : ''} – nur solange es noch kein Training gibt
          </span>
          <NumInput value={ex.startWeight} suffix="kg" placeholder="offen" onChange={(v) => patch({ startWeight: v })} />
        </label>

        <label className="field">
          <span className="field-label">Notizen (z. B. Geräte-Einstellungen)</span>
          <textarea rows={3} value={ex.notes} onChange={(e) => patch({ notes: e.target.value })} />
        </label>

        <p className="muted small">
          {usedIn.length ? `Verwendet in: ${usedIn.map((d) => d.name).join(', ')}` : 'In keinem Trainingstag verwendet.'}
        </p>
      </section>

      <button className="btn danger-ghost block" onClick={remove}>
        Übung löschen
      </button>
    </div>
  );
}
