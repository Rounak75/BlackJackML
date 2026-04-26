/*
 * components/ConfirmationPanel.js — Card Confirmation Mode (Feature 4)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Feature 4: Human-in-the-Loop Card Confirmation
 *
 * WHAT IS THIS?
 * ─────────────
 * When enabled, the live scanner does NOT automatically apply detected cards.
 * Instead, each card goes into a pending queue and the user reviews it.
 *
 * FLOW:
 *   1. CV detects a card on screen
 *   2. Server queues it → emits 'pending_cards_update' with the queue
 *   3. This panel shows each pending card with ✓ / ✗ buttons
 *   4. ✓ → server applies the card to the correct hand
 *      ✗ → server discards (false detection, or wrong routing)
 *
 * WHY WOULD YOU USE THIS?
 *   • CV isn't perfectly accurate — sometimes misreads a card
 *   • You want full control over what gets counted
 *   • You're in a complex multi-hand situation
 *   • The zone config isn't quite right yet and you want to review routing
 *
 * RACE CONDITION SAFETY:
 *   Pending cards have unique IDs. Confirming or rejecting uses the ID,
 *   not position, so rapid detections don't cause duplicate processing.
 *   The server also deduplicates: same rank+suit+target won't appear twice.
 *
 * Props:
 *   socket              SocketIO connection
 *   confirmationMode    boolean — from server state
 *   pendingCards        array of { id, rank, suit, target } — pending queue
 */

function ConfirmationPanel({ confirmationMode, pendingCards = [] }) {
  // PHASE 7 T3: socket from context.
  var socket = React.useContext(window.SocketContext);

  // ── Local state ──────────────────────────────────────────────────────────
  // Subscribe to pending_cards_update events directly in this panel
  // so the queue updates without a full state_update round-trip.
  const [pending, setPending]         = React.useState(pendingCards);
  const [modeToggling, setModeToggling] = React.useState(false);

  // Sync from props (initial load + server-push state_update)
  React.useEffect(() => {
    setPending(pendingCards || []);
  }, [pendingCards]);

  // Subscribe to real-time pending_cards_update events
  React.useEffect(() => {
    if (!socket) return;
    const onUpdate = (data) => setPending(data.pending || []);
    socket.on('pending_cards_update', onUpdate);
    return () => socket.off('pending_cards_update', onUpdate);
  }, [socket]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleToggleMode = () => {
    if (!socket) return;
    setModeToggling(true);
    socket.emit('set_confirmation_mode', { enabled: !confirmationMode });
    setTimeout(() => setModeToggling(false), 500);
  };

  const handleConfirm = (id) => {
    if (!socket) return;
    // Optimistic UI: remove from local pending immediately
    setPending(p => p.filter(c => c.id !== id));
    socket.emit('confirm_card', { id });
  };

  const handleReject = (id) => {
    if (!socket) return;
    setPending(p => p.filter(c => c.id !== id));
    socket.emit('reject_card', { id });
  };

  const handleConfirmAll = () => {
    if (!socket || pending.length === 0) return;
    const ids = pending.map(c => c.id);
    setPending([]);
    ids.forEach(id => socket.emit('confirm_card', { id }));
  };

  const handleRejectAll = () => {
    if (!socket || pending.length === 0) return;
    const ids = pending.map(c => c.id);
    setPending([]);
    ids.forEach(id => socket.emit('reject_card', { id }));
  };

  // ── Display helpers ───────────────────────────────────────────────────────

  const TARGET_LABELS = {
    player: { label: 'Your hand', color: '#44e882', bg: 'rgba(68,232,130,0.12)' },
    dealer: { label: 'Dealer',    color: '#ffd447', bg: 'rgba(255,212,71,0.12)' },
    seen:   { label: 'Seen',      color: '#b99bff', bg: 'rgba(185,155,255,0.12)' },
  };

  const SUIT_RED = { hearts: true, diamonds: true, spades: false, clubs: false };
  const SUIT_ICONS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

  return (
    <div className="widget-card" role="region" aria-labelledby="wgt-confirm-mode"
      style={{ borderLeft: `3px solid ${confirmationMode ? '#ffd447' : '#94a7c4'}` }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <span id="wgt-confirm-mode" className="widget-title">
          Card Confirmation
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {pending.length > 0 && (
            <span className="font-mono text-[9px] border rounded px-2 py-0.5"
              style={{ color: '#ffd447', borderColor: 'rgba(255,212,71,0.4)',
                background: 'rgba(255,212,71,0.12)',
                animation: 'confPulse 1.2s ease-in-out infinite',
              }}>
              {pending.length} PENDING
            </span>
          )}
          {confirmationMode && pending.length === 0 && (
            <span className="font-mono text-[9px] border rounded px-2 py-0.5"
              style={{ color: '#44e882', borderColor: 'rgba(68,232,130,0.4)',
                background: 'rgba(68,232,130,0.08)' }}>
              WATCHING
            </span>
          )}
        </div>
      </div>

      {/* ── Toggle ───────────────────────────────────────────────────────── */}
      <button
        onClick={handleToggleMode}
        disabled={modeToggling}
        aria-pressed={confirmationMode}
        aria-label={confirmationMode
          ? 'Disable confirmation mode — apply cards automatically'
          : 'Enable confirmation mode — review each card before applying'}
        style={{
          width: '100%', padding: '8px 0', fontSize: 11, fontWeight: 700,
          borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s',
          marginBottom: 10,
          background: confirmationMode
            ? 'rgba(255,212,71,0.10)'
            : 'rgba(255,255,255,0.04)',
          border: `1.5px solid ${confirmationMode
            ? 'rgba(255,212,71,0.55)'
            : 'rgba(255,255,255,0.1)'}`,
          color: confirmationMode ? '#ffd447' : '#94a7c4',
          opacity: modeToggling ? 0.6 : 1,
        }}
      >
        {modeToggling
          ? '…'
          : confirmationMode
          ? '■ Disable Confirmation Mode'
          : '▶ Enable Confirmation Mode'}
      </button>

      {/* ── Pending card queue ───────────────────────────────────────────── */}
      {confirmationMode && (
        <>
          {pending.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '14px 0',
              fontSize: 10, color: '#94a7c4',
            }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>👁</div>
              <div style={{ fontWeight: 600 }}>Watching for cards…</div>
              <div style={{ marginTop: 3, fontSize: 9 }}>
                Detected cards will appear here for approval
              </div>
            </div>
          ) : (
            <>
              {/* Bulk action row */}
              {pending.length > 1 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <button
                    onClick={handleConfirmAll}
                    aria-label="Confirm all pending cards"
                    style={{
                      flex: 1, padding: '5px 0', fontSize: 10, fontWeight: 700,
                      borderRadius: 5, cursor: 'pointer',
                      background: 'rgba(68,232,130,0.10)',
                      border: '1.5px solid rgba(68,232,130,0.45)',
                      color: '#44e882',
                    }}
                  >
                    ✓ All ({pending.length})
                  </button>
                  <button
                    onClick={handleRejectAll}
                    aria-label="Reject all pending cards"
                    style={{
                      flex: 1, padding: '5px 0', fontSize: 10, fontWeight: 700,
                      borderRadius: 5, cursor: 'pointer',
                      background: 'rgba(255,92,92,0.08)',
                      border: '1.5px solid rgba(255,92,92,0.35)',
                      color: '#ff5c5c',
                    }}
                  >
                    ✗ Reject All
                  </button>
                </div>
              )}

              {/* Individual card rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {pending.map(card => {
                  const isRed = SUIT_RED[card.suit] ?? false;
                  const cardColor = isRed ? '#ff7a7a' : '#ccdaec';
                  const tgt = TARGET_LABELS[card.target] || TARGET_LABELS.seen;
                  return (
                    <div
                      key={card.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 10px', borderRadius: 7,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        animation: 'confSlideIn 0.2s ease',
                      }}
                    >
                      {/* Card display */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexDirection: 'column',
                        width: 36, height: 48, borderRadius: 5, flexShrink: 0,
                        background: isRed ? 'rgba(255,80,80,0.12)' : 'rgba(200,215,240,0.08)',
                        border: `1.5px solid ${isRed ? 'rgba(255,80,80,0.35)' : 'rgba(200,215,240,0.2)'}`,
                        color: cardColor,
                        fontSize: 14, fontWeight: 700,
                        fontFamily: 'DM Mono, monospace',
                      }}>
                        <span style={{ lineHeight: 1 }}>{card.rank}</span>
                        <span style={{ fontSize: 11, lineHeight: 1 }}>
                          {SUIT_ICONS[card.suit] || card.suit}
                        </span>
                      </div>

                      {/* Target badge + card info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 700, color: '#f0f4ff',
                          fontFamily: 'DM Mono, monospace',
                        }}>
                          {card.rank}{SUIT_ICONS[card.suit] || card.suit}
                        </div>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center',
                          gap: 3, marginTop: 2,
                          padding: '1px 5px', borderRadius: 3,
                          background: tgt.bg,
                          fontSize: 8, fontWeight: 700,
                          color: tgt.color,
                        }}>
                          {tgt.label}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        <button
                          onClick={() => handleConfirm(card.id)}
                          aria-label={`Confirm ${card.rank} of ${card.suit} to ${card.target}`}
                          title="Confirm — apply this card"
                          style={{
                            width: 32, height: 32, borderRadius: 6,
                            border: '1.5px solid rgba(68,232,130,0.5)',
                            background: 'rgba(68,232,130,0.10)',
                            color: '#44e882', fontSize: 16, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.12s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(68,232,130,0.25)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(68,232,130,0.10)'}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => handleReject(card.id)}
                          aria-label={`Reject ${card.rank} of ${card.suit} — discard false detection`}
                          title="Reject — discard this detection"
                          style={{
                            width: 32, height: 32, borderRadius: 6,
                            border: '1.5px solid rgba(255,92,92,0.4)',
                            background: 'rgba(255,92,92,0.08)',
                            color: '#ff5c5c', fontSize: 16, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.12s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,92,92,0.22)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,92,92,0.08)'}
                        >
                          ✗
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Disabled state description ─────────────────────────────────── */}
      {!confirmationMode && (
        <div style={{
          fontSize: 9, color: '#94a7c4', lineHeight: 1.7,
          padding: '6px 8px', borderRadius: 5,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          When enabled, detected cards wait for your approval (✓/✗) before
          being counted. Prevents false detections from corrupting your count.
        </div>
      )}

      <style>{`
        @keyframes confPulse {
          0%,100% { opacity:1; }
          50%      { opacity:0.6; }
        }
        @keyframes confSlideIn {
          from { opacity:0; transform:translateY(-4px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  );
}