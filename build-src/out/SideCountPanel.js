function SideCountPanel({ sideCounts, count }) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    if (!sideCounts)
        return null;
    const tc = (_a = count === null || count === void 0 ? void 0 : count.true) !== null && _a !== void 0 ? _a : 0;
    const adjTC = (_b = sideCounts.ace_adjusted_tc) !== null && _b !== void 0 ? _b : tc;
    const decks = (_c = count === null || count === void 0 ? void 0 : count.decks_remaining) !== null && _c !== void 0 ? _c : '—';
    const aceRem = (_d = sideCounts.aces_remaining) !== null && _d !== void 0 ? _d : 0;
    const aceExp = (_e = sideCounts.aces_expected) !== null && _e !== void 0 ? _e : 0;
    const aceAdj = (_f = sideCounts.ace_adjustment) !== null && _f !== void 0 ? _f : 0;
    const aceRich = sideCounts.ace_rich;
    const tenRem = (_g = sideCounts.tens_remaining) !== null && _g !== void 0 ? _g : 0;
    const tenExp = (_h = sideCounts.tens_expected) !== null && _h !== void 0 ? _h : 0;
    const tenAdj = (_j = sideCounts.ten_adjustment) !== null && _j !== void 0 ? _j : 0;
    const tenRich = sideCounts.ten_rich;
    const tcColor = tc >= 3 ? '#44e882' : tc >= 1 ? '#88eebb' : tc >= -1 ? '#94a7c4' : '#ff5c5c';
    const adjTcColor = adjTC >= 3 ? '#44e882' : adjTC >= 1 ? '#88eebb' : adjTC >= -1 ? '#94a7c4' : '#ff5c5c';
    const aceColor = aceAdj > 0.3 ? '#44e882' : aceAdj < -0.3 ? '#ff5c5c' : '#94a7c4';
    const tenColor = tenAdj > 0.3 ? '#44e882' : tenAdj < -0.3 ? '#ff5c5c' : '#94a7c4';
    const acesSeen = (_k = sideCounts.aces_seen) !== null && _k !== void 0 ? _k : 0;
    const tensSeen = (_l = sideCounts.tens_seen) !== null && _l !== void 0 ? _l : 0;
    const totalAces = (aceRem !== null && aceRem !== void 0 ? aceRem : 0) + acesSeen || 32;
    const totalTens = (tenRem !== null && tenRem !== void 0 ? tenRem : 0) + tensSeen || 128;
    const aceFill = totalAces > 0 ? Math.max(0, Math.min(1, aceRem / totalAces)) : 0;
    const tenFill = totalTens > 0 ? Math.max(0, Math.min(1, tenRem / totalTens)) : 0;
    const row = (label, remaining, expected, adj, fill, color, rich, total) => {
        const pct = total > 0 ? Math.round((remaining / total) * 100) : 0;
        const diff = remaining - expected;
        return (React.createElement("div", { style: { marginBottom: 10 } },
            React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 } },
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                    React.createElement("span", { style: { fontSize: 10, fontWeight: 700, color: '#f0f4ff' } }, label),
                    React.createElement("span", { style: {
                            fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                            background: rich ? 'rgba(68,232,130,0.15)' : 'rgba(255,92,92,0.15)',
                            color: rich ? '#44e882' : '#ff5c5c',
                            border: `1px solid ${rich ? 'rgba(68,232,130,0.4)' : 'rgba(255,92,92,0.4)'}`,
                        } }, rich ? '▲ RICH' : '▼ POOR')),
                React.createElement("div", { style: { display: 'flex', gap: 10, alignItems: 'center' } },
                    React.createElement("span", { style: { fontSize: 11, fontWeight: 700, fontFamily: 'DM Mono,monospace', color: '#f0f4ff' } },
                        remaining,
                        React.createElement("span", { style: { fontSize: 8, color: '#94a7c4' } },
                            " / ",
                            total)),
                    React.createElement("span", { style: {
                            fontSize: 9, fontWeight: 700, fontFamily: 'DM Mono,monospace',
                            color: adj >= 0 ? '#44e882' : '#ff5c5c',
                        } },
                        adj >= 0 ? '+' : '',
                        adj.toFixed(2),
                        " TC"))),
            React.createElement("div", { style: { height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)', position: 'relative' } },
                React.createElement("div", { style: {
                        position: 'absolute', top: 0, bottom: 0,
                        left: `${(expected / total) * 100}%`,
                        width: 1, background: 'rgba(255,255,255,0.25)',
                    } }),
                React.createElement("div", { style: {
                        height: '100%', borderRadius: 3,
                        width: `${fill * 100}%`,
                        background: rich
                            ? 'linear-gradient(90deg, #44e882, #88eebb)'
                            : 'linear-gradient(90deg, #ff5c5c, #ff9a7c)',
                        transition: 'width 0.4s ease',
                    } })),
            React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', marginTop: 2 } },
                React.createElement("span", { style: { fontSize: 7, color: '#94a7c4' } },
                    diff >= 0 ? '+' : '',
                    diff.toFixed(1),
                    " vs expected (",
                    expected.toFixed(1),
                    ")"),
                React.createElement("span", { style: { fontSize: 7, color: '#94a7c4' } },
                    pct,
                    "% left"))));
    };
    return (React.createElement(Widget, { title: "Side Count", badge: "ACE+TEN", badgeColor: "text-gold" },
        React.createElement("div", { style: {
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 8, marginBottom: 12,
                background: adjTC >= 1 ? 'rgba(68,232,130,0.08)' : adjTC <= -1 ? 'rgba(255,92,92,0.08)' : 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${adjTC >= 1 ? 'rgba(68,232,130,0.35)' : adjTC <= -1 ? 'rgba(255,92,92,0.35)' : 'rgba(255,255,255,0.08)'}`,
            } },
            React.createElement("div", null,
                React.createElement("div", { style: { fontSize: 8, color: '#94a7c4', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 } }, "Ace-Adjusted TC"),
                React.createElement("div", { style: { fontSize: 8, color: '#94a7c4' } },
                    "Use this for ",
                    React.createElement("b", { style: { color: '#ffd447' } }, "bet sizing"))),
            React.createElement("div", { style: { textAlign: 'right' } },
                React.createElement("div", { style: { fontSize: 28, fontWeight: 900, fontFamily: 'DM Mono,monospace', lineHeight: 1, color: adjTcColor } },
                    adjTC >= 0 ? '+' : '',
                    adjTC.toFixed(1)),
                React.createElement("div", { style: { fontSize: 9, color: '#94a7c4', marginTop: 2 } },
                    "Base TC: ",
                    React.createElement("span", { style: { color: tcColor, fontFamily: 'DM Mono,monospace' } }, tc >= 0 ? `+${tc}` : tc)))),
        row('Aces', aceRem, aceExp, aceAdj, aceFill, aceColor, aceRich, totalAces),
        row('10-Values', tenRem, tenExp, tenAdj, tenFill, tenColor, tenRich, totalTens),
        React.createElement("div", { style: {
                padding: '6px 8px', borderRadius: 6, marginTop: 4,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                fontSize: 8, color: '#94a7c4', lineHeight: 1.6,
            } },
            React.createElement("b", { style: { color: '#b0bfd8' } }, "Bet sizing only"),
            " \u2014 use Ace-adjusted TC to decide how much to bet. Use plain TC for all ",
            React.createElement("b", { style: { color: '#b0bfd8' } }, "strategy plays"),
            " (hit/stand/double/split).")));
}
