/**
 * SmartPark - small shared presentational components.
 */

import { IconInfo, IconXCircle, IconCheckCircle, IconAlert } from '../data/icons.jsx';

export function Badge({ tone = 'mute', children, dot = false, pulse = false, className = '' }) {
  return (
    <span className={`badge badge-${tone} ${className}`}>
      {dot ? <i className={`dot ${pulse ? 'dot-pulse' : ''}`} /> : null}
      {children}
    </span>
  );
}

export function Card({ title, hint, icon, actions, children, bodyClass = '', className = '' }) {
  return (
    <section className={`card ${className}`}>
      {title ? (
        <header className="card-head">
          {icon ? <span className="nav-ico" style={{ color: 'var(--brand-2)' }}>{icon}</span> : null}
          <div style={{ minWidth: 0 }}>
            <h3>{title}</h3>
            {hint ? <div className="hint truncate">{hint}</div> : null}
          </div>
          {actions ? <div className="spacer" /> : null}
          {actions}
        </header>
      ) : null}
      <div className={`card-body ${bodyClass}`}>{children}</div>
    </section>
  );
}

export function StatCard({ icon, label, value, unit, foot, tone = 'brand', children }) {
  const map = {
    brand: ['var(--brand)', 'var(--brand-soft)'],
    cyan: ['#22d3ee', 'rgba(34,211,238,0.14)'],
    ok: ['#22c55e', 'var(--ok-soft)'],
    warn: ['#f59e0b', 'var(--warn-soft)'],
    danger: ['#ef4444', 'var(--danger-soft)'],
    violet: ['#a78bfa', 'var(--violet-soft)'],
  };
  const [accent, soft] = map[tone] || map.brand;

  return (
    <div className="stat" style={{ '--accent': accent, '--accent-soft': soft }}>
      <div className="stat-top">
        <span className="stat-ico">{icon}</span>
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value">
        {value}
        {unit ? <span className="unit">{unit}</span> : null}
      </div>
      {foot ? <div className="stat-foot">{foot}</div> : null}
      {children}
    </div>
  );
}

export function EmptyState({ icon, title, message, action }) {
  return (
    <div className="empty">
      <span className="empty-ico">{icon || <IconInfo size={22} />}</span>
      <h4>{title}</h4>
      {message ? <p>{message}</p> : null}
      {action}
    </div>
  );
}

export function Alert({ tone = 'info', children }) {
  const icon =
    tone === 'danger' ? <IconXCircle size={17} /> : tone === 'ok' ? <IconCheckCircle size={17} /> : tone === 'warn' ? <IconAlert size={17} /> : <IconInfo size={17} />;
  return (
    <div className={`alert alert-${tone}`}>
      <span style={{ flex: 'none', marginTop: 1 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function Meter({ value, max = 100, tone }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={`meter ${tone || ''}`}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Spinner({ large = false }) {
  return <span className={`spinner ${large ? 'spinner-lg' : ''}`} />;
}

export function Loading({ label = 'Loading' }) {
  return (
    <div className="center-screen">
      <Spinner large />
      <div className="small muted">{label}...</div>
    </div>
  );
}

export function Skeleton({ height = 16, width = '100%', style }) {
  return <div className="skeleton" style={{ height, width, ...style }} />;
}

export function KeyValue({ items }) {
  return (
    <dl className="kv">
      {items
        .filter(Boolean)
        .map((item) => (
          <div key={item.label} style={{ display: 'contents' }}>
            <dt>{item.label}</dt>
            <dd>{item.value ?? '—'}</dd>
          </div>
        ))}
    </dl>
  );
}

export function MiniStat({ items }) {
  return (
    <div className="mini-kv">
      {items.map((item) => (
        <div key={item.label}>
          <div className="k">{item.label}</div>
          <div className="v">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

/** The Indian number-plate chip, matching the physical plate design. */
export function Plate({ children, size = 'md', src }) {
  if (src) return <img className="plate-img" src={src} alt={children || 'number plate'} />;
  return <span className={`plate ${size === 'sm' ? 'plate-sm' : ''}`}>{children}</span>;
}
