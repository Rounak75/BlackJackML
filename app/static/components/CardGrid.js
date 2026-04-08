/*
 * components/CardGrid.js
 * ─────────────────────────────────────────────────────────
 * 52-button card deal grid (4 suits × 13 ranks).
 *
 * UX AUDIT — Issue #5:
 *   In live/screenshot mode, the grid collapses to a compact
 *   strip with an expand button. In manual mode, full grid.
 *
 * ACCESSIBILITY IMPROVEMENTS:
 *   • Every card button has a descriptive aria-label
 *   • Suit filter tabs have aria-pressed
 *   • Target selector buttons have aria-pressed + aria-label
 *   • The card grid has role="group" + aria-label
 *   • Dealer alert banners use role="alert"
 *   • Depleted cards have aria-disabled="true"
 *   • Split/Undo have descriptive aria-labels
 */

function CardGrid({ target, onTargetChange, remainingByRank, onDealCard, onUndo, onSplit, canSplit, dealerMustDraw, dealerStands, scanMode, countSystem }) {
  const { useState } = React;
  const [suitFilter, setSuitFilter] = useState('all');
  const [gridExpanded, setGridExpanded] = useState(false);

  const rankToKey = { A: 11, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 10, Q: 10, K: 10 };
  const maxByKey  = { 2: 24, 3: 24, 4: 24, 5: 24, 6: 24, 7: 24, 8: 24, 9: 24, 10: 96, 11: 24 };

  const suitFilters = [
    { key: 'all',      label: 'All',  ariaLabel: 'Show all suits' },
    { key: 'spades',   label: '♠',   ariaLabel: 'Spades only' },
    { key: 'hearts',   label: '♥',   ariaLabel: 'Hearts only',   red: true },
    { key: 'diamonds', label: '♦',   ariaLabel: 'Diamonds only', red: true },
    { key: 'clubs',    label: '♣',   ariaLabel: 'Clubs only' },
  ];

  const targets = [
    { t: 'player', label: '👤 Player', ariaLabel: 'Deal next card to player hand' },
    { t: 'dealer', label: dealerMustDraw ? '🏦 Dealer ←' : '🏦 Dealer', ariaLabel: dealerMustDraw ? 'Deal next card to dealer (dealer must draw)' : 'Deal next card to dealer hand' },
    { t: 'seen',   label: '👁 Seen',   ariaLabel: 'Mark card as seen (count only, no hand)' },
  ];

  const suitFullName = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };

  // Issue #5: collapse grid in live/screenshot mode
  const isManualMode = !scanMode || scanMode === 'manual';
  const showGrid = isManualMode || gridExpanded;

  return (
    <div
      className={`rounded-xl p-3 ${!showGrid ? 'card-grid-collapsed' : ''}`}
      style={{ background: '#1c2540', border: '1.5px solid rgba(255,255,255,0.12)' }}
      role="group"
      aria-label="Card entry panel"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="font-display font-bold text-[10px] uppercase tracking-widest"
          style={{ color: '#b8ccdf' }}
          aria-hidden="true"
        >
          {isManualMode ? 'Click to Deal' : (showGrid ? 'Card Grid (Expanded)' : 'Card Grid')}
        </span>

        <div className="flex items-center gap-2">
          {/* Collapse/expand toggle for non-manual modes */}
          {!isManualMode && (
            <button
              onClick={() => setGridExpanded(e => !e)}
              className="text-[10px] px-2 py-0.5 rounded-md font-semibold transition-all"
              style={{
                background: gridExpanded ? 'rgba(255,212,71,0.1)' : 'transparent',
                border: `1px solid ${gridExpanded ? 'rgba(255,212,71,0.4)' : 'rgba(255,255,255,0.12)'}`,
                color: gridExpanded ? '#ffd447' : '#b8ccdf',
              }}
            >
              {gridExpanded ? 'Collapse ▲' : 'Expand Grid ▼'}
            </button>
          )}

          {/* Suit filter tabs — only shown when grid is visible */}
          {showGrid && (
            <div className="flex gap-1" role="group" aria-label="Filter cards by suit">
              {suitFilters.map(({ key, label, red, ariaLabel }) => (
                <button
                  key={key}
                  onClick={() => setSuitFilter(key)}
                  aria-pressed={suitFilter === key}
                  aria-label={ariaLabel}
                  className="text-xs px-2 py-0.5 rounded-md transition-all"
                  style={{
                    background: suitFilter === key ? '#212d45' : 'transparent',
                    border: `1.5px solid ${suitFilter === key ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)'}`,
                    color: suitFilter === key
                      ? (red ? '#ff7a7a' : '#f0f4ff')
                      : (red ? '#ff9999aa' : '#b8ccdf'),
                    fontWeight: suitFilter === key ? 700 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expand prompt for collapsed state */}
      {!isManualMode && !showGrid && (
        <button
          onClick={() => setGridExpanded(true)}
          className="card-grid-expand-btn"
        >
          🃏 Tap to expand 52-card grid for manual entry
        </button>
      )}

      {/* Dealer must-draw banner */}
      {dealerMustDraw && showGrid && (
        <div
          role="alert"
          className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg text-xs font-semibold"
          style={{
            background: 'rgba(255, 160, 40, 0.15)',
            border: '1.5px solid rgba(255, 160, 40, 0.5)',
            color: '#ffb347',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        >
          <span aria-hidden="true">🏦</span>
          <span>DEALER MUST DRAW — click a card to deal to dealer</span>
        </div>
      )}

      {/* Dealer stands banner */}
      {dealerStands && showGrid && (
        <div
          role="status"
          className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg text-xs font-semibold"
          style={{
            background: 'rgba(50, 200, 120, 0.12)',
            border: '1.5px solid rgba(50, 200, 120, 0.4)',
            color: '#5eead4',
          }}
        >
          <span aria-hidden="true">✓</span>
          <span>Dealer stands — record the result</span>
        </div>
      )}

      {/* Target selector */}
      <div
        className="flex items-center gap-2 mb-2 p-2 rounded-lg"
        style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }}
        role="group"
        aria-label="Select deal target"
      >
        <span className="text-[10px] font-semibold" style={{ color: '#b8ccdf', flexShrink: 0 }} aria-hidden="true">To:</span>
        <div className="flex gap-1 flex-1">
          {targets.map(({ t, label, ariaLabel }) => {
            const isDealer = t === 'dealer';
            const mustDraw = isDealer && dealerMustDraw;
            const isActive = target === t;
            return (
              <button
                key={t}
                onClick={() => onTargetChange(t)}
                aria-pressed={isActive}
                aria-label={ariaLabel}
                className="flex-1 text-xs py-1.5 rounded-md font-semibold transition-all"
                style={{
                  background: isActive
                    ? (mustDraw ? '#ff9a20' : '#ffd447')
                    : (mustDraw ? 'rgba(255,154,32,0.12)' : 'transparent'),
                  border: `1.5px solid ${
                    isActive
                      ? (mustDraw ? '#ff9a20' : '#ffd447')
                      : (mustDraw ? 'rgba(255,154,32,0.5)' : 'rgba(255,255,255,0.15)')
                  }`,
                  color: isActive ? '#0a0e18' : (mustDraw ? '#ffb347' : '#ccdaec'),
                  fontWeight: mustDraw ? 700 : 600,
                  boxShadow: mustDraw && isActive ? '0 0 10px rgba(255,154,32,0.5)' : 'none',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action buttons row: Split + Undo */}
      <div className="flex gap-2 mb-3 card-grid-actions">
        {canSplit ? (
          <button
            onClick={onSplit}
            aria-label="Split pair into two separate hands"
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold transition-all"
            style={{
              background: 'rgba(185,155,255,0.15)',
              border: '2px solid rgba(185,155,255,0.7)',
              color: '#c4a8ff',
              fontSize: 13,
              boxShadow: '0 0 14px rgba(185,155,255,0.3)',
              animation: 'split-pulse 1.8s ease-in-out infinite',
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 16 }}>✂</span>
            <span>SPLIT PAIR</span>
            <span style={{ fontSize: 10, opacity: 0.8, fontWeight: 500 }} aria-hidden="true">→ 2 hands</span>
          </button>
        ) : (
          <div style={{ flex: 1 }} aria-hidden="true" />
        )}

        <button
          onClick={onUndo}
          aria-label="Undo last card dealt"
          className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-bold transition-all"
          style={{
            background: 'rgba(255,92,92,0.10)',
            border: '1.5px solid rgba(255,92,92,0.35)',
            color: '#ff8888',
            fontSize: 12,
            minWidth: 110,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,92,92,0.20)';
            e.currentTarget.style.borderColor = 'rgba(255,92,92,0.7)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,92,92,0.10)';
            e.currentTarget.style.borderColor = 'rgba(255,92,92,0.35)';
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 14 }}>↩</span>
          <span>Undo Card</span>
        </button>
      </div>

      <style>{`
        @keyframes split-pulse {
          0%, 100% { box-shadow: 0 0 10px rgba(185,155,255,0.3); }
          50%       { box-shadow: 0 0 22px rgba(185,155,255,0.6); }
        }
      `}</style>

      {/* 13-column card grid */}
      <div
        className="card-grid-inner"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', gap: '3px' }}
        role="group"
        aria-label="Card selection grid — click to deal a card"
      >
        {SUITS.map(suit =>
          RANKS.map(rank => {
            const visible = suitFilter === 'all' || suitFilter === suit.name;
            if (!visible) return null;

            const activeTags = (typeof COUNT_TAGS !== 'undefined' && COUNT_TAGS[countSystem || 'hi_lo']) || HILO_TAG;
            const hv       = activeTags[rank] || 0;
            const key      = rankToKey[rank];
            const rem      = remainingByRank ? (remainingByRank[key] || 0) : 0;
            const max      = maxByKey[key] || 24;
            const depleted = rem < max * 0.2;
            const sysLabels = { hi_lo: 'Hi-Lo', ko: 'KO', omega_ii: 'Ω-II', zen: 'Zen', wong_halves: 'WH' };
            const sysLabel = sysLabels[countSystem] || 'Hi-Lo';
            const hvFmt    = hv > 0 ? `+${hv}` : `${hv}`;
            const countHint = hv !== 0 ? `, ${sysLabel} ${hvFmt}` : '';
            const suitName  = suitFullName[suit.name] || suit.name;

            return (
              <button
                key={`${rank}-${suit.name}`}
                onClick={() => onDealCard(rank, suit.name)}
                aria-label={`Deal ${rank} of ${suitName} to ${target}${countHint}${depleted ? ' (low supply)' : ''}`}
                aria-disabled={depleted ? 'true' : undefined}
                className={`card-btn ${suit.isRed ? 'red-card' : ''} ${depleted ? 'depleted' : ''} ${hv > 0 ? 'count-pos' : hv < 0 ? 'count-neg' : ''}`}
              >
                <span>{rank}</span>
                <span className="btn-suit" aria-hidden="true">{suit.icon}</span>
                {hv !== 0 && (
                  <span aria-hidden="true" style={{
                    position: 'absolute', top: '2px', right: '3px',
                    fontSize: '0.5rem', lineHeight: 1,
                    color: hv > 0 ? 'var(--jade)' : 'var(--ruby)',
                  }}>
                    {hv > 0 ? '+' : '−'}{Math.abs(hv) !== 1 ? Math.abs(hv) : ''}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}