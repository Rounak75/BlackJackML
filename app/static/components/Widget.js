/*
 * components/Widget.js
 * ─────────────────────────────────────────────────────────
 * Reusable panel/card wrapper used by every dashboard panel.
 *
 * Props:
 *   title      — header text (string)
 *   badge      — optional label shown top-right (string)
 *   badgeColor — Tailwind text class for badge (default: text-ameth)
 *   accent     — optional left-border colour (CSS colour string)
 *   className  — extra Tailwind classes
 *   children   — panel content
 */

function Widget({ title, badge, badgeColor = 'text-ameth', children, className = '', accent }) {
  const borderStyle = accent ? { borderLeft: `3px solid ${accent}` } : {};

  return (
    <div
      className={`widget-card ${className}`}
      style={borderStyle}
    >
      {title && (
        <div className="flex items-center justify-between mb-3">
          <span className="widget-title">{title}</span>
          {badge && (
            <span
              className={`font-mono text-[9px] border rounded px-2 py-0.5 ${badgeColor} border-current/40`}
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              {badge}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

/*
 * KV — key/value row used inside widgets for detail fields.
 *
 * Props:
 *   label      — left label text
 *   value      — right value text
 *   valueClass — extra class for value (e.g. colour override)
 */
function KV({ label, value, valueClass = '' }) {
  return (
    <div className="flex justify-between items-center text-xs py-1">
      <span style={{ color: '#b0bfd8' }}>{label}</span>
      <span className={`font-mono font-semibold ${valueClass}`} style={{ color: valueClass ? undefined : '#f0f4ff' }}>
        {value}
      </span>
    </div>
  );
}
