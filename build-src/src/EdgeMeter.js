// @ts-nocheck
/*
 * components/EdgeMeter.js
 * ─────────────────────────────────────────────────────────
 * Visual bar showing player advantage vs house edge.
 * Bar position maps -2% → 0% (full left) to +2% → 100% (full right).
 * Centre line = break even.
 *
 * Props:
 *   count — count object from server { advantage }
 */

function EdgeMeter({ count }) {
  const adv   = count ? count.advantage : -0.5;
  const clamp = Math.max(-2, Math.min(2, adv));
  const pct   = ((clamp + 2) / 4) * 100;
  const isPos = adv > 0;

  return (
    <Widget title="Player Edge Meter">
      {/* Bar */}
      <div
        style={{
          height: 20,
          background: '#111827',
          borderRadius: 999,
          position: 'relative',
          overflow: 'hidden',
          marginBottom: 8,
        }}
      >
        <div className="edge-fill" style={{ width: `${pct}%` }} />
        {/* Zero-line marker */}
        <div style={{
          position: 'absolute', left: '50%', top: 0, bottom: 0,
          width: 2, background: 'rgba(255,255,255,0.2)',
          transform: 'translateX(-50%)',
        }} />
      </div>

      {/* Labels */}
      <div
        className="flex justify-between mb-3 font-mono"
        style={{ fontSize: '0.62rem', color: '#ccdaec' }}
      >
        <span>House −2%</span>
        <span>Break Even</span>
        <span>Player +2%</span>
      </div>

      {/* Big value + RTP */}
      <div className="flex items-baseline gap-2 flex-wrap">
        <span
          className="font-display font-extrabold leading-none"
          style={{ fontSize: '1.6rem', color: isPos ? '#44e882' : '#ff5c5c' }}
        >
          {adv >= 0 ? '+' : ''}{adv.toFixed(2)}%
        </span>
        <span className="text-xs" style={{ color: '#ccdaec' }}>
          {isPos ? 'Player Edge' : 'House Edge'}
        </span>
      </div>
      <div className="font-mono text-[10px] mt-1" style={{ color: '#b8ccdf' }}>
        RTP: {(100 + adv).toFixed(2)}% · Base house edge: 0.50%
      </div>
    </Widget>
  );
}
