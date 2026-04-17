/*
 * components/OutcomeStrip.js
 * ─────────────────────────────────────────────────────────
 * CRIT-03: Center-column outcome recording strip.
 *
 * Replaces the need to look at the left-column BettingPanel
 * to record hand results. Positioned directly below CenterToolbar
 * where the user's attention already is.
 *
 * Props:
 *   onRecordResult — (result, bet, profit) => void
 *   activeBet      — current active bet amount
 *   effectiveBet   — doubled bet if applicable
 *   isDoubled      — boolean
 *   tookInsurance  — boolean
 *   insurance      — insurance object
 *   dealerHand     — dealer hand object (for insurance calc)
 *   currency       — { symbol, code, isCrypto, decimals }
 *   playerHand     — player hand object (for phase detection)
 */

function OutcomeStrip({
  onRecordResult, activeBet, effectiveBet, isDoubled,
  tookInsurance, insurance, dealerHand, currency, playerHand
}) {
  var cur = currency || { symbol: '$', isCrypto: false };
  var bet = effectiveBet || activeBet || 100;

  // Only show when we have player cards (mid-hand or post-hand)
  var hasCards = playerHand && playerHand.cards && playerHand.cards.length >= 2;

  var fmtBet = function (n) {
    return cur.isCrypto ? n.toFixed(cur.decimals || 4) : n.toLocaleString();
  };

  var calcProfit = function (result) {
    var profit;
    if (result === 'win') profit = bet;
    else if (result === 'push') profit = 0;
    else if (result === 'loss') profit = -bet;
    else if (result === 'surrender') profit = -(activeBet * 0.5);
    else profit = 0;

    // Insurance adjustment
    if (tookInsurance && insurance && insurance.available) {
      var halfBet = activeBet * 0.5;
      var dealerBj = dealerHand && dealerHand.is_blackjack;
      profit += dealerBj ? halfBet * 2 : -halfBet;
    }
    return profit;
  };

  var outcomes = [
    { label: 'WIN', result: 'win', icon: '🏆', color: '#44e882', bg: 'rgba(68,232,130,0.1)', border: 'rgba(68,232,130,0.45)', hoverBg: 'rgba(68,232,130,0.22)' },
    { label: 'PUSH', result: 'push', icon: '🤝', color: '#6aafff', bg: 'rgba(106,175,255,0.1)', border: 'rgba(106,175,255,0.45)', hoverBg: 'rgba(106,175,255,0.22)' },
    { label: 'LOSS', result: 'loss', icon: '💀', color: '#ff5c5c', bg: 'rgba(255,92,92,0.1)', border: 'rgba(255,92,92,0.45)', hoverBg: 'rgba(255,92,92,0.22)' },
    { label: 'SURR', result: 'surrender', icon: '🏳', color: '#ff9a20', bg: 'rgba(255,154,32,0.1)', border: 'rgba(255,154,32,0.45)', hoverBg: 'rgba(255,154,32,0.22)' },
  ];

  return React.createElement('div', {
    style: {
      background: '#1c2540',
      border: '1.5px solid rgba(255,255,255,0.1)',
      borderRadius: 10,
      padding: hasCards ? '10px 12px' : '6px 12px',
      transition: 'all 0.2s ease',
    },
    role: 'group',
    'aria-label': 'Record hand outcome',
  },
    // Header
    React.createElement('div', {
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: hasCards ? 8 : 4,
      }
    },
      React.createElement('div', {
        style: {
          display: 'flex', alignItems: 'center', gap: 6,
        }
      },
        React.createElement('span', {
          style: {
            fontSize: 10, fontWeight: 800, color: hasCards ? '#ccdaec' : '#6b7f96',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            fontFamily: 'Syne, sans-serif',
          }
        }, hasCards ? 'Record Result' : 'Manual Override'),
        React.createElement('span', {
          style: {
            fontSize: 8, color: '#6b7f96', fontStyle: 'italic',
          }
        }, 'auto-resolves when outcome is clear')
      ),
      // Bet amount badge
      React.createElement('div', {
        style: {
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 10, fontWeight: 700, fontFamily: 'DM Mono, monospace',
          color: '#94a7c4',
        }
      },
        React.createElement('span', null, cur.symbol + fmtBet(activeBet)),
        isDoubled && React.createElement('span', {
          style: { color: '#ffd447', fontSize: 9 }
        }, '×2')
      )
    ),

    // Outcome buttons — horizontal strip
    React.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 6,
      }
    },
      outcomes.map(function (o) {
        var profit = calcProfit(o.result);
        var profitStr = profit >= 0
          ? '+' + cur.symbol + fmtBet(Math.abs(profit))
          : '-' + cur.symbol + fmtBet(Math.abs(profit));

        return React.createElement('button', {
          key: o.result,
          'aria-label': 'Record hand result as ' + o.result + ' (' + profitStr + ')',
          onClick: function () {
            onRecordResult(
              o.result === 'surrender' ? 'loss' : o.result,
              bet,
              profit
            );
          },
          style: {
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 2, padding: hasCards ? '10px 0' : '8px 0',
            borderRadius: 8,
            background: o.bg,
            border: '1.5px solid ' + o.border,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            position: 'relative',
          },
          onMouseEnter: function (e) {
            e.currentTarget.style.background = o.hoverBg;
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
          },
          onMouseLeave: function (e) {
            e.currentTarget.style.background = o.bg;
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          },
        },
          // Icon + Label row
          React.createElement('div', {
            style: {
              display: 'flex', alignItems: 'center', gap: 4,
            }
          },
            React.createElement('span', {
              style: { fontSize: 12 },
              'aria-hidden': 'true',
            }, o.icon),
            React.createElement('span', {
              style: {
                fontSize: hasCards ? 13 : 11, fontWeight: 800,
                color: o.color, fontFamily: 'DM Mono, monospace',
                letterSpacing: '0.03em',
              }
            }, o.label)
          ),
          // Profit preview
          React.createElement('span', {
            style: {
              fontSize: 9, fontWeight: 600, fontFamily: 'DM Mono, monospace',
              color: profit >= 0 ? 'rgba(68,232,130,0.7)' : 'rgba(255,92,92,0.7)',
            }
          }, profitStr)
        );
      })
    )
  );
}