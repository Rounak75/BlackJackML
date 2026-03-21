function CardGrid({ target, onTargetChange, remainingByRank, onDealCard, onUndo, onSplit, canSplit, dealerMustDraw, dealerStands }) {
    const { useState } = React;
    const [suitFilter, setSuitFilter] = useState('all');
    const rankToKey = { A: 11, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 10, Q: 10, K: 10 };
    const maxByKey = { 2: 24, 3: 24, 4: 24, 5: 24, 6: 24, 7: 24, 8: 24, 9: 24, 10: 96, 11: 24 };
    const suitFilters = [
        { key: 'all', label: 'All', ariaLabel: 'Show all suits' },
        { key: 'spades', label: '♠', ariaLabel: 'Spades only' },
        { key: 'hearts', label: '♥', ariaLabel: 'Hearts only', red: true },
        { key: 'diamonds', label: '♦', ariaLabel: 'Diamonds only', red: true },
        { key: 'clubs', label: '♣', ariaLabel: 'Clubs only' },
    ];
    const targets = [
        { t: 'player', label: '👤 Player', ariaLabel: 'Deal next card to player hand' },
        { t: 'dealer', label: dealerMustDraw ? '🏦 Dealer ←' : '🏦 Dealer', ariaLabel: dealerMustDraw ? 'Deal next card to dealer (dealer must draw)' : 'Deal next card to dealer hand' },
        { t: 'seen', label: '👁 Seen', ariaLabel: 'Mark card as seen (count only, no hand)' },
    ];
    const suitFullName = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };
    return (React.createElement("div", { className: "rounded-xl p-3", style: { background: '#1a2236', border: '1.5px solid rgba(255,255,255,0.12)' }, role: "group", "aria-label": "Card entry panel" },
        React.createElement("div", { className: "flex items-center justify-between mb-3" },
            React.createElement("span", { className: "font-display font-bold text-[10px] uppercase tracking-widest", style: { color: '#b8ccdf' }, "aria-hidden": "true" }, "Click to Deal"),
            React.createElement("div", { className: "flex gap-1", role: "group", "aria-label": "Filter cards by suit" }, suitFilters.map(({ key, label, red, ariaLabel }) => (React.createElement("button", { key: key, onClick: () => setSuitFilter(key), "aria-pressed": suitFilter === key, "aria-label": ariaLabel, className: "text-xs px-2 py-0.5 rounded-md transition-all", style: {
                    background: suitFilter === key ? '#212d45' : 'transparent',
                    border: `1.5px solid ${suitFilter === key ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)'}`,
                    color: suitFilter === key
                        ? (red ? '#ff7a7a' : '#f0f4ff')
                        : (red ? '#ff9999aa' : '#b8ccdf'),
                    fontWeight: suitFilter === key ? 700 : 400,
                } }, label))))),
        dealerMustDraw && (React.createElement("div", { role: "alert", className: "flex items-center gap-2 mb-2 px-3 py-2 rounded-lg text-xs font-semibold", style: {
                background: 'rgba(255, 160, 40, 0.15)',
                border: '1.5px solid rgba(255, 160, 40, 0.5)',
                color: '#ffb347',
                animation: 'pulse 1.5s ease-in-out infinite',
            } },
            React.createElement("span", { "aria-hidden": "true" }, "\uD83C\uDFE6"),
            React.createElement("span", null, "DEALER MUST DRAW \u2014 click a card to deal to dealer"))),
        dealerStands && (React.createElement("div", { role: "status", className: "flex items-center gap-2 mb-2 px-3 py-2 rounded-lg text-xs font-semibold", style: {
                background: 'rgba(50, 200, 120, 0.12)',
                border: '1.5px solid rgba(50, 200, 120, 0.4)',
                color: '#5eead4',
            } },
            React.createElement("span", { "aria-hidden": "true" }, "\u2713"),
            React.createElement("span", null, "Dealer stands \u2014 record the result"))),
        React.createElement("div", { className: "flex items-center gap-2 mb-2 p-2 rounded-lg", style: { background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }, role: "group", "aria-label": "Select deal target" },
            React.createElement("span", { className: "text-[10px] font-semibold", style: { color: '#b8ccdf', flexShrink: 0 }, "aria-hidden": "true" }, "To:"),
            React.createElement("div", { className: "flex gap-1 flex-1" }, targets.map(({ t, label, ariaLabel }) => {
                const isDealer = t === 'dealer';
                const mustDraw = isDealer && dealerMustDraw;
                const isActive = target === t;
                return (React.createElement("button", { key: t, onClick: () => onTargetChange(t), "aria-pressed": isActive, "aria-label": ariaLabel, className: "flex-1 text-xs py-1.5 rounded-md font-semibold transition-all", style: {
                        background: isActive
                            ? (mustDraw ? '#ff9a20' : '#ffd447')
                            : (mustDraw ? 'rgba(255,154,32,0.12)' : 'transparent'),
                        border: `1.5px solid ${isActive
                            ? (mustDraw ? '#ff9a20' : '#ffd447')
                            : (mustDraw ? 'rgba(255,154,32,0.5)' : 'rgba(255,255,255,0.15)')}`,
                        color: isActive ? '#0a0e18' : (mustDraw ? '#ffb347' : '#ccdaec'),
                        fontWeight: mustDraw ? 700 : 600,
                        boxShadow: mustDraw && isActive ? '0 0 10px rgba(255,154,32,0.5)' : 'none',
                    } }, label));
            }))),
        React.createElement("div", { className: "flex gap-2 mb-3" },
            canSplit ? (React.createElement("button", { onClick: onSplit, "aria-label": "Split pair into two separate hands", className: "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold transition-all", style: {
                    background: 'rgba(185,155,255,0.15)',
                    border: '2px solid rgba(185,155,255,0.7)',
                    color: '#c4a8ff',
                    fontSize: 13,
                    boxShadow: '0 0 14px rgba(185,155,255,0.3)',
                    animation: 'split-pulse 1.8s ease-in-out infinite',
                } },
                React.createElement("span", { "aria-hidden": "true", style: { fontSize: 16 } }, "\u2702"),
                React.createElement("span", null, "SPLIT PAIR"),
                React.createElement("span", { style: { fontSize: 10, opacity: 0.8, fontWeight: 500 }, "aria-hidden": "true" }, "\u2192 2 hands"))) : (React.createElement("div", { style: { flex: 1 }, "aria-hidden": "true" })),
            React.createElement("button", { onClick: onUndo, "aria-label": "Undo last card dealt", className: "flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-bold transition-all", style: {
                    background: 'rgba(255,92,92,0.10)',
                    border: '1.5px solid rgba(255,92,92,0.35)',
                    color: '#ff8888',
                    fontSize: 12,
                    minWidth: 110,
                }, onMouseEnter: e => {
                    e.currentTarget.style.background = 'rgba(255,92,92,0.20)';
                    e.currentTarget.style.borderColor = 'rgba(255,92,92,0.7)';
                }, onMouseLeave: e => {
                    e.currentTarget.style.background = 'rgba(255,92,92,0.10)';
                    e.currentTarget.style.borderColor = 'rgba(255,92,92,0.35)';
                } },
                React.createElement("span", { "aria-hidden": "true", style: { fontSize: 14 } }, "\u21A9"),
                React.createElement("span", null, "Undo Card"))),
        React.createElement("style", null, `
        @keyframes split-pulse {
          0%, 100% { box-shadow: 0 0 10px rgba(185,155,255,0.3); }
          50%       { box-shadow: 0 0 22px rgba(185,155,255,0.6); }
        }
      `),
        React.createElement("div", { className: "card-grid-inner", style: { display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', gap: '3px' }, role: "group", "aria-label": "Card selection grid \u2014 click to deal a card" }, SUITS.map(suit => RANKS.map(rank => {
            const visible = suitFilter === 'all' || suitFilter === suit.name;
            if (!visible)
                return null;
            const hv = HILO_TAG[rank];
            const key = rankToKey[rank];
            const rem = remainingByRank ? (remainingByRank[key] || 0) : 0;
            const max = maxByKey[key] || 24;
            const depleted = rem < max * 0.2;
            const countHint = hv > 0 ? ', Hi-Lo +1' : hv < 0 ? ', Hi-Lo -1' : '';
            const suitName = suitFullName[suit.name] || suit.name;
            return (React.createElement("button", { key: `${rank}-${suit.name}`, onClick: () => onDealCard(rank, suit.name), "aria-label": `Deal ${rank} of ${suitName} to ${target}${countHint}${depleted ? ' (low supply)' : ''}`, "aria-disabled": depleted ? 'true' : undefined, className: `card-btn ${suit.isRed ? 'red-card' : ''} ${depleted ? 'depleted' : ''} ${hv > 0 ? 'count-pos' : hv < 0 ? 'count-neg' : ''}` },
                React.createElement("span", null, rank),
                React.createElement("span", { className: "btn-suit", "aria-hidden": "true" }, suit.icon),
                hv !== 0 && (React.createElement("span", { "aria-hidden": "true", style: {
                        position: 'absolute', top: '2px', right: '3px',
                        fontSize: '0.5rem', lineHeight: 1,
                        color: hv > 0 ? 'var(--jade)' : 'var(--ruby)',
                    } }, hv > 0 ? '+' : '−'))));
        })))));
}
