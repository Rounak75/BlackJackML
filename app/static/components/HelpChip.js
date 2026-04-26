/*
 * components/HelpChip.js — Phase 6 F5
 * ─────────────────────────────────────────────────────────
 * Single 16px circular "?" tooltip trigger. Keyboard- and pointer-
 * accessible — opens on hover, focus, and click. Replaces the
 * scattered title="" hovers and ad-hoc tooltip chips around the app.
 *
 * Usage:
 *   <HelpChip text="Edge = player advantage at this true count." />
 *   <HelpChip text="..." size={14} />
 *   <HelpChip text="..." placement="left" />
 */

function HelpChip({ text, size, placement, ariaLabel }) {
  var useState = React.useState;
  var useRef   = React.useRef;
  var useEffect = React.useEffect;

  var SZ = typeof size === 'number' ? size : 16;
  var PLACE = placement || 'top';

  var _open = useState(false);
  var open = _open[0], setOpen = _open[1];
  var btnRef = useRef(null);

  useEffect(function () {
    if (!open) return;
    function onDocClick(e) {
      if (btnRef.current && !btnRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return function () {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  var tipStyle = {
    position: 'absolute',
    zIndex: 100,
    background: 'var(--surface-deep)',
    color: 'var(--text-0)',
    border: 'var(--border-w) solid var(--border-bright)',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 'var(--font-sm)',
    fontWeight: 500,
    lineHeight: 1.4,
    maxWidth: 240,
    width: 'max-content',
    boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
    pointerEvents: 'none',
    whiteSpace: 'normal',
  };
  if (PLACE === 'top')    { tipStyle.bottom = SZ + 6; tipStyle.left = '50%'; tipStyle.transform = 'translateX(-50%)'; }
  if (PLACE === 'bottom') { tipStyle.top = SZ + 6; tipStyle.left = '50%'; tipStyle.transform = 'translateX(-50%)'; }
  if (PLACE === 'left')   { tipStyle.right = SZ + 6; tipStyle.top = '50%'; tipStyle.transform = 'translateY(-50%)'; }
  if (PLACE === 'right')  { tipStyle.left  = SZ + 6; tipStyle.top = '50%'; tipStyle.transform = 'translateY(-50%)'; }

  return React.createElement('span', {
    style: { position: 'relative', display: 'inline-flex' },
  },
    React.createElement('button', {
      type: 'button',
      ref: btnRef,
      'aria-label': ariaLabel || 'More info',
      'aria-expanded': open,
      onMouseEnter: function () { setOpen(true); },
      onMouseLeave: function () { setOpen(false); },
      onFocus:      function () { setOpen(true); },
      onBlur:       function () { setOpen(false); },
      onClick:      function (e) { e.stopPropagation(); setOpen(function (v) { return !v; }); },
      style: {
        width: SZ, height: SZ,
        borderRadius: '50%',
        border: 'var(--border-w) solid var(--border)',
        background: 'transparent',
        color: 'var(--text-2)',
        fontSize: SZ <= 14 ? 9 : 10,
        fontWeight: 800,
        fontFamily: 'inherit',
        lineHeight: 1,
        cursor: 'help',
        display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
        padding: 0,
        transition: 'color 0.12s, border-color 0.12s, background 0.12s',
        flexShrink: 0,
      },
      onMouseDown: function (e) { e.preventDefault(); }, // keep focus where it was
    }, '?'),
    open && React.createElement('span', { role: 'tooltip', style: tipStyle }, text)
  );
}
