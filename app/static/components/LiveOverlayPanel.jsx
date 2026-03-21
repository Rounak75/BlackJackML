/*
 * components/LiveOverlayPanel.js — Unified 3-Mode Card Scanner
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * BEGINNER GUIDE — What does this file do?
 * ─────────────────────────────────────────
 * This is the Card Scanner panel in the top-right of the dashboard.
 * It gives the user THREE different ways to enter cards into the system,
 * all in ONE panel with a toggle at the top to switch between them.
 *
 * THREE MODES:
 * ─────────────
 *  ✋  MANUAL      — no scanning. Just reminds user to click the card grid.
 *
 *  📋  SCREENSHOT  — user takes an OS screenshot of the casino window,
 *                    pastes it here (Ctrl+V), and OpenCV reads the cards.
 *                    User confirms/corrects before cards are applied.
 *
 *  🔴  LIVE SCAN   — the Flask server continuously captures the screen
 *                    using 'mss' (an OS-level tool) and automatically
 *                    detects cards, updating count and advice in real time.
 *
 * WHY IS IT UNDETECTABLE BY CASINOS?
 * ────────────────────────────────────
 * Online casinos can only run JavaScript inside their own browser tab.
 * Browser tabs are completely isolated from each other and from the OS.
 * Here is why each mode is safe:
 *
 *  ✅  No getDisplayMedia()  — this browser API would show a visible screen-share
 *                              banner at the top of Chrome. We NEVER use it.
 *  ✅  No getUserMedia()     — this camera API would turn on the camera light.
 *                              We NEVER use it either.
 *  ✅  OS screenshot tool    — Win+Shift+S / Cmd+Shift+4 are operating system
 *                              features. No browser or website can detect them.
 *  ✅  mss screen capture    — runs as a Python background thread. Casino JS
 *                              cannot see other processes or localhost ports.
 *  ✅  Tab isolation         — casino JS is strictly sandboxed to its own origin
 *                              (casino.com). It cannot read tabs, localhost, or
 *                              anything outside its own page.
 *  ✅  Human timing          — cards are submitted with random Gaussian delays
 *                              (150–950ms apart) so entry looks manual, not robotic.
 *
 * HOW THE FILE IS STRUCTURED:
 * ────────────────────────────
 * This file is ONE big JavaScript file that defines several small components,
 * which are then composed together in the final LiveOverlayPanel function.
 *
 * Reading order for beginners:
 *   1. Constants and utilities (colours, rank/suit lists, helper functions)
 *   2. ModeToggle      — the three-button ✋ 📋 🔴 switch
 *   3. ManualHint      — simple message shown in manual mode
 *   4. CardRow         — one editable card in the screenshot confirmation list
 *   5. PasteZone       — the dashed box that receives Ctrl+V paste events
 *   6. ScreenshotMode  — the full screenshot → CV → confirm → apply flow
 *   7. Live sub-components (FpsSelector, BigAction, CountBar, BetBadge, etc.)
 *   8. LiveMode        — the full live scan start/stop/display flow
 *   9. LiveOverlayPanel — the root component that wires all modes together
 *
 * KEY REACT PATTERNS USED:
 * ─────────────────────────
 *   useState    — local state (e.g. which cards were detected, scan status)
 *   useEffect   — side-effects (paste event listener, WebSocket subscriptions)
 *   useCallback — memoised callbacks (prevent unnecessary re-renders)
 *   useRef      — canvas/image element references without causing re-renders
 *
 * Props received from App.js:
 *   socket      SocketIO connection — needed for live mode WebSocket events
 *   count       latest count from server — fallback display before live starts
 *   scanMode    'manual' | 'screenshot' | 'live'
 *   onSetMode   (mode) => void — call this to switch modes
 *   onDealCard  (rank, suit, target?) => void — submit a card to the server
 *   dealTarget  'player' | 'dealer' | 'seen' — default routing for cards
 *
 *   scanMode    'manual' | 'screenshot' | 'live'
 *   onSetMode   function(mode)          — called when user clicks a mode button
 *   onDealCard  function(rank, suit, target?) — submits a card to the server
 *   dealTarget  'player' | 'dealer' | 'seen'
 */

// ── Pull out the React hooks we use ──────────────────────────────────────────
// These come from the React CDN script in index.html.
const { useState, useEffect, useRef, useCallback } = React;

// ── Design tokens — colours shared across all sub-components ─────────────────
// Using a central colour object (C) means if we want to change jade green
// we only change it in ONE place, not hunt through the whole file.
// The 'D' suffix = a dim/transparent version (e.g. jadeD is 10% opacity jade).
const C = {
  jade:'#44e882',  jadeD:'rgba(68,232,130,0.10)',
  gold:'#ffd447',  goldD:'rgba(255,212,71,0.10)',
  ruby:'#ff5c5c',  rubyD:'rgba(255,92,92,0.10)',
  sapph:'#6aafff', sapphD:'rgba(106,175,255,0.10)',
  ameth:'#b99bff', amethD:'rgba(185,155,255,0.10)',
  base1:'#111827', base2:'#1a2236', base3:'#212d45', base4:'#2a3a58',
  text:'#f0f4ff',  sec:'#b0bfd8',   muted:'#94a7c4',
};

// Maps action names to their display colours:
//   HIT = red (urgent action needed)   STAND = green (safe)
//   DOUBLE = gold (profitable)         SPLIT = purple   SURRENDER = orange
const ACTION_COLORS = {
  HIT:'#ff5c5c', STAND:'#44e882', DOUBLE:'#ffd447',
  SPLIT:'#b99bff', SURRENDER:'#ff9944',
};

// All valid blackjack ranks and suits — used to populate dropdowns
// in the screenshot confirmation list so the user can correct OCR mistakes.
const VALID_RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const VALID_SUITS = ['spades','hearts','diamonds','clubs'];

// Unicode suit symbols for display (♠ ♥ ♦ ♣)
const SUIT_ICONS  = { spades:'♠', hearts:'♥', diamonds:'♦', clubs:'♣' };

// Which suits are red — used to colour suit dropdowns correctly
const SUIT_RED    = { hearts:true, diamonds:true, spades:false, clubs:false };

// CV confidence thresholds:
//   >= CONF_HIGH → green badge (high confidence, very likely correct)
//   >= CONF_MED  → yellow badge (medium confidence, probably correct)
//   <  CONF_MED  → red badge (low confidence, please check this card)
const CONF_HIGH   = 0.82;
const CONF_MED    = 0.60;

// Human-timing parameters for card submission (in milliseconds).
// We use a Gaussian (bell curve) distribution around HUMAN_BASE ms,
// so the delays look natural rather than perfectly evenly spaced.
const HUMAN_BASE  = 420;   // average delay between cards (ms)
const HUMAN_SD    = 130;   // standard deviation — how much it varies
const HUMAN_MIN   = 150;   // never faster than this
const HUMAN_MAX   = 950;   // never slower than this

// ── Utility ────────────────────────────────────────────────────────────────────

// ── Utility: Gaussian random delay for human-like card submission ─────────────
// Box–Muller transform converts two uniform random numbers (Math.random())
// into one Gaussian (normally distributed) random number.
// This gives us random delays that cluster around HUMAN_BASE with a natural
// bell-curve spread — much more human-looking than a fixed or uniform delay.
function humanDelay() {
  const u = 1 - Math.random();                                  // avoid log(0)
  const v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);  // Gaussian sample
  return Math.round(Math.max(HUMAN_MIN, Math.min(HUMAN_MAX, HUMAN_BASE + z * HUMAN_SD)));
}

// ── Utility: colour the count display based on true count value ───────────────
// Positive counts are increasingly green (favourable for player).
// Negative counts are red (unfavourable).
function countColor(tc) {
  if (tc >= 3)  return C.jade;     // hot shoe — bet big
  if (tc >= 1)  return '#88eebb';  // slightly positive — bet more
  if (tc >= -1) return C.muted;    // neutral
  return C.ruby;                    // negative — bet minimum
}

// ── Utility: draw bounding boxes on a canvas over the preview image ───────────
// Called after CV detects cards in a screenshot. Draws coloured rectangles
// around each detected card region and labels them with rank + suit.
// Canvas is an HTML element we draw on directly using 2D drawing commands.
function drawDetections(canvas, imgEl, detections) {
  const ctx = canvas.getContext('2d');
  canvas.width  = imgEl.naturalWidth  || imgEl.width;
  canvas.height = imgEl.naturalHeight || imgEl.height;
  ctx.drawImage(imgEl, 0, 0);
  detections.forEach((d, i) => {
    const [x, y, w, h] = d.bbox;
    const col = d.confidence >= CONF_HIGH ? C.jade
              : d.confidence >= CONF_MED  ? C.gold : C.ruby;
    ctx.strokeStyle = col; ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, w, h);
    const label = d.rank + SUIT_ICONS[d.suit];
    ctx.font = 'bold 13px "DM Mono",monospace';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(10,14,24,0.82)';
    ctx.fillRect(x, y - 20, tw + 10, 20);
    ctx.fillStyle = col;
    ctx.fillText(label, x + 5, y - 5);
    ctx.fillStyle = col;
    ctx.fillRect(x + w - 18, y, 18, 18);
    ctx.fillStyle = '#0a0e18';
    ctx.font = 'bold 11px "DM Sans",sans-serif';
    ctx.fillText(String(i + 1), x + w - 13, y + 13);
  });
}


// ══════════════════════════════════════════════════════════════
// MODE TOGGLE — the three-button switch at the top of the panel
// ══════════════════════════════════════════════════════════════
//
// Renders three buttons side by side. Clicking one calls onSetMode(id)
// which updates the scanMode state in App.js, causing this panel to
// show the corresponding sub-UI below the toggle.
//
// The active button gets a coloured border and tinted background.
// Inactive buttons are dimmed so the active one stands out.
function ModeToggle({ scanMode, onSetMode }) {
  const modes = [
    { id:'manual',     icon:'✋', label:'Manual',     col:C.muted, hint:'Click the card grid' },
    { id:'screenshot', icon:'📋', label:'Screenshot', col:C.sapph, hint:'Paste OS screenshot' },
    { id:'live',       icon:'🔴', label:'Live Scan',  col:C.jade,  hint:'Auto screen scan'   },
  ];
  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, marginBottom:10}}>
      {modes.map(({ id, icon, label, col, hint }) => {
        const active = scanMode === id;
        return (
          <button key={id} onClick={() => onSetMode(id)} title={hint}
            style={{
              padding:'7px 4px', fontSize:10, fontWeight:700, borderRadius:6,
              cursor:'pointer', textAlign:'center', transition:'all 0.15s',
              border:`1px solid ${active ? col : 'rgba(255,255,255,0.08)'}`,
              background: active ? `${col}15` : 'transparent',
              color: active ? col : C.muted,
            }}>
            <div style={{fontSize:14, marginBottom:1}}>{icon}</div>
            {label}
          </button>
        );
      })}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// ── MANUAL MODE ───────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function ManualHint() {
  return (
    <div style={{
      padding:'10px', borderRadius:6, fontSize:10,
      background:C.base2, border:'1px solid rgba(255,255,255,0.05)',
      color:C.muted, lineHeight:1.8, textAlign:'center',
    }}>
      <div style={{fontSize:18, marginBottom:4}}>✋</div>
      <div style={{fontWeight:700, color:C.sec, marginBottom:3}}>Manual Mode</div>
      <div>Click cards in the grid below to enter them.</div>
      <div>Switch to Screenshot or Live Scan above for auto-detection.</div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// SCREENSHOT MODE — paste → CV detect → confirm → apply
// ══════════════════════════════════════════════════════════════

// ── CardRow — one editable row in the confirmation list ──────────────────────
// After CV detects cards, each one gets its own row with:
//   • A coloured number badge (green/yellow/red based on confidence)
//   • A rank dropdown (in case OCR got it wrong — user can fix it)
//   • A suit dropdown (colour-coded red for hearts/diamonds)
//   • A confidence badge showing how sure the CV was
//   • An × button to remove false detections
function CardRow({ card, index, onChange, onRemove }) {
  const col = card.confidence >= CONF_HIGH ? C.jade
            : card.confidence >= CONF_MED  ? C.gold : C.ruby;
  const lbl = card.confidence >= CONF_HIGH ? 'HIGH'
            : card.confidence >= CONF_MED  ? 'MED'  : 'LOW';
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:7, padding:'5px 8px',
      borderRadius:6, background:C.base3, border:'1px solid rgba(255,255,255,0.06)',
      marginBottom:4,
    }}>
      <span style={{
        width:20, height:20, borderRadius:'50%', background:col, color:'#0a0e18',
        fontSize:10, fontWeight:700, flexShrink:0,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>{index + 1}</span>

      <select value={card.rank} onChange={e => onChange(index, {...card, rank:e.target.value})}
        style={{background:C.base4, color:C.text, width:50, fontSize:13, fontWeight:700,
          borderRadius:4, padding:'2px 3px', border:'1px solid rgba(255,255,255,0.1)'}}>
        {VALID_RANKS.map(r => <option key={r} value={r}>{r}</option>)}
      </select>

      <select value={card.suit} onChange={e => onChange(index, {...card, suit:e.target.value})}
        style={{background:C.base4, color:SUIT_RED[card.suit]?'#ff7070':C.text,
          width:60, fontSize:13, borderRadius:4, padding:'2px 3px',
          border:'1px solid rgba(255,255,255,0.1)'}}>
        {VALID_SUITS.map(s => (
          <option key={s} value={s} style={{color:SUIT_RED[s]?'#ff7070':C.text}}>
            {SUIT_ICONS[s]} {s[0].toUpperCase()+s.slice(1)}
          </option>
        ))}
      </select>

      <span style={{
        fontSize:9, fontWeight:700, color:col,
        background:col+'20', border:`1px solid ${col}50`,
        borderRadius:3, padding:'1px 4px', fontFamily:'monospace',
      }}>{lbl}</span>

      <button onClick={() => onRemove(index)}
        style={{marginLeft:'auto', background:'transparent', border:'none',
          color:C.muted, cursor:'pointer', fontSize:16, lineHeight:1, padding:'0 2px'}}>
        ×
      </button>
    </div>
  );
}

// ── ScreenshotMode — the full screenshot → CV → confirm → apply flow ─────────
//
// STATE MACHINE — the 'status' variable drives what the UI shows:
//   'idle'       → PasteZone visible, waiting for user to paste
//   'processing' → spinner shown, waiting for server CV response
//   'confirming' → preview canvas + editable card list shown
//   'applying'   → spinner shown while cards are submitted with timing
//   'error'      → error message shown, PasteZone re-appears for retry
//
// HOW THE PASTE WORKS:
//   The browser fires a 'paste' event when the user presses Ctrl+V.
//   We listen for this event on the document (not a specific element),
//   so it works anywhere on the page. We check if the pasted content
//   is an image (e.g. from Win+Shift+S snip tool), read it as a data URL
//   (a base64-encoded string), and send it to the Flask /api/detect_cards
//   endpoint. The server runs OpenCV + Tesseract and returns detected cards.
function ScreenshotMode({ onDealCard, dealTarget }) {
  // status drives which UI is shown (see state machine above)
  const [status,       setStatus]      = useState('idle');

  // The detected cards array — each element is {rank, suit, confidence, bbox}
  // bbox = [x, y, width, height] in pixels within the screenshot
  const [cards,        setCards]       = useState([]);

  // The screenshot as a base64 data URL — shown as a preview image
  const [previewSrc,   setPreviewSrc]  = useState(null);

  // Error message to show when CV fails (displayed in red box)
  const [errorMsg,     setErrorMsg]    = useState('');

  // How to assign detected cards to player/dealer/seen:
  //   'auto' = first 2 → player, next 2 → dealer, rest → seen
  //   Others = all cards go to that one target
  const [applyTarget,  setApplyTarget] = useState('auto');

  // How fast to submit cards:
  //   'human' = random Gaussian delays (looks like a human clicking)
  //   'instant' = 50ms between cards (useful for testing)
  const [timing,       setTiming]      = useState('human');

  // Refs to DOM elements we need to draw on or measure:
  // canvasRef = the <canvas> element where we draw bounding boxes
  // previewRef = the hidden <img> element that loads the screenshot
  const canvasRef  = useRef(null);
  const previewRef = useRef(null);

  // Redraw bounding boxes
  useEffect(() => {
    if (!previewSrc || !cards.length || !canvasRef.current || !previewRef.current) return;
    const img  = previewRef.current;
    const draw = () => drawDetections(canvasRef.current, img, cards);
    if (img.complete && img.naturalWidth > 0) draw(); else img.onload = draw;
  }, [previewSrc, cards]);

  // Clipboard paste listener
  useEffect(() => {
    const handler = (e) => {
      if (status === 'processing' || status === 'applying') return;
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const blob   = items[i].getAsFile();
          const reader = new FileReader();
          reader.onload = (ev) => processImage(ev.target.result);
          reader.readAsDataURL(blob);
          e.preventDefault();
          return;
        }
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [status]);

  const processImage = async (dataUrl) => {
    setErrorMsg(''); setCards([]); setPreviewSrc(dataUrl); setStatus('processing');
    try {
      const resp = await fetch('/api/detect_cards', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ frame: dataUrl }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      const detected = data.cards || [];
      if (!detected.length) throw new Error('No cards found. Try a clearer screenshot.');
      setCards(detected);
      setStatus('confirming');
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  };

  const handleApply = () => {
    if (!cards.length) return;
    setStatus('applying');
    let cum = 0;
    cards.forEach((card, i) => {
      const target = applyTarget === 'auto'
        ? (i < 2 ? 'player' : i < 4 ? 'dealer' : 'seen') : applyTarget;
      const delay = timing === 'human' ? cum : i * 50;
      if (timing === 'human') cum += humanDelay();
      setTimeout(() => onDealCard(card.rank, card.suit, target), delay);
    });
    setTimeout(() => {
      setStatus('idle'); setCards([]); setPreviewSrc(null);
      showToast(`✓ ${cards.length} card${cards.length!==1?'s':''} applied`, 'success');
    }, (timing === 'human' ? cum : cards.length * 50) + 300);
  };

  const handleReset = () => { setStatus('idle'); setCards([]); setPreviewSrc(null); setErrorMsg(''); };
  const changeCard  = (i, u) => setCards(cs => cs.map((c, idx) => idx===i ? u : c));
  const removeCard  = (i)    => setCards(cs => cs.filter((_, idx) => idx !== i));

  const isIdle       = status === 'idle'       || status === 'error';
  const isProcessing = status === 'processing';
  const isConfirming = status === 'confirming';
  const isApplying   = status === 'applying';
  const highConf     = cards.filter(c => c.confidence >= CONF_HIGH).length;
  const lowConf      = cards.filter(c => c.confidence <  CONF_MED).length;

  return (
    <div>
      {/* Stealth note */}
      <div style={{
        fontSize:9, color:C.jade, marginBottom:8,
        background:C.jadeD, border:`1px solid ${C.jade}25`,
        borderRadius:4, padding:'4px 8px',
      }}>
        🔒 Stealth — OS screenshot tool, zero browser APIs, casino cannot detect
      </div>

      {/* Controls */}
      <div style={{display:'flex', gap:6, marginBottom:10}}>
        <div style={{flex:1}}>
          <div style={{fontSize:9, color:C.muted, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.08em'}}>Assign to</div>
          <select value={applyTarget} onChange={e => setApplyTarget(e.target.value)}
            disabled={isApplying}
            style={{width:'100%', padding:'5px 6px', fontSize:11,
              background:C.base4, color:C.text, borderRadius:5,
              border:'1px solid rgba(255,255,255,0.1)'}}>
            <option value="auto">Auto (1-2 Player, 3-4 Dealer)</option>
            <option value="player">All → Player</option>
            <option value="dealer">All → Dealer</option>
            <option value="seen">All → Seen</option>
          </select>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:9, color:C.muted, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.08em'}}>Timing</div>
          <select value={timing} onChange={e => setTiming(e.target.value)}
            disabled={isApplying}
            style={{width:'100%', padding:'5px 6px', fontSize:11,
              background:C.base4, color:C.text, borderRadius:5,
              border:'1px solid rgba(255,255,255,0.1)'}}>
            <option value="human">🎲 Human delays</option>
            <option value="instant">⚡ Instant</option>
          </select>
        </div>
      </div>

      {/* Paste zone — idle/error */}
      {isIdle && (
        <PasteZone />
      )}

      {/* Error */}
      {status === 'error' && errorMsg && (
        <div style={{padding:'8px 10px', borderRadius:5, marginBottom:8,
          background:C.rubyD, border:'1px solid rgba(255,92,92,0.3)',
          color:C.ruby, fontSize:11}}>⚠ {errorMsg}</div>
      )}

      {/* Processing */}
      {isProcessing && (
        <div style={{textAlign:'center', padding:'16px 0', color:C.muted, fontSize:12}}>
          <div style={{fontSize:22, marginBottom:6, display:'inline-block',
            animation:'cv-spin 0.8s linear infinite'}}>⟳</div>
          <div>Detecting cards…</div>
        </div>
      )}

      {/* Applying */}
      {isApplying && (
        <div style={{textAlign:'center', padding:'16px 0', color:C.jade, fontSize:12}}>
          <div style={{fontSize:22, marginBottom:6}}>🃏</div>
          <div>Applying {cards.length} cards{timing==='human' ? ' with human timing…' : '…'}</div>
        </div>
      )}

      {/* Confirmation */}
      {isConfirming && (
        <>
          <div style={{position:'relative', marginBottom:8, borderRadius:6, overflow:'hidden'}}>
            <img ref={previewRef} src={previewSrc} alt="" style={{display:'none'}} />
            <canvas ref={canvasRef} style={{
              width:'100%', borderRadius:6, display:'block',
              border:'1px solid rgba(255,255,255,0.08)'}} />
          </div>
          <div style={{display:'flex', gap:8, marginBottom:7, fontSize:10, color:C.muted}}>
            <span style={{color:C.jade}}>✓ {highConf} high</span>
            {lowConf > 0 && <span style={{color:C.ruby}}>⚠ {lowConf} check</span>}
            <span style={{marginLeft:'auto'}}>{cards.length} card{cards.length!==1?'s':''}</span>
          </div>
          <div style={{maxHeight:200, overflowY:'auto', marginBottom:8}}>
            {cards.map((c, i) => (
              <CardRow key={i} card={c} index={i} onChange={changeCard} onRemove={removeCard} />
            ))}
          </div>
          <div style={{display:'flex', gap:6, marginBottom:6}}>
            <button onClick={handleApply} disabled={!cards.length}
              style={{
                flex:2, padding:'9px 0', fontSize:12, fontWeight:700, borderRadius:7,
                background: cards.length ? C.jadeD : 'transparent',
                border:`1px solid ${cards.length ? C.jade+'80' : 'rgba(255,255,255,0.08)'}`,
                color: cards.length ? C.jade : C.muted,
                cursor: cards.length ? 'pointer' : 'not-allowed',
              }}>
              ✓ Apply {cards.length} Card{cards.length!==1?'s':''}
            </button>
            <button onClick={handleReset}
              style={{flex:1, padding:'9px 0', background:'transparent',
                border:'1px solid rgba(255,255,255,0.1)', borderRadius:7,
                color:C.muted, fontSize:12, cursor:'pointer'}}>
              ✕ Cancel
            </button>
          </div>
          <p style={{fontSize:10, color:C.muted, textAlign:'center', margin:0}}>
            Edit rank/suit if wrong. × to remove false detections.
          </p>
        </>
      )}

      {isIdle && (
        <div style={{padding:'7px 10px', borderRadius:5, marginTop:8,
          background:C.base2, border:'1px solid rgba(255,255,255,0.06)',
          fontSize:10, color:C.muted, lineHeight:1.8}}>
          <div style={{fontWeight:700, color:C.sec, marginBottom:2}}>Screenshot shortcuts</div>
          <div><span style={{color:C.gold}}>Windows:</span> Win+Shift+S → region → Ctrl+V</div>
          <div><span style={{color:C.gold}}>macOS:</span> Cmd+Shift+4 → drag → Cmd+V</div>
          <div><span style={{color:C.gold}}>Linux:</span> PrtScn or Flameshot → Ctrl+V</div>
        </div>
      )}
    </div>
  );
}

function PasteZone() {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const h = () => { setPulse(true); setTimeout(() => setPulse(false), 700); };
    document.addEventListener('paste', h);
    return () => document.removeEventListener('paste', h);
  }, []);
  return (
    <div style={{
      border:`2px dashed ${pulse ? C.jade : 'rgba(106,175,255,0.3)'}`,
      borderRadius:8, padding:'18px 12px', textAlign:'center',
      background: pulse ? C.jadeD : 'transparent',
      transition:'all 0.15s', marginBottom:8,
    }}>
      <div style={{fontSize:22, marginBottom:4}}>{pulse ? '✅' : '📋'}</div>
      <div style={{fontSize:12, fontWeight:700, color: pulse ? C.jade : C.sapph, marginBottom:4}}>
        {pulse ? 'Screenshot received!' : 'Ctrl+V  /  Cmd+V to paste'}
      </div>
      <div style={{fontSize:10, color:C.muted}}>
        Take OS screenshot first, then paste here
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// LIVE MODE — server auto-scans screen via mss
// ══════════════════════════════════════════════════════════════
//
// FpsSelector — buttons to choose how many times per second to scan.
// Higher FPS = faster detection but more CPU usage.
// 2fps is usually enough for blackjack (cards don't change that fast).
function FpsSelector({ value, onChange }) {
  const opts = [{fps:0,label:'Off'},{fps:2,label:'2fps'},{fps:5,label:'5fps'},{fps:10,label:'10fps'}];
  return (
    <div style={{
      display:'inline-flex', borderRadius:6, overflow:'hidden',
      border:'1px solid rgba(255,255,255,0.12)', flexShrink:0,
    }}>
      {opts.map(({fps, label}, i) => {
        const active = value === fps;
        return (
          <button key={fps} onClick={() => onChange(fps)}
            style={{
              padding:'4px 10px', fontSize:10, fontWeight: active ? 700 : 400,
              cursor:'pointer', whiteSpace:'nowrap',
              borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
              background: active ? C.sapph : 'transparent',
              color: active ? '#0a0e18' : C.muted,
              transition:'all 0.12s',
            }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function BigAction({ action }) {
  if (!action) return (
    <div style={{textAlign:'center', padding:'10px 0', color:C.muted, fontSize:13}}>
      Waiting for cards…
    </div>
  );
  const col = ACTION_COLORS[action] || C.text;
  return (
    <div style={{
      textAlign:'center', padding:'12px 0',
      fontSize:'2.2rem', fontWeight:800, letterSpacing:'0.04em',
      color:col, fontFamily:'Syne, sans-serif',
      textShadow:`0 0 20px ${col}50`,
    }}>
      {action}
    </div>
  );
}

function CountBar({ tc, rc, adv, decksLeft }) {
  const col = countColor(tc);
  return (
    <div style={{
      display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr',
      gap:4, padding:'8px 0',
      borderTop:'1px solid rgba(255,255,255,0.07)',
      borderBottom:'1px solid rgba(255,255,255,0.07)', marginBottom:8,
    }}>
      {[
        ['True',  tc >= 0 ? `+${tc}` : String(tc), col],
        ['RC',    rc >= 0 ? `+${rc}` : String(rc),  countColor(rc/2)],
        ['Edge',  `${adv >= 0 ? '+' : ''}${adv}%`, adv >= 0 ? C.jade : C.ruby],
        ['Decks', decksLeft, C.muted],
      ].map(([label, val, color]) => (
        <div key={label} style={{textAlign:'center'}}>
          <div style={{fontSize:9, color:C.muted, textTransform:'uppercase',
            letterSpacing:'0.07em', marginBottom:2}}>{label}</div>
          <div style={{fontSize:16, fontWeight:700, color, fontFamily:'DM Mono, monospace'}}>
            {val}
          </div>
        </div>
      ))}
    </div>
  );
}

function BetBadge({ bet, betAction }) {
  if (!bet) return null;
  const isMax = betAction && betAction.includes('MAXIMUM');
  const isMin = betAction && betAction.includes('MINIMUM');
  const col   = isMax ? C.jade : isMin ? C.muted : C.gold;
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'6px 10px', borderRadius:6,
      background:`${col}12`, border:`1px solid ${col}40`, marginBottom:8,
    }}>
      <span style={{fontSize:10, color:C.muted}}>Recommended Bet</span>
      <span style={{fontSize:18, fontWeight:800, color:col,
        fontFamily:'DM Mono, monospace'}}>${bet}</span>
    </div>
  );
}

function StatusDot({ running, stable, cardsDetected }) {
  const color = !running ? C.muted
              : cardsDetected > 0 ? C.jade
              : stable ? C.gold : C.sapph;
  const label = !running ? 'Off'
              : cardsDetected > 0 ? `${cardsDetected} card${cardsDetected!==1?'s':''} seen`
              : stable ? 'Watching…' : 'Scanning…';
  return (
    <div style={{display:'flex', alignItems:'center', gap:5}}>
      <div style={{
        width:7, height:7, borderRadius:'50%', background:color,
        boxShadow: running ? `0 0 6px ${color}` : 'none',
        animation: running && !stable ? 'live-pulse 1.5s ease-in-out infinite' : 'none',
      }}/>
      <span style={{fontSize:10, color}}>{label}</span>
    </div>
  );
}

function SetupGuide({ available }) {
  const [open, setOpen] = useState(false);
  if (available) return null;
  return (
    <div style={{marginBottom:10}}>
      <div style={{
        padding:'8px 10px', borderRadius:6,
        background:C.goldD, border:`1px solid ${C.gold}40`,
        fontSize:10, color:C.gold,
      }}>
        ⚠ Screen capture not installed.
        <button onClick={() => setOpen(o => !o)}
          style={{marginLeft:6, background:'transparent', border:'none',
            color:C.gold, cursor:'pointer', fontSize:10, textDecoration:'underline'}}>
          {open ? 'hide' : 'setup'}
        </button>
      </div>
      {open && (
        <div style={{
          padding:'10px', fontSize:10, background:C.base2,
          border:`1px solid rgba(255,255,255,0.06)`,
          borderTop:'none', borderRadius:'0 0 6px 6px',
          lineHeight:1.8, color:C.sec,
        }}>
          <div style={{fontWeight:700, marginBottom:4, color:C.text}}>Install (OS-level, undetectable):</div>
          <div><span style={{color:C.jade}}>Fastest:</span> <code style={{background:C.base3, padding:'1px 4px', borderRadius:3}}>pip install mss</code></div>
          <div style={{marginTop:4, color:C.muted}}>Then restart: <code style={{background:C.base3, padding:'1px 4px', borderRadius:3}}>python main.py web</code></div>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// WINDOW PICKER — dropdown to select which OS window to scan
// ══════════════════════════════════════════════════════════════
//
// Fetches /api/windows on mount and whenever the user opens the dropdown.
// On selection, calls /api/live/set_window (REST) and emits live_set_window
// (socket) to update the scanner ROI to that window's screen coordinates.
// Browser windows (Chrome/Edge/Firefox/Stake etc.) are sorted to the top.

function WindowPicker({ socket, onWindowSelect }) {
  const { useState, useEffect } = React;
  const [open,    setOpen]    = useState(false);
  const [windows, setWindows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const fetchWindows = () => {
    setLoading(true);
    fetch('/api/windows')
      .then(r => r.json())
      .then(d => { setWindows(d.windows || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open) fetchWindows();
  };

  const handlePick = (win) => {
    setSelected(win);
    setOpen(false);
    // Tell server to restrict scan to this window's screen coordinates
    const payload = { x: win.x, y: win.y, w: win.w, h: win.h, title: win.title };
    if (socket && socket.connected) {
      socket.emit('live_set_window', payload);
    } else {
      fetch('/api/live/set_window', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
    if (onWindowSelect) onWindowSelect(win);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSelected(null);
    // Clear ROI — scan full screen again
    if (socket && socket.connected) {
      socket.emit('live_set_window', { x: 0, y: 0, w: 0, h: 0, title: 'Full Screen' });
    } else {
      fetch('/api/live/set_window', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: 0, y: 0, w: 0, h: 0 }),
      }).catch(() => {});
    }
  };

  // Highlight keywords that suggest casino/browser windows
  const isBrowser = (title) => {
    const t = title.toLowerCase();
    return ['chrome','firefox','edge','opera','brave','safari',
             'stake','casino','blackjack','21','bet'].some(k => t.includes(k));
  };

  return (
    <div style={{ position: 'relative', marginBottom: 8 }}>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
          background: selected ? C.sapphD : 'rgba(255,255,255,0.04)',
          border: `1px solid ${selected ? C.sapph + '60' : 'rgba(255,255,255,0.10)'}`,
          color: selected ? C.sapph : C.muted,
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 13 }}>🖥</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.title : 'Full screen (click to pick a window)'}
        </span>
        {selected && (
          <span
            onClick={handleClear}
            style={{ fontSize: 14, color: C.muted, padding: '0 2px', lineHeight: 1, cursor: 'pointer' }}
            title="Clear — scan full screen"
          >×</span>
        )}
        <span style={{ fontSize: 9, color: C.muted }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown list */}
      {open && (
        <div style={{
          position: 'absolute', zIndex: 999, top: 'calc(100% + 4px)', left: 0, right: 0,
          background: C.base2, border: `1px solid ${C.sapph}40`,
          borderRadius: 8, overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          maxHeight: 260, overflowY: 'auto',
        }}>
          {loading && (
            <div style={{ padding: '12px', textAlign: 'center', color: C.muted, fontSize: 11 }}>
              Scanning open windows…
            </div>
          )}

          {!loading && windows.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 10, lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, color: C.ruby, marginBottom: 6 }}>
                ⚠ No windows detected
              </div>
              <div style={{ color: C.sec, marginBottom: 4 }}>
                Restart the server, then click the dropdown again.
              </div>
              <div style={{ color: C.muted, marginBottom: 8, fontSize: 9 }}>
                If this keeps happening, launch Chrome with remote debugging to list tabs individually:
              </div>
              <code style={{ display:'block', padding:'5px 8px', marginBottom: 10,
                background: C.base3, borderRadius: 4, color: C.jade, fontSize: 9 }}>
                chrome.exe --remote-debugging-port=9222
              </code>
              <div style={{ fontSize: 9, color: C.muted, marginBottom: 4, fontWeight: 700 }}>
                Or set scan region manually:
              </div>
            </div>
          )}

          {/* Full screen option */}
          {!loading && (
            <button
              onClick={() => handlePick({ title: 'Full Screen', x: 0, y: 0, w: 0, h: 0 })}
              style={{
                width: '100%', padding: '8px 12px', fontSize: 11, textAlign: 'left',
                background: !selected ? 'rgba(106,175,255,0.08)' : 'transparent',
                border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)',
                color: !selected ? C.sapph : C.sec, cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: 8,
              }}
            >
              <span>🖥</span>
              <span>Full Screen</span>
              {!selected && <span style={{ marginLeft: 'auto', fontSize: 9, color: C.sapph }}>✓ active</span>}
            </button>
          )}

          {!loading && (() => {
            const tabs = windows.filter(w => w.is_tab);
            const wins = windows.filter(w => !w.is_tab);

            const renderItem = (win, i, arr) => {
              const browser  = isBrowser(win.title);
              const isActive = selected && selected.id === win.id;
              return (
                <button key={win.id || i} onClick={() => handlePick(win)}
                  style={{
                    width: '100%', padding: '7px 12px', fontSize: 10, textAlign: 'left',
                    background: isActive ? 'rgba(106,175,255,0.10)' : 'transparent',
                    border: 'none',
                    borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    color: isActive ? C.sapph : browser ? C.text : C.sec,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <span style={{flexShrink:0}}>{win.is_tab ? '🌐' : browser ? '🖥' : '🪟'}</span>
                  <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                    <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {win.title.replace('[TAB] ', '')}
                    </div>
                    {win.url && (
                      <div style={{ fontSize: 8, color: C.muted, overflow:'hidden',
                        textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {win.url.replace(/^https?:\/\//, '').slice(0, 50)}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 9, color: C.muted, flexShrink: 0 }}>
                    {win.w > 0 ? `${win.w}×${win.h}` : ''}
                  </span>
                  {isActive && <span style={{ fontSize: 9, color: C.sapph }}>✓</span>}
                </button>
              );
            };

            return (
              <>
                {tabs.length > 0 && (
                  <>
                    <div style={{ padding:'4px 12px', fontSize:8, fontWeight:700,
                      color: C.sapph, textTransform:'uppercase', letterSpacing:'0.08em',
                      background: 'rgba(106,175,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                      🌐 Browser Tabs
                    </div>
                    {tabs.map((w, i) => renderItem(w, i, tabs))}
                  </>
                )}
                {wins.length > 0 && (
                  <>
                    <div style={{ padding:'4px 12px', fontSize:8, fontWeight:700,
                      color: C.muted, textTransform:'uppercase', letterSpacing:'0.08em',
                      background: 'rgba(255,255,255,0.03)', borderBottom:'1px solid rgba(255,255,255,0.05)',
                      borderTop: tabs.length > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                      🪟 OS Windows
                    </div>
                    {wins.map((w, i) => renderItem(w, i, wins))}
                  </>
                )}
                {tabs.length === 0 && wins.length > 0 && (
                  <div style={{ padding:'6px 12px 4px', fontSize:9, color: C.muted,
                    borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                    💡 Launch Chrome with <code style={{color:C.gold}}>--remote-debugging-port=9222</code> to see individual tabs
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── LiveMode — the main live scan start/stop/display component ───────────────
//
// When the user clicks "Start Live Scan":
//   1. We emit 'live_start' over the WebSocket to the Flask server
//   2. Flask starts a background thread that captures the screen using mss
//   3. Each captured frame is processed by OpenCV (card detection)
//   4. Detected cards are deduplicated and fed into the counting engine
//   5. Flask emits 'live_status' and 'live_update' events back to this panel
//   6. We update the displayed count, action recommendation, and bet size
//
// The optional region input lets users restrict scanning to just the casino
// window area (e.g. x=0 y=0 w=800 h=600) instead of the full screen,
// which is faster and more accurate.
function LiveMode({ socket, count }) {
  // Is the live scanner currently running?
  const [running, setRunning] = useState(false);

  // How many frames per second to capture
  const [fps, setFps] = useState(5);

  // The latest live data pushed by the server (count, recommendation, bet)
  const [liveData, setLiveData] = useState(null);

  // Status message from the server (e.g. "Live scanner started (mss, 5fps)")
  const [statusMsg, setStatusMsg] = useState('');

  // Whether screen capture is available (mss or PIL installed)
  const [available, setAvailable] = useState(true);

  // Whether to show the optional scan region input fields
  const [showRegion, setShowRegion] = useState(true);   // open by default — always useful

  // The x, y, width, height of the scan region (empty = full screen)
  const [region, setRegion] = useState({x:'',y:'',w:'',h:''});

  // Sync live scanner state from REST (used on mount, on tab refocus, on reconnect)
  const syncStatus = () => {
    fetch('/api/live/status').then(r => r.json()).then(d => {
      setRunning(!!d.running);
      setAvailable(d.available !== false);
      if (d.fps) setFps(d.fps);
    }).catch(() => {});
  };

  useEffect(() => {
    if (!socket) return;

    const onStatus = (data) => {
      setRunning(!!data.running);
      if (data.available !== undefined) setAvailable(!!data.available);
      if (data.message) setStatusMsg(data.message);
      if (data.fps)     setFps(data.fps);
    };

    socket.on('live_status', onStatus);
    socket.on('live_update', setLiveData);

    // Re-subscribe to live_update after socket reconnects
    // (browser may have throttled/killed the WS while tab was hidden)
    const onReconnect = () => {
      syncStatus();
      setStatusMsg('Reconnected');
    };
    socket.on('reconnect', onReconnect);
    socket.on('connect',   onReconnect);   // also fires on first connect

    // When the user switches back to this tab, re-sync state
    const onVisibility = () => {
      if (!document.hidden) syncStatus();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Initial sync
    syncStatus();

    return () => {
      socket.off('live_status', onStatus);
      socket.off('live_update', setLiveData);
      socket.off('reconnect',   onReconnect);
      socket.off('connect',     onReconnect);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [socket]);

  const start = () => {
    const reg = (showRegion && region.w && region.h)
      ? [parseInt(region.x)||0, parseInt(region.y)||0, parseInt(region.w), parseInt(region.h)]
      : null;
    const payload = { fps, region: reg };
    // Try WebSocket first; fall back to REST if socket is missing/disconnected
    if (socket && socket.connected) {
      socket.emit('live_start', payload);
    } else {
      fetch('/api/live/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(r => r.json())
        .then(d => {
          setRunning(true);
          setStatusMsg(d.message || 'Live scanner started');
          if (d.available === false) setAvailable(false);
        })
        .catch(() => setStatusMsg('Failed to start — is the server running?'));
    }
  };

  const stop = () => {
    if (socket && socket.connected) {
      socket.emit('live_stop');
    } else {
      fetch('/api/live/stop', { method: 'POST' })
        .then(() => { setRunning(false); setStatusMsg('Stopped'); })
        .catch(() => {});
    }
  };
  const changeFps = (f) => {
    if (f === 0) { stop(); setFps(0); return; }   // Off = stop scanning
    setFps(f);
    if (running) {
      if (socket && socket.connected) socket.emit('live_set_fps', { fps: f });
      else fetch('/api/live/set_fps', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({fps:f}) }).catch(()=>{});
    }
  };
  const newHand = () => {
    if (socket && socket.connected) socket.emit('live_new_hand');
    else fetch('/api/live/new_hand', { method:'POST' }).catch(()=>{});
  };

  const d   = liveData;
  const tc  = d ? d.true_count       : (count ? count.true      : 0);
  const rc  = d ? d.running          : (count ? count.running    : 0);
  const adv = d ? d.advantage        : (count ? count.advantage  : 0);
  const dk  = d ? d.decks_remaining  : (count ? count.decks_remaining : '—');
  const rec = d ? d.recommendation   : null;
  const bet = d ? d.bet              : 0;
  const ba  = d ? d.bet_action       : '';

  return (
    <div>
      {/* Window / tab picker — lets user point scanner at a specific browser window */}
      <WindowPicker socket={socket} />

      <div style={{
        fontSize:9, color:C.jade, marginBottom:8,
        background:C.jadeD, border:`1px solid ${C.jade}25`,
        borderRadius:4, padding:'4px 8px',
      }}>
        🔒 Stealth — server-side OS capture, casino JS cannot detect
      </div>

      <SetupGuide available={available} />

      <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
        <StatusDot running={running} stable={d?.stable} cardsDetected={d?.cards_detected||0} />
        <div style={{flex:1}} />
        <FpsSelector value={fps} onChange={changeFps} />
      </div>

      {/* Optional region */}
      <div style={{marginBottom:8}}>
        <button onClick={() => setShowRegion(r => !r)}
          style={{width:'100%', padding:'4px', fontSize:10, borderRadius:4,
            background:showRegion ? C.base3 : 'transparent',
            border:'1px solid rgba(255,255,255,0.08)',
            color:C.muted, cursor:'pointer', textAlign:'left'}}>
          {showRegion ? '▲' : '▼'} Restrict scan region (optional)
        </button>
        {showRegion && (
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4,
            padding:'6px', background:C.base2, borderRadius:'0 0 4px 4px',
            border:'1px solid rgba(255,255,255,0.06)', borderTop:'none'}}>
            {['x','y','w','h'].map(k => (
              <div key={k}>
                <div style={{fontSize:9, color:C.muted, marginBottom:2}}>{k.toUpperCase()}</div>
                <input type="number" value={region[k]}
                  onChange={e => setRegion(r => ({...r, [k]:e.target.value}))}
                  placeholder={k==='w'?'1920':k==='h'?'1080':'0'}
                  style={{width:'100%', padding:'3px 4px', fontSize:11,
                    background:C.base4, color:C.text, borderRadius:4,
                    border:'1px solid rgba(255,255,255,0.1)'}} />
              </div>
            ))}
            <div style={{gridColumn:'1/-1', fontSize:9, color:C.muted}}>
              Leave blank for full screen.
            </div>
          </div>
        )}
      </div>

      {/* Start / Stop */}
      {!running ? (
        <button onClick={start}
          style={{width:'100%', padding:'10px', fontSize:13, fontWeight:700,
            background:C.jadeD, border:`1px solid ${C.jade}70`,
            borderRadius:7, color:C.jade, cursor:'pointer',
            letterSpacing:'0.04em', marginBottom:8}}>
          ▶ Start Live Scan
        </button>
      ) : (
        <button onClick={stop}
          style={{width:'100%', padding:'10px', fontSize:13, fontWeight:700,
            background:C.rubyD, border:`1px solid ${C.ruby}70`,
            borderRadius:7, color:C.ruby, cursor:'pointer',
            letterSpacing:'0.04em', marginBottom:8}}>
          ■ Stop Scanning
        </button>
      )}

      {statusMsg && (
        <div style={{fontSize:10, color:C.muted, textAlign:'center', marginBottom:8}}>
          {statusMsg}
        </div>
      )}

      {(running || d) && (
        <>
          <CountBar tc={tc} rc={rc} adv={adv} decksLeft={dk} />
          <BetBadge bet={bet} betAction={ba} />
          {rec?.is_deviation && (
            <div style={{textAlign:'center', marginBottom:6, fontSize:9, fontWeight:700,
              color:C.ameth, background:C.amethD,
              border:`1px solid ${C.ameth}50`, borderRadius:4, padding:'3px 0'}}>
              DEVIATION — overrides basic ({rec.basic_action})
            </div>
          )}
          <BigAction action={rec?.action} />
          {d?.hand_value > 0 && (
            <div style={{display:'flex', justifyContent:'center', gap:12,
              marginTop:6, fontSize:10, color:C.muted}}>
              <span>Hand: <b style={{color:C.sec}}>{d.hand_value}</b>
                {d.is_soft && <span style={{color:C.gold}}> soft</span>}
              </span>
              <span>Cards: <b style={{color:C.sec}}>{d.cards_this_hand}</b></span>
            </div>
          )}
        </>
      )}

      {!running && !d && (
        <div style={{padding:'8px 10px', borderRadius:5, fontSize:10,
          background:C.base2, border:'1px solid rgba(255,255,255,0.05)',
          color:C.muted, lineHeight:1.7}}>
          <div style={{fontWeight:700, color:C.sec, marginBottom:3}}>How it works</div>
          <div>1. Open casino in another browser tab</div>
          <div>2. Arrange so cards are visible, or go fullscreen</div>
          <div>3. Click <b>Start Live Scan</b></div>
          <div>4. Count + best move appear here automatically</div>
          <div style={{marginTop:4, color:C.jade}}>✓ Casino tab sees nothing</div>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// ROOT COMPONENT — wires the three modes together
// ══════════════════════════════════════════════════════════════
//
// This is the component that App.js uses. It renders:
//   1. The ModeToggle buttons at the top
//   2. The correct sub-UI based on scanMode (Manual / Screenshot / Live)
//
// All three modes share the same Widget wrapper and header.
// Switching modes just changes which content renders inside that wrapper.
function LiveOverlayPanel({ socket, count, scanMode, onSetMode, onDealCard, dealTarget }) {
  // The accent colour on the Widget title bar changes with the active mode:
  //   live = green (active, scanning)    screenshot = blue    manual = grey
  const accentColor = scanMode === 'live'       ? C.jade
                    : scanMode === 'screenshot'  ? C.sapph : C.muted;
  return (
    <Widget title="Card Scanner" accent={accentColor}>
      <ModeToggle scanMode={scanMode} onSetMode={onSetMode} />

      {scanMode === 'manual' && <ManualHint />}

      {scanMode === 'screenshot' && (
        <ScreenshotMode onDealCard={onDealCard} dealTarget={dealTarget} />
      )}

      {scanMode === 'live' && (
        <LiveMode socket={socket} count={count} />
      )}

      <style>{`
        @keyframes live-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.3)}}
        @keyframes cv-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
      `}</style>
    </Widget>
  );
}