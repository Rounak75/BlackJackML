/*
 * components/SpeedShufflePrompt.js
 * ─────────────────────────────────────────────────────────
 * Speed-mode-only affordance: shows when shoe penetration crosses
 * SHUFFLE_PROMPT_THRESHOLD. Press Y or held Shift+S to shuffle; Esc
 * dismisses until the next shoe.
 *
 * Props:
 *   penetration  — number 0..100 (count.penetration from gameState)
 *   threshold    — number 0..100 (SHUFFLE_PROMPT_THRESHOLD)
 *   onShuffle    — () => void
 *   onDismiss    — () => void
 *   dismissed    — boolean (true → don't render even if past threshold)
 */

function SpeedShufflePrompt({ penetration, threshold, onShuffle, onDismiss, dismissed }) {
  const { useEffect } = React;

  const visible = !dismissed
    && typeof penetration === 'number'
    && penetration >= threshold;

  useEffect(() => {
    if (!visible) return;
    function onKey(e) {
      // Ignore when focus is in an editable element.
      const t = e.target;
      const inEditable = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (inEditable) return;
      if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); onShuffle(); }
      else if (e.key === 'Escape')        { e.preventDefault(); onDismiss(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onShuffle, onDismiss]);

  if (!visible) return null;

  return React.createElement('div', {
    role: 'alert',
    'aria-label': 'Shuffle prompt',
    style: {
      width: '100%',
      padding: 'var(--space-3) var(--space-4)',
      borderRadius: 'var(--radius-md)',
      // Ambient amber wash kept deliberately — the prompt IS a state warning.
      background: 'rgba(255,184,77,0.12)',
      border: 'var(--border-w) solid var(--amber)',
      color: 'var(--amber)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 'var(--space-3)',
      fontSize: 'var(--font-sm)', fontWeight: 700, letterSpacing: '0.06em',
    },
  },
    React.createElement('span', null,
      `⚡ Penetration ${Math.round(penetration)}% — shuffle now? `,
      React.createElement('kbd', {
        style: {
          marginLeft: 'var(--space-2)', padding: '2px 6px',
          background: 'rgba(255,184,77,0.2)', borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-mono)', fontSize: 'var(--font-xs)',
        },
      }, 'Y')
    ),
    React.createElement('button', {
      onClick: onDismiss,
      'aria-label': 'Dismiss shuffle prompt',
      style: {
        background: 'transparent', border: 'var(--border-w) solid var(--amber)',
        color: 'var(--amber)', borderRadius: 'var(--radius-md)', padding: 'var(--space-1) var(--space-2)',
        fontSize: 'var(--font-xs)', fontWeight: 700, cursor: 'pointer',
      },
    }, 'DISMISS (ESC)')
  );
}


// PHASE 7 T4 — React.memo wrap. Script-mode reassignment of the
// function declaration keeps `function SpeedShufflePrompt(` intact for the
// build.sh smoke check while routing all consumers through memo.
if (typeof React !== 'undefined' && React.memo) {
  SpeedShufflePrompt = React.memo(SpeedShufflePrompt);
}
