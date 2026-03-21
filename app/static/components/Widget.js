/*
 * Widget.js — Reusable Panel Wrapper
 * ─────────────────────────────────────────────────────────────────────
 *
 * WHAT THIS FILE IS:
 *   A "Widget" is the dark-blue card container that wraps every dashboard
 *   panel. It provides a consistent title bar, optional badge, optional
 *   coloured left border, and ARIA landmark role for accessibility.
 *
 *   Think of it as a reusable box — every panel (ActionPanel, BettingPanel,
 *   ShoePanel etc.) calls Widget and puts its content inside.
 *
 * COMPONENTS IN THIS FILE:
 *   Widget  — the panel wrapper used by every dashboard panel
 *   KV      — a key/value row used inside widgets for label: value pairs
 *
 * HOW TO USE Widget:
 *   <Widget title="My Panel" accent="var(--gold)">
 *     <p>Content goes here</p>
 *   </Widget>
 *
 * PROPS:
 *   title      — text shown in the panel header (string)
 *   badge      — optional small label top-right (e.g. "KELLY", "LIVE")
 *   badgeColor — Tailwind text colour class for badge (default: text-ameth)
 *   accent     — CSS colour for left border stripe (e.g. "var(--gold)")
 *   className  — any extra Tailwind classes to apply to the wrapper div
 *   children   — any JSX content to render inside the panel
 *
 * ACCESSIBILITY:
 *   role="region" + aria-labelledby makes each panel a named landmark.
 *   Screen reader users can jump directly to any panel by name.
 */

function Widget({ title, badge, badgeColor = 'text-ameth', children, className = '', accent }) {

  // If accent colour is set, add a left border stripe in that colour
  const borderStyle = accent ? { borderLeft: `3px solid ${accent}` } : {};

  // Generate a stable DOM id from the title for ARIA labelling.
  // e.g. "AI Recommendation" → "wgt-ai-recommendation"
  // This connects the panel's <div> to its title <span> for screen readers.
  const headingId = title
    ? 'wgt-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    : undefined;

  return (
    <div
      className={`widget-card ${className}`}
      style={borderStyle}
      role="region"
      aria-labelledby={headingId}
    >
      {/* Panel header — only rendered if a title was passed */}
      {title && (
        <div className="flex items-center justify-between mb-3">
          <span id={headingId} className="widget-title">{title}</span>
          {badge && (
            <span
              className={`font-mono text-[9px] border rounded px-2 py-0.5 ${badgeColor} border-current/40`}
              style={{ background: 'rgba(255,255,255,0.05)' }}
              aria-label={`${title} status: ${badge}`}
            >
              {badge}
            </span>
          )}
        </div>
      )}
      {/* Panel content — whatever the parent passed as children */}
      {children}
    </div>
  );
}


/*
 * KV — Key/Value Row
 * ─────────────────────────────────────────────────────────────────────
 *
 * WHAT IT IS:
 *   A single row showing a label on the left and a value on the right.
 *   Used inside Widget panels for stats like "Kelly Bet: $40" or
 *   "Risk of Ruin: 2%".
 *
 * WHY <dt>/<dd>?
 *   These are the semantically correct HTML elements for a list of
 *   term/definition pairs. They tell screen readers that the label
 *   and value are connected as a concept, not just two random spans.
 *
 * PROPS:
 *   label      — left side text (the term / name)
 *   value      — right side text (the value / number)
 *   valueClass — optional CSS class to override the value colour
 *                (e.g. 'text-jade' for green, 'text-ruby' for red)
 */
function KV({ label, value, valueClass = '' }) {
  return (
    <div className="flex justify-between items-center py-1" style={{ fontSize: 12 }}>
      <dt style={{ color: '#ccdaec', fontWeight: 500 }}>{label}</dt>
      <dd
        className={`font-mono font-bold ${valueClass}`}
        style={{ color: valueClass ? undefined : '#ffffff', fontSize: 13, margin: 0 }}
      >
        {value}
      </dd>
    </div>
  );
}
