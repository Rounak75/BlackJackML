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
        background: '#1c2540',
        border: '1px solid rgba(255,255,255,0.1)',
        borderLeft: `4px solid ${accent}`,
        borderRadius: 12,
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
          background: 'linear-gradient(90deg, rgba(255,212,71,0.18), rgba(255,212,71,0.05))',
          borderBottom: '2px solid #ffd447',
          animation: 'pulse 1.4s ease-in-out infinite',
        } : {
          background: 'rgba(255,255,255,0.025)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        };
        return (
          <div style={{
            ...baseStyle,
            padding: '6px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{
              fontWeight: recommended ? 800 : 700,
              color: recommended ? '#ffd447' : '#94a7c4',
              letterSpacing: '0.08em',
              fontSize: recommended ? '0.95rem' : '0.78rem',
              textTransform: 'uppercase',
            }}>
              {recommended ? '⚠ TAKE INSURANCE' : 'Insurance offered'}
            </div>
            <div style={{
              fontFamily: 'DM Mono, monospace', fontSize: '0.78rem',
              color: recommended ? '#f0f4ff' : '#b8ccdf',
              fontVariantNumeric: 'tabular-nums',
            }}>
              EV <span style={{ color: evNum >= 0 ? '#44e882' : '#ff5c5c', fontWeight: 700 }}>
                {evNum >= 0 ? '+' : ''}{evNum}%
              </span>
              {' · '}
              10s {insurance.ten_probability}%
              {!recommended && evNum < 0 && (
                <span style={{ marginLeft: 8, color: '#6b7f96', fontStyle: 'italic' }}>decline</span>
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
          gap: 12,
          padding: '10px 16px',
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
                ? (isSpeed ? 64 : (isZen ? 'var(--font-hero)' : 'var(--font-action)'))
                : '1.6rem',
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
              display: 'flex', alignItems: 'center', gap: 6,
              marginTop: 4, fontSize: 9, color: '#6b7f96', letterSpacing: '0.04em',
            }}>
              <span style={{ textTransform: 'uppercase' }}>prev:</span>
              {actionHistory.map((a, i) => (
                <React.Fragment key={i}>
                  <span style={{ fontWeight: 700, fontFamily: 'DM Mono, monospace', color: '#8fa5be' }}>{a}</span>
                  {i < actionHistory.length - 1 && (
                    <span style={{ color: '#4a5568', fontSize: 9 }}>→</span>
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
                gap: 6,
                marginTop: 6,
                padding: '3px 10px',
                borderRadius: 6,
                background: cdStanding ? 'rgba(68,232,130,0.1)' : 'rgba(106,175,255,0.1)',
                border: `1px solid ${cdStanding ? 'rgba(68,232,130,0.3)' : 'rgba(106,175,255,0.3)'}`,
                fontSize: 10,
                fontWeight: 700,
                color: cdStanding ? '#44e882' : '#6aafff',
              }}
              role="status"
            >
              <span style={{ fontSize: 11 }}>⚗</span>
              <span style={{ fontFamily: 'DM Mono, monospace' }}>
                {cdHandType} vs 10 → {cdStanding ? 'Stand' : 'Hit'} at TC ≥ {cdThresh >= 0 ? '+' : ''}{cdThresh}
              </span>
            </div>
          )}
        </div>

        {/* Right cluster — hidden in zen, DEV badge only in speed */}
        {!isZen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

          {/* Deviation badge — kept in speed (decision-critical) */}
          {isDev && (
            <span
              style={{
                fontSize: 9, fontWeight: 700, fontFamily: 'monospace',
                padding: '2px 7px', borderRadius: 10,
                background: 'rgba(185,155,255,0.15)',
                border: '1px solid rgba(185,155,255,0.45)',
                color: '#b99bff',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}
            >
              DEV
            </span>
          )}

          {/* Model status dot — hidden in speed */}
          {!isSpeed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              background: modelLoaded ? '#44e882' : '#4a5568',
            }} />
            <span style={{ fontSize: 8, color: '#6b7f96' }}>
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
            padding: '7px 20px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(0,0,0,0.15)',
          }}
        >
          {/* Basic strategy comparison */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, color: '#6b7f96', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Basic
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#ccdaec' }}>
              {recommendation.basic_action}
            </span>
            {isDev && recommendation.deviation_info && (
              <>
                <span style={{ fontSize: 9, color: '#4a5568' }}>·</span>
                <span style={{ fontSize: 9, color: '#b99bff' }}>
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
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                padding: '2px 8px',
                fontSize: 9,
                color: showWhy ? '#ffd447' : '#6b7f96',
                cursor: 'pointer',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                transition: 'color 0.15s, border-color 0.15s',
                borderColor: showWhy ? 'rgba(255,212,71,0.35)' : 'rgba(255,255,255,0.1)',
              }}
            >
              {showWhy ? 'Hide ▲' : 'Why? ▼'}
            </button>
          )}
        </div>
      )}

      {/* ── Explanation — hidden until Why? is clicked (Issue #7) ─ */}
      {showWhy && lines && lines.length > 0 && (
        <div style={{ padding: '10px 20px 14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {lines.map((line, i) => {
            const isTrigger = isDev && i === 0;
            const isTip     = line.startsWith('💡');
            return (
              <p
                key={i}
                style={{
                  fontSize: isTrigger ? 10 : 11,
                  lineHeight: 1.6,
                  marginBottom: i < lines.length - 1 ? 6 : 0,
                  color:      isTrigger ? '#b99bff' : isTip ? '#ffd447' : '#ccdaec',
                  background: isTrigger ? 'rgba(185,155,255,0.08)'
                            : isTip     ? 'rgba(255,212,71,0.06)'
                            : 'transparent',
                  borderLeft: isTrigger ? '2px solid rgba(185,155,255,0.5)'
                            : isTip     ? '2px solid rgba(255,212,71,0.4)'
                            : 'none',
                  padding:    (isTrigger || isTip) ? '4px 8px' : '0',
                  borderRadius: 4,
                  fontFamily: isTrigger ? 'monospace' : 'inherit',
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
