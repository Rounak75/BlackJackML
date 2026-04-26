/*
 * components/TopBar.js
 * ─────────────────────────────────────────────────────────
 * Sticky top navigation bar.
 *
 * UX AUDIT CHANGES:
 *   Issue #2  — True Count hero at 3rem (was 2.4rem)
 *   Issue #12 — Brand condensed to ♠ BJ-ML
 *   NEW       — 4px action-coloured stripe at top of header
 *   NEW       — TC flash on threshold crossing (±3, ±5)
 */

/* ── Data: counting systems ──────────────────────────────── */
const COUNTING_SYSTEMS = {
  hi_lo:       { label: 'Hi-Lo',        level: '★☆☆', desc: 'Most popular. Tags: low cards +1, high cards −1. Best for beginners.' },
  ko:          { label: 'KO',           level: '★☆☆', desc: 'Knock-Out. Unbalanced — no true count needed. Simpler to use live.' },
  omega_ii:    { label: 'Omega II',     level: '★★★', desc: 'Level 2. More accurate than Hi-Lo, harder to maintain under pressure.' },
  zen:         { label: 'Zen Count',    level: '★★☆', desc: 'Level 2 balanced. Good accuracy vs difficulty trade-off.' },
  wong_halves: { label: 'Wong Halves',  level: '★★★', desc: 'Level 3. Fractional values (±0.5, ±1, ±1.5). Most accurate balanced system.' },
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
function InfoTooltip({ children }) {
  const { useState, useRef, useEffect } = React;
  const [visible, setVisible] = useState(false);
  const [pos, setPos]         = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  const TOOLTIP_W = 250;
  const PADDING   = 10;
  const open = () => {
    if (btnRef.current) {
      const r        = btnRef.current.getBoundingClientRect();
      const vw       = window.innerWidth;
      let left = r.left + r.width / 2 - TOOLTIP_W / 2;
      if (left + TOOLTIP_W > vw - PADDING) left = vw - TOOLTIP_W - PADDING;
      if (left < PADDING) left = PADDING;
      setPos({ top: r.bottom + 6, left: left });
    }
    setVisible(true);
  };

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

      {visible && (
        <div
          onMouseEnter={open}
          onMouseLeave={() => setVisible(false)}
          style={{
            position: 'fixed',
            top:  pos.top,
            left: pos.left,
            background: '#1c2540',
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

/* ── Action stripe colour map ────────────────────────────── */
const STRIPE_CLASS = {
  HIT: 'hit', STAND: 'stand', DOUBLE: 'double',
  'DOUBLE DOWN': 'double', SPLIT: 'split', SURRENDER: 'surrender',
};

/* ── Main TopBar ─────────────────────────────────────────── */
function TopBar({ count, onNewHand, onShuffle, onChangeSystem, currentAction, uiMode, onModeChange,
                  sideCounts, onShowLayoutEditor }) {
  const isMinimal = uiMode === 'zen' || uiMode === 'speed';
  const [activeSystem,  setActiveSystem]  = useState('hi_lo');
  const [activeShuffle, setActiveShuffle] = useState('machine');
  const { useRef, useEffect } = React;

  const tc  = count ? count.true       : 0;
  const rc  = count ? count.running    : 0;
  const adv = count ? count.advantage  : -0.5;
  const etc = count ? count.enhanced_true : 0;
  // P3.2 (CRIT-06): KO is unbalanced — use Running Count vs Pivot, not TC
  const isKO     = !!(count && (count.is_ko || count.system === 'ko' || count.system_name === 'ko'));
  const koPivot  = (count && (count.ko_pivot != null ? count.ko_pivot : count.pivot)) || 0;
  // P3.7 (FEAT-04): penetration display.
  // Backend already serialises count.penetration as a 0-100 percentage.
  const penPct   = count && count.penetration != null ? Math.round(count.penetration) : null;
  const penColor = penPct == null ? '#b8ccdf'
                 : penPct >= 80 ? '#ff5c5c'
                 : penPct >= 70 ? '#ffd447'
                 : '#b8ccdf';

  const sysMeta  = COUNTING_SYSTEMS[activeSystem]  || COUNTING_SYSTEMS.hi_lo;
  const shufMeta = SHUFFLE_TYPES[activeShuffle] || SHUFFLE_TYPES.machine;

  // ── TC flash on threshold crossing ──────────────────────
  const prevTcRef = useRef(tc);
  const tcBlockRef = useRef(null);
  useEffect(() => {
    const prev = prevTcRef.current;
    prevTcRef.current = tc;
    const thresholds = [-5, -3, 3, 5];
    for (const t of thresholds) {
      const crossed = (prev < t && tc >= t) || (prev > t && tc <= t) ||
                      (prev >= t && tc < t) || (prev <= t && tc > t);
      if (crossed && prev !== tc) {
        if (tcBlockRef.current) {
          tcBlockRef.current.classList.remove('tc-flash');
          void tcBlockRef.current.offsetWidth; // force reflow
          tcBlockRef.current.classList.add('tc-flash');
        }
        break;
      }
    }
  }, [tc]);

  const handleSystemChange = (e) => {
    setActiveSystem(e.target.value);
    onChangeSystem(e.target.value);
  };

  const handleShuffleTypeChange = (e) => {
    setActiveShuffle(e.target.value);
    document.getElementById('shuffle-type').value = e.target.value;
  };

  const stripeClass = currentAction ? (STRIPE_CLASS[currentAction] || 'none') : 'none';

  return (
    <header
      className="sticky top-0 z-50 flex flex-col"
      style={{
        background: '#1c2540',
        borderBottom: '1.5px solid rgba(255,255,255,0.14)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* ── 4px action-coloured stripe ─────────────────── */}
      <div className={`action-stripe ${stripeClass}`} />

      {/* ── Main header row ───────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-5 py-2.5">

        {/* ── Brand — condensed (Issue #12) ──────────── */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="font-display"
            style={{ fontSize: '1.6rem', color: '#ffd447', filter: 'drop-shadow(0 0 14px rgba(255,212,71,0.55))' }}
          >
            ♠
          </span>
          <span className="font-display font-extrabold text-sm tracking-tight" style={{ color: '#f0f4ff' }}>
            BlackJack ML
          </span>

          {/* ── Mode switcher pill ──────────────────────── */}
          {onModeChange && (
            <div style={{
              display: 'flex', gap: 0,
              background: '#111827',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              overflow: 'hidden',
              marginLeft: 8,
            }}>
              {[
                { key: 'normal', label: 'Normal',  icon: '' },
                { key: 'zen',    label: 'Zen',     icon: '🧘' },
                { key: 'speed',  label: 'Speed',   icon: '⚡' },
              ].map(m => (
                <button
                  key={m.key}
                  onClick={() => onModeChange(m.key)}
                  aria-label={`Switch to ${m.label} mode`}
                  aria-pressed={uiMode === m.key}
                  style={{
                    padding: '4px 10px', fontSize: 10, fontWeight: 700,
                    cursor: 'pointer', border: 'none',
                    background: uiMode === m.key ? 'rgba(255,212,71,0.15)' : 'transparent',
                    color: uiMode === m.key ? '#ffd447' : '#6b7f96',
                    borderBottom: uiMode === m.key ? '2px solid #ffd447' : '2px solid transparent',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.icon}{m.icon ? ' ' : ''}{m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Live Count Display (Issue #2 — TC hero) ── */}
        <div
          className="flex items-center rounded-xl flex-1 justify-center max-w-2xl"
          style={{
            background: '#111827',
            border: '1.5px solid rgba(255,255,255,0.14)',
            overflow: 'hidden',
          }}
        >

          {/* Left cluster — RC + ML Enhanced, stacked */}
          <div
            style={{
              display: 'flex', flexDirection: 'column', gap: 2,
              padding: '6px 14px',
              background: 'rgba(255,255,255,0.03)',
              alignSelf: 'stretch', justifyContent: 'center',
            }}
          >
            <CountBlock label="RC" title="Running Count: raw sum of all card tags seen" value={rc} colorVal={rc} mono secondary />
            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />
            <CountBlock label="ML" title="ML-enhanced true count" value={etc.toFixed(1)} colorVal={etc} mono secondary />
          </div>

          {/* Divider */}
          <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.12)' }} />

          {/* ── HERO: True Count (balanced) OR Running Count vs Pivot (KO) ── */}
          <div
            ref={tcBlockRef}
            className="flex flex-col items-center justify-center"
            style={{ padding: '8px 24px', borderRadius: 8, transition: 'background 0.3s ease' }}
            title={isKO
              ? 'KO is unbalanced: bet decisions use Running Count vs Pivot, not True Count.'
              : 'True Count: Running Count ÷ Decks Remaining. Use this for all strategy decisions.'}
          >
            <div
              style={{
                fontSize: '0.6rem', textTransform: 'uppercase',
                letterSpacing: '0.12em', fontWeight: 700,
                color: '#b8ccdf', marginBottom: 3,
              }}
            >
              {isKO ? 'Running Count' : 'True Count'}
            </div>
            <div
              className={`font-mono font-bold leading-none num ${countClass(isKO ? rc - koPivot : tc)}`}
              style={{ fontSize: 'var(--font-hero)' }}
            >
              {isKO ? rc.toFixed(0) : tc.toFixed(1)}
            </div>
            {isKO && (
              <div style={{
                marginTop: 4, fontSize: '0.65rem', letterSpacing: '0.08em',
                color: rc >= koPivot ? '#44e882' : '#b8ccdf', fontWeight: 600,
              }}>
                Pivot {koPivot >= 0 ? '+' : ''}{koPivot}{rc >= koPivot ? ' · BET' : ' · MIN'}
              </div>
            )}
          </div>

          {/* P3.7 (FEAT-04): penetration always-visible — now with depth bar */}
          {penPct != null && (
            <>
              <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.12)' }} />
              <div
                title={`Penetration: ${penPct}% of shoe dealt. Gold ≥70%, Ruby ≥80%.`}
                style={{
                  padding: '6px 12px', alignSelf: 'stretch',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.03)',
                  gap: 3,
                }}
              >
                <div style={{
                  fontSize: '0.55rem', textTransform: 'uppercase',
                  letterSpacing: '0.1em', color: '#a8bcd4', fontWeight: 700,
                }}>PEN</div>
                <div className="num" style={{
                  fontFamily: 'DM Mono, monospace', fontWeight: 700,
                  fontSize: '1.05rem', color: penColor, lineHeight: 1,
                }}>{penPct}%</div>
                {/* Depth bar */}
                <div style={{
                  width: 42, height: 3, borderRadius: 2,
                  background: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.min(100, penPct)}%`, height: '100%',
                    background: penColor, transition: 'width 0.3s, background 0.3s',
                  }} />
                </div>
              </div>
            </>
          )}

          {/* PHASE 3: Aces ±x chip — always-visible side count */}
          {sideCounts && (typeof sideCounts.aces_remaining === 'number') && (
            <>
              <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.12)' }} />
              {(() => {
                const aceRem = sideCounts.aces_remaining || 0;
                const aceExp = sideCounts.aces_expected  || 0;
                const aceDelta = aceRem - aceExp; // + = rich, - = poor
                const aceCol = aceDelta >  0.5 ? '#44e882'
                             : aceDelta < -0.5 ? '#ff5c5c'
                             : '#94a7c4';
                const sign = aceDelta >= 0 ? '+' : '';
                return (
                  <div
                    title={`Aces remaining: ${aceRem.toFixed(1)} (expected ${aceExp.toFixed(1)}). Green = rich, red = poor.`}
                    style={{
                      padding: '6px 12px', alignSelf: 'stretch',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <div style={{
                      fontSize: '0.55rem', textTransform: 'uppercase',
                      letterSpacing: '0.1em', color: '#8fa5be', fontWeight: 700,
                    }}>ACES</div>
                    <div className="num" style={{
                      fontFamily: 'DM Mono, monospace', fontWeight: 700,
                      fontSize: '1.05rem', color: aceCol, lineHeight: 1,
                    }}>{sign}{aceDelta.toFixed(1)}</div>
                  </div>
                );
              })()}
            </>
          )}

          {/* Divider */}
          <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.12)' }} />

          {/* Right cluster — Advantage (PHASE 3: bucketed by EV) */}
          {(() => {
            const edgeCol = adv >= 1.5 ? '#44e882'
                          : adv >= 0   ? '#ffd447'
                          : '#ff5c5c';
            return (
              <div
                title={`Player Edge ${adv.toFixed(2)}% — green ≥+1.5%, gold ≥0%, ruby <0%`}
                style={{
                  padding: '6px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  alignSelf: 'stretch', display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <div style={{
                  fontSize: '0.6rem', textTransform: 'uppercase',
                  letterSpacing: '0.1em', fontWeight: 600, color: '#8fa5be',
                  marginBottom: 2,
                }}>Edge</div>
                <div className="num" style={{
                  fontFamily: 'DM Mono, monospace', fontWeight: 700,
                  fontSize: '1rem', color: edgeCol, lineHeight: 1,
                }}>
                  {adv >= 0 ? '+' : ''}{adv.toFixed(2)}%
                </div>
              </div>
            );
          })()}

        </div>

        {/* ── Controls ───────────────────────────────── */}
        <div className="flex items-center gap-3 flex-shrink-0">

          {/* Counting System — hidden in minimal modes */}
          {!isMinimal && (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: '#b8ccdf' }}>
                System
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
          )}

          <button onClick={onNewHand} aria-label="Start a new hand (count continues)" className="topbar-btn" style={{ alignSelf: 'center' }}>
            ⬆ New Hand
          </button>

          {/* Shuffle — simplified in minimal modes */}
          <div className="flex flex-col gap-0.5">
            {!isMinimal && (
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: '#b8ccdf' }}>
                Shuffle
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
              </InfoTooltip>
            </div>
            )}
            <div className="flex items-center gap-1">
              <button onClick={onShuffle} aria-label="Trigger casino shuffle and reset count" className="topbar-btn danger" style={{ whiteSpace: 'nowrap' }}>
                ⇄ Shuffle
              </button>
              {/* Hidden select kept for App.js getElementById compat */}
              <select id="shuffle-type" style={{ display: 'none' }} defaultValue="machine" />
              {!isMinimal && (
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
              )}
            </div>
          </div>

          {/* PHASE 2: Layout-editor overflow button (replaces floating circle) */}
          {onShowLayoutEditor && !isMinimal && (
            <button
              onClick={onShowLayoutEditor}
              aria-label="Customize panel layout"
              title="Customize panel layout (L)"
              className="topbar-btn"
              style={{
                padding: '4px 8px', fontSize: 12,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.18)',
                color: '#8fa5be',
              }}
            >
              ⚙
            </button>
          )}

        </div>
      </div>
    </header>
  );
}

/*
 * CountBlock — single stat cell inside the top bar count display.
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