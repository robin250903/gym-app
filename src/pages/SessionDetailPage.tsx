import { useCallback, useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { NumInput } from '../components/NumInput';
import { db } from '../db/db';
import { useExerciseMap, useSessions } from '../db/hooks';
import { deleteSession, saveSession } from '../db/repo';
import type { Session, SessionBlock } from '../db/types';
import { fmtDate, fmtDuration, fmtInt, fmtTime, fmtWeight, uid } from '../lib/format';
import { navigate } from '../lib/router';
import { doneSets, exerciseHistory, sessionVolume } from '../logic/history';
import { detectRecords } from '../logic/records';

export function SessionDetailPage({ id }: { id: string }) {
  const sessions = useSessions();
  const exercises = useExerciseMap();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    void db.sessions.get(id).then((s) => setSession(s ?? null));
  }, [id]);

  const update = useCallback((fn: (s: Session) => Session) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      void saveSession(next);
      return next;
    });
  }, []);

  const updateBlock = (blockId: string, fn: (b: SessionBlock) => SessionBlock) =>
    update((s) => ({ ...s, blocks: s.blocks.map((b) => (b.id === blockId ? fn(b) : b)) }));

  if (session === undefined || !sessions || !exercises) return <div className="page" />;
  if (session === null) {
    return (
      <div className="page">
        <Header title="Training" onBack={() => navigate('verlauf')} />
        <p className="muted center">Training nicht gefunden.</p>
      </div>
    );
  }

  const remove = async () => {
    if (!confirm(`Training „${session.dayName}“ vom ${fmtDate(session.startedAt)} wirklich löschen? Das kann nicht rückgängig gemacht werden.`)) return;
    await deleteSession(session.id);
    navigate('verlauf', true);
  };

  const finishEditing = () => {
    // leere Übungen entfernen
    update((s) => ({ ...s, blocks: s.blocks.filter((b) => b.sets.length > 0) }));
    setEditing(false);
  };

  return (
    <div className="page">
      <Header
        title={session.dayName}
        subtitle={`${fmtDate(session.startedAt)} · ${fmtTime(session.startedAt)} · ${fmtDuration((session.endedAt ?? session.startedAt) - session.startedAt)} · ${fmtInt(sessionVolume(session))} kg`}
        onBack={() => navigate('verlauf')}
        right={
          editing ? (
            <button className="btn small accent" onClick={finishEditing}>
              Fertig
            </button>
          ) : (
            <button className="btn small" onClick={() => setEditing(true)}>
              Bearbeiten
            </button>
          )
        }
      />

      {session.blocks.map((b) => {
        const ex = exercises.get(b.exerciseId);
        const prior = exerciseHistory(sessions, b.exerciseId, session.id, session.startedAt).flatMap((h) => h.sets);
        const recs = detectRecords(prior, b.sets.map((s) => (s.done && s.reps != null ? { weight: s.weight, reps: s.reps } : null)));
        return (
          <section key={b.id} className="block-card">
            <div className="block-titles">
              {b.category && <div className="block-category">{b.category}</div>}
              <h3 className="block-name">{ex?.name ?? b.exerciseName}</h3>
            </div>
            <div className="sets">
              {b.sets.map((s, i) =>
                editing ? (
                  <div key={s.id} className="set-row edit">
                    <span className="set-idx">{i + 1}</span>
                    <NumInput
                      value={s.weight}
                      onChange={(w) => updateBlock(b.id, (bb) => ({ ...bb, sets: bb.sets.map((x) => (x.id === s.id ? { ...x, weight: w } : x)) }))}
                      suffix="kg"
                    />
                    <span className="times">×</span>
                    <NumInput
                      integer
                      value={s.reps}
                      onChange={(r) => updateBlock(b.id, (bb) => ({ ...bb, sets: bb.sets.map((x) => (x.id === s.id ? { ...x, reps: r } : x)) }))}
                      suffix="Wdh"
                    />
                    <button
                      className="check remove"
                      aria-label={`Satz ${i + 1} löschen`}
                      onClick={() => updateBlock(b.id, (bb) => ({ ...bb, sets: bb.sets.filter((x) => x.id !== s.id) }))}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div key={s.id} className="set-line">
                    <span className="set-idx">{recs[i]?.length ? '🏆' : i + 1}</span>
                    <span>
                      {fmtWeight(s.weight, ex?.weightMode)} × {s.reps ?? '?'}
                    </span>
                  </div>
                ),
              )}
            </div>
            {editing && (
              <button
                className="btn small ghost"
                onClick={() =>
                  updateBlock(b.id, (bb) => {
                    const last = bb.sets[bb.sets.length - 1];
                    return { ...bb, sets: [...bb.sets, { id: uid(), weight: last?.weight ?? null, reps: last?.reps ?? null, done: true }] };
                  })
                }
              >
                + Satz
              </button>
            )}
            {!editing && doneSets(b.sets).length === 0 && <p className="muted">Keine Sätze</p>}
          </section>
        );
      })}

      <button className="btn danger-ghost block" onClick={remove}>
        Training löschen
      </button>
    </div>
  );
}
