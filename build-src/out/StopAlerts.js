function StopAlerts({ session, currency }) {
    var _a, _b, _c;
    const { useState, useEffect, useRef } = React;
    const profit = (_a = session === null || session === void 0 ? void 0 : session.total_profit) !== null && _a !== void 0 ? _a : 0;
    const hands = (_b = session === null || session === void 0 ? void 0 : session.hands_played) !== null && _b !== void 0 ? _b : 0;
    const sym = (_c = currency === null || currency === void 0 ? void 0 : currency.symbol) !== null && _c !== void 0 ? _c : '₹';
    const [stopLoss, setStopLoss] = useState(-5000);
    const [stopWin, setStopWin] = useState(3000);
    const [snoozedAt, setSnoozedAt] = useState(null);
    const [dismissed, setDismissed] = useState({ loss: false, win: false });
    const [editing, setEditing] = useState(false);
    const [tempLoss, setTempLoss] = useState(-5000);
    const [tempWin, setTempWin] = useState(3000);
    const alertedRef = useRef({ loss: false, win: false });
    const playAlert = (type) => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = type === 'loss' ? 220 : 660;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.4, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.8);
        }
        catch (e) { }
    };
    const snoozeActive = snoozedAt !== null && (hands - snoozedAt) < 10;
    const lossHit = profit <= stopLoss;
    const winHit = profit >= stopWin;
    useEffect(() => {
        if (lossHit && !alertedRef.current.loss && !dismissed.loss) {
            alertedRef.current.loss = true;
            if (!snoozeActive)
                playAlert('loss');
        }
        if (winHit && !alertedRef.current.win && !dismissed.win) {
            alertedRef.current.win = true;
            if (!snoozeActive)
                playAlert('win');
        }
        if (!lossHit)
            alertedRef.current.loss = false;
        if (!winHit)
            alertedRef.current.win = false;
    }, [lossHit, winHit]);
    const snooze = () => { setSnoozedAt(hands); };
    const dismiss = (type) => setDismissed(d => ({ ...d, [type]: true }));
    const lossRange = Math.abs(stopLoss);
    const winRange = stopWin;
    const lossFill = Math.min(1, Math.max(0, (profit - stopLoss) / lossRange));
    const winFill = Math.min(1, Math.max(0, profit / winRange));
    const showLossAlert = lossHit && !dismissed.loss && !snoozeActive;
    const showWinAlert = winHit && !dismissed.win && !snoozeActive;
    return (React.createElement(Widget, { title: "Stop Alerts", badge: showLossAlert || showWinAlert ? '⚠ TRIGGERED' : 'ARMED' },
        showLossAlert && (React.createElement("div", { style: {
                padding: '10px 12px', borderRadius: 8, marginBottom: 8,
                background: 'rgba(255,92,92,0.15)', border: '2px solid rgba(255,92,92,0.6)',
                animation: 'live-pulse 1s ease-in-out infinite',
            } },
            React.createElement("div", { style: { fontSize: 13, fontWeight: 900, color: '#ff5c5c', marginBottom: 3 } }, "\uD83D\uDED1 STOP-LOSS HIT"),
            React.createElement("div", { style: { fontSize: 10, color: '#ffaaaa', marginBottom: 8 } },
                "You're down ",
                sym,
                Math.abs(profit).toLocaleString(),
                " \u2014 limit was ",
                sym,
                Math.abs(stopLoss).toLocaleString(),
                ". Stop playing now."),
            React.createElement("div", { style: { display: 'flex', gap: 6 } },
                React.createElement("button", { onClick: snooze, "aria-label": "Snooze stop-loss alert for 10 hands", style: {
                        flex: 1, padding: '5px', fontSize: 9, borderRadius: 5, cursor: 'pointer',
                        background: 'rgba(255,92,92,0.2)', border: '1px solid rgba(255,92,92,0.4)',
                        color: '#ff5c5c',
                    } }, "Snooze 10 hands"),
                React.createElement("button", { onClick: () => dismiss('loss'), "aria-label": "Dismiss stop-loss alert", style: {
                        flex: 1, padding: '5px', fontSize: 9, borderRadius: 5, cursor: 'pointer',
                        background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                        color: '#94a7c4',
                    } }, "Dismiss")))),
        showWinAlert && (React.createElement("div", { style: {
                padding: '10px 12px', borderRadius: 8, marginBottom: 8,
                background: 'rgba(68,232,130,0.12)', border: '2px solid rgba(68,232,130,0.5)',
            } },
            React.createElement("div", { style: { fontSize: 13, fontWeight: 900, color: '#44e882', marginBottom: 3 } }, "\uD83C\uDFC6 STOP-WIN HIT"),
            React.createElement("div", { style: { fontSize: 10, color: '#a0eec0', marginBottom: 8 } },
                "You're up ",
                sym,
                profit.toLocaleString(),
                " \u2014 target was ",
                sym,
                stopWin.toLocaleString(),
                ". Lock in your profit."),
            React.createElement("div", { style: { display: 'flex', gap: 6 } },
                React.createElement("button", { onClick: snooze, "aria-label": "Continue playing for 10 more hands", style: {
                        flex: 1, padding: '5px', fontSize: 9, borderRadius: 5, cursor: 'pointer',
                        background: 'rgba(68,232,130,0.15)', border: '1px solid rgba(68,232,130,0.4)',
                        color: '#44e882',
                    } }, "Continue 10 more hands"),
                React.createElement("button", { onClick: () => dismiss('win'), "aria-label": "Dismiss stop-win alert", style: {
                        flex: 1, padding: '5px', fontSize: 9, borderRadius: 5, cursor: 'pointer',
                        background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                        color: '#94a7c4',
                    } }, "Dismiss")))),
        React.createElement("div", { style: { marginBottom: 10 } },
            React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 } },
                React.createElement("span", { style: { fontSize: 9, color: '#94a7c4', textTransform: 'uppercase', letterSpacing: '0.07em' } }, "Session P&L"),
                React.createElement("span", { style: {
                        fontSize: 16, fontWeight: 800, fontFamily: 'DM Mono,monospace',
                        color: profit >= 0 ? '#44e882' : '#ff5c5c',
                    } },
                    profit >= 0 ? '+' : '',
                    sym,
                    Math.abs(profit).toLocaleString())),
            React.createElement("div", { style: { marginBottom: 6 } },
                React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#94a7c4', marginBottom: 2 } },
                    React.createElement("span", null,
                        "Stop-Loss: ",
                        sym,
                        Math.abs(stopLoss).toLocaleString()),
                    React.createElement("span", null, lossHit ? '❌ HIT' : `${sym}${Math.abs(profit - stopLoss).toLocaleString()} buffer`)),
                React.createElement("div", { style: { height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)' } },
                    React.createElement("div", { style: {
                            height: '100%', borderRadius: 2,
                            width: `${lossFill * 100}%`,
                            background: profit < 0 ? '#ff5c5c' : '#44e882',
                            transition: 'width 0.4s ease',
                        } }))),
            React.createElement("div", null,
                React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#94a7c4', marginBottom: 2 } },
                    React.createElement("span", null,
                        "Stop-Win: ",
                        sym,
                        stopWin.toLocaleString()),
                    React.createElement("span", null, winHit ? '✅ HIT' : `${sym}${Math.max(0, stopWin - profit).toLocaleString()} to target`)),
                React.createElement("div", { style: { height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)' } },
                    React.createElement("div", { style: {
                            height: '100%', borderRadius: 2,
                            width: `${winFill * 100}%`,
                            background: 'linear-gradient(90deg, #44e882, #ffd447)',
                            transition: 'width 0.4s ease',
                        } })))),
        !editing ? (React.createElement("button", { onClick: () => { setTempLoss(stopLoss); setTempWin(stopWin); setEditing(true); }, "aria-label": "Edit stop-loss and stop-win limits", style: {
                width: '100%', padding: '5px', fontSize: 9, borderRadius: 5, cursor: 'pointer',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                color: '#94a7c4',
            } }, "\u2699 Set limits")) : (React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            [
                { label: 'Stop-Loss', val: tempLoss, set: setTempLoss, min: true },
                { label: 'Stop-Win', val: tempWin, set: setTempWin, min: false },
            ].map(({ label: l, val, set, min: isNeg }) => (React.createElement("div", { key: l },
                React.createElement("div", { style: { fontSize: 8, color: '#94a7c4', marginBottom: 2 } },
                    l,
                    " (",
                    sym,
                    ")"),
                React.createElement("input", { type: "number", "aria-label": l, value: isNeg ? Math.abs(val) : val, onChange: e => set(isNeg ? -(parseFloat(e.target.value) || 0) : (parseFloat(e.target.value) || 0)), style: {
                        width: '100%', padding: '5px 8px', fontSize: 11, borderRadius: 5,
                        background: '#1a2236', border: '1px solid rgba(255,255,255,0.15)',
                        color: '#f0f4ff', fontFamily: 'DM Mono,monospace',
                    } })))),
            React.createElement("div", { style: { display: 'flex', gap: 6 } },
                React.createElement("button", { onClick: () => { setStopLoss(tempLoss); setStopWin(tempWin); setEditing(false); setDismissed({ loss: false, win: false }); }, "aria-label": "Save limits", style: { flex: 2, padding: '5px', fontSize: 9, borderRadius: 5, cursor: 'pointer',
                        background: 'rgba(68,232,130,0.12)', border: '1px solid rgba(68,232,130,0.3)', color: '#44e882' } }, "Save"),
                React.createElement("button", { onClick: () => setEditing(false), "aria-label": "Cancel", style: { flex: 1, padding: '5px', fontSize: 9, borderRadius: 5, cursor: 'pointer',
                        background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#94a7c4' } }, "Cancel"))))));
}
