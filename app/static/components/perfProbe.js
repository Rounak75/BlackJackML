/*
 * components/perfProbe.js — Phase 7 T1
 * ─────────────────────────────────────────────────────────
 * Render-time probe wrapped around React.Profiler. Off by default
 * (zero cost). Enable from the console:
 *
 *   __BJ_PERF.enable()
 *   ...interact for ~50 hands...
 *   __BJ_PERF.report()    // console.table of count/mean/p50/p95/max
 *   __BJ_PERF.clear()     // reset buffers
 *   __BJ_PERF.disable()
 *
 * Usage in JSX:
 *   <PerfProbe id="right-column">{children}</PerfProbe>
 */

(function () {
  var BUF_SIZE = 200;
  var buffers = Object.create(null);
  var enabled = false;

  function record(id, actualDuration) {
    if (!enabled) return;
    var b = buffers[id] || (buffers[id] = []);
    if (b.length >= BUF_SIZE) b.shift();
    b.push(actualDuration);
  }

  function p(arr, q) {
    if (!arr.length) return 0;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    return s[Math.min(s.length - 1, Math.floor(q * s.length))];
  }

  window.__BJ_PERF = {
    enable:  function () { enabled = true;  return 'PERF probe ON';  },
    disable: function () { enabled = false; return 'PERF probe OFF'; },
    clear:   function () { buffers = Object.create(null); return 'PERF cleared'; },
    isOn:    function () { return enabled; },
    report:  function () {
      var rows = Object.keys(buffers).sort().map(function (id) {
        var arr = buffers[id];
        var sum = arr.reduce(function (a, b) { return a + b; }, 0);
        return {
          id:      id,
          n:       arr.length,
          mean_ms: arr.length ? +(sum / arr.length).toFixed(2) : 0,
          p50_ms:  +p(arr, 0.5).toFixed(2),
          p95_ms:  +p(arr, 0.95).toFixed(2),
          max_ms:  +Math.max.apply(null, arr.length ? arr : [0]).toFixed(2),
        };
      });
      if (console.table) console.table(rows); else console.log(rows);
      return rows;
    },
  };

  window.PerfProbe = function PerfProbe(props) {
    if (!React || !React.Profiler) return props.children;
    return React.createElement(
      React.Profiler,
      {
        id: props.id,
        onRender: function (id, phase, actualDuration) {
          record(id, actualDuration);
        },
      },
      props.children
    );
  };
})();
