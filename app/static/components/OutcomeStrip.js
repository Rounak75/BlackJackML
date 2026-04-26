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
  tookInsurance, insurance, dealerHand, currency, playerHand,
  splitHandsActive
}) {
  var cur = currency || { symbol: '$', isCrypto: false };
  var bet = effectiveBet || activeBet || 100;

  // Only show when we have player cards (mid-hand or post-hand).
  // Pre-hand: render nothing — keeps the card grid above the fold and avoids
  // duplicating the manual-override row that BettingPanel already provides.
  var hasCards = playerHand && playerHand.cards && playerHand.cards.length >= 2;
  if (!hasCards) return null;

  // PHASE 1: gate W/L/Push/Surr until the hand is actually resolved.
  // Resolution = both player and dealer ≥2 cards AND one of:
  //   player BJ, player bust, dealer BJ, dealer bust, dealer stands ≥17.
  // While split hands are in progress the parent strip is meaningless,
  // so disable then too.
  var pCards = (playerHand && playerHand.cards && playerHand.cards.length) || 0;
  var dCards = (dealerHand && dealerHand.card_count) || 0;
  var pBust  = playerHand && playerHand.is_bust;
  var dBust  = dealerHand && dealerHand.is_bust;
  var pBJ    = playerHand && playerHand.is_blackjack;
  var dBJ    = dealerHand && dealerHand.is_blackjack;
  var dStands = dealerHand && (
    dealerHand.dealer_stands !== undefined
      ? dealerHand.dealer_stands
      : (dCards >= 2 && !dBust && dealerHand.value >= 17)
  );
  var isResolved = !splitHandsActive
    && pCards >= 2 && dCards >= 2
    && (pBust || dBust || pBJ || dBJ || dStands);

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
            fontSize: 8, color: !isResolved ? '#ff9a20' : '#6b7f96',
            fontStyle: 'italic', fontWeight: !isResolved ? 700 : 400,
            letterSpacing: '0.04em',
          }
        }, !isResolved
            ? (splitHandsActive ? 'locked — finish splits' : 'locked — awaiting resolution')
            : 'auto-resolves when outcome is clear')
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
        var locked = !isResolved;

        return React.createElement('button', {
          key: o.result,
          disabled: locked,
          'aria-label': locked
            ? o.result + ' — locked until hand resolves'
            : 'Record hand result as ' + o.result + ' (' + profitStr + ')',
          'aria-disabled': locked ? 'true' : undefined,
          title: locked
            ? (splitHandsActive
                ? 'Resolve all split hands first'
                : 'Locked — waiting for player bust / dealer ≥17 / blackjack')
            : undefined,
          onClick: function () {
            if (locked) return;
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
            cursor: locked ? 'not-allowed' : 'pointer',
            opacity: locked ? 0.4 : 1,
            filter: locked ? 'grayscale(40%)' : 'none',
            transition: 'all 0.15s ease',
            position: 'relative',
          },
          onMouseEnter: function (e) {
            if (locked) return;
            e.currentTarget.style.background = o.hoverBg;
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
          },
          onMouseLeave: function (e) {
            if (locked) return;
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


// PHASE 7 T4 — React.memo wrap. Script-mode reassignment of the
// function declaration keeps `function OutcomeStrip(` intact for the
// build.sh smoke check while routing all consumers through memo.
if (typeof React !== 'undefined' && React.memo) {
  OutcomeStrip = React.memo(OutcomeStrip);
}
