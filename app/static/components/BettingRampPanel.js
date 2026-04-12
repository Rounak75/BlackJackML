/*
 * components/BettingRampPanel.js
 * ─────────────────────────────────────────────────────────────
 * True Count Betting Ramp — shows the full TC→Units→$ table
 * and highlights the current TC row live.
 *
 * PROPS:
 *   count    — { true, running, system, advantage, decks_remaining }
 *   betting  — { recommended_bet, units, bankroll, spread_bet }
 *   currency — { symbol }
 *   baseUnit — number (optional override; defaults to betting.bankroll/200)
 *
 * The ramp is configurable:
 *   • minTC / maxTC  — range of TCs to display (default -2 to +6)
 *   • spread         — max-to-min bet ratio (default 12)
 *   • minBet         — table minimum (1 unit)
 *
 * Ramp formula (Hi-Lo standard):
 *   TC ≤ 1          → 1 unit (minimum)
 *   TC = 2          → 2 units
 *   TC = 3          → 4 units
 *   TC = 4          → 6 units
 *   TC = 5          → 8 units
 *   TC ≥ 6          → max spread (12 units default)
 *
 * For unbalanced systems (KO) the ramp displays but notes
 * that the Running Count pivot should be used instead of TC.
 */

var BettingRampPanel = function BettingRampPanel(props) {
  var useState = React.useState;
  var useMemo  = React.useMemo;

  var count    = props.count    || {};
  var betting  = props.betting  || {};
  var currency = props.currency || { symbol: '$' };
  var sym      = currency.symbol || '$';

  // ── Config state ──────────────────────────────────────────────────────
  var _spread = useState(12);
  var spread    = _spread[0];
  var setSpread = _spread[1];

  var _minBet = useState(null);     // null = derive from betting.recommended_bet
  var minBet    = _minBet[0];
  var setMinBet = _minBet[1];

  var _expanded = useState(false);
  var expanded    = _expanded[0];
  var setExpanded = _expanded[1];

  // ── Derived values ────────────────────────────────────────────────────
  // Use effective_true (IRC-adjusted) so KO ramp starts at 0 not -3.5
  var currentTC    = typeof count.effective_true === 'number' ? count.effective_true
                   : (typeof count.true === 'number' ? count.true : 0);
  var systemName   = (count.system || 'hi_lo').replace('_', '-').toUpperCase();
  var isKO         = count.is_ko || count.system === 'ko';
  var currentRC    = typeof count.running === 'number' ? count.running : 0;

  // Base unit: use the server's spread_bet / spread as a stable unit,
  // or fall back to recommended_bet / units when available.
  var serverUnit = useMemo(function () {
    if (minBet !== null) return minBet;
    if (betting.spread_bet && spread > 0) return Math.max(betting.spread_bet / spread, 1);
    if (betting.recommended_bet && betting.units > 0) {
      return Math.round(betting.recommended_bet / betting.units);
    }
    return 100; // last-resort fallback
  }, [betting.spread_bet, betting.recommended_bet, betting.units, spread, minBet]);

  // ── Ramp definition ───────────────────────────────────────────────────
  // Each entry: { tc, units, label, cls }
  // Units are capped at `spread`.  Below TC+1 = table minimum (1u).
  var rampRows = useMemo(function () {
    var rows = [];
    for (var tc = -2; tc <= 7; tc++) {
      var units, cls, tag;
      if (tc <= 0) {
        units = 0;    cls = 'rp-neg';  tag = 'SIT OUT';
      } else if (tc === 1) {
        units = 1;    cls = 'rp-min';  tag = 'MIN';
      } else if (tc === 2) {
        units = 2;    cls = 'rp-lo';   tag = 'UP';
      } else if (tc === 3) {
        units = 4;    cls = 'rp-mid';  tag = 'BIG';
      } else if (tc === 4) {
        units = 6;    cls = 'rp-hi';   tag = 'STRONG';
      } else if (tc === 5) {
        units = Math.min(8, spread);    cls = 'rp-hot';  tag = 'MAX';
      } else {
        units = spread; cls = 'rp-max'; tag = 'MAX+';
      }
      var dollars = units * serverUnit;
      var isActive = (tc === Math.floor(currentTC)) ||
                     (tc === 7 && currentTC >= 7) ||
                     (tc === -2 && currentTC <= -2);
      rows.push({ tc: tc, units: units, dollars: dollars, cls: cls, tag: tag, isActive: isActive });
    }
    return rows;
  }, [serverUnit, spread, currentTC]);

  // Current row (for compact display)
  var activeRow = rampRows.find(function (r) { return r.isActive; }) || rampRows[1];

  // ── Spread adjuster buttons ───────────────────────────────────────────
  var SPREAD_PRESETS = [4, 8, 12, 16];

  // ── Format ───────────────────────────────────────────────────────────
  function fmtMoney(n) {
    if (n >= 100000) return (n / 1000).toFixed(0) + 'K';
    if (n >= 10000)  return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString();
  }

  // ── Render ────────────────────────────────────────────────────────────
  return React.createElement('div', { className: 'brp-wrap widget-card' },

    // ── Header (always visible) ──────────────────────────────────────
    React.createElement('div', {
      className: 'brp-header',
      onClick: function () { setExpanded(function (v) { return !v; }); },
      style: { cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
    },
      React.createElement('div', { className: 'brp-title-row' },
        React.createElement('span', { className: 'brp-title' }, 'Bet Ramp'),
        React.createElement('span', { className: 'brp-sys' }, systemName),
        isKO && React.createElement('span', {
          className: 'brp-ko-warn',
          title: 'KO is unbalanced — use Running Count pivot, not TC'
        }, '⚠ RC')
      ),

      // Compact: show current bet signal
      !expanded && React.createElement('div', { className: 'brp-compact-signal' },
        React.createElement('span', { className: 'brp-sig-tc' },
          'TC ' + (currentTC >= 0 ? '+' : '') + currentTC.toFixed(1)
        ),
        React.createElement('span', { className: 'brp-sig-chip ' + activeRow.cls },
          activeRow.units > 0 ? activeRow.units + 'u · ' + sym + fmtMoney(activeRow.dollars) : activeRow.tag
        )
      ),

      React.createElement('span', { className: 'brp-toggle' }, expanded ? '▲' : '▼')
    ),

    // ── Expanded body ────────────────────────────────────────────────
    expanded && React.createElement('div', { className: 'brp-body' },

      // KO note
      isKO && React.createElement('div', { className: 'brp-ko-note' },
        '⚠ KO is unbalanced. This ramp uses converted TC for reference only. ' +
        'For real KO play, use Running Count: RC ≥ 0 = bet up, RC ≥ +4 = max.'
      ),

      // Spread preset buttons
      React.createElement('div', { className: 'brp-controls' },
        React.createElement('span', { className: 'brp-ctrl-label' }, 'Spread'),
        SPREAD_PRESETS.map(function (p) {
          return React.createElement('button', {
            key: p,
            className: 'brp-preset' + (spread === p ? ' active' : ''),
            onClick: function (e) { e.stopPropagation(); setSpread(p); }
          }, '1:' + p);
        }),
        React.createElement('span', { className: 'brp-ctrl-label', style: { marginLeft: 8 } }, '1u ='),
        React.createElement('input', {
          className: 'brp-unit-input',
          type: 'number',
          value: minBet !== null ? minBet : Math.round(serverUnit),
          min: 1,
          onClick: function (e) { e.stopPropagation(); },
          onChange: function (e) {
            var v = parseFloat(e.target.value);
            setMinBet(isNaN(v) || v <= 0 ? null : v);
          },
          title: 'Override base unit (1u = table minimum)'
        })
      ),

      // Ramp table
      React.createElement('table', { className: 'brp-table' },
        React.createElement('thead', null,
          React.createElement('tr', null,
            React.createElement('th', { className: 'brp-th' }, 'TC'),
            React.createElement('th', { className: 'brp-th' }, 'Units'),
            React.createElement('th', { className: 'brp-th' }, 'Bet'),
            React.createElement('th', { className: 'brp-th' }, 'Signal')
          )
        ),
        React.createElement('tbody', null,
          rampRows.map(function (row) {
            return React.createElement('tr', {
              key: row.tc,
              className: 'brp-row' + (row.isActive ? ' brp-active' : '')
            },
              React.createElement('td', { className: 'brp-td brp-tc' },
                (row.tc > 0 ? '+' : '') + row.tc + (row.tc === 7 ? '+' : '')
              ),
              React.createElement('td', { className: 'brp-td brp-units ' + row.cls },
                row.units > 0 ? row.units + 'u' : '—'
              ),
              React.createElement('td', { className: 'brp-td brp-dollars ' + row.cls },
                row.units > 0 ? sym + fmtMoney(row.dollars) : '—'
              ),
              React.createElement('td', { className: 'brp-td' },
                React.createElement('span', { className: 'brp-tag ' + row.cls }, row.tag)
              )
            );
          })
        )
      ),

      // Footer: live read
      React.createElement('div', { className: 'brp-live' },
        React.createElement('span', { className: 'brp-live-label' }, 'NOW →'),
        React.createElement('span', { className: 'brp-live-tc' },
          'TC ' + (currentTC >= 0 ? '+' : '') + currentTC.toFixed(1)
        ),
        activeRow.units > 0
          ? React.createElement('span', { className: 'brp-live-bet ' + activeRow.cls },
              activeRow.units + 'u  ·  ' + sym + fmtMoney(activeRow.dollars)
            )
          : React.createElement('span', { className: 'brp-live-bet rp-neg' }, 'SIT OUT')
      )
    )
  );
};