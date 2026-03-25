function ShoePanel({ shoe }) {
    if (!shoe) {
        return (React.createElement(Widget, { title: "Shoe Composition" },
            React.createElement("div", { className: "text-xs", style: { color: '#b8ccdf' } }, "Loading\u2026")));
    }
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
    const keys = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const maxPR = [32, 32, 32, 32, 32, 32, 32, 32, 128, 32];
    const pct = shoe.penetration;
    const statusTxt = pct >= 75 ? 'SHUFFLE SOON' : pct >= 50 ? 'MID SHOE' : 'FRESH';
    const statusStyle = {
        color: pct >= 75 ? '#ff5c5c' : pct >= 50 ? '#ffd447' : '#44e882',
        background: pct >= 75 ? 'rgba(255,92,92,0.1)' : pct >= 50 ? 'rgba(255,212,71,0.1)' : 'rgba(68,232,130,0.1)',
        border: `1px solid ${pct >= 75 ? 'rgba(255,92,92,0.3)' : pct >= 50 ? 'rgba(255,212,71,0.3)' : 'rgba(68,232,130,0.3)'}`,
    };
    return (React.createElement(Widget, { title: "Shoe Composition" },
        React.createElement("div", { className: "flex items-center justify-between mb-3" },
            React.createElement("span", { className: "font-mono text-[11px]", style: { color: '#ccdaec' } },
                shoe.cards_remaining,
                " cards \u00B7 ",
                shoe.decks_remaining,
                " decks"),
            React.createElement("span", { className: "font-mono text-[9px] px-2 py-0.5 rounded font-bold", style: statusStyle }, statusTxt)),
        React.createElement("div", { style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(10, 1fr)',
                gap: '4px',
                marginBottom: 12,
            } }, keys.map((key, i) => {
            const rem = (shoe.remaining_by_rank && shoe.remaining_by_rank[key]) || 0;
            const pct2 = Math.min(100, (rem / maxPR[i]) * 100);
            const cls = [10, 11].includes(key) ? 'high' : [2, 3, 4, 5, 6].includes(key) ? 'low' : 'mid';
            return (React.createElement("div", { key: key, className: "text-center" },
                React.createElement("div", { className: "text-[9px] font-mono mb-1", style: { color: '#ccdaec', fontWeight: 600 } }, ranks[i]),
                React.createElement("div", { style: {
                        height: 52,
                        background: '#111827',
                        borderRadius: 3,
                        position: 'relative',
                        overflow: 'hidden',
                    } },
                    React.createElement("div", { className: `shoe-bar ${cls}`, style: { height: `${pct2}%` } })),
                React.createElement("div", { className: "text-[9px] font-mono mt-1", style: { color: '#b8ccdf' } }, rem)));
        })),
        shoe.remaining_by_rank && (() => {
            const tenRem = shoe.remaining_by_rank[10] || 0;
            const totalRem = shoe.cards_remaining || 1;
            const tenPct = (tenRem / totalRem * 100).toFixed(1);
            const isRich = tenRem / totalRem > 0.308;
            return (React.createElement("div", { className: "flex items-center justify-between mb-2 text-[10px] font-mono", style: { color: isRich ? '#ffd447' : '#b8ccdf' } },
                React.createElement("span", null, "10-value cards"),
                React.createElement("span", { style: { fontWeight: 700, color: isRich ? '#ffd447' : '#ccdaec' } },
                    tenPct,
                    "% ",
                    isRich ? '↑ Rich' : '')));
        })(),
        React.createElement("div", { style: { height: 7, background: '#111827', borderRadius: 999, overflow: 'hidden', marginBottom: 5 } },
            React.createElement("div", { className: "pen-fill", style: { width: `${pct}%` } })),
        React.createElement("div", { className: "font-mono text-[10px]", style: { color: '#ccdaec' } },
            pct,
            "% penetration")));
}
