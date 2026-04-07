/*
 * components/AccordionPanel.js
 * ─────────────────────────────────────────────────────────
 * A collapsible wrapper used for Tier 2 panels in the right column.
 *
 * Tier 2 = reference / analytics panels consulted between hands,
 * not during them. Collapsed by default to reduce scroll length and
 * visual noise during active play.
 *
 * Usage:
 *   <AccordionPanel label="Illustrious 18 & Fab 4">
 *     <I18Panel count={count} />
 *   </AccordionPanel>
 *
 * Props:
 *   label       — string shown in the header row (always visible)
 *   defaultOpen — bool, false by default
 *   children    — the panel component to reveal on expand
 */

function AccordionPanel({ label, defaultOpen = false, children }) {
  const { useState, useRef } = React;
  const [open, setOpen] = useState(defaultOpen);

  // Smooth height animation without max-height tricks that cause
  // jarring jumps when content is taller than the max-height guess.
  const bodyRef = useRef(null);

  const toggle = () => {
    const el = bodyRef.current;
    if (!el) { setOpen(o => !o); return; }

    if (!open) {
      // Expanding: measure natural height, animate to it, then remove fixed
      // height so the panel can grow dynamically if content changes.
      el.style.height = '0px';
      el.style.overflow = 'hidden';
      setOpen(true);
      requestAnimationFrame(() => {
        el.style.transition = 'height 0.22s ease';
        el.style.height = el.scrollHeight + 'px';
        el.addEventListener('transitionend', () => {
          el.style.height = 'auto';
          el.style.overflow = '';
          el.style.transition = '';
        }, { once: true });
      });
    } else {
      // Collapsing: pin to current pixel height, then animate to 0.
      el.style.height = el.scrollHeight + 'px';
      el.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        el.style.transition = 'height 0.22s ease';
        el.style.height = '0px';
        el.addEventListener('transitionend', () => {
          setOpen(false);
          el.style.height = '';
          el.style.overflow = '';
          el.style.transition = '';
        }, { once: true });
      });
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',            // clips the body during animation
      }}
    >
      {/* ── Header row — always visible ─────────────────────────────── */}
      <button
        onClick={toggle}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-1)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display, "Syne", sans-serif)',
            fontWeight: 800,
            fontSize: '0.72rem',
            textTransform: 'uppercase',
            letterSpacing: '0.09em',
            color: 'var(--text-2)',
          }}
        >
          {label}
        </span>

        {/* Chevron — rotates smoothly */}
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            fontSize: 10,
            color: 'var(--text-2)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.22s ease',
            lineHeight: 1,
          }}
        >
          ▼
        </span>
      </button>

      {/* ── Body — collapsed until open ─────────────────────────────── */}
      {/*
        We render children even when closed (display: none would unmount
        components and lose their internal state). Instead we hide with
        height: 0 + overflow: hidden so the JS animation can measure
        scrollHeight. The ref is used by the toggle handler above.
      */}
      <div
        ref={bodyRef}
        style={{
          height: open ? 'auto' : '0px',
          overflow: open ? '' : 'hidden',
        }}
      >
        {/* Divider between header and body */}
        <div style={{ height: 1, background: 'var(--border)', margin: '0 14px' }} />

        {/*
          Wrap children in a div so the accordion can strip the child
          Widget's outer border-radius and border — they would look odd
          nested inside another rounded container.
        */}
        <div className="accordion-body">
          {children}
        </div>
      </div>
    </div>
  );
}