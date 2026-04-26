/*
 * components/MultiSystemPanel.js
 * ─────────────────────────────────────────────────────────────
 * Multi-System Comparison — see Hi-Lo, KO, Omega II, Zen,
 * Wong Halves, Uston APC side by side with the same shoe.
 *
 * The server replays the current card_log through every system
 * on demand (socket: 'get_multi_system_compare' → 'multi_system_data').
 *
 * PROPS:
 *   socket   — socket.io ref
 *   count    — current count obj (for active system label)
 *   shoe     — shoe obj (for cards_seen, to know if data is stale)
 */

var MultiSystemPanel = (function () {
  var useState    = React.useState;
  var useEffect   = React.useEffect;
  var useCallback = React.useCallback;
  var useRef      = React.useRef;
  var useMemo     = React.useMemo;

  // Pretty names for system keys
  var SYS_LABELS = {
    hi_lo:      'Hi-Lo',
    ko:         'KO',
    omega_ii:   'Omega II',
    zen:        'Zen',
    wong_halves:'Wong ½',
    uston_apc:  'Uston APC',
  };

  // Display order
  var SYS_ORDER = ['hi_lo', 'ko', 'omega_ii', 'zen', 'wong_halves', 'uston_apc'];

  // Level labels
  var SYS_LEVEL = {
    hi_lo: 'L1', ko: 'L1', omega_ii: 'L2', zen: 'L2',
    wong_halves: 'L3', uston_apc: 'L3',
  };

  // Accent colours per system
  var SYS_COLOR = {
    hi_lo:       '#6aafff',
    ko:          '#ff9f43',
    omega_ii:    '#b99bff',
    zen:         '#44e882',
    wong_halves: '#ffd447',
    uston_apc:   '#ff6b81',
  };

  function MultiSystemPanel(props) {
    // PHASE 7 T3: socket from context.
    var socket = React.useContext(window.SocketContext);
    var count  = props.count || {};
    var shoe   = props.shoe  || {};

    var _data     = useState(null);
    var data      = _data[0];
    var setData   = _data[1];

    var _loading  = useState(false);
    var loading   = _loading[0];
    var setLoading = _loading[1];

    var _expanded = useState(false);
    var expanded  = _expanded[0];
    var setExpanded = _expanded[1];

    var lastFetch = useRef(0);

    // Listen for response
    useEffect(function () {
      if (!socket) return;
      function onData(d) {
        setData(d);
        setLoading(false);
      }
      socket.on('multi_system_data', onData);
      return function () { socket.off('multi_system_data', onData); };
    }, [socket]);

    // Fetch when expanded or shoe changes
    var fetchData = useCallback(function () {
      if (!socket) return;
      setLoading(true);
      socket.emit('get_multi_system_compare');
      lastFetch.current = Date.now();
    }, [socket]);

    // Auto-refresh when panel is open and cards change
    var cardsSeen = shoe.cards_dealt || 0;
    useEffect(function () {
      if (expanded && cardsSeen > 0) {
        fetchData();
      }
    }, [expanded, cardsSeen, fetchData]);

    var activeSystem = (count.system || 'hi_lo');

    // Sort systems: active first, then by order
    var systems = useMemo(function () {
      if (!data) return [];
      return SYS_ORDER.filter(function (k) { return data[k]; }).sort(function (a, b) {
        if (a === activeSystem) return -1;
        if (b === activeSystem) return 1;
        return 0;
      });
    }, [data, activeSystem]);

    // Find the best advantage (highest effective_tc)
    var bestSystem = useMemo(function () {
      if (!data) return null;
      var best = null;
      var bestAdv = -Infinity;
      systems.forEach(function (k) {
        if (data[k].effective_tc > bestAdv) {
          bestAdv = data[k].effective_tc;
          best = k;
        }
      });
      return best;
    }, [data, systems]);

    // Format helpers
    function fmtTC(v) {
      return (v >= 0 ? '+' : '') + v.toFixed(1);
    }
    function fmtAdv(v) {
      return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
    }
    function advColor(v) {
      if (v >= 1.0)  return '#44e882';
      if (v >= 0)    return '#6aafff';
      if (v >= -0.5) return '#ffd447';
      return '#ff5c5c';
    }
    // TC bar width (maps -5..+8 to 0..100%)
    function barWidth(tc) {
      var clamped = Math.max(-5, Math.min(8, tc));
      return ((clamped + 5) / 13 * 100).toFixed(1);
    }

    return React.createElement('div', { className: 'msp-wrap widget-card' },

      // Header
      React.createElement('div', {
        className: 'msp-header',
        onClick: function () { setExpanded(function (v) { return !v; }); },
        style: { cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
      },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('span', { className: 'msp-title' }, 'Multi-System'),
          React.createElement('span', { className: 'msp-badge' }, systems.length + ' SYSTEMS')
        ),
        // Compact summary when collapsed
        !expanded && data && React.createElement('div', {
          style: { display: 'flex', gap: 10, alignItems: 'center', fontSize: 10 }
        },
          React.createElement('span', {
            style: { color: SYS_COLOR[activeSystem] || '#6aafff', fontWeight: 700, fontFamily: 'DM Mono, monospace' }
          }, SYS_LABELS[activeSystem] + ' ' + fmtTC(data[activeSystem]?.effective_tc || 0)),
          bestSystem && bestSystem !== activeSystem && React.createElement('span', {
            style: { color: '#94a7c4', fontSize: 9 }
          }, 'Best: ' + SYS_LABELS[bestSystem])
        ),
        React.createElement('span', { className: 'msp-toggle' }, expanded ? '▲' : '▼')
      ),

      // Body
      expanded && React.createElement('div', { className: 'msp-body' },

        loading && !data && React.createElement('div', {
          style: { textAlign: 'center', padding: 16, color: '#94a7c4', fontSize: 11 }
        }, 'Loading systems…'),

        data && React.createElement('div', { className: 'msp-grid' },

          // Column headers
          React.createElement('div', { className: 'msp-grid-header' },
            React.createElement('span', { className: 'msp-gh', style: { flex: 2 } }, 'System'),
            React.createElement('span', { className: 'msp-gh' }, 'RC'),
            React.createElement('span', { className: 'msp-gh' }, 'TC'),
            React.createElement('span', { className: 'msp-gh' }, 'Edge'),
            React.createElement('span', { className: 'msp-gh', style: { flex: 2 } }, '')
          ),

          // System rows
          systems.map(function (key) {
            var s = data[key];
            var isActive = key === activeSystem;
            var isBest   = key === bestSystem && s.effective_tc > 0;
            var color    = SYS_COLOR[key] || '#6aafff';

            return React.createElement('div', {
              key: key,
              className: 'msp-row' + (isActive ? ' msp-active' : '') + (isBest ? ' msp-best' : ''),
              style: { borderLeftColor: color }
            },
              // System name
              React.createElement('div', { className: 'msp-cell', style: { flex: 2 } },
                React.createElement('span', {
                  className: 'msp-sys-name',
                  style: { color: isActive ? color : '#d0ddf0' }
                }, SYS_LABELS[key] || key),
                React.createElement('span', { className: 'msp-level' }, SYS_LEVEL[key] || ''),
                isActive && React.createElement('span', { className: 'msp-active-dot' }),
                s.is_ko && React.createElement('span', { className: 'msp-ko-tag' }, 'UB')
              ),

              // RC
              React.createElement('span', {
                className: 'msp-cell msp-mono',
                style: { color: s.running_count >= 0 ? '#6aafff' : '#ff5c5c' }
              }, s.running_count >= 0 ? '+' + s.running_count : s.running_count),

              // Effective TC
              React.createElement('span', {
                className: 'msp-cell msp-mono msp-tc-val',
                style: { color: s.effective_tc >= 2 ? '#44e882' : s.effective_tc >= 0 ? '#6aafff' : '#ff5c5c' }
              }, fmtTC(s.effective_tc)),

              // Advantage
              React.createElement('span', {
                className: 'msp-cell msp-mono',
                style: { color: advColor(s.advantage), fontSize: 10 }
              }, fmtAdv(s.advantage)),

              // TC bar
              React.createElement('div', { className: 'msp-cell', style: { flex: 2 } },
                React.createElement('div', { className: 'msp-bar-bg' },
                  React.createElement('div', { className: 'msp-bar-zero' }),
                  React.createElement('div', {
                    className: 'msp-bar-fill',
                    style: {
                      width: barWidth(s.effective_tc) + '%',
                      background: 'linear-gradient(90deg, ' + color + '55, ' + color + ')',
                    }
                  })
                )
              )
            );
          })
        ),

        // Legend row
        data && React.createElement('div', { className: 'msp-legend' },
          React.createElement('span', null, 'UB = Unbalanced'),
          React.createElement('span', null, 'L1/L2/L3 = System Level'),
          React.createElement('span', { style: { color: '#44e882' } }, '● = Active'),
          bestSystem && React.createElement('span', { style: { color: '#ffd447' } },
            '★ Best edge: ' + SYS_LABELS[bestSystem]
          )
        ),

        // Refresh button
        React.createElement('button', {
          className: 'msp-refresh',
          onClick: function (e) { e.stopPropagation(); fetchData(); },
          disabled: loading,
        }, loading ? 'Refreshing…' : '↻ Refresh')
      )
    );
  }

  return MultiSystemPanel;
})();


// PHASE 7 T4 — React.memo wrap. Script-mode reassignment of the
// function declaration keeps `function MultiSystemPanel(` intact for the
// build.sh smoke check while routing all consumers through memo.
if (typeof React !== 'undefined' && React.memo) {
  MultiSystemPanel = React.memo(MultiSystemPanel);
}
