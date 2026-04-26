/*
 * components/EdgeMeter.js
 * ─────────────────────────────────────────────────────────
 * Visual bar showing player advantage vs house edge.
 *
 * FIX U6 — Two bugs fixed:
 *
 *   1. `count.advantage` was wrong for Level-2/3 systems (Omega II, Zen,
 *      Uston APC) because the server formula used raw TC * 0.005 without
 *      normalising for systems whose TCs are 2× larger than Hi-Lo.
 *      → Fixed at source in counting.py (C5): advantage is now normalised
 *        by COUNT_NORM_SCALARS before the formula runs.  This component
 *        just reads the already-correct value from the server.
 *
 *   2. Footer hardcoded "Base house edge: 0.50%" — wrong.  The engine uses
 *      0.43% (Griffin/WoO 8-deck S17 reference).
 *      → Fixed: shows 0.43%, break-even TC, and active system name.
 *
 * Props:
 *   count — { advantage, system, true, decks_remaining }
 */

function EdgeMeter({ count }) {
  const adv    = count ? count.advantage : -0.43;
  const system = count ? count.system    : 'hi_lo';
  // For KO display: show effective TC (IRC-adjusted) not raw TC
  const isKO   = count ? count.is_ko : false;
  const dispTC = count
    ? (count.effective_true !== undefined ? count.effective_true : count.true)
    : 0;

  const clamp = Math.max(-2, Math.min(2, adv));
  const pct   = ((clamp + 2) / 4) * 100;
  const isPos = adv > 0;

  const SYS_LABELS = {
    hi_lo: 'Hi-Lo', ko: 'KO', omega_ii: 'Omega II',
    zen: 'Zen', wong_halves: 'Wong Halves', uston_apc: 'Uston APC',
  };
  const sysLabel = SYS_LABELS[system] || system;

  // base_edge=0.0043, each normalised +1 TC = +0.5%  →  break-even at TC ≈ +0.86
  const breakEvenTC = (0.0043 / 0.005).toFixed(1);

  return (
    <Widget title="Player Edge Meter">

      {/* Bar */}
      <div style={{
        height: 20, background: 'var(--surface-chrome)', borderRadius: 999,
        position: 'relative', overflow: 'hidden', marginBottom: 8,
      }}>
        <div className="edge-fill" style={{ width: `${pct}%` }} />
        <div style={{
          position: 'absolute', left: '50%', top: 0, bottom: 0,
          width: 2, background: 'rgba(255,255,255,0.2)',
          transform: 'translateX(-50%)',
        }} />
      </div>

      {/* Axis labels */}
      <div className="flex justify-between mb-3 font-mono num"
        style={{ fontSize: 'var(--font-xs)', color: 'var(--text-1)' }}>
        <span>House −2%</span>
        <span>Break Even</span>
        <span>Player +2%</span>
      </div>

      {/* Main value + system badge */}
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-display font-extrabold leading-none num"
          style={{ fontSize: '1.6rem', color: isPos ? 'var(--jade)' : 'var(--ruby)' }}>
          {adv >= 0 ? '+' : ''}{adv.toFixed(2)}%
        </span>
        <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-1)' }}>
          {isPos ? 'Player Edge' : 'House Edge'}
        </span>
        <span style={{
          fontSize: '0.54rem', marginLeft: 'auto',
          background: 'rgba(255,212,71,0.10)',
          border: 'var(--border-w) solid rgba(255,212,71,0.30)',
          color: 'var(--gold)', borderRadius: 4,
          padding: '1px 5px',
          fontFamily: 'DM Mono, monospace',
          letterSpacing: '0.05em',
        }}>
          {sysLabel}
        </span>
      </div>

      {/* Footer — FIX U6: correct 0.43% base edge (not 0.50%) */}
      <div className="font-mono text-[10px] mt-1 num" style={{ color: 'var(--text-2)' }}>
        RTP: {(100 + adv).toFixed(2)}%
        {' · '}Base edge: 0.43% (8-deck S17)
        {' · '}{isKO ? 'KO Effective TC: ' : 'Break-even TC ≈ +'}{isKO ? (dispTC >= 0 ? '+' : '') + dispTC.toFixed(1) : breakEvenTC}
      </div>

    </Widget>
  );
}