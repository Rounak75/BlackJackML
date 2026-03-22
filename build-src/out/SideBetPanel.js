function SideBetPanel({ sideBets }) {
    const { useState, useEffect, useRef } = React;
    const [alerts, setAlerts] = useState([]);
    const [dismissed, setDismissed] = useState({});
    const prevRec = useRef({});
    const bets = [
        {
            key: 'perfect_pairs',
            icon: '👯',
            name: 'Perfect Pairs',
            short: 'PP',
            data: sideBets === null || sideBets === void 0 ? void 0 : sideBets.perfect_pairs,
            desc: 'Your first 2 cards form a pair',
            payout: 'up to 25:1',
            color: '#b99bff',
        },
        {
            key: 'twenty_one_plus_3',
            icon: '🃏',
            name: '21+3',
            short: '21+3',
            data: sideBets === null || sideBets === void 0 ? void 0 : sideBets.twenty_one_plus_3,
            desc: 'Your 2 cards + dealer upcard = poker hand',
            payout: 'up to 100:1',
            color: '#ffd447',
        },
        {
            key: 'lucky_ladies',
            icon: '👑',
            name: 'Lucky Ladies',
            short: 'LL',
            data: sideBets === null || sideBets === void 0 ? void 0 : sideBets.lucky_ladies,
            desc: 'Your first 2 cards total 20',
            payout: 'up to 1000:1',
            color: '#ff9a20',
        },
    ];
    useEffect(() => {
        if (!sideBets)
            return;
        const newAlerts = [];
        bets.forEach(({ key, name, icon, data, desc, payout, color }) => {
            const rec = data && data.recommended;
            const wasRec = prevRec.current[key];
            if (rec && !wasRec && !dismissed[key]) {
                newAlerts.push({ key, name, icon, desc, payout, color,
                    ev: data.ev, reason: data.reason || '' });
            }
            prevRec.current[key] = rec;
        });
        if (newAlerts.length > 0) {
            setAlerts(prev => {
                const existing = new Set(prev.map(a => a.key));
                return [...prev, ...newAlerts.filter(a => !existing.has(a.key))];
            });
        }
        setAlerts(prev => prev.filter(a => {
            const d = sideBets === null || sideBets === void 0 ? void 0 : sideBets[a.key];
            return d && d.recommended;
        }));
    }, [sideBets]);
    const dismissAlert = (key) => {
        setAlerts(prev => prev.filter(a => a.key !== key));
        setDismissed(prev => ({ ...prev, [key]: true }));
    };
    const urgencyLevel = (ev) => {
        if (ev >= 5)
            return { label: '🔥 HIGH', color: '#ff5c5c', bg: 'rgba(255,92,92,0.15)' };
        if (ev >= 2)
            return { label: '⚡ MEDIUM', color: '#ffd447', bg: 'rgba(255,212,71,0.15)' };
        return { label: '📈 LOW', color: '#44e882', bg: 'rgba(68,232,130,0.12)' };
    };
    return (React.createElement(React.Fragment, null,
        alerts.length > 0 && (React.createElement("div", { style: {
                position: 'fixed',
                bottom: 80,
                right: 16,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                maxWidth: 320,
            } }, alerts.map(alert => {
            const urg = urgencyLevel(alert.ev || 0);
            return (React.createElement("div", { key: alert.key, style: {
                    background: '#1a2236',
                    border: `2px solid ${alert.color}`,
                    borderRadius: 14,
                    padding: '14px 16px',
                    boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${alert.color}33`,
                    animation: 'slideInRight 0.3s ease',
                } },
                React.createElement("div", { className: "flex items-center justify-between mb-2" },
                    React.createElement("div", { className: "flex items-center gap-2" },
                        React.createElement("span", { style: { fontSize: '1.3rem' } }, alert.icon),
                        React.createElement("div", null,
                            React.createElement("div", { className: "font-display font-bold text-sm", style: { color: '#f0f4ff' } }, alert.name),
                            React.createElement("div", { className: "text-[10px] font-bold px-2 py-0.5 rounded-full", style: { background: urg.bg, color: urg.color, display: 'inline-block' } },
                                urg.label,
                                " EV OPPORTUNITY"))),
                    React.createElement("button", { "aria-label": `Dismiss ${alert.bet || 'side bet'} opportunity alert`, onClick: () => dismissAlert(alert.key), style: { color: '#94a7c4', fontSize: '1rem', lineHeight: 1, padding: '2px 6px' } }, "\u2715")),
                React.createElement("div", { className: "flex items-baseline gap-2 mb-2" },
                    React.createElement("span", { className: "font-mono font-extrabold text-2xl", style: { color: alert.color } },
                        "+",
                        (alert.ev || 0).toFixed(1),
                        "%"),
                    React.createElement("span", { className: "text-xs", style: { color: '#94a7c4' } }, "Expected Value")),
                React.createElement("div", { className: "text-xs mb-2", style: { color: '#b0bfd8' } },
                    alert.desc,
                    " \u00B7 Pays ",
                    alert.payout),
                alert.reason && (React.createElement("div", { className: "text-[10px] px-2 py-1 rounded-lg font-mono", style: { background: 'rgba(255,255,255,0.05)', color: '#94a7c4' } }, alert.reason)),
                React.createElement("div", { className: "mt-2 text-[11px] font-semibold text-center py-1 rounded-lg", style: { background: `${alert.color}22`, color: alert.color, border: `1px solid ${alert.color}44` } }, "\u26A1 Place this side bet before cards are dealt!")));
        }))),
        React.createElement(Widget, { title: "Side Bet EV", badge: alerts.length > 0 ? `${alerts.length} ACTIVE` : undefined, badgeColor: alerts.length > 0 ? 'text-jade' : undefined },
            React.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 } }, bets.map(({ key, icon, short, data, payout, color }) => {
                const ev = data ? (data.ev || 0) : null;
                const rec = data && data.recommended;
                const isPos = ev !== null && ev >= 0;
                return (React.createElement("div", { key: key, style: {
                        background: rec ? `linear-gradient(135deg,${color}18,${color}08)` : '#111827',
                        border: `1.5px solid ${rec ? color : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: 10, padding: '10px 8px',
                        boxShadow: rec ? `0 0 12px ${color}22` : 'none',
                        position: 'relative',
                    } },
                    rec && (React.createElement("div", { style: { position: 'absolute', top: 6, right: 6, width: 6, height: 6,
                            borderRadius: '50%', background: color,
                            animation: 'pulse 1.5s ease-in-out infinite' } })),
                    React.createElement("div", { style: { fontSize: 13, marginBottom: 4 } }, icon),
                    React.createElement("div", { style: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.06em', color: rec ? color : '#94a7c4', marginBottom: 5 } }, short),
                    React.createElement("div", { style: { fontSize: 18, fontWeight: 800, fontFamily: 'DM Mono,monospace',
                            lineHeight: 1, marginBottom: 4,
                            color: ev !== null ? (isPos ? '#44e882' : '#ff5c5c') : '#6b7fa3' } }, ev !== null ? `${ev >= 0 ? '+' : ''}${ev.toFixed(1)}%` : '—'),
                    React.createElement("div", { style: { fontSize: 8, color: '#94a7c4', marginBottom: 6 } }, payout),
                    rec
                        ? React.createElement("span", { style: { fontSize: 8, fontWeight: 700, color,
                                background: `${color}20`, border: `1px solid ${color}40`,
                                borderRadius: 4, padding: '2px 6px' } }, "\u2713 BET")
                        : React.createElement("span", { style: { fontSize: 8, color: '#6b7fa3' } }, "skip")));
            })),
            React.createElement("div", { style: { borderTop: '1px solid rgba(255,255,255,0.07)', margin: '4px 0 10px' } }),
            React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 } }, bets.some(b => b.data && b.data.recommended) ? (bets.filter(b => b.data && b.data.recommended).map(({ key, icon, name, data, color }) => (React.createElement("div", { key: key, style: {
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 10px', borderRadius: 8,
                    background: `${color}10`, border: `1px solid ${color}30`,
                } },
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                    React.createElement("span", { style: { fontSize: 13 } }, icon),
                    React.createElement("span", { style: { fontSize: 11, fontWeight: 700, color } }, name)),
                React.createElement("div", { style: { textAlign: 'right' } },
                    React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: '#44e882',
                            fontFamily: 'DM Mono,monospace' } },
                        "+",
                        (data.ev || 0).toFixed(1),
                        "% EV"),
                    data.reason && (React.createElement("div", { style: { fontSize: 9, color: '#94a7c4' } }, data.reason))))))) : (React.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
                React.createElement("div", { style: { fontSize: 9, color: '#94a7c4', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 } }, "Expected Value Summary"),
                bets.map(({ key, icon, name, data, color }) => {
                    const ev = data ? (data.ev || 0) : null;
                    return (React.createElement("div", { key: key, style: {
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '6px 10px', borderRadius: 7, background: '#111827',
                            border: '1px solid rgba(255,255,255,0.06)',
                        } },
                        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                            React.createElement("span", { style: { fontSize: 12 } }, icon),
                            React.createElement("span", { style: { fontSize: 10, color: '#b0bfd8' } }, name)),
                        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10 } },
                            React.createElement("span", { style: { fontSize: 11, fontWeight: 700,
                                    fontFamily: 'DM Mono,monospace',
                                    color: ev !== null && ev >= 0 ? '#44e882' : '#ff5c5c' } }, ev !== null ? `${ev >= 0 ? '+' : ''}${ev.toFixed(1)}%` : '—'),
                            React.createElement("span", { style: { fontSize: 8, color: '#6b7fa3',
                                    background: 'rgba(255,255,255,0.04)', padding: '1px 5px',
                                    borderRadius: 3 } }, "SKIP"))));
                }),
                React.createElement("div", { style: { fontSize: 9, color: '#6b7fa3', textAlign: 'center', marginTop: 4 } }, "No +EV opportunities \u2014 all side bets negative"))))),
        React.createElement("style", null, `
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(60px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `)));
}
