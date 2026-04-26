/*
 * components/SessionStats.js
 * ─────────────────────────────────────────────────────────
 * Session win/loss/profit tracking with dealer vs player win breakdown.
 *
 * Props:
 *   session  — session object from server
 *   currency — { code, symbol, isCrypto, decimals } from App state
 */

function SessionStats({ session, currency }) {
  const s   = session || {};
  const cur = currency || { symbol: '$', isCrypto: false };
  const dec = cur.decimals || 2;
  const profit = s.total_profit || 0;

  const fmtMoney = (n) => {
    const abs = Math.abs(n || 0);
    const formatted = cur.isCrypto ? abs.toFixed(dec) : abs.toFixed(2);
    return `${(n || 0) >= 0 ? '+' : '-'}${cur.symbol}${formatted}`;
  };

  const wins   = s.wins   || 0;
  const losses = s.losses || 0;
  const pushes = s.pushes || 0;
  const total  = wins + losses + pushes || 1;

  // Dealer wins = player losses
  const playerWinPct = total > 0 ? ((wins / total) * 100).toFixed(0) : '0';
  const dealerWinPct = total > 0 ? ((losses / total) * 100).toFixed(0) : '0';
  const pushPct      = total > 0 ? ((pushes / total) * 100).toFixed(0) : '0';

  const hourlySymbol = cur.isCrypto
    ? `${cur.symbol}${(s.hourly_rate || 0).toFixed(dec)}`
    : `${cur.symbol}${Math.abs(s.hourly_rate || 0).toFixed(0)}`;

  return (
    <Widget title="Session Statistics">

      {/* Win/Loss/Push breakdown bars */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] font-mono mb-1">
          <span style={{ color: '#44e882' }}>You {playerWinPct}%</span>
          <span style={{ color: '#b8ccdf' }}>Push {pushPct}%</span>
          <span style={{ color: '#ff5c5c' }}>Dealer {dealerWinPct}%</span>
        </div>
        <div className="flex rounded-full overflow-hidden" style={{ height: 8, background: '#111827' }}>
          <div style={{ width: `${playerWinPct}%`, background: '#44e882', transition: 'width 0.4s' }} />
          <div style={{ width: `${pushPct}%`, background: '#6aafff', transition: 'width 0.4s' }} />
          <div style={{ width: `${dealerWinPct}%`, background: '#ff5c5c', transition: 'width 0.4s' }} />
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[
          { n: s.hands_played || 0,   l: 'Hands',    c: '#f0f4ff' },
          { n: fmtMoney(profit),       l: 'P&L',      c: profit >= 0 ? '#44e882' : '#ff5c5c' },
          { n: `${playerWinPct}%`,     l: 'Win Rate',  c: '#44e882' },
          { n: `${hourlySymbol}/hr`,   l: profit >= 0 ? cur.symbol+'/hr' : 'Rate', c: profit >= 0 ? '#44e882' : '#ff5c5c' },
        ].map(({ n, l, c }) => (
          <div key={l} className="rounded-lg p-2.5 text-center"
            style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="font-mono text-base font-bold" style={{ color: c }}>{n}</div>
            <div className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: '#b8ccdf' }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Win / Loss / Push breakdown */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>

        {/* You wins row */}
        <div className="flex items-center justify-between py-1 text-xs">
          <span className="font-semibold" style={{ color: '#44e882' }}>🏆 You Won</span>
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold" style={{ color: '#44e882' }}>{wins} hands</span>
            <span className="font-mono text-[10px]" style={{ color: '#b8ccdf' }}>{playerWinPct}%</span>
          </div>
        </div>

        {/* Dealer wins row */}
        <div className="flex items-center justify-between py-1 text-xs">
          <span className="font-semibold" style={{ color: '#ff5c5c', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Icon name="landmark" size={12} /> Dealer Won
          </span>
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold" style={{ color: '#ff5c5c' }}>{losses} hands</span>
            <span className="font-mono text-[10px]" style={{ color: '#b8ccdf' }}>{dealerWinPct}%</span>
          </div>
        </div>

        {/* Push row */}
        <div className="flex items-center justify-between py-1 text-xs">
          <span className="font-semibold" style={{ color: '#6aafff' }}>🤝 Push</span>
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold" style={{ color: '#6aafff' }}>{pushes} hands</span>
            <span className="font-mono text-[10px]" style={{ color: '#b8ccdf' }}>{pushPct}%</span>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 4, paddingTop: 6 }}>
          <KV label="Peak Bankroll"   value={`${cur.symbol}${Number(s.max_bankroll || 10000).toLocaleString()}`} />
          <KV label="Trough Bankroll" value={`${cur.symbol}${Number(s.min_bankroll || 10000).toLocaleString()}`} />
        </div>
      </div>
    </Widget>
  );
}


// PHASE 7 T4 — React.memo wrap. Script-mode reassignment of the
// function declaration keeps `function SessionStats(` intact for the
// build.sh smoke check while routing all consumers through memo.
if (typeof React !== 'undefined' && React.memo) {
  SessionStats = React.memo(SessionStats);
}
