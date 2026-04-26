/*
 * components/icons.js — Phase 6 A1
 * ─────────────────────────────────────────────────────────
 * Inline Lucide SVG icon set. Zero dependency, ~3 KB minified,
 * fully offline. Add new icons by pasting the inner <path>
 * fragment from https://lucide.dev/icons/<name> into LUCIDE.
 *
 * Conventions:
 *   • viewBox is fixed at "0 0 24 24"
 *   • All paths use stroke="currentColor" — the icon picks up
 *     the parent CSS color, so it themes automatically.
 *   • Default stroke-width 2, linecap/linejoin round (Lucide defaults).
 *
 * Usage:
 *   <Icon name="zap" size={16} />
 *   <Icon name="target" size={14} color="var(--gold)" style={{ ... }} />
 *
 * Decorative emoji (🎉 🏆 💀 🤝 🏳 🛡 🧘 ⚡ 👯 👑) are intentionally
 * NOT replaced — they carry semantic personality at result chips,
 * mode badges, etc. See docs/superpowers/specs/2026-04-26-phase-6-...
 */

var LUCIDE = {
  // ── functional, scanning, navigation ─────────────────────
  'target':           '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  'camera':           '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  'bar-chart-3':      '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  'trending-up':      '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  'trending-down':    '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
  'clipboard-list':   '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  'landmark':         '<line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  'footprints':       '<path d="M4 16v-2.38c0-.32.06-.64.18-.94l1.2-3.06c.28-.7.94-1.16 1.7-1.16h.4c1.3 0 2.04 1.5 1.24 2.55L7.43 13.05c-.13.17-.13.4 0 .57.13.17.34.21.51.1l.59-.39c.18-.12.4-.13.6-.04l1.7.78c.47.21 1.04.04 1.32-.4l.35-.55c.27-.42.27-.96 0-1.38l-1.93-3.04c-.28-.44-.28-1 0-1.43L11.55 5.4c.27-.43.85-.59 1.31-.36l1.7.83c.2.1.42.08.6-.04l.6-.4c.16-.11.38-.07.5.1.13.18.13.41 0 .58l-1.27 1.93c-.81 1.05-.07 2.55 1.23 2.55h.4c.76 0 1.42.46 1.7 1.16l1.2 3.06c.12.3.18.62.18.94V16"/><path d="M4 20h16"/>',
  'shuffle':          '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>',
  'refresh-ccw':      '<polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10"/><path d="M3.51 15a9 9 0 0 0 14.85 3.36L23 14"/>',
  'dice':             '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M16 8h.01"/><path d="M8 8h.01"/><path d="M8 16h.01"/><path d="M16 16h.01"/><path d="M12 12h.01"/>',
  'microscope':       '<path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"/><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/>',
  'layers':           '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  'spade':            '<path d="M5 9c-1.5 1.5-3 3.2-3 5.5A5.5 5.5 0 0 0 7.5 20c1.8 0 3-.5 4.5-2 1.5 1.5 2.7 2 4.5 2a5.5 5.5 0 0 0 5.5-5.5c0-2.3-1.5-4-3-5.5l-7-7-7 7Z"/><path d="M12 18v4"/>',
  'ruler':            '<path d="M21.3 8.7 8.7 21.3a2.4 2.4 0 0 1-3.4 0L2.7 18.7a2.4 2.4 0 0 1 0-3.4L15.3 2.7a2.4 2.4 0 0 1 3.4 0l2.6 2.6a2.4 2.4 0 0 1 0 3.4Z"/><path d="m7.5 10.5 2 2"/><path d="m10.5 7.5 2 2"/><path d="m13.5 4.5 2 2"/><path d="m4.5 13.5 2 2"/>',
  'alert-triangle':   '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  'wallet':           '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
  // ── extras useful for buttons/menus ──────────────────────
  'x':                '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  'check':            '<polyline points="20 6 9 17 4 12"/>',
};

function Icon(props) {
  var name = props.name;
  var size = typeof props.size === 'number' ? props.size : 16;
  var stroke = typeof props.strokeWidth === 'number' ? props.strokeWidth : 2;
  var color = props.color || 'currentColor';
  var inner = LUCIDE[name];
  if (!inner) {
    if (typeof console !== 'undefined') console.warn('[icons] missing icon:', name);
    return null;
  }
  var style = Object.assign({
    display: 'inline-block',
    flexShrink: 0,
    verticalAlign: 'middle',
  }, props.style || {});
  return React.createElement('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    width: size, height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': props['aria-hidden'] == null ? 'true' : props['aria-hidden'],
    'aria-label': props['aria-label'],
    role: props['aria-label'] ? 'img' : undefined,
    className: props.className,
    style: style,
    dangerouslySetInnerHTML: { __html: inner },
  });
}
