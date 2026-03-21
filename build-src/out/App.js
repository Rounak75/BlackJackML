const { useState, useEffect, useRef, useCallback } = React;
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null, stack: null };
    }
    componentDidCatch(err, info) {
        this.setState({ error: err.toString(), stack: info.componentStack });
    }
    render() {
        if (this.state.error) {
            return (React.createElement("div", { style: { padding: 30, fontFamily: 'monospace', background: '#0a0e18', color: '#f0f4ff', minHeight: '100vh' } },
                React.createElement("div", { style: { color: '#ff5c5c', fontSize: 22, marginBottom: 16, fontWeight: 800 } }, "BlackjackML \u2014 Render Error"),
                React.createElement("div", { style: { background: '#1a2236', padding: 16, borderRadius: 8, marginBottom: 16, border: '1px solid rgba(255,92,92,0.4)', color: '#ff9a9a', fontSize: 14, lineHeight: 1.7 } }, this.state.error),
                React.createElement("div", { style: { background: '#111827', padding: 16, borderRadius: 8, color: '#94a7c4', fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto' } }, this.state.stack),
                React.createElement("p", { style: { color: '#ffd447', marginTop: 16, fontSize: 12 } }, "Screenshot this and share it.")));
        }
        return this.props.children;
    }
}
function App() {
    var _a, _b;
    const [gameState, setGameState] = useState(null);
    const [dealTarget, setDealTarget] = useState('player');
    const [lastBet, setLastBet] = useState(10);
    const [customBet, setCustomBet] = useState(10);
    const [currency, setCurrency] = useState({
        code: 'INR', symbol: '₹', name: 'Indian Rupee', isCrypto: false
    });
    const [isDoubled, setIsDoubled] = useState(false);
    const [tookInsurance, setTookInsurance] = useState(false);
    const [scanMode, setScanMode] = useState('manual');
    const socketRef = useRef(null);
    const undoStack = useRef([]);
    const dealTargetRef = useRef('player');
    const setTarget = (t) => { dealTargetRef.current = t; setDealTarget(t); };
    useEffect(() => {
        const socket = io();
        socketRef.current = socket;
        socket.on('state_update', (data) => {
            setGameState(data);
            if (data.betting) {
                setLastBet(data.betting.recommended_bet || 10);
                setCustomBet(prev => prev === lastBet
                    ? (data.betting.recommended_bet || 10)
                    : prev);
            }
        });
        socket.on('notification', (data) => showToast(data.message, data.type || 'info'));
        socket.on('error', (data) => showToast(data.message, 'error'));
        return () => socket.disconnect();
    }, []);
    useEffect(() => {
        const handler = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')
                return;
            if (e.key === 'n' || e.key === 'N')
                handleNewHand();
            if (e.key === 's' || e.key === 'S')
                handleShuffle();
            if (e.key === 'p' || e.key === 'P')
                setTarget('player');
            if (e.key === 'd' || e.key === 'D')
                setTarget('dealer');
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [lastBet]);
    const handleDealCard = useCallback((rank, suit, targetOverride) => {
        var _a;
        const target = targetOverride || dealTargetRef.current;
        undoStack.current.push({ rank, suit, target });
        (_a = socketRef.current) === null || _a === void 0 ? void 0 : _a.emit('deal_card', { rank, suit, target });
    }, []);
    const handleSplit = useCallback(() => {
        var _a;
        (_a = socketRef.current) === null || _a === void 0 ? void 0 : _a.emit('player_split');
    }, []);
    const handleNextSplitHand = useCallback(() => {
        var _a;
        (_a = socketRef.current) === null || _a === void 0 ? void 0 : _a.emit('next_split_hand');
    }, []);
    const handleNewHand = useCallback(() => {
        var _a;
        undoStack.current = [];
        dealTargetRef.current = 'player';
        setDealTarget('player');
        (_a = socketRef.current) === null || _a === void 0 ? void 0 : _a.emit('new_hand');
        showToast('New hand — count continues', 'info');
    }, []);
    const handleShuffle = useCallback(() => {
        var _a, _b;
        const shuffleType = ((_a = document.getElementById('shuffle-type')) === null || _a === void 0 ? void 0 : _a.value) || 'machine';
        undoStack.current = [];
        (_b = socketRef.current) === null || _b === void 0 ? void 0 : _b.emit('shuffle', { type: shuffleType });
    }, []);
    const handleChangeSystem = useCallback((system) => {
        var _a;
        (_a = socketRef.current) === null || _a === void 0 ? void 0 : _a.emit('change_system', { system });
        showToast(`Switched to ${system.replace('_', '-').toUpperCase()}`, 'info');
    }, []);
    const handleRecordResult = useCallback((result, bet, precalcProfit) => {
        var _a, _b;
        const profit = precalcProfit !== undefined
            ? precalcProfit
            : result === 'win' ? bet
                : result === 'loss' ? -bet
                    : 0;
        (_a = socketRef.current) === null || _a === void 0 ? void 0 : _a.emit('record_result', { bet, profit });
        (_b = socketRef.current) === null || _b === void 0 ? void 0 : _b.emit('new_hand');
        undoStack.current = [];
        dealTargetRef.current = 'player';
        setDealTarget('player');
        setIsDoubled(false);
        setTookInsurance(false);
        showToast(`${result.toUpperCase()} — ${formatMoney(profit)}`, result === 'win' ? 'success' : result === 'loss' ? 'error' : 'info');
    }, []);
    const handleUndo = useCallback(() => {
        var _a;
        if (undoStack.current.length === 0) {
            showToast('Nothing to undo', 'warning');
            return;
        }
        const replay = [...undoStack.current.slice(0, -1)];
        const removed = undoStack.current[undoStack.current.length - 1];
        undoStack.current = [];
        dealTargetRef.current = 'player';
        setDealTarget('player');
        (_a = socketRef.current) === null || _a === void 0 ? void 0 : _a.emit('new_hand');
        replay.forEach((c, i) => {
            setTimeout(() => {
                var _a;
                undoStack.current.push(c);
                (_a = socketRef.current) === null || _a === void 0 ? void 0 : _a.emit('deal_card', { rank: c.rank, suit: c.suit, target: c.target });
            }, 80 * i + 120);
        });
        showToast(`Undid ${removed.rank} → ${removed.target}`, 'info');
    }, []);
    const count = gameState === null || gameState === void 0 ? void 0 : gameState.count;
    const shoe = gameState === null || gameState === void 0 ? void 0 : gameState.shoe;
    const rec = gameState === null || gameState === void 0 ? void 0 : gameState.recommendation;
    const betting = gameState === null || gameState === void 0 ? void 0 : gameState.betting;
    const sideBets = gameState === null || gameState === void 0 ? void 0 : gameState.side_bets;
    const tracker = gameState === null || gameState === void 0 ? void 0 : gameState.shuffle_tracker;
    const session = gameState === null || gameState === void 0 ? void 0 : gameState.session;
    const playerHand = gameState === null || gameState === void 0 ? void 0 : gameState.player_hand;
    const dealerUp = gameState === null || gameState === void 0 ? void 0 : gameState.dealer_upcard;
    const dealerHand = gameState === null || gameState === void 0 ? void 0 : gameState.dealer_hand;
    const history = gameState === null || gameState === void 0 ? void 0 : gameState.count_history;
    const sideCounts = gameState === null || gameState === void 0 ? void 0 : gameState.side_counts;
    const casinoRisk = gameState === null || gameState === void 0 ? void 0 : gameState.casino_risk;
    const splitHands = (_a = gameState === null || gameState === void 0 ? void 0 : gameState.split_hands) !== null && _a !== void 0 ? _a : [];
    const activeHandIdx = (_b = gameState === null || gameState === void 0 ? void 0 : gameState.active_hand_index) !== null && _b !== void 0 ? _b : 0;
    const insurance = gameState === null || gameState === void 0 ? void 0 : gameState.insurance;
    const dealerMustDraw = !!(dealerHand && (dealerHand.must_draw !== undefined
        ? dealerHand.must_draw
        : (dealerHand.card_count >= 2
            && !dealerHand.is_bust
            && !dealerHand.is_blackjack
            && dealerHand.value < 17)));
    const dealerStandsFlag = !!(dealerHand && (dealerHand.dealer_stands !== undefined
        ? dealerHand.dealer_stands
        : (dealerHand.card_count >= 2
            && !dealerHand.is_bust
            && dealerHand.value >= 17)));
    useEffect(() => {
        if (dealerMustDraw)
            setTarget('dealer');
    }, [dealerMustDraw]);
    if (!gameState) {
        return (React.createElement("div", { className: "flex items-center justify-center min-h-screen", style: { background: '#0a0e18' } },
            React.createElement("div", { className: "text-center" },
                React.createElement("div", { className: "text-6xl mb-5 font-display font-extrabold", style: { color: '#ffd447', filter: 'drop-shadow(0 0 20px rgba(255,212,71,0.6))' } }, "\u2660"),
                React.createElement("div", { className: "text-base font-semibold mb-2", style: { color: '#ccdaec' } }, "Connecting to BlackjackML server\u2026"),
                React.createElement("div", { className: "text-xs", style: { color: '#b8ccdf' } },
                    "Make sure",
                    ' ',
                    React.createElement("code", { style: { background: '#1a2236', padding: '2px 6px', borderRadius: 4, color: '#ffd447' } }, "python main.py web"),
                    ' ',
                    "is running"))));
    }
    return (React.createElement("div", { className: "min-h-screen font-body", style: { background: '#0a0e18', color: '#f0f4ff' } },
        React.createElement(TopBar, { count: count, onNewHand: handleNewHand, onShuffle: handleShuffle, onChangeSystem: handleChangeSystem }),
        React.createElement("div", { className: "dashboard-grid", style: {
                display: 'grid',
                gridTemplateColumns: '280px 1fr 280px',
                gap: 10, padding: 10, alignItems: 'start',
            } },
            React.createElement("div", { className: "flex flex-col gap-2.5" },
                React.createElement(ActionPanel, { recommendation: rec, count: count }),
                React.createElement(BettingPanel, { betting: betting, count: count, lastBet: lastBet, onRecordResult: handleRecordResult, currency: currency, onCurrencyChange: setCurrency, customBet: customBet, onCustomBetChange: setCustomBet, playerHand: playerHand, dealerHand: dealerHand, insurance: insurance, isDoubled: isDoubled, onIsDoubledChange: setIsDoubled, tookInsurance: tookInsurance, onTookInsuranceChange: setTookInsurance }),
                React.createElement(StrategyRefTable, { playerHand: playerHand, dealerUpcard: dealerUp })),
            React.createElement("div", { className: "flex flex-col gap-2.5" },
                React.createElement(HandDisplay, { playerHand: playerHand, dealerUpcard: dealerUp, dealerHand: dealerHand, dealerMustDraw: dealerMustDraw, sideBets: sideBets, insurance: insurance, isDoubled: isDoubled, tookInsurance: tookInsurance, onInsuranceChange: setTookInsurance, activeBet: customBet, currency: currency }),
                splitHands && splitHands.length > 0 && (React.createElement(SplitHandPanel, { splitHands: splitHands, activeHandIndex: activeHandIdx, dealerUpcard: dealerUp, socket: socketRef.current, onNextHand: () => { } })),
                React.createElement(CardGrid, { target: dealTarget, onTargetChange: setTarget, remainingByRank: shoe === null || shoe === void 0 ? void 0 : shoe.remaining_by_rank, onDealCard: handleDealCard, onUndo: handleUndo, onSplit: handleSplit, canSplit: !!((playerHand === null || playerHand === void 0 ? void 0 : playerHand.can_split) && splitHands.length === 0), dealerMustDraw: dealerMustDraw, dealerStands: dealerStandsFlag }),
                React.createElement(CenterToolbar, { recommendation: rec, count: count, playerHand: playerHand, dealerUpcard: dealerUp, betting: betting, history: history, session: session, currency: currency, sideCounts: sideCounts, casinoRisk: casinoRisk }),
                React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
                    React.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'stretch' } },
                        React.createElement(SideBetPanel, { sideBets: sideBets }),
                        React.createElement(SessionStats, { session: session, currency: currency })),
                    React.createElement(CountHistoryPanel, { history: history }))),
            React.createElement("div", { className: "panel-right flex flex-col gap-2.5" },
                React.createElement(LiveOverlayPanel, { socket: socketRef.current, count: gameState === null || gameState === void 0 ? void 0 : gameState.count, scanMode: scanMode, onSetMode: setScanMode, onDealCard: handleDealCard, dealTarget: dealTarget }),
                React.createElement(ShoePanel, { shoe: shoe }),
                React.createElement(EdgeMeter, { count: count }),
                React.createElement(I18Panel, { count: count }),
                React.createElement(ShuffleTrackerPanel, { tracker: tracker }),
                React.createElement(SideCountPanel, { sideCounts: sideCounts, count: count }),
                React.createElement(CasinoRiskMeter, { casinoRisk: casinoRisk }),
                React.createElement(StopAlerts, { session: session, currency: currency }))),
        React.createElement("div", { className: "shortcut-hint" },
            React.createElement("kbd", null, "N"),
            " ",
            React.createElement("span", null, "New Hand"),
            React.createElement("span", { className: "sep" }, "\u00B7"),
            React.createElement("kbd", null, "S"),
            " ",
            React.createElement("span", null, "Real Shuffle"),
            React.createElement("span", { className: "sep" }, "\u00B7"),
            React.createElement("kbd", null, "P"),
            " ",
            React.createElement("span", null, "Player"),
            React.createElement("span", { className: "sep" }, "\u00B7"),
            React.createElement("kbd", null, "D"),
            " ",
            React.createElement("span", null, "Dealer"))));
}
function mountApp() {
    var container = document.getElementById('root');
    if (!container) {
        setTimeout(mountApp, 10);
        return;
    }
    ReactDOM.createRoot(container).render(React.createElement(ErrorBoundary, null,
        React.createElement(App, null)));
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountApp);
}
else {
    mountApp();
}
