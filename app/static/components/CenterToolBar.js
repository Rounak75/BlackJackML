/*
 * components/CenterToolbar.js
 * ─────────────────────────────────────────────────────────
 * Slim info strip shown BELOW the card grid in the center column.
 *
 * UX AUDIT — Issue #4:
 *   BEFORE: 4 rows duplicating TopBar and right-column data.
 *   AFTER:  Two compact rows with UNIQUE data only:
 *     Row 1: Action badge + hand value + bust% + dealer bust% + shortcuts
 *     Row 2: Side bet EV pills (PP, 21+3, LL) + Shoe Quality gauge
 *
 * Props:
 *   recommendation  — { action, reason, is_deviation }
 *   playerHand      — { value, is_soft, is_bust, is_blackjack, cards[] }
 *   dealerUpcard    — string e.g. "A" "K" "7"
 *   count           — { true } (for bust% TC adjustment only)
 *   sideBets        — side_bets object from server
 *   analytics       — { shoe_quality } from server
 */

const DEALER_BUST_PCT = {
  '2':35.4,'3':37.6,'4':40.3,'5':42.9,'6':42.1,
  '7':26.2,'8':24.4,'9':23.3,'10':21.4,
  'J':21.4,'Q':21.4,'K':21.4,'A':11.5,
};

const AC = {
  HIT:'#ff5c5c', STAND:'#44e882', DOUBLE:'#ffd447',
  SPLIT:'#b99bff', SURRENDER:'#ff9944',
};

function CenterToolbar({ recommendation, count, playerHand, dealerUpcard, sideBets, analytics, shoe }) {

  const action  = recommendation?.action;
  const tc      = count?.true      ?? 0;
  const pv      = playerHand?.value ?? 0;
  const isSoft  = playerHand?.is_soft;
  const isBust  = playerHand?.is_bust;
  const isBJ    = playerHand?.is_blackjack;
  const hasCards= (playerHand?.cards?.length ?? 0) >= 1;

  const upRank        = dealerUpcard ? String(dealerUpcard).replace(/[♠♥♦♣]/g,'').trim().toUpperCase() : null;
  const dealerBustPct = upRank ? (DEALER_BUST_PCT[upRank] ?? null) : null;

  // P3.4 (MED-01): bust% computed from LIVE shoe composition when available.
  // Falls back to static base frequencies + TC-adjustment if shoe.remaining_by_rank
  // is not present yet (initial render).
  const bustPct = (() => {
    if (!hasCards || isBust || isBJ || pv === 0) return null;
    const safe = 21 - pv;
    if (safe >= 11) return 0;
    if (safe <= 0)  return 100;

    const remByRank = shoe && shoe.remaining_by_rank;
    if (remByRank) {
      // remByRank: { 2..10: count, 11: count } — total cards left
      let total = 0;
      for (let k = 2; k <= 11; k++) total += (remByRank[k] || remByRank[String(k)] || 0);
      if (total > 0) {
        let b = 0;
        for (let v = safe + 1; v <= 10; v++) {
          const n = (remByRank[v] || remByRank[String(v)] || 0);
          b += n / total;
        }
        // Aces: count as 1 only if 11 would bust (it always does when safe<11 here).
        // Treat A as a 1, so it never busts — skip from bust sum.
        return Math.round(Math.min(99, Math.max(1, b * 100)));
      }
    }
    // Fallback: static frequencies + TC tilt
    const base = {2:4/52,3:4/52,4:4/52,5:4/52,6:4/52,7:4/52,8:4/52,9:4/52,10:16/52};
    let b = 0;
    for (let v = safe + 1; v <= 10; v++) b += (base[v] || 0);
    return Math.round(Math.min(99, Math.max(1, (b + Math.max(-0.12, Math.min(0.15, tc*0.018))) * 100)));
  })();

  const acCol      = action ? (AC[action] || '#f0f4ff') : '#b8ccdf';
  const bustCol    = bustPct === null ? '#b8ccdf' : bustPct >= 70 ? '#ff5c5c' : bustPct >= 40 ? '#ffd447' : '#44e882';
  const dlrBustCol = dealerBustPct === null ? '#b8ccdf' : dealerBustPct >= 40 ? '#44e882' : dealerBustPct >= 28 ? '#ffd447' : '#ff5c5c';

  const cell = (label, value, color, extra, tooltip) => (
    <div style={{ textAlign:'center', flex:1 }}>
      <div style={{ fontSize:9, color:'#ccdaec', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:2 }} title={tooltip}>
        {label}
        {tooltip && (
          <span style={{ cursor: 'help', display: 'inline-block', width: 10, height: 10, lineHeight: '10px', textAlign: 'center', borderRadius: '50%', border: '1px solid currentColor', opacity: 0.7, marginLeft: 3, fontSize: 7 }}>?</span>
        )}
      </div>
      <div style={{ fontSize:15, fontWeight:700, color: color||'#ffffff', fontFamily:'DM Mono,monospace', lineHeight:1 }}>{value}</div>
      {extra && <div style={{ fontSize:8, color:'#b8ccdf', marginTop:1 }}>{extra}</div>}
    </div>
  );

  const divider = () => (
    <div style={{ width:1, background:'rgba(255,255,255,0.08)', alignSelf:'stretch', margin:'0 4px' }} />
  );

  return (
    <div style={{
      background:'#1c2540',
      border:'1.5px solid rgba(255,255,255,0.09)',
      borderRadius: 10,
      padding:'8px 12px',
      display:'flex', alignItems:'center', gap:0,
    }}>

      {/* Hand value */}
      {cell(isBJ ? '🎉 BJ' : isBust ? '💀 Bust' : 'Hand',
        hasCards ? (isSoft && !isBust ? `S${pv}` : pv) : '—',
        isBust ? '#ff5c5c' : isBJ ? '#ffd447' : '#f0f4ff')}
      {divider()}

      {/* Player bust % */}
      {cell('Bust/Hit', bustPct === null ? '—' : `${bustPct}%`, bustCol, null, 'Probability of player busting if hitting')}
      {divider()}

      {/* Dealer bust % */}
      {cell(upRank ? `Dlr (${upRank})` : 'Dlr Bust',
        dealerBustPct !== null ? `${dealerBustPct.toFixed(0)}%` : '—', dlrBustCol, null, 'Dealer Bust Probability')}

    </div>
  );
}


// PHASE 7 T4 — React.memo wrap. Script-mode reassignment of the
// function declaration keeps `function CenterToolbar(` intact for the
// build.sh smoke check while routing all consumers through memo.
if (typeof React !== 'undefined' && React.memo) {
  CenterToolbar = React.memo(CenterToolbar);
}
