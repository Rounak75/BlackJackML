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

function CenterToolbar({ recommendation, count, playerHand, dealerUpcard, sideBets, analytics }) {

  const action  = recommendation?.action;
  const tc      = count?.true      ?? 0;
  const pv      = playerHand?.value ?? 0;
  const isSoft  = playerHand?.is_soft;
  const isBust  = playerHand?.is_bust;
  const isBJ    = playerHand?.is_blackjack;
  const hasCards= (playerHand?.cards?.length ?? 0) >= 1;

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

  /* ── Side bet EV data ─────────────────────────────────── */
  const sideBetItems = [
    { key: 'perfect_pairs',    icon: '👯', short: 'PP',   data: sideBets?.perfect_pairs,    color: '#b99bff' },
    { key: 'twenty_one_plus_3',icon: '🃏', short: '21+3', data: sideBets?.twenty_one_plus_3, color: '#ffd447' },
    { key: 'lucky_ladies',     icon: '👑', short: 'LL',   data: sideBets?.lucky_ladies,     color: '#ff9a20' },
  ];

  /* ── Shoe quality data ────────────────────────────────── */
  const shoeQuality = analytics?.shoe_quality ?? null;
  const sqLabel = shoeQuality === null ? null
    : shoeQuality >= 70 ? 'Strong' : shoeQuality >= 40 ? 'Neutral' : 'Bad';
  const sqColor = shoeQuality === null ? '#6b7fa3'
    : shoeQuality >= 70 ? '#44e882' : shoeQuality >= 40 ? '#ffd447' : '#ff5c5c';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>

      {/* ── ROW 1: Action + Hand + Bust% + Shortcuts ───── */}
      <div style={{
        background:'#1c2540',
        border:'1.5px solid rgba(255,255,255,0.09)',
        borderRadius: '10px 10px 0 0',
        padding:'8px 12px',
        display:'flex', alignItems:'center', gap:0,
      }}>

        {/* Action badge */}
        <div style={{
          flexShrink: 0, display:'flex', alignItems:'center', gap:6,
          background: action ? `${acCol}10` : 'rgba(255,255,255,0.02)',
          border:`1px solid ${action ? acCol+'40' : 'rgba(255,255,255,0.07)'}`,
          borderRadius:7, padding:'5px 10px', marginRight:6,
        }}>
          <span style={{ fontSize:18, fontWeight:900, color:acCol, fontFamily:'Syne,sans-serif',
            textShadow: action ? `0 0 12px ${acCol}50` : 'none', lineHeight:1 }}>
            {action || '—'}
          </span>
          {recommendation?.is_deviation && (
            <span style={{ fontSize:7, fontWeight:800, color:'#b99bff',
              background:'rgba(185,155,255,0.12)', border:'1px solid rgba(185,155,255,0.3)',
              borderRadius:3, padding:'1px 4px', letterSpacing:'0.06em' }}>DEV</span>
          )}
        </div>

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
        {divider()}

        {/* Keyboard shortcuts */}
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

      {/* ── ROW 2: Side Bet EV pills + Shoe Quality ────── */}
      <div style={{
        background:'#171e30',
        border:'1.5px solid rgba(255,255,255,0.09)',
        borderTop:'none',
        borderRadius: '0 0 10px 10px',
        padding:'5px 12px',
        display:'flex', alignItems:'center', gap:8,
      }}>

        {/* Side Bets label */}
        <div style={{
          fontSize:8, fontWeight:700, color:'#6b7fa3',
          textTransform:'uppercase', letterSpacing:'0.08em',
          flexShrink:0,
        }}>
          Side Bets
        </div>

        {/* Side bet pills */}
        <div style={{ display:'flex', gap:6, flex:1 }}>
          {sideBetItems.map(({ key, icon, short, data, color }) => {
            const ev  = data ? (data.ev || 0) : null;
            const rec = data && data.recommended;
            const isPos = ev !== null && ev >= 0;
            const pillBg   = rec ? `${color}18` : 'rgba(255,255,255,0.03)';
            const pillBdr  = rec ? `${color}50` : 'rgba(255,255,255,0.08)';
            const evColor  = ev === null ? '#6b7fa3' : isPos ? '#44e882' : '#ff5c5c';
            return (
              <div key={key} style={{
                display:'flex', alignItems:'center', gap:5,
                background: pillBg,
                border:`1px solid ${pillBdr}`,
                borderRadius:6, padding:'3px 8px',
                transition:'all 0.3s ease',
              }}>
                <span style={{ fontSize:10 }}>{icon}</span>
                <span style={{ fontSize:9, fontWeight:700, color: rec ? color : '#94a7c4' }}>
                  {short}
                </span>
                <span style={{
                  fontSize:10, fontWeight:800,
                  fontFamily:'DM Mono,monospace',
                  color: evColor,
                }}>
                  {ev !== null ? `${ev >= 0 ? '+' : ''}${ev.toFixed(1)}%` : '—'}
                </span>
                {rec
                  ? <span style={{
                      fontSize:7, fontWeight:800, color,
                      background:`${color}20`, border:`1px solid ${color}40`,
                      borderRadius:3, padding:'0px 4px', lineHeight:'14px',
                    }}>BET</span>
                  : <span style={{ fontSize:7, color:'#4a5568' }}>skip</span>
                }
              </div>
            );
          })}
        </div>

        {/* Separator */}
        <div style={{ width:1, height:18, background:'rgba(255,255,255,0.08)', flexShrink:0 }} />

        {/* Shoe Quality gauge */}
        <div style={{
          display:'flex', alignItems:'center', gap:6,
          flexShrink:0,
        }}>
          <div style={{
            fontSize:8, fontWeight:700, color:'#6b7fa3',
            textTransform:'uppercase', letterSpacing:'0.08em',
          }}>
            Shoe
          </div>
          <div style={{
            width:40, height:4, borderRadius:2,
            background:'rgba(255,255,255,0.06)',
            position:'relative', overflow:'hidden',
          }}>
            <div style={{
              position:'absolute', top:0, left:0,
              height:'100%', borderRadius:2,
              width: shoeQuality !== null ? `${Math.min(100, Math.max(0, shoeQuality))}%` : '0%',
              background: sqColor,
              transition:'width 0.4s ease, background 0.3s ease',
            }} />
          </div>
          <span style={{
            fontSize:11, fontWeight:800,
            fontFamily:'DM Mono,monospace',
            color: sqColor,
          }}>
            {shoeQuality !== null ? shoeQuality : '—'}
          </span>
          {sqLabel && (
            <span style={{
              fontSize:7, fontWeight:700,
              color: sqColor,
              background: `${sqColor}15`,
              border: `1px solid ${sqColor}30`,
              borderRadius:3, padding:'0px 4px', lineHeight:'14px',
              textTransform:'uppercase',
            }}>
              {sqLabel}
            </span>
          )}
        </div>

      </div>

    </div>
  );
}