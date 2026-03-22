function EdgeMeter({ count }) {
    const adv = count ? count.advantage : -0.5;
    const clamp = Math.max(-2, Math.min(2, adv));
    const pct = ((clamp + 2) / 4) * 100;
    const isPos = adv > 0;
    return (React.createElement(Widget, { title: "Player Edge Meter" },
        React.createElement("div", { style: {
                height: 20,
                background: '#111827',
                borderRadius: 999,
                position: 'relative',
                overflow: 'hidden',
                marginBottom: 8,
            } },
            React.createElement("div", { className: "edge-fill", style: { width: `${pct}%` } }),
            React.createElement("div", { style: {
                    position: 'absolute', left: '50%', top: 0, bottom: 0,
                    width: 2, background: 'rgba(255,255,255,0.2)',
                    transform: 'translateX(-50%)',
                } })),
        React.createElement("div", { className: "flex justify-between mb-3 font-mono", style: { fontSize: '0.62rem', color: '#ccdaec' } },
            React.createElement("span", null, "House \u22122%"),
            React.createElement("span", null, "Break Even"),
            React.createElement("span", null, "Player +2%")),
        React.createElement("div", { className: "flex items-baseline gap-2 flex-wrap" },
            React.createElement("span", { className: "font-display font-extrabold leading-none", style: { fontSize: '1.6rem', color: isPos ? '#44e882' : '#ff5c5c' } },
                adv >= 0 ? '+' : '',
                adv.toFixed(2),
                "%"),
            React.createElement("span", { className: "text-xs", style: { color: '#ccdaec' } }, isPos ? 'Player Edge' : 'House Edge')),
        React.createElement("div", { className: "font-mono text-[10px] mt-1", style: { color: '#b8ccdf' } },
            "RTP: ",
            (100 + adv).toFixed(2),
            "% \u00B7 Base house edge: 0.50%")));
}
