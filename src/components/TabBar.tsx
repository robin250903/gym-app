import { navigate } from '../lib/router';

const TABS = [
  { key: 'training', label: 'Training', icon: '🏋️' },
  { key: 'verlauf', label: 'Verlauf', icon: '📋' },
  { key: 'fortschritt', label: 'Fortschritt', icon: '📈' },
  { key: 'einstellungen', label: 'Einstellungen', icon: '⚙️' },
];

export function TabBar({ active }: { active: string }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`tab ${active === t.key ? 'active' : ''}`}
          onClick={() => navigate(t.key)}
          aria-current={active === t.key ? 'page' : undefined}
        >
          <span className="tab-icon" aria-hidden>
            {t.icon}
          </span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
