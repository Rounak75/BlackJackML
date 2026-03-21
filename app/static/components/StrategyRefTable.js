/*
 * components/StrategyRefTable.js
 * ─────────────────────────────────────────────────────────
 * Compact three-tab basic strategy reference table.
 * Fits the full table on screen without scrolling.
 *
 * Tabs: Hard Totals / Soft Totals / Pairs
 * The current hand situation is highlighted with a gold outline.
 *
 * Props:
 *   playerHand   — player hand object from server
 *   dealerUpcard — dealer upcard string from server
 */

function StrategyRefTable({ playerHand, dealerUpcard }) {
  const { useState, useEffect } = React;
  const [tab, setTab]           = useState('hard');
  const [collapsed, setCollapsed] = useState(true);

  // ── Determine which cell to highlight ──────────────────────────
  let highlightKey = null;
  if (playerHand && dealerUpcard) {
    const dealerRank = dealerUpcard.slice(0, -1);
    const dealerVal  = dealerRank === 'A' ? 'A' : parseInt(dealerRank);
    const colIdx     = DEALER_COLS.indexOf(dealerVal);
    if (colIdx >= 0) {
      if (tab === 'hard' && !playerHand.is_soft) {
        const v    = Math.min(playerHand.value, 17);
        const keys = Object.keys(HARD_TABLE).map(Number);
        const ri   = keys.indexOf(v);
        if (ri >= 0) highlightKey = `hard-${ri}-${colIdx}`;
      } else if (tab === 'soft' && playerHand.is_soft) {
        const keys = Object.keys(SOFT_TABLE).map(Number);
        const ri   = keys.indexOf(playerHand.value);
        if (ri >= 0) highlightKey = `soft-${ri}-${colIdx}`;
      }
    }
  }

  // ── Auto-expand and switch to correct tab on live hand ─────────
  useEffect(() => {
    if (!playerHand || !dealerUpcard) return;
    if (playerHand.is_pair)       setTab('pair');
    else if (playerHand.is_soft)  setTab('soft');
    else                          setTab('hard');
    setCollapsed(false);
  }, [playerHand?.value, playerHand?.is_soft, playerHand?.is_pair, dealerUpcard]);

  // ── Render the strategy table ───────────────────────────────────
  const renderTable = () => {
    let rows, rowLabels, prefix;
    if (tab === 'hard') {
      rows      = Object.entries(HARD_TABLE);
      // Compact labels: "Hard 9" → "9", "Hard 17" → "17"
      rowLabels = rows.map(([k]) => k);
      prefix    = 'hard';
    } else if (tab === 'soft') {
      rows      = Object.entries(SOFT_TABLE);
      // Compact labels: "A,6" instead of "Soft 17"
      rowLabels = rows.map(([k]) => SOFT_LABELS[k] || k);
      prefix    = 'soft';
    } else {
      rows      = Object.entries(PAIR_TABLE);
      rowLabels = rows.map(([k]) => k);
      prefix    = 'pair';
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="strat-table-compact">
          <thead>
            <tr>
              {/* Empty corner cell */}
              <th className="strat-corner"></th>
              {DEALER_COLS.map(c => <th key={c} className="strat-th">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, cells], ri) => (
              <tr key={key}>
                <td className="strat-rlbl">{rowLabels[ri]}</td>
                {cells.map((cell, ci) => {
                  const ck = `${prefix}-${ri}-${ci}`;
                  return (
                    <td
                      key={ci}
                      className={`strat-cell ${cellClass(cell)} ${ck === highlightKey ? 'cell-hl' : ''}`}
                    >
                      {/* Shorten "SUR" to "Su" to save width */}
                      {cell === 'SUR' ? 'Su' : cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div
      className="rounded-xl p-2"
      style={{ background: '#1a2236', border: '1.5px solid rgba(255,255,255,0.12)' }}
    >
      {/* ── Header — click to expand/collapse ─────────────────── */}
      <div
        className="flex items-center justify-between"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setCollapsed(c => !c)}
      >
        <span
          className="font-display font-bold text-[9px] uppercase tracking-widest"
          style={{ color: '#94a7c4' }}
        >
          Basic Strategy Ref
        </span>
        <div className="flex items-center gap-1">
          {collapsed && (
            <span className="text-[9px] font-semibold" style={{ color: '#ffd447' }}>
              {tab === 'hard' ? 'Hard' : tab === 'soft' ? 'Soft' : 'Pairs'}
            </span>
          )}
          <span
            className="text-[9px] px-1 py-0.5 rounded"
            style={{
              background: '#212d45',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#94a7c4',
              display: 'inline-block',
              transition: 'transform 0.2s',
              transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
            }}
          >
            ▼
          </span>
        </div>
      </div>

      {/* ── Expandable body ───────────────────────────────────── */}
      {!collapsed && (
        <>
          {/* Tab row */}
          <div className="flex gap-1 mt-1.5 mb-1.5" onClick={e => e.stopPropagation()}>
            {['hard', 'soft', 'pair'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                aria-pressed={tab === t}
                aria-label={`Show ${t} strategy table`}
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: `1px solid ${tab === t ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)'}`,
                  background: tab === t ? '#212d45' : 'transparent',
                  color: tab === t ? '#f0f4ff' : '#94a7c4',
                  cursor: 'pointer',
                }}
              >
                {t === 'hard' ? 'Hard' : t === 'soft' ? 'Soft' : 'Pairs'}
              </button>
            ))}
          </div>

          {/* The table */}
          {renderTable()}

          {/* Pairs footnote */}
          {tab === 'pair' && (
            <div
              className="mt-1 text-[8px] px-1 py-0.5 rounded"
              style={{
                color: '#ffb347',
                background: 'rgba(255,160,40,0.08)',
                border: '1px solid rgba(255,160,40,0.25)',
              }}
            >
              No DAS · 1 split max · Split aces get 1 card
            </div>
          )}

          {/* Compact colour key — single row */}
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5">
            {[
              { cls: 's-H',   label: 'H' },
              { cls: 's-S',   label: 'S' },
              { cls: 's-D',   label: 'D' },
              { cls: 's-Ds',  label: 'Ds' },
              { cls: 's-SP',  label: 'SP' },
              { cls: 's-SUR', label: 'Su' },
            ].map(({ cls, label }) => (
              <span
                key={cls}
                className={`${cls}`}
                style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, fontFamily: 'DM Mono, monospace', fontWeight: 700 }}
              >
                {label}
              </span>
            ))}
            <span style={{ fontSize: 8, color: '#6b7fa3', alignSelf: 'center' }}>
              = Hit / Stand / Double / Dbl-Stand / Split / Surrender
            </span>
          </div>
        </>
      )}

      {/* Collapsed hint */}
      {collapsed && highlightKey && (
        <div className="mt-1 text-[9px]" style={{ color: '#ffd447' }}>
          ↑ Tap to see your highlighted cell
        </div>
      )}
    </div>
  );
}