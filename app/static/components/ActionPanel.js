/*
 * components/ActionPanel.js
 * ─────────────────────────────────────────────────────────
 * The primary AI recommendation panel — center column hero.
 *
 * UX AUDIT CHANGES:
 *   Issue #1  — 4rem action word, centered, full-width coloured banner
 *   Issue #7  — Explanation collapsed behind "Why?" toggle (already done)
 *   Issue #8  — CompDepAlert merged inline as a compact badge
 *   NEW       — "Last action" micro-label (trading-style)
 *   NEW       — 4px coloured stripe at top for peripheral vision
 *
 * Props:
 *   recommendation — rec object from server
 *   count          — count object from server
 *   mlModelInfo    — ml_model_info object from server
 *   compDep16      — recommendation.comp_dep_16 object (Issue #8 inline)
 */

function ActionPanel({ recommendation, count, mlModelInfo, compDep16, uiMode, insurance, outcomeFlash }) {
  const { useState, useRef, useEffect } = React;
  const [showWhy, setShowWhy] = useState(false);
  const isZen   = uiMode === 'zen';
  const isSpeed = uiMode === 'speed';

  // PHASE 8.2: Track last 3 prior actions for rolling micro-strip
  const prevActionRef = useRef(null);
  const [actionHistory, setActionHistory] = useState([]); // oldest → newest, max 3

  const action = recommendation ? recommendation.action : null;
  const isDev  = recommendation && recommendation.is_deviation;
  const lines  = action ? buildExplanation(action, recommendation, count) : null;

  const modelLoaded = mlModelInfo && mlModelInfo.loaded;

  // PHASE 8.2: Push prior action into rolling buffer of length 3 on change
  useEffect(() => {
    if (action && action !== prevActionRef.current && prevActionRef.current) {
      setActionHistory(prev => {
        const next = [...prev, prevActionRef.current];
        return next.length > 3 ? next.slice(next.length - 3) : next;
      });
    }
    prevActionRef.current = action;
  }, [action]);

  // Background tint per action — slightly more opaque for visibility
  const bgTint = {
    HIT:          'rgba(68,  232, 130, 0.12)',
    STAND:        'rgba(106, 175, 255, 0.12)',
    DOUBLE:       'rgba(255, 212, 71,  0.12)',
    'DOUBLE DOWN':'rgba(255, 212, 71,  0.12)',
    SPLIT:        'rgba(185, 155, 255, 0.12)',
    SURRENDER:    'rgba(255, 92,  92,  0.12)',
  };

  // Stripe class per action
  const STRIPE_CLASS = {
    HIT: 'hit', STAND: 'stand', DOUBLE: 'double',
    'DOUBLE DOWN': 'double', SPLIT: 'split', SURRENDER: 'surrender',
  };

  // Left accent stripe color — 4px vertical bar
  const accentColor = {
    HIT:          'var(--action-hit)',
    STAND:        'var(--action-stand)',
    DOUBLE:       'var(--action-double)',
    'DOUBLE DOWN':'var(--action-double)',
    SPLIT:        'var(--action-split)',
    SURRENDER:    'var(--action-surrender)',
  };

  const bg     = action ? bgTint[action]     : 'transparent';
  const accent = action ? accentColor[action] : 'rgba(255,255,255,0.1)';
  const stripe = action ? (STRIPE_CLASS[action] || 'none') : 'none';

  // CompDepAlert inline data
  const cdActive   = compDep16 && compDep16.active;
  const cdHandType = cdActive ? compDep16.hand_type : null;
  const cdThresh   = cdActive ? compDep16.threshold : 0;
  const cdTc       = cdActive ? compDep16.tc : 0;
  const cdStanding = cdActive ? (cdTc >= cdThresh) : false;

  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--surface-raised)',
        border: 'var(--border-w) solid var(--border-soft)',
        borderLeft: `4px solid ${accent}`,
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        transition: 'border-color 0.3s ease, background 0.3s ease',
      }}
    >
      {/* ── 4px coloured stripe at top ───────────────────────────── */}
      <div className={`action-stripe ${stripe}`} />

      {/* SPEC B: Round-outcome flash overlay (Speed only — App passes null elsewhere).
          Briefly tints the panel WIN/LOSE/PUSH for ~700ms before auto-new-hand resets. */}
      {outcomeFlash && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: outcomeFlash === 'WIN'  ? 'rgba(68,232,130,0.18)'
                    : outcomeFlash === 'LOSE' ? 'rgba(255,92,92,0.18)'
                    : 'rgba(255,212,71,0.16)',
          color:      outcomeFlash === 'WIN'  ? '#44e882'
                    : outcomeFlash === 'LOSE' ? '#ff5c5c'
                    : '#ffd447',
          fontSize: 56, fontWeight: 900, letterSpacing: '0.12em',
          pointerEvents: 'none',
          zIndex: 5,
        }}>{outcomeFlash}</div>
      )}

      {/* PHASE 3: Insurance row — always shown when dealer up = A (informational).
          Pulse + gold styling only when shoe-EV makes insurance correct. */}
      {insurance && insurance.available && (() => {
        const recommended = !!insurance.recommended;
        const evNum = typeof insurance.ev === 'number' ? insurance.ev : 0;
        const baseStyle = recommended ? {
          background: 'var(--surface-deep)',
          borderBottom: '2px solid var(--amber)',
          animation: 'pulse 1.4s ease-in-out infinite',
        } : {
          background: 'rgba(255,255,255,0.025)',
          borderBottom: 'var(--border-w) solid var(--border-soft)',
        };
        return (
          <div style={{
            ...baseStyle,
            padding: 'var(--space-2) var(--space-4)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{
              fontWeight: recommended ? 800 : 700,
              color: recommended ? 'var(--amber)' : 'var(--text-2)',
              letterSpacing: '0.08em',
              fontSize: recommended ? 'var(--font-base)' : 'var(--font-sm)',
              textTransform: 'uppercase',
            }}>
              {recommended ? '⚠ TAKE INSURANCE' : 'Insurance offered'}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 'var(--font-sm)',
              color: recommended ? 'var(--text-0)' : 'var(--text-1)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              EV <span style={{ color: evNum >= 0 ? 'var(--jade)' : 'var(--ruby)', fontWeight: 700 }}>
                {evNum >= 0 ? '+' : ''}{evNum}%
              </span>
              {' · '}
              10s {insurance.ten_probability}%
              {!recommended && evNum < 0 && (
                <span style={{ marginLeft: 'var(--space-2)', color: 'var(--text-2)', fontStyle: 'italic' }}>decline</span>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Main action row ─────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-3) var(--space-4)',
          background: bg,
          transition: 'background 0.3s ease',
        }}
      >

        {/* Action word — hero element. Speed mode renders a jumbo 64px verb
            (color via existing actionClass tokens); the inline <style> below
            scales to 48px below 480px viewport. */}
        <div style={{ flex: 1 }}>
          <div
            className={`action-text-base ${action ? actionClass(action) : ''}${isSpeed ? ' ap-verb-jumbo' : ''}`}
            title={action ? `Best play: ${action}` : 'Deal cards to see recommendation'}
            style={{
              fontSize: action
                ? (isSpeed ? 'var(--font-jumbo)' : (isZen ? 'var(--font-hero)' : 'var(--font-action)'))
                : 'var(--font-hand)',
              lineHeight: 1,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: action ? undefined : 'var(--text-2)',
              opacity: action ? 1 : 0.7,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {action || 'DEAL CARDS'}
          </div>
          {isSpeed && React.createElement('style', null,
            '@media (max-width: 480px) { .ap-verb-jumbo { font-size: 48px !important; } }'
          )}

          {/* PHASE 8.2: Last-3-actions micro-strip — oldest leftmost. Hidden in zen/speed. */}
          {!isZen && !isSpeed && actionHistory.length > 0 && action && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
              marginTop: 'var(--space-1)', fontSize: 'var(--font-xs)', color: 'var(--text-2)', letterSpacing: '0.04em',
            }}>
              <span style={{ textTransform: 'uppercase' }}>prev:</span>
              {actionHistory.map((a, i) => (
                <React.Fragment key={i}>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-2)' }}>{a}</span>
                  {i < actionHistory.length - 1 && (
                    <span style={{ color: 'var(--text-2)', fontSize: 'var(--font-xs)' }}>→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}

          {/* CompDepAlert inline badge (Issue #8) — hidden in zen/speed */}
          {!isZen && !isSpeed && cdActive && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-2)',
                padding: '3px 10px',
                borderRadius: 'var(--radius-md)',
                background: 'transparent',
                border: `var(--border-w) solid ${cdStanding ? 'var(--jade)' : 'var(--sapph)'}`,
                fontSize: 'var(--font-xs)',
                fontWeight: 700,
                color: cdStanding ? 'var(--jade)' : 'var(--sapph)',
              }}
              role="status"
            >
              <span style={{ fontSize: 'var(--font-xs)' }}>⚗</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {cdHandType} vs 10 → {cdStanding ? 'Stand' : 'Hit'} at TC ≥ {cdThresh >= 0 ? '+' : ''}{cdThresh}
              </span>
            </div>
          )}
        </div>

        {/* Right cluster — hidden in zen, DEV badge only in speed */}
        {!isZen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>

          {/* Deviation badge — kept in speed (decision-critical) */}
          {isDev && (
            <span
              style={{
                fontSize: 'var(--font-xs)', fontWeight: 700, fontFamily: 'var(--font-mono)',
                padding: '2px 7px', borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                border: 'var(--border-w) solid var(--ameth)',
                color: 'var(--ameth)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}
            >
              DEV
            </span>
          )}

          {/* Model status dot — hidden in speed */}
          {!isSpeed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              background: modelLoaded ? 'var(--jade)' : 'var(--text-2)',
            }} />
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)' }}>
              {modelLoaded ? 'ML' : 'Basic'}
            </span>
          </div>
          )}

        </div>
        )}
      </div>

      {/* ── Secondary row — basic strategy + why toggle (hidden in zen/speed) ── */}
      {!isZen && !isSpeed && recommendation && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-2) var(--space-5)',
            borderTop: 'var(--border-w) solid var(--border-soft)',
            background: 'rgba(0,0,0,0.15)',
          }}
        >
          {/* Basic strategy comparison */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Basic
            </span>
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-1)' }}>
              {recommendation.basic_action}
            </span>
            {isDev && recommendation.deviation_info && (
              <>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)' }}>·</span>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--ameth)' }}>
                  {recommendation.deviation_info.description_short || ''}
                </span>
              </>
            )}
          </div>

          {/* Why toggle */}
          {lines && lines.length > 0 && (
            <button
              onClick={() => setShowWhy(w => !w)}
              style={{
                background: 'transparent',
                border: 'var(--border-w) solid var(--border-soft)',
                borderRadius: 'var(--radius-md)',
                padding: '2px 8px',
                fontSize: 'var(--font-xs)',
                color: showWhy ? 'var(--amber)' : 'var(--text-2)',
                cursor: 'pointer',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                transition: 'color 0.15s, border-color 0.15s',
                borderColor: showWhy ? 'var(--amber)' : 'var(--border-soft)',
              }}
            >
              {showWhy ? 'Hide ▲' : 'Why? ▼'}
            </button>
          )}
        </div>
      )}

      {/* ── Explanation — hidden until Why? is clicked (Issue #7) ─ */}
      {showWhy && lines && lines.length > 0 && (
        <div style={{ padding: 'var(--space-3) var(--space-5) var(--space-4)', borderTop: 'var(--border-w) solid var(--border-soft)' }}>
          {lines.map((line, i) => {
            const isTrigger = isDev && i === 0;
            const isTip     = line.startsWith('💡');
            return (
              <p
                key={i}
                style={{
                  fontSize: isTrigger ? 'var(--font-xs)' : 'var(--font-xs)',
                  lineHeight: 1.6,
                  marginBottom: i < lines.length - 1 ? 'var(--space-2)' : 0,
                  color:      isTrigger ? 'var(--ameth)' : isTip ? 'var(--amber)' : 'var(--text-1)',
                  background: 'transparent',
                  borderLeft: isTrigger ? '2px solid var(--ameth)'
                            : isTip     ? '2px solid var(--amber)'
                            : 'none',
                  padding:    (isTrigger || isTip) ? 'var(--space-1) var(--space-2)' : '0',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: isTrigger ? 'var(--font-mono)' : 'inherit',
                }}
              >
                {line}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}


// PHASE 7 T4 — React.memo wrap. Script-mode reassignment of the
// function declaration keeps `function ActionPanel(` intact for the
// build.sh smoke check while routing all consumers through memo.
if (typeof React !== 'undefined' && React.memo) {
  ActionPanel = React.memo(ActionPanel);
}
