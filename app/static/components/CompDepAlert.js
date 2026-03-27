/*
 * components/CompDepAlert.js
 * ─────────────────────────────────────────────────────────
 * Displays composition-dependent strategy explanation for Hard 16 vs 10.
 * Only renders when the current hand triggers this special case.
 *
 * Shown inline below the action recommendation — explains:
 *   10+6 → Stand at TC ≥ 0
 *   9+7  → Hit until TC ≥ +1
 *
 * Props:
 *   recommendation — the full recommendation object from server state
 *                    (must have recommendation.comp_dep_16)
 *   trueCount      — current true count (number)
 */

function CompDepAlert({ recommendation, trueCount }) {
  if (!recommendation?.comp_dep_16?.active) return null;

  const cd        = recommendation.comp_dep_16;
  const handType  = cd.hand_type;    // "10+6" or "9+7"
  const threshold = cd.threshold;    // 0 or 1
  const tc        = cd.tc;
  const standing  = tc >= threshold;
  const isTenSix  = handType === '10+6';

  return (
    <div style={{
      marginTop: 8,
      padding: '10px 12px',
      borderRadius: 8,
      background: standing ? 'rgba(68,232,130,0.08)' : 'rgba(106,175,255,0.08)',
      border: `1px solid ${standing ? 'rgba(68,232,130,0.3)' : 'rgba(106,175,255,0.3)'}`,
    }}
      role="status"
      aria-live="polite"
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 800,
          color: standing ? '#44e882' : '#6aafff',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          ⚗ Composition Adjustment Active
        </span>
      </div>

      {/* Hand type + rule */}
      <div style={{ marginBottom: 8 }}>
        <div style={{
          display: 'inline-block',
          padding: '2px 7px', borderRadius: 4, marginBottom: 5,
          background: 'rgba(255,255,255,0.07)',
          fontSize: 11, fontWeight: 700, fontFamily: 'DM Mono,monospace',
          color: '#f0f4ff',
        }}>
          {handType} vs 10
        </div>
        <div style={{ fontSize: 10, color: '#b8ccdf' }}>
          {isTenSix
            ? 'A 10-value removes a 10 from the remaining shoe, slightly reducing the TC threshold needed to stand.'
            : 'A 9 and 7 are mid-range cards — their removal raises the effective threshold for standing.'}
        </div>
      </div>

      {/* Both rules shown side-by-side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        {[
          { label: '10+6 vs 10', rule: 'Stand at TC ≥ 0', active: isTenSix },
          { label: '9+7  vs 10', rule: 'Hit until TC ≥ +1', active: !isTenSix },
        ].map(({ label, rule, active: isActive }) => (
          <div key={label} style={{
            padding: '6px 8px', borderRadius: 6,
            background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
            border: `1px solid ${isActive ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'}`,
            opacity: isActive ? 1 : 0.5,
          }}>
            <div style={{ fontSize: 9, fontFamily: 'DM Mono,monospace', color: '#94a7c4', marginBottom: 2 }}>
              {label}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#f0f4ff' }}>
              {rule}
            </div>
          </div>
        ))}
      </div>

      {/* Current decision explanation */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', borderRadius: 6,
        background: standing ? 'rgba(68,232,130,0.1)' : 'rgba(106,175,255,0.1)',
      }}>
        <span style={{ fontSize: 16 }}>{standing ? '🛑' : '👊'}</span>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 800,
            color: standing ? '#44e882' : '#6aafff',
          }}>
            {standing ? 'STAND' : 'HIT'}
          </div>
          <div style={{ fontSize: 9, color: '#94a7c4' }}>
            TC {tc >= 0 ? '+' : ''}{tc} {standing
              ? `≥ ${threshold >= 0 ? '+' : ''}${threshold} — stand condition met`
              : `< ${threshold >= 0 ? '+' : ''}${threshold} — count not yet strong enough`}
          </div>
        </div>
      </div>
    </div>
  );
}