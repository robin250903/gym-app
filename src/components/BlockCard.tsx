import { useMemo, useState } from 'react';
import type { Exercise, SessionBlock, SetEntry } from '../db/types';
import { fmtClock, fmtDate, fmtSets, uid } from '../lib/format';
import type { ExerciseSessionEntry } from '../logic/history';
import { suggest, type TargetSet } from '../logic/progression';
import { detectRecords, RECORD_LABEL } from '../logic/records';
import { stepDown, stepUp } from '../logic/weights';
import { NumInput } from './NumInput';

interface Props {
  block: SessionBlock;
  exercise: Exercise | undefined;
  variants: Exercise[];
  /** Verlauf dieser Übung ohne das laufende Training, neuestes zuerst */
  history: ExerciseSessionEntry[];
  onUpdate: (fn: (b: SessionBlock) => SessionBlock) => void;
  onSwitchVariant: (exerciseId: string) => void;
  onSetDone: (exercise: Exercise) => void;
}

const FALLBACK_MODE = { kind: 'schritt', step: 2.5 } as const;

export function BlockCard({ block, exercise, variants, history, onUpdate, onSwitchVariant, onSetDone }: Props) {
  const mode = exercise?.weightMode ?? FALLBACK_MODE;
  const [selected, setSelected] = useState<number | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [usingHold, setUsingHold] = useState(false);

  const suggestion = useMemo(
    () =>
      exercise
        ? suggest({
            repMin: exercise.repMin,
            repMax: exercise.repMax,
            weightMode: exercise.weightMode,
            startWeight: exercise.startWeight,
            sets: block.plannedSets,
            history: history.map((h) => h.sets),
          })
        : null,
    [exercise, history, block.plannedSets],
  );

  const records = useMemo(
    () =>
      detectRecords(
        history.flatMap((h) => h.sets),
        block.sets.map((s) => (s.done && s.reps != null ? { weight: s.weight, reps: s.reps } : null)),
      ),
    [history, block.sets],
  );

  const firstOpen = block.sets.findIndex((s) => !s.done);
  const active = selected ?? (firstOpen >= 0 ? firstOpen : null);
  const doneCount = block.sets.filter((s) => s.done).length;

  const patchSet = (i: number, patch: Partial<SetEntry>) =>
    onUpdate((b) => ({ ...b, sets: b.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  const toggleDone = (i: number) => {
    const s = block.sets[i];
    if (s.done) {
      patchSet(i, { done: false });
      setSelected(i);
      return;
    }
    let weight = s.weight;
    if (weight == null) {
      if (mode.kind === 'koerpergewicht') weight = 0;
      else {
        setSelected(i);
        alert('Bitte zuerst das Gewicht eintragen.');
        return;
      }
    }
    const reps = s.reps ?? suggestion?.sets[i]?.reps ?? exercise?.repMin ?? 0;
    patchSet(i, { done: true, weight, reps });
    setSelected(null);
    if (exercise) onSetDone(exercise);
  };

  const applyTargets = (targets: TargetSet[]) =>
    onUpdate((b) => ({
      ...b,
      sets: b.sets.map((s, i) => (s.done || !targets[i] ? s : { ...s, weight: targets[i].weight, reps: targets[i].reps })),
    }));

  const addSet = () =>
    onUpdate((b) => {
      const last = b.sets[b.sets.length - 1];
      const target = suggestion?.sets[b.sets.length] ?? suggestion?.sets[suggestion.sets.length - 1];
      return {
        ...b,
        sets: [
          ...b.sets,
          { id: uid(), weight: last?.weight ?? target?.weight ?? null, reps: target?.reps ?? last?.reps ?? null, done: false },
        ],
      };
    });

  const removeSet = () => {
    if (block.sets.length === 0) return;
    let idx = -1;
    for (let i = block.sets.length - 1; i >= 0; i--) if (!block.sets[i].done) { idx = i; break; }
    if (idx < 0) {
      if (!confirm('Alle Sätze sind erledigt. Letzten Satz trotzdem entfernen?')) return;
      idx = block.sets.length - 1;
    }
    setSelected(null);
    onUpdate((b) => ({ ...b, sets: b.sets.filter((_, i) => i !== idx) }));
  };

  const last = history[0];
  const allDone = block.sets.length > 0 && doneCount === block.sets.length;

  return (
    <section className={`block-card ${allDone ? 'complete' : ''}`}>
      <div className="block-head">
        <div className="block-titles">
          {block.category && <div className="block-category">{block.category}</div>}
          <h3 className="block-name">{exercise?.name ?? block.exerciseName}</h3>
          {exercise && (
            <div className="block-meta">
              {exercise.repMin}–{exercise.repMax} Wdh · Pause {fmtClock(exercise.restSec)}
            </div>
          )}
        </div>
        <div className="block-progress">
          {doneCount}/{block.sets.length}
        </div>
      </div>

      {variants.length > 1 && (
        <div className="chips" role="radiogroup" aria-label="Variante">
          {variants.map((v) => (
            <button
              key={v.id}
              role="radio"
              aria-checked={v.id === block.exerciseId}
              className={`chip ${v.id === block.exerciseId ? 'active' : ''}`}
              onClick={() => v.id !== block.exerciseId && onSwitchVariant(v.id)}
            >
              {v.name}
            </button>
          ))}
        </div>
      )}

      {exercise?.notes && (
        <button className="notes-toggle" onClick={() => setShowNotes((v) => !v)}>
          {showNotes ? '▾' : '▸'} Notiz
        </button>
      )}
      {showNotes && exercise?.notes && <div className="notes">{exercise.notes}</div>}

      <div className="last-time">
        <span className="label">Letztes Mal</span>
        {last ? (
          <>
            <span className="value">{fmtSets(last.sets, mode)}</span>
            <span className="date">{fmtDate(last.session.startedAt)}</span>
          </>
        ) : (
          <span className="value muted">–</span>
        )}
      </div>

      {suggestion && (
        <div className={`target ${suggestion.kind}`}>
          <span className="label">Ziel heute</span>
          <span className="value">{fmtSets(usingHold && suggestion.hold ? suggestion.hold : suggestion.sets, mode)}</span>
          <span className="headline">{usingHold ? 'Gewicht beibehalten' : suggestion.headline}</span>
          {suggestion.hold && (
            <button
              className="btn small ghost"
              onClick={() => {
                const next = !usingHold;
                setUsingHold(next);
                applyTargets(next ? suggestion.hold! : suggestion.sets);
              }}
            >
              {usingHold ? 'Neues Gewicht nehmen' : 'Gewicht beibehalten'}
            </button>
          )}
          {suggestion.warning && <span className="warning">⚠︎ {suggestion.warning}</span>}
        </div>
      )}

      <div className="sets">
        {block.sets.map((s, i) => (
          <div key={s.id}>
            <div
              className={`set-row ${s.done ? 'done' : ''} ${i === active ? 'selected' : ''}`}
              onClick={() => setSelected(i)}
            >
              <span className="set-idx">{records[i]?.length ? '🏆' : i + 1}</span>
              <NumInput
                value={s.weight}
                onChange={(w) => patchSet(i, { weight: w })}
                suffix={mode.kind === 'koerpergewicht' ? '+kg' : 'kg'}
                placeholder={mode.kind === 'koerpergewicht' ? '0' : '?'}
                ariaLabel={`Gewicht Satz ${i + 1}`}
              />
              <span className="times">×</span>
              <NumInput
                integer
                value={s.reps}
                onChange={(r) => patchSet(i, { reps: r })}
                suffix="Wdh"
                ariaLabel={`Wiederholungen Satz ${i + 1}`}
              />
              <button
                className={`check ${s.done ? 'on' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDone(i);
                }}
                aria-label={s.done ? `Satz ${i + 1} nicht erledigt` : `Satz ${i + 1} erledigt`}
              >
                ✓
              </button>
            </div>
            {records[i]?.length > 0 && (
              <div className="record-line">🏆 Neuer Rekord: {records[i].map((r) => RECORD_LABEL[r]).join(' · ')}</div>
            )}
            {i === active && (
              <div className="stepper-row">
                <button className="btn step" onClick={() => patchSet(i, { weight: stepDown(s.weight, mode) })}>
                  − kg
                </button>
                <button className="btn step" onClick={() => patchSet(i, { weight: stepUp(s.weight, mode) })}>
                  + kg
                </button>
                <button className="btn step" onClick={() => patchSet(i, { reps: Math.max(0, (s.reps ?? 0) - 1) })}>
                  − Wdh
                </button>
                <button className="btn step" onClick={() => patchSet(i, { reps: (s.reps ?? 0) + 1 })}>
                  + Wdh
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="block-actions">
        <button className="btn small ghost" onClick={addSet}>
          + Satz
        </button>
        <button className="btn small ghost" onClick={removeSet} disabled={block.sets.length === 0}>
          − Satz
        </button>
      </div>
    </section>
  );
}
