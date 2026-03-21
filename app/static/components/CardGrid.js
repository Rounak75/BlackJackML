/*
 * components/CardGrid.js
 * ─────────────────────────────────────────────────────────
 * 52-button card deal grid (4 suits × 13 ranks).
 * Clicking a card emits it to the server.
 *
 * Features:
 *   • Suit filter tabs (All / ♠ / ♥ / ♦ / ♣)
 *   • Hi-Lo count indicators on each button (+/-)
 *   • Depletion fading when <20% of a rank remains
 *   • Target selector (Player / Dealer / Seen)
 *   • Undo button
 *
 * Props:
 *   target           — 'player' | 'dealer' | 'seen'
 *   onTargetChange   — callback(target)
 *   remainingByRank  — map of count-key → remaining cards
 *   onDealCard       — callback(rank, suitName)
 *   onUndo           — callback
 */

function CardGrid({ target, onTargetChange, remainingByRank, onDealCard, onUndo, onSplit, canSplit, dealerMustDraw, dealerStands }) {
  const { useState } = React;
  const [suitFilter, setSuitFilter] = useState('all');

  const rankToKey = { A: 11, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 10, Q: 10, K: 10 };
  const maxByKey  = { 2: 24, 3: 24, 4: 24, 5: 24, 6: 24, 7: 24, 8: 24, 9: 24, 10: 96, 11: 24 };

  const suitFilters = [
    { key: 'all',      label: 'All' },
    { key: 'spades',   label: '♠' },
    { key: 'hearts',   label: '♥', red: true },
    { key: 'diamonds', label: '♦', red: true },
    { key: 'clubs',    label: '♣' },
  ];

  const targets = [
    { t: 'player', label: '👤 Player' },
    { t: 'dealer', label: dealerMustDraw ? '🏦 Dealer ←' : '🏦 Dealer' },
    { t: 'seen',   label: '👁 Seen' },
  ];

  return (
    <div
      className="rounded-xl p-3"
      style={{ background: '#1a2236', border: '1.5px solid rgba(255,255,255,0.12)' }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="font-display font-bold text-[10px] uppercase tracking-widest"
          style={{ color: '#b8ccdf' }}
        >
          Click to Deal
        </span>

        {/* Suit filter tabs */}
        <div className="flex gap-1">
          {suitFilters.map(({ key, label, red }) => (
            <button
              key={key}
              onClick={() => setSuitFilter(key)}
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
      </div>

      {/* Dealer must-draw banner */}
      {dealerMustDraw && (
        <div
          className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg text-xs font-semibold"
          style={{
            background: 'rgba(255, 160, 40, 0.15)',
            border: '1.5px solid rgba(255, 160, 40, 0.5)',
            color: '#ffb347',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        >
          <span>🏦</span>
          <span>DEALER MUST DRAW — click a card to deal to dealer</span>
        </div>
      )}

      {/* Dealer stands banner */}
      {dealerStands && (
        <div
          className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg text-xs font-semibold"
          style={{
            background: 'rgba(50, 200, 120, 0.12)',
            border: '1.5px solid rgba(50, 200, 120, 0.4)',
            color: '#5eead4',
          }}
        >
          <span>✓</span>
          <span>Dealer stands — record the result</span>
        </div>
      )}

      {/* Target selector */}
      <div
        className="flex items-center gap-2 mb-2 p-2 rounded-lg"
        style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <span className="text-[10px] font-semibold" style={{ color: '#b8ccdf', flexShrink: 0 }}>To:</span>
        <div className="flex gap-1 flex-1">
          {targets.map(({ t, label }) => {
            const isDealer = t === 'dealer';
            const mustDraw = isDealer && dealerMustDraw;
            const isActive = target === t;
            return (
              <button
                key={t}
                onClick={() => onTargetChange(t)}
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
      <div className="flex gap-2 mb-3">

        {/* SPLIT button — only shown when player has a splittable pair */}
        {canSplit ? (
          <button
            onClick={onSplit}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold transition-all"
            style={{
              background: 'rgba(185,155,255,0.15)',
              border: '2px solid rgba(185,155,255,0.7)',
              color: '#c4a8ff',
              fontSize: 13,
              boxShadow: '0 0 14px rgba(185,155,255,0.3)',
              animation: 'split-pulse 1.8s ease-in-out infinite',
            }}
            title="Split your pair into two separate hands"
          >
            <span style={{ fontSize: 16 }}>✂</span>
            <span>SPLIT PAIR</span>
            <span style={{ fontSize: 10, opacity: 0.8, fontWeight: 500 }}>→ 2 hands</span>
          </button>
        ) : (
          <div style={{ flex: 1 }} /> 
        )}

        {/* UNDO button — always visible, removes last card dealt */}
        <button
          onClick={onUndo}
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
          title="Undo last card dealt (removes mistake)"
        >
          <span style={{ fontSize: 14 }}>↩</span>
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
      >
        {SUITS.map(suit =>
          RANKS.map(rank => {
            const visible = suitFilter === 'all' || suitFilter === suit.name;
            if (!visible) return null;

            const hv       = HILO_TAG[rank];
            const key      = rankToKey[rank];
            const rem      = remainingByRank ? (remainingByRank[key] || 0) : 0;
            const max      = maxByKey[key] || 24;
            const depleted = rem < max * 0.2;

            return (
              <button
                key={`${rank}-${suit.name}`}
                onClick={() => onDealCard(rank, suit.name)}
                className={`card-btn ${suit.isRed ? 'red-card' : ''} ${depleted ? 'depleted' : ''} ${hv > 0 ? 'count-pos' : hv < 0 ? 'count-neg' : ''}`}
                title={`${rank}${suit.icon} → ${target}`}
              >
                <span>{rank}</span>
                <span className="btn-suit">{suit.icon}</span>
                {hv !== 0 && (
                  <span style={{
                    position: 'absolute', top: '2px', right: '3px',
                    fontSize: '0.5rem', lineHeight: 1,
                    color: hv > 0 ? 'var(--jade)' : 'var(--ruby)',
                  }}>
                    {hv > 0 ? '+' : '−'}
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