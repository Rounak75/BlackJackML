/*
 * components/ActionPanel.js
 * ─────────────────────────────────────────────────────────
 * The primary AI recommendation panel.
 *
 * Shows:
 *   • Large coloured action text (HIT / STAND / DOUBLE / etc.)
 *   • Deviation badge when count overrides basic strategy
 *   • Basic strategy comparison row
 *   • Plain-English explanation of WHY the action was chosen
 *
 * Props:
 *   recommendation — rec object from server
 *   count          — count object from server
 */

function ActionPanel({ recommendation, count }) {
  const action = recommendation ? recommendation.action : null;
  const isDev  = recommendation && recommendation.is_deviation;
  const lines  = action ? buildExplanation(action, recommendation, count) : null;

  return (
    <Widget title="AI Recommendation" accent="var(--gold)">

      {/* Big action text */}
      <div className="my-4 text-center">
        <div
          className={`action-text-base ${action ? actionClass(action) : ''}`}
          style={{ fontSize: '2.6rem', lineHeight: 1, color: action ? undefined : '#7a8eab' }}
        >
          {action || 'DEAL CARDS'}
        </div>
        <div className="text-xs mt-2" style={{ color: '#b0bfd8' }}>
          {action
            ? `True Count: ${count ? count.true.toFixed(1) : '—'}`
            : 'Enter your hand and dealer upcard to get advice'}
        </div>
      </div>

      {/* Deviation badge */}
      {isDev && (
        <div className="mb-3 text-center">
          <span
            className="font-mono text-[10px] px-2.5 py-1 rounded-full font-semibold"
            style={{
              background: 'rgba(185,155,255,0.15)',
              border: '1px solid rgba(185,155,255,0.5)',
              color: '#b99bff',
            }}
          >
            DEVIATION — overriding basic strategy
          </span>
        </div>
      )}

      {/* Basic strategy comparison */}
      {recommendation && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10, marginTop: 4 }}>
          <KV label="Basic Strategy" value={recommendation.basic_action} />
          {isDev && recommendation.deviation_info && (
            <KV
              label="Deviation Trigger"
              value={recommendation.deviation_info.description_short || '—'}
              valueClass="text-gold"
            />
          )}
        </div>
      )}

      {/* Explanation */}
      {lines && lines.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10, marginTop: 10 }}>
          <div
            className="text-[10px] uppercase tracking-widest font-display font-bold mb-2"
            style={{ color: '#7a8eab' }}
          >
            Why this action?
          </div>
          {lines.map((line, i) => (
            <p key={i} className="text-xs leading-relaxed mb-1" style={{ color: '#b0bfd8' }}>
              {line}
            </p>
          ))}
        </div>
      )}
    </Widget>
  );
}
