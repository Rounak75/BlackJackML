/*
 * components/I18Panel.js
 * ─────────────────────────────────────────────────────────
 * Illustrious 18 + Fab 4 deviation cheat-sheet panel.
 * Rows glow gold when the current true count triggers them.
 *
 * Props:
 *   count — count object from server { true }
 */

function I18Panel({ count }) {
  // Use effective_true (IRC-adjusted) so KO deviations fire at correct thresholds
  const tc = count
    ? (typeof count.effective_true === 'number' ? count.effective_true : count.true)
    : 0;

  // Colour map for each action type
  const actColor = {
    STAND:     '#6aafff',
    HIT:       '#44e882',
    DOUBLE:    '#ffd447',
    SPLIT:     '#b99bff',
    SURRENDER: '#ff5c5c',
  };

  return (
    <Widget title="Illustrious 18 + Fab 4" badge="CHEAT SHEET" badgeColor="text-gold">
      <div style={{ maxHeight: 230, overflowY: 'auto' }}>
        {ALL_DEVIATIONS.map((d, i) => {
          const active = d.dir === '>=' ? tc >= d.thr : tc < d.thr;
          return (
            <div
              key={i}
              className="i18-row flex items-center justify-between px-2.5 py-1.5 rounded-md text-[10px] mb-1"
              style={{
                background: active ? 'rgba(255,212,71,0.08)' : '#111827',
                border: `1px solid ${active ? 'rgba(255,212,71,0.45)' : 'rgba(255,255,255,0.07)'}`,
              }}
            >
              <span
                className={`font-mono dev-sit font-semibold ${active ? '' : ''}`}
                style={{ color: active ? '#ffd447' : '#ccdaec', minWidth: 80 }}
              >
                {d.sit}
              </span>
              <span
                className="font-bold text-[10px]"
                style={{ color: actColor[d.act] || '#f0f4ff' }}
              >
                {d.act}
              </span>
              <span style={{ color: '#b8ccdf', fontSize: '0.7rem' }}>{d.tc}</span>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}