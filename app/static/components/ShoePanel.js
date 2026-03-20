/*
 * components/ShoePanel.js
 * ─────────────────────────────────────────────────────────
 * Shoe composition: one bar per rank showing how many
 * cards remain, plus a penetration progress bar.
 *
 * Props:
 *   shoe — shoe object from server
 */

function ShoePanel({ shoe }) {
  if (!shoe) {
    return (
      <Widget title="Shoe Composition">
        <div className="text-xs" style={{ color: '#7a8eab' }}>Loading…</div>
      </Widget>
    );
  }

  const ranks  = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
  const keys   = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const maxPR  = [32, 32, 32, 32, 32, 32, 32, 32, 128, 32];  // 8 decks: 4×8=32, 10-vals 16×8=128
  const pct    = shoe.penetration;

  const statusTxt = pct >= 75 ? 'SHUFFLE SOON' : pct >= 50 ? 'MID SHOE' : 'FRESH';
  const statusStyle = {
    color:      pct >= 75 ? '#ff5c5c' : pct >= 50 ? '#ffd447' : '#44e882',
    background: pct >= 75 ? 'rgba(255,92,92,0.1)' : pct >= 50 ? 'rgba(255,212,71,0.1)' : 'rgba(68,232,130,0.1)',
    border:     `1px solid ${pct >= 75 ? 'rgba(255,92,92,0.3)' : pct >= 50 ? 'rgba(255,212,71,0.3)' : 'rgba(68,232,130,0.3)'}`,
  };

  return (
    <Widget title="Shoe Composition">
      {/* Meta row */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[11px]" style={{ color: '#b0bfd8' }}>
          {shoe.cards_remaining} cards · {shoe.decks_remaining} decks
        </span>
        <span
          className="font-mono text-[9px] px-2 py-0.5 rounded font-bold"
          style={statusStyle}
        >
          {statusTxt}
        </span>
      </div>

      {/* Rank bars */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(10, 1fr)',
          gap: '4px',
          marginBottom: 12,
        }}
      >
        {keys.map((key, i) => {
          const rem  = (shoe.remaining_by_rank && shoe.remaining_by_rank[key]) || 0;
          const pct2 = Math.min(100, (rem / maxPR[i]) * 100);
          const cls  = [10, 11].includes(key) ? 'high' : [2, 3, 4, 5, 6].includes(key) ? 'low' : 'mid';
          return (
            <div key={key} className="text-center">
              <div
                className="text-[9px] font-mono mb-1"
                style={{ color: '#b0bfd8', fontWeight: 600 }}
              >
                {ranks[i]}
              </div>
              <div
                style={{
                  height: 52,
                  background: '#111827',
                  borderRadius: 3,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div className={`shoe-bar ${cls}`} style={{ height: `${pct2}%` }} />
              </div>
              <div
                className="text-[9px] font-mono mt-1"
                style={{ color: '#7a8eab' }}
              >
                {rem}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ten-value richness indicator */}
      {shoe.remaining_by_rank && (() => {
        const tenRem  = shoe.remaining_by_rank[10] || 0;
        const totalRem = shoe.cards_remaining || 1;
        const tenPct  = (tenRem / totalRem * 100).toFixed(1);
        const isRich  = tenRem / totalRem > 0.308;  // above baseline 30.8%
        return (
          <div className="flex items-center justify-between mb-2 text-[10px] font-mono"
            style={{ color: isRich ? '#ffd447' : '#7a8eab' }}>
            <span>10-value cards</span>
            <span style={{ fontWeight: 700, color: isRich ? '#ffd447' : '#b0bfd8' }}>
              {tenPct}% {isRich ? '↑ Rich' : ''}
            </span>
          </div>
        );
      })()}

      {/* Penetration bar */}
      <div
        style={{ height: 7, background: '#111827', borderRadius: 999, overflow: 'hidden', marginBottom: 5 }}
      >
        <div className="pen-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="font-mono text-[10px]" style={{ color: '#b0bfd8' }}>
        {pct}% penetration
      </div>
    </Widget>
  );
}