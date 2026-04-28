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
    {
      title: 'Speed Mode',
      rows: [
        ['Y', 'Confirm shuffle prompt (penetration ≥ 75%)'],
        ['Esc', 'Dismiss shuffle prompt until next shoe'],
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
      background: 'rgba(10,10,10,0.78)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-5)',
    }
  },
    React.createElement('div', {
      onClick: e => e.stopPropagation(),
      style: {
        background: 'var(--surface-chrome)',
        border: 'var(--border-w) solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 16px 64px rgba(0,0,0,0.7)',
        padding: 'var(--space-5)',
        maxWidth: 920, width: '100%',
        maxHeight: '88vh', overflowY: 'auto',
        color: 'var(--text-0)',
      }
    },
      // Header
      React.createElement('div', {
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 'var(--space-4)',
          borderBottom: 'var(--border-w) solid var(--border-soft)',
          paddingBottom: 'var(--space-3)',
        }
      },
        React.createElement('div', null,
          React.createElement('div', {
            style: {
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--font-lg)', fontWeight: 900, letterSpacing: '0.04em',
              color: 'var(--amber)',
            }
          }, '⌨  KEYBOARD SHORTCUTS'),
          React.createElement('div', {
            style: { fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginTop: 2 }
          }, 'Press Esc or click outside to close')
        ),
        React.createElement('button', {
          onClick: onClose,
          'aria-label': 'Close',
          style: {
            background: 'transparent', border: 'var(--border-w) solid var(--border)',
            color: 'var(--text-1)', borderRadius: 'var(--radius-md)',
            padding: 'var(--space-1) var(--space-3)', cursor: 'pointer',
            fontSize: 'var(--font-sm)', fontWeight: 700,
          },
        }, 'Esc')
      ),

      // Sections — 2-column grid on wide, single column on narrow
      React.createElement('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 'var(--space-3)',
        }
      },
        SECTIONS.map(sec =>
          React.createElement('div', {
            key: sec.title,
            style: {
              background: 'rgba(255,255,255,0.02)',
              border: 'var(--border-w) solid var(--border-soft)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3)',
            }
          },
            React.createElement('div', {
              style: {
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--font-xs)', fontWeight: 800,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--amber)', marginBottom: 'var(--space-2)',
              }
            }, sec.title),
            sec.rows.map((r, i) =>
              React.createElement('div', {
                key: i,
                style: {
                  display: 'flex', alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)', padding: 'var(--space-1) 0',
                  borderBottom: i === sec.rows.length - 1
                    ? 'none'
                    : '1px dashed var(--border-soft)',
                }
              },
                React.createElement('span', {
                  style: {
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--font-xs)', fontWeight: 700,
                    color: 'var(--text-1)',
                    background: 'rgba(255,255,255,0.05)',
                    border: 'var(--border-w) solid var(--border-soft)',
                    borderRadius: 'var(--radius-sm)', padding: '2px 7px',
                    whiteSpace: 'nowrap',
                  }
                }, r[0]),
                React.createElement('span', {
                  style: {
                    fontSize: 'var(--font-xs)', color: 'var(--text-2)', textAlign: 'right',
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
