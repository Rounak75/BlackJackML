/*
 * components/ZoneConfigPanel.js — Screen Zone Config + Seat Presets (Features 1 & 3)
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 * Feature 1: Configurable Screen Zones
 * Feature 3: Table Position Intelligence (Seat Presets)
 *
 * WHAT IS THIS?
 * ─────────────
 * The Live Scanner divides the capture area into horizontal zones to route
 * detected cards to the correct hand:
 *
 *   ┌─────────────────────────────────────────────────┐
 *   │  YOUR HAND  │     DEALER     │  OTHER PLAYERS   │
 *   │  (player)   │    (dealer)    │     (seen)        │
 *   └─────────────────────────────────────────────────┘
 *   0%        player_end%       dealer_end%          100%
 *
 * By default: player_end=33%, dealer_end=66%, giving equal thirds.
 *
 * SEAT PRESETS (Feature 3):
 * Seat 1 (far left)  → player cards are leftmost → player_end is small
 * Seat 7 (far right) → player cards are rightmost → player_end shifts right
 *
 * This correctly models how the table looks from a camera perspective:
 * your cards always appear at your seat position on screen.
 *
 * Props:
 *   socket      SocketIO connection
 *   zoneConfig  { player_end: float, dealer_end: float } from server state
 *   onApply     optional callback after applying (for toasts etc.)
 */

function ZoneConfigPanel({ zoneConfig, onApply }) {
  // PHASE 7 T3: socket from context.
  var socket = React.useContext(window.SocketContext);

  // Local editable copies of the zone boundaries (as percentages 0-100)
  const [playerEnd, setPlayerEnd] = React.useState(
    Math.round((zoneConfig?.player_end ?? 0.33) * 100)
  );
  const [dealerEnd, setDealerEnd] = React.useState(
    Math.round((zoneConfig?.dealer_end ?? 0.66) * 100)
  );
  const [activeSeat, setActiveSeat] = React.useState(null);  // null = custom
  const [dirty, setDirty]           = React.useState(false);

  // Sync from server state when it changes (e.g. another tab set zones)
  React.useEffect(() => {
    if (!zoneConfig) return;
    const pe = Math.round((zoneConfig.player_end) * 100);
    const de = Math.round((zoneConfig.dealer_end) * 100);
    setPlayerEnd(pe);
    setDealerEnd(de);
    setDirty(false);
  }, [zoneConfig?.player_end, zoneConfig?.dealer_end]);

  // ── Seat preset definitions (mirrors Python _SEAT_PRESETS) ─────────────
  // Designed for a 7-seat table. Zones shift with seat position.
  // Dealer is always roughly in the centre of the screen.
  const SEAT_PRESETS = [
    { seat: 1, label: '1', hint: 'Far left',   player_end: 0.20, dealer_end: 0.55 },
    { seat: 2, label: '2', hint: 'Left',        player_end: 0.24, dealer_end: 0.58 },
    { seat: 3, label: '3', hint: 'Centre-left', player_end: 0.28, dealer_end: 0.61 },
    { seat: 4, label: '4', hint: 'Centre',      player_end: 0.33, dealer_end: 0.66 },
    { seat: 5, label: '5', hint: 'Centre-right',player_end: 0.40, dealer_end: 0.72 },
    { seat: 6, label: '6', hint: 'Right',       player_end: 0.48, dealer_end: 0.78 },
    { seat: 7, label: '7', hint: 'Far right',   player_end: 0.56, dealer_end: 0.84 },
  ];

  // Apply seat preset
  const handleSeatPreset = (preset) => {
    setActiveSeat(preset.seat);
    setPlayerEnd(Math.round(preset.player_end * 100));
    setDealerEnd(Math.round(preset.dealer_end * 100));
    setDirty(true);

    // Emit immediately (seat presets are single-click apply)
    if (socket?.connected) {
      socket.emit('set_seat_preset', { seat: preset.seat });
    } else {
      fetch('/api/seat_preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seat: preset.seat }),
      }).catch(() => {});
    }
    if (onApply) onApply(`Seat ${preset.seat} preset applied`);
    setDirty(false);
  };

  // Apply manual zone values
  const handleApply = () => {
    // Clamp and validate
    let pe = Math.max(1, Math.min(99, playerEnd));
    let de = Math.max(pe + 1, Math.min(100, dealerEnd));
    setPlayerEnd(pe);
    setDealerEnd(de);
    setActiveSeat(null);  // no longer on a preset

    if (socket?.connected) {
      socket.emit('set_zones', {
        player_end: pe / 100,
        dealer_end: de / 100,
      });
    } else {
      fetch('/api/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_end: pe / 100, dealer_end: de / 100 }),
      }).catch(() => {});
    }
    if (onApply) onApply(`Zones updated: player<${pe}% dealer<${de}%`);
    setDirty(false);
  };

  // Seen zone is always the remainder
  const seenZone = 100 - dealerEnd;

  // ── Zone visualiser bar ──────────────────────────────────────────────────
  const ZoneBar = () => (
    <div style={{
      height: 28, borderRadius: 6, overflow: 'hidden',
      display: 'flex', marginBottom: 8,
      border: '1px solid rgba(255,255,255,0.1)',
    }} aria-label={`Zone preview: player ${playerEnd}%, dealer ${dealerEnd - playerEnd}%, other ${seenZone}%`}>
      {/* Player zone */}
      <div style={{
        width: `${playerEnd}%`, background: 'rgba(68,232,130,0.25)',
        borderRight: '2px solid #44e882',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 700, color: '#44e882',
        overflow: 'hidden', whiteSpace: 'nowrap',
        transition: 'width 0.25s ease',
        minWidth: 0,
      }}>
        {playerEnd >= 12 && `You ${playerEnd}%`}
      </div>
      {/* Dealer zone */}
      <div style={{
        width: `${dealerEnd - playerEnd}%`, background: 'rgba(255,212,71,0.18)',
        borderRight: '2px solid #ffd447',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 700, color: '#ffd447',
        overflow: 'hidden', whiteSpace: 'nowrap',
        transition: 'width 0.25s ease',
        minWidth: 0,
      }}>
        {(dealerEnd - playerEnd) >= 12 && `Dealer ${dealerEnd - playerEnd}%`}
      </div>
      {/* Seen zone */}
      <div style={{
        flex: 1, background: 'rgba(185,155,255,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 700, color: '#b99bff',
        overflow: 'hidden', whiteSpace: 'nowrap',
        transition: 'width 0.25s ease',
        minWidth: 0,
      }}>
        {seenZone >= 12 && `Others ${seenZone}%`}
      </div>
    </div>
  );

  return (
    <div className="widget-card" role="region" aria-labelledby="wgt-zone-config"
      style={{ borderLeft: '3px solid #6aafff' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <span id="wgt-zone-config" className="widget-title">Zone & Seat Config</span>
        {dirty && (
          <span className="font-mono text-[9px] border rounded px-2 py-0.5"
            style={{ color: '#ffd447', borderColor: 'rgba(255,212,71,0.4)',
              background: 'rgba(255,212,71,0.08)' }}>
            UNSAVED
          </span>
        )}
      </div>

      {/* ── Seat preset buttons (Feature 3) ───────────────────────────── */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 9, color: '#94a7c4', marginBottom: 5,
          textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Table seat position
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {SEAT_PRESETS.map(preset => {
            const isActive = activeSeat === preset.seat;
            return (
              <button
                key={preset.seat}
                onClick={() => handleSeatPreset(preset)}
                aria-pressed={isActive}
                aria-label={`Seat ${preset.seat}: ${preset.hint}`}
                title={`Seat ${preset.seat} — ${preset.hint}\nPlayer zone: 0–${Math.round(preset.player_end*100)}%\nDealer zone: ${Math.round(preset.player_end*100)}–${Math.round(preset.dealer_end*100)}%`}
                style={{
                  flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 700,
                  borderRadius: 5, cursor: 'pointer', transition: 'all 0.12s',
                  background: isActive ? 'rgba(106,175,255,0.2)' : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${isActive ? 'rgba(106,175,255,0.7)' : 'rgba(255,255,255,0.08)'}`,
                  color: isActive ? '#6aafff' : '#94a7c4',
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 8, color: '#6a7f99', marginTop: 3 }}>
          Seat 1 = far left → Seat 7 = far right (zones shift automatically)
        </div>
      </div>

      {/* ── Zone visualiser ────────────────────────────────────────────── */}
      <ZoneBar />

      {/* ── Manual sliders ────────────────────────────────────────────── */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 9, color: '#94a7c4', marginBottom: 5,
          textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Manual zone boundaries
        </div>

        {/* Player end slider */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
            fontSize: 10, marginBottom: 3 }}>
            <label htmlFor="zone-player-end"
              style={{ color: '#44e882', fontWeight: 600 }}>
              Your zone ends at
            </label>
            <span style={{ color: '#44e882', fontFamily: 'DM Mono, monospace',
              fontWeight: 700 }}>{playerEnd}%</span>
          </div>
          <input
            id="zone-player-end"
            type="range" min={1} max={Math.min(98, dealerEnd - 1)}
            value={playerEnd}
            onChange={e => {
              setPlayerEnd(Number(e.target.value));
              setActiveSeat(null);
              setDirty(true);
            }}
            style={{ width: '100%', accentColor: '#44e882' }}
            aria-label={`Player zone ends at ${playerEnd}%`}
          />
        </div>

        {/* Dealer end slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between',
            fontSize: 10, marginBottom: 3 }}>
            <label htmlFor="zone-dealer-end"
              style={{ color: '#ffd447', fontWeight: 600 }}>
              Dealer zone ends at
            </label>
            <span style={{ color: '#ffd447', fontFamily: 'DM Mono, monospace',
              fontWeight: 700 }}>{dealerEnd}%</span>
          </div>
          <input
            id="zone-dealer-end"
            type="range" min={playerEnd + 1} max={99}
            value={dealerEnd}
            onChange={e => {
              setDealerEnd(Number(e.target.value));
              setActiveSeat(null);
              setDirty(true);
            }}
            style={{ width: '100%', accentColor: '#ffd447' }}
            aria-label={`Dealer zone ends at ${dealerEnd}%`}
          />
        </div>
      </div>

      {/* ── Zone legend ────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 4, marginBottom: 10, fontSize: 9,
      }}>
        {[
          { label: 'Your hand', range: `0–${playerEnd}%`,
            col: '#44e882', bg: 'rgba(68,232,130,0.08)' },
          { label: 'Dealer',    range: `${playerEnd}–${dealerEnd}%`,
            col: '#ffd447', bg: 'rgba(255,212,71,0.08)' },
          { label: 'Others',    range: `${dealerEnd}–100%`,
            col: '#b99bff', bg: 'rgba(185,155,255,0.08)' },
        ].map(({ label, range, col, bg }) => (
          <div key={label} style={{
            padding: '5px 6px', borderRadius: 5, background: bg,
            border: `1px solid ${col}30`, textAlign: 'center',
          }}>
            <div style={{ color: col, fontWeight: 700, marginBottom: 1 }}>{label}</div>
            <div style={{ color: '#94a7c4' }}>{range}</div>
          </div>
        ))}
      </div>

      {/* ── Apply button ────────────────────────────────────────────────── */}
      {dirty && (
        <button
          onClick={handleApply}
          aria-label="Apply custom zone boundaries"
          style={{
            width: '100%', padding: '8px 0', fontSize: 11, fontWeight: 700,
            borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s',
            background: 'rgba(106,175,255,0.12)',
            border: '1.5px solid rgba(106,175,255,0.55)',
            color: '#6aafff',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(106,175,255,0.22)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(106,175,255,0.12)'; }}
        >
          ✓ Apply Zones
        </button>
      )}
    </div>
  );
}