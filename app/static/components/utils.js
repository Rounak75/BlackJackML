/*
 * utils.js — Shared Helper Functions
 * ─────────────────────────────────────────────────────────────────────
 *
 * WHAT THIS FILE IS:
 *   Small utility functions used by multiple components. By putting them
 *   here once, we avoid copy-pasting the same code into 10 different files.
 *
 * FUNCTIONS IN THIS FILE:
 *   countClass()         → CSS class name for colourising count numbers
 *   cellClass()          → CSS class name for strategy table cells
 *   actionClass()        → CSS class name for the big HIT/STAND text
 *   showToast()          → Shows a pop-up notification message
 *   formatMoney()        → Formats a number as "+$150" or "-$50"
 *   DEVIATION_TOOLTIPS   → Explanations for each Illustrious 18 deviation
 *   getDeviationTooltip()→ Looks up the tooltip for the active deviation
 *   buildExplanation()   → Builds the "Why this action?" text array
 */


// ── countClass ────────────────────────────────────────────────────────
// Returns a CSS class name based on the count value.
// These classes are defined in style.css and change the text colour:
//   count-hot     → gold/yellow  (TC > 2 — very favourable shoe)
//   count-pos     → green        (TC > 0 — slightly favourable)
//   count-neg     → red          (TC < 0 — unfavourable)
//   count-neutral → grey         (TC = 0 — neutral)
function countClass(val) {
  if (val > 2)  return 'count-hot';
  if (val > 0)  return 'count-pos';
  if (val < 0)  return 'count-neg';
  return 'count-neutral';
}

// ── cellClass ─────────────────────────────────────────────────────────
// Returns the CSS class for a strategy table cell based on the action code.
// Each class has a different background colour so the table is easy to read:
//   s-H   → green   (Hit)
//   s-S   → blue    (Stand)
//   s-D   → yellow  (Double)
//   s-Ds  → orange  (Double or Stand)
//   s-SP  → purple  (Split)
//   s-SUR → red     (Surrender)
function cellClass(code) {
  const map = {
    H: 's-H', S: 's-S', D: 's-D', Ds: 's-Ds',
    SP: 's-SP', 'Y/N': 's-SY', SUR: 's-SUR',
  };
  return map[code] || '';
}

// ── actionClass ───────────────────────────────────────────────────────
// Returns the CSS class for the big action recommendation text.
// Each action gets a different colour defined in style.css:
//   action-hit        → green    (HIT)
//   action-stand      → blue     (STAND)
//   action-double     → yellow   (DOUBLE)
//   action-split      → purple   (SPLIT)
//   action-surrender  → red      (SURRENDER)
function actionClass(action) {
  const map = {
    HIT:          'action-hit',
    STAND:        'action-stand',
    DOUBLE:       'action-double',
    'DOUBLE DOWN':'action-double',
    SPLIT:        'action-split',
    SURRENDER:    'action-surrender',
  };
  return map[action] || '';
}

// ── showToast ─────────────────────────────────────────────────────────
// Shows a small notification message that appears in the top-right corner
// and fades out after 3.5 seconds.
//
// Parameters:
//   msg   — the text to display
//   type  — 'info' (blue) | 'success' (green) | 'warning' (yellow) | 'error' (red)
//
// The toast container <div id="toasts"> is in index.html.
// The CSS for .toast is in style.css.
function showToast(msg, type = 'info') {
  const container = document.getElementById('toasts');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  // After 3.5 seconds: fade out, then remove the element from the DOM
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// ── formatMoney ───────────────────────────────────────────────────────
// Formats a number with a sign prefix and dollar sign.
// Examples:
//   formatMoney(150)  → "+$150"
//   formatMoney(-50)  → "-$50"
//   formatMoney(0)    → "+$0"
function formatMoney(n) {
  const abs = Math.abs(n || 0);
  return `${(n || 0) >= 0 ? '+' : '-'}$${abs.toFixed(0)}`;
}


// ── DEVIATION_TOOLTIPS ────────────────────────────────────────────────
// Detailed plain-English explanations for each Illustrious 18 / Fab 4
// deviation. Shown in the ActionPanel when a deviation is active.
//
// KEY FORMAT:  "player_hand_value:dealer_upcard:action"
// EXAMPLE KEY: "16:10:STAND"
//   → Player has hard 16, dealer shows 10, and the deviation says STAND
//
// Each entry has three fields:
//   why      — what the current shoe composition looks like
//   mechanic — the math reason why the deviation is correct right now
//   tip      — a practical note for the player
const DEVIATION_TOOLTIPS = {
  // ── Illustrious 18 ─────────────────────────────────────────────────
  '16:10:STAND': {
    why:      'At TC ≥ 0 the shoe is neutral-to-rich in 10-value cards.',
    mechanic: 'A 10-rich shoe means the dealer is more likely to hold a 20 already — drawing into 26 hurts you more than standing on 16.',
    tip:      'This is the single most common deviation. Standing on 16 vs 10 when the count is ≥ 0 saves roughly 0.05% edge per occurrence.',
  },
  '15:10:STAND': {
    why:      'At TC ≥ +4 the shoe is strongly rich in 10s.',
    mechanic: 'With so many 10s remaining, your bust risk on 15 is high AND the dealer is more likely to already have 20. Standing sacrifices a small chance at improving for a better chance the dealer busts.',
    tip:      'This only triggers at TC +4 or higher — a rare, powerful spot.',
  },
  '10:10:DOUBLE': {
    why:      'At TC ≥ +4 the shoe is loaded with 10-value cards.',
    mechanic: 'Hard 10 vs dealer 10 normally favours hitting, but at TC +4 the probability of drawing a 10 (giving you 20) is high enough to justify doubling your bet.',
    tip:      'This is an aggressive play — only correct at very high counts.',
  },
  '10:11:DOUBLE': {
    why:      'At TC ≥ +4 the shoe is heavily weighted toward 10s.',
    mechanic: 'Hard 10 vs Ace normally goes against doubling because of dealer blackjack risk. The dense 10s flip the EV positive — you profit from getting a 10 more often than you lose to dealer BJ.',
    tip:      'Even at TC +4 this has slim margins. Only deviate if you are confident in the count.',
  },
  '11:11:DOUBLE': {
    why:      'At TC ≥ +1 the shoe has a slight 10-card lean.',
    mechanic: 'Hard 11 vs Ace is a hit in basic strategy because of insurance-implied blackjack risk. Once the count is positive, your expected value from doubling exceeds the risk.',
    tip:      'This is one of the earliest deviations to activate — TC +1 is not a strong count, so the edge here is modest.',
  },
  '9:2:DOUBLE': {
    why:      'At TC ≥ +1 slightly more 10s remain than average.',
    mechanic: 'Hard 9 vs dealer 2 is normally a hit. At TC +1, getting a 10 on the double (making 19) is frequent enough to overtake the plain-hit EV.',
    tip:      'A small-edge deviation. Only worth making in a real casino if you are comfortable maintaining the count accurately.',
  },
  '9:7:DOUBLE': {
    why:      'At TC ≥ +3 the shoe is significantly 10-rich.',
    mechanic: 'Dealer 7 has strong hitting hands (17) but a dense-10 shoe means you profit more by doubling your 9 — the extra bet is covered by the high frequency of landing a 19 or 20.',
    tip:      'TC +3 is a meaningful count advantage. Make this play confidently when triggered.',
  },
  '12:2:STAND': {
    why:      'At TC ≥ +3 the shoe has many 10s left.',
    mechanic: 'Hard 12 vs dealer 2 is normally a hit because the dealer upcard is weak. At TC +3 your own bust risk on 12 becomes significant enough — and the dealer bust probability high enough — that standing is better EV.',
    tip:      'Dealer 2 is deceptively dangerous for the dealer. A 10-rich shoe raises their bust probability above the break-even threshold.',
  },
  '12:3:STAND': {
    why:      'At TC ≥ +2 there are extra 10-value cards in the remaining shoe.',
    mechanic: 'Dealer 3 already has a 40%+ bust rate. Add a 10-heavy shoe and standing on your 12 — rather than risking a bust draw — becomes the higher-EV play.',
    tip:      'TC +2 is achievable mid-shoe. This is one of the more frequently triggered I18 deviations.',
  },
  '12:4:HIT': {
    why:      'At TC < 0 the shoe has fewer 10s than average — more small cards remain.',
    mechanic: 'Basic strategy says stand on 12 vs 4 because the dealer has a strong bust card. But a low-card-rich shoe means your hit is less likely to bust you, and the dealer is less likely to bust too.',
    tip:      'Negative-count deviations feel counterintuitive. Trust the math — hitting 12 vs 4 at TC < 0 is a small but real gain.',
  },
  '12:5:HIT': {
    why:      'At TC < −2 the shoe is heavy in small cards.',
    mechanic: 'Dealer 5 is the worst upcard for dealers, but a low-card shoe dramatically reduces their bust rate. Your 12 can safely absorb a small card hit rather than surrendering EV by standing.',
    tip:      'TC −2 or below is a strongly negative shoe. This deviation is rare in live play.',
  },
  '12:6:HIT': {
    why:      'At TC < −1 small cards dominate the remaining shoe.',
    mechanic: 'Dealer 6 normally makes standing on 12 correct. A small-card-rich shoe lowers dealer bust probability enough that hitting your 12 becomes better EV — you are likely to improve without busting.',
    tip:      'Dealer 6 is usually the worst upcard — this deviation only activates when the count really drops.',
  },
  '13:2:HIT': {
    why:      'At TC < −1 there are more small cards than usual remaining.',
    mechanic: 'Basic strategy says stand on 13 vs 2 because of dealer bust risk. At TC −1 the 10-card density drops, your draw is safer, and the dealer busts less — making hitting the right play.',
    tip:      'Like all negative-count deviations, this feels wrong but is mathematically verified.',
  },
  '13:3:HIT': {
    why:      'At TC < −2 the shoe is dominated by low-value cards.',
    mechanic: 'Dealer 3 has reasonable bust potential, but a deeply negative shoe neutralises it. Your 13 is likely to improve safely, making hitting higher EV than standing.',
    tip:      'TC −2 is a significant negative count — bet minimums and apply these deviations precisely.',
  },
  '16:9:STAND': {
    why:      'At TC ≥ +5 the shoe is extremely 10-rich.',
    mechanic: 'Hard 16 vs dealer 9 normally demands a hit. At TC +5, the shoe composition is so dense in 10s that the dealer is likely to reach 19 regardless — standing avoids the almost-certain bust on your draw.',
    tip:      'TC +5 is rare. When it happens, the shoe is very favourable overall — you should also be at maximum bet.',
  },
  '10:9:DOUBLE': {
    why:      'At TC ≥ +2 the shoe leans toward 10-value cards.',
    mechanic: 'Hard 10 vs dealer 9 is a hit in basic strategy. At TC +2, pulling a 10 (giving you 20 vs dealer 9) is frequent enough that doubling your bet returns more EV than a plain hit.',
    tip:      'This is one of the strongest mid-count doubles available. Make it confidently at TC +2.',
  },
  // Pair splits from I18
  '10:5:SPLIT': {
    why:      'At TC ≥ +5 the shoe is loaded with 10-value cards.',
    mechanic: 'Splitting 10s against dealer 5 turns one strong hand (20) into two hands that will likely each land a 10 (giving 20 twice). The dealer\'s extreme bust probability at 5 makes this profitable.',
    tip:      'This is a very aggressive play that draws casino attention. Only use if you are comfortable with the heat.',
  },
  '10:6:SPLIT': {
    why:      'At TC ≥ +4 the shoe has a heavy 10-card concentration.',
    mechanic: 'Dealer 6 has the highest bust rate of any upcard. Splitting your 10s means two bets are working against the dealer\'s near-guaranteed bust, while the 10-rich shoe makes each new hand likely to land another 20.',
    tip:      'Splitting 10s is the most attention-drawing deviation at a casino. Use sparingly.',
  },
  // ── Fab 4 Surrenders ───────────────────────────────────────────────
  '14:10:SURRENDER': {
    why:      'At TC ≥ +3 there are many 10-value cards remaining.',
    mechanic: 'Hard 14 vs dealer 10 is already a losing proposition. At TC +3 the dealer is very likely to have 20 already, and your 14 cannot realistically improve to beat 20 without high bust risk. Surrendering loses only half your bet.',
    tip:      'Fab 4 surrenders save roughly 0.05% total edge. Every correct surrender compounds over a session.',
  },
  '15:10:SURRENDER': {
    why:      'At TC ≥ 0 the shoe is at least neutral in 10s.',
    mechanic: 'Hard 15 against dealer 10 is a basic-strategy surrender already. At any non-negative count this is reinforced — the dealer likely has 20, your 15 is very likely to bust or lose even if it doesn\'t.',
    tip:      'This fires at TC ≥ 0, so it activates often. Always surrender 15 vs 10 when surrender is available.',
  },
  '15:9:SURRENDER': {
    why:      'At TC ≥ +2 the shoe has above-average 10s.',
    mechanic: 'Dealer 9 with a 10-rich shoe likely results in 19. Hard 15 has high bust probability AND will lose to dealer 19 even when it doesn\'t bust — surrendering for half the bet is better EV.',
    tip:      'TC +2 is a common count to reach mid-shoe. This deviation fires regularly in real sessions.',
  },
  '15:11:SURRENDER': {
    why:      'At TC ≥ +1 even a slight 10-lean makes dealer Ace very dangerous.',
    mechanic: 'Dealer Ace plus a 10-rich shoe means a high probability of dealer 21. Your hard 15 will bust or lose to 21 almost every time. Half your bet back now is better than full loss.',
    tip:      'This triggers at TC +1 — very common. Surrender 15 vs Ace whenever available and the count is positive.',
  },
};

// ── getDeviationTooltip ───────────────────────────────────────────────
// Looks up the tooltip for the currently active deviation and returns a
// formatted object with trigger, why, mechanic, and tip fields.
//
// Parameters:
//   dev    — the deviation_info object from the server
//   action — the recommended action string (e.g. 'STAND')
//   basic  — the basic strategy action (what we'd do without deviation)
//   tc     — current True Count number
//
// Returns: { trigger, why, mechanic, tip } or null if no deviation
function getDeviationTooltip(dev, action, basic, tc) {
  if (!dev) return null;

  // Build the lookup key: "hand_value:dealer_upcard:action"
  const key = `${dev.hand_value}:${dev.dealer_upcard}:${action}`;
  const entry = DEVIATION_TOOLTIPS[key];
  const tcStr = typeof tc === 'number' ? tc.toFixed(1) : tc;

  if (entry) {
    return {
      trigger:  `TC ${dev.direction} ${dev.tc_threshold} (current: ${tcStr})`,
      why:      entry.why,
      mechanic: entry.mechanic,
      tip:      entry.tip,
    };
  }

  // Generic fallback for any deviation not in the table above
  return {
    trigger:  `TC ${dev.direction} ${dev.tc_threshold} (current: ${tcStr})`,
    why:      `The current true count (${tcStr}) has shifted the card composition enough to change the optimal play.`,
    mechanic: `Basic strategy says ${basic}. At this count, ${action} has a higher expected value.`,
    tip:      'Count-based deviations are most valuable when applied consistently and accurately.',
  };
}

// ── buildExplanation ──────────────────────────────────────────────────
// Builds the array of explanation lines shown in the ActionPanel under
// "Why this action?". Returns an array of plain strings.
//
// Parameters:
//   action — the recommended action string (e.g. 'STAND')
//   rec    — the full recommendation object from the server
//   count  — the count object from the server
//
// The returned array is rendered line-by-line in ActionPanel.js.
// The first line of a deviation gets purple styling; tip lines get gold.
function buildExplanation(action, rec, count) {
  const tc    = count ? count.true : 0;
  const tcStr = count ? count.true.toFixed(1) : '?';
  const adv   = count ? count.advantage.toFixed(2) : '?';
  const isDev = rec && rec.is_deviation;
  const basic = rec ? rec.basic_action : action;

  let lines = [];

  if (isDev && rec.deviation_info) {
    // Deviation is active — show the deviation-specific explanation
    const tooltip = getDeviationTooltip(rec.deviation_info, action, basic, tc);
    if (tooltip) {
      lines.push(`🔀 Deviation active (${tooltip.trigger})`);
      lines.push(tooltip.why);
      lines.push(tooltip.mechanic);
      lines.push(`💡 ${tooltip.tip}`);
    }
  } else {
    // No deviation — show the standard basic strategy explanation
    lines.push(`Basic strategy recommends ${action} for this situation.`);
    const guidance = {
      HIT:       'Your total is low enough that the risk of busting is outweighed by the chance to improve. Take another card.',
      STAND:     'Your total is strong enough to let the dealer take the bust risk. Do not draw.',
      DOUBLE:    `You have a powerful starting total. Double your bet — you receive exactly one more card. Player edge: ${adv}%.`,
      'DOUBLE DOWN': `Double your bet and receive exactly one more card. Player edge: ${adv}%.`,
      SPLIT:     'Splitting creates two strong independent hands. Play each separately following basic strategy.',
      SURRENDER: 'The dealer upcard is too strong for this hand. Forfeit half your bet rather than risk losing the full amount.',
    };
    if (guidance[action]) lines.push(guidance[action]);
  }

  // Add a count context line at the bottom when the count is notable
  if (count && tc > 2)
    lines.push(`📈 Count is very favourable (TC ${tcStr}) — shoe is rich in high cards.`);
  else if (count && tc < -1)
    lines.push(`📉 Count is unfavourable (TC ${tcStr}) — consider table minimum bets.`);

  return lines;
}
