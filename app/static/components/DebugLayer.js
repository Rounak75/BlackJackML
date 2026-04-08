// @ts-nocheck
/*
 * DebugLayer.js — Production-Grade Debugging Infrastructure
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ZERO-COST IN PRODUCTION:
 *   All instrumentation is gated behind window.__BJ_DEBUG_LEVEL.
 *   When OFF (default), every debug.* call is a no-op — no allocations,
 *   no string formatting, no DOM work.
 *
 * ACTIVATION:
 *   From browser console:  __BJDebug.enable(4)   — VERBOSE mode
 *   Hotkey:                Ctrl+Shift+D          — toggle panel
 *   URL param:             ?debug=4              — auto-enable on load
 *
 * SECTIONS:
 *   §1  Global Debug Controller
 *   §2  UI Tracker (clicks, renders, interactions)
 *   §3  Network Logger (socket events)
 *   §4  State Tracker (mutations, diffs, race detection)
 *   §5  ML Tracer (decisions, confidence, inputs)
 *   §6  Performance Monitor (FPS, memory, slow renders)
 *   §7  Debug Panel UI (floating, draggable, collapsible)
 *   §8  Enhanced Error Boundary (safe mode, recovery, stack viewer)
 *   §9  Debug Utilities (shorthand API)
 *   §10 Safe Mode (auto-trigger, feature disabling, warning banner)
 */


// ══════════════════════════════════════════════════════════════════════════════
// §1 — GLOBAL DEBUG CONTROLLER
// ══════════════════════════════════════════════════════════════════════════════

var DEBUG_LEVELS = { OFF: 0, ERROR: 1, WARN: 2, INFO: 3, VERBOSE: 4 };

var CATEGORY_COLORS = {
  UI:      '#44e882',
  STATE:   '#6aafff',
  NET:     '#b99bff',
  ML:      '#ffd447',
  PERF:    '#ff9a4d',
  ERROR:   '#ff5c5c',
  WARN:    '#ffb347',
  GENERAL: '#94a7c4',
  SAFE:    '#ff5c5c',
};

/** Ring buffer: fixed-size circular array. O(1) push, bounded memory. */
function RingBuffer(capacity) {
  this._buf = [];
  this._cap = capacity || 1000;
}
RingBuffer.prototype.push = function (item) {
  if (this._buf.length >= this._cap) this._buf.shift();
  this._buf.push(item);
};
RingBuffer.prototype.getAll = function () { return this._buf.slice(); };
RingBuffer.prototype.clear = function () { this._buf = []; };
RingBuffer.prototype.size = function () { return this._buf.length; };
RingBuffer.prototype.last = function (n) {
  return this._buf.slice(Math.max(0, this._buf.length - (n || 1)));
};

var DebugController = {
  level: DEBUG_LEVELS.OFF,
  features: {
    ui: true, state: true, network: true, ml: true, perf: true,
    stateSnapshots: true, safeModeAuto: true,
  },
  buffer: new RingBuffer(1500),
  stateSnapshots: new RingBuffer(50),
  _listeners: [],
  _perfData: { fps: 0, memory: 0, renders: 0, slowRenders: 0 },
  _lastActionTime: 0,
  _tickUpdates: 0,
  _tickFrame: 0,
  _safeMode: false,

  /* ── Control ─────────────────────────────────────────────── */
  enable: function (level) {
    this.level = (typeof level === 'number') ? level : DEBUG_LEVELS.VERBOSE;
    window.__BJ_DEBUG_LEVEL = this.level;
    this.log('GENERAL', DEBUG_LEVELS.INFO,
      'Debug enabled at level ' + this.level + ' (' + _levelName(this.level) + ')', null);
    this._notify();
    if (this.features.perf) _startPerfMonitor();
    return 'Debug ON — level ' + _levelName(this.level);
  },
  disable: function () {
    this.level = DEBUG_LEVELS.OFF;
    window.__BJ_DEBUG_LEVEL = 0;
    _stopPerfMonitor();
    this._notify();
    return 'Debug OFF';
  },
  toggle: function (feature) {
    if (feature in this.features) {
      this.features[feature] = !this.features[feature];
      this.log('GENERAL', DEBUG_LEVELS.INFO,
        'Feature ' + feature + ': ' + (this.features[feature] ? 'ON' : 'OFF'), null);
      this._notify();
    }
  },
  isActive: function (minLevel) {
    return this.level >= (minLevel || DEBUG_LEVELS.INFO);
  },
  setLevel: function (level) {
    this.level = level;
    window.__BJ_DEBUG_LEVEL = level;
    this._notify();
  },

  /* ── Logging ─────────────────────────────────────────────── */
  log: function (category, level, message, data) {
    if (this.level < level) return;
    if (category !== 'GENERAL' && category !== 'ERROR' && category !== 'WARN' && category !== 'SAFE') {
      var featureKey = category.toLowerCase();
      if (featureKey === 'net') featureKey = 'network';
      if (this.features[featureKey] === false) return;
    }
    var entry = {
      id: _entryId++,
      ts: Date.now(),
      cat: category,
      level: level,
      msg: message,
      data: data || null,
    };
    this.buffer.push(entry);
    this._notify();
    // Also mirror to console in dev
    var color = CATEGORY_COLORS[category] || '#94a7c4';
    var prefix = '%c[' + category + ']';
    if (level <= DEBUG_LEVELS.ERROR) {
      console.error(prefix, 'color:' + color + ';font-weight:bold', message, data || '');
    } else if (level <= DEBUG_LEVELS.WARN) {
      console.warn(prefix, 'color:' + color + ';font-weight:bold', message, data || '');
    } else if (this.level >= DEBUG_LEVELS.VERBOSE) {
      console.log(prefix, 'color:' + color, message, data || '');
    }
  },

  /* ── State snapshots ─────────────────────────────────────── */
  snapshotState: function (label, state) {
    if (!this.isActive() || !this.features.stateSnapshots) return;
    this.stateSnapshots.push({
      ts: Date.now(), label: label,
      snapshot: _safeClone(state),
    });
  },

  /* ── Subscriptions (for panel) ───────────────────────────── */
  subscribe: function (fn) {
    this._listeners.push(fn);
    return function () {
      this._listeners = this._listeners.filter(function (f) { return f !== fn; });
    }.bind(this);
  },
  _notify: function () {
    for (var i = 0; i < this._listeners.length; i++) {
      try { this._listeners[i](); } catch (e) { /* ignore listener errors */ }
    }
  },

  /* ── Export ───────────────────────────────────────────────── */
  exportLogs: function () {
    var logs = this.buffer.getAll();
    var blob = new Blob([JSON.stringify(logs, null, 2)],
      { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'bjml_debug_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    a.click();
    URL.revokeObjectURL(url);
    return 'Exported ' + logs.length + ' log entries';
  },
  getTimeline: function (filter) {
    var logs = this.buffer.getAll();
    if (filter) {
      var f = filter.toUpperCase();
      logs = logs.filter(function (e) { return e.cat === f; });
    }
    return logs;
  },
  getPerfData: function () { return Object.assign({}, this._perfData); },
};

window.__BJDebug = DebugController;
window.__BJ_DEBUG_LEVEL = 0;

// Auto-enable from URL param: ?debug=4
(function () {
  try {
    var params = new URLSearchParams(window.location.search);
    var debugParam = params.get('debug');
    if (debugParam) DebugController.enable(parseInt(debugParam, 10) || 4);
  } catch (e) { /* ignore */ }
})();

var _entryId = 0;

function _levelName(l) {
  for (var k in DEBUG_LEVELS) {
    if (DEBUG_LEVELS[k] === l) return k;
  }
  return 'UNKNOWN';
}

function _safeClone(obj) {
  try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return '[uncloneable]'; }
}


// ══════════════════════════════════════════════════════════════════════════════
// §2 — UI TRACKER
// ══════════════════════════════════════════════════════════════════════════════

var DebugUI = {
  trackClick: function (action, data) {
    if (!DebugController.isActive()) return;
    var now = Date.now();
    var sinceLast = DebugController._lastActionTime
      ? (now - DebugController._lastActionTime) + 'ms'
      : 'first';
    DebugController._lastActionTime = now;
    DebugController.log('UI', DEBUG_LEVELS.INFO,
      'Action: ' + action + ' (gap: ' + sinceLast + ')', data || null);
  },
  trackRender: function (componentName, durationMs) {
    if (!DebugController.isActive(DEBUG_LEVELS.VERBOSE)) return;
    DebugController._perfData.renders++;
    if (durationMs > 16) {
      DebugController._perfData.slowRenders++;
      DebugController.log('PERF', DEBUG_LEVELS.WARN,
        'Slow render: ' + componentName + ' (' + durationMs.toFixed(1) + 'ms)', null);
    } else {
      DebugController.log('UI', DEBUG_LEVELS.VERBOSE,
        componentName + ' rendered (' + durationMs.toFixed(1) + 'ms)', null);
    }
  },
  trackInteraction: function (element, latencyMs) {
    if (!DebugController.isActive(DEBUG_LEVELS.VERBOSE)) return;
    DebugController.log('UI', DEBUG_LEVELS.VERBOSE,
      'Interaction: ' + element + ' latency: ' + latencyMs.toFixed(0) + 'ms', null);
  },
};


// ══════════════════════════════════════════════════════════════════════════════
// §3 — NETWORK LOGGER
// ══════════════════════════════════════════════════════════════════════════════

var DebugNet = {
  _pendingEmits: {},

  /** Wrap socket.emit to log outgoing events */
  wrapEmit: function (socket) {
    if (!socket || socket.__debugWrapped) return socket;
    var origEmit = socket.emit.bind(socket);
    var self = this;
    socket.emit = function (event) {
      var args = Array.prototype.slice.call(arguments, 1);
      if (DebugController.isActive()) {
        var payloadSize = 0;
        try { payloadSize = JSON.stringify(args).length; } catch (e) { /* ignore */ }
        self._pendingEmits[event] = Date.now();
        DebugController.log('NET', DEBUG_LEVELS.INFO,
          '→ ' + event + ' (' + payloadSize + 'B)',
          args.length === 1 ? args[0] : args);
      }
      return origEmit.apply(null, arguments);
    };
    socket.__debugWrapped = true;
    return socket;
  },

  /** Log incoming socket event */
  logReceive: function (event, data) {
    if (!DebugController.isActive()) return;
    var payloadSize = 0;
    try { payloadSize = JSON.stringify(data).length; } catch (e) { /* ignore */ }
    var roundtrip = '';
    if (this._pendingEmits[event]) {
      roundtrip = ' roundtrip: ' + (Date.now() - this._pendingEmits[event]) + 'ms';
      delete this._pendingEmits[event];
    }
    // state_update is very frequent — only log at VERBOSE
    var level = (event === 'state_update') ? DEBUG_LEVELS.VERBOSE : DEBUG_LEVELS.INFO;
    DebugController.log('NET', level,
      '← ' + event + ' (' + payloadSize + 'B' + roundtrip + ')',
      event === 'state_update' ? { keys: Object.keys(data || {}) } : data);
  },

  logError: function (event, error) {
    DebugController.log('NET', DEBUG_LEVELS.ERROR,
      'Socket error on ' + event + ': ' + (error.message || error), { error: String(error) });
  },
};


// ══════════════════════════════════════════════════════════════════════════════
// §4 — STATE TRACKER
// ══════════════════════════════════════════════════════════════════════════════

var DebugState = {
  _prevState: null,
  _frameId: 0,
  _updatesThisFrame: 0,

  /** Track a state update — diffs against previous */
  trackUpdate: function (label, newState) {
    if (!DebugController.isActive() || !DebugController.features.state) return;

    // Race condition detector: multiple updates in same rAF frame
    var frame = typeof requestAnimationFrame !== 'undefined' ? _currentAnimFrame : 0;
    if (frame === this._frameId) {
      this._updatesThisFrame++;
      if (this._updatesThisFrame > 2) {
        DebugController.log('STATE', DEBUG_LEVELS.WARN,
          '⚠ ' + this._updatesThisFrame + ' state updates in same frame (possible race)',
          { label: label });
      }
    } else {
      this._frameId = frame;
      this._updatesThisFrame = 1;
    }

    // Diff only top-level keys for performance
    if (this._prevState && typeof newState === 'object' && newState !== null) {
      var diffs = [];
      var keys = Object.keys(newState);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var oldVal = this._prevState[k];
        var newVal = newState[k];
        if (oldVal !== newVal) {
          // Deep-diff for count object (most useful)
          if (k === 'count' && typeof oldVal === 'object' && typeof newVal === 'object') {
            var countKeys = Object.keys(newVal || {});
            for (var j = 0; j < countKeys.length; j++) {
              var ck = countKeys[j];
              if (oldVal && oldVal[ck] !== newVal[ck]) {
                diffs.push('count.' + ck + ': ' + _fmtVal(oldVal[ck]) + ' → ' + _fmtVal(newVal[ck]));
              }
            }
          } else if (typeof oldVal !== 'object') {
            diffs.push(k + ': ' + _fmtVal(oldVal) + ' → ' + _fmtVal(newVal));
          }
        }
      }
      if (diffs.length > 0 && diffs.length <= 10) {
        DebugController.log('STATE', DEBUG_LEVELS.INFO,
          label + ' — ' + diffs.length + ' change(s)', { diffs: diffs });
      } else if (diffs.length > 10) {
        DebugController.log('STATE', DEBUG_LEVELS.INFO,
          label + ' — ' + diffs.length + ' changes (bulk update)', null);
      }
    }

    this._prevState = _safeClone(newState);
    DebugController.snapshotState(label, newState);
  },

  /** Track a specific state mutation */
  trackMutation: function (key, oldVal, newVal, context) {
    if (!DebugController.isActive() || !DebugController.features.state) return;
    if (oldVal === newVal) return;
    DebugController.log('STATE', DEBUG_LEVELS.INFO,
      key + ': ' + _fmtVal(oldVal) + ' → ' + _fmtVal(newVal),
      context || null);
  },

  /** Detect unexpected resets */
  trackReset: function (component, reason) {
    if (!DebugController.isActive()) return;
    DebugController.log('STATE', DEBUG_LEVELS.WARN,
      'State reset: ' + component + ' — ' + reason, null);
  },
};

var _currentAnimFrame = 0;
if (typeof requestAnimationFrame !== 'undefined') {
  (function _trackFrame() {
    _currentAnimFrame++;
    requestAnimationFrame(_trackFrame);
  })();
}

function _fmtVal(v) {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'number') return (v % 1 === 0) ? String(v) : v.toFixed(2);
  if (typeof v === 'string') return '"' + v + '"';
  if (typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return '[' + v.length + ' items]';
  if (typeof v === 'object') return '{' + Object.keys(v).length + ' keys}';
  return String(v);
}


// ══════════════════════════════════════════════════════════════════════════════
// §5 — ML TRACER
// ══════════════════════════════════════════════════════════════════════════════

var DebugML = {
  trackDecision: function (rec, count, playerHand, dealerUpcard) {
    if (!DebugController.isActive() || !DebugController.features.ml) return;
    if (!rec) return;
    var entry = {
      action: rec.action,
      confidence: rec.confidence,
      source: rec.source || (rec.all_scores ? 'ml_model' : 'rules'),
      basic_action: rec.basic_action,
      is_deviation: rec.is_deviation,
      tc: count ? count.true : null,
      rc: count ? count.running : null,
      player: playerHand ? playerHand.display_value : null,
      dealer: dealerUpcard || null,
    };
    if (rec.all_scores) entry.all_scores = rec.all_scores;
    var msg = 'Decision: ' + entry.action;
    if (entry.confidence) msg += '  conf: ' + entry.confidence;
    msg += '  src: ' + entry.source;
    if (entry.is_deviation) msg += '  [DEVIATION from ' + entry.basic_action + ']';
    DebugController.log('ML', DEBUG_LEVELS.INFO, msg, entry);
  },

  trackInference: function (inputs, output, elapsedMs) {
    if (!DebugController.isActive(DEBUG_LEVELS.VERBOSE) || !DebugController.features.ml) return;
    DebugController.log('ML', DEBUG_LEVELS.VERBOSE,
      'Inference (' + (elapsedMs || '?') + 'ms)',
      { inputs: inputs, output: output });
  },
};


// ══════════════════════════════════════════════════════════════════════════════
// §6 — PERFORMANCE MONITOR
// ══════════════════════════════════════════════════════════════════════════════

var _perfRafId = null;
var _perfFrames = 0;
var _perfLastFps = 0;
var _perfInterval = null;

function _startPerfMonitor() {
  if (_perfRafId !== null) return;
  _perfFrames = 0;
  _perfLastFps = performance.now();

  function _countFrame() {
    _perfFrames++;
    _perfRafId = requestAnimationFrame(_countFrame);
  }
  _perfRafId = requestAnimationFrame(_countFrame);

  _perfInterval = setInterval(function () {
    var now = performance.now();
    var elapsed = (now - _perfLastFps) / 1000;
    var fps = elapsed > 0 ? Math.round(_perfFrames / elapsed) : 0;
    _perfFrames = 0;
    _perfLastFps = now;
    DebugController._perfData.fps = fps;

    // Memory (Chrome only)
    if (performance.memory) {
      DebugController._perfData.memory =
        Math.round(performance.memory.usedJSHeapSize / 1048576);
    }

    // Warn on low FPS
    if (fps > 0 && fps < 30) {
      DebugController.log('PERF', DEBUG_LEVELS.WARN,
        'Low FPS: ' + fps, null);
    }
  }, 2000);
}

function _stopPerfMonitor() {
  if (_perfRafId !== null) {
    cancelAnimationFrame(_perfRafId);
    _perfRafId = null;
  }
  if (_perfInterval !== null) {
    clearInterval(_perfInterval);
    _perfInterval = null;
  }
}

var DebugPerf = {
  markStart: function (label) {
    if (!DebugController.isActive(DEBUG_LEVELS.VERBOSE)) return null;
    return { label: label, start: performance.now() };
  },
  markEnd: function (mark) {
    if (!mark) return;
    var elapsed = performance.now() - mark.start;
    DebugUI.trackRender(mark.label, elapsed);
    return elapsed;
  },
  getStats: function () {
    return Object.assign({}, DebugController._perfData);
  },
};


// ══════════════════════════════════════════════════════════════════════════════
// §7 — DEBUG PANEL UI (floating, draggable, collapsible)
// ══════════════════════════════════════════════════════════════════════════════

function DebugPanel() {
  var useState = React.useState;
  var useEffect = React.useEffect;
  var useRef = React.useRef;
  var useCallback = React.useCallback;

  var _visible = useState(false);
  var visible = _visible[0];
  var setVisible = _visible[1];

  var _tab = useState('timeline');
  var tab = _tab[0];
  var setTab = _tab[1];

  var _filter = useState('ALL');
  var filter = _filter[0];
  var setFilter = _filter[1];

  var _tick = useState(0);
  var tick = _tick[1];

  var _collapsed = useState(false);
  var collapsed = _collapsed[0];
  var setCollapsed = _collapsed[1];

  var _pos = useState({ x: window.innerWidth - 470, y: window.innerHeight - 450 });
  var pos = _pos[0];
  var setPos = _pos[1];

  var dragging = useRef(false);
  var dragOffset = useRef({ x: 0, y: 0 });
  var panelRef = useRef(null);
  var logEndRef = useRef(null);

  // Subscribe to debug controller updates
  useEffect(function () {
    return DebugController.subscribe(function () { tick(function (t) { return t + 1; }); });
  }, []);

  // Hotkey: Ctrl+Shift+D
  useEffect(function () {
    function onKey(e) {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        if (!DebugController.isActive()) DebugController.enable(DEBUG_LEVELS.VERBOSE);
        setVisible(function (v) { return !v; });
      }
    }
    window.addEventListener('keydown', onKey);
    return function () { window.removeEventListener('keydown', onKey); };
  }, []);

  // Auto-scroll log
  useEffect(function () {
    if (logEndRef.current && tab === 'timeline') {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // Drag handlers
  var onMouseDown = useCallback(function (e) {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') return;
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  }, [pos]);

  useEffect(function () {
    function onMove(e) {
      if (!dragging.current) return;
      setPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    }
    function onUp() { dragging.current = false; }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return function () {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  if (!visible) return null;

  var panelStyle = {
    position: 'fixed',
    left: pos.x,
    top: pos.y,
    width: 450,
    height: collapsed ? 38 : 400,
    background: 'rgba(10, 14, 24, 0.96)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    zIndex: 99999,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: '#d0dae8',
    overflow: 'hidden',
    backdropFilter: 'blur(12px)',
    transition: 'height 0.2s ease',
  };

  // Header bar
  var headerBar = React.createElement('div', {
    onMouseDown: onMouseDown,
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 10px', background: 'rgba(255,255,255,0.04)',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      cursor: 'grab', userSelect: 'none', flexShrink: 0,
    },
  },
    React.createElement('span', { style: { fontWeight: 700, color: '#ffd447', fontSize: 11 } },
      '🔧 BJDebug'),
    React.createElement('span', {
      style: { fontSize: 9, color: '#6b7fa3', marginLeft: 8 }
    }, _levelName(DebugController.level) + ' | ' + DebugController.buffer.size() + ' logs'),
    React.createElement('span', { style: { display: 'flex', gap: 4 } },
      React.createElement('button', {
        onClick: function () { DebugController.exportLogs(); },
        title: 'Export logs as JSON',
        style: _tabBtnStyle(false),
      }, '💾'),
      React.createElement('button', {
        onClick: function () { DebugController.buffer.clear(); tick(function (t) { return t + 1; }); },
        title: 'Clear logs',
        style: _tabBtnStyle(false),
      }, '🗑'),
      React.createElement('button', {
        onClick: function () { setCollapsed(function (c) { return !c; }); },
        title: collapsed ? 'Expand' : 'Collapse',
        style: _tabBtnStyle(false),
      }, collapsed ? '▲' : '▼'),
      React.createElement('button', {
        onClick: function () { setVisible(false); },
        title: 'Close',
        style: Object.assign({}, _tabBtnStyle(false), { color: '#ff5c5c' }),
      }, '✕')
    )
  );

  if (collapsed) return React.createElement('div', { ref: panelRef, style: panelStyle }, headerBar);

  // Tabs
  var tabs = ['timeline', 'state', 'network', 'perf', 'ml'];
  var tabBar = React.createElement('div', {
    style: {
      display: 'flex', gap: 2, padding: '4px 6px',
      borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
    },
  },
    tabs.map(function (t) {
      return React.createElement('button', {
        key: t, onClick: function () { setTab(t); },
        style: _tabBtnStyle(tab === t),
      }, t.charAt(0).toUpperCase() + t.slice(1));
    })
  );

  // Tab content
  var content = null;

  if (tab === 'timeline') {
    content = _renderTimeline(filter, setFilter, logEndRef);
  } else if (tab === 'state') {
    content = _renderStateTab();
  } else if (tab === 'network') {
    content = _renderFilteredTimeline('NET', logEndRef);
  } else if (tab === 'perf') {
    content = _renderPerfTab();
  } else if (tab === 'ml') {
    content = _renderFilteredTimeline('ML', logEndRef);
  }

  return React.createElement('div', { ref: panelRef, style: panelStyle },
    headerBar,
    tabBar,
    React.createElement('div', {
      style: { flex: 1, overflow: 'auto', padding: '4px 6px' },
    }, content)
  );
}

// ── Tab button style ──────────────────────────────────────────
function _tabBtnStyle(active) {
  return {
    background: active ? 'rgba(255,212,71,0.15)' : 'transparent',
    border: active ? '1px solid rgba(255,212,71,0.3)' : '1px solid transparent',
    color: active ? '#ffd447' : '#6b7fa3',
    borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
    fontSize: 10, fontFamily: 'DM Mono, monospace',
  };
}

// ── Timeline renderer ──────────────────────────────────────────
function _renderTimeline(filter, setFilter, logEndRef) {
  var categories = ['ALL', 'UI', 'STATE', 'NET', 'ML', 'PERF', 'ERROR', 'WARN'];
  var logs = DebugController.buffer.getAll();
  if (filter !== 'ALL') {
    logs = logs.filter(function (e) { return e.cat === filter; });
  }
  // Show last 200
  logs = logs.slice(-200);

  return React.createElement(React.Fragment, null,
    // Filter bar
    React.createElement('div', {
      style: { display: 'flex', gap: 3, marginBottom: 4, flexWrap: 'wrap' },
    },
      categories.map(function (c) {
        return React.createElement('button', {
          key: c, onClick: function () { setFilter(c); },
          style: Object.assign({}, _tabBtnStyle(filter === c), {
            color: c === 'ALL' ? (filter === c ? '#ffd447' : '#6b7fa3') : (CATEGORY_COLORS[c] || '#6b7fa3'),
            fontSize: 9,
          }),
        }, c);
      })
    ),
    // Log entries
    React.createElement('div', { style: { fontSize: 10, lineHeight: 1.6 } },
      logs.map(function (e) {
        var timeStr = new Date(e.ts).toLocaleTimeString('en-US', {
          hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        var ms = String(e.ts % 1000).padStart(3, '0');
        return React.createElement('div', {
          key: e.id,
          style: {
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            padding: '2px 0',
            opacity: e.level <= DEBUG_LEVELS.ERROR ? 1 : 0.85,
          },
        },
          React.createElement('span', {
            style: { color: '#4a5568', marginRight: 6, fontSize: 9 },
          }, timeStr + '.' + ms),
          React.createElement('span', {
            style: {
              color: CATEGORY_COLORS[e.cat] || '#94a7c4',
              fontWeight: 600, marginRight: 6,
            },
          }, '[' + e.cat + ']'),
          React.createElement('span', null, e.msg),
          e.data ? React.createElement('span', {
            style: { color: '#4a6a8a', marginLeft: 6, fontSize: 9 },
            title: JSON.stringify(e.data, null, 2),
          }, '📎') : null
        );
      }),
      React.createElement('div', { ref: logEndRef })
    )
  );
}

// ── Filtered timeline (for network/ml tabs) ──────────────────
function _renderFilteredTimeline(category, logEndRef) {
  var logs = DebugController.buffer.getAll()
    .filter(function (e) { return e.cat === category; })
    .slice(-200);
  return React.createElement('div', { style: { fontSize: 10, lineHeight: 1.6 } },
    logs.length === 0
      ? React.createElement('div', { style: { color: '#4a5568', padding: 20, textAlign: 'center' } },
          'No ' + category + ' events yet')
      : logs.map(function (e) {
          var timeStr = new Date(e.ts).toLocaleTimeString('en-US', {
            hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
          });
          return React.createElement('div', {
            key: e.id,
            style: { borderBottom: '1px solid rgba(255,255,255,0.03)', padding: '3px 0' },
          },
            React.createElement('span', {
              style: { color: '#4a5568', marginRight: 6, fontSize: 9 },
            }, timeStr),
            React.createElement('span', {
              style: { color: CATEGORY_COLORS[category], fontWeight: 600, marginRight: 6 },
            }, '[' + category + ']'),
            React.createElement('span', null, e.msg),
            e.data ? React.createElement('pre', {
              style: {
                color: '#5a7a9a', fontSize: 9, margin: '2px 0 2px 20px',
                whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'auto',
              },
            }, JSON.stringify(e.data, null, 2)) : null
          );
        }),
    React.createElement('div', { ref: logEndRef })
  );
}

// ── State snapshot viewer ────────────────────────────────────
function _renderStateTab() {
  var snapshots = DebugController.stateSnapshots.getAll().slice(-10).reverse();
  if (snapshots.length === 0) {
    return React.createElement('div', {
      style: { color: '#4a5568', padding: 20, textAlign: 'center' },
    }, 'No state snapshots yet. Deal a card to capture state.');
  }
  return React.createElement('div', null,
    snapshots.map(function (s, i) {
      var timeStr = new Date(s.ts).toLocaleTimeString('en-US', { hour12: false });
      var preview = {};
      if (s.snapshot && typeof s.snapshot === 'object') {
        if (s.snapshot.count) preview.count = s.snapshot.count;
        if (s.snapshot.shoe) preview.shoe = {
          remaining: s.snapshot.shoe.cards_remaining,
          penetration: s.snapshot.shoe.penetration,
        };
        if (s.snapshot.recommendation) preview.rec = {
          action: s.snapshot.recommendation.action,
          is_deviation: s.snapshot.recommendation.is_deviation,
        };
      }
      return React.createElement('div', {
        key: i,
        style: {
          marginBottom: 6, padding: 6,
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 4, border: '1px solid rgba(255,255,255,0.04)',
        },
      },
        React.createElement('div', {
          style: { color: '#6aafff', fontWeight: 600, marginBottom: 2, fontSize: 10 },
        }, s.label + ' — ' + timeStr),
        React.createElement('pre', {
          style: {
            color: '#7a8fa8', fontSize: 9, margin: 0,
            whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto',
          },
        }, JSON.stringify(preview, null, 2))
      );
    })
  );
}

// ── Performance tab ──────────────────────────────────────────
function _renderPerfTab() {
  var p = DebugController._perfData;
  var items = [
    { label: 'FPS', value: p.fps, color: p.fps < 30 ? '#ff5c5c' : p.fps < 50 ? '#ffb347' : '#44e882' },
    { label: 'Memory (MB)', value: p.memory || 'N/A', color: '#6aafff' },
    { label: 'Total Renders', value: p.renders, color: '#b99bff' },
    { label: 'Slow Renders (>16ms)', value: p.slowRenders, color: p.slowRenders > 0 ? '#ff5c5c' : '#44e882' },
    { label: 'Log Buffer Size', value: DebugController.buffer.size() + '/1500', color: '#94a7c4' },
  ];

  return React.createElement('div', { style: { padding: '8px 0' } },
    items.map(function (item, i) {
      return React.createElement('div', {
        key: i,
        style: {
          display: 'flex', justifyContent: 'space-between',
          padding: '6px 8px', marginBottom: 3,
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 4,
        },
      },
        React.createElement('span', { style: { color: '#94a7c4' } }, item.label),
        React.createElement('span', {
          style: { color: item.color, fontWeight: 700 },
        }, item.value)
      );
    }),
    React.createElement('div', {
      style: { marginTop: 10, padding: '6px 8px', color: '#4a5568', fontSize: 9 },
    },
      'Perf data updates every 2s. Memory is Chrome-only. ',
      'Slow render threshold: 16ms (60fps budget).'
    )
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// §8 — ENHANCED ERROR BOUNDARY (with safe mode + recovery)
// ══════════════════════════════════════════════════════════════════════════════

class DebugErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, stack: null, recovered: false, safeMode: false };
  }

  static getDerivedStateFromError(err) {
    return { error: err.toString() };
  }

  componentDidCatch(err, info) {
    var stack = info.componentStack || '';
    this.setState({ stack: stack });

    // Log to debug controller
    DebugController.log('ERROR', DEBUG_LEVELS.ERROR,
      'React Error Boundary caught: ' + err.toString(),
      { stack: stack, component: info.componentStack });

    // Auto safe mode
    if (DebugController.features.safeModeAuto) {
      _activateSafeMode('Error boundary triggered: ' + err.message);
      this.setState({ safeMode: true });
    }
  }

  render() {
    if (this.state.error && !this.state.recovered) {
      return React.createElement('div', {
        style: {
          padding: 30, fontFamily: 'DM Mono, monospace',
          background: '#0a0e18', color: '#f0f4ff', minHeight: '100vh',
        },
      },
        // Safe mode banner
        this.state.safeMode ? React.createElement('div', {
          style: {
            background: 'rgba(255,92,92,0.15)', border: '1px solid rgba(255,92,92,0.4)',
            borderRadius: 8, padding: 12, marginBottom: 16, color: '#ff9a9a',
            fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
          },
        }, '🛡 Safe Mode activated — risky features disabled') : null,

        React.createElement('div', {
          style: { color: '#ff5c5c', fontSize: 22, marginBottom: 16, fontWeight: 800 },
        }, 'BlackjackML — Render Error'),

        React.createElement('div', {
          style: {
            background: '#1c2540', padding: 16, borderRadius: 8, marginBottom: 16,
            border: '1px solid rgba(255,92,92,0.4)', color: '#ff9a9a',
            fontSize: 14, lineHeight: 1.7,
          },
        }, this.state.error),

        React.createElement('div', {
          style: {
            background: '#111827', padding: 16, borderRadius: 8, color: '#94a7c4',
            fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto',
            marginBottom: 16,
          },
        }, this.state.stack),

        // Action buttons
        React.createElement('div', { style: { display: 'flex', gap: 10 } },
          React.createElement('button', {
            onClick: function () {
              this.setState({ error: null, stack: null, recovered: true });
            }.bind(this),
            style: {
              background: 'rgba(68,232,130,0.15)', border: '1px solid rgba(68,232,130,0.4)',
              color: '#44e882', borderRadius: 6, padding: '8px 20px',
              cursor: 'pointer', fontWeight: 700, fontFamily: 'DM Mono, monospace',
            },
          }, '🔄 Try Recovery'),
          React.createElement('button', {
            onClick: function () {
              try {
                navigator.clipboard.writeText(
                  'Error: ' + this.state.error + '\n\nStack:\n' + this.state.stack
                );
              } catch (e) { /* ignore */ }
            }.bind(this),
            style: {
              background: 'rgba(106,175,255,0.15)', border: '1px solid rgba(106,175,255,0.4)',
              color: '#6aafff', borderRadius: 6, padding: '8px 20px',
              cursor: 'pointer', fontWeight: 700, fontFamily: 'DM Mono, monospace',
            },
          }, '📋 Copy Error'),
          React.createElement('button', {
            onClick: function () { window.location.reload(); },
            style: {
              background: 'rgba(255,212,71,0.15)', border: '1px solid rgba(255,212,71,0.4)',
              color: '#ffd447', borderRadius: 6, padding: '8px 20px',
              cursor: 'pointer', fontWeight: 700, fontFamily: 'DM Mono, monospace',
            },
          }, '🔃 Full Reload')
        ),

        React.createElement('p', {
          style: { color: '#ffd447', marginTop: 16, fontSize: 12 },
        }, 'Screenshot this and share it. Logs: __BJDebug.exportLogs()')
      );
    }
    return this.props.children;
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// §9 — DEBUG UTILITIES (shorthand API)
// ══════════════════════════════════════════════════════════════════════════════

var debug = {
  log:   function (msg, data) { DebugController.log('GENERAL', DEBUG_LEVELS.INFO, msg, data); },
  state: function (msg, data) { DebugController.log('STATE',   DEBUG_LEVELS.INFO, msg, data); },
  api:   function (msg, data) { DebugController.log('NET',     DEBUG_LEVELS.INFO, msg, data); },
  ui:    function (msg, data) { DebugController.log('UI',      DEBUG_LEVELS.INFO, msg, data); },
  perf:  function (msg, data) { DebugController.log('PERF',    DEBUG_LEVELS.INFO, msg, data); },
  ml:    function (msg, data) { DebugController.log('ML',      DEBUG_LEVELS.INFO, msg, data); },
  error: function (msg, data) { DebugController.log('ERROR',   DEBUG_LEVELS.ERROR, msg, data); },
  warn:  function (msg, data) { DebugController.log('WARN',    DEBUG_LEVELS.WARN,  msg, data); },
  verbose: function (msg, data) { DebugController.log('GENERAL', DEBUG_LEVELS.VERBOSE, msg, data); },
};


// ══════════════════════════════════════════════════════════════════════════════
// §10 — SAFE MODE
// ══════════════════════════════════════════════════════════════════════════════

function _activateSafeMode(reason) {
  if (DebugController._safeMode) return; // already active
  DebugController._safeMode = true;

  DebugController.log('SAFE', DEBUG_LEVELS.ERROR,
    'Safe Mode ACTIVATED: ' + reason, null);

  // Inject warning banner at top of page
  var banner = document.createElement('div');
  banner.id = 'bjml-safe-mode-banner';
  banner.style.cssText =
    'position:fixed;top:0;left:0;right:0;z-index:100000;' +
    'background:rgba(255,92,92,0.12);border-bottom:2px solid rgba(255,92,92,0.4);' +
    'color:#ff9a9a;font-family:"DM Mono",monospace;font-size:11px;' +
    'padding:6px 16px;text-align:center;backdrop-filter:blur(8px);';
  banner.textContent = '🛡 SAFE MODE — ' + reason +
    ' — Risky features disabled. Reload to restore.';
  // Only add if not already present
  if (!document.getElementById('bjml-safe-mode-banner')) {
    document.body.appendChild(banner);
  }
}

function isSafeMode() {
  return DebugController._safeMode;
}

// Global error handler — catches unhandled errors
window.addEventListener('error', function (event) {
  DebugController.log('ERROR', DEBUG_LEVELS.ERROR,
    'Unhandled error: ' + event.message,
    { filename: event.filename, line: event.lineno, col: event.colno });
  if (DebugController.features.safeModeAuto) {
    _activateSafeMode('Unhandled JS error');
  }
});

window.addEventListener('unhandledrejection', function (event) {
  var reason = event.reason ? (event.reason.message || String(event.reason)) : 'Unknown';
  DebugController.log('ERROR', DEBUG_LEVELS.ERROR,
    'Unhandled promise rejection: ' + reason, null);
});