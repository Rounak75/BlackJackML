/*
 * components/WongPanel.js — Wonging (Back-Counting) Mode
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Feature 5: Wonging / Back-Counting
 *
 * WHAT IS WONGING?
 * ─────────────────
 * Named after Stanford Wong (author of "Professional Blackjack").
 * Instead of sitting at the table for every hand, you stand behind
 * a table and watch the cards — counting without playing.
 *
 * When the True Count climbs to +2 or above, the shoe is rich in 10s
 * and Aces (good for the player). That's when you sit down and bet.
 *
 * When the count drops to -1 or below, the shoe is unfavourable —
 * you "back-count" your way to a better table.
 *
 * SIGNALS:
 *   TC ≥ +2  → SIT DOWN NOW  (jade green)
 *   TC < -1  → LEAVE TABLE   (ruby red)
 *   else     → KEEP WATCHING (gold)
 *
 * CRITICAL RULES:
 *   • Switching wonging mode ON/OFF NEVER resets the running count
 *   • All detected cards go to 'seen' while wonging (not player/dealer)
 *   • The count bar shows real-time TC + delta to entry/exit thresholds
 *
 * Props:
 *   socket        SocketIO connection
 *   wonging       wonging state from server { enabled, true_count, signal,
 *                   signal_color, delta_to_entry, delta_to_leave }
 *   count         full count object { running, true, advantage, decks_remaining }
 */

function WongPanel({ wonging, count }) {
  // PHASE 7 T3: socket from context.
  var socket = React.useContext(window.SocketContext);

  // ── Local state ──────────────────────────────────────────────────────────
  // We optimistically toggle the UI before the server confirms,
  // then the server's state_update overwrites wonging.enabled.
  const [pending, setPending] = React.useState(false);

  // ── Toggle handler ────────────────────────────────────────────────────────
  const handleToggle = () => {
    if (!socket) return;
    const newEnabled = !(wonging?.enabled);
    setPending(true);
    socket.emit('set_wonging_mode', { enabled: newEnabled });
    // Server will emit state_update → App re-renders → pending clears
    setTimeout(() => setPending(false), 600);
  };

  // ── Derived display values ────────────────────────────────────────────────
  const enabled       = wonging?.enabled   ?? false;
  const tc            = wonging?.true_count ?? (count?.true ?? 0);
  const signal        = wonging?.signal     ?? 'KEEP WATCHING';
  const sigColor      = wonging?.signal_color ?? 'gold';
  const deltaEntry    = wonging?.delta_to_entry  ?? (2.0 - tc);
  const deltaLeave    = wonging?.delta_to_leave  ?? (tc - (-1.0));
  const rc            = count?.running     ?? 0;
  const decks         = count?.decks_remaining ?? '—';
  const adv           = count?.advantage   ?? 0;

  // Map signal_color semantic names to actual CSS colours
  const SIG_COLORS = {
    jade: '#44e882',
    ruby: '#ff5c5c',
    gold: '#ffd447',
  };
  const sigHex = SIG_COLORS[sigColor] || '#ffd447';

  // TC progress bar: map from -5..+5 to 0..100%
  const tcBar = Math.round(Math.max(0, Math.min(100, ((tc + 5) / 10) * 100)));
  const tcBarColor = tc >= 2 ? '#44e882' : tc < -1 ? '#ff5c5c' : '#ffd447';

  // ── Count bar sub-component (reused style from LiveOverlayPanel) ──────────
  const Stat = ({ label, val, col }) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: '#94a7c4', textTransform: 'uppercase',
        letterSpacing: '0.07em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: col,
        fontFamily: 'DM Mono, monospace' }}>{val}</div>
    </div>
  );

  return (
    <div className="widget-card" role="region" aria-labelledby="wgt-wonging"
      style={{ borderLeft: `3px solid ${enabled ? '#44e882' : '#94a7c4'}` }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <span id="wgt-wonging" className="widget-title">
          Wonging / Back-Count
        </span>
        {enabled && (
          <span className="font-mono text-[9px] border rounded px-2 py-0.5"
            style={{ color: '#44e882', borderColor: 'rgba(68,232,130,0.4)',
              background: 'rgba(68,232,130,0.08)' }}>
            ACTIVE
          </span>
        )}
      </div>

      {/* ── Enable / Disable toggle ───────────────────────────────────────── */}
      <button
        onClick={handleToggle}
        disabled={pending}
        aria-pressed={enabled}
        aria-label={enabled ? 'Disable wonging mode' : 'Enable wonging mode — watch table without playing'}
        style={{
          width: '100%', padding: '9px 0',
          fontSize: 12, fontWeight: 700, borderRadius: 7, cursor: 'pointer',
          marginBottom: 12, transition: 'all 0.2s',
          background: enabled
            ? 'rgba(255,92,92,0.12)'
            : 'rgba(68,232,130,0.10)',
          border: `1.5px solid ${enabled ? 'rgba(255,92,92,0.55)' : 'rgba(68,232,130,0.55)'}`,
          color: enabled ? '#ff5c5c' : '#44e882',
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? '…' : enabled ? '■ Disable Wonging' : '▶ Enable Wonging'}
      </button>

      {/* ── True Count bar ────────────────────────────────────────────── */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between',
          fontSize: 9, color: '#94a7c4', marginBottom: 4 }}>
          <span>TC −5</span>
          <span style={{ color: '#ff5c5c', fontWeight: 700 }}>Leave ← −1</span>
          <span style={{ color: '#44e882', fontWeight: 700 }}>Sit → +2</span>
          <span>TC +5</span>
        </div>
        <div style={{
          height: 10, borderRadius: 5, overflow: 'hidden',
          background: 'rgba(255,255,255,0.07)',
          position: 'relative',
        }}>
          {/* Entry threshold marker at +2 (70%) */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: '70%', width: 2,
            background: 'rgba(68,232,130,0.5)',
          }} />
          {/* Leave threshold marker at -1 (40%) */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: '40%', width: 2,
            background: 'rgba(255,92,92,0.5)',
          }} />
          {/* TC indicator */}
          <div style={{
            height: '100%', width: `${tcBar}%`,
            background: tcBarColor,
            borderRadius: 5,
            transition: 'width 0.4s ease, background 0.4s ease',
            boxShadow: `0 0 8px ${tcBarColor}60`,
          }} />
        </div>
      </div>

      {/* ── Count stats strip ─────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gap: 4, padding: '8px 0',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        marginBottom: 10,
      }}>
        <Stat label="True" val={tc >= 0 ? `+${tc.toFixed(1)}` : tc.toFixed(1)}
          col={tc >= 2 ? '#44e882' : tc < -1 ? '#ff5c5c' : '#ffd447'} />
        <Stat label="RC"   val={rc >= 0 ? `+${rc}` : String(rc)}
          col="#b0bfd8" />
        <Stat label="Edge" val={`${adv >= 0 ? '+' : ''}${(adv || 0).toFixed(1)}%`}
          col={adv >= 0 ? '#44e882' : '#ff5c5c'} />
        <Stat label="Decks" val={typeof decks === 'number' ? decks.toFixed(1) : decks}
          col="#94a7c4" />
      </div>

      {/* ── Main signal display ───────────────────────────────────────── */}
      <div style={{
        borderRadius: 10, overflow: 'hidden',
        border: `1.5px solid ${sigHex}40`,
        marginBottom: 10,
      }}>
        {/* Signal banner */}
        <div style={{
          padding: '14px 12px',
          background: `${sigHex}14`,
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '1.4rem', fontWeight: 800, letterSpacing: '0.08em',
            color: sigHex, fontFamily: 'Syne, sans-serif',
            textShadow: `0 0 18px ${sigHex}50`,
            marginBottom: 4,
            animation: signal === 'SIT DOWN NOW' ? 'wongPulse 1.5s ease-in-out infinite' : 'none',
          }}>
            {signal}
          </div>
          <div style={{ fontSize: 10, color: '#94a7c4' }}>
            {signal === 'SIT DOWN NOW' && 'TC ≥ +2 — shoe is player-favourable'}
            {signal === 'LEAVE TABLE'  && 'TC < −1 — shoe is dealer-favourable'}
            {signal === 'KEEP WATCHING' && 'TC between −1 and +2 — wait for the count to move'}
          </div>
        </div>

        {/* Delta sub-row */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          borderTop: `1px solid ${sigHex}20`,
        }}>
          <div style={{
            padding: '8px 10px', textAlign: 'center',
            borderRight: '1px solid rgba(255,255,255,0.07)',
          }}>
            <div style={{ fontSize: 9, color: '#94a7c4', marginBottom: 2 }}>
              Δ to sit (+2)
            </div>
            <div style={{
              fontSize: 14, fontWeight: 700, fontFamily: 'DM Mono, monospace',
              color: deltaEntry <= 0 ? '#44e882' : '#ffd447',
            }}>
              {deltaEntry <= 0 ? '✓ NOW' : `−${deltaEntry.toFixed(1)}`}
            </div>
          </div>
          <div style={{ padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#94a7c4', marginBottom: 2 }}>
              Δ to leave (−1)
            </div>
            <div style={{
              fontSize: 14, fontWeight: 700, fontFamily: 'DM Mono, monospace',
              color: deltaLeave < 0 ? '#ff5c5c' : '#94a7c4',
            }}>
              {deltaLeave < 0 ? '✗ NOW' : `+${deltaLeave.toFixed(1)}`}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mode note ─────────────────────────────────────────────────── */}
      <div style={{
        fontSize: 9, lineHeight: 1.7, color: '#94a7c4',
        padding: '6px 8px', borderRadius: 5,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}>
        {enabled ? (
          <>
            <span style={{ color: '#44e882', fontWeight: 700 }}>Wonging ON</span>
            {' '}— all detected cards counted as <em>seen</em>. Running count
            preserved. Sit when signal turns green.
          </>
        ) : (
          <>
            Enable wonging to watch a table and count without playing.
            Cards are tracked but <em>not</em> added to your hand.
            Count is <em>never</em> reset when toggling.
          </>
        )}
      </div>

      <style>{`
        @keyframes wongPulse {
          0%,100% { opacity:1; text-shadow: 0 0 18px currentColor; }
          50%      { opacity:0.75; text-shadow: 0 0 30px currentColor; }
        }
      `}</style>
    </div>
  );
}