const COUNTING_SYSTEMS = {
    hi_lo: { label: 'Hi-Lo', level: '★☆☆', desc: 'Most popular. Tags: low cards +1, high cards −1. Best for beginners.' },
    ko: { label: 'KO', level: '★☆☆', desc: 'Knock-Out. Unbalanced — no true count needed. Simpler to use live.' },
    omega_ii: { label: 'Omega II', level: '★★★', desc: 'Level 2. More accurate than Hi-Lo, harder to maintain under pressure.' },
    zen: { label: 'Zen Count', level: '★★☆', desc: 'Level 2 balanced. Good accuracy vs difficulty trade-off.' },
};
const SHUFFLE_TYPES = {
    machine: { label: 'Machine', retention: '2%', desc: 'Fully automated shuffle — near-random. Almost no card memory survives.' },
    riffle: { label: 'Riffle', retention: '40%', desc: 'Standard hand riffle. Imperfect — cards clump. 40% of count info survives.' },
    strip: { label: 'Strip', retention: '25%', desc: 'Strips of cards pulled from top. Moderate randomisation.' },
    box: { label: 'Box', retention: '15%', desc: 'Deck split into boxes, reassembled randomly. Less info survives.' },
    wash: { label: 'Wash', retention: '5%', desc: 'Cards spread and scrambled face-down. Very thorough — little memory.' },
};
function InfoTooltip({ children }) {
    const { useState, useRef, useEffect } = React;
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const btnRef = useRef(null);
    const TOOLTIP_W = 250;
    const PADDING = 10;
    const open = () => {
        if (btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            const vw = window.innerWidth;
            let left = r.left + r.width / 2 - TOOLTIP_W / 2;
            if (left + TOOLTIP_W > vw - PADDING)
                left = vw - TOOLTIP_W - PADDING;
            if (left < PADDING)
                left = PADDING;
            setPos({
                top: r.bottom + 6,
                left: left,
            });
        }
        setVisible(true);
    };
    useEffect(() => {
        if (!visible)
            return;
        const handler = (e) => {
            if (btnRef.current && !btnRef.current.contains(e.target))
                setVisible(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [visible]);
    return (React.createElement("div", { style: { position: 'relative', display: 'inline-block' } },
        React.createElement("span", { ref: btnRef, onClick: () => visible ? setVisible(false) : open(), onMouseEnter: open, onMouseLeave: () => setVisible(false), style: {
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 16, height: 16, borderRadius: '50%',
                background: visible ? 'rgba(255,212,71,0.25)' : 'rgba(255,255,255,0.1)',
                border: `1px solid ${visible ? 'rgba(255,212,71,0.6)' : 'rgba(255,255,255,0.2)'}`,
                color: visible ? '#ffd447' : '#b8ccdf',
                fontSize: 9, fontWeight: 'bold',
                cursor: 'pointer', userSelect: 'none',
                transition: 'all 0.15s',
            } }, "?"),
        visible && (React.createElement("div", { onMouseEnter: open, onMouseLeave: () => setVisible(false), style: {
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                background: '#1a2236',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 8,
                padding: '10px 12px',
                width: 250,
                zIndex: 99999,
                boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                pointerEvents: 'auto',
            } }, children))));
}
function TopBar({ count, onNewHand, onShuffle, onChangeSystem }) {
    const [activeSystem, setActiveSystem] = useState('hi_lo');
    const [activeShuffle, setActiveShuffle] = useState('machine');
    const tc = count ? count.true : 0;
    const rc = count ? count.running : 0;
    const adv = count ? count.advantage : -0.5;
    const etc = count ? count.enhanced_true : 0;
    const sysMeta = COUNTING_SYSTEMS[activeSystem] || COUNTING_SYSTEMS.hi_lo;
    const shufMeta = SHUFFLE_TYPES[activeShuffle] || SHUFFLE_TYPES.machine;
    const handleSystemChange = (e) => {
        setActiveSystem(e.target.value);
        onChangeSystem(e.target.value);
    };
    const handleShuffleTypeChange = (e) => {
        setActiveShuffle(e.target.value);
        document.getElementById('shuffle-type').value = e.target.value;
    };
    return (React.createElement("header", { className: "sticky top-0 z-50 flex items-center justify-between gap-4 px-5 py-3", style: {
            background: '#1a2236',
            borderBottom: '1.5px solid rgba(255,255,255,0.14)',
            backdropFilter: 'blur(16px)',
        } },
        React.createElement("div", { className: "flex items-center gap-3 flex-shrink-0" },
            React.createElement("span", { className: "text-3xl font-display", style: { color: '#ffd447', filter: 'drop-shadow(0 0 14px rgba(255,212,71,0.55))' } }, "\u2660"),
            React.createElement("div", null,
                React.createElement("div", { className: "font-display font-extrabold text-sm tracking-tight", style: { color: '#f0f4ff' } }, "BlackjackML"),
                React.createElement("div", { className: "text-[10px] uppercase tracking-widest", style: { color: '#b8ccdf' } }, "Live Counter & AI Advisor"))),
        React.createElement("div", { className: "flex items-center gap-5 rounded-xl px-6 py-2.5 flex-1 justify-center max-w-xl", style: { background: '#111827', border: '1.5px solid rgba(255,255,255,0.14)' } },
            React.createElement(CountBlock, { label: "Running", title: "Running Count: raw sum of all card tags seen (+1 low, -1 high)", value: rc, colorVal: rc, mono: true }),
            React.createElement("div", { style: { width: 1, height: 32, background: 'rgba(255,255,255,0.15)' } }),
            React.createElement(CountBlock, { label: "True Count", title: "True Count: Running Count \u00F7 Decks Remaining. Use this for strategy decisions.", value: tc.toFixed(1), colorVal: tc, large: true, mono: true }),
            React.createElement("div", { style: { width: 1, height: 32, background: 'rgba(255,255,255,0.15)' } }),
            React.createElement(CountBlock, { label: "ML Enhanced", title: "ML-enhanced true count: adjusts for shuffle patterns tracked by LSTM model", value: etc.toFixed(1), colorVal: etc, mono: true }),
            React.createElement("div", { style: { width: 1, height: 32, background: 'rgba(255,255,255,0.15)' } }),
            React.createElement(CountBlock, { label: "Advantage", value: `${adv >= 0 ? '+' : ''}${adv.toFixed(2)}%`, colorVal: adv, mono: true })),
        React.createElement("div", { className: "flex items-center gap-3 flex-shrink-0" },
            React.createElement("div", { className: "flex flex-col gap-0.5" },
                React.createElement("div", { className: "flex items-center gap-1 mb-0.5" },
                    React.createElement("span", { className: "text-[9px] uppercase tracking-widest font-semibold", style: { color: '#b8ccdf' } }, "Counting System"),
                    React.createElement(InfoTooltip, null,
                        React.createElement("div", { className: "text-[10px] font-bold mb-1", style: { color: '#ffd447' } }, "What is a counting system?"),
                        React.createElement("div", { className: "text-[10px] leading-relaxed", style: { color: '#ccdaec' } }, "Card counting assigns a tag to each card you see. You keep a running total \u2014 when it's high, the shoe favours you and you bet more."),
                        React.createElement("div", { className: "mt-2 space-y-1" }, Object.entries(COUNTING_SYSTEMS).map(([k, v]) => (React.createElement("div", { key: k, className: "text-[9px]", style: { color: '#b8ccdf' } },
                            React.createElement("span", { style: { color: '#ccdaec', fontWeight: 600 } }, v.label),
                            " ",
                            v.level,
                            " \u2014 ",
                            v.desc.split('.')[0],
                            ".")))))),
                React.createElement("div", { className: "flex items-center gap-1.5" },
                    React.createElement("select", { value: activeSystem, onChange: handleSystemChange, "aria-label": "Card counting system", className: "topbar-select" }, Object.entries(COUNTING_SYSTEMS).map(([k, v]) => (React.createElement("option", { key: k, value: k }, v.label))))),
                React.createElement("div", { className: "text-[9px] leading-tight mt-0.5", style: { color: '#9ab0c8', maxWidth: 150 } },
                    sysMeta.level,
                    " \u00B7 ",
                    sysMeta.desc.split('.')[0])),
            React.createElement("button", { onClick: onNewHand, "aria-label": "Start a new hand (count continues)", className: "topbar-btn", style: { alignSelf: 'center' } }, "\u2B06 New Hand"),
            React.createElement("div", { className: "flex flex-col gap-0.5" },
                React.createElement("div", { className: "flex items-center gap-1 mb-0.5" },
                    React.createElement("span", { className: "text-[9px] uppercase tracking-widest font-semibold", style: { color: '#b8ccdf' } }, "Shuffle Type"),
                    React.createElement(InfoTooltip, null,
                        React.createElement("div", { className: "text-[10px] font-bold mb-1", style: { color: '#ffd447' } }, "Why does shuffle type matter?"),
                        React.createElement("div", { className: "text-[10px] leading-relaxed mb-2", style: { color: '#ccdaec' } }, "The ML Shuffle Tracker remembers card patterns across shuffles. Different shuffle types destroy different amounts of that memory."),
                        React.createElement("div", { className: "space-y-1" }, Object.entries(SHUFFLE_TYPES).map(([k, v]) => (React.createElement("div", { key: k, className: "flex justify-between text-[9px] gap-2" },
                            React.createElement("span", { style: { color: '#ccdaec', fontWeight: 600 } }, v.label),
                            React.createElement("span", { style: { color: '#44e882' } },
                                v.retention,
                                " memory"))))),
                        React.createElement("div", { className: "mt-2 text-[9px]", style: { color: '#9ab0c8' } }, "Select the type matching what you observe at the table, then click Shuffle."))),
                React.createElement("div", { className: "flex items-center gap-1" },
                    React.createElement("button", { onClick: onShuffle, "aria-label": "Trigger casino shuffle and reset count", className: "topbar-btn danger", style: { whiteSpace: 'nowrap' } }, "\u21C4 Shuffle"),
                    React.createElement("select", { id: "shuffle-type", style: { display: 'none' }, defaultValue: "machine" }),
                    React.createElement("select", { value: activeShuffle, onChange: handleShuffleTypeChange, "aria-label": "Select shuffle type", className: "topbar-select" }, Object.entries(SHUFFLE_TYPES).map(([k, v]) => (React.createElement("option", { key: k, value: k }, v.label))))),
                React.createElement("div", { className: "text-[9px] leading-tight mt-0.5", style: { color: '#9ab0c8', maxWidth: 150 } },
                    shufMeta.retention,
                    " card memory \u00B7 ",
                    shufMeta.desc.split('.')[0])))));
}
function CountBlock({ label, value, colorVal, large, mono, title }) {
    const cls = countClass(colorVal);
    return (React.createElement("div", { className: "text-center" },
        React.createElement("div", { className: "text-[9px] uppercase tracking-widest font-semibold mb-1", style: { color: '#b8ccdf' } }, label),
        React.createElement("div", { className: `${large ? 'text-2xl' : 'text-lg'} font-bold leading-none ${mono ? 'font-mono' : ''} ${cls}` }, value)));
}
