/*
 * components/CenterToolbar.js
 * ─────────────────────────────────────────────────────────
 * Slim info strip shown BELOW the card grid in the center column.
 * Compact single-row design — just the essentials at a glance.
 *
 * Row 1: AI action · hand value · bust% · dealer bust%
 * Row 2: True Count · Player Edge · Decks Left · Session P&L · Shortcuts
 *
 * Props:
 *   recommendation  — { action, reason, is_deviation }
 *   count           — { true, running, advantage, decks_remaining }
 *   playerHand      — { value, is_soft, is_bust, is_blackjack, cards[] }
 *   dealerUpcard    — string e.g. "A" "K" "7"
 *   betting         — { recommended_bet, units }
 *   session         — { profit, hands }
 *   currency        — { symbol }
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

function CenterToolbar({ recommendation, count, playerHand, dealerUpcard, betting, session, currency }) {

  const action  = recommendation?.action;
  const tc      = count?.true      ?? 0;
  const adv     = count?.advantage ?? 0;
  const decks   = count?.decks_remaining ?? '—';
  const pv      = playerHand?.value ?? 0;
  const isSoft  = playerHand?.is_soft;
  const isBust  = playerHand?.is_bust;
  const isBJ    = playerHand?.is_blackjack;
  const hasCards= (playerHand?.cards?.length ?? 0) >= 1;
  const profit  = session?.profit ?? 0;
  const hands   = session?.hands  ?? 0;
  const sym     = currency?.symbol ?? '$';

  const upRank        = dealerUpcard ? String(dealerUpcard).replace(/[♠♥♦♣]/g,'').trim().toUpperCase() : null;
  const dealerBustPct = upRank ? (DEALER_BUST_PCT[upRank] ?? null) : null;
  // Dealer bust % color: high = GREEN (great for player), low = RED (dealer likely stands)

  const bustPct = (() => {
    if (!hasCards || isBust || isBJ || pv === 0) return null;
    const safe = 21 - pv;
    if (safe >= 11) return 0;
    if (safe <= 0)  return 100;
    // Ace always counts as 1 when it would bust — never causes a bust
    // Only non-ace cards can cause a bust: 2-10 (where 10 = 10,J,Q,K = 16/52)
    const base = {2:4/52,3:4/52,4:4/52,5:4/52,6:4/52,7:4/52,8:4/52,9:4/52,10:16/52};
    let b = 0;
    for (let v = safe + 1; v <= 10; v++) b += (base[v] || 0);
    return Math.round(Math.min(99, Math.max(1, (b + Math.max(-0.12, Math.min(0.15, tc*0.018))) * 100)));
  })();

  const acCol      = action ? (AC[action] || '#f0f4ff') : '#7a8eab';
  // TC: positive = green (hot shoe, good for player), negative = red
  const tcColor    = tc >= 3 ? '#44e882' : tc >= 1 ? '#88eebb' : tc >= -1 ? '#7a8eab' : '#ff5c5c';
  // Player edge: positive = green, negative = red
  const advCol     = adv >= 0 ? '#44e882' : '#ff5c5c';
  // Bust/Hit (player risk): HIGH % = RED (dangerous), LOW % = GREEN (safe to hit)
  const bustCol    = bustPct === null ? '#7a8eab'
    : bustPct >= 70 ? '#ff5c5c'
    : bustPct >= 40 ? '#ffd447'
    : '#44e882';
  // Dealer bust: HIGH % = GREEN (good for player — dealer likely busts),
  //              LOW %  = RED   (bad  for player — dealer likely stands)
  const dlrBustCol = dealerBustPct === null ? '#7a8eab'
    : dealerBustPct >= 40 ? '#44e882'
    : dealerBustPct >= 28 ? '#ffd447'
    : '#ff5c5c';

  const cell = (label, value, color, extra) => (
    <div style={{ textAlign:'center', flex:1 }}>
      <div style={{ fontSize:8, color:'#7a8eab', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:1 }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:700, color: color||'#f0f4ff', fontFamily:'DM Mono,monospace', lineHeight:1 }}>{value}</div>
      {extra && <div style={{ fontSize:7, color:'#7a8eab', marginTop:1 }}>{extra}</div>}
    </div>
  );

  const divider = () => (
    <div style={{ width:1, background:'rgba(255,255,255,0.08)', alignSelf:'stretch', margin:'0 4px' }} />
  );

  return (
    <div style={{
      background:'#1a2236',
      border:'1.5px solid rgba(255,255,255,0.09)',
      borderRadius:10, padding:'8px 12px',
      display:'flex', flexDirection:'column', gap:7,
    }}>

      {/* Row 1 — action + hand info */}
      <div style={{ display:'flex', alignItems:'center', gap:0 }}>

        {/* Action */}
        <div style={{
          flex:1.5, display:'flex', alignItems:'center', gap:6,
          background: action ? `${acCol}10` : 'rgba(255,255,255,0.02)',
          border:`1px solid ${action ? acCol+'40' : 'rgba(255,255,255,0.07)'}`,
          borderRadius:7, padding:'5px 10px', marginRight:6,
        }}>
          <span style={{ fontSize:20, fontWeight:900, color:acCol, fontFamily:'Syne,sans-serif',
            textShadow: action ? `0 0 12px ${acCol}50` : 'none', lineHeight:1 }}>
            {action || '—'}
          </span>
          {recommendation?.is_deviation && (
            <span style={{ fontSize:7, fontWeight:800, color:'#b99bff',
              background:'rgba(185,155,255,0.12)', border:'1px solid rgba(185,155,255,0.3)',
              borderRadius:3, padding:'1px 4px', letterSpacing:'0.06em' }}>DEV</span>
          )}
          {!action && <span style={{ fontSize:9, color:'#7a8eab' }}>deal cards</span>}
        </div>

        {/* Hand */}
        {cell(
          isBJ ? '🎉 BJ' : isBust ? '💀 Bust' : 'Hand',
          hasCards ? (isSoft && !isBust ? `S${pv}` : pv) : '—',
          isBust ? '#ff5c5c' : isBJ ? '#ffd447' : '#f0f4ff'
        )}
        {divider()}

        {/* Bust/Hit */}
        {cell('Bust/Hit', bustPct === null ? '—' : `${bustPct}%`, bustCol)}
        {divider()}

        {/* Dealer bust */}
        {cell(
          upRank ? `Dlr Bust (${upRank})` : 'Dlr Bust',
          dealerBustPct !== null ? `${dealerBustPct.toFixed(0)}%` : '—',
          dlrBustCol
        )}
        {divider()}

        {/* Rec bet */}
        {betting && cell('Bet', `${sym}${betting.recommended_bet}`, '#ffd447', `${betting.units}u`)}
      </div>

      {/* Row 2 — count stats + shortcuts */}
      <div style={{
        display:'flex', alignItems:'center', gap:0,
        paddingTop:6, borderTop:'1px solid rgba(255,255,255,0.06)',
      }}>
        {cell('True Count', tc >= 0 ? `+${tc}` : String(tc), tcColor)}
        {divider()}
        {cell('Player Edge', `${adv >= 0 ? '+' : ''}${adv}%`, advCol)}
        {divider()}
        {cell('Decks Left', typeof decks === 'number' ? decks.toFixed(1) : decks, '#b0bfd8')}
        {divider()}
        {cell('P&L', `${profit >= 0 ? '+' : ''}${sym}${Math.abs(profit).toFixed(0)}`, profit >= 0 ? '#44e882' : '#ff5c5c', `${hands} hands`)}
        {divider()}

        {/* Shortcuts */}
        <div style={{ flex:2, display:'flex', gap:6, justifyContent:'flex-end', flexWrap:'wrap' }}>
          {[['N','New'],['S','Shuffle'],['P','Player'],['D','Dealer']].map(([k,l]) => (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:2 }}>
              <span style={{ fontFamily:'DM Mono,monospace', fontSize:8, fontWeight:700,
                background:'#212d45', border:'1px solid rgba(255,255,255,0.15)',
                borderRadius:3, padding:'1px 4px', color:'#ffd447' }}>{k}</span>
              <span style={{ fontSize:8, color:'#7a8eab' }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}