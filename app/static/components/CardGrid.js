/*
 * components/CardGrid.js
 * ─────────────────────────────────────────────────────────
 * 52-button card deal grid (4 suits × 13 ranks).
 *
 * UX AUDIT — CRIT-03:
 *   Default mode is now a compact RANK-ONLY strip (13 buttons).
 *   Clicking a rank opens a 4-button suit popover inline.
 *   Full 52-button grid available via "Expand Grid" toggle.
 *   This reduces ~280px → ~60px of vertical space.
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

function CardGrid({ target, onTargetChange, remainingByRank, onDealCard, onUndo, onSplit, canSplit, dealerMustDraw, dealerStands, scanMode, countSystem, uiMode, doeActive, doeTarget, doeRoundDone }) {
  const { useState, useEffect } = React;
  const [suitFilter, setSuitFilter] = useState('all');
  const [gridExpanded, setGridExpanded] = useState(false);
  const [suitPopoverRank, setSuitPopoverRank] = useState(null);

  const isZen   = uiMode === 'zen';
  const isSpeed = uiMode === 'speed';
  const isMinimal = isZen || isSpeed;

  const rankToKey = { A: 11, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 10, Q: 10, K: 10 };
  const maxByKey  = { 2: 24, 3: 24, 4: 24, 5: 24, 6: 24, 7: 24, 8: 24, 9: 24, 10: 96, 11: 24 };

  const suitFilters = [
    { key: 'all',      label: 'All',  ariaLabel: 'Show all suits' },
    { key: 'spades',   label: '♠',   ariaLabel: 'Spades only' },
    { key: 'hearts',   label: '♥',   ariaLabel: 'Hearts only',   red: true },
    { key: 'diamonds', label: '♦',   ariaLabel: 'Diamonds only', red: true },
    { key: 'clubs',    label: '♣',   ariaLabel: 'Clubs only' },
  ];

  // PHASE 6 A1: 🏦 dealer → Lucide landmark icon (functional). 👤/👁 stay
  // (decorative — not in the audit list).
  const targets = [
    { t: 'player', label: <span>👤 Player</span>, ariaLabel: 'Deal next card to player hand' },
    { t: 'dealer',
      label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Icon name="landmark" size={12} />
        Dealer{dealerMustDraw ? ' ←' : ''}
      </span>,
      ariaLabel: dealerMustDraw ? 'Deal next card to dealer (dealer must draw)' : 'Deal next card to dealer hand'
    },
    { t: 'seen',   label: <span>👁 Seen</span>, ariaLabel: 'Mark card as seen (count only, no hand)' },
  ];

  // PHASE A1: When DOE is active and round is in progress, hide the "seen"
  // chip — DOE handles "seen" internally for non-self seats. When DOE is off
  // or round is done, all three chips remain.
  const visibleTargets = (doeActive && !doeRoundDone)
    ? targets.filter((tg) => tg.t !== 'seen')
    : targets;

  const suitFullName = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };

  // Collapse in live/screenshot mode
  const isManualMode = !scanMode || scanMode === 'manual';
  const showFullGrid = !isMinimal && gridExpanded;
  // Compact mode = rank-only strip (default in manual mode, forced in zen/speed)
  const showCompact = isMinimal || (isManualMode && !gridExpanded);

  // ── PHASE 1 (revised): 1-key card entry — suit-prompt by default ──
  //   Plain rank   → opens 4-suit popover (asks the user which suit).
  //   Shift+rank   → quick-fire as spades (skips the popover).
  //   With popover open, plain Digit1-4 selects the suit:
  //     1=spades  2=hearts  3=diamonds  4=clubs
  // Keyed on e.code so Shift+digit still resolves to the digit
  // (US layout: e.key for Shift+1 is "!", which would miss).
  const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const RANK_CODES = {
    Digit1: 'A',  Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5',
    Digit6: '6',  Digit7: '7', Digit8: '8', Digit9: '9', Digit0: '10',
    KeyJ:   'J',  KeyQ:    'Q', KeyK:    'K',
  };
  // While popover is open, plain Digit1-4 picks the suit for that rank.
  const SUIT_CODES = { Digit1: 'spades', Digit2: 'hearts', Digit3: 'diamonds', Digit4: 'clubs' };

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      // Don't intercept shortcuts that include Ctrl/Meta/Alt (Ctrl+Z etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Esc closes popover
      if (suitPopoverRank && e.key === 'Escape') {
        e.preventDefault();
        setSuitPopoverRank(null);
        return;
      }

      // Popover open + plain Digit1-4 picks suit for the popover rank
      if (suitPopoverRank && !e.shiftKey && SUIT_CODES[e.code]) {
        e.preventDefault();
        onDealCard(suitPopoverRank, SUIT_CODES[e.code]);
        setSuitPopoverRank(null);
        return;
      }

      // Rank keys:
      //   Shift+rank → quick-fire spades (no popover)
      //   plain rank → open suit popover
      if (RANK_CODES[e.code]) {
        e.preventDefault();
        const rank = RANK_CODES[e.code];
        if (e.shiftKey) {
          onDealCard(rank, 'spades');
          setSuitPopoverRank(null);
        } else {
          setSuitPopoverRank(prev => prev === rank ? null : rank);
        }
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [suitPopoverRank, onDealCard]);

  return (
    <div
      className={`rounded-xl p-3`}
      style={{ background: '#1c2540', border: '1.5px solid rgba(255,255,255,0.12)' }}
      role="group"
      aria-label="Card entry panel"
    >
      {/* Header row — CRIT-04: dynamic target in header */}
      <div className="flex items-center justify-between mb-2">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            className="font-display font-bold text-[10px] uppercase tracking-widest"
            style={{ color: '#b8ccdf' }}
            aria-hidden="true"
          >
            {showFullGrid ? 'Full Card Grid' : 'Click to Deal'}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.05em',
            color: target === 'player' ? '#60a5fa' : target === 'dealer' ? '#ff9a20' : '#94a7c4',
          }}>
            → {target === 'player' ? 'PLAYER' : target === 'dealer' ? 'DEALER' : 'SEEN'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle compact/full — hidden in minimal modes */}
          {!isMinimal && (
          <button
            onClick={() => { setGridExpanded(e => !e); setSuitPopoverRank(null); }}
            className="text-[10px] px-2 py-0.5 rounded-md font-semibold transition-all"
            style={{
              background: gridExpanded ? 'rgba(255,212,71,0.1)' : 'transparent',
              border: `1px solid ${gridExpanded ? 'rgba(255,212,71,0.4)' : 'rgba(255,255,255,0.12)'}`,
              color: gridExpanded ? '#ffd447' : '#b8ccdf',
            }}
          >
            {gridExpanded ? 'Compact ▲' : 'Full Grid ▼'}
          </button>
          )}

          {/* Suit filter tabs — only shown in full grid mode */}
          {showFullGrid && (
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

      {/* Dealer must-draw banner */}
      {dealerMustDraw && (
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
          <Icon name="landmark" size={14} color="#ffb347" />
          <span>DEALER MUST DRAW — click a card to deal to dealer</span>
        </div>
      )}

      {/* Dealer stands banner */}
      {dealerStands && (
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

      {/* Target selector — CRIT-04: saturated fill colors per target */}
      <div
        className="flex items-center gap-2 mb-2 p-2 rounded-lg"
        style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }}
        role="group"
        aria-label="Select deal target"
      >
        <span className="text-[10px] font-semibold" style={{ color: '#b8ccdf', flexShrink: 0 }} aria-hidden="true">
          {doeActive && !doeRoundDone ? 'DOE →' : (doeActive && doeRoundDone ? 'Round done — manual:' : 'To:')}
        </span>
        <div className="flex gap-2 flex-1">
          {visibleTargets.map(({ t, label, ariaLabel }) => {
            const isDealer = t === 'dealer';
            const mustDraw = isDealer && dealerMustDraw;

            // Three states:
            //  - DOE off  → interactive, lit by `target` (current behaviour)
            //  - DOE on, round in progress → read-only, lit by `doeTarget`
            //  - DOE on, round done → interactive, lit by `target`
            const isReadOnly = doeActive && !doeRoundDone;
            const litTarget  = isReadOnly ? doeTarget : target;
            const isActive   = litTarget === t;

            const fills = {
              player: { bg: '#3b82f6', border: '#60a5fa', text: '#ffffff', shadow: 'rgba(59,130,246,0.5)' },
              dealer: { bg: '#ff9a20', border: '#ffb347', text: '#0a0e18', shadow: 'rgba(255,154,32,0.5)' },
              seen:   { bg: '#4b5563', border: '#6b7280', text: '#ffffff', shadow: 'rgba(75,85,99,0.4)' },
            };
            const fill = fills[t] || fills.player;
            return (
              <button
                key={t}
                onClick={isReadOnly ? undefined : () => onTargetChange(t)}
                aria-pressed={isActive}
                aria-disabled={isReadOnly}
                aria-label={isReadOnly ? `${ariaLabel} (controlled by Deal-Order Engine)` : ariaLabel}
                className="flex-1 text-xs py-2 rounded-lg font-bold transition-all"
                style={{
                  background: isActive ? fill.bg : (mustDraw ? 'rgba(255,154,32,0.12)' : 'transparent'),
                  border: `2px solid ${isActive ? fill.border : (mustDraw ? 'rgba(255,154,32,0.5)' : 'rgba(255,255,255,0.12)')}`,
                  color: isActive ? fill.text : (mustDraw ? '#ffb347' : '#8fa5be'),
                  fontWeight: 700,
                  fontSize: 12,
                  boxShadow: isActive ? `0 0 12px ${fill.shadow}` : 'none',
                  letterSpacing: '0.02em',
                  cursor: isReadOnly ? 'default' : 'pointer',
                  opacity: isReadOnly && !isActive ? 0.65 : 1,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action buttons row: Split + Undo */}
      <div className="flex gap-2 mb-2 card-grid-actions">
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

      {/* ══════════════════════════════════════════════════════════
          COMPACT MODE — 13 rank buttons in a single row (CRIT-03)
          Clicking a rank opens a 4-suit popover below it.
          ══════════════════════════════════════════════════════════ */}
      {showCompact && (
        <div>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', gap: '3px' }}
            role="group"
            aria-label="Card rank selection — click to pick suit"
          >
            {RANKS.map(rank => {
              const activeTags = (typeof COUNT_TAGS !== 'undefined' && COUNT_TAGS[countSystem || 'hi_lo']) || HILO_TAG;
              const hv = activeTags[rank] || 0;
              const key = rankToKey[rank];
              const rem = remainingByRank ? (remainingByRank[key] || 0) : 0;
              const max = maxByKey[key] || 24;
              const depleted = rem < max * 0.2;
              const isOpen = suitPopoverRank === rank;

              return (
                <div key={rank} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setSuitPopoverRank(isOpen ? null : rank)}
                    aria-expanded={isOpen}
                    aria-label={`${rank} — ${rem} remaining. Click to pick suit`}
                    aria-disabled={depleted ? 'true' : undefined}
                    className={`card-btn compact-rank-btn ${depleted ? 'depleted' : ''} ${hv > 0 ? 'count-pos' : hv < 0 ? 'count-neg' : ''}`}
                    style={{
                      width: '100%',
                      padding: isSpeed ? '10px 0' : '6px 0',
                      fontSize: isSpeed ? 18 : 14,
                      fontWeight: 800,
                      borderRadius: 7,
                      border: isOpen ? '2px solid #ffd447' : '1.5px solid rgba(255,255,255,0.15)',
                      background: isOpen ? 'rgba(255,212,71,0.12)' : '#111827',
                      color: depleted ? '#4a5568' : '#f0f4ff',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.15s',
                    }}
                  >
                    {rank}
                    {!isZen && hv !== 0 && (
                      <span aria-hidden="true" style={{
                        position: 'absolute', top: '1px', right: '3px',
                        fontSize: '0.5rem', lineHeight: 1,
                        color: hv > 0 ? 'var(--jade)' : 'var(--ruby)',
                      }}>
                        {hv > 0 ? '+' : '−'}{Math.abs(hv) !== 1 ? Math.abs(hv) : ''}
                      </span>
                    )}
                    {!isZen && (
                    <span style={{
                      display: 'block', fontSize: 8, color: depleted ? '#4a5568' : '#6b7f96',
                      fontWeight: 500, lineHeight: 1, marginTop: 2,
                    }}>
                      {rem}
                    </span>
                    )}
                  </button>

                  {/* Suit popover — opens ABOVE the rank button, horizontal row */}
                  {isOpen && (
                    <div style={{
                      position: 'absolute', bottom: '100%', left: '50%',
                      transform: 'translateX(-50%)',
                      marginBottom: 4, zIndex: 50,
                      display: 'flex', flexDirection: 'row', gap: 2,
                      background: '#1c2540',
                      border: '1.5px solid rgba(255,212,71,0.5)',
                      borderRadius: 8, padding: 4,
                      boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
                      whiteSpace: 'nowrap',
                    }}>
                      {SUITS.map(suit => (
                        <button
                          key={suit.name}
                          onClick={() => {
                            onDealCard(rank, suit.name);
                            setSuitPopoverRank(null);
                          }}
                          aria-label={`Deal ${rank} of ${suitFullName[suit.name]} to ${target}`}
                          style={{
                            padding: '6px 8px', fontSize: 18, cursor: 'pointer',
                            borderRadius: 5, border: 'none',
                            background: 'transparent',
                            color: suit.isRed ? '#ff7a7a' : '#f0f4ff',
                            fontWeight: 700, lineHeight: 1,
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {suit.icon}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Click-away handler for popover */}
          {suitPopoverRank && (
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 40 }}
              onClick={() => setSuitPopoverRank(null)}
              aria-hidden="true"
            />
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          FULL GRID MODE — original 13-column × 4 suit grid
          ══════════════════════════════════════════════════════════ */}
      {showFullGrid && (
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
      )}

      {/* Non-manual mode: show expand prompt when collapsed */}
      {!isManualMode && !gridExpanded && (
        <button
          onClick={() => setGridExpanded(true)}
          className="card-grid-expand-btn"
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="spade" size={14} />
            Tap to expand 52-card grid for manual entry
          </span>
        </button>
      )}
    </div>
  );
}


// PHASE 7 T4 — React.memo wrap. Script-mode reassignment of the
// function declaration keeps `function CardGrid(` intact for the
// build.sh smoke check while routing all consumers through memo.
if (typeof React !== 'undefined' && React.memo) {
  CardGrid = React.memo(CardGrid);
}
