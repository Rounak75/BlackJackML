const CURRENCIES = [
    { code: 'USD', symbol: '$', name: 'US Dollar', isCrypto: false },
    { code: 'EUR', symbol: '€', name: 'Euro', isCrypto: false },
    { code: 'GBP', symbol: '£', name: 'British Pound', isCrypto: false },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen', isCrypto: false },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee', isCrypto: false },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', isCrypto: false },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', isCrypto: false },
    { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc', isCrypto: false },
    { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', isCrypto: false },
    { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', isCrypto: false },
    { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal', isCrypto: false },
    { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', isCrypto: false },
    { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', isCrypto: false },
    { code: 'KRW', symbol: '₩', name: 'South Korean Won', isCrypto: false },
    { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', isCrypto: false },
    { code: 'MXN', symbol: 'Mex$', name: 'Mexican Peso', isCrypto: false },
    { code: 'ZAR', symbol: 'R', name: 'South African Rand', isCrypto: false },
    { code: 'TRY', symbol: '₺', name: 'Turkish Lira', isCrypto: false },
    { code: 'RUB', symbol: '₽', name: 'Russian Ruble', isCrypto: false },
    { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', isCrypto: false },
    { code: 'BTC', symbol: '₿', name: 'Bitcoin', isCrypto: true, decimals: 5 },
    { code: 'ETH', symbol: 'Ξ', name: 'Ethereum', isCrypto: true, decimals: 4 },
    { code: 'BNB', symbol: 'BNB', name: 'BNB', isCrypto: true, decimals: 3 },
    { code: 'SOL', symbol: 'SOL', name: 'Solana', isCrypto: true, decimals: 3 },
    { code: 'XRP', symbol: 'XRP', name: 'XRP', isCrypto: true, decimals: 2 },
    { code: 'ADA', symbol: 'ADA', name: 'Cardano', isCrypto: true, decimals: 2 },
    { code: 'DOGE', symbol: 'Ð', name: 'Dogecoin', isCrypto: true, decimals: 1 },
    { code: 'DOT', symbol: 'DOT', name: 'Polkadot', isCrypto: true, decimals: 3 },
    { code: 'AVAX', symbol: 'AVAX', name: 'Avalanche', isCrypto: true, decimals: 3 },
    { code: 'MATIC', symbol: 'MATIC', name: 'Polygon', isCrypto: true, decimals: 2 },
];
function BettingPanel({ betting, count, lastBet, onRecordResult, currency, onCurrencyChange, customBet, onCustomBetChange, playerHand, dealerHand, insurance, isDoubled, onIsDoubledChange, tookInsurance, onTookInsuranceChange, }) {
    var _a, _b;
    const { useState, useRef, useEffect } = React;
    const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
    const [currencySearch, setCurrencySearch] = useState('');
    const autoFiredRef = useRef(false);
    const inputRef = useRef(null);
    const cur = currency || CURRENCIES[0];
    const adv = betting ? (betting.player_advantage || 0) : 0;
    const activeBet = customBet || (betting ? betting.recommended_bet : 10);
    const dec = cur.decimals || 2;
    const effectiveBet = isDoubled ? activeBet * 2 : activeBet;
    const fmtBet = (n) => cur.isCrypto
        ? Number(n).toFixed(dec)
        : Number(n).toFixed(2);
    const filtered = currencySearch
        ? CURRENCIES.filter(c => c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
            c.name.toLowerCase().includes(currencySearch.toLowerCase()))
        : CURRENCIES;
    const fiat = filtered.filter(c => !c.isCrypto);
    const crypto = filtered.filter(c => c.isCrypto);
    useEffect(() => {
        var _a, _b, _c;
        if (!playerHand || !dealerHand)
            return;
        const pCards = (_b = (_a = playerHand.cards) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
        const dCards = (_c = dealerHand.card_count) !== null && _c !== void 0 ? _c : 0;
        if (pCards < 2 || dCards < 2) {
            if (pCards === 0)
                autoFiredRef.current = false;
            return;
        }
        if (autoFiredRef.current)
            return;
        const playerBj = playerHand.is_blackjack;
        const playerBust = playerHand.is_bust;
        const playerVal = playerHand.value;
        const dealerBj = dealerHand.is_blackjack;
        const dealerBust = dealerHand.is_bust;
        const dealerVal = dealerHand.value;
        const dealerStands = dealerHand.dealer_stands;
        const insuranceAdj = () => {
            if (!tookInsurance)
                return 0;
            const halfBet = activeBet * 0.5;
            return dealerBj ? halfBet * 2 : -halfBet;
        };
        let result = null;
        let profit = 0;
        if (playerBust) {
            result = 'loss';
            profit = -effectiveBet + insuranceAdj();
        }
        else if (playerBj && dealerBj) {
            result = 'push';
            profit = 0 + insuranceAdj();
        }
        else if (playerBj && !dealerBj) {
            result = 'win';
            profit = activeBet * 1.5 + insuranceAdj();
        }
        else if (dealerBj && !playerBj) {
            result = 'loss';
            profit = -effectiveBet + insuranceAdj();
        }
        else if (dealerBust) {
            result = 'win';
            profit = effectiveBet + insuranceAdj();
        }
        else if (dealerStands) {
            if (playerVal > dealerVal) {
                result = 'win';
                profit = effectiveBet + insuranceAdj();
            }
            else if (playerVal < dealerVal) {
                result = 'loss';
                profit = -effectiveBet + insuranceAdj();
            }
            else {
                result = 'push';
                profit = 0 + insuranceAdj();
            }
        }
        if (result === null)
            return;
        autoFiredRef.current = true;
        setTimeout(() => {
            onRecordResult(result, effectiveBet, profit);
        }, 900);
    }, [playerHand, dealerHand]);
    const tc = (_a = count === null || count === void 0 ? void 0 : count.true) !== null && _a !== void 0 ? _a : 0;
    const session = (_b = betting === null || betting === void 0 ? void 0 : betting.session_profit) !== null && _b !== void 0 ? _b : 0;
    const showCashout = tc < -1 && session > 0;
    if (!betting) {
        return (React.createElement(Widget, { title: "Bet Sizing", badge: "KELLY" },
            React.createElement("div", { className: "text-xs", style: { color: '#b8ccdf' } }, "Waiting for count data\u2026")));
    }
    return (React.createElement(Widget, { title: "Bet Sizing", badge: "KELLY", badgeColor: "text-jade" },
        showCashout && (React.createElement("div", { className: "mb-3 px-3 py-2 rounded-lg text-xs font-semibold flex items-start gap-2", style: {
                background: 'rgba(255,212,71,0.1)',
                border: '1.5px solid rgba(255,212,71,0.45)',
                color: '#ffd447',
            } },
            React.createElement("span", { style: { fontSize: '1rem', flexShrink: 0 } }, "\uD83D\uDCB0"),
            React.createElement("div", null,
                React.createElement("div", { className: "font-bold mb-0.5" }, "Cashout Suggested"),
                React.createElement("div", { className: "font-normal", style: { color: '#ccdaec' } },
                    "Count has turned negative (TC ",
                    tc.toFixed(1),
                    ") while you're ahead. Consider leaving the table or dropping to minimum bet.")))),
        React.createElement("div", { className: "relative mb-3" },
            React.createElement("button", { onClick: () => setShowCurrencyPicker(p => !p), "aria-label": `Currency: ${cur.code} — ${cur.name}. Click to change`, "aria-expanded": showCurrencyPicker, className: "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold", style: {
                    background: '#111827',
                    border: '1.5px solid rgba(255,255,255,0.15)',
                    color: '#f0f4ff',
                } },
                React.createElement("span", { style: { color: cur.isCrypto ? '#ffd447' : '#6aafff' } },
                    cur.isCrypto ? '🔐' : '💱',
                    " ",
                    cur.code,
                    " \u2014 ",
                    cur.name),
                React.createElement("span", { style: { color: '#b8ccdf' } }, showCurrencyPicker ? '▲' : '▼')),
            showCurrencyPicker && (React.createElement("div", { className: "absolute z-50 w-full mt-1 rounded-xl overflow-hidden", style: {
                    background: '#1a2236',
                    border: '1.5px solid rgba(255,255,255,0.18)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    maxHeight: 280,
                    display: 'flex',
                    flexDirection: 'column',
                } },
                React.createElement("div", { className: "p-2" },
                    React.createElement("input", { autoFocus: true, value: currencySearch, onChange: e => setCurrencySearch(e.target.value), "aria-label": "Search currencies and cryptocurrencies", placeholder: "Search currency or crypto\u2026", className: "w-full rounded-lg px-3 py-1.5 text-xs", style: {
                            background: '#111827',
                            border: '1px solid rgba(255,255,255,0.15)',
                            color: '#f0f4ff',
                            outline: 'none',
                        } })),
                React.createElement("div", { style: { overflowY: 'auto', flex: 1 } },
                    fiat.length > 0 && (React.createElement(React.Fragment, null,
                        React.createElement("div", { className: "px-3 py-1 text-[9px] uppercase tracking-widest font-bold", style: { color: '#6aafff' } }, "\uD83D\uDCB1 Fiat Currencies"),
                        fiat.map(c => (React.createElement("button", { key: c.code, "aria-label": `Select currency: ${c.name} (${c.code})`, "aria-pressed": cur.code === c.code, onClick: () => { onCurrencyChange(c); setShowCurrencyPicker(false); setCurrencySearch(''); }, className: "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/5", style: { color: cur.code === c.code ? '#6aafff' : '#ccdaec', textAlign: 'left' } },
                            React.createElement("span", { className: "font-mono font-bold w-10", style: { color: '#6aafff' } }, c.code),
                            React.createElement("span", { style: { color: '#b8ccdf' } }, c.symbol),
                            React.createElement("span", null, c.name),
                            cur.code === c.code && React.createElement("span", { style: { marginLeft: 'auto', color: '#6aafff' } }, "\u2713")))))),
                    crypto.length > 0 && (React.createElement(React.Fragment, null,
                        React.createElement("div", { className: "px-3 py-1 text-[9px] uppercase tracking-widest font-bold mt-1", style: { color: '#ffd447' } }, "\uD83D\uDD10 Cryptocurrency"),
                        crypto.map(c => (React.createElement("button", { key: c.code, "aria-label": `Select cryptocurrency: ${c.name} (${c.code})`, "aria-pressed": cur.code === c.code, onClick: () => { onCurrencyChange(c); setShowCurrencyPicker(false); setCurrencySearch(''); }, className: "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/5", style: { color: cur.code === c.code ? '#ffd447' : '#ccdaec', textAlign: 'left' } },
                            React.createElement("span", { className: "font-mono font-bold w-10", style: { color: '#ffd447' } }, c.code),
                            React.createElement("span", { style: { color: '#b8ccdf' } }, c.symbol),
                            React.createElement("span", null, c.name),
                            cur.code === c.code && React.createElement("span", { style: { marginLeft: 'auto', color: '#ffd447' } }, "\u2713")))))))))),
        React.createElement("div", { className: "mb-3" },
            React.createElement("div", { className: "text-[10px] uppercase tracking-widest font-bold mb-1", style: { color: '#b8ccdf' } }, "Your Bet"),
            React.createElement("div", { className: "flex items-center gap-2" },
                React.createElement("div", { className: "flex items-center flex-1 rounded-lg overflow-hidden", style: { background: '#111827', border: '1.5px solid rgba(68,232,130,0.4)' } },
                    React.createElement("span", { className: "px-2 font-mono font-bold text-sm", style: { color: '#44e882' } }, cur.symbol),
                    React.createElement("input", { ref: inputRef, type: "number", "aria-label": `Bet amount in ${cur.code}`, value: activeBet, min: "0", step: cur.isCrypto ? Math.pow(10, -dec) : 1, onChange: e => onCustomBetChange(parseFloat(e.target.value) || 0), className: "flex-1 py-2 text-sm font-mono font-bold bg-transparent outline-none", style: { color: '#44e882', minWidth: 0 } })),
                [0.5, 1, 2, 5].map(mult => (React.createElement("button", { key: mult, "aria-label": `Multiply bet by ${mult}`, onClick: () => onCustomBetChange(parseFloat((activeBet * mult).toFixed(dec))), className: "text-[10px] px-2 py-1.5 rounded-md font-semibold", style: {
                        background: '#212d45',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#ccdaec',
                    } },
                    "\u00D7",
                    mult)))),
            React.createElement("div", { className: "text-[10px] mt-1", style: { color: '#b8ccdf' } },
                "Recommended: ",
                cur.symbol,
                fmtBet(betting.recommended_bet),
                " \u00B7 ",
                betting.units,
                " unit",
                betting.units !== 1 ? 's' : '')),
        React.createElement("div", { className: "flex gap-2 mb-3" },
            React.createElement("button", { onClick: () => onIsDoubledChange(!isDoubled), "aria-pressed": isDoubled, "aria-label": isDoubled ? "Undo double down" : "Mark hand as doubled down", className: "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all", style: {
                    background: isDoubled ? 'rgba(255,212,71,0.15)' : '#111827',
                    border: `1.5px solid ${isDoubled ? 'rgba(255,212,71,0.6)' : 'rgba(255,255,255,0.12)'}`,
                    color: isDoubled ? '#ffd447' : '#b8ccdf',
                } },
                React.createElement("span", null, "\u00D72"),
                React.createElement("span", null, isDoubled ? 'DOUBLED' : 'Double Down?')),
            (insurance === null || insurance === void 0 ? void 0 : insurance.available) ? (React.createElement("button", { onClick: () => onTookInsuranceChange(!tookInsurance), "aria-pressed": tookInsurance, "aria-label": tookInsurance ? "Undo insurance bet" : "Mark insurance bet as placed", className: "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold transition-all", style: {
                    fontSize: 13,
                    background: tookInsurance
                        ? 'rgba(106,175,255,0.18)'
                        : 'rgba(255,212,71,0.10)',
                    border: `2px solid ${tookInsurance
                        ? 'rgba(106,175,255,0.7)'
                        : 'rgba(255,212,71,0.5)'}`,
                    color: tookInsurance ? '#6aafff' : '#ffd447',
                    boxShadow: tookInsurance
                        ? '0 0 10px rgba(106,175,255,0.25)'
                        : '0 0 10px rgba(255,212,71,0.2)',
                } },
                React.createElement("span", { style: { fontSize: 16 } }, "\uD83D\uDEE1"),
                React.createElement("span", null, tookInsurance ? '✓ INSURED' : 'Insurance?'))) : (React.createElement("div", { className: "flex-1" }))),
        isDoubled && (React.createElement("div", { className: "mb-3 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold text-center", style: {
                background: 'rgba(255,212,71,0.08)',
                border: '1px solid rgba(255,212,71,0.25)',
                color: '#ffd447',
            } },
            "Doubled down \u2014 effective bet: ",
            cur.symbol,
            fmtBet(effectiveBet))),
        tookInsurance && (insurance === null || insurance === void 0 ? void 0 : insurance.available) && (React.createElement("div", { className: "mb-3 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold text-center", style: {
                background: 'rgba(106,175,255,0.08)',
                border: '1px solid rgba(106,175,255,0.25)',
                color: '#6aafff',
            } },
            "Insurance stake: ",
            cur.symbol,
            fmtBet(activeBet * 0.5),
            " \u00B7 pays ",
            cur.symbol,
            fmtBet(activeBet),
            " if dealer BJ")),
        React.createElement("div", { className: "text-xs font-medium mb-3", style: { color: '#ccdaec' } }, betting.action || '—'),
        React.createElement("div", { style: { borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 } },
            React.createElement(KV, { label: "Player Edge", value: `${adv >= 0 ? '+' : ''}${adv}%`, valueClass: adv > 0 ? 'text-jade' : 'text-ruby' }),
            React.createElement(KV, { label: "Kelly Bet", value: `${cur.symbol}${fmtBet(betting.kelly_bet)}` }),
            React.createElement(KV, { label: "Spread Bet", value: `${cur.symbol}${fmtBet(betting.spread_bet)}` }),
            React.createElement(KV, { label: "Bankroll", value: `${cur.symbol}${Number(betting.bankroll || 0).toLocaleString()}` }),
            React.createElement(KV, { label: "Risk of Ruin", value: `${betting.risk_of_ruin}%` })),
        React.createElement("div", { style: { borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10, marginTop: 10 } },
            React.createElement("div", { className: "flex items-center justify-between mb-2" },
                React.createElement("div", { className: "text-[11px] uppercase tracking-widest font-display font-bold", style: { color: '#ccdaec' } }, "Manual override:"),
                React.createElement("div", { className: "text-[9px]", style: { color: '#ccdaec' } }, "Auto-resolves when outcome is known")),
            React.createElement("div", { className: "flex gap-2" }, [
                { label: '🏆 WIN', result: 'win', color: '#44e882', bg: 'rgba(68,232,130,0.1)', border: 'rgba(68,232,130,0.4)' },
                { label: '🤝 PUSH', result: 'push', color: '#6aafff', bg: 'rgba(106,175,255,0.1)', border: 'rgba(106,175,255,0.4)' },
                { label: '💀 LOSS', result: 'loss', color: '#ff5c5c', bg: 'rgba(255,92,92,0.1)', border: 'rgba(255,92,92,0.4)' },
                { label: '🏳 SURR', result: 'surrender', color: '#ff9a20', bg: 'rgba(255,154,32,0.1)', border: 'rgba(255,154,32,0.4)' },
            ].map(({ label, result, color, bg, border }) => (React.createElement("button", { key: result, "aria-label": `Record hand result as ${result} — bet ${cur.symbol}${fmtBet(effectiveBet)}`, onClick: () => {
                    let profit;
                    if (result === 'win')
                        profit = effectiveBet;
                    else if (result === 'push')
                        profit = 0;
                    else if (result === 'loss')
                        profit = -effectiveBet;
                    else if (result === 'surrender')
                        profit = -(activeBet * 0.5);
                    if (tookInsurance && (insurance === null || insurance === void 0 ? void 0 : insurance.available)) {
                        const halfBet = activeBet * 0.5;
                        const dealerBj = dealerHand === null || dealerHand === void 0 ? void 0 : dealerHand.is_blackjack;
                        profit += dealerBj ? halfBet * 2 : -halfBet;
                    }
                    onRecordResult(result === 'surrender' ? 'loss' : result, effectiveBet, profit);
                }, className: "flex-1 rounded-lg py-2 text-[11px] font-mono font-bold transition-all", style: { color, background: bg, border: `1.5px solid ${border}` }, onMouseEnter: e => { e.currentTarget.style.background = bg.replace('0.1', '0.2'); }, onMouseLeave: e => { e.currentTarget.style.background = bg; } }, label)))),
            React.createElement("div", { className: "mt-2 text-center text-[10px] font-mono", style: { color: '#c8d4e8', lineHeight: 1.8 } },
                React.createElement("div", null,
                    "Base ",
                    cur.symbol,
                    fmtBet(activeBet),
                    isDoubled && React.createElement("span", { style: { color: '#ffd447' } },
                        " \u2192 doubled ",
                        cur.symbol,
                        fmtBet(effectiveBet)),
                    ' ',
                    "\u00B7 win = ",
                    React.createElement("span", { style: { color: '#44e882' } },
                        "+",
                        cur.symbol,
                        fmtBet(effectiveBet))),
                React.createElement("div", null,
                    "loss = ",
                    React.createElement("span", { style: { color: '#ff5c5c' } },
                        "-",
                        cur.symbol,
                        fmtBet(effectiveBet)))))));
}
