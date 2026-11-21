import type { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
}

export function Header({ title, subtitle, onBack, right }: Props) {
  return (
    <header className="header">
      <div className="header-row">
        {onBack && (
          <button className="btn-icon back" onClick={onBack} aria-label="Zurück">
            ‹
          </button>
        )}
        <div className="header-titles">
          <h1>{title}</h1>
          {subtitle && <div className="header-sub">{subtitle}</div>}
        </div>
        {right && <div className="header-right">{right}</div>}
      </div>
    </header>
  );
}
