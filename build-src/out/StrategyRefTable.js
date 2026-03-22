function StrategyRefTable({ playerHand, dealerUpcard }) {
    const { useState, useEffect } = React;
    const [tab, setTab] = useState('hard');
    const [collapsed, setCollapsed] = useState(true);
    let highlightKey = null;
    if (playerHand && dealerUpcard) {
        const dealerRank = dealerUpcard.slice(0, -1);
        const dealerVal = dealerRank === 'A' ? 'A' : parseInt(dealerRank);
        const colIdx = DEALER_COLS.indexOf(dealerVal);
        if (colIdx >= 0) {
            if (tab === 'hard' && !playerHand.is_soft) {
                const v = Math.min(playerHand.value, 17);
                const keys = Object.keys(HARD_TABLE).map(Number);
                const ri = keys.indexOf(v);
                if (ri >= 0)
                    highlightKey = `hard-${ri}-${colIdx}`;
            }
            else if (tab === 'soft' && playerHand.is_soft) {
                const keys = Object.keys(SOFT_TABLE).map(Number);
                const ri = keys.indexOf(playerHand.value);
                if (ri >= 0)
                    highlightKey = `soft-${ri}-${colIdx}`;
            }
        }
    }
    useEffect(() => {
        if (!playerHand || !dealerUpcard)
            return;
        if (playerHand.is_pair) {
            setTab('pair');
        }
        else if (playerHand.is_soft) {
            setTab('soft');
        }
        else {
            setTab('hard');
        }
        setCollapsed(false);
    }, [playerHand === null || playerHand === void 0 ? void 0 : playerHand.value, playerHand === null || playerHand === void 0 ? void 0 : playerHand.is_soft, playerHand === null || playerHand === void 0 ? void 0 : playerHand.is_pair, dealerUpcard]);
    const renderTable = () => {
        let rows, rowLabels, prefix;
        if (tab === 'hard') {
            rows = Object.entries(HARD_TABLE);
            rowLabels = rows.map(([k]) => `Hard ${k}`);
            prefix = 'hard';
        }
        else if (tab === 'soft') {
            rows = Object.entries(SOFT_TABLE);
            rowLabels = rows.map(([k]) => SOFT_LABELS[k] || `Soft ${k}`);
            prefix = 'soft';
        }
        else {
            rows = Object.entries(PAIR_TABLE);
            rowLabels = rows.map(([k]) => k);
            prefix = 'pair';
        }
        return (React.createElement("div", { className: "overflow-x-auto" },
            React.createElement("table", { className: "strat-table" },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null),
                        DEALER_COLS.map(c => React.createElement("th", { key: c }, c)))),
                React.createElement("tbody", null, rows.map(([key, cells], ri) => (React.createElement("tr", { key: key },
                    React.createElement("td", { className: "rlbl" }, rowLabels[ri]),
                    cells.map((cell, ci) => {
                        const ck = `${prefix}-${ri}-${ci}`;
                        return (React.createElement("td", { key: ci, className: `${cellClass(cell)} ${ck === highlightKey ? 'cell-hl' : ''}` }, cell));
                    }))))))));
    };
    return (React.createElement("div", { className: "rounded-xl p-3", style: { background: '#1a2236', border: '1.5px solid rgba(255,255,255,0.12)' } },
        React.createElement("div", { className: "flex items-center justify-between", style: { cursor: 'pointer', userSelect: 'none' }, onClick: () => setCollapsed(c => !c) },
            React.createElement("span", { className: "font-display font-bold text-[10px] uppercase tracking-widest", style: { color: '#94a7c4' } }, "Basic Strategy Ref"),
            React.createElement("div", { className: "flex items-center gap-1" },
                collapsed && (React.createElement("span", { className: "text-[10px] font-semibold", style: { color: '#ffd447' } }, tab === 'hard' ? 'Hard' : tab === 'soft' ? 'Soft' : 'Pairs')),
                React.createElement("span", { className: "text-[10px] px-1.5 py-0.5 rounded-md", style: {
                        background: '#212d45',
                        border: '1.5px solid rgba(255,255,255,0.15)',
                        color: '#94a7c4',
                        transition: 'transform 0.2s',
                        display: 'inline-block',
                        transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                    } }, "\u25BC"))),
        !collapsed && (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "flex gap-1 mt-2 mb-2", onClick: e => e.stopPropagation() }, ['hard', 'soft', 'pair'].map(t => (React.createElement("button", { key: t, onClick: () => setTab(t), "aria-pressed": tab === t, "aria-label": `Show ${t} strategy table`, className: "text-[10px] uppercase font-semibold px-2.5 py-1 rounded-md transition-all", style: {
                    background: tab === t ? '#212d45' : 'transparent',
                    border: `1.5px solid ${tab === t ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)'}`,
                    color: tab === t ? '#f0f4ff' : '#94a7c4',
                } }, t === 'hard' ? 'Hard' : t === 'soft' ? 'Soft' : 'Pairs')))),
            renderTable(),
            React.createElement("div", { className: "flex flex-wrap gap-1 mt-2" }, [
                { cls: 's-H', label: 'H = Hit' },
                { cls: 's-S', label: 'S = Stand' },
                { cls: 's-D', label: 'D = Double' },
                { cls: 's-Ds', label: 'Ds = Dbl/Stand' },
                { cls: 's-SP', label: 'SP = Split' },
                { cls: 's-SUR', label: 'SUR = Surrender' },
            ].map(({ cls, label }) => (React.createElement("span", { key: cls, className: `${cls} text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold` }, label)))))),
        !collapsed && tab === 'pair' && (React.createElement("div", { className: "mt-1 text-[9px] px-1 py-0.5 rounded", style: { color: '#ffb347', background: 'rgba(255,160,40,0.1)', border: '1px solid rgba(255,160,40,0.3)' } }, "No Double After Split \u00B7 Only 1 split per hand \u00B7 Split Aces get 1 card each")),
        collapsed && highlightKey && (React.createElement("div", { className: "mt-1.5 text-[10px]", style: { color: '#ffd447' } }, "\u2191 Tap to see your highlighted cell"))));
}
