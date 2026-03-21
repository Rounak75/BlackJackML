function Widget({ title, badge, badgeColor = 'text-ameth', children, className = '', accent }) {
    const borderStyle = accent ? { borderLeft: `3px solid ${accent}` } : {};
    const headingId = title
        ? 'wgt-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        : undefined;
    return (React.createElement("div", { className: `widget-card ${className}`, style: borderStyle, role: "region", "aria-labelledby": headingId },
        title && (React.createElement("div", { className: "flex items-center justify-between mb-3" },
            React.createElement("span", { id: headingId, className: "widget-title" }, title),
            badge && (React.createElement("span", { className: `font-mono text-[9px] border rounded px-2 py-0.5 ${badgeColor} border-current/40`, style: { background: 'rgba(255,255,255,0.05)' }, "aria-label": `${title} status: ${badge}` }, badge)))),
        children));
}
function KV({ label, value, valueClass = '' }) {
    return (React.createElement("div", { className: "flex justify-between items-center py-1", style: { fontSize: 12 } },
        React.createElement("dt", { style: { color: '#ccdaec', fontWeight: 500 } }, label),
        React.createElement("dd", { className: `font-mono font-bold ${valueClass}`, style: { color: valueClass ? undefined : '#ffffff', fontSize: 13, margin: 0 } }, value)));
}
