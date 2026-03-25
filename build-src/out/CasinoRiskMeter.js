function CasinoRiskMeter({ casinoRisk }) {
    const { useState } = React;
    const [expanded, setExpanded] = useState(false);
    if (!casinoRisk)
        return null;
    const { level = 0, label = 'LOW', color = '#44e882', score = 0, spread = 1, hands = 0, signals = [], advice = '' } = casinoRisk || {};
    const maxScore = 10;
    const fillPct = Math.min(100, (score / maxScore) * 100);
    const LEVELS = [
        { min: 0, label: 'LOW', color: '#44e882' },
        { min: 25, label: 'WARM', color: '#ffd447' },
        { min: 50, label: 'HOT', color: '#ff9944' },
        { min: 75, label: 'CRITICAL', color: '#ff5c5c' },
    ];
    const barGradient = 'linear-gradient(90deg, #44e882 0%, #ffd447 33%, #ff9944 66%, #ff5c5c 100%)';
    return (React.createElement(Widget, { title: "Casino Risk Meter", badge: label, badgeColor: level === 0 ? 'text-jade' : level === 1 ? 'text-gold' : level >= 2 ? 'text-ruby' : 'text-jade' },
        React.createElement("div", { style: { marginBottom: 10 } },
            React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 } },
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                    React.createElement("div", { style: {
                            width: 10, height: 10, borderRadius: '50%',
                            background: color,
                            boxShadow: level >= 2 ? `0 0 8px ${color}` : 'none',
                            animation: level >= 3 ? 'live-pulse 1s ease-in-out infinite' : 'none',
                        } }),
                    React.createElement("span", { style: { fontSize: 16, fontWeight: 900, color, fontFamily: 'DM Mono,monospace' } }, label)),
                React.createElement("div", { style: { fontSize: 10, color: '#94a7c4' } },
                    "Score: ",
                    React.createElement("span", { style: { color, fontFamily: 'DM Mono,monospace', fontWeight: 700 } }, score),
                    "/10")),
            React.createElement("div", { style: { position: 'relative', height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' } },
                React.createElement("div", { style: { position: 'absolute', inset: 0, borderRadius: 5, background: barGradient, opacity: 0.3 } }),
                React.createElement("div", { style: {
                        height: '100%', borderRadius: 5,
                        width: `${fillPct}%`,
                        background: barGradient,
                        transition: 'width 0.5s ease',
                    } })),
            React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', marginTop: 3 } }, LEVELS.map(l => (React.createElement("span", { key: l.label, style: { fontSize: 7, color: l.color, fontWeight: 700 } }, l.label))))),
        React.createElement("div", { style: {
                padding: '8px 10px', borderRadius: 7, marginBottom: 10,
                background: `${color}12`, border: `1px solid ${color}35`,
                fontSize: 10, color: '#f0f4ff', lineHeight: 1.5,
            } }, advice),
        React.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 } }, [
            { label: 'Bet Spread', value: `${spread}:1`, warn: spread >= 5 },
            { label: 'Hands Played', value: hands, warn: hands >= 100 },
        ].map(({ label: l, value: v, warn: w }) => (React.createElement("div", { key: l, style: {
                padding: '5px 8px', borderRadius: 6, textAlign: 'center',
                background: w ? 'rgba(255,212,71,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${w ? 'rgba(255,212,71,0.25)' : 'rgba(255,255,255,0.07)'}`,
            } },
            React.createElement("div", { style: { fontSize: 8, color: '#94a7c4', textTransform: 'uppercase', marginBottom: 2 } }, l),
            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, fontFamily: 'DM Mono,monospace', color: w ? '#ffd447' : '#f0f4ff' } }, v))))),
        signals && signals.length > 0 && (React.createElement("div", null,
            React.createElement("button", { onClick: () => setExpanded(e => !e), "aria-expanded": expanded, "aria-label": expanded ? 'Collapse casino risk details' : 'Expand casino risk details', style: {
                    width: '100%', padding: '4px 8px', fontSize: 9, borderRadius: 5,
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#94a7c4', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', justifyContent: 'space-between',
                } },
                React.createElement("span", null,
                    "\u26A0 ",
                    signals.length,
                    " signal",
                    signals.length !== 1 ? 's' : '',
                    " detected"),
                React.createElement("span", null, expanded ? '▲' : '▼')),
            expanded && (React.createElement("div", { style: { marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 } }, signals.map((sig, i) => (React.createElement("div", { key: i, style: {
                    padding: '5px 8px', borderRadius: 5,
                    background: 'rgba(255,153,68,0.08)', border: '1px solid rgba(255,153,68,0.2)',
                    fontSize: 9, color: '#b0bfd8', lineHeight: 1.4,
                } },
                "\u2022 ",
                sig))))))),
        level >= 2 && (React.createElement("div", { style: {
                marginTop: 8, padding: '7px 10px', borderRadius: 6,
                background: 'rgba(255,92,92,0.08)', border: '1px solid rgba(255,92,92,0.25)',
                fontSize: 9, color: '#ff9a9a', lineHeight: 1.6,
            } },
            React.createElement("b", null, "Cover plays:"),
            " Make one \"wrong\" play intentionally (e.g. stand on 16 vs 7). Vary your bet sizes randomly. Take a 20-min break and return."))));
}
