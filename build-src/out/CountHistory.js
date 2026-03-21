function CountHistoryPanel({ history }) {
    const { useRef, useEffect } = React;
    const canvasRef = useRef(null);
    useEffect(() => {
        if (!history || !history.length || !canvasRef.current)
            return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const W = canvas.offsetWidth || 260;
        const H = 90;
        canvas.width = W;
        canvas.height = H;
        ctx.clearRect(0, 0, W, H);
        const counts = history.map(h => h.true_count);
        const maxAbs = Math.max(Math.abs(Math.min(...counts)), Math.abs(Math.max(...counts)), 3);
        const midY = H / 2;
        const step = W / Math.max(counts.length - 1, 1);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(W, midY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        counts.forEach((tc, i) => {
            const x = i * step;
            const y = midY - (tc / maxAbs) * (midY - 6);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        const grad = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, '#44e882');
        grad.addColorStop(0.5, '#ffd447');
        grad.addColorStop(1, '#6aafff');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.stroke();
        const lastX = (counts.length - 1) * step;
        ctx.lineTo(lastX, midY);
        ctx.lineTo(0, midY);
        ctx.closePath();
        const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
        fillGrad.addColorStop(0, 'rgba(255,212,71,0.1)');
        fillGrad.addColorStop(1, 'rgba(255,212,71,0)');
        ctx.fillStyle = fillGrad;
        ctx.fill();
    }, [history]);
    const recent = history ? [...history].reverse().slice(0, 15) : [];
    return (React.createElement(Widget, { title: "Count History" },
        React.createElement("canvas", { ref: canvasRef, id: "count-canvas", style: { marginBottom: 10 } }),
        React.createElement("div", { style: { maxHeight: 100, overflowY: 'auto' } }, recent.length === 0 ? (React.createElement("div", { className: "text-xs italic", style: { color: '#b8ccdf' } }, "No cards counted yet")) : (recent.map((h, i) => {
            const pos = h.count_value > 0;
            const neg = h.count_value < 0;
            return (React.createElement("div", { key: i, className: "flex justify-between text-[10px] py-0.5 font-mono", style: { borderBottom: '1px solid rgba(255,255,255,0.05)' } },
                React.createElement("span", { style: { color: '#ccdaec', minWidth: 32 } }, h.card),
                React.createElement("span", { style: { color: pos ? '#44e882' : neg ? '#ff5c5c' : '#b8ccdf', minWidth: 28, textAlign: 'right' } },
                    h.count_value > 0 ? '+' : '',
                    h.count_value),
                React.createElement("span", { style: { color: '#b8ccdf', minWidth: 44, textAlign: 'right' } },
                    "RC ",
                    h.running_count),
                React.createElement("span", { style: { color: '#b8ccdf', minWidth: 44, textAlign: 'right' } },
                    "TC ",
                    h.true_count.toFixed(1))));
        })))));
}
