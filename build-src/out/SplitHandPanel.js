const ACTION_COLORS_SP = {
    HIT: '#ff5c5c', STAND: '#44e882', DOUBLE: '#ffd447',
    SPLIT: '#b99bff', SURRENDER: '#ff9944',
};
function SplitHandCard({ cardStr }) {
    if (!cardStr)
        return null;
    const suit = cardStr.slice(-1);
    const rank = cardStr.slice(0, -1);
    const isRed = suit === '♥' || suit === '♦';
    return (React.createElement("div", { style: {
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', width: 40, height: 56, borderRadius: 6,
            background: '#1a2236', border: `1.5px solid ${isRed ? 'rgba(255,120,120,0.5)' : 'rgba(255,255,255,0.2)'}`,
            fontFamily: 'DM Mono, monospace', fontWeight: 800,
            color: isRed ? '#ff7a7a' : '#ffffff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            fontSize: 13, gap: 1,
        } },
        React.createElement("span", null, rank),
        React.createElement("span", { style: { fontSize: 10 } }, suit)));
}
function SplitHandZone({ hand, handNumber, isActive, dealerUpcard, onComplete }) {
    const { useState } = React;
    if (!hand)
        return null;
    const rec = hand.recommendation;
    const action = rec === null || rec === void 0 ? void 0 : rec.action;
    const acCol = action ? (ACTION_COLORS_SP[action] || '#ffffff') : '#94a7c4';
    const val = hand.value;
    const isBust = hand.is_bust;
    const isBJ = hand.is_blackjack;
    const isSplitAce = hand.is_split_ace;
    const status = isBust ? 'BUST' : isBJ ? 'BJ' : hand.cards.length === 0 ? 'WAITING' : null;
    const statusColor = isBust ? '#ff5c5c' : isBJ ? '#ffd447' : '#94a7c4';
    return (React.createElement("div", { style: {
            flex: 1, borderRadius: 10, padding: '12px',
            background: isActive ? 'rgba(255,212,71,0.06)' : 'rgba(255,255,255,0.02)',
            border: `2px solid ${isActive ? 'rgba(255,212,71,0.5)' : 'rgba(255,255,255,0.1)'}`,
            position: 'relative', transition: 'all 0.2s',
        } },
        React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 } },
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                React.createElement("span", { style: { fontSize: 10, fontWeight: 800, color: isActive ? '#ffd447' : '#94a7c4',
                        textTransform: 'uppercase', letterSpacing: '0.08em' } },
                    "Hand ",
                    handNumber),
                isActive && (React.createElement("span", { style: { fontSize: 8, fontWeight: 700, color: '#ffd447',
                        background: 'rgba(255,212,71,0.15)', border: '1px solid rgba(255,212,71,0.4)',
                        borderRadius: 3, padding: '1px 5px' } }, "ACTIVE")),
                isSplitAce && (React.createElement("span", { style: { fontSize: 8, color: '#b99bff',
                        background: 'rgba(185,155,255,0.12)', border: '1px solid rgba(185,155,255,0.3)',
                        borderRadius: 3, padding: '1px 5px' } }, "ACE \u2014 1 card"))),
            React.createElement("div", { style: {
                    fontSize: 18, fontWeight: 900, fontFamily: 'DM Mono, monospace',
                    color: isBust ? '#ff5c5c' : isBJ ? '#ffd447' : '#ffffff',
                } },
                hand.cards.length > 0 ? (hand.is_soft && !isBust ? `S${val}` : val) : '—',
                status && React.createElement("span", { style: { fontSize: 11, color: statusColor, marginLeft: 5 } }, status))),
        React.createElement("div", { style: { display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10, minHeight: 60 } }, hand.cards.length === 0
            ? React.createElement("div", { style: { fontSize: 10, color: '#94a7c4', alignSelf: 'center' } }, "Deal a card")
            : hand.cards.map((c, i) => React.createElement(SplitHandCard, { key: i, cardStr: c }))),
        isActive && rec && (React.createElement("div", { style: {
                padding: '8px 10px', borderRadius: 7,
                background: `${acCol}12`, border: `1px solid ${acCol}45`,
                display: 'flex', alignItems: 'center', gap: 8,
            } },
            React.createElement("span", { style: { fontSize: 20, fontWeight: 900, color: acCol,
                    fontFamily: 'Syne, sans-serif', textShadow: `0 0 12px ${acCol}50` } }, action),
            rec.is_deviation && (React.createElement("span", { style: { fontSize: 8, fontWeight: 700, color: '#b99bff',
                    background: 'rgba(185,155,255,0.12)', border: '1px solid rgba(185,155,255,0.3)',
                    borderRadius: 3, padding: '1px 4px' } }, "DEV")),
            isSplitAce && (React.createElement("span", { style: { fontSize: 9, color: '#94a7c4' } }, "Forced STAND (split aces)")))),
        !isActive && !isBust && !isBJ && hand.cards.length > 0 && (React.createElement("div", { style: { fontSize: 10, color: '#94a7c4', textAlign: 'center', paddingTop: 4 } }, action ? `→ ${action} when active` : 'Complete')),
        isActive && !isBust && hand.cards.length >= 2 && onComplete && (React.createElement("button", { onClick: onComplete, "aria-label": `Done with split hand ${handNumber}`, style: {
                width: '100%', marginTop: 8, padding: '6px', fontSize: 10, fontWeight: 700,
                borderRadius: 6, cursor: 'pointer',
                background: 'rgba(106,175,255,0.12)', border: '1px solid rgba(106,175,255,0.4)',
                color: '#6aafff',
            } },
            "\u2713 Done with Hand ",
            handNumber,
            " \u2192 Next Hand"))));
}
function SplitHandPanel({ splitHands, activeHandIndex, dealerUpcard, socket, onNextHand }) {
    if (!splitHands || splitHands.length === 0)
        return null;
    const handleComplete = () => {
        if (socket && socket.connected) {
            socket.emit('next_split_hand');
        }
        if (onNextHand)
            onNextHand();
    };
    const allDone = splitHands.every(h => h.is_bust || h.is_blackjack ||
        (h.is_split_ace && h.cards.length >= 2));
    return (React.createElement("div", { style: {
            background: '#1a2236', border: '1.5px solid rgba(255,212,71,0.3)',
            borderRadius: 12, padding: '14px',
        } },
        React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 } },
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                React.createElement("span", { style: { fontSize: 11, fontWeight: 800, color: '#ffd447',
                        textTransform: 'uppercase', letterSpacing: '0.09em', fontFamily: 'Syne, sans-serif' } }, "\u2702 Split Hands"),
                React.createElement("span", { style: { fontSize: 9, color: '#94a7c4' } },
                    "Playing Hand ",
                    activeHandIndex + 1,
                    " of ",
                    splitHands.length)),
            dealerUpcard && (React.createElement("span", { style: { fontSize: 10, color: '#94a7c4' } },
                "Dealer shows: ",
                React.createElement("b", { style: { color: '#ffffff' } }, dealerUpcard)))),
        React.createElement("div", { style: {
                fontSize: 9, color: '#94a7c4', marginBottom: 10,
                padding: '5px 8px', borderRadius: 5,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                lineHeight: 1.6,
            } },
            React.createElement("span", { style: { color: '#b0bfd8', fontWeight: 600 } }, "Split rules: "),
            "No surrender \u00B7 No double after split \u00B7 Split aces get 1 card each \u00B7 Each hand plays independently"),
        React.createElement("div", { style: { display: 'flex', gap: 10 } }, splitHands.map((hand, i) => (React.createElement(SplitHandZone, { key: i, hand: hand, handNumber: i + 1, isActive: i === activeHandIndex, dealerUpcard: dealerUpcard, onComplete: i === activeHandIndex && i < splitHands.length - 1 ? handleComplete : null })))),
        allDone && (React.createElement("div", { style: {
                marginTop: 10, padding: '8px', borderRadius: 6, textAlign: 'center',
                background: 'rgba(68,232,130,0.08)', border: '1px solid rgba(68,232,130,0.3)',
                fontSize: 11, color: '#44e882', fontWeight: 700,
            } }, "All split hands complete \u2014 record results then press N for new hand"))));
}
