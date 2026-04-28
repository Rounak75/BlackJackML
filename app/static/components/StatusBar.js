/*
 * components/StatusBar.js
 * ─────────────────────────────────────────────────────────
 * PHASE 2 — Sticky bottom status strip (28px). One row, glanceable.
 * PHASE 3 — Adds Wong cue.
 *
 * Cells: hands · pen% · wong · model · last update · ? hotkeys
 *
 * Props:
 *   session      — { hands_played }
 *   count        — { penetration, true }
 *   wonging      — { enabled, signal, signal_color }
 *   mlModelInfo  — { loaded }
 *   lastUpdateAgo — number (seconds) or null
 *   onShowHelp   — fn() to open hotkey overlay (Phase 8)
 *   betting      — { risk_of_ruin } (Phase 8.4)
 */

function StatusBar({ session, count, wonging, mlModelInfo, lastUpdateAgo, onShowHelp, betting }) {
  const hands = (session && session.hands_played) || 0;
  const penPct = (count && count.penetration != null) ? Math.round(count.penetration) : null;
  const tc = (count && (typeof count.effective_true === 'number'
              ? count.effective_true : count.true)) || 0;

  // Pen color
  const penColor = penPct == null ? '#6b7f96'
                : penPct >= 80 ? '#ff5c5c'
                : penPct >= 70 ? '#ffd447'
                : '#88a8c8';

  // Wong cue: if wonging is active, use its signal; otherwise compute a passive
  // hint from TC so a pro can see "would Wong" even with the feature off.
  const wongActive = !!(wonging && wonging.enabled);
  const SIG_COL = { jade: '#44e882', ruby: '#ff5c5c', gold: '#ffd447' };
  let wongLabel, wongCol;
  if (wongActive) {
    wongLabel = wonging.signal || 'WATCHING';
    wongCol = SIG_COL[wonging.signal_color] || '#ffd447';
  } else if (tc >= 2) {
    wongLabel = 'WOULD SIT'; wongCol = '#88eebb';
  } else if (tc <= -1) {
    wongLabel = 'WOULD LEAVE'; wongCol = '#ff8888';
  } else {
    wongLabel = 'NEUTRAL'; wongCol = '#6b7f96';
  }

  const modelLoaded = !!(mlModelInfo && mlModelInfo.loaded);
  const updateText = lastUpdateAgo == null ? '—'
                   : lastUpdateAgo < 2 ? 'live'
                   : `${lastUpdateAgo}s ago`;

  const cell = (label, value, color) => (
    React.createElement('div', {
      style: {
        display: 'flex', alignItems: 'baseline', gap: 5,
        padding: '0 10px',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        whiteSpace: 'nowrap',
      }
    },
      React.createElement('span', {
        style: {
          fontSize: 8, fontWeight: 700, color: '#6b7f96',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }
      }, label),
      React.createElement('span', {
        style: {
          fontSize: 11, fontWeight: 700, color: color || '#ccdaec',
          fontFamily: 'DM Mono, monospace', fontVariantNumeric: 'tabular-nums',
        }
      }, value)
    )
  );

  return React.createElement('div', {
    role: 'status',
    'aria-label': 'Session status bar',
    style: {
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
      display: 'flex', alignItems: 'center',
      height: 28,
      background: 'rgba(13,19,32,0.95)',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      backdropFilter: 'blur(8px)',
      color: '#ccdaec',
    },
  },
    cell('Hands', hands),
    cell('Pen', penPct != null ? `${penPct}%` : '—', penColor),
    cell('Wong', wongLabel, wongCol),
    // PHASE 8.4: Risk-of-Ruin cell — color-bucketed
    (function() {
      const ror = betting && typeof betting.risk_of_ruin === 'number' ? betting.risk_of_ruin : null;
      const rorCol = ror == null ? '#6b7f96'
                   : ror <= 5  ? '#44e882'
                   : ror <= 15 ? '#ffd447'
                   : '#ff5c5c';
      return cell('RoR', ror == null ? '—' : `${ror.toFixed(1)}%`, rorCol);
    })(),
    cell('AI', modelLoaded ? 'ML' : 'Basic', modelLoaded ? '#44e882' : '#94a7c4'),
    cell('Update', updateText, '#94a7c4'),

    // Right cluster — push to end
    React.createElement('div', { style: { flex: 1 } }),
    React.createElement('button', {
      onClick: onShowHelp,
      'aria-label': 'Show keyboard shortcuts',
      title: 'Keyboard shortcuts (?)',
      style: {
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '0 12px', height: '100%',
        background: 'transparent', border: 'none',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        color: '#94a7c4', cursor: 'pointer',
        fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
        textTransform: 'uppercase',
      },
    },
      React.createElement('span', {
        style: { fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#ffd447' }
      }, '?'),
      'hotkeys'
    )
  );
}


// PHASE 7 T4 — React.memo wrap. Script-mode reassignment of the
// function declaration keeps `function StatusBar(` intact for the
// build.sh smoke check while routing all consumers through memo.
if (typeof React !== 'undefined' && React.memo) {
  StatusBar = React.memo(StatusBar);
}
