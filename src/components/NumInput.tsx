import { useEffect, useRef, useState } from 'react';
import { fmtNum, parseDecimal } from '../lib/format';

interface Props {
  value: number | null;
  onChange: (v: number | null) => void;
  /** Ganzzahlen (Wiederholungen) oder Dezimalzahlen (Gewicht) */
  integer?: boolean;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  suffix?: string;
}

/**
 * Zahlenfeld mit Komma- und Punkt-Unterstützung.
 * Hält den getippten Text lokal, damit Zwischenstände wie „12,“ möglich sind.
 */
export function NumInput({ value, onChange, integer, placeholder, className, ariaLabel, suffix }: Props) {
  const toText = (v: number | null) => (v == null ? '' : integer ? String(Math.round(v)) : fmtNum(v));
  const [text, setText] = useState(toText(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(toText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <label className={`num-input ${className ?? ''}`}>
      <input
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        enterKeyHint="done"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onFocus={(e) => {
          focused.current = true;
          e.currentTarget.select();
        }}
        onBlur={() => {
          focused.current = false;
          setText(toText(value));
        }}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          const n = parseDecimal(t);
          if (t.trim() === '') onChange(null);
          else if (n != null && n >= 0) onChange(integer ? Math.round(n) : n);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      {suffix && <span className="num-suffix">{suffix}</span>}
    </label>
  );
}
