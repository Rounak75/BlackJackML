function HandDisplay({ playerHand, dealerUpcard, dealerHand, dealerMustDraw, sideBets, insurance, isDoubled, tookInsurance, onInsuranceChange, activeBet, currency, }) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const bv = ((_a = playerHand === null || playerHand === void 0 ? void 0 : playerHand.cards) === null || _a === void 0 ? void 0 : _a.length) > 0 ? playerHand.value : null;
    const bj = playerHand === null || playerHand === void 0 ? void 0 : playerHand.is_blackjack;
    const bust = playerHand === null || playerHand === void 0 ? void 0 : playerHand.is_bust;
    const dealerCards = (_b = dealerHand === null || dealerHand === void 0 ? void 0 : dealerHand.cards) !== null && _b !== void 0 ? _b : (dealerUpcard ? [dealerUpcard] : []);
    const dealerValue = (_c = dealerHand === null || dealerHand === void 0 ? void 0 : dealerHand.value) !== null && _c !== void 0 ? _c : 0;
    const dealerBj = dealerHand === null || dealerHand === void 0 ? void 0 : dealerHand.is_blackjack;
    const dealerBust = dealerHand === null || dealerHand === void 0 ? void 0 : dealerHand.is_bust;
    const dealerSoft = dealerHand === null || dealerHand === void 0 ? void 0 : dealerHand.is_soft;
    const dealerCardCount = (_d = dealerHand === null || dealerHand === void 0 ? void 0 : dealerHand.card_count) !== null && _d !== void 0 ? _d : dealerCards.length;
    const effectiveBet = isDoubled ? (activeBet || 0) * 2 : (activeBet || 0);
    const insuranceAdj = () => {
        if (!tookInsurance)
            return 0;
        const halfBet = (activeBet || 0) * 0.5;
        return dealerBj ? halfBet * 2 : -halfBet;
    };
    let resolvedResult = null;
    let resolvedProfit = 0;
    const pCards = (_f = (_e = playerHand === null || playerHand === void 0 ? void 0 : playerHand.cards) === null || _e === void 0 ? void 0 : _e.length) !== null && _f !== void 0 ? _f : 0;
    const dCards = (_g = dealerHand === null || dealerHand === void 0 ? void 0 : dealerHand.card_count) !== null && _g !== void 0 ? _g : 0;
    if (pCards >= 2 && dCards >= 2) {
        if (bust) {
            resolvedResult = 'loss';
            resolvedProfit = -effectiveBet + insuranceAdj();
        }
        else if (bj && dealerBj) {
            resolvedResult = 'push';
            resolvedProfit = 0 + insuranceAdj();
        }
        else if (bj && !dealerBj) {
            resolvedResult = 'win';
            resolvedProfit = (activeBet || 0) * 1.5 + insuranceAdj();
        }
        else if (dealerBj && !bj) {
            resolvedResult = 'loss';
            resolvedProfit = -effectiveBet + insuranceAdj();
        }
        else if (dealerBust) {
            resolvedResult = 'win';
            resolvedProfit = effectiveBet + insuranceAdj();
        }
        else if (dealerHand === null || dealerHand === void 0 ? void 0 : dealerHand.dealer_stands) {
            const pv = (_h = playerHand === null || playerHand === void 0 ? void 0 : playerHand.value) !== null && _h !== void 0 ? _h : 0;
            if (pv > dealerValue) {
                resolvedResult = 'win';
                resolvedProfit = effectiveBet + insuranceAdj();
            }
            else if (pv < dealerValue) {
                resolvedResult = 'loss';
                resolvedProfit = -effectiveBet + insuranceAdj();
            }
            else {
                resolvedResult = 'push';
                resolvedProfit = 0 + insuranceAdj();
            }
        }
    }
    const resultMeta = {
        win: { label: '🏆 YOU WIN', color: '#44e882', bg: 'rgba(68,232,130,0.15)', border: 'rgba(68,232,130,0.5)' },
        loss: { label: '💀 YOU LOSE', color: '#ff5c5c', bg: 'rgba(255,92,92,0.15)', border: 'rgba(255,92,92,0.5)' },
        push: { label: '🤝 PUSH', color: '#6aafff', bg: 'rgba(106,175,255,0.15)', border: 'rgba(106,175,255,0.5)' },
    };
    const sym = (_j = currency === null || currency === void 0 ? void 0 : currency.symbol) !== null && _j !== void 0 ? _j : '₹';
    const fmt = (n) => {
        const abs = Math.abs(n || 0);
        return `${n >= 0 ? '+' : '-'}${sym}${abs.toFixed(0)}`;
    };
    return (React.createElement("div", { className: "rounded-xl p-4", style: {
            background: '#1a2236',
            border: '1.5px solid rgba(255,255,255,0.12)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
        } },
        React.createElement("div", { style: { borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: 14 } },
            React.createElement("div", { className: "flex items-center gap-2 mb-2" },
                React.createElement("div", { className: "text-[10px] uppercase tracking-widest font-display font-bold", style: { color: '#b8ccdf' } }, "Dealer Hand"),
                dealerCards.length >= 2 && dealerValue > 0 && (React.createElement("span", { className: "font-mono text-xs px-2 py-0.5 rounded-full font-bold", style: {
                        background: dealerBj
                            ? 'rgba(255,212,71,0.15)'
                            : dealerBust
                                ? 'rgba(255,92,92,0.15)'
                                : 'rgba(255,255,255,0.08)',
                        border: `1.5px solid ${dealerBj ? 'rgba(255,212,71,0.5)'
                            : dealerBust ? 'rgba(255,92,92,0.5)'
                                : 'rgba(255,255,255,0.2)'}`,
                        color: dealerBj ? '#ffd447' : dealerBust ? '#ff5c5c' : '#ccdaec',
                    } }, dealerBj ? 'BLACKJACK' : dealerBust ? 'BUST' : `${dealerValue}${dealerSoft ? ' soft' : ''}`))),
            dealerMustDraw && !dealerBust && !dealerBj && (React.createElement("span", { className: "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mb-2", style: {
                    background: 'rgba(255,160,40,0.18)',
                    border: '1.5px solid rgba(255,160,40,0.55)',
                    color: '#ffb347',
                    animation: 'pulse 1.5s ease-in-out infinite',
                } },
                "\u2193 MUST DRAW \u2014 Dealer has ",
                dealerValue,
                dealerSoft ? ' soft' : '',
                " \u2014 must draw (rule: hit on 16 or below, stand on 17+)")),
            (insurance === null || insurance === void 0 ? void 0 : insurance.available) && (React.createElement("div", { className: "mb-3", style: { borderRadius: 10, overflow: 'hidden' } },
                React.createElement("div", { style: {
                        padding: '8px 12px',
                        background: tookInsurance
                            ? 'rgba(106,175,255,0.15)'
                            : 'rgba(255,212,71,0.08)',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    } },
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                        React.createElement("span", { style: { fontSize: 18 } }, "\uD83D\uDEE1"),
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: '#ffffff', marginBottom: 1 } },
                                "Insurance Available",
                                tookInsurance && (React.createElement("span", { style: {
                                        marginLeft: 8, fontSize: 9, fontWeight: 700, padding: '1px 6px',
                                        borderRadius: 10, background: 'rgba(106,175,255,0.3)',
                                        color: '#6aafff', border: '1px solid rgba(106,175,255,0.6)',
                                    } }, "\u2713 INSURED"))),
                            React.createElement("div", { style: { fontSize: 10, color: '#b8ccdf' } },
                                "Pays 2:1 \u00B7 Costs ",
                                sym,
                                activeBet > 0 ? (activeBet * 0.5).toFixed(0) : '½ bet',
                                activeBet > 0 && tookInsurance && (React.createElement("span", { style: { color: '#6aafff', fontWeight: 700 } },
                                    ' ',
                                    "\u00B7 win ",
                                    sym,
                                    (activeBet).toFixed(0),
                                    " if dealer BJ"))))),
                    insurance.ev !== null && (React.createElement("div", { style: {
                            textAlign: 'right', fontSize: 11, fontFamily: 'DM Mono, monospace',
                        } },
                        React.createElement("div", { style: { fontWeight: 800, color: insurance.ev >= 0 ? '#44e882' : '#ff5c5c' } },
                            insurance.ev >= 0 ? '+' : '', (_k = insurance.ev) === null || _k === void 0 ? void 0 :
                            _k.toFixed(1),
                            "% EV"),
                        React.createElement("div", { style: { fontSize: 9, color: '#94a7c4' } }, (_l = insurance.ten_probability) === null || _l === void 0 ? void 0 :
                            _l.toFixed(1),
                            "% tens left")))),
                React.createElement("div", { style: {
                        background: tookInsurance
                            ? 'rgba(106,175,255,0.10)'
                            : insurance.recommended
                                ? 'rgba(68,232,130,0.06)'
                                : 'rgba(255,92,92,0.06)',
                        padding: '10px 12px',
                        border: `1.5px solid ${tookInsurance ? 'rgba(106,175,255,0.5)'
                            : insurance.recommended ? 'rgba(68,232,130,0.35)'
                                : 'rgba(255,92,92,0.25)'}`,
                        borderTop: 'none',
                    } },
                    React.createElement("div", { style: { fontSize: 10, color: '#ccdaec', marginBottom: 8, lineHeight: 1.5 } }, insurance.reason),
                    !tookInsurance ? (React.createElement("div", { style: { display: 'flex', gap: 8 } },
                        React.createElement("button", { onClick: () => onInsuranceChange && onInsuranceChange(true), style: {
                                flex: insurance.recommended ? 2 : 1,
                                padding: '9px 0', borderRadius: 8, cursor: 'pointer',
                                fontWeight: 800, fontSize: 13, border: 'none',
                                background: insurance.recommended
                                    ? 'linear-gradient(135deg,#44e882,#22cc66)'
                                    : 'rgba(255,255,255,0.07)',
                                color: insurance.recommended ? '#0a0e18' : '#94a7c4',
                                boxShadow: insurance.recommended ? '0 2px 12px rgba(68,232,130,0.35)' : 'none',
                                transition: 'all 0.15s',
                            }, onMouseEnter: e => {
                                e.currentTarget.style.filter = 'brightness(1.1)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }, onMouseLeave: e => {
                                e.currentTarget.style.filter = '';
                                e.currentTarget.style.transform = '';
                            }, "aria-label": "Take insurance \u2014 I placed the insurance side bet" }, "\u2713 Take Insurance"),
                        React.createElement("button", { onClick: () => onInsuranceChange && onInsuranceChange(false), style: {
                                flex: !insurance.recommended ? 2 : 1,
                                padding: '9px 0', borderRadius: 8, cursor: 'pointer',
                                fontWeight: 800, fontSize: 13, border: 'none',
                                background: !insurance.recommended
                                    ? 'linear-gradient(135deg,#ff5c5c,#cc2222)'
                                    : 'rgba(255,255,255,0.07)',
                                color: !insurance.recommended ? '#ffffff' : '#94a7c4',
                                boxShadow: !insurance.recommended ? '0 2px 12px rgba(255,92,92,0.35)' : 'none',
                                transition: 'all 0.15s',
                            }, onMouseEnter: e => {
                                e.currentTarget.style.filter = 'brightness(1.1)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }, onMouseLeave: e => {
                                e.currentTarget.style.filter = '';
                                e.currentTarget.style.transform = '';
                            }, "aria-label": "Decline insurance \u2014 continue without insurance bet" }, "\u2717 Decline"))) : (React.createElement("div", null,
                        React.createElement("div", { style: {
                                padding: '7px 10px', borderRadius: 7, marginBottom: 6,
                                background: 'rgba(106,175,255,0.1)', border: '1px solid rgba(106,175,255,0.3)',
                                fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#6aafff',
                                textAlign: 'center', fontWeight: 700,
                            } }, dealerBj
                            ? `🎯 Dealer BJ! Insurance pays +${sym}${(activeBet).toFixed(0)}`
                            : (dealerHand === null || dealerHand === void 0 ? void 0 : dealerHand.card_count) >= 2
                                ? `❌ No dealer BJ — lost insurance ${sym}${(activeBet * 0.5).toFixed(0)}`
                                : `⏳ Insured ${sym}${(activeBet * 0.5).toFixed(0)} · waiting for hole card`),
                        React.createElement("button", { onClick: () => onInsuranceChange && onInsuranceChange(false), "aria-label": "Undo \u2014 I did not actually take insurance", style: {
                                width: '100%', padding: '5px', borderRadius: 6, cursor: 'pointer',
                                fontSize: 10, fontWeight: 600,
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: '#94a7c4',
                            } }, "\u21A9 Undo insurance")))))),
            React.createElement("div", { className: "flex items-center gap-2 flex-wrap", style: { minHeight: 64 } }, dealerCards.length === 0 ? (React.createElement("span", { className: "text-xs italic", style: { color: '#b8ccdf' } }, "Click a card with \"Dealer\" selected")) : (React.createElement(React.Fragment, null,
                dealerCards.map((c, i) => (React.createElement(MiniCard, { key: i, str: c }))),
                dealerCards.length === 1 && (React.createElement(MiniCardBack, { label: "?" }))))),
            dealerCards.length > 0 && (React.createElement("div", { className: "mt-1.5 text-[10px] font-mono", style: { color: '#b8ccdf' } }, dealerCards.length === 1
                ? 'Upcard shown · add hole card when revealed'
                : `${dealerCards.length} cards — enter next dealer card (S17: stand on 17+)`)),
            dealerBust && (React.createElement("div", { className: "mt-2 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2", style: { background: 'rgba(255,92,92,0.15)', border: '1.5px solid rgba(255,92,92,0.5)', color: '#ff5c5c' } }, "\uD83D\uDCA5 DEALER BUST \u2014 resolving\u2026")),
            dealerHand && dealerHand.dealer_stands && !dealerBust && !dealerBj && (React.createElement("div", { className: "mt-2 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2", style: { background: 'rgba(50,200,120,0.12)', border: '1.5px solid rgba(50,200,120,0.4)', color: '#5eead4' } },
                "\u2713 Dealer stands on ",
                dealerValue,
                dealerSoft ? ' soft' : '',
                " \u2014 comparing hands\u2026")),
            dealerBj && (React.createElement("div", { className: "mt-2 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2", style: { background: 'rgba(255,212,71,0.15)', border: '1.5px solid rgba(255,212,71,0.5)', color: '#ffd447' } }, "\u26A0 DEALER BLACKJACK \u2014 resolving\u2026"))),
        React.createElement("div", null,
            React.createElement("div", { className: "flex items-center gap-2 mb-2" },
                React.createElement("div", { className: "text-[10px] uppercase tracking-widest font-display font-bold", style: { color: '#b8ccdf' } }, "Your Hand"),
                bv !== null && (React.createElement("span", { className: "font-mono text-xs px-2 py-0.5 rounded-full font-bold", style: {
                        background: bj
                            ? 'rgba(255,212,71,0.15)'
                            : bust
                                ? 'rgba(255,92,92,0.15)'
                                : 'rgba(255,255,255,0.08)',
                        border: `1.5px solid ${bj ? 'rgba(255,212,71,0.5)'
                            : bust ? 'rgba(255,92,92,0.5)'
                                : 'rgba(255,255,255,0.2)'}`,
                        color: bj ? '#ffd447' : bust ? '#ff5c5c' : '#ccdaec',
                    } }, bj ? 'BLACKJACK' : bust ? 'BUST' : `${bv}${(playerHand === null || playerHand === void 0 ? void 0 : playerHand.is_soft) ? ' soft' : ''}`)),
                isDoubled && (React.createElement("span", { className: "font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full", style: {
                        background: 'rgba(255,212,71,0.15)',
                        border: '1px solid rgba(255,212,71,0.45)',
                        color: '#ffd447',
                    } }, "\u00D72 DOUBLED"))),
            React.createElement("div", { className: "flex items-center gap-2 flex-wrap", style: { minHeight: 64 } }, ((_m = playerHand === null || playerHand === void 0 ? void 0 : playerHand.cards) === null || _m === void 0 ? void 0 : _m.length) > 0 ? (playerHand.cards.map((c, i) => React.createElement(MiniCard, { key: i, str: c }))) : (React.createElement("span", { className: "text-xs italic", style: { color: '#b8ccdf' } }, "Click cards with \"Player\" selected"))),
            resolvedResult && (() => {
                const meta = resultMeta[resolvedResult];
                return (React.createElement("div", { className: "mt-2 px-3 py-2.5 rounded-lg font-bold flex items-center justify-between", style: {
                        background: meta.bg,
                        border: `1.5px solid ${meta.border}`,
                        color: meta.color,
                        animation: 'fadeIn 0.3s ease',
                    } },
                    React.createElement("div", { className: "flex items-center gap-2" },
                        React.createElement("span", { className: "text-sm" }, meta.label)),
                    React.createElement("div", { className: "text-right" },
                        React.createElement("div", { className: "font-mono text-sm font-extrabold" }, fmt(resolvedProfit)),
                        React.createElement("div", { className: "text-[9px] font-normal opacity-70" }, "auto-resolving\u2026"))));
            })(),
            bust && !resolvedResult && (React.createElement("div", { className: "mt-2 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2", style: { background: 'rgba(255,92,92,0.15)', border: '1.5px solid rgba(255,92,92,0.5)', color: '#ff5c5c' } }, "\uD83D\uDCA5 PLAYER BUST \u2014 resolving\u2026")),
            bj && !resolvedResult && (React.createElement("div", { className: "mt-2 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2", style: { background: 'rgba(255,212,71,0.15)', border: '1.5px solid rgba(255,212,71,0.5)', color: '#ffd447' } }, "\u2B50 BLACKJACK! Pays 3:2 \u2014 waiting for dealer hole card\u2026")),
            !resolvedResult && sideBets && (() => {
                const BET_META = [
                    { key: 'perfect_pairs', icon: '👯', name: 'Perfect Pairs', color: '#b99bff' },
                    { key: 'twenty_one_plus_3', icon: '🃏', name: '21+3', color: '#ffd447' },
                    { key: 'lucky_ladies', icon: '👑', name: 'Lucky Ladies', color: '#ff9a20' },
                ];
                const active = BET_META.filter(b => { var _a; return (_a = sideBets[b.key]) === null || _a === void 0 ? void 0 : _a.recommended; });
                if (active.length === 0)
                    return null;
                return (React.createElement("div", { className: "mt-3 space-y-1.5" },
                    React.createElement("div", { className: "text-[9px] uppercase tracking-widest font-bold", style: { color: '#b8ccdf' } }, "+EV Side Bets"),
                    active.map(({ key, icon, name, color }) => (React.createElement("div", { key: key, className: "flex items-center justify-between px-2.5 py-1.5 rounded-lg", style: { background: `${color}14`, border: `1.5px solid ${color}44` } },
                        React.createElement("div", { className: "flex items-center gap-1.5" },
                            React.createElement("span", { style: { fontSize: '0.85rem' } }, icon),
                            React.createElement("span", { className: "text-xs font-semibold", style: { color } }, name)),
                        React.createElement("span", { className: "font-mono font-bold text-xs", style: { color: '#44e882' } },
                            "+",
                            (sideBets[key].ev || 0).toFixed(1),
                            "% EV"))))));
            })())));
}
function MiniCard({ str }) {
    if (!str)
        return null;
    const suit = str.slice(-1);
    const rank = str.slice(0, -1);
    const isRed = suit === '♥' || suit === '♦';
    return (React.createElement("div", { className: `mini-card ${isRed ? 'red' : 'black'}` },
        React.createElement("span", null, rank),
        React.createElement("span", { className: "card-suit" }, suit)));
}
function MiniCardBack({ label = '?' }) {
    return (React.createElement("div", { className: "mini-card", style: {
            background: 'linear-gradient(135deg, #1e2c48 25%, #26395c 75%)',
            color: '#b8ccdf',
            fontSize: '1.2rem',
            border: '1.5px solid rgba(255,255,255,0.15)',
        } }, label));
}
