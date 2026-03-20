/*
 * components/SideBetPanel.js
 * ─────────────────────────────────────────────────────────
 * Side bet EV panel — compact card layout, always visible.
 * When any side bet flips +EV a persistent alert popup fires.
 *
 * Insurance has been removed from this panel — it is a core game
 * mechanic, not a side bet. It is displayed in HandDisplay.js inside
 * the dealer zone, only when the dealer upcard is an Ace.
 *
 * Props:
 *   sideBets — side_bets object from server (Perfect Pairs, 21+3,
 *              Lucky Ladies only — no insurance)
 */

function SideBetPanel({ sideBets }) {
  const { useState, useEffect, useRef } = React;
  const [alerts, setAlerts]       = useState([]);
  const [dismissed, setDismissed] = useState({});   // key → true once user dismisses
  const prevRec = useRef({});

  // Insurance removed — it is a game mechanic handled in HandDisplay,
  // not an optional side bet. Only true side bets listed here.
  const bets = [
    {
      key:  'perfect_pairs',
      icon: '👯',
      name: 'Perfect Pairs',
      short: 'PP',
      data:  sideBets?.perfect_pairs,
      desc:  'Your first 2 cards form a pair',
      payout: 'up to 25:1',
      color: '#b99bff',
    },
    {
      key:  'twenty_one_plus_3',
      icon: '🃏',
      name: '21+3',
      short: '21+3',
      data:  sideBets?.twenty_one_plus_3,
      desc:  'Your 2 cards + dealer upcard = poker hand',
      payout: 'up to 100:1',
      color: '#ffd447',
    },
    {
      key:  'lucky_ladies',
      icon: '👑',
      name: 'Lucky Ladies',
      short: 'LL',
      data:  sideBets?.lucky_ladies,
      desc:  'Your first 2 cards total 20',
      payout: 'up to 1000:1',
      color: '#ff9a20',
    },
  ];

  // Detect transitions to +EV and fire alerts
  useEffect(() => {
    if (!sideBets) return;
    const newAlerts = [];
    bets.forEach(({ key, name, icon, data, desc, payout, color }) => {
      const rec = data && data.recommended;
      const wasRec = prevRec.current[key];
      // Just flipped to recommended AND not already dismissed this session
      if (rec && !wasRec && !dismissed[key]) {
        newAlerts.push({ key, name, icon, desc, payout, color,
          ev: data.ev, reason: data.reason || '' });
      }
      prevRec.current[key] = rec;
    });
    if (newAlerts.length > 0) {
      setAlerts(prev => {
        const existing = new Set(prev.map(a => a.key));
        return [...prev, ...newAlerts.filter(a => !existing.has(a.key))];
      });
    }
    // Remove alerts for bets that are no longer recommended
    setAlerts(prev => prev.filter(a => {
      const d = sideBets?.[a.key];
      return d && d.recommended;
    }));
  }, [sideBets]);

  const dismissAlert = (key) => {
    setAlerts(prev => prev.filter(a => a.key !== key));
    setDismissed(prev => ({ ...prev, [key]: true }));
  };

  const urgencyLevel = (ev) => {
    if (ev >= 5)  return { label: '🔥 HIGH',   color: '#ff5c5c', bg: 'rgba(255,92,92,0.15)'   };
    if (ev >= 2)  return { label: '⚡ MEDIUM', color: '#ffd447', bg: 'rgba(255,212,71,0.15)'  };
    return              { label: '📈 LOW',    color: '#44e882', bg: 'rgba(68,232,130,0.12)' };
  };

  return (
    <>
      {/* ── Alert popups ─────────────────────────────────── */}
      {alerts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            right: 16,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxWidth: 320,
          }}
        >
          {alerts.map(alert => {
            const urg = urgencyLevel(alert.ev || 0);
            return (
              <div
                key={alert.key}
                style={{
                  background: '#1a2236',
                  border: `2px solid ${alert.color}`,
                  borderRadius: 14,
                  padding: '14px 16px',
                  boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${alert.color}33`,
                  animation: 'slideInRight 0.3s ease',
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: '1.3rem' }}>{alert.icon}</span>
                    <div>
                      <div className="font-display font-bold text-sm" style={{ color: '#f0f4ff' }}>
                        {alert.name}
                      </div>
                      <div
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: urg.bg, color: urg.color, display: 'inline-block' }}
                      >
                        {urg.label} EV OPPORTUNITY
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => dismissAlert(alert.key)}
                    style={{ color: '#7a8eab', fontSize: '1rem', lineHeight: 1, padding: '2px 6px' }}
                  >
                    ✕
                  </button>
                </div>

                {/* EV value */}
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-mono font-extrabold text-2xl" style={{ color: alert.color }}>
                    +{(alert.ev || 0).toFixed(1)}%
                  </span>
                  <span className="text-xs" style={{ color: '#7a8eab' }}>Expected Value</span>
                </div>

                {/* Description */}
                <div className="text-xs mb-2" style={{ color: '#b0bfd8' }}>
                  {alert.desc} · Pays {alert.payout}
                </div>

                {/* Reason */}
                {alert.reason && (
                  <div
                    className="text-[10px] px-2 py-1 rounded-lg font-mono"
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#7a8eab' }}
                  >
                    {alert.reason}
                  </div>
                )}

                {/* Action hint */}
                <div
                  className="mt-2 text-[11px] font-semibold text-center py-1 rounded-lg"
                  style={{ background: `${alert.color}22`, color: alert.color, border: `1px solid ${alert.color}44` }}
                >
                  ⚡ Place this side bet before cards are dealt!
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Main panel ───────────────────────────────────── */}
      <Widget title="Side Bet EV" badge={alerts.length > 0 ? `${alerts.length} ACTIVE` : undefined}
        badgeColor={alerts.length > 0 ? 'text-jade' : undefined}>

        {/* Compact grid of bet cards — 3 bets so use single column on small, 
            or keep 1fr 1fr and let Lucky Ladies span naturally */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {bets.map(({ key, icon, name, short, data, payout, color }) => {
            const ev  = data ? (data.ev  || 0) : null;
            const rec = data && data.recommended;
            const isPos = ev !== null && ev >= 0;

            return (
              <div
                key={key}
                className="rounded-xl p-2.5 transition-all"
                style={{
                  background: rec
                    ? `linear-gradient(135deg, ${color}18, ${color}08)`
                    : '#111827',
                  border: `1.5px solid ${rec ? color : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: rec ? `0 0 12px ${color}22` : 'none',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Pulse dot when recommended */}
                {rec && (
                  <div style={{
                    position: 'absolute', top: 6, right: 6,
                    width: 7, height: 7, borderRadius: '50%',
                    background: color, animation: 'pulse 1.5s ease-in-out infinite',
                  }} />
                )}

                {/* Icon + short name */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span style={{ fontSize: '0.9rem' }}>{icon}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide"
                    style={{ color: rec ? color : '#7a8eab' }}>
                    {short}
                  </span>
                </div>

                {/* EV value — big */}
                <div className="font-mono font-extrabold leading-none mb-1"
                  style={{
                    fontSize: '1.1rem',
                    color: ev !== null ? (isPos ? '#44e882' : '#ff5c5c') : '#4a5568',
                  }}>
                  {ev !== null ? `${ev >= 0 ? '+' : ''}${ev.toFixed(1)}%` : '—'}
                </div>

                {/* Payout & status */}
                <div className="text-[9px]" style={{ color: '#7a8eab' }}>
                  {payout}
                </div>

                {/* Status badge */}
                <div className="mt-1.5">
                  {rec ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
                      ✓ BET NOW
                    </span>
                  ) : (
                    <span className="text-[9px]" style={{ color: '#4a5568' }}>
                      skip
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Extra details for recommended bets */}
        {bets.some(b => b.data && b.data.recommended) && (
          <div className="mt-3 space-y-1.5">
            <div className="text-[9px] uppercase tracking-widest font-bold mb-1"
              style={{ color: '#7a8eab' }}>
              Active opportunities
            </div>
            {bets.filter(b => b.data && b.data.recommended).map(({ key, icon, name, data, color }) => (
              <div key={key}
                className="flex items-center justify-between px-2.5 py-2 rounded-lg"
                style={{ background: `${color}12`, border: `1px solid ${color}33` }}>
                <div className="flex items-center gap-2">
                  <span>{icon}</span>
                  <span className="text-xs font-semibold" style={{ color }}>{name}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-xs" style={{ color: '#44e882' }}>
                    +{(data.ev || 0).toFixed(1)}% EV
                  </div>
                  {data.reason && (
                    <div className="text-[9px]" style={{ color: '#7a8eab' }}>{data.reason}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* All negative — small hint */}
        {bets.every(b => !b.data || !b.data.recommended) && (
          <div className="mt-2 text-center text-[10px]" style={{ color: '#4a5568' }}>
            No +EV side bets right now — skip all
          </div>
        )}
      </Widget>

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(60px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  );
}