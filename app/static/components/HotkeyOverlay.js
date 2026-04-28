/*
 * components/HotkeyOverlay.js
 * ─────────────────────────────────────────────────────────
 * PHASE 4 — Modal hotkey reference. Triggered by `?`, closed by Esc / click
 * on backdrop / clicking the close button. Pure render — does not capture
 * any keys; App.jsx owns the global handler.
 *
 * Props:
 *   isOpen   — bool
 *   onClose  — fn()
 */

function HotkeyOverlay({ isOpen, onClose }) {
  if (!isOpen) return null;

  // Categories — mirror App.jsx keymap exactly.
  const SECTIONS = [
    {
      title: 'Card Entry',
      rows: [
        ['2 – 9', 'Open suit picker for that rank'],
        ['0', 'Open suit picker for 10'],
        ['1', 'Open suit picker for A'],
        ['J / Q / K', 'Open suit picker for face card'],
        ['1 / 2 / 3 / 4', 'In suit picker: ♠ / ♥ / ♦ / ♣'],
        ['⇧+rank', 'Quick-fire as ♠ (skip suit picker)'],
      ],
    },
    {
      title: 'Player Action',
      rows: [
        ['H', 'Hit (target → player)'],
        ['X', 'Stand (target → dealer)'],
        ['B', 'Double down'],
        ['P', 'Split pair'],
        ['R', 'Surrender'],
      ],
    },
    {
      title: 'Record Result',
      rows: [
        ['W', 'Win'],
        ['L', 'Loss'],
        ['U', 'Push'],
      ],
    },
    {
      title: 'Deal Target',
      rows: [
        ['A', 'Player (primary)'],
        ['S', 'Dealer (primary)'],
        ['D', 'Seen (primary)'],
        [', / H', 'Player (alias)'],
        ['. / X', 'Dealer (alias)'],
        ['/', 'Seen (alias)'],
      ],
    },
    {
      title: 'Bet Ramp',
      rows: [
        ['[', 'Decrease bet by 1 unit'],
        [']', 'Increase bet by 1 unit'],
        ['=', 'Set bet to Kelly'],
      ],
    },
    {
      title: 'Session',
      rows: [
        ['N', 'New hand (count persists)'],
        ['⇧+S (hold)', 'Shuffle shoe (resets count)'],
        ['Ctrl+Z', 'Undo last card'],
        ['Ctrl+⇧+Z', 'Redo last undo'],
      ],
    },
    {
      title: 'Interface',
      rows: [
        ['M', 'Cycle mode (Normal · Zen · Speed)'],
        ['T', 'Toggle floating TC HUD'],
        ['⇧+L', 'Open layout editor'],
        ['⇧+E', 'Toggle deal-order engine'],
        ['?', 'Show / hide this overlay'],
        ['Esc', 'Close popover or modal'],
      ],
    },
  ];

  return React.createElement('div', {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Keyboard shortcuts',
    onClick: onClose,
    style: {
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(8,12,20,0.78)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }
  },
    React.createElement('div', {
      onClick: e => e.stopPropagation(),
      style: {
        background: '#111827',
        border: '1.5px solid rgba(255,212,71,0.35)',
        borderRadius: 14,
        boxShadow: '0 16px 64px rgba(0,0,0,0.7)',
        padding: 22,
        maxWidth: 920, width: '100%',
        maxHeight: '88vh', overflowY: 'auto',
        color: '#f0f4ff',
      }
    },
      // Header
      React.createElement('div', {
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: 10,
        }
      },
        React.createElement('div', null,
          React.createElement('div', {
            style: {
              fontFamily: 'Syne, sans-serif',
              fontSize: 20, fontWeight: 900, letterSpacing: '0.04em',
              color: '#ffd447',
            }
          }, '⌨  KEYBOARD SHORTCUTS'),
          React.createElement('div', {
            style: { fontSize: 11, color: '#94a7c4', marginTop: 2 }
          }, 'Press Esc or click outside to close')
        ),
        React.createElement('button', {
          onClick: onClose,
          'aria-label': 'Close',
          style: {
            background: 'transparent', border: '1px solid rgba(255,255,255,0.18)',
            color: '#ccdaec', borderRadius: 6,
            padding: '4px 10px', cursor: 'pointer',
            fontSize: 13, fontWeight: 700,
          },
        }, 'Esc')
      ),

      // Sections — 2-column grid on wide, single column on narrow
      React.createElement('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 14,
        }
      },
        SECTIONS.map(sec =>
          React.createElement('div', {
            key: sec.title,
            style: {
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              padding: '10px 12px',
            }
          },
            React.createElement('div', {
              style: {
                fontFamily: 'Syne, sans-serif',
                fontSize: 11, fontWeight: 800,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#ffd447', marginBottom: 8,
              }
            }, sec.title),
            sec.rows.map((r, i) =>
              React.createElement('div', {
                key: i,
                style: {
                  display: 'flex', alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 12, padding: '4px 0',
                  borderBottom: i === sec.rows.length - 1
                    ? 'none'
                    : '1px dashed rgba(255,255,255,0.06)',
                }
              },
                React.createElement('span', {
                  style: {
                    fontFamily: 'DM Mono, monospace',
                    fontSize: 11, fontWeight: 700,
                    color: '#ccdaec',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 5, padding: '2px 7px',
                    whiteSpace: 'nowrap',
                  }
                }, r[0]),
                React.createElement('span', {
                  style: {
                    fontSize: 11, color: '#b8ccdf', textAlign: 'right',
                    flex: 1,
                  }
                }, r[1])
              )
            )
          )
        )
      )
    )
  );
}
