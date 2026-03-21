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
      <div
        className="flex items-center gap-5 rounded-xl px-6 py-2.5 flex-1 justify-center max-w-xl"
        style={{ background: '#111827', border: '1.5px solid rgba(255,255,255,0.14)' }}
      >
        <CountBlock label="Running" title="Running Count: raw sum of all card tags seen (+1 low, -1 high)" value={rc} colorVal={rc} mono />
        <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.15)' }} />
        <CountBlock label="True Count" title="True Count: Running Count ÷ Decks Remaining. Use this for strategy decisions." value={tc.toFixed(1)} colorVal={tc} large mono />
        <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.15)' }} />
        <CountBlock label="ML Enhanced" title="ML-enhanced true count: adjusts for shuffle patterns tracked by LSTM model" value={etc.toFixed(1)} colorVal={etc} mono />
        <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.15)' }} />
        <CountBlock
          label="Advantage"
          value={`${adv >= 0 ? '+' : ''}${adv.toFixed(2)}%`}
          colorVal={adv}
          mono
        />
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

        <button onClick={onNewHand} className="topbar-btn" style={{ alignSelf: 'center' }}>
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
            <button onClick={onShuffle} className="topbar-btn danger" style={{ whiteSpace: 'nowrap' }}>
              ⇄ Shuffle
            </button>
            {/* Hidden select kept for App.js getElementById compat */}
            <select id="shuffle-type" style={{ display: 'none' }} defaultValue="machine" />
            <select
              value={activeShuffle}
              onChange={handleShuffleTypeChange}
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
 */
function CountBlock({ label, value, colorVal, large, mono, title }) {
  const cls = countClass(colorVal);
  return (
    <div className="text-center">
      <div
        className="text-[9px] uppercase tracking-widest font-semibold mb-1"
        style={{ color: '#b8ccdf' }}
      >
        {label}
      </div>
      <div
        className={`${large ? 'text-2xl' : 'text-lg'} font-bold leading-none ${mono ? 'font-mono' : ''} ${cls}`}
      >
        {value}
      </div>
    </div>
  );
}