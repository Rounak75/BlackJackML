const { useState, useEffect, useRef, useCallback } = React;
const C = {
    jade: '#44e882', jadeD: 'rgba(68,232,130,0.10)',
    gold: '#ffd447', goldD: 'rgba(255,212,71,0.10)',
    ruby: '#ff5c5c', rubyD: 'rgba(255,92,92,0.10)',
    sapph: '#6aafff', sapphD: 'rgba(106,175,255,0.10)',
    ameth: '#b99bff', amethD: 'rgba(185,155,255,0.10)',
    base1: '#111827', base2: '#1a2236', base3: '#212d45', base4: '#2a3a58',
    text: '#f0f4ff', sec: '#b0bfd8', muted: '#94a7c4',
};
const ACTION_COLORS = {
    HIT: '#ff5c5c', STAND: '#44e882', DOUBLE: '#ffd447',
    SPLIT: '#b99bff', SURRENDER: '#ff9944',
};
const VALID_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const VALID_SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const SUIT_ICONS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const SUIT_RED = { hearts: true, diamonds: true, spades: false, clubs: false };
const CONF_HIGH = 0.82;
const CONF_MED = 0.60;
const HUMAN_BASE = 420;
const HUMAN_SD = 130;
const HUMAN_MIN = 150;
const HUMAN_MAX = 950;
function humanDelay() {
    const u = 1 - Math.random();
    const v = Math.random();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return Math.round(Math.max(HUMAN_MIN, Math.min(HUMAN_MAX, HUMAN_BASE + z * HUMAN_SD)));
}
function countColor(tc) {
    if (tc >= 3)
        return C.jade;
    if (tc >= 1)
        return '#88eebb';
    if (tc >= -1)
        return C.muted;
    return C.ruby;
}
function drawDetections(canvas, imgEl, detections) {
    const ctx = canvas.getContext('2d');
    canvas.width = imgEl.naturalWidth || imgEl.width;
    canvas.height = imgEl.naturalHeight || imgEl.height;
    ctx.drawImage(imgEl, 0, 0);
    detections.forEach((d, i) => {
        const [x, y, w, h] = d.bbox;
        const col = d.confidence >= CONF_HIGH ? C.jade
            : d.confidence >= CONF_MED ? C.gold : C.ruby;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5;
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
function ModeToggle({ scanMode, onSetMode }) {
    const modes = [
        { id: 'manual', icon: '✋', label: 'Manual', col: C.muted, hint: 'Click the card grid' },
        { id: 'screenshot', icon: '📋', label: 'Screenshot', col: C.sapph, hint: 'Paste OS screenshot' },
        { id: 'live', icon: '🔴', label: 'Live Scan', col: C.jade, hint: 'Auto screen scan' },
    ];
    return (React.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 10 } }, modes.map(({ id, icon, label, col, hint }) => {
        const active = scanMode === id;
        return (React.createElement("button", { key: id, onClick: () => onSetMode(id), "aria-label": hint, "aria-pressed": scanMode === id, style: {
                padding: '7px 4px', fontSize: 10, fontWeight: 700, borderRadius: 6,
                cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                border: `1px solid ${active ? col : 'rgba(255,255,255,0.08)'}`,
                background: active ? `${col}15` : 'transparent',
                color: active ? col : C.muted,
            } },
            React.createElement("div", { style: { fontSize: 14, marginBottom: 1 } }, icon),
            label));
    })));
}
function ManualHint() {
    return (React.createElement("div", { style: {
            padding: '10px', borderRadius: 6, fontSize: 10,
            background: C.base2, border: '1px solid rgba(255,255,255,0.05)',
            color: C.muted, lineHeight: 1.8, textAlign: 'center',
        } },
        React.createElement("div", { style: { fontSize: 18, marginBottom: 4 } }, "\u270B"),
        React.createElement("div", { style: { fontWeight: 700, color: C.sec, marginBottom: 3 } }, "Manual Mode"),
        React.createElement("div", null, "Click cards in the grid below to enter them."),
        React.createElement("div", null, "Switch to Screenshot or Live Scan above for auto-detection.")));
}
function CardRow({ card, index, onChange, onRemove }) {
    const col = card.confidence >= CONF_HIGH ? C.jade
        : card.confidence >= CONF_MED ? C.gold : C.ruby;
    const lbl = card.confidence >= CONF_HIGH ? 'HIGH'
        : card.confidence >= CONF_MED ? 'MED' : 'LOW';
    return (React.createElement("div", { style: {
            display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px',
            borderRadius: 6, background: C.base3, border: '1px solid rgba(255,255,255,0.06)',
            marginBottom: 4,
        } },
        React.createElement("span", { style: {
                width: 20, height: 20, borderRadius: '50%', background: col, color: '#0a0e18',
                fontSize: 10, fontWeight: 700, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            } }, index + 1),
        React.createElement("select", { "aria-label": `Card ${index + 1} rank`, value: card.rank, onChange: e => onChange(index, { ...card, rank: e.target.value }), style: { background: C.base4, color: C.text, width: 50, fontSize: 13, fontWeight: 700,
                borderRadius: 4, padding: '2px 3px', border: '1px solid rgba(255,255,255,0.1)' } }, VALID_RANKS.map(r => React.createElement("option", { key: r, value: r }, r))),
        React.createElement("select", { "aria-label": `Card ${index + 1} suit`, value: card.suit, onChange: e => onChange(index, { ...card, suit: e.target.value }), style: { background: C.base4, color: SUIT_RED[card.suit] ? '#ff7070' : C.text,
                width: 60, fontSize: 13, borderRadius: 4, padding: '2px 3px',
                border: '1px solid rgba(255,255,255,0.1)' } }, VALID_SUITS.map(s => (React.createElement("option", { key: s, value: s, style: { color: SUIT_RED[s] ? '#ff7070' : C.text } },
            SUIT_ICONS[s],
            " ",
            s[0].toUpperCase() + s.slice(1))))),
        React.createElement("span", { style: {
                fontSize: 9, fontWeight: 700, color: col,
                background: col + '20', border: `1px solid ${col}50`,
                borderRadius: 3, padding: '1px 4px', fontFamily: 'monospace',
            } }, lbl),
        React.createElement("button", { "aria-label": `Remove card ${index + 1}`, onClick: () => onRemove(index), style: { marginLeft: 'auto', background: 'transparent', border: 'none',
                color: C.muted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' } }, "\u00D7")));
}
function ScreenshotMode({ onDealCard, dealTarget }) {
    const [status, setStatus] = useState('idle');
    const [cards, setCards] = useState([]);
    const [previewSrc, setPreviewSrc] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [applyTarget, setApplyTarget] = useState('auto');
    const [timing, setTiming] = useState('human');
    const canvasRef = useRef(null);
    const previewRef = useRef(null);
    useEffect(() => {
        if (!previewSrc || !cards.length || !canvasRef.current || !previewRef.current)
            return;
        const img = previewRef.current;
        const draw = () => drawDetections(canvasRef.current, img, cards);
        if (img.complete && img.naturalWidth > 0)
            draw();
        else
            img.onload = draw;
    }, [previewSrc, cards]);
    useEffect(() => {
        const handler = (e) => {
            if (status === 'processing' || status === 'applying')
                return;
            const items = e.clipboardData && e.clipboardData.items;
            if (!items)
                return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith('image/')) {
                    const blob = items[i].getAsFile();
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
        setErrorMsg('');
        setCards([]);
        setPreviewSrc(dataUrl);
        setStatus('processing');
        try {
            const resp = await fetch('/api/detect_cards', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ frame: dataUrl }),
            });
            const data = await resp.json();
            if (data.error)
                throw new Error(data.error);
            const detected = data.cards || [];
            if (!detected.length)
                throw new Error('No cards found. Try a clearer screenshot.');
            setCards(detected);
            setStatus('confirming');
        }
        catch (err) {
            setErrorMsg(err.message);
            setStatus('error');
        }
    };
    const handleApply = () => {
        if (!cards.length)
            return;
        setStatus('applying');
        let cum = 0;
        cards.forEach((card, i) => {
            const target = applyTarget === 'auto'
                ? (i < 2 ? 'player' : i < 4 ? 'dealer' : 'seen') : applyTarget;
            const delay = timing === 'human' ? cum : i * 50;
            if (timing === 'human')
                cum += humanDelay();
            setTimeout(() => onDealCard(card.rank, card.suit, target), delay);
        });
        setTimeout(() => {
            setStatus('idle');
            setCards([]);
            setPreviewSrc(null);
            showToast(`✓ ${cards.length} card${cards.length !== 1 ? 's' : ''} applied`, 'success');
        }, (timing === 'human' ? cum : cards.length * 50) + 300);
    };
    const handleReset = () => { setStatus('idle'); setCards([]); setPreviewSrc(null); setErrorMsg(''); };
    const changeCard = (i, u) => setCards(cs => cs.map((c, idx) => idx === i ? u : c));
    const removeCard = (i) => setCards(cs => cs.filter((_, idx) => idx !== i));
    const isIdle = status === 'idle' || status === 'error';
    const isProcessing = status === 'processing';
    const isConfirming = status === 'confirming';
    const isApplying = status === 'applying';
    const highConf = cards.filter(c => c.confidence >= CONF_HIGH).length;
    const lowConf = cards.filter(c => c.confidence < CONF_MED).length;
    return (React.createElement("div", null,
        React.createElement("div", { style: {
                fontSize: 9, color: C.jade, marginBottom: 8,
                background: C.jadeD, border: `1px solid ${C.jade}25`,
                borderRadius: 4, padding: '4px 8px',
            } }, "\uD83D\uDD12 Stealth \u2014 OS screenshot tool, zero browser APIs, casino cannot detect"),
        React.createElement("div", { style: { display: 'flex', gap: 6, marginBottom: 10 } },
            React.createElement("div", { style: { flex: 1 } },
                React.createElement("div", { style: { fontSize: 9, color: C.muted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em' } }, "Assign to"),
                React.createElement("select", { "aria-label": "Deal detected cards to", value: applyTarget, onChange: e => setApplyTarget(e.target.value), disabled: isApplying, style: { width: '100%', padding: '5px 6px', fontSize: 11,
                        background: C.base4, color: C.text, borderRadius: 5,
                        border: '1px solid rgba(255,255,255,0.1)' } },
                    React.createElement("option", { value: "auto" }, "Auto (1-2 Player, 3-4 Dealer)"),
                    React.createElement("option", { value: "player" }, "All \u2192 Player"),
                    React.createElement("option", { value: "dealer" }, "All \u2192 Dealer"),
                    React.createElement("option", { value: "seen" }, "All \u2192 Seen"))),
            React.createElement("div", { style: { flex: 1 } },
                React.createElement("div", { style: { fontSize: 9, color: C.muted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em' } }, "Timing"),
                React.createElement("select", { "aria-label": "Card timing interval", value: timing, onChange: e => setTiming(e.target.value), disabled: isApplying, style: { width: '100%', padding: '5px 6px', fontSize: 11,
                        background: C.base4, color: C.text, borderRadius: 5,
                        border: '1px solid rgba(255,255,255,0.1)' } },
                    React.createElement("option", { value: "human" }, "\uD83C\uDFB2 Human delays"),
                    React.createElement("option", { value: "instant" }, "\u26A1 Instant")))),
        isIdle && (React.createElement(PasteZone, null)),
        status === 'error' && errorMsg && (React.createElement("div", { style: { padding: '8px 10px', borderRadius: 5, marginBottom: 8,
                background: C.rubyD, border: '1px solid rgba(255,92,92,0.3)',
                color: C.ruby, fontSize: 11 } },
            "\u26A0 ",
            errorMsg)),
        isProcessing && (React.createElement("div", { style: { textAlign: 'center', padding: '16px 0', color: C.muted, fontSize: 12 } },
            React.createElement("div", { style: { fontSize: 22, marginBottom: 6, display: 'inline-block',
                    animation: 'cv-spin 0.8s linear infinite' } }, "\u27F3"),
            React.createElement("div", null, "Detecting cards\u2026"))),
        isApplying && (React.createElement("div", { style: { textAlign: 'center', padding: '16px 0', color: C.jade, fontSize: 12 } },
            React.createElement("div", { style: { fontSize: 22, marginBottom: 6 } }, "\uD83C\uDCCF"),
            React.createElement("div", null,
                "Applying ",
                cards.length,
                " cards",
                timing === 'human' ? ' with human timing…' : '…'))),
        isConfirming && (React.createElement(React.Fragment, null,
            React.createElement("div", { style: { position: 'relative', marginBottom: 8, borderRadius: 6, overflow: 'hidden' } },
                React.createElement("img", { ref: previewRef, src: previewSrc, alt: "", style: { display: 'none' } }),
                React.createElement("canvas", { ref: canvasRef, style: {
                        width: '100%', borderRadius: 6, display: 'block',
                        border: '1px solid rgba(255,255,255,0.08)'
                    } })),
            React.createElement("div", { style: { display: 'flex', gap: 8, marginBottom: 7, fontSize: 10, color: C.muted } },
                React.createElement("span", { style: { color: C.jade } },
                    "\u2713 ",
                    highConf,
                    " high"),
                lowConf > 0 && React.createElement("span", { style: { color: C.ruby } },
                    "\u26A0 ",
                    lowConf,
                    " check"),
                React.createElement("span", { style: { marginLeft: 'auto' } },
                    cards.length,
                    " card",
                    cards.length !== 1 ? 's' : '')),
            React.createElement("div", { style: { maxHeight: 200, overflowY: 'auto', marginBottom: 8 } }, cards.map((c, i) => (React.createElement(CardRow, { key: i, card: c, index: i, onChange: changeCard, onRemove: removeCard })))),
            React.createElement("div", { style: { display: 'flex', gap: 6, marginBottom: 6 } },
                React.createElement("button", { "aria-label": "Apply detected cards to hand", onClick: handleApply, disabled: !cards.length, style: {
                        flex: 2, padding: '9px 0', fontSize: 12, fontWeight: 700, borderRadius: 7,
                        background: cards.length ? C.jadeD : 'transparent',
                        border: `1px solid ${cards.length ? C.jade + '80' : 'rgba(255,255,255,0.08)'}`,
                        color: cards.length ? C.jade : C.muted,
                        cursor: cards.length ? 'pointer' : 'not-allowed',
                    } },
                    "\u2713 Apply ",
                    cards.length,
                    " Card",
                    cards.length !== 1 ? 's' : ''),
                React.createElement("button", { "aria-label": "Reset detected cards", onClick: handleReset, style: { flex: 1, padding: '9px 0', background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7,
                        color: C.muted, fontSize: 12, cursor: 'pointer' } }, "\u2715 Cancel")),
            React.createElement("p", { style: { fontSize: 10, color: C.muted, textAlign: 'center', margin: 0 } }, "Edit rank/suit if wrong. \u00D7 to remove false detections."))),
        isIdle && (React.createElement("div", { style: { padding: '7px 10px', borderRadius: 5, marginTop: 8,
                background: C.base2, border: '1px solid rgba(255,255,255,0.06)',
                fontSize: 10, color: C.muted, lineHeight: 1.8 } },
            React.createElement("div", { style: { fontWeight: 700, color: C.sec, marginBottom: 2 } }, "Screenshot shortcuts"),
            React.createElement("div", null,
                React.createElement("span", { style: { color: C.gold } }, "Windows:"),
                " Win+Shift+S \u2192 region \u2192 Ctrl+V"),
            React.createElement("div", null,
                React.createElement("span", { style: { color: C.gold } }, "macOS:"),
                " Cmd+Shift+4 \u2192 drag \u2192 Cmd+V"),
            React.createElement("div", null,
                React.createElement("span", { style: { color: C.gold } }, "Linux:"),
                " PrtScn or Flameshot \u2192 Ctrl+V")))));
}
function PasteZone() {
    const [pulse, setPulse] = useState(false);
    useEffect(() => {
        const h = () => { setPulse(true); setTimeout(() => setPulse(false), 700); };
        document.addEventListener('paste', h);
        return () => document.removeEventListener('paste', h);
    }, []);
    return (React.createElement("div", { style: {
            border: `2px dashed ${pulse ? C.jade : 'rgba(106,175,255,0.3)'}`,
            borderRadius: 8, padding: '18px 12px', textAlign: 'center',
            background: pulse ? C.jadeD : 'transparent',
            transition: 'all 0.15s', marginBottom: 8,
        } },
        React.createElement("div", { style: { fontSize: 22, marginBottom: 4 } }, pulse ? '✅' : '📋'),
        React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: pulse ? C.jade : C.sapph, marginBottom: 4 } }, pulse ? 'Screenshot received!' : 'Ctrl+V  /  Cmd+V to paste'),
        React.createElement("div", { style: { fontSize: 10, color: C.muted } }, "Take OS screenshot first, then paste here")));
}
function FpsSelector({ value, onChange }) {
    const opts = [{ fps: 0, label: 'Off' }, { fps: 2, label: '2fps' }, { fps: 5, label: '5fps' }, { fps: 10, label: '10fps' }];
    return (React.createElement("div", { style: {
            display: 'inline-flex', borderRadius: 6, overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.12)', flexShrink: 0,
        } }, opts.map(({ fps, label }, i) => {
        const active = value === fps;
        return (React.createElement("button", { key: fps, "aria-label": `Set scan rate to ${fps} FPS`, "aria-pressed": value === fps, onClick: () => onChange(fps), style: {
                padding: '4px 10px', fontSize: 10, fontWeight: active ? 700 : 400,
                cursor: 'pointer', whiteSpace: 'nowrap',
                borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                background: active ? C.sapph : 'transparent',
                color: active ? '#0a0e18' : C.muted,
                transition: 'all 0.12s',
            } }, label));
    })));
}
function BigAction({ action }) {
    if (!action)
        return (React.createElement("div", { style: { textAlign: 'center', padding: '10px 0', color: C.muted, fontSize: 13 } }, "Waiting for cards\u2026"));
    const col = ACTION_COLORS[action] || C.text;
    return (React.createElement("div", { style: {
            textAlign: 'center', padding: '12px 0',
            fontSize: '2.2rem', fontWeight: 800, letterSpacing: '0.04em',
            color: col, fontFamily: 'Syne, sans-serif',
            textShadow: `0 0 20px ${col}50`,
        } }, action));
}
function CountBar({ tc, rc, adv, decksLeft }) {
    const col = countColor(tc);
    return (React.createElement("div", { style: {
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: 4, padding: '8px 0',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 8,
        } }, [
        ['True', tc >= 0 ? `+${tc}` : String(tc), col],
        ['RC', rc >= 0 ? `+${rc}` : String(rc), countColor(rc / 2)],
        ['Edge', `${adv >= 0 ? '+' : ''}${adv}%`, adv >= 0 ? C.jade : C.ruby],
        ['Decks', decksLeft, C.muted],
    ].map(([label, val, color]) => (React.createElement("div", { key: label, style: { textAlign: 'center' } },
        React.createElement("div", { style: { fontSize: 9, color: C.muted, textTransform: 'uppercase',
                letterSpacing: '0.07em', marginBottom: 2 } }, label),
        React.createElement("div", { style: { fontSize: 16, fontWeight: 700, color, fontFamily: 'DM Mono, monospace' } }, val))))));
}
function BetBadge({ bet, betAction }) {
    if (!bet)
        return null;
    const isMax = betAction && betAction.includes('MAXIMUM');
    const isMin = betAction && betAction.includes('MINIMUM');
    const col = isMax ? C.jade : isMin ? C.muted : C.gold;
    return (React.createElement("div", { style: {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 10px', borderRadius: 6,
            background: `${col}12`, border: `1px solid ${col}40`, marginBottom: 8,
        } },
        React.createElement("span", { style: { fontSize: 10, color: C.muted } }, "Recommended Bet"),
        React.createElement("span", { style: { fontSize: 18, fontWeight: 800, color: col,
                fontFamily: 'DM Mono, monospace' } },
            "$",
            bet)));
}
function StatusDot({ running, stable, cardsDetected }) {
    const color = !running ? C.muted
        : cardsDetected > 0 ? C.jade
            : stable ? C.gold : C.sapph;
    const label = !running ? 'Off'
        : cardsDetected > 0 ? `${cardsDetected} card${cardsDetected !== 1 ? 's' : ''} seen`
            : stable ? 'Watching…' : 'Scanning…';
    return (React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 5 } },
        React.createElement("div", { style: {
                width: 7, height: 7, borderRadius: '50%', background: color,
                boxShadow: running ? `0 0 6px ${color}` : 'none',
                animation: running && !stable ? 'live-pulse 1.5s ease-in-out infinite' : 'none',
            } }),
        React.createElement("span", { style: { fontSize: 10, color } }, label)));
}
function SetupGuide({ available }) {
    const [open, setOpen] = useState(false);
    if (available)
        return null;
    return (React.createElement("div", { style: { marginBottom: 10 } },
        React.createElement("div", { style: {
                padding: '8px 10px', borderRadius: 6,
                background: C.goldD, border: `1px solid ${C.gold}40`,
                fontSize: 10, color: C.gold,
            } },
            "\u26A0 Screen capture not installed.",
            React.createElement("button", { "aria-label": open ? 'Collapse live overlay panel' : 'Expand live overlay panel', "aria-expanded": open, onClick: () => setOpen(o => !o), style: { marginLeft: 6, background: 'transparent', border: 'none',
                    color: C.gold, cursor: 'pointer', fontSize: 10, textDecoration: 'underline' } }, open ? 'hide' : 'setup')),
        open && (React.createElement("div", { style: {
                padding: '10px', fontSize: 10, background: C.base2,
                border: `1px solid rgba(255,255,255,0.06)`,
                borderTop: 'none', borderRadius: '0 0 6px 6px',
                lineHeight: 1.8, color: C.sec,
            } },
            React.createElement("div", { style: { fontWeight: 700, marginBottom: 4, color: C.text } }, "Install (OS-level, undetectable):"),
            React.createElement("div", null,
                React.createElement("span", { style: { color: C.jade } }, "Fastest:"),
                " ",
                React.createElement("code", { style: { background: C.base3, padding: '1px 4px', borderRadius: 3 } }, "pip install mss")),
            React.createElement("div", { style: { marginTop: 4, color: C.muted } },
                "Then restart: ",
                React.createElement("code", { style: { background: C.base3, padding: '1px 4px', borderRadius: 3 } }, "python main.py web"))))));
}
function WindowPicker({ socket, onWindowSelect = null }) {
    const { useState, useEffect } = React;
    const [open, setOpen] = useState(false);
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
        if (!open)
            fetchWindows();
    };
    const handlePick = (win) => {
        setSelected(win);
        setOpen(false);
        const payload = { x: win.x, y: win.y, w: win.w, h: win.h, title: win.title };
        if (socket && socket.connected) {
            socket.emit('live_set_window', payload);
        }
        else {
            fetch('/api/live/set_window', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }).catch(() => { });
        }
        if (onWindowSelect)
            onWindowSelect(win);
    };
    const handleClear = (e) => {
        e.stopPropagation();
        setSelected(null);
        if (socket && socket.connected) {
            socket.emit('live_set_window', { x: 0, y: 0, w: 0, h: 0, title: 'Full Screen' });
        }
        else {
            fetch('/api/live/set_window', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x: 0, y: 0, w: 0, h: 0 }),
            }).catch(() => { });
        }
    };
    const isBrowser = (title) => {
        const t = title.toLowerCase();
        return ['chrome', 'firefox', 'edge', 'opera', 'brave', 'safari',
            'stake', 'casino', 'blackjack', '21', 'bet'].some(k => t.includes(k));
    };
    return (React.createElement("div", { style: { position: 'relative', marginBottom: 8 } },
        React.createElement("button", { onClick: handleOpen, "aria-label": selected ? `Selected: ${selected.title || 'window'} — click to change` : 'Select window to scan', "aria-haspopup": "listbox", style: {
                width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
                background: selected ? C.sapphD : 'rgba(255,255,255,0.04)',
                border: `1px solid ${selected ? C.sapph + '60' : 'rgba(255,255,255,0.10)'}`,
                color: selected ? C.sapph : C.muted,
                textAlign: 'left',
            } },
            React.createElement("span", { style: { fontSize: 13 } }, "\uD83D\uDDA5"),
            React.createElement("span", { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, selected ? selected.title : 'Full screen (click to pick a window)'),
            selected && (React.createElement("span", { onClick: handleClear, style: { fontSize: 14, color: C.muted, padding: '0 2px', lineHeight: 1, cursor: 'pointer' }, title: "Clear \u2014 scan full screen" }, "\u00D7")),
            React.createElement("span", { style: { fontSize: 9, color: C.muted } }, open ? '▲' : '▼')),
        open && (React.createElement("div", { style: {
                position: 'absolute', zIndex: 999, top: 'calc(100% + 4px)', left: 0, right: 0,
                background: C.base2, border: `1px solid ${C.sapph}40`,
                borderRadius: 8, overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                maxHeight: 260, overflowY: 'auto',
            } },
            loading && (React.createElement("div", { style: { padding: '12px', textAlign: 'center', color: C.muted, fontSize: 11 } }, "Scanning open windows\u2026")),
            !loading && windows.length === 0 && (React.createElement("div", { style: { padding: '10px 12px', fontSize: 10, lineHeight: 1.7 } },
                React.createElement("div", { style: { fontWeight: 700, color: C.ruby, marginBottom: 6 } }, "\u26A0 No windows detected"),
                React.createElement("div", { style: { color: C.sec, marginBottom: 4 } }, "Restart the server, then click the dropdown again."),
                React.createElement("div", { style: { color: C.muted, marginBottom: 8, fontSize: 9 } }, "If this keeps happening, launch Chrome with remote debugging to list tabs individually:"),
                React.createElement("code", { style: { display: 'block', padding: '5px 8px', marginBottom: 10,
                        background: C.base3, borderRadius: 4, color: C.jade, fontSize: 9 } }, "chrome.exe --remote-debugging-port=9222"),
                React.createElement("div", { style: { fontSize: 9, color: C.muted, marginBottom: 4, fontWeight: 700 } }, "Or set scan region manually:"))),
            !loading && (React.createElement("button", { onClick: () => handlePick({ title: 'Full Screen', x: 0, y: 0, w: 0, h: 0 }), "aria-label": "Use full screen as scan region", style: {
                    width: '100%', padding: '8px 12px', fontSize: 11, textAlign: 'left',
                    background: !selected ? 'rgba(106,175,255,0.08)' : 'transparent',
                    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)',
                    color: !selected ? C.sapph : C.sec, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', gap: 8,
                } },
                React.createElement("span", null, "\uD83D\uDDA5"),
                React.createElement("span", null, "Full Screen"),
                !selected && React.createElement("span", { style: { marginLeft: 'auto', fontSize: 9, color: C.sapph } }, "\u2713 active"))),
            !loading && (() => {
                const tabs = windows.filter(w => w.is_tab);
                const wins = windows.filter(w => !w.is_tab);
                const renderItem = (win, i, arr) => {
                    const browser = isBrowser(win.title);
                    const isActive = selected && selected.id === win.id;
                    return (React.createElement("button", { key: win.id || i, "aria-label": `Select window: ${win.title || win.name || 'window'}`, onClick: () => handlePick(win), style: {
                            width: '100%', padding: '7px 12px', fontSize: 10, textAlign: 'left',
                            background: isActive ? 'rgba(106,175,255,0.10)' : 'transparent',
                            border: 'none',
                            borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                            color: isActive ? C.sapph : browser ? C.text : C.sec,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                        } },
                        React.createElement("span", { style: { flexShrink: 0 } }, win.is_tab ? '🌐' : browser ? '🖥' : '🪟'),
                        React.createElement("div", { style: { flex: 1, overflow: 'hidden', minWidth: 0 } },
                            React.createElement("div", { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, win.title.replace('[TAB] ', '')),
                            win.url && (React.createElement("div", { style: { fontSize: 8, color: C.muted, overflow: 'hidden',
                                    textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, win.url.replace('https://', '').replace('http://', '').slice(0, 50)))),
                        React.createElement("span", { style: { fontSize: 9, color: C.muted, flexShrink: 0 } }, win.w > 0 ? `${win.w}×${win.h}` : ''),
                        isActive && React.createElement("span", { style: { fontSize: 9, color: C.sapph } }, "\u2713")));
                };
                return (React.createElement(React.Fragment, null,
                    tabs.length > 0 && (React.createElement(React.Fragment, null,
                        React.createElement("div", { style: { padding: '4px 12px', fontSize: 8, fontWeight: 700,
                                color: C.sapph, textTransform: 'uppercase', letterSpacing: '0.08em',
                                background: 'rgba(106,175,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.05)' } }, "\uD83C\uDF10 Browser Tabs"),
                        tabs.map((w, i) => renderItem(w, i, tabs)))),
                    wins.length > 0 && (React.createElement(React.Fragment, null,
                        React.createElement("div", { style: { padding: '4px 12px', fontSize: 8, fontWeight: 700,
                                color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em',
                                background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)',
                                borderTop: tabs.length > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none' } }, "\uD83E\uDE9F OS Windows"),
                        wins.map((w, i) => renderItem(w, i, wins)))),
                    tabs.length === 0 && wins.length > 0 && (React.createElement("div", { style: { padding: '6px 12px 4px', fontSize: 9, color: C.muted,
                            borderBottom: '1px solid rgba(255,255,255,0.05)' } },
                        "\uD83D\uDCA1 Launch Chrome with ",
                        React.createElement("code", { style: { color: C.gold } }, "--remote-debugging-port=9222"),
                        " to see individual tabs"))));
            })()))));
}
function LiveMode({ socket, count }) {
    const [running, setRunning] = useState(false);
    const [fps, setFps] = useState(5);
    const [liveData, setLiveData] = useState(null);
    const [statusMsg, setStatusMsg] = useState('');
    const [available, setAvailable] = useState(true);
    const [showRegion, setShowRegion] = useState(true);
    const [region, setRegion] = useState({ x: '', y: '', w: '', h: '' });
    const syncStatus = () => {
        fetch('/api/live/status').then(r => r.json()).then(d => {
            setRunning(!!d.running);
            setAvailable(d.available !== false);
            if (d.fps)
                setFps(d.fps);
        }).catch(() => { });
    };
    useEffect(() => {
        if (!socket)
            return;
        const onStatus = (data) => {
            setRunning(!!data.running);
            if (data.available !== undefined)
                setAvailable(!!data.available);
            if (data.message)
                setStatusMsg(data.message);
            if (data.fps)
                setFps(data.fps);
        };
        socket.on('live_status', onStatus);
        socket.on('live_update', setLiveData);
        const onReconnect = () => {
            syncStatus();
            setStatusMsg('Reconnected');
        };
        socket.on('reconnect', onReconnect);
        socket.on('connect', onReconnect);
        const onVisibility = () => {
            if (!document.hidden)
                syncStatus();
        };
        document.addEventListener('visibilitychange', onVisibility);
        syncStatus();
        return () => {
            socket.off('live_status', onStatus);
            socket.off('live_update', setLiveData);
            socket.off('reconnect', onReconnect);
            socket.off('connect', onReconnect);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [socket]);
    const start = () => {
        const reg = (showRegion && region.w && region.h)
            ? [parseInt(region.x) || 0, parseInt(region.y) || 0, parseInt(region.w), parseInt(region.h)]
            : null;
        const payload = { fps, region: reg };
        if (socket && socket.connected) {
            socket.emit('live_start', payload);
        }
        else {
            fetch('/api/live/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
                .then(r => r.json())
                .then(d => {
                setRunning(true);
                setStatusMsg(d.message || 'Live scanner started');
                if (d.available === false)
                    setAvailable(false);
            })
                .catch(() => setStatusMsg('Failed to start — is the server running?'));
        }
    };
    const stop = () => {
        if (socket && socket.connected) {
            socket.emit('live_stop');
        }
        else {
            fetch('/api/live/stop', { method: 'POST' })
                .then(() => { setRunning(false); setStatusMsg('Stopped'); })
                .catch(() => { });
        }
    };
    const changeFps = (f) => {
        if (f === 0) {
            stop();
            setFps(0);
            return;
        }
        setFps(f);
        if (running) {
            if (socket && socket.connected)
                socket.emit('live_set_fps', { fps: f });
            else
                fetch('/api/live/set_fps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fps: f }) }).catch(() => { });
        }
    };
    const newHand = () => {
        if (socket && socket.connected)
            socket.emit('live_new_hand');
        else
            fetch('/api/live/new_hand', { method: 'POST' }).catch(() => { });
    };
    const d = liveData;
    const tc = d ? d.true_count : (count ? count.true : 0);
    const rc = d ? d.running : (count ? count.running : 0);
    const adv = d ? d.advantage : (count ? count.advantage : 0);
    const dk = d ? d.decks_remaining : (count ? count.decks_remaining : '—');
    const rec = d ? d.recommendation : null;
    const bet = d ? d.bet : 0;
    const ba = d ? d.bet_action : '';
    return (React.createElement("div", null,
        React.createElement(WindowPicker, { socket: socket }),
        React.createElement("div", { style: {
                fontSize: 9, color: C.jade, marginBottom: 8,
                background: C.jadeD, border: `1px solid ${C.jade}25`,
                borderRadius: 4, padding: '4px 8px',
            } }, "\uD83D\uDD12 Stealth \u2014 server-side OS capture, casino JS cannot detect"),
        React.createElement(SetupGuide, { available: available }),
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 } },
            React.createElement(StatusDot, { running: running, stable: d === null || d === void 0 ? void 0 : d.stable, cardsDetected: (d === null || d === void 0 ? void 0 : d.cards_detected) || 0 }),
            React.createElement("div", { style: { flex: 1 } }),
            React.createElement(FpsSelector, { value: fps, onChange: changeFps })),
        React.createElement("div", { style: { marginBottom: 8 } },
            React.createElement("button", { "aria-label": showRegion ? 'Hide scan region settings' : 'Show scan region settings', "aria-expanded": !!showRegion, onClick: () => setShowRegion(r => !r), style: { width: '100%', padding: '4px', fontSize: 10, borderRadius: 4,
                    background: showRegion ? C.base3 : 'transparent',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: C.muted, cursor: 'pointer', textAlign: 'left' } },
                showRegion ? '▲' : '▼',
                " Restrict scan region (optional)"),
            showRegion && (React.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4,
                    padding: '6px', background: C.base2, borderRadius: '0 0 4px 4px',
                    border: '1px solid rgba(255,255,255,0.06)', borderTop: 'none' } },
                ['x', 'y', 'w', 'h'].map(k => (React.createElement("div", { key: k },
                    React.createElement("div", { style: { fontSize: 9, color: C.muted, marginBottom: 2 } }, k.toUpperCase()),
                    React.createElement("input", { type: "number", "aria-label": `Scan region ${k}`, value: region[k], onChange: e => setRegion(r => ({ ...r, [k]: e.target.value })), placeholder: k === 'w' ? '1920' : k === 'h' ? '1080' : '0', style: { width: '100%', padding: '3px 4px', fontSize: 11,
                            background: C.base4, color: C.text, borderRadius: 4,
                            border: '1px solid rgba(255,255,255,0.1)' } })))),
                React.createElement("div", { style: { gridColumn: '1/-1', fontSize: 9, color: C.muted } }, "Leave blank for full screen.")))),
        !running ? (React.createElement("button", { "aria-label": "Start live card scanning", onClick: start, style: { width: '100%', padding: '10px', fontSize: 13, fontWeight: 700,
                background: C.jadeD, border: `1px solid ${C.jade}70`,
                borderRadius: 7, color: C.jade, cursor: 'pointer',
                letterSpacing: '0.04em', marginBottom: 8 } }, "\u25B6 Start Live Scan")) : (React.createElement("button", { "aria-label": "Stop live card scanning", onClick: stop, style: { width: '100%', padding: '10px', fontSize: 13, fontWeight: 700,
                background: C.rubyD, border: `1px solid ${C.ruby}70`,
                borderRadius: 7, color: C.ruby, cursor: 'pointer',
                letterSpacing: '0.04em', marginBottom: 8 } }, "\u25A0 Stop Scanning")),
        statusMsg && (React.createElement("div", { style: { fontSize: 10, color: C.muted, textAlign: 'center', marginBottom: 8 } }, statusMsg)),
        (running || d) && (React.createElement(React.Fragment, null,
            React.createElement(CountBar, { tc: tc, rc: rc, adv: adv, decksLeft: dk }),
            React.createElement(BetBadge, { bet: bet, betAction: ba }),
            (rec === null || rec === void 0 ? void 0 : rec.is_deviation) && (React.createElement("div", { style: { textAlign: 'center', marginBottom: 6, fontSize: 9, fontWeight: 700,
                    color: C.ameth, background: C.amethD,
                    border: `1px solid ${C.ameth}50`, borderRadius: 4, padding: '3px 0' } },
                "DEVIATION \u2014 overrides basic (",
                rec.basic_action,
                ")")),
            React.createElement(BigAction, { action: rec === null || rec === void 0 ? void 0 : rec.action }),
            (d === null || d === void 0 ? void 0 : d.hand_value) > 0 && (React.createElement("div", { style: { display: 'flex', justifyContent: 'center', gap: 12,
                    marginTop: 6, fontSize: 10, color: C.muted } },
                React.createElement("span", null,
                    "Hand: ",
                    React.createElement("b", { style: { color: C.sec } }, d.hand_value),
                    d.is_soft && React.createElement("span", { style: { color: C.gold } }, " soft")),
                React.createElement("span", null,
                    "Cards: ",
                    React.createElement("b", { style: { color: C.sec } }, d.cards_this_hand)))))),
        !running && !d && (React.createElement("div", { style: { padding: '8px 10px', borderRadius: 5, fontSize: 10,
                background: C.base2, border: '1px solid rgba(255,255,255,0.05)',
                color: C.muted, lineHeight: 1.7 } },
            React.createElement("div", { style: { fontWeight: 700, color: C.sec, marginBottom: 3 } }, "How it works"),
            React.createElement("div", null, "1. Open casino in another browser tab"),
            React.createElement("div", null, "2. Arrange so cards are visible, or go fullscreen"),
            React.createElement("div", null,
                "3. Click ",
                React.createElement("b", null, "Start Live Scan")),
            React.createElement("div", null, "4. Count + best move appear here automatically"),
            React.createElement("div", { style: { marginTop: 4, color: C.jade } }, "\u2713 Casino tab sees nothing")))));
}
function LiveOverlayPanel({ socket, count, scanMode, onSetMode, onDealCard, dealTarget }) {
    const accentColor = scanMode === 'live' ? C.jade
        : scanMode === 'screenshot' ? C.sapph : C.muted;
    return (React.createElement(Widget, { title: "Card Scanner", accent: accentColor },
        React.createElement(ModeToggle, { scanMode: scanMode, onSetMode: onSetMode }),
        scanMode === 'manual' && React.createElement(ManualHint, null),
        scanMode === 'screenshot' && (React.createElement(ScreenshotMode, { onDealCard: onDealCard, dealTarget: dealTarget })),
        scanMode === 'live' && (React.createElement(LiveMode, { socket: socket, count: count })),
        React.createElement("style", null, `
        @keyframes live-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.3)}}
        @keyframes cv-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
      `)));
}
