const DEALER_BUST_PCT = {
    '2': 35.4, '3': 37.6, '4': 40.3, '5': 42.9, '6': 42.1,
    '7': 26.2, '8': 24.4, '9': 23.3, '10': 21.4,
    'J': 21.4, 'Q': 21.4, 'K': 21.4, 'A': 11.5,
};
const AC = {
    HIT: '#ff5c5c', STAND: '#44e882', DOUBLE: '#ffd447',
    SPLIT: '#b99bff', SURRENDER: '#ff9944',
};
function CenterToolbar({ recommendation, count, playerHand, dealerUpcard, betting, session, currency, sideCounts, casinoRisk }) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1;
    const action = recommendation === null || recommendation === void 0 ? void 0 : recommendation.action;
    const tc = (_a = count === null || count === void 0 ? void 0 : count.true) !== null && _a !== void 0 ? _a : 0;
    const adv = (_b = count === null || count === void 0 ? void 0 : count.advantage) !== null && _b !== void 0 ? _b : 0;
    const decks = (_c = count === null || count === void 0 ? void 0 : count.decks_remaining) !== null && _c !== void 0 ? _c : '—';
    const pv = (_d = playerHand === null || playerHand === void 0 ? void 0 : playerHand.value) !== null && _d !== void 0 ? _d : 0;
    const isSoft = playerHand === null || playerHand === void 0 ? void 0 : playerHand.is_soft;
    const isBust = playerHand === null || playerHand === void 0 ? void 0 : playerHand.is_bust;
    const isBJ = playerHand === null || playerHand === void 0 ? void 0 : playerHand.is_blackjack;
    const hasCards = ((_f = (_e = playerHand === null || playerHand === void 0 ? void 0 : playerHand.cards) === null || _e === void 0 ? void 0 : _e.length) !== null && _f !== void 0 ? _f : 0) >= 1;
    const profit = (_g = session === null || session === void 0 ? void 0 : session.profit) !== null && _g !== void 0 ? _g : 0;
    const hands = (_h = session === null || session === void 0 ? void 0 : session.hands) !== null && _h !== void 0 ? _h : 0;
    const sym = (_j = currency === null || currency === void 0 ? void 0 : currency.symbol) !== null && _j !== void 0 ? _j : '₹';
    const adjTC = (_k = sideCounts === null || sideCounts === void 0 ? void 0 : sideCounts.ace_adjusted_tc) !== null && _k !== void 0 ? _k : tc;
    const aceRem = (_l = sideCounts === null || sideCounts === void 0 ? void 0 : sideCounts.aces_remaining) !== null && _l !== void 0 ? _l : null;
    const aceExp = (_m = sideCounts === null || sideCounts === void 0 ? void 0 : sideCounts.aces_expected) !== null && _m !== void 0 ? _m : null;
    const aceRich = (_o = sideCounts === null || sideCounts === void 0 ? void 0 : sideCounts.ace_rich) !== null && _o !== void 0 ? _o : false;
    const aceAdj = (_p = sideCounts === null || sideCounts === void 0 ? void 0 : sideCounts.ace_adjustment) !== null && _p !== void 0 ? _p : 0;
    const acesSeen = (_q = sideCounts === null || sideCounts === void 0 ? void 0 : sideCounts.aces_seen) !== null && _q !== void 0 ? _q : 0;
    const tenRem = (_r = sideCounts === null || sideCounts === void 0 ? void 0 : sideCounts.tens_remaining) !== null && _r !== void 0 ? _r : null;
    const tenExp = (_s = sideCounts === null || sideCounts === void 0 ? void 0 : sideCounts.tens_expected) !== null && _s !== void 0 ? _s : null;
    const tenRich = (_t = sideCounts === null || sideCounts === void 0 ? void 0 : sideCounts.ten_rich) !== null && _t !== void 0 ? _t : false;
    const tenAdj = (_u = sideCounts === null || sideCounts === void 0 ? void 0 : sideCounts.ten_adjustment) !== null && _u !== void 0 ? _u : 0;
    const tensSeen = (_v = sideCounts === null || sideCounts === void 0 ? void 0 : sideCounts.tens_seen) !== null && _v !== void 0 ? _v : 0;
    const totalAces = aceRem !== null ? aceRem + acesSeen : 32;
    const totalTens = tenRem !== null ? tenRem + tensSeen : 128;
    const riskLevel = (_w = casinoRisk === null || casinoRisk === void 0 ? void 0 : casinoRisk.level) !== null && _w !== void 0 ? _w : 0;
    const riskLabel = (_x = casinoRisk === null || casinoRisk === void 0 ? void 0 : casinoRisk.label) !== null && _x !== void 0 ? _x : 'LOW';
    const riskColor = (_y = casinoRisk === null || casinoRisk === void 0 ? void 0 : casinoRisk.color) !== null && _y !== void 0 ? _y : '#44e882';
    const riskScore = (_z = casinoRisk === null || casinoRisk === void 0 ? void 0 : casinoRisk.score) !== null && _z !== void 0 ? _z : 0;
    const riskAdvice = (_0 = casinoRisk === null || casinoRisk === void 0 ? void 0 : casinoRisk.advice) !== null && _0 !== void 0 ? _0 : '';
    const spread = (casinoRisk === null || casinoRisk === void 0 ? void 0 : casinoRisk.spread) != null ? casinoRisk.spread : 1;
    const upRank = dealerUpcard ? String(dealerUpcard).replace(/[♠♥♦♣]/g, '').trim().toUpperCase() : null;
    const dealerBustPct = upRank ? ((_1 = DEALER_BUST_PCT[upRank]) !== null && _1 !== void 0 ? _1 : null) : null;
    const bustPct = (() => {
        if (!hasCards || isBust || isBJ || pv === 0)
            return null;
        const safe = 21 - pv;
        if (safe >= 11)
            return 0;
        if (safe <= 0)
            return 100;
        const base = { 2: 4 / 52, 3: 4 / 52, 4: 4 / 52, 5: 4 / 52, 6: 4 / 52, 7: 4 / 52, 8: 4 / 52, 9: 4 / 52, 10: 16 / 52 };
        let b = 0;
        for (let v = safe + 1; v <= 10; v++)
            b += (base[v] || 0);
        return Math.round(Math.min(99, Math.max(1, (b + Math.max(-0.12, Math.min(0.15, tc * 0.018))) * 100)));
    })();
    const acCol = action ? (AC[action] || '#f0f4ff') : '#b8ccdf';
    const tcColor = tc >= 3 ? '#44e882' : tc >= 1 ? '#88eebb' : tc >= -1 ? '#b8ccdf' : '#ff5c5c';
    const adjTcColor = adjTC >= 3 ? '#44e882' : adjTC >= 1 ? '#88eebb' : adjTC >= -1 ? '#b8ccdf' : '#ff5c5c';
    const advCol = adv >= 0 ? '#44e882' : '#ff5c5c';
    const bustCol = bustPct === null ? '#b8ccdf' : bustPct >= 70 ? '#ff5c5c' : bustPct >= 40 ? '#ffd447' : '#44e882';
    const dlrBustCol = dealerBustPct === null ? '#b8ccdf' : dealerBustPct >= 40 ? '#44e882' : dealerBustPct >= 28 ? '#ffd447' : '#ff5c5c';
    const aceColor = aceAdj > 0.2 ? '#44e882' : aceAdj < -0.2 ? '#ff5c5c' : '#b8ccdf';
    const tenColor = tenAdj > 0.2 ? '#44e882' : tenAdj < -0.2 ? '#ff5c5c' : '#b8ccdf';
    const cell = (label, value, color, extra) => (React.createElement("div", { style: { textAlign: 'center', flex: 1 } },
        React.createElement("div", { style: { fontSize: 9, color: '#ccdaec', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 } }, label),
        React.createElement("div", { style: { fontSize: 15, fontWeight: 700, color: color || '#ffffff', fontFamily: 'DM Mono,monospace', lineHeight: 1 } }, value),
        extra && React.createElement("div", { style: { fontSize: 8, color: '#b8ccdf', marginTop: 1 } }, extra)));
    const divider = () => (React.createElement("div", { style: { width: 1, background: 'rgba(255,255,255,0.08)', alignSelf: 'stretch', margin: '0 4px' } }));
    const sectionLabel = (text) => (React.createElement("div", { style: { fontSize: 9, color: '#ccdaec', textTransform: 'uppercase', letterSpacing: '0.07em',
            fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, marginRight: 6 } }, text));
    return (React.createElement("div", { style: {
            background: '#1a2236',
            border: '1.5px solid rgba(255,255,255,0.09)',
            borderRadius: 10, padding: '8px 12px',
            display: 'flex', flexDirection: 'column', gap: 7,
        } },
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 0 } },
            React.createElement("div", { style: {
                    flex: 1.5, display: 'flex', alignItems: 'center', gap: 6,
                    background: action ? `${acCol}10` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${action ? acCol + '40' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: 7, padding: '5px 10px', marginRight: 6,
                } },
                React.createElement("span", { style: { fontSize: 24, fontWeight: 900, color: acCol, fontFamily: 'Syne,sans-serif',
                        textShadow: action ? `0 0 12px ${acCol}50` : 'none', lineHeight: 1 } }, action || '—'),
                (recommendation === null || recommendation === void 0 ? void 0 : recommendation.is_deviation) && (React.createElement("span", { style: { fontSize: 7, fontWeight: 800, color: '#b99bff',
                        background: 'rgba(185,155,255,0.12)', border: '1px solid rgba(185,155,255,0.3)',
                        borderRadius: 3, padding: '1px 4px', letterSpacing: '0.06em' } }, "DEV")),
                !action && React.createElement("span", { style: { fontSize: 9, color: '#b8ccdf' } }, "deal cards")),
            cell(isBJ ? '🎉 BJ' : isBust ? '💀 Bust' : 'Hand', hasCards ? (isSoft && !isBust ? `S${pv}` : pv) : '—', isBust ? '#ff5c5c' : isBJ ? '#ffd447' : '#f0f4ff'),
            divider(),
            cell('Bust/Hit', bustPct === null ? '—' : `${bustPct}%`, bustCol),
            divider(),
            cell(upRank ? `Dlr (${upRank})` : 'Dlr Bust', dealerBustPct !== null ? `${dealerBustPct.toFixed(0)}%` : '—', dlrBustCol),
            divider(),
            betting && cell('Bet', `${sym}${betting.recommended_bet}`, '#ffd447', `${betting.units}u`)),
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 0,
                paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' } },
            cell('True Count', tc >= 0 ? `+${tc}` : String(tc), tcColor),
            divider(),
            cell('Player Edge', `${adv >= 0 ? '+' : ''}${adv}%`, advCol),
            divider(),
            cell('Decks Left', typeof decks === 'number' ? decks.toFixed(1) : decks, '#ccdaec'),
            divider(),
            cell('P&L', `${profit >= 0 ? '+' : ''}${sym}${Math.abs(profit).toFixed(0)}`, profit >= 0 ? '#44e882' : '#ff5c5c', `${hands} hands`),
            divider(),
            React.createElement("div", { style: { flex: 2, display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' } }, [['N', 'New'], ['S', 'Shuffle'], ['P', 'Player'], ['D', 'Dealer']].map(([k, l]) => (React.createElement("div", { key: k, style: { display: 'flex', alignItems: 'center', gap: 2 } },
                React.createElement("span", { style: { fontFamily: 'DM Mono,monospace', fontSize: 8, fontWeight: 700,
                        background: '#212d45', border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 3, padding: '1px 4px', color: '#ffd447' } }, k),
                React.createElement("span", { style: { fontSize: 8, color: '#b8ccdf' } }, l)))))),
        sideCounts && (React.createElement("div", { style: { paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' } },
            React.createElement("div", { style: { fontSize: 9, color: '#ccdaec', textTransform: 'uppercase',
                    letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8 } }, "Side Count"),
            React.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 } },
                React.createElement("div", { style: {
                        background: adjTC >= 1 ? 'rgba(68,232,130,0.10)' : adjTC <= -1 ? 'rgba(255,92,92,0.10)' : 'rgba(255,255,255,0.04)',
                        border: `1.5px solid ${adjTC >= 1 ? 'rgba(68,232,130,0.4)' : adjTC <= -1 ? 'rgba(255,92,92,0.4)' : 'rgba(255,255,255,0.10)'}`,
                        borderRadius: 8, padding: '10px 12px',
                    } },
                    React.createElement("div", { style: { fontSize: 10, color: '#ccdaec', textTransform: 'uppercase',
                            letterSpacing: '0.07em', marginBottom: 4, fontWeight: 600 } },
                        "Adj TC ",
                        React.createElement("span", { style: { color: '#ffd447', fontSize: 9 } }, "(for bets)")),
                    React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: adjTcColor,
                            fontFamily: 'DM Mono,monospace', lineHeight: 1, marginBottom: 4 } },
                        adjTC >= 0 ? '+' : '',
                        adjTC.toFixed(1)),
                    React.createElement("div", { style: { fontSize: 10, color: '#a8bcd4' } },
                        "Plain TC: ",
                        React.createElement("span", { style: { color: tcColor, fontFamily: 'DM Mono,monospace',
                                fontWeight: 700 } }, tc >= 0 ? `+${tc}` : tc))),
                React.createElement("div", { style: {
                        background: aceRich ? 'rgba(68,232,130,0.06)' : 'rgba(255,92,92,0.06)',
                        border: `1.5px solid ${aceRich ? 'rgba(68,232,130,0.3)' : 'rgba(255,92,92,0.3)'}`,
                        borderRadius: 8, padding: '10px 12px',
                    } },
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 } },
                        React.createElement("span", { style: { fontSize: 10, color: '#ccdaec', textTransform: 'uppercase',
                                letterSpacing: '0.07em', fontWeight: 600 } }, "Aces"),
                        React.createElement("span", { style: { fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4,
                                background: aceRich ? 'rgba(68,232,130,0.2)' : 'rgba(255,92,92,0.2)',
                                color: aceRich ? '#44e882' : '#ff5c5c',
                                border: `1px solid ${aceRich ? 'rgba(68,232,130,0.4)' : 'rgba(255,92,92,0.4)'}` } }, aceRich ? '▲ RICH' : '▼ POOR')),
                    React.createElement("div", { style: { fontSize: 24, fontWeight: 800, fontFamily: 'DM Mono,monospace',
                            color: aceColor, lineHeight: 1, marginBottom: 4 } },
                        aceRem !== null ? aceRem : '—',
                        React.createElement("span", { style: { fontSize: 13, color: '#a8bcd4', fontWeight: 500 } },
                            "/",
                            totalAces)),
                    React.createElement("div", { style: { fontSize: 11, fontWeight: 700, fontFamily: 'DM Mono,monospace',
                            color: aceAdj > 0 ? '#44e882' : aceAdj < 0 ? '#ff5c5c' : '#a8bcd4' } },
                        aceAdj >= 0 ? '+' : '',
                        aceAdj.toFixed(2),
                        " TC adj")),
                React.createElement("div", { style: {
                        background: tenRich ? 'rgba(68,232,130,0.06)' : 'rgba(255,92,92,0.06)',
                        border: `1.5px solid ${tenRich ? 'rgba(68,232,130,0.3)' : 'rgba(255,92,92,0.3)'}`,
                        borderRadius: 8, padding: '10px 12px',
                    } },
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 } },
                        React.createElement("span", { style: { fontSize: 10, color: '#ccdaec', textTransform: 'uppercase',
                                letterSpacing: '0.07em', fontWeight: 600 } }, "10-Values"),
                        React.createElement("span", { style: { fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4,
                                background: tenRich ? 'rgba(68,232,130,0.2)' : 'rgba(255,92,92,0.2)',
                                color: tenRich ? '#44e882' : '#ff5c5c',
                                border: `1px solid ${tenRich ? 'rgba(68,232,130,0.4)' : 'rgba(255,92,92,0.4)'}` } }, tenRich ? '▲ RICH' : '▼ POOR')),
                    React.createElement("div", { style: { fontSize: 24, fontWeight: 800, fontFamily: 'DM Mono,monospace',
                            color: tenColor, lineHeight: 1, marginBottom: 4 } },
                        tenRem !== null ? tenRem : '—',
                        React.createElement("span", { style: { fontSize: 13, color: '#a8bcd4', fontWeight: 500 } },
                            "/",
                            totalTens)),
                    React.createElement("div", { style: { fontSize: 11, fontWeight: 700, fontFamily: 'DM Mono,monospace',
                            color: tenAdj > 0 ? '#44e882' : tenAdj < 0 ? '#ff5c5c' : '#a8bcd4' } },
                        tenAdj >= 0 ? '+' : '',
                        tenAdj.toFixed(2),
                        " TC adj"))))),
        casinoRisk && (React.createElement("div", { style: { paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' } },
            React.createElement("div", { style: { fontSize: 9, color: '#ccdaec', textTransform: 'uppercase',
                    letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8 } }, "Casino Risk"),
            React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center' } },
                React.createElement("div", { style: {
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: `${riskColor}12`, border: `1.5px solid ${riskColor}45`,
                        borderRadius: 8, padding: '8px 14px',
                    } },
                    React.createElement("div", { style: {
                            width: 10, height: 10, borderRadius: '50%', background: riskColor,
                            boxShadow: `0 0 8px ${riskColor}`,
                            animation: riskLevel >= 3 ? 'live-pulse 1s ease-in-out infinite' : 'none',
                        } }),
                    React.createElement("span", { style: { fontSize: 18, fontWeight: 900, color: riskColor,
                            fontFamily: 'DM Mono,monospace' } }, riskLabel)),
                React.createElement("div", null,
                    React.createElement("div", { style: { height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.07)',
                            overflow: 'hidden', marginBottom: 6, position: 'relative' } },
                        React.createElement("div", { style: { position: 'absolute', inset: 0, borderRadius: 3, opacity: 0.2,
                                background: 'linear-gradient(90deg,#44e882,#ffd447,#ff9944,#ff5c5c)' } }),
                        React.createElement("div", { style: { height: '100%', borderRadius: 3,
                                width: `${Math.min(100, (riskScore / 10) * 100)}%`,
                                background: 'linear-gradient(90deg,#44e882,#ffd447,#ff9944,#ff5c5c)',
                                transition: 'width 0.5s ease' } })),
                    React.createElement("div", { style: { fontSize: 11, color: riskLevel >= 2 ? '#ffb399' : '#ccdaec',
                            lineHeight: 1.4 } }, riskAdvice)),
                React.createElement("div", { style: { textAlign: 'center', minWidth: 60 } },
                    React.createElement("div", { style: { fontSize: 9, color: '#a8bcd4', textTransform: 'uppercase',
                            letterSpacing: '0.07em', marginBottom: 3 } }, "Spread"),
                    React.createElement("div", { style: { fontSize: 20, fontWeight: 800, fontFamily: 'DM Mono,monospace',
                            color: spread >= 8 ? '#ff5c5c' : spread >= 5 ? '#ffd447' : '#44e882' } },
                        spread.toFixed(0),
                        ":1")))))));
}
