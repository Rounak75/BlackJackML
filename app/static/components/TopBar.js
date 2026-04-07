/*
 * components/TopBar.js
 * ─────────────────────────────────────────────────────────
 * Sticky top navigation bar.
 *
 * WHAT'S NEW:
 *   • Counting system dropdown shows active system name + short description
 *   • Shuffle type dropdown shows what each shuffle means for card memory
 *   • Tooltips on hover for both selects (new user friendly)
 *   • Shuffle type visually shows Bayesian info retention % so users
 *     understand why the choice matters
 */

/* ── Data: counting systems ──────────────────────────────── */
const COUNTING_SYSTEMS = {
  hi_lo:    { label: 'Hi-Lo',      level: '★☆☆', desc: 'Most popular. Tags: low cards +1, high cards −1. Best for beginners.' },
  ko:       { label: 'KO',         level: '★☆☆', desc: 'Knock-Out. Unbalanced — no true count needed. Simpler to use live.' },
  omega_ii: { label: 'Omega II',   level: '★★★', desc: 'Level 2. More accurate than Hi-Lo, harder to maintain under pressure.' },
  zen:      { label: 'Zen Count',  level: '★★☆', desc: 'Level 2 balanced. Good accuracy vs difficulty trade-off.' },
};

/* ── Data: shuffle types with their effect on the ML tracker ─ */
const SHUFFLE_TYPES = {
  machine: { label: 'Machine', retention: '2%',  desc: 'Fully automated shuffle — near-random. Almost no card memory survives.' },
  riffle:  { label: 'Riffle',  retention: '40%', desc: 'Standard hand riffle. Imperfect — cards clump. 40% of count info survives.' },
  strip:   { label: 'Strip',   retention: '25%', desc: 'Strips of cards pulled from top. Moderate randomisation.' },
  box:     { label: 'Box',     retention: '15%', desc: 'Deck split into boxes, reassembled randomly. Less info survives.' },
  wash:    { label: 'Wash',    retention: '5%',  desc: 'Cards spread and scrambled face-down. Very thorough — little memory.' },
};

/* ── Tooltip component ───────────────────────────────────── */
//
// FIX: Previous version used `bottom: 120%` which positioned the tooltip
// ABOVE the header. The header is `sticky top-0` with `overflow: hidden`
// (implicit via the flex container), so the popup was clipped and invisible.
//
// Fix 1: Use `top: '100%'` to drop the tooltip BELOW the ? badge instead.
// Fix 2: Use `position: fixed` with a ref-measured position so the tooltip
//         escapes the header's stacking context entirely — no clipping possible.
// Fix 3: Support both hover (desktop) and click (touch/mobile).
//
function InfoTooltip({ children }) {
  const { useState, useRef, useEffect } = React;
  const [visible, setVisible] = useState(false);
  const [pos, setPos]         = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  // Measure button position and set tooltip coordinates on open.
  // Clamp left so the tooltip never overflows the right or left edge.
  const TOOLTIP_W = 250;
  const PADDING   = 10; // min gap from screen edge
  const open = () => {
    if (btnRef.current) {
      const r        = btnRef.current.getBoundingClientRect();
      const vw       = window.innerWidth;
      // Ideal: centred on badge
      let left = r.left + r.width / 2 - TOOLTIP_W / 2;
      // Clamp: don't go past right edge
      if (left + TOOLTIP_W > vw - PADDING) left = vw - TOOLTIP_W - PADDING;
      // Clamp: don't go past left edge
      if (left < PADDING) left = PADDING;
      setPos({
        top:  r.bottom + 6,
        left: left,
      });
    }
    setVisible(true);
  };

  // Close on any outside click
  useEffect(() => {
    if (!visible) return;
    const handler = (e) => {
      if (btnRef.current && !btnRef.current.contains(e.target)) setVisible(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [visible]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* ? badge — click to toggle, hover also works */}
      <span
        ref={btnRef}
        onClick={() => visible ? setVisible(false) : open()}
        onMouseEnter={open}
        onMouseLeave={() => setVisible(false)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 16, height: 16, borderRadius: '50%',
          background: visible ? 'rgba(255,212,71,0.25)' : 'rgba(255,255,255,0.1)',
          border: `1px solid ${visible ? 'rgba(255,212,71,0.6)' : 'rgba(255,255,255,0.2)'}`,
          color: visible ? '#ffd447' : '#b8ccdf',
          fontSize: 9, fontWeight: 'bold',
          cursor: 'pointer', userSelect: 'none',
          transition: 'all 0.15s',
        }}
      >?</span>

      {/* Tooltip rendered via fixed positioning — escapes header overflow/clip */}
      {visible && (
        <div
          onMouseEnter={open}
          onMouseLeave={() => setVisible(false)}
          style={{
            position: 'fixed',
            top:  pos.top,
            left: pos.left,
            background: '#1a2236',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 8,
            padding: '10px 12px',
            width: 250,
            zIndex: 99999,
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            pointerEvents: 'auto',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Main TopBar ─────────────────────────────────────────── */
function TopBar({ count, onNewHand, onShuffle, onChangeSystem }) {
  const [activeSystem,  setActiveSystem]  = useState('hi_lo');
  const [activeShuffle, setActiveShuffle] = useState('machine');

  const tc  = count ? count.true       : 0;
  const rc  = count ? count.running    : 0;
  const adv = count ? count.advantage  : -0.5;
  const etc = count ? count.enhanced_true : 0;

  const sysMeta  = COUNTING_SYSTEMS[activeSystem]  || COUNTING_SYSTEMS.hi_lo;
  const shufMeta = SHUFFLE_TYPES[activeShuffle] || SHUFFLE_TYPES.machine;

  const handleSystemChange = (e) => {
    setActiveSystem(e.target.value);
    onChangeSystem(e.target.value);
  };

  const handleShuffleTypeChange = (e) => {
    setActiveShuffle(e.target.value);
    // Update the id so App.js handleShuffle can still read it
    document.getElementById('shuffle-type').value = e.target.value;
  };

  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between gap-4 px-5 py-3"
      style={{
        background: '#1a2236',
        borderBottom: '1.5px solid rgba(255,255,255,0.14)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* ── Brand ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <span
          className="text-3xl font-display"
          style={{ color: '#ffd447', filter: 'drop-shadow(0 0 14px rgba(255,212,71,0.55))' }}
        >
          ♠
        </span>
        <div>
          <div className="font-display font-extrabold text-sm tracking-tight" style={{ color: '#f0f4ff' }}>
            BlackjackML
          </div>
          <div className="text-[10px] uppercase tracking-widest" style={{ color: '#b8ccdf' }}>
            Live Counter & AI Advisor
          </div>
        </div>
      </div>

      {/* ── Live Count Display ─────────────────────────── */}
      {/*
       * Layout rationale (Issue #2):
       *
       * Before: all four stats were peer-equal in the same pill.
       * True Count drives live decisions; the others are context.
       * A user mid-hand scanning in a split second must be able to
       * read the TC without parsing four equal-weight labels.
       *
       * After:
       *   Left cluster  — RC (small) + ML Enhanced (small), stacked
       *   Centre hero   — TRUE COUNT at ~3× the size, standalone
       *   Right cluster — Advantage (small), standalone
       *
       * The dividers between hero and clusters are taller (48px) to
       * frame the TC visually. The left/right clusters use a muted
       * secondary background so they recede behind the hero.
       */}
      <div
        className="flex items-center rounded-xl flex-1 justify-center max-w-2xl"
        style={{
          background: '#111827',
          border: '1.5px solid rgba(255,255,255,0.14)',
          overflow: 'hidden',
        }}
      >

        {/* Left cluster — RC + ML Enhanced, stacked, muted background */}
        <div
          style={{
            display: 'flex', flexDirection: 'column', gap: 2,
            padding: '6px 16px',
            background: 'rgba(255,255,255,0.03)',
            alignSelf: 'stretch', justifyContent: 'center',
          }}
        >
          <CountBlock
            label="RC"
            title="Running Count: raw sum of all card tags seen (+1 low, −1 high)"
            value={rc}
            colorVal={rc}
            mono
            secondary
          />
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />
          <CountBlock
            label="ML"
            title="ML-enhanced true count: adjusts for shuffle patterns tracked by LSTM model"
            value={etc.toFixed(1)}
            colorVal={etc}
            mono
            secondary
          />
        </div>

        {/* Divider */}
        <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.12)' }} />

        {/* ── TRUE COUNT — hero ─────────────────────────────────────── */}
        <div
          className="flex flex-col items-center justify-center"
          style={{ padding: '10px 28px' }}
          title="True Count: Running Count ÷ Decks Remaining. Use this for all strategy decisions."
        >
          <div
            style={{
              fontSize: '0.65rem', textTransform: 'uppercase',
              letterSpacing: '0.12em', fontWeight: 700,
              color: '#b8ccdf', marginBottom: 4,
            }}
          >
            True Count
          </div>
          <div
            className={`font-mono font-bold leading-none ${countClass(tc)}`}
            style={{ fontSize: '2.4rem' }}
          >
            {tc.toFixed(1)}
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.12)' }} />

        {/* Right cluster — Advantage, muted background */}
        <div
          style={{
            padding: '6px 16px',
            background: 'rgba(255,255,255,0.03)',
            alignSelf: 'stretch', display: 'flex', alignItems: 'center',
          }}
        >
          <CountBlock
            label="Edge"
            value={`${adv >= 0 ? '+' : ''}${adv.toFixed(2)}%`}
            colorVal={adv}
            mono
            secondary
          />
        </div>

      </div>

      {/* ── Controls ───────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-shrink-0">

        {/* ── Counting System ───────────────────────────── */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: '#b8ccdf' }}>
              Counting System
            </span>
            <InfoTooltip>
              <div className="text-[10px] font-bold mb-1" style={{ color: '#ffd447' }}>
                What is a counting system?
              </div>
              <div className="text-[10px] leading-relaxed" style={{ color: '#ccdaec' }}>
                Card counting assigns a tag to each card you see. You keep a running total — when it's high, the shoe favours you and you bet more.
              </div>
              <div className="mt-2 space-y-1">
                {Object.entries(COUNTING_SYSTEMS).map(([k, v]) => (
                  <div key={k} className="text-[9px]" style={{ color: '#b8ccdf' }}>
                    <span style={{ color: '#ccdaec', fontWeight: 600 }}>{v.label}</span> {v.level} — {v.desc.split('.')[0]}.
                  </div>
                ))}
              </div>
            </InfoTooltip>
          </div>
          <div className="flex items-center gap-1.5">
            <select
              value={activeSystem}
              onChange={handleSystemChange}
              aria-label="Card counting system"
              className="topbar-select"
            >
              {Object.entries(COUNTING_SYSTEMS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          {/* Active system description — one-liner under the select */}
          <div className="text-[9px] leading-tight mt-0.5" style={{ color: '#9ab0c8', maxWidth: 150 }}>
            {sysMeta.level} · {sysMeta.desc.split('.')[0]}
          </div>
        </div>

        <button onClick={onNewHand} aria-label="Start a new hand (count continues)" className="topbar-btn" style={{ alignSelf: 'center' }}>
          ⬆ New Hand
        </button>

        {/* ── Shuffle ───────────────────────────────────── */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: '#b8ccdf' }}>
              Shuffle Type
            </span>
            <InfoTooltip>
              <div className="text-[10px] font-bold mb-1" style={{ color: '#ffd447' }}>
                Why does shuffle type matter?
              </div>
              <div className="text-[10px] leading-relaxed mb-2" style={{ color: '#ccdaec' }}>
                The ML Shuffle Tracker remembers card patterns across shuffles. Different shuffle types destroy different amounts of that memory.
              </div>
              <div className="space-y-1">
                {Object.entries(SHUFFLE_TYPES).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-[9px] gap-2">
                    <span style={{ color: '#ccdaec', fontWeight: 600 }}>{v.label}</span>
                    <span style={{ color: '#44e882' }}>{v.retention} memory</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[9px]" style={{ color: '#9ab0c8' }}>
                Select the type matching what you observe at the table, then click Shuffle.
              </div>
            </InfoTooltip>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onShuffle} aria-label="Trigger casino shuffle and reset count" className="topbar-btn danger" style={{ whiteSpace: 'nowrap' }}>
              ⇄ Shuffle
            </button>
            {/* Hidden select kept for App.js getElementById compat */}
            <select id="shuffle-type" style={{ display: 'none' }} defaultValue="machine" />
            <select
              value={activeShuffle}
              onChange={handleShuffleTypeChange}
              aria-label="Select shuffle type"
              className="topbar-select"
            >
              {Object.entries(SHUFFLE_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          {/* Memory retention one-liner */}
          <div className="text-[9px] leading-tight mt-0.5" style={{ color: '#9ab0c8', maxWidth: 150 }}>
            {shufMeta.retention} card memory · {shufMeta.desc.split('.')[0]}
          </div>
        </div>

      </div>
    </header>
  );
}

/*
 * CountBlock — single stat cell inside the top bar count display.
 *
 * Props:
 *   label     — short label shown above the value
 *   value     — formatted string to display
 *   colorVal  — raw number used to pick the colour class (pos/neg/hot/neutral)
 *   mono      — use monospace font for the value
 *   secondary — true for the small cluster stats (RC, ML, Edge);
 *               false/omitted for standalone cells (unused after the
 *               hero refactor but kept for any future callers)
 *   title     — tooltip on hover
 */
function CountBlock({ label, value, colorVal, mono, secondary, title }) {
  const cls = countClass(colorVal);
  return (
    <div className="text-center" title={title}>
      <div
        style={{
          fontSize: secondary ? '0.6rem' : '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 600,
          color: '#8fa5be',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        className={`font-bold leading-none ${mono ? 'font-mono' : ''} ${cls}`}
        style={{ fontSize: secondary ? '1rem' : '1.25rem' }}
      >
        {value}
      </div>
    </div>
  );
}