// @ts-nocheck
/*
 * components/CenterToolbar.js
 * ─────────────────────────────────────────────────────────
 * Slim info strip shown BELOW the card grid in the center column.
 *
 * Row 1: AI action · hand value · bust% · dealer bust% · bet
 * Row 2: True Count · Player Edge · Decks Left · P&L · Shortcuts
 * Row 3: Side Count — Ace-adjusted TC · Aces remaining · Tens remaining
 * Row 4: Casino Risk — heat level · spread · signals summary
 *
 * Props:
 *   recommendation  — { action, reason, is_deviation }
 *   count           — { true, running, advantage, decks_remaining }
 *   playerHand      — { value, is_soft, is_bust, is_blackjack, cards[] }
 *   dealerUpcard    — string e.g. "A" "K" "7"
 *   betting         — { recommended_bet, units }
 *   session         — { profit, hands }
 *   currency        — { symbol }
 *   sideCounts      — { ace_adjusted_tc, aces_remaining, aces_expected,
 *                       ace_rich, ace_adjustment, tens_remaining,
 *                       tens_expected, ten_rich, ten_adjustment }
 *   casinoRisk      — { level, label, color, score, spread, signals, advice }
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

function CenterToolbar({ recommendation, count, playerHand, dealerUpcard,
                         betting, session, currency, sideCounts, casinoRisk }) {

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
  const sym     = currency?.symbol ?? '₹';

  // Side count values
  const adjTC    = sideCounts?.ace_adjusted_tc ?? tc;
  const aceRem   = sideCounts?.aces_remaining  ?? null;
  const aceExp   = sideCounts?.aces_expected   ?? null;
  const aceRich  = sideCounts?.ace_rich        ?? false;
  const aceAdj   = sideCounts?.ace_adjustment  ?? 0;
  const acesSeen = sideCounts?.aces_seen       ?? 0;
  const tenRem   = sideCounts?.tens_remaining  ?? null;
  const tenExp   = sideCounts?.tens_expected   ?? null;
  const tenRich  = sideCounts?.ten_rich        ?? false;
  const tenAdj   = sideCounts?.ten_adjustment  ?? 0;
  const tensSeen = sideCounts?.tens_seen       ?? 0;
  // Total = remaining + seen (correct at any penetration depth)
  const totalAces = aceRem !== null ? aceRem + acesSeen : 32;
  const totalTens = tenRem !== null ? tenRem + tensSeen : 128;

  // Casino risk
  const riskLevel = casinoRisk?.level  ?? 0;
  const riskLabel = casinoRisk?.label  ?? 'LOW';
  const riskColor = casinoRisk?.color  ?? '#44e882';
  const riskScore = casinoRisk?.score  ?? 0;
  const riskAdvice= casinoRisk?.advice ?? '';
  const spread    = casinoRisk?.spread != null ? casinoRisk.spread : 1;

  const upRank        = dealerUpcard ? String(dealerUpcard).replace(/[♠♥♦♣]/g,'').trim().toUpperCase() : null;
  const dealerBustPct = upRank ? (DEALER_BUST_PCT[upRank] ?? null) : null;

  const bustPct = (() => {
    if (!hasCards || isBust || isBJ || pv === 0) return null;
    const safe = 21 - pv;
    if (safe >= 11) return 0;
    if (safe <= 0)  return 100;
    const base = {2:4/52,3:4/52,4:4/52,5:4/52,6:4/52,7:4/52,8:4/52,9:4/52,10:16/52};
    let b = 0;
    for (let v = safe + 1; v <= 10; v++) b += (base[v] || 0);
    return Math.round(Math.min(99, Math.max(1, (b + Math.max(-0.12, Math.min(0.15, tc*0.018))) * 100)));
  })();

  const acCol      = action ? (AC[action] || '#f0f4ff') : '#b8ccdf';
  const tcColor    = tc >= 3 ? '#44e882' : tc >= 1 ? '#88eebb' : tc >= -1 ? '#b8ccdf' : '#ff5c5c';
  const adjTcColor = adjTC >= 3 ? '#44e882' : adjTC >= 1 ? '#88eebb' : adjTC >= -1 ? '#b8ccdf' : '#ff5c5c';
  const advCol     = adv >= 0 ? '#44e882' : '#ff5c5c';
  const bustCol    = bustPct === null ? '#b8ccdf' : bustPct >= 70 ? '#ff5c5c' : bustPct >= 40 ? '#ffd447' : '#44e882';
  const dlrBustCol = dealerBustPct === null ? '#b8ccdf' : dealerBustPct >= 40 ? '#44e882' : dealerBustPct >= 28 ? '#ffd447' : '#ff5c5c';
  const aceColor   = aceAdj > 0.2 ? '#44e882' : aceAdj < -0.2 ? '#ff5c5c' : '#b8ccdf';
  const tenColor   = tenAdj > 0.2 ? '#44e882' : tenAdj < -0.2 ? '#ff5c5c' : '#b8ccdf';

  const cell = (label, value, color, extra) => (
    <div style={{ textAlign:'center', flex:1 }}>
      <div style={{ fontSize:9, color:'#ccdaec', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:15, fontWeight:700, color: color||'#ffffff', fontFamily:'DM Mono,monospace', lineHeight:1 }}>{value}</div>
      {extra && <div style={{ fontSize:8, color:'#b8ccdf', marginTop:1 }}>{extra}</div>}
    </div>
  );

  const divider = () => (
    <div style={{ width:1, background:'rgba(255,255,255,0.08)', alignSelf:'stretch', margin:'0 4px' }} />
  );

  const sectionLabel = (text) => (
    <div style={{ fontSize:9, color:'#ccdaec', textTransform:'uppercase', letterSpacing:'0.07em',
      fontWeight:700, whiteSpace:'nowrap', flexShrink:0, marginRight:6 }}>
      {text}
    </div>
  );

  return (
    <div style={{
      background:'#1a2236',
      border:'1.5px solid rgba(255,255,255,0.09)',
      borderRadius:10, padding:'8px 12px',
      display:'flex', flexDirection:'column', gap:7,
    }}>

      {/* ── Row 1: Action + hand info ──────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:0 }}>
        <div style={{
          flex:1.5, display:'flex', alignItems:'center', gap:6,
          background: action ? `${acCol}10` : 'rgba(255,255,255,0.02)',
          border:`1px solid ${action ? acCol+'40' : 'rgba(255,255,255,0.07)'}`,
          borderRadius:7, padding:'5px 10px', marginRight:6,
        }}>
          <span style={{ fontSize:24, fontWeight:900, color:acCol, fontFamily:'Syne,sans-serif',
            textShadow: action ? `0 0 12px ${acCol}50` : 'none', lineHeight:1 }}>
            {action || '—'}
          </span>
          {recommendation?.is_deviation && (
            <span style={{ fontSize:7, fontWeight:800, color:'#b99bff',
              background:'rgba(185,155,255,0.12)', border:'1px solid rgba(185,155,255,0.3)',
              borderRadius:3, padding:'1px 4px', letterSpacing:'0.06em' }}>DEV</span>
          )}
          {!action && <span style={{ fontSize:9, color:'#b8ccdf' }}>deal cards</span>}
        </div>
        {cell(isBJ ? '🎉 BJ' : isBust ? '💀 Bust' : 'Hand',
          hasCards ? (isSoft && !isBust ? `S${pv}` : pv) : '—',
          isBust ? '#ff5c5c' : isBJ ? '#ffd447' : '#f0f4ff')}
        {divider()}
        {cell('Bust/Hit', bustPct === null ? '—' : `${bustPct}%`, bustCol)}
        {divider()}
        {cell(upRank ? `Dlr (${upRank})` : 'Dlr Bust',
          dealerBustPct !== null ? `${dealerBustPct.toFixed(0)}%` : '—', dlrBustCol)}
        {divider()}
        {betting && cell('Bet', `${sym}${betting.recommended_bet}`, '#ffd447', `${betting.units}u`)}
      </div>

      {/* ── Row 2: Count stats + shortcuts ────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:0,
        paddingTop:6, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        {cell('True Count', tc >= 0 ? `+${tc}` : String(tc), tcColor)}
        {divider()}
        {cell('Player Edge', `${adv >= 0 ? '+' : ''}${adv}%`, advCol)}
        {divider()}
        {cell('Decks Left', typeof decks === 'number' ? decks.toFixed(1) : decks, '#ccdaec')}
        {divider()}
        {cell('P&L', `${profit >= 0 ? '+' : ''}${sym}${Math.abs(profit).toFixed(0)}`, profit >= 0 ? '#44e882' : '#ff5c5c', `${hands} hands`)}
        {divider()}
        <div style={{ flex:2, display:'flex', gap:6, justifyContent:'flex-end', flexWrap:'wrap' }}>
          {[['N','New'],['S','Shuffle'],['P','Player'],['D','Dealer']].map(([k,l]) => (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:2 }}>
              <span style={{ fontFamily:'DM Mono,monospace', fontSize:8, fontWeight:700,
                background:'#212d45', border:'1px solid rgba(255,255,255,0.15)',
                borderRadius:3, padding:'1px 4px', color:'#ffd447' }}>{k}</span>
              <span style={{ fontSize:8, color:'#b8ccdf' }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Row 3: Side Count — full width 3-column grid ──────── */}
      {sideCounts && (
        <div style={{ paddingTop:10, borderTop:'1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize:9, color:'#ccdaec', textTransform:'uppercase',
            letterSpacing:'0.08em', fontWeight:700, marginBottom:8 }}>
            Side Count
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>

            {/* Ace-Adjusted TC */}
            <div style={{
              background: adjTC >= 1 ? 'rgba(68,232,130,0.10)' : adjTC <= -1 ? 'rgba(255,92,92,0.10)' : 'rgba(255,255,255,0.04)',
              border:`1.5px solid ${adjTC >= 1 ? 'rgba(68,232,130,0.4)' : adjTC <= -1 ? 'rgba(255,92,92,0.4)' : 'rgba(255,255,255,0.10)'}`,
              borderRadius:8, padding:'10px 12px',
            }}>
              <div style={{ fontSize:10, color:'#ccdaec', textTransform:'uppercase',
                letterSpacing:'0.07em', marginBottom:4, fontWeight:600 }}>
                Adj TC <span style={{ color:'#ffd447', fontSize:9 }}>(for bets)</span>
              </div>
              <div style={{ fontSize:28, fontWeight:900, color:adjTcColor,
                fontFamily:'DM Mono,monospace', lineHeight:1, marginBottom:4 }}>
                {adjTC >= 0 ? '+' : ''}{adjTC.toFixed(1)}
              </div>
              <div style={{ fontSize:10, color:'#a8bcd4' }}>
                Plain TC: <span style={{ color:tcColor, fontFamily:'DM Mono,monospace',
                  fontWeight:700 }}>{tc >= 0 ? `+${tc}` : tc}</span>
              </div>
            </div>

            {/* Aces */}
            <div style={{
              background: aceRich ? 'rgba(68,232,130,0.06)' : 'rgba(255,92,92,0.06)',
              border:`1.5px solid ${aceRich ? 'rgba(68,232,130,0.3)' : 'rgba(255,92,92,0.3)'}`,
              borderRadius:8, padding:'10px 12px',
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:10, color:'#ccdaec', textTransform:'uppercase',
                  letterSpacing:'0.07em', fontWeight:600 }}>Aces</span>
                <span style={{ fontSize:10, fontWeight:800, padding:'2px 7px', borderRadius:4,
                  background: aceRich ? 'rgba(68,232,130,0.2)' : 'rgba(255,92,92,0.2)',
                  color: aceRich ? '#44e882' : '#ff5c5c',
                  border: `1px solid ${aceRich ? 'rgba(68,232,130,0.4)' : 'rgba(255,92,92,0.4)'}` }}>
                  {aceRich ? '▲ RICH' : '▼ POOR'}
                </span>
              </div>
              <div style={{ fontSize:24, fontWeight:800, fontFamily:'DM Mono,monospace',
                color:aceColor, lineHeight:1, marginBottom:4 }}>
                {aceRem !== null ? aceRem : '—'}
                <span style={{ fontSize:13, color:'#a8bcd4', fontWeight:500 }}>/{totalAces}</span>
              </div>
              <div style={{ fontSize:11, fontWeight:700, fontFamily:'DM Mono,monospace',
                color: aceAdj > 0 ? '#44e882' : aceAdj < 0 ? '#ff5c5c' : '#a8bcd4' }}>
                {aceAdj >= 0 ? '+' : ''}{aceAdj.toFixed(2)} TC adj
              </div>
            </div>

            {/* Tens */}
            <div style={{
              background: tenRich ? 'rgba(68,232,130,0.06)' : 'rgba(255,92,92,0.06)',
              border:`1.5px solid ${tenRich ? 'rgba(68,232,130,0.3)' : 'rgba(255,92,92,0.3)'}`,
              borderRadius:8, padding:'10px 12px',
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:10, color:'#ccdaec', textTransform:'uppercase',
                  letterSpacing:'0.07em', fontWeight:600 }}>10-Values</span>
                <span style={{ fontSize:10, fontWeight:800, padding:'2px 7px', borderRadius:4,
                  background: tenRich ? 'rgba(68,232,130,0.2)' : 'rgba(255,92,92,0.2)',
                  color: tenRich ? '#44e882' : '#ff5c5c',
                  border: `1px solid ${tenRich ? 'rgba(68,232,130,0.4)' : 'rgba(255,92,92,0.4)'}` }}>
                  {tenRich ? '▲ RICH' : '▼ POOR'}
                </span>
              </div>
              <div style={{ fontSize:24, fontWeight:800, fontFamily:'DM Mono,monospace',
                color:tenColor, lineHeight:1, marginBottom:4 }}>
                {tenRem !== null ? tenRem : '—'}
                <span style={{ fontSize:13, color:'#a8bcd4', fontWeight:500 }}>/{totalTens}</span>
              </div>
              <div style={{ fontSize:11, fontWeight:700, fontFamily:'DM Mono,monospace',
                color: tenAdj > 0 ? '#44e882' : tenAdj < 0 ? '#ff5c5c' : '#a8bcd4' }}>
                {tenAdj >= 0 ? '+' : ''}{tenAdj.toFixed(2)} TC adj
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Row 4: Casino Risk — full width ────────────────────────── */}
      {casinoRisk && (
        <div style={{ paddingTop:10, borderTop:'1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize:9, color:'#ccdaec', textTransform:'uppercase',
            letterSpacing:'0.08em', fontWeight:700, marginBottom:8 }}>
            Casino Risk
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', gap:10, alignItems:'center' }}>

            {/* Heat badge */}
            <div style={{
              display:'flex', alignItems:'center', gap:8,
              background:`${riskColor}12`, border:`1.5px solid ${riskColor}45`,
              borderRadius:8, padding:'8px 14px',
            }}>
              <div style={{
                width:10, height:10, borderRadius:'50%', background:riskColor,
                boxShadow:`0 0 8px ${riskColor}`,
                animation: riskLevel >= 3 ? 'live-pulse 1s ease-in-out infinite' : 'none',
              }} />
              <span style={{ fontSize:18, fontWeight:900, color:riskColor,
                fontFamily:'DM Mono,monospace' }}>{riskLabel}</span>
            </div>

            {/* Bar + advice */}
            <div>
              <div style={{ height:6, borderRadius:3, background:'rgba(255,255,255,0.07)',
                overflow:'hidden', marginBottom:6, position:'relative' }}>
                <div style={{ position:'absolute', inset:0, borderRadius:3, opacity:0.2,
                  background:'linear-gradient(90deg,#44e882,#ffd447,#ff9944,#ff5c5c)' }} />
                <div style={{ height:'100%', borderRadius:3,
                  width:`${Math.min(100,(riskScore/10)*100)}%`,
                  background:'linear-gradient(90deg,#44e882,#ffd447,#ff9944,#ff5c5c)',
                  transition:'width 0.5s ease' }} />
              </div>
              <div style={{ fontSize:11, color: riskLevel >= 2 ? '#ffb399' : '#ccdaec',
                lineHeight:1.4 }}>{riskAdvice}</div>
            </div>

            {/* Spread */}
            <div style={{ textAlign:'center', minWidth:60 }}>
              <div style={{ fontSize:9, color:'#a8bcd4', textTransform:'uppercase',
                letterSpacing:'0.07em', marginBottom:3 }}>Spread</div>
              <div style={{ fontSize:20, fontWeight:800, fontFamily:'DM Mono,monospace',
                color: spread >= 8 ? '#ff5c5c' : spread >= 5 ? '#ffd447' : '#44e882' }}>
                {spread.toFixed(0)}:1
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
