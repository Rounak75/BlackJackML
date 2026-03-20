/*
 * components/CVScanPanel.js  —  CV Card Scanner (Stealth Edition)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * STEALTH DESIGN — why this approach is undetectable by online casinos:
 *
 *  ✅  NO getDisplayMedia()   — no screen-share banner, no browser indicator
 *  ✅  NO getUserMedia()      — no camera light, no permission prompt
 *  ✅  NO external network    — CV runs on localhost:5000, zero outside calls
 *  ✅  NO browser extension   — pure JS in a separate tab, fully sandboxed
 *  ✅  Tab isolation          — casino JS runs in its own sandbox and cannot
 *                               see any other tab, window, or localhost port
 *  ✅  Human-like timing      — cards applied with Gaussian-jittered delays
 *                               (150–900ms apart) so entry looks manual
 *  ✅  OS screenshot tools    — user uses Win+Shift+S / Cmd+Shift+4 which are
 *                               OS-level, 100% invisible to any website
 *
 * TWO MODES (toggled by the switch at the top of this panel):
 *
 *  📷  CV MODE  — user pastes a screenshot, CV detects cards, confirm, apply
 *  ✋  MANUAL   — normal card grid (standard UI, no CV)
 *
 * FLOW (CV mode):
 *   1. Take OS screenshot  (Win+Shift+S / Cmd+Shift+4 / PrtScn)
 *   2. Switch to BlackjackML tab
 *   3. Press Ctrl+V — paste is intercepted by the paste zone
 *   4. CV backend reads ranks + suits from the image
 *   5. Preview with bounding boxes is shown, all editable
 *   6. Click Apply — cards submitted with human-like timing
 *
 * Props:
 *   onDealCard  (rank, suit, target?) => void
 *   dealTarget  string
 *   cvMode      bool
 *   onToggle    () => void
 */

const { useState, useRef, useCallback, useEffect } = React;

const VALID_RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const VALID_SUITS = ['spades','hearts','diamonds','clubs'];
const SUIT_ICONS  = { spades:'♠', hearts:'♥', diamonds:'♦', clubs:'♣' };
const SUIT_RED    = { hearts:true, diamonds:true, spades:false, clubs:false };

const CONF_HIGH = 0.82;
const CONF_MED  = 0.60;

const HUMAN_BASE = 420;
const HUMAN_SD   = 130;
const HUMAN_MIN  = 150;
const HUMAN_MAX  = 950;

const C = {
  jade:'#44e882',  jadeD:'rgba(68,232,130,0.10)',
  gold:'#ffd447',  goldD:'rgba(255,212,71,0.10)',
  ruby:'#ff5c5c',  rubyD:'rgba(255,92,92,0.10)',
  sapph:'#6aafff', sapphD:'rgba(106,175,255,0.10)',
  base1:'#111827', base2:'#1a2236', base3:'#212d45', base4:'#2a3a58',
  text:'#f0f4ff', sec:'#b0bfd8', muted:'#7a8eab',
};

function humanDelay() {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.round(Math.max(HUMAN_MIN, Math.min(HUMAN_MAX, HUMAN_BASE + z * HUMAN_SD)));
}

function drawDetections(canvas, imgEl, detections) {
  const ctx = canvas.getContext('2d');
  canvas.width  = imgEl.naturalWidth  || imgEl.width;
  canvas.height = imgEl.naturalHeight || imgEl.height;
  ctx.drawImage(imgEl, 0, 0);
  detections.forEach((d, i) => {
    const [x, y, w, h] = d.bbox;
    const col = d.confidence >= CONF_HIGH ? '#44e882' : d.confidence >= CONF_MED ? '#ffd447' : '#ff5c5c';
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

function ModeToggle({ cvMode, onToggle }) {
  return (
    <div onClick={onToggle} style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'8px 12px', borderRadius:8, marginBottom:10, cursor:'pointer', userSelect:'none',
      background: cvMode ? 'rgba(106,175,255,0.08)' : C.base2,
      border:`1px solid ${cvMode ? '#6aafff60' : 'rgba(255,255,255,0.08)'}`,
    }}>
      <div>
        <div style={{fontSize:12, fontWeight:700, color: cvMode ? C.sapph : C.sec}}>
          {cvMode ? '📷 CV Auto-Scan Mode' : '✋ Manual Entry Mode'}
        </div>
        <div style={{fontSize:9, color:C.muted, marginTop:1}}>
          {cvMode ? 'Paste a screenshot → CV reads cards' : 'Click the card grid to enter cards'}
        </div>
      </div>
      <div style={{
        width:40, height:22, borderRadius:11, position:'relative', flexShrink:0,
        background: cvMode ? C.sapph : C.base4,
        border:`1px solid ${cvMode ? C.sapph : 'rgba(255,255,255,0.15)'}`,
        transition:'background 0.2s',
      }}>
        <div style={{
          position:'absolute', top:2, left: cvMode ? 20 : 2,
          width:16, height:16, borderRadius:'50%', background:'white',
          transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.4)',
        }}/>
      </div>
    </div>
  );
}

function StealthBanner() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{marginBottom:8}}>
      <button onClick={() => setOpen(o => !o)} style={{
        width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
        background:'rgba(68,232,130,0.06)', border:'1px solid rgba(68,232,130,0.2)',
        borderRadius:open ? '6px 6px 0 0' : 6, padding:'5px 10px', cursor:'pointer',
        color:C.jade, fontSize:10, fontWeight:700,
      }}>
        <span>🔒 Stealth — undetectable by online casinos</span>
        <span style={{opacity:0.6}}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          background:'rgba(68,232,130,0.03)', border:'1px solid rgba(68,232,130,0.15)',
          borderTop:'none', borderRadius:'0 0 6px 6px',
          padding:'8px 10px', fontSize:10, color:C.sec, lineHeight:1.8,
        }}>
          <div>✅ <b>No screen-share API</b> — OS screenshot tool, zero browser indicators</div>
          <div>✅ <b>No camera access</b> — clipboard paste only, no getUserMedia()</div>
          <div>✅ <b>Localhost only</b> — CV on 127.0.0.1:5000, casino JS is sandboxed</div>
          <div>✅ <b>Tab isolation</b> — casino cannot read other tabs or local ports</div>
          <div>✅ <b>Human timing</b> — cards applied {HUMAN_MIN}–{HUMAN_MAX}ms apart, randomised</div>
          <div style={{color:C.muted, marginTop:4}}>
            Casino JS is strictly contained to its own origin. This app is a completely
            separate browsing context on localhost — invisible to any casino.
          </div>
        </div>
      )}
    </div>
  );
}

function PasteZone({ onImagePasted, disabled }) {
  const [hover, setHover] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (disabled) return;
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          setPulse(true);
          setTimeout(() => setPulse(false), 700);
          const blob = items[i].getAsFile();
          const reader = new FileReader();
          reader.onload = (ev) => onImagePasted(ev.target.result);
          reader.readAsDataURL(blob);
          e.preventDefault();
          return;
        }
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [disabled, onImagePasted]);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border:`2px dashed ${pulse ? C.jade : hover ? C.sapph : 'rgba(106,175,255,0.3)'}`,
        borderRadius:8, padding:'18px 12px', textAlign:'center',
        background: pulse ? 'rgba(68,232,130,0.08)' : hover ? 'rgba(106,175,255,0.06)' : 'transparent',
        transition:'all 0.15s', marginBottom:10,
      }}>
      <div style={{fontSize:22, marginBottom:4}}>{pulse ? '✅' : '📋'}</div>
      <div style={{fontSize:12, fontWeight:700, color: pulse ? C.jade : C.sapph, marginBottom:4}}>
        {pulse ? 'Screenshot received!' : 'Ctrl+V to paste screenshot'}
      </div>
      <div style={{fontSize:10, color:C.muted, lineHeight:1.6}}>
        <span style={{color:C.gold, fontWeight:600}}>Windows:</span> Win+Shift+S &nbsp;
        <span style={{color:C.gold, fontWeight:600}}>Mac:</span> Cmd+Shift+4 &nbsp;
        <span style={{color:C.gold, fontWeight:600}}>Linux:</span> PrtScn
        <br/>
        <span style={{color:C.sec}}>Take screenshot → switch here → paste</span>
      </div>
    </div>
  );
}

function CardRow({ card, index, onChange, onRemove }) {
  const col = card.confidence >= CONF_HIGH ? C.jade : card.confidence >= CONF_MED ? C.gold : C.ruby;
  const lbl = card.confidence >= CONF_HIGH ? 'HIGH' : card.confidence >= CONF_MED ? 'MED' : 'LOW';
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
      }}>{index+1}</span>

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

function CVScanPanel({ onDealCard, dealTarget, cvMode, onToggle }) {
  const [status,      setStatus]      = useState('idle');
  const [cards,       setCards]       = useState([]);
  const [previewSrc,  setPreviewSrc]  = useState(null);
  const [errorMsg,    setErrorMsg]    = useState('');
  const [applyTarget, setApplyTarget] = useState('auto');
  const [timing,      setTiming]      = useState('human');

  const canvasRef  = useRef(null);
  const previewRef = useRef(null);

  useEffect(() => {
    if (!previewSrc || cards.length === 0 || !canvasRef.current || !previewRef.current) return;
    const img = previewRef.current;
    const draw = () => drawDetections(canvasRef.current, img, cards);
    if (img.complete && img.naturalWidth > 0) draw(); else img.onload = draw;
  }, [previewSrc, cards]);

  const handleImagePasted = useCallback(async (dataUrl) => {
    setErrorMsg(''); setCards([]); setPreviewSrc(dataUrl); setStatus('processing');
    try {
      const resp = await fetch('/api/detect_cards', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({frame: dataUrl}),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      const detected = data.cards || [];
      if (detected.length === 0) throw new Error(
        'No cards detected. Try a closer crop or better lighting.'
      );
      setCards(detected); setStatus('confirming');
    } catch (err) {
      setErrorMsg(err.message); setStatus('error');
    }
  }, []);

  const handleApply = useCallback(() => {
    if (cards.length === 0) return;
    setStatus('applying');
    let cumDelay = 0;
    cards.forEach((card, i) => {
      const target = applyTarget === 'auto'
        ? (i < 2 ? 'player' : i < 4 ? 'dealer' : 'seen')
        : applyTarget;
      const delay = timing === 'human' ? cumDelay : i * 50;
      if (timing === 'human') cumDelay += humanDelay();
      setTimeout(() => onDealCard(card.rank, card.suit, target), delay);
    });
    const total = (timing === 'human' ? cumDelay : cards.length * 50) + 300;
    setTimeout(() => {
      setStatus('idle'); setCards([]); setPreviewSrc(null);
      showToast(`✓ ${cards.length} card${cards.length !== 1 ? 's' : ''} applied`, 'success');
    }, total);
  }, [cards, applyTarget, timing, onDealCard]);

  const handleReset = () => { setStatus('idle'); setCards([]); setPreviewSrc(null); setErrorMsg(''); };
  const handleCardChange = (i, u) => setCards(cs => cs.map((c, idx) => idx === i ? u : c));
  const handleCardRemove = (i)    => setCards(cs => cs.filter((_, idx) => idx !== i));

  const isProcessing = status === 'processing';
  const isConfirming = status === 'confirming';
  const isApplying   = status === 'applying';
  const isError      = status === 'error';
  const isIdle       = status === 'idle';

  const highConf = cards.filter(c => c.confidence >= CONF_HIGH).length;
  const lowConf  = cards.filter(c => c.confidence <  CONF_MED).length;

  return (
    <Widget title="Card Scanner" accent={cvMode ? C.sapph : C.muted}>
      <ModeToggle cvMode={cvMode} onToggle={onToggle} />

      {cvMode && (
        <>
          <StealthBanner />

          {/* Controls row */}
          <div style={{display:'flex', gap:6, marginBottom:10}}>
            <div style={{flex:1}}>
              <div style={{fontSize:9, color:C.muted, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.08em'}}>Assign cards to</div>
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
              <div style={{fontSize:9, color:C.muted, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.08em'}}>Entry timing</div>
              <select value={timing} onChange={e => setTiming(e.target.value)}
                disabled={isApplying}
                style={{width:'100%', padding:'5px 6px', fontSize:11,
                  background:C.base4, color:C.text, borderRadius:5,
                  border:'1px solid rgba(255,255,255,0.1)'}}>
                <option value="human">🎲 Human (random gaps)</option>
                <option value="instant">⚡ Instant (testing)</option>
              </select>
            </div>
          </div>

          {(isIdle || isError) && (
            <PasteZone onImagePasted={handleImagePasted} disabled={isProcessing || isApplying} />
          )}

          {isError && errorMsg && (
            <div style={{padding:'8px 10px', borderRadius:5, marginBottom:8,
              background:C.rubyD, border:'1px solid rgba(255,92,92,0.3)',
              color:C.ruby, fontSize:11}}>⚠ {errorMsg}</div>
          )}

          {isProcessing && (
            <div style={{textAlign:'center', padding:'16px 0', color:C.muted, fontSize:12}}>
              <div style={{fontSize:22, marginBottom:6, animation:'cv-spin 0.8s linear infinite', display:'inline-block'}}>⟳</div>
              <div>Detecting cards…</div>
            </div>
          )}

          {isApplying && (
            <div style={{textAlign:'center', padding:'16px 0', color:C.jade, fontSize:12}}>
              <div style={{fontSize:22, marginBottom:6}}>🃏</div>
              <div>Applying {cards.length} cards{timing === 'human' ? ' with human timing…' : '…'}</div>
            </div>
          )}

          {isConfirming && (
            <>
              <div style={{position:'relative', marginBottom:8, borderRadius:6, overflow:'hidden'}}>
                <img ref={previewRef} src={previewSrc} alt="" style={{display:'none'}} />
                <canvas ref={canvasRef} style={{
                  width:'100%', borderRadius:6, display:'block',
                  border:'1px solid rgba(255,255,255,0.08)'}} />
              </div>

              <div style={{display:'flex', gap:8, marginBottom:7, fontSize:10, color:C.muted}}>
                <span style={{color:C.jade}}>✓ {highConf} high conf</span>
                {lowConf > 0 && <span style={{color:C.ruby}}>⚠ {lowConf} need review</span>}
                <span style={{marginLeft:'auto'}}>{cards.length} card{cards.length !== 1 ? 's' : ''}</span>
              </div>

              <div style={{maxHeight:210, overflowY:'auto', marginBottom:8, paddingRight:2}}>
                {cards.map((card, i) => (
                  <CardRow key={i} card={card} index={i}
                    onChange={handleCardChange} onRemove={handleCardRemove} />
                ))}
              </div>

              <div style={{display:'flex', gap:6, marginBottom:6}}>
                <button onClick={handleApply} disabled={cards.length === 0}
                  style={{
                    flex:2, padding:'9px 0', fontSize:12, fontWeight:700,
                    background: cards.length > 0 ? C.jadeD : 'transparent',
                    border:`1px solid ${cards.length > 0 ? C.jade+'80' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius:7, color: cards.length > 0 ? C.jade : C.muted,
                    cursor: cards.length > 0 ? 'pointer' : 'not-allowed',
                  }}>
                  ✓ Apply {cards.length} Card{cards.length !== 1 ? 's' : ''}
                </button>
                <button onClick={handleReset}
                  style={{flex:1, padding:'9px 0', background:'transparent',
                    border:'1px solid rgba(255,255,255,0.1)', borderRadius:7,
                    color:C.muted, fontSize:12, cursor:'pointer'}}>
                  ✕ Cancel
                </button>
              </div>

              <p style={{fontSize:10, color:C.muted, textAlign:'center', margin:0}}>
                Edit rank/suit if wrong. Remove false detections with ×.
              </p>
            </>
          )}

          {isIdle && (
            <div style={{padding:'7px 10px', borderRadius:5,
              background:C.base2, border:'1px solid rgba(255,255,255,0.06)',
              fontSize:10, color:C.muted, lineHeight:1.8}}>
              <div style={{fontWeight:700, color:C.sec, marginBottom:2}}>Screenshot shortcuts</div>
              <div><span style={{color:C.gold}}>Windows:</span> Win+Shift+S → snip region → Ctrl+V</div>
              <div><span style={{color:C.gold}}>macOS:</span> Cmd+Shift+4 → drag → Cmd+V</div>
              <div><span style={{color:C.gold}}>Linux:</span> PrtScn or Flameshot → Ctrl+V</div>
            </div>
          )}
        </>
      )}

      {!cvMode && (
        <p style={{fontSize:10, color:C.muted, textAlign:'center', marginTop:4, lineHeight:1.6}}>
          Manual mode. Use the card grid to enter cards.<br/>
          Toggle above to enable CV screenshot detection.
        </p>
      )}

      <style>{`@keyframes cv-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </Widget>
  );
}