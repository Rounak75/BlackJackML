function ShuffleTrackerPanel({ tracker }) {
    const t = tracker || {};
    const conf = t.bayesian_confidence || 1;
    return (React.createElement(Widget, { title: "ML Shuffle Tracker", badge: "LSTM+BAYES", badgeColor: "text-ameth" },
        React.createElement("div", { style: {
                height: 6,
                background: '#111827',
                borderRadius: 999,
                overflow: 'hidden',
                marginBottom: 12,
            } },
            React.createElement("div", { className: "ml-fill", style: { width: `${conf * 100}%` } })),
        React.createElement("div", { className: "space-y-1" },
            React.createElement(KV, { label: "Bayesian Confidence", value: `${(conf * 100).toFixed(0)}%`, valueClass: conf > 0.7 ? 'text-jade' : conf > 0.4 ? 'text-gold' : 'text-ruby' }),
            React.createElement(KV, { label: "Count Adjustment", value: `${(t.count_adjustment || 0) >= 0 ? '+' : ''}${(t.count_adjustment || 0).toFixed(2)}` }),
            React.createElement(KV, { label: "Ace Prediction", value: `${((t.ace_prediction || 0) * 100).toFixed(1)}%` }),
            React.createElement(KV, { label: "Shuffles Tracked", value: t.shuffle_count || 0 }))));
}
