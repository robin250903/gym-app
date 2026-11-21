import { useEffect, useRef, useState } from 'react';
import { fmtShortDate } from '../lib/format';

interface Point {
  x: number; // Timestamp
  y: number;
}

interface Props {
  title: string;
  points: Point[];
  format: (y: number) => string;
  height?: number;
}

/**
 * Schlankes SVG-Liniendiagramm (eine Serie) – bewusst ohne Chart-Bibliothek,
 * damit die App klein bleibt. Antippen/Ziehen zeigt den Wert des nächsten Punkts.
 */
export function LineChart({ title, points, format, height = 170 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = { l: 44, r: 12, t: 12, b: 24 };
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;

  const ys = points.map((p) => p.y);
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (!points.length) {
    min = 0;
    max = 1;
  }
  if (max - min < 1e-9) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  min -= span * 0.1;
  max += span * 0.1;

  // gleichmäßige Abstände pro Training (lesbarer als echte Zeitachse bei unregelmäßigen Abständen)
  const xAt = (i: number) => pad.l + (points.length <= 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const yAt = (v: number) => pad.t + ih - ((v - min) / (max - min)) * ih;

  const ticks = [0, 0.5, 1].map((f) => min + (max - min) * f);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(p.y).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const shown = hover ?? (points.length ? points.length - 1 : null);

  const pick = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || !points.length) return;
    const x = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(xAt(i) - x) < Math.abs(xAt(best) - x)) best = i;
    setHover(best);
  };

  return (
    <figure className="chart">
      <figcaption className="chart-head">
        <span className="chart-title">{title}</span>
        {shown != null && points[shown] && (
          <span className="chart-value">
            {format(points[shown].y)} <span className="muted">· {fmtShortDate(points[shown].x)}</span>
          </span>
        )}
      </figcaption>
      <div
        ref={ref}
        className="chart-body"
        onPointerDown={(e) => pick(e.clientX)}
        onPointerMove={(e) => e.buttons && pick(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        {points.length === 0 ? (
          <div className="chart-empty muted">Noch keine Daten</div>
        ) : (
          <svg width={width} height={height} role="img" aria-label={`${title}, letzter Wert ${last ? format(last.y) : ''}`}>
            {ticks.map((t, i) => (
              <g key={i}>
                <line x1={pad.l} x2={width - pad.r} y1={yAt(t)} y2={yAt(t)} className="chart-grid" />
                <text x={pad.l - 6} y={yAt(t) + 4} className="chart-axis" textAnchor="end">
                  {format(t).replace(/\s?kg$/, '')}
                </text>
              </g>
            ))}
            <text x={pad.l} y={height - 6} className="chart-axis">
              {fmtShortDate(points[0].x)}
            </text>
            {points.length > 1 && (
              <text x={width - pad.r} y={height - 6} className="chart-axis" textAnchor="end">
                {fmtShortDate(last.x)}
              </text>
            )}
            {hover != null && (
              <line x1={xAt(hover)} x2={xAt(hover)} y1={pad.t} y2={pad.t + ih} className="chart-crosshair" />
            )}
            <path d={path} className="chart-line" />
            {points.map((p, i) => (
              <circle key={i} cx={xAt(i)} cy={yAt(p.y)} r={i === shown ? 5 : 3.5} className={`chart-dot ${i === shown ? 'active' : ''}`} />
            ))}
          </svg>
        )}
      </div>
    </figure>
  );
}
