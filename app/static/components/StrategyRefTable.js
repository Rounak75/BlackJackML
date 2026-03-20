/*
 * components/StrategyRefTable.js
 * ─────────────────────────────────────────────────────────
 * Three-tab basic strategy reference table.
 * Tabs: Hard Totals / Soft Totals / Pairs
 * The current hand situation is highlighted with a gold outline.
 *
 * Props:
 *   playerHand  — player hand object
 *   dealerUpcard — dealer upcard string
 */

function StrategyRefTable({ playerHand, dealerUpcard }) {
  const { useState, useEffect } = React;
  const [tab, setTab] = useState('hard');
  const [collapsed, setCollapsed] = useState(true);

  // Determine which cell to highlight
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

  // Auto-expand and switch to correct tab when a live hand situation is detected
  useEffect(() => {
    if (!playerHand || !dealerUpcard) return;
    if (playerHand.is_pair) {
      setTab('pair');
    } else if (playerHand.is_soft) {
      setTab('soft');
    } else {
      setTab('hard');
    }
    setCollapsed(false);
  }, [playerHand?.value, playerHand?.is_soft, playerHand?.is_pair, dealerUpcard]);

  const renderTable = () => {
    let rows, rowLabels, prefix;
    if (tab === 'hard') {
      rows      = Object.entries(HARD_TABLE);
      rowLabels = rows.map(([k]) => `Hard ${k}`);
      prefix    = 'hard';
    } else if (tab === 'soft') {
      rows      = Object.entries(SOFT_TABLE);
      rowLabels = rows.map(([k]) => SOFT_LABELS[k] || `Soft ${k}`);
      prefix    = 'soft';
    } else {
      rows      = Object.entries(PAIR_TABLE);
      rowLabels = rows.map(([k]) => k);
      prefix    = 'pair';
    }

    return (
      <div className="overflow-x-auto">
        <table className="strat-table">
          <thead>
            <tr>
              <th></th>
              {DEALER_COLS.map(c => <th key={c}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, cells], ri) => (
              <tr key={key}>
                <td className="rlbl">{rowLabels[ri]}</td>
                {cells.map((cell, ci) => {
                  const ck = `${prefix}-${ri}-${ci}`;
                  return (
                    <td key={ci} className={`${cellClass(cell)} ${ck === highlightKey ? 'cell-hl' : ''}`}>
                      {cell}
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
      className="rounded-xl p-3"
      style={{ background: '#1a2236', border: '1.5px solid rgba(255,255,255,0.12)' }}
    >
      {/* Header — always visible, click anywhere to expand/collapse */}
      <div
        className="flex items-center justify-between"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setCollapsed(c => !c)}
      >
        <span
          className="font-display font-bold text-[10px] uppercase tracking-widest"
          style={{ color: '#7a8eab' }}
        >
          Basic Strategy Ref
        </span>
        <div className="flex items-center gap-1">
          {/* Highlight current tab label when collapsed so user knows what's shown */}
          {collapsed && (
            <span className="text-[10px] font-semibold" style={{ color: '#ffd447' }}>
              {tab === 'hard' ? 'Hard' : tab === 'soft' ? 'Soft' : 'Pairs'}
            </span>
          )}
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-md"
            style={{
              background: '#212d45',
              border: '1.5px solid rgba(255,255,255,0.15)',
              color: '#7a8eab',
              transition: 'transform 0.2s',
              display: 'inline-block',
              transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
            }}
          >
            ▼
          </span>
        </div>
      </div>

      {/* Expandable body */}
      {!collapsed && (
        <>
          {/* Tab row — stop propagation so clicking tabs doesn’t collapse */}
          <div className="flex gap-1 mt-2 mb-2" onClick={e => e.stopPropagation()}>
            {['hard', 'soft', 'pair'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="text-[10px] uppercase font-semibold px-2.5 py-1 rounded-md transition-all"
                style={{
                  background: tab === t ? '#212d45' : 'transparent',
                  border: `1.5px solid ${tab === t ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)'}`,
                  color: tab === t ? '#f0f4ff' : '#7a8eab',
                }}
              >
                {t === 'hard' ? 'Hard' : t === 'soft' ? 'Soft' : 'Pairs'}
              </button>
            ))}
          </div>
          {renderTable()}
          {/* Color key */}
          <div className="flex flex-wrap gap-1 mt-2">
            {[
              { cls: 's-H',   label: 'H = Hit' },
              { cls: 's-S',   label: 'S = Stand' },
              { cls: 's-D',   label: 'D = Double' },
              { cls: 's-Ds',  label: 'Ds = Dbl/Stand' },
              { cls: 's-SP',  label: 'SP = Split' },
              { cls: 's-SUR', label: 'SUR = Surrender' },
            ].map(({ cls, label }) => (
              <span key={cls} className={`${cls} text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold`}>
                {label}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Collapsed hint — show current-hand highlight summary */}
      {/* No-DAS note: only shown when pairs tab active */}
      {!collapsed && tab === 'pair' && (
        <div className="mt-1 text-[9px] px-1 py-0.5 rounded" style={{ color: '#ffb347', background: 'rgba(255,160,40,0.1)', border: '1px solid rgba(255,160,40,0.3)' }}>
          No Double After Split · Only 1 split per hand · Split Aces get 1 card each
        </div>
      )}
      {collapsed && highlightKey && (
        <div className="mt-1.5 text-[10px]" style={{ color: '#ffd447' }}>
          ↑ Tap to see your highlighted cell
        </div>
      )}
    </div>
  );
}