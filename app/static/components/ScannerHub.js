/*
 * components/ScannerHub.js — Phase 5
 * ─────────────────────────────────────────────────────────
 * Single composition component for the TabStrip's "Scanner" tab.
 *
 * Mounts LiveOverlayPanel (which owns the mode toggle + per-mode
 * body) and three collapsible live-only sub-sections beneath it:
 *
 *   ▾ Zone Config       — visible in 'live' or 'screenshot'
 *   ▾ Confirmation      — visible in 'live' only
 *   ▾ Wonging           — visible in 'live' only
 *
 * Sub-section open/closed state persists per-section in
 * localStorage under bjml_scanner_{zone|conf|wong}_open.
 *
 * Status dots beside each header signal panel state at a glance,
 * so the user does not need to expand the section to know:
 *   Zone: jade  when zoneConfig.applied_session === true
 *   Conf: gold  when pendingCards.length > 0
 *   Wong: sapph when wonging.signal === 'SIT DOWN NOW'
 *
 * Props:
 *   socket             SocketIO connection
 *   count              count object from server
 *   scanMode           'manual' | 'screenshot' | 'live'
 *   onSetMode          fn(mode) — mode setter, owned by App.jsx
 *   onDealCard         fn(rank, suit, target?) — used by ScreenshotMode
 *   dealTarget         current deal target ('player'|'dealer'|'seen')
 *   zoneConfig         zone-config object from server state
 *   confirmationMode   bool — confirmation queue mode enabled
 *   pendingCards       array of pending card objects
 *   wonging            wonging state object
 */

function ScannerHub({
  count,
  scanMode, onSetMode,
  onDealCard, dealTarget,
  zoneConfig,
  confirmationMode, pendingCards,
  wonging,
}) {
  var useState  = React.useState;
  var useEffect = React.useEffect;
  // PHASE 7 T3: socket no longer read here — children pull from SocketContext.

  // ── Persistent collapsibles ──────────────────────────────────
  function loadOpen(key, def) {
    try {
      var raw = localStorage.getItem('bjml_scanner_' + key + '_open');
      if (raw === '1') return true;
      if (raw === '0') return false;
    } catch (e) {}
    return def;
  }
  function saveOpen(key, val) {
    try { localStorage.setItem('bjml_scanner_' + key + '_open', val ? '1' : '0'); } catch (e) {}
  }

  var _zone = useState(function () { return loadOpen('zone', false); });
  var zoneOpen    = _zone[0];
  var setZoneOpen = _zone[1];
  var _conf = useState(function () { return loadOpen('conf', false); });
  var confOpen    = _conf[0];
  var setConfOpen = _conf[1];
  var _wong = useState(function () { return loadOpen('wong', false); });
  var wongOpen    = _wong[0];
  var setWongOpen = _wong[1];

  useEffect(function () { saveOpen('zone', zoneOpen); }, [zoneOpen]);
  useEffect(function () { saveOpen('conf', confOpen); }, [confOpen]);
  useEffect(function () { saveOpen('wong', wongOpen); }, [wongOpen]);

  // ── Visibility rules ─────────────────────────────────────────
  var showZone = scanMode === 'live' || scanMode === 'screenshot';
  var showConf = scanMode === 'live';
  var showWong = scanMode === 'live';

  // ── Status dot signals ───────────────────────────────────────
  var IDLE = '#6b7f96';
  var zoneActive = !!(zoneConfig && (zoneConfig.applied_session === true));
  var confActive = !!(pendingCards && pendingCards.length > 0);
  var wongActive = !!(wonging && wonging.signal === 'SIT DOWN NOW');
  var zoneDot = zoneActive ? '#44e882' : IDLE;
  var confDot = confActive ? '#ffd447' : IDLE;
  var wongDot = wongActive ? '#6aafff' : IDLE;

  // ── Sub-section header ───────────────────────────────────────
  function header(label, open, onToggle, dotColor) {
    return React.createElement('button', {
      onClick: onToggle,
      'aria-expanded': open,
      style: {
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        cursor: 'pointer',
        color: '#ccdaec',
        fontSize: 11, fontWeight: 700,
        fontFamily: 'Syne, sans-serif',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        transition: 'background 0.15s, border-color 0.15s',
      },
    },
      React.createElement('span', {
        style: {
          display: 'inline-block', width: 10, textAlign: 'center',
          fontSize: 12, color: '#94a7c4', flexShrink: 0,
        },
        'aria-hidden': 'true',
      }, open ? '▾' : '▸'),
      React.createElement('span', { style: { flex: 1, textAlign: 'left' } }, label),
      React.createElement('span', {
        'aria-hidden': 'true',
        style: {
          width: 6, height: 6, borderRadius: '50%',
          background: dotColor,
          boxShadow: dotColor === IDLE ? 'none' : '0 0 6px ' + dotColor,
          flexShrink: 0,
        }
      })
    );
  }

  function section(label, open, setOpen, dotColor, body) {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
      header(label, open, function () { setOpen(!open); }, dotColor),
      open ? React.createElement('div', { style: { paddingLeft: 2 } }, body) : null
    );
  }

  // ── Render ───────────────────────────────────────────────────
  var hasSubs = showZone || showConf || showWong;

  return React.createElement('div', {
    role: 'region', 'aria-label': 'Scanner',
    style: { display: 'flex', flexDirection: 'column', gap: 10 },
  },
    // LiveOverlayPanel — owns the mode toggle and per-mode body
    React.createElement(LiveOverlayPanel, {
      count: count,
      scanMode: scanMode,
      onSetMode: onSetMode,
      onDealCard: onDealCard,
      dealTarget: dealTarget,
    }),

    // Live/screenshot-only sub-sections
    hasSubs && React.createElement('div', {
      style: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 },
    },
      showZone && section('Zone Config', zoneOpen, setZoneOpen, zoneDot,
        React.createElement(ZoneConfigPanel, {
          zoneConfig: zoneConfig,
          onApply: function () {},
        })
      ),
      showConf && section('Confirmation', confOpen, setConfOpen, confDot,
        React.createElement(ConfirmationPanel, {
          confirmationMode: confirmationMode,
          pendingCards: pendingCards,
        })
      ),
      showWong && section('Wonging', wongOpen, setWongOpen, wongDot,
        React.createElement(WongPanel, {
          wonging: wonging, count: count,
        })
      )
    )
  );
}


// PHASE 7 T4 — React.memo wrap. Script-mode reassignment of the
// function declaration keeps `function ScannerHub(` intact for the
// build.sh smoke check while routing all consumers through memo.
if (typeof React !== 'undefined' && React.memo) {
  ScannerHub = React.memo(ScannerHub);
}
