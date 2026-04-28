/*
 * components/DeviationBanner.js
 * ─────────────────────────────────────────────────────────
 * PHASE 2 + 3 — Full-width deviation row, sits between TopBar
 * and the main grid. Visible only when the current play is a
 * count-driven deviation from basic strategy.
 *
 * Shows:
 *   • Hand vs dealer upcard
 *   • Basic-strategy action → deviated action (with arrow)
 *   • Trigger threshold (TC ≥ X / TC < X)
 *   • Live TC value + delta to threshold
 *
 * Props:
 *   recommendation — { action, basic_action, is_deviation,
 *                      deviation_info: { description, tc_threshold,
 *                                        direction, description_short } }
 *   count          — { true, effective_true }
 *   playerHand     — { value, is_soft, is_pair, cards }
 *   dealerUpcard   — string e.g. "10" "A"
 */

function DeviationBanner({ recommendation, count, playerHand, dealerUpcard }) {
  if (!recommendation || !recommendation.is_deviation) return null;

  const dev = recommendation.deviation_info || {};
  const action      = recommendation.action;
  const basicAction = recommendation.basic_action;

  // Use effective_true so KO deviations match the right reading
  const tc = (count && (typeof count.effective_true === 'number'
              ? count.effective_true : count.true)) || 0;

  const thr = (typeof dev.tc_threshold === 'number') ? dev.tc_threshold : 0;
  const dir = dev.direction || '>=';
  const triggered = dir === '>=' ? tc >= thr : tc < thr;
  const delta = dir === '>=' ? (tc - thr) : (thr - tc);

  // Hand label
  const pv = playerHand && playerHand.value;
  const isSoft = playerHand && playerHand.is_soft;
  const isPair = playerHand && playerHand.is_pair;
  let handLabel = '—';
  if (pv) {
    if (isPair && playerHand.cards && playerHand.cards[0]) {
      const r = playerHand.cards[0].rank || playerHand.cards[0];
      handLabel = `${r}/${r}`;
    } else if (isSoft) {
      handLabel = `Soft ${pv}`;
    } else {
      handLabel = `Hard ${pv}`;
    }
  }

  const upRank = dealerUpcard
    ? String(dealerUpcard).replace(/[♠♥♦♣]/g, '').trim().toUpperCase()
    : '?';

  // Action color tokens (kept consistent with ActionPanel)
  const AC = {
    HIT: 'var(--jade)', STAND: 'var(--sapph)', DOUBLE: 'var(--amber)',
    'DOUBLE DOWN': 'var(--amber)', SPLIT: 'var(--ameth)', SURRENDER: 'var(--ruby)',
  };
  const actCol  = AC[action]      || 'var(--text-0)';
  const baseCol = AC[basicAction] || 'var(--text-2)';

  return (
    <div
      role="status"
      aria-label={`Deviation: ${handLabel} vs ${upRank}, ${basicAction || 'basic'} to ${action} at TC ${dir} ${thr}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
        padding: 'var(--space-2) var(--space-4)',
        background: 'var(--surface-raised)',
        borderTop: 'var(--border-w) solid var(--ameth)',
        borderBottom: 'var(--border-w) solid var(--ameth)',
        borderLeft: '4px solid var(--ameth)',
        color: 'var(--text-0)',
      }}
    >
      {/* DEV badge */}
      <div style={{
        flexShrink: 0,
        fontSize: 10, fontWeight: 900, letterSpacing: '0.18em',
        textTransform: 'uppercase',
        padding: '4px 10px', borderRadius: 6,
        background: 'rgba(185,155,255,0.25)',
        border: '1px solid rgba(185,155,255,0.7)',
        color: '#d4c0ff', fontFamily: 'var(--font-mono)',
      }}>
        ⚡ DEV
      </div>

      {/* Hand vs upcard */}
      <div style={{
        flexShrink: 0, fontSize: 13, fontWeight: 700,
        fontFamily: 'var(--font-mono)', color: 'var(--text-1)',
        letterSpacing: '0.04em',
      }}>
        {handLabel} <span style={{ color: 'var(--text-2)' }}>vs</span> {upRank}
      </div>

      {/* Basic → Deviated transition */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: 'var(--font-display)',
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700,
          textDecoration: 'line-through',
          color: baseCol, opacity: 0.7,
          letterSpacing: '0.04em',
        }}>
          {basicAction || '—'}
        </span>
        <span aria-hidden="true" style={{ fontSize: 12, color: 'var(--ameth)' }}>→</span>
        <span style={{
          fontSize: 15, fontWeight: 900,
          color: actCol, letterSpacing: '0.04em',
          textShadow: `0 0 8px ${actCol}33`,
        }}>
          {action}
        </span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Trigger + live TC + delta */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
        fontSize: 11, fontFamily: 'var(--font-mono)',
      }}>
        <div style={{ color: 'var(--text-2)' }}>
          Trigger:
          <span style={{ marginLeft: 5, fontWeight: 800, color: '#d4c0ff' }}>
            TC {dir} {thr >= 0 && dir === '>=' ? '+' : ''}{thr}
          </span>
        </div>
        <div style={{ color: 'var(--text-2)' }}>
          Now:
          <span style={{
            marginLeft: 5, fontWeight: 900,
            color: triggered ? 'var(--jade)' : 'var(--amber)',
          }}>
            {tc >= 0 ? '+' : ''}{tc.toFixed(1)}
          </span>
        </div>
        <div style={{
          padding: '3px 8px', borderRadius: 5,
          background: triggered ? 'rgba(68,232,130,0.12)' : 'rgba(255,154,32,0.12)',
          border: `1px solid ${triggered ? 'rgba(68,232,130,0.4)' : 'rgba(255,154,32,0.4)'}`,
          color:  triggered ? 'var(--jade)' : 'var(--amber)',
          fontWeight: 800, letterSpacing: '0.04em',
        }}>
          {triggered ? 'ACTIVE' : `Δ ${Math.abs(delta).toFixed(1)}`}
        </div>
      </div>
    </div>
  );
}


// PHASE 7 T4 — React.memo wrap. Script-mode reassignment of the
// function declaration keeps `function DeviationBanner(` intact for the
// build.sh smoke check while routing all consumers through memo.
if (typeof React !== 'undefined' && React.memo) {
  DeviationBanner = React.memo(DeviationBanner);
}
