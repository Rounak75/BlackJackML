// @ts-nocheck
/*
 * components/SideCountPanel.js
 * ─────────────────────────────────────────────────────────
 * Ace + Ten side count display panel.
 *
 * Shows:
 *   • Aces remaining vs expected — with rich/poor indicator
 *   • 10-value cards remaining vs expected
 *   • Ace adjustment to TC (+/- per deck above/below expectation)
 *   • Ace-adjusted True Count (the number to use for bet sizing)
 *   • Visual depleted bars for Aces and Tens
 *
 * Why it matters:
 *   Hi-Lo treats Aces as -1 (same as 10s) but Aces uniquely enable
 *   Blackjack (3:2 payout). A shoe Ace-rich above expectation adds
 *   roughly +0.4 TC units to your effective betting advantage.
 *   This panel makes that adjustment explicit so you always bet
 *   on the correct number.
 *
 * Props:
 *   sideCounts — side_counts object from server {
 *     aces_remaining, aces_expected, ace_rich, ace_adjustment,
 *     tens_remaining, tens_expected, ten_rich, ten_adjustment,
 *     ace_adjusted_tc, aces_seen, tens_seen
 *   }
 *   count — count object from server { true, decks_remaining }
 */

function SideCountPanel({ sideCounts, count }) {
  if (!sideCounts) return null;

  const tc      = count?.true       ?? 0;
  const adjTC   = sideCounts.ace_adjusted_tc ?? tc;
  const decks   = count?.decks_remaining ?? '—';

  const aceRem  = sideCounts.aces_remaining ?? 0;
  const aceExp  = sideCounts.aces_expected  ?? 0;
  const aceAdj  = sideCounts.ace_adjustment ?? 0;
  const aceRich = sideCounts.ace_rich;

  const tenRem  = sideCounts.tens_remaining ?? 0;
  const tenExp  = sideCounts.tens_expected  ?? 0;
  const tenAdj  = sideCounts.ten_adjustment ?? 0;
  const tenRich = sideCounts.ten_rich;

  const tcColor    = tc >= 3 ? '#44e882' : tc >= 1 ? '#88eebb' : tc >= -1 ? '#94a7c4' : '#ff5c5c';
  const adjTcColor = adjTC >= 3 ? '#44e882' : adjTC >= 1 ? '#88eebb' : adjTC >= -1 ? '#94a7c4' : '#ff5c5c';
  const aceColor   = aceAdj > 0.3 ? '#44e882' : aceAdj < -0.3 ? '#ff5c5c' : '#94a7c4';
  const tenColor   = tenAdj > 0.3 ? '#44e882' : tenAdj < -0.3 ? '#ff5c5c' : '#94a7c4';

  // Bar fill: how many remain vs total expected at start
  // Total = remaining + already seen (correct regardless of decks/penetration)
  const acesSeen  = sideCounts.aces_seen ?? 0;
  const tensSeen  = sideCounts.tens_seen ?? 0;
  const totalAces = (aceRem ?? 0) + acesSeen  || 32;
  const totalTens = (tenRem ?? 0) + tensSeen  || 128;
  const aceFill   = totalAces > 0 ? Math.max(0, Math.min(1, aceRem / totalAces)) : 0;
  const tenFill   = totalTens > 0 ? Math.max(0, Math.min(1, tenRem / totalTens)) : 0;

  const row = (label, remaining, expected, adj, fill, color, rich, total) => {
    const pct  = total > 0 ? Math.round((remaining / total) * 100) : 0;
    const diff = remaining - expected;
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#f0f4ff' }}>{label}</span>
            <span style={{
              fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
              background: rich ? 'rgba(68,232,130,0.15)' : 'rgba(255,92,92,0.15)',
              color: rich ? '#44e882' : '#ff5c5c',
              border: `1px solid ${rich ? 'rgba(68,232,130,0.4)' : 'rgba(255,92,92,0.4)'}`,
            }}>
              {rich ? '▲ RICH' : '▼ POOR'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'DM Mono,monospace', color: '#f0f4ff' }}>
              {remaining}
              <span style={{ fontSize: 8, color: '#94a7c4' }}> / {total}</span>
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700, fontFamily: 'DM Mono,monospace',
              color: adj >= 0 ? '#44e882' : '#ff5c5c',
            }}>
              {adj >= 0 ? '+' : ''}{adj.toFixed(2)} TC
            </span>
          </div>
        </div>
        {/* Depletion bar */}
        <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)', position: 'relative' }}>
          {/* Expected line */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${(expected / total) * 100}%`,
            width: 1, background: 'rgba(255,255,255,0.25)',
          }} />
          {/* Remaining bar */}
          <div style={{
            height: '100%', borderRadius: 3,
            width: `${fill * 100}%`,
            background: rich
              ? 'linear-gradient(90deg, #44e882, #88eebb)'
              : 'linear-gradient(90deg, #ff5c5c, #ff9a7c)',
            transition: 'width 0.4s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          <span style={{ fontSize: 7, color: '#94a7c4' }}>
            {diff >= 0 ? '+' : ''}{diff.toFixed(1)} vs expected ({expected.toFixed(1)})
          </span>
          <span style={{ fontSize: 7, color: '#94a7c4' }}>{pct}% left</span>
        </div>
      </div>
    );
  };

  return (
    <Widget title="Side Count" badge="ACE+TEN" badgeColor="text-gold">

      {/* Ace-adjusted TC — the headline number */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderRadius: 8, marginBottom: 12,
        background: adjTC >= 1 ? 'rgba(68,232,130,0.08)' : adjTC <= -1 ? 'rgba(255,92,92,0.08)' : 'rgba(255,255,255,0.04)',
        border: `1.5px solid ${adjTC >= 1 ? 'rgba(68,232,130,0.35)' : adjTC <= -1 ? 'rgba(255,92,92,0.35)' : 'rgba(255,255,255,0.08)'}`,
      }}>
        <div>
          <div style={{ fontSize: 8, color: '#94a7c4', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
            Ace-Adjusted TC
          </div>
          <div style={{ fontSize: 8, color: '#94a7c4' }}>Use this for <b style={{color:'#ffd447'}}>bet sizing</b></div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'DM Mono,monospace', lineHeight: 1, color: adjTcColor }}>
            {adjTC >= 0 ? '+' : ''}{adjTC.toFixed(1)}
          </div>
          <div style={{ fontSize: 9, color: '#94a7c4', marginTop: 2 }}>
            Base TC: <span style={{ color: tcColor, fontFamily: 'DM Mono,monospace' }}>{tc >= 0 ? `+${tc}` : tc}</span>
          </div>
        </div>
      </div>

      {/* Ace side count */}
      {row('Aces', aceRem, aceExp, aceAdj, aceFill, aceColor, aceRich, totalAces)}

      {/* Ten-value side count */}
      {row('10-Values', tenRem, tenExp, tenAdj, tenFill, tenColor, tenRich, totalTens)}

      {/* Explanation note */}
      <div style={{
        padding: '6px 8px', borderRadius: 6, marginTop: 4,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        fontSize: 8, color: '#94a7c4', lineHeight: 1.6,
      }}>
        <b style={{ color: '#b0bfd8' }}>Bet sizing only</b> — use Ace-adjusted TC to decide how much to bet.
        Use plain TC for all <b style={{ color: '#b0bfd8' }}>strategy plays</b> (hit/stand/double/split).
      </div>
    </Widget>
  );
}
