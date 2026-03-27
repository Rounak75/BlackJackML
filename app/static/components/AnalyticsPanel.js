/*
 * components/AnalyticsPanel.js
 * ─────────────────────────────────────────────────────────
 * Exposes two previously-hidden analytics features:
 *
 *   1. N₀ (Variance Convergence Tracker)
 *      N₀ = variance / edge²
 *      The number of hands needed for your EV to overcome 1 std-dev
 *      of variance. Lower N₀ = edge converges faster.
 *
 *   2. Shoe Quality Score (0–100)
 *      Composite score: TC (60%) + penetration (25%) + ace richness (15%)
 *      0–40   → Bad     (red)
 *      40–70  → Neutral (yellow)
 *      70–100 → Strong  (green)
 *
 * Props:
 *   analytics  — { n0: number|null, shoe_quality: number }  from server state
 */

function AnalyticsPanel({ analytics }) {
  if (!analytics) return null;

  const { n0, shoe_quality: sq } = analytics;

  // ── Shoe Quality colour ────────────────────────────────────────────────
  const sqColor  = sq >= 70 ? '#44e882' : sq >= 40 ? '#ffd447' : '#ff5c5c';
  const sqLabel  = sq >= 70 ? 'Strong'  : sq >= 40 ? 'Neutral' : 'Bad';
  const sqFill   = `${sq}%`;

  // ── N₀ display ─────────────────────────────────────────────────────────
  const n0Display = (n0 == null || n0 > 99999)
    ? '—'
    : n0.toLocaleString();
  const n0Sub = n0 == null
    ? 'Accumulating data…'
    : n0 > 99999
      ? 'Edge too small to measure'
      : n0 < 500
        ? 'Fast convergence ✓'
        : n0 < 2000
          ? 'Moderate convergence'
          : 'Slow convergence — variance dominant';

  // Tooltip shown on hover
  const [showN0Tip, setShowN0Tip] = React.useState(false);
  const [showSqTip, setShowSqTip] = React.useState(false);

  return (
    <Widget title="Analytics" accent="var(--gold, #ffd447)">

      {/* ── N₀ ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 9, color: '#94a7c4', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              N₀
            </span>
            {/* Info icon */}
            <span
              onMouseEnter={() => setShowN0Tip(true)}
              onMouseLeave={() => setShowN0Tip(false)}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 14, height: 14, borderRadius: '50%', fontSize: 9, cursor: 'default',
                background: 'rgba(148,167,196,0.2)', color: '#94a7c4', userSelect: 'none',
              }}
              aria-label="N₀ explanation"
            >?</span>
          </div>
          <span style={{
            fontSize: 20, fontWeight: 800, fontFamily: 'DM Mono,monospace',
            color: n0 == null ? '#94a7c4' : n0 < 1000 ? '#44e882' : '#ffd447',
          }}>
            {n0Display}
          </span>
        </div>

        {/* Tooltip */}
        {showN0Tip && (
          <div style={{
            padding: '8px 10px', borderRadius: 7, marginBottom: 6,
            background: '#0e1624', border: '1px solid rgba(255,255,255,0.12)',
            fontSize: 9, color: '#b8ccdf', lineHeight: 1.5,
          }}>
            <strong style={{ color: '#f0f4ff' }}>N₀ = Variance / Edge²</strong><br/>
            Number of hands required for your expected value to overcome
            one standard deviation of variance. Lower is better — it means
            your edge becomes statistically reliable sooner.
          </div>
        )}

        <div style={{ fontSize: 9, color: '#94a7c4' }}>{n0Sub}</div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginBottom: 12 }} />

      {/* ── Shoe Quality Score ──────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 9, color: '#94a7c4', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Shoe Quality
            </span>
            <span
              onMouseEnter={() => setShowSqTip(true)}
              onMouseLeave={() => setShowSqTip(false)}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 14, height: 14, borderRadius: '50%', fontSize: 9, cursor: 'default',
                background: 'rgba(148,167,196,0.2)', color: '#94a7c4', userSelect: 'none',
              }}
              aria-label="Shoe quality explanation"
            >?</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: sqColor,
              background: `${sqColor}22`, borderRadius: 4, padding: '2px 6px',
              border: `1px solid ${sqColor}66`,
            }}>
              {sqLabel}
            </span>
            <span style={{
              fontSize: 20, fontWeight: 800, fontFamily: 'DM Mono,monospace',
              color: sqColor,
            }}>
              {sq}
            </span>
          </div>
        </div>

        {/* Tooltip */}
        {showSqTip && (
          <div style={{
            padding: '8px 10px', borderRadius: 7, marginBottom: 6,
            background: '#0e1624', border: '1px solid rgba(255,255,255,0.12)',
            fontSize: 9, color: '#b8ccdf', lineHeight: 1.5,
          }}>
            <strong style={{ color: '#f0f4ff' }}>Shoe Quality (0–100)</strong><br/>
            Composite score: True Count (60%) + Penetration (25%) + Ace Richness (15%).<br/>
            <span style={{ color: '#ff5c5c' }}>0–40 Bad</span> · {' '}
            <span style={{ color: '#ffd447' }}>40–70 Neutral</span> · {' '}
            <span style={{ color: '#44e882' }}>70–100 Strong</span>
          </div>
        )}

        {/* Progress gauge */}
        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          {/* 3-zone background track: red | yellow | green */}
          <div style={{ position: 'relative', height: '100%' }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: sqFill,
              background: `linear-gradient(90deg, #ff5c5c 0%, #ffd447 40%, #44e882 70%)`,
              borderRadius: 4,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>

        {/* Scale labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
          <span style={{ fontSize: 8, color: '#ff5c5c' }}>0 Bad</span>
          <span style={{ fontSize: 8, color: '#ffd447' }}>40 Neutral</span>
          <span style={{ fontSize: 8, color: '#44e882' }}>70 Strong 100</span>
        </div>
      </div>
    </Widget>
  );
}