/*
 * components/BetSpreadHelper.js
 * ─────────────────────────────────────────────────────────────
 * Visual Bet Spread Helper — horizontal bar chart showing the
 * optimal TC→units spread, with real-time EV/hour estimate,
 * hourly hands projection, and a "where you are now" marker.
 *
 * Complements BettingRampPanel (table format) with a visual,
 * at-a-glance view designed for quick reads at the table.
 *
 * PROPS:
 *   count    — { effective_true, true, running, system }
 *   betting  — { recommended_bet, units, bankroll, spread_bet }
 *   currency — { symbol }
 *   shoe     — { penetration }
 */

var BetSpreadHelper = (function () {
  var useState = React.useState;
  var useMemo  = React.useMemo;

  // Standard Hi-Lo ramp: TC → unit multiplier
  var RAMP = [
    { tc: -2, units: 0,  label: 'Wong Out',  signal: 'OUT'  },
    { tc: -1, units: 0,  label: 'Wong Out',  signal: 'OUT'  },
    { tc:  0, units: 0,  label: 'Sit Out',   signal: 'WAIT' },
    { tc:  1, units: 1,  label: 'Table Min',  signal: 'MIN'  },
    { tc:  2, units: 2,  label: 'Bet Up',     signal: 'UP'   },
    { tc:  3, units: 4,  label: 'Press',      signal: 'PRESS'},
    { tc:  4, units: 6,  label: 'Strong',     signal: 'BIG'  },
    { tc:  5, units: 8,  label: 'Max Bet',    signal: 'MAX'  },
    { tc:  6, units: 10, label: 'Full Max',   signal: 'MAX+' },
    { tc:  7, units: 12, label: 'Table Max',  signal: 'CAP'  },
  ];

  // Colour gradient by units
  function barColor(units, maxUnits) {
    if (units === 0) return '#394362';
    var ratio = units / maxUnits;
    if (ratio >= 0.8) return '#44e882';
    if (ratio >= 0.5) return '#6aafff';
    if (ratio >= 0.25) return '#ffd447';
    return '#b99bff';
  }

  function BetSpreadHelper(props) {
    var count    = props.count    || {};
    var betting  = props.betting  || {};
    var currency = props.currency || { symbol: '₹' };
    var shoe     = props.shoe     || {};
    var sym      = currency.symbol || '₹';

    var _spread = useState(12);
    var maxSpread   = _spread[0];
    var setMaxSpread = _spread[1];

    var _unit = useState(null);
    var unitOverride = _unit[0];
    var setUnitOverride = _unit[1];

    var _handsPerHour = useState(80);
    var handsPerHour = _handsPerHour[0];
    var setHandsPerHour = _handsPerHour[1];

    // Current TC (effective for KO)
    var rawTC = typeof count.effective_true === 'number' ? count.effective_true
                  : (typeof count.true === 'number' ? count.true : 0);
    var systemName = (count.system || 'hi_lo').replace('_', '-').toUpperCase();

    // FIX MAJ-06: Normalize TC to Hi-Lo equivalent for ramp lookup.
    // Level-2/3 systems (Omega II, Zen, Wong Halves) produce raw TC ~2-3x
    // larger than Hi-Lo, which would make the spread chart show fake-high bets.
    // Normalization factors: Hi-Lo scalar = 10, Omega II = 20, Zen = 18, etc.
    var NORM_SCALARS = {
      'HI-LO': 10, 'HI-OPT-I': 10, 'HI-OPT-II': 18, 'KO': 10,
      'OMEGA-II': 20, 'ZEN': 18, 'WONG-HALVES': 10, 'HALVES': 10,
      'RED-7': 10, 'USTON-APC': 23, 'USTON-SS': 18,
    };
    var sysScalar = NORM_SCALARS[systemName] || 10;
    var hiloScalar = 10;
    var currentTC = rawTC / (sysScalar / hiloScalar);

    // Base unit
    var baseUnit = useMemo(function () {
      if (unitOverride !== null) return unitOverride;
      if (betting.spread_bet && maxSpread > 0) return Math.max(betting.spread_bet / maxSpread, 1);
      if (betting.recommended_bet && betting.units > 0) {
        return Math.round(betting.recommended_bet / betting.units);
      }
      return 100;
    }, [betting, maxSpread, unitOverride]);

    // Build ramp with current spread cap
    var rampRows = useMemo(function () {
      return RAMP.map(function (r) {
        var cappedUnits = Math.min(r.units, maxSpread);
        return {
          tc: r.tc, units: cappedUnits, label: r.label, signal: r.signal,
          dollars: cappedUnits * baseUnit,
          isActive: Math.floor(currentTC) === r.tc ||
                    (r.tc === 7 && currentTC >= 7) ||
                    (r.tc === -2 && currentTC <= -2),
          barPct: maxSpread > 0 ? (cappedUnits / maxSpread * 100) : 0,
        };
      });
    }, [maxSpread, baseUnit, currentTC]);

    var activeRow = rampRows.find(function (r) { return r.isActive; }) || rampRows[3];

    // EV/hour estimate
    // Edge per unit at each TC: (TC * 0.5 - 0.43) / 100
    // Weighted by assumed TC distribution
    var evPerHour = useMemo(function () {
      // Simplified: edge at current TC
      var edgePct = (currentTC * 0.5 - 0.43);
      var betNow = activeRow.units * baseUnit;
      var evHand = betNow * (edgePct / 100);
      return evHand * handsPerHour;
    }, [currentTC, activeRow, baseUnit, handsPerHour]);

    function fmtMoney(n) {
      if (Math.abs(n) >= 100000) return (n / 1000).toFixed(0) + 'K';
      if (Math.abs(n) >= 10000)  return (n / 1000).toFixed(1) + 'K';
      return Math.round(n).toLocaleString();
    }

    return React.createElement('div', { className: 'bsh-wrap widget-card' },

      // Title bar
      React.createElement('div', { className: 'bsh-header' },
        React.createElement('span', { className: 'bsh-title' }, 'Bet Spread'),
        React.createElement('span', { className: 'bsh-sys' }, systemName)
      ),

      // Current signal — large
      React.createElement('div', { className: 'bsh-signal-row' },
        React.createElement('div', { className: 'bsh-signal' },
          React.createElement('span', { className: 'bsh-sig-label' }, 'NOW'),
          React.createElement('span', {
            className: 'bsh-sig-tc',
            style: { color: currentTC >= 2 ? '#44e882' : currentTC >= 0 ? '#6aafff' : '#ff5c5c' }
          }, 'TC ' + (currentTC >= 0 ? '+' : '') + currentTC.toFixed(1)),
          React.createElement('span', {
            className: 'bsh-sig-bet',
            style: { color: barColor(activeRow.units, maxSpread) }
          }, activeRow.units > 0
            ? activeRow.units + 'u · ' + sym + fmtMoney(activeRow.dollars)
            : activeRow.signal
          )
        ),
        // EV/hour
        React.createElement('div', { className: 'bsh-ev-box' },
          React.createElement('span', { className: 'bsh-ev-label' }, 'EV/hour'),
          React.createElement('span', {
            className: 'bsh-ev-value',
            style: { color: evPerHour >= 0 ? '#44e882' : '#ff5c5c' }
          }, (evPerHour >= 0 ? '+' : '') + sym + fmtMoney(evPerHour))
        )
      ),

      // Bar chart
      React.createElement('div', { className: 'bsh-chart' },
        rampRows.map(function (row) {
          var color = barColor(row.units, maxSpread);
          return React.createElement('div', {
            key: row.tc,
            className: 'bsh-bar-row' + (row.isActive ? ' bsh-bar-active' : ''),
          },
            // TC label
            React.createElement('span', { className: 'bsh-bar-tc' },
              (row.tc >= 0 ? '+' : '') + row.tc
            ),
            // Bar
            React.createElement('div', { className: 'bsh-bar-track' },
              React.createElement('div', {
                className: 'bsh-bar-fill',
                style: {
                  width: Math.max(row.barPct, 2) + '%',
                  background: row.units > 0
                    ? 'linear-gradient(90deg, ' + color + '66, ' + color + ')'
                    : '#262f44',
                }
              }),
              // Active marker
              row.isActive && React.createElement('div', { className: 'bsh-bar-marker' }, '◆')
            ),
            // Bet label
            React.createElement('span', { className: 'bsh-bar-label' },
              row.units > 0
                ? row.units + 'u · ' + sym + fmtMoney(row.dollars)
                : row.signal
            )
          );
        })
      ),

      // Controls row
      React.createElement('div', { className: 'bsh-controls' },
        // Spread selector
        React.createElement('div', { className: 'bsh-ctrl-group' },
          React.createElement('span', { className: 'bsh-ctrl-label' }, 'Spread'),
          [4, 8, 12, 16].map(function (s) {
            return React.createElement('button', {
              key: s,
              className: 'bsh-btn' + (maxSpread === s ? ' active' : ''),
              onClick: function () { setMaxSpread(s); },
            }, '1:' + s);
          })
        ),
        // Unit override
        React.createElement('div', { className: 'bsh-ctrl-group' },
          React.createElement('span', { className: 'bsh-ctrl-label' }, '1u ='),
          React.createElement('input', {
            className: 'bsh-unit-input',
            type: 'number',
            value: unitOverride !== null ? unitOverride : Math.round(baseUnit),
            min: 1,
            onChange: function (e) {
              var v = parseFloat(e.target.value);
              setUnitOverride(isNaN(v) || v <= 0 ? null : v);
            }
          })
        ),
        // Hands/hour
        React.createElement('div', { className: 'bsh-ctrl-group' },
          React.createElement('span', { className: 'bsh-ctrl-label' }, 'Hands/hr'),
          React.createElement('input', {
            className: 'bsh-unit-input',
            type: 'number',
            value: handsPerHour,
            min: 20, max: 200, step: 10,
            onChange: function (e) {
              var v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v > 0) setHandsPerHour(v);
            }
          })
        )
      )
    );
  }

  return BetSpreadHelper;
})();