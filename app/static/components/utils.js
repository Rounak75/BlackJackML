/*
 * components/utils.js
 * ─────────────────────────────────────────────────────────
 * Utility / helper functions shared across all components.
 * No React — pure JS.
 */

/** CSS class for count colouring (running/true count numbers) */
function countClass(val) {
  if (val > 2)  return 'count-hot';
  if (val > 0)  return 'count-pos';
  if (val < 0)  return 'count-neg';
  return 'count-neutral';
}

/** CSS class for a strategy table cell by action code */
function cellClass(code) {
  const map = {
    H: 's-H', S: 's-S', D: 's-D', Ds: 's-Ds',
    SP: 's-SP', 'Y/N': 's-SY', SUR: 's-SUR',
  };
  return map[code] || '';
}

/** CSS class for the big action recommendation text */
function actionClass(action) {
  const map = {
    HIT: 'action-hit',
    STAND: 'action-stand',
    DOUBLE: 'action-double',
    'DOUBLE DOWN': 'action-double',
    SPLIT: 'action-split',
    SURRENDER: 'action-surrender',
  };
  return map[action] || '';
}

/** Show a toast notification — direct DOM manipulation */
function showToast(msg, type = 'info') {
  const container = document.getElementById('toasts');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

/**
 * Format a dollar amount with sign prefix.
 * formatMoney(150)  → "+$150"
 * formatMoney(-50)  → "-$50"
 */
function formatMoney(n) {
  const abs = Math.abs(n || 0);
  return `${(n || 0) >= 0 ? '+' : '-'}$${abs.toFixed(0)}`;
}

/**
 * Build the explanation lines for the AI action recommendation.
 * Returns an array of plain strings.
 */
function buildExplanation(action, rec, count) {
  const tc    = count ? count.true.toFixed(1) : '?';
  const adv   = count ? count.advantage.toFixed(2) : '?';
  const isDev = rec && rec.is_deviation;
  const basic = rec ? rec.basic_action : action;

  let lines = [];

  if (isDev && rec.deviation_info) {
    lines.push(`Count-based deviation active — true count is ${tc}.`);
    lines.push(
      `Basic strategy says ${basic}, but at TC ${rec.deviation_info.description_short || ''}, the optimal play changes to ${action}.`
    );
  } else {
    lines.push(`Basic strategy recommends ${action} for this situation.`);
  }

  const guidance = {
    HIT:
      'Your total is low enough that the risk of busting is less than the risk of standing. Take another card.',
    STAND:
      'Your total is strong enough to let the dealer risk busting. Do not draw.',
    DOUBLE:
      `You have a powerful starting total. Double your bet — you will receive exactly one more card. Current player edge: ${adv}%.`,
    'DOUBLE DOWN':
      `Double your bet and receive exactly one more card. Player edge: ${adv}%.`,
    SPLIT:
      'Split into two independent hands. Play each one separately according to basic strategy.',
    SURRENDER:
      'The dealer upcard is too strong for this hand. Forfeit half your bet now rather than risk losing the full bet.',
  };
  if (guidance[action]) lines.push(guidance[action]);

  if (count && count.true > 2)
    lines.push(`⬆ Count is very favourable (TC ${tc}) — shoe is rich in high cards.`);
  else if (count && count.true < -1)
    lines.push(`⬇ Count is unfavourable (TC ${tc}) — consider minimum bets.`);

  return lines;
}
