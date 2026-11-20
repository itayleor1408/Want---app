/* Speed Ease — panel logic.
 * Curve model: cubic bezier ease P0(0,0) P1(a,0) P2(1-b,1) P3(1,1)
 *   a = left influence (leaving the first keyframe), b = right influence (into the second).
 * The graph shows SPEED (dy/dx of that curve), like the speed graph in After Effects.
 */
(function () {
  'use strict';

  var MIN = 0.01, MAX = 1;
  var state = { a: 0.33, b: 0.33 };
  var clip = load('se.clipboard', null);
  var registry = load('se.registry', {});
  var lastKey = null;

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('graph'), ctx = canvas.getContext('2d');
  var track = $('track'), knobL = $('knobL'), knobR = $('knobR'), center = $('center');
  var fillL = $('fillL'), fillR = $('fillR'), numL = $('numL'), numR = $('numR');

  // ---------- storage ----------
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // ---------- host bridge ----------
  function host(script, cb) {
    if (window.__adobe_cep__) {
      window.__adobe_cep__.evalScript(script, function (res) {
        var out;
        try { out = JSON.parse(res); } catch (e) { out = { ok: false, error: res || 'Script error' }; }
        cb && cb(out);
      });
    } else {
      cb && cb({ ok: false, error: 'Not running inside Premiere' });
    }
  }
  function regArg() { return JSON.stringify(JSON.stringify(registry)); }

  // ---------- math ----------
  function clamp(v) { return Math.max(MIN, Math.min(MAX, v)); }
  function bez(p1, p2, t) { var u = 1 - t; return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t; }
  function dbez(p1, p2, t) { var u = 1 - t; return 3 * u * u * p1 + 6 * u * t * (p2 - p1) + 3 * t * t * (1 - p2); }

  // ---------- drawing ----------
  function draw() {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var padX = 12, padTop = 22, padBot = 12;
    var gw = w - padX * 2, gh = h - padTop - padBot;
    if (gw <= 0 || gh <= 0) return;

    var a = state.a, b = state.b, x2 = 1 - b, N = 240, pts = [], max = 0, i;
    for (i = 0; i <= N; i++) {
      var t = i / N;
      var dx = dbez(a, x2, t), dy = dbez(0, 1, t);
      var sp = dx > 1e-4 ? dy / dx : 40;
      sp = Math.min(sp, 40);
      pts.push([bez(a, x2, t), sp]);
      if (sp > max) max = sp;
    }
    max = Math.max(max, 1.0001);

    var X = function (x) { return padX + x * gw; };
    var Y = function (s) { return padTop + gh - (s / max) * gh; };

    // baseline + midline
    ctx.strokeStyle = '#2f2f2f'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, Y(0) + 0.5); ctx.lineTo(padX + gw, Y(0) + 0.5);
    ctx.stroke();
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(X(0.5) + 0.5, padTop); ctx.lineTo(X(0.5) + 0.5, Y(0)); ctx.stroke();
    ctx.setLineDash([]);

    // area
    var grad = ctx.createLinearGradient(0, padTop, 0, Y(0));
    grad.addColorStop(0, 'rgba(111,168,255,0.22)');
    grad.addColorStop(1, 'rgba(111,168,255,0)');
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    for (i = 0; i < pts.length; i++) ctx.lineTo(X(pts[i][0]), Y(pts[i][1]));
    ctx.lineTo(X(1), Y(0));
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    // curve
    ctx.beginPath();
    for (i = 0; i < pts.length; i++) {
      var px = X(pts[i][0]), py = Y(pts[i][1]);
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.strokeStyle = '#6fa8ff'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
    ctx.stroke();

    // keyframe dots
    ctx.fillStyle = '#cfcfcf';
    [0, 1].forEach(function (x) {
      ctx.save(); ctx.translate(X(x), Y(0)); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-3, -3, 6, 6); ctx.restore();
    });
  }

  // ---------- controls ----------
  function render() {
    // left knob lives in the left half, right knob in the right half; 100% = at the centre
    // (each half stops 14px short of the centre icon)
    var lp = 'calc((50% - 14px) * ' + state.a + ')';
    var rw = 'calc((50% - 14px) * ' + state.b + ')';
    knobL.style.left = lp;
    knobR.style.left = 'calc(100% - (50% - 14px) * ' + state.b + ')';
    fillL.style.left = '0'; fillL.style.width = lp;
    fillR.style.left = 'auto'; fillR.style.right = '0'; fillR.style.width = rw;
    if (document.activeElement !== numL) numL.value = fmt(state.a);
    if (document.activeElement !== numR) numR.value = fmt(state.b);
    draw();
  }
  function fmt(v) { return String(Math.round(v * 1000) / 10); }

  function set(a, b) {
    if (a != null) state.a = clamp(a);
    if (b != null) state.b = clamp(b);
    render();
  }

  function drag(el, onMove, onEnd) {
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
      el.classList.add('drag');
      var x0 = e.clientX, half = track.getBoundingClientRect().width / 2 - 14, moved = false;
      var start = { a: state.a, b: state.b };
      function move(ev) {
        var dx = ev.clientX - x0;
        if (Math.abs(dx) > 1) moved = true;
        onMove(dx / half, start, ev);
      }
      function up() {
        el.classList.remove('drag');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        onEnd && onEnd(moved, start);
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }

  // left knob: drag right -> more influence -> speed peak sharper toward the right
  drag(knobL, function (d, s, ev) { set(s.a + d * (ev.shiftKey ? 0.2 : 1), null); });
  // right knob: drag left -> more influence -> speed peak sharper toward the left
  drag(knobR, function (d, s, ev) { set(null, s.b - d * (ev.shiftKey ? 0.2 : 1)); });
  // centre: drag left/right sets BOTH sides to the same value (right = sharper, left = softer)
  drag(center, function (d, s, ev) {
    var v = (s.a + s.b) / 2 + d * (ev.shiftKey ? 0.2 : 1);
    set(v, v);
  }, function (moved, s) {
    if (!moved) { var v = (s.a + s.b) / 2; set(v, v); }
  });

  function bindNum(input, which) {
    function commit() {
      var v = parseFloat(input.value);
      if (!isNaN(v)) set(which === 'a' ? v / 100 : null, which === 'b' ? v / 100 : null);
      input.value = fmt(state[which]);
    }
    input.addEventListener('change', commit);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { commit(); input.blur(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        var step = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
        var nv = Math.round(state[which] * 100) + step;
        set(which === 'a' ? nv / 100 : null, which === 'b' ? nv / 100 : null);
        input.value = fmt(state[which]);
      }
    });
    // scroll over the number to nudge
    input.addEventListener('wheel', function (e) {
      e.preventDefault();
      var nv = Math.round(state[which] * 100) + (e.deltaY < 0 ? 1 : -1);
      set(which === 'a' ? nv / 100 : null, which === 'b' ? nv / 100 : null);
    }, { passive: false });
  }
  bindNum(numL, 'a');
  bindNum(numR, 'b');

  // ---------- status ----------
  var stT;
  function status(msg, err) {
    var el = $('status');
    el.textContent = msg;
    el.className = 'status show' + (err ? ' err' : '');
    clearTimeout(stT);
    stT = setTimeout(function () { el.className = 'status' + (err ? ' err' : ''); }, 2200);
  }

  // ---------- registry of baked segments ----------
  function remember(segs) {
    segs.forEach(function (sg) {
      var list = (registry[sg.id] || []).filter(function (r) { return r.e <= sg.s || r.s >= sg.e; });
      list.push({ s: sg.s, e: sg.e, a: sg.a, b: sg.b });
      registry[sg.id] = list;
    });
    save('se.registry', registry);
  }
  function forget(segs) {
    segs.forEach(function (sg) {
      var list = (registry[sg.id] || []).filter(function (r) { return !(r.s === sg.s && r.e === sg.e); });
      if (list.length) registry[sg.id] = list; else delete registry[sg.id];
    });
    save('se.registry', registry);
  }

  // ---------- actions ----------
  var busy = false;
  function apply(a, b, label) {
    if (busy) return;
    busy = true;
    host('SE.apply(' + a + ',' + b + ',' + regArg() + ')', function (r) {
      busy = false;
      if (!r.ok) return status(r.error, true);
      remember(r.segments);
      status(label + ' · ' + r.applied + (r.applied === 1 ? ' property' : ' properties') +
        (r.skipped ? ' · ' + r.skipped + ' skipped' : ''));
      refresh();
    });
  }

  $('apply').addEventListener('click', function () { apply(state.a, state.b, 'Applied'); });

  $('copy').addEventListener('click', function () {
    clip = { a: state.a, b: state.b };
    save('se.clipboard', clip);
    $('paste').disabled = false;
    status('Copied ' + fmt(clip.a) + ' / ' + fmt(clip.b));
  });

  $('paste').addEventListener('click', function () {
    if (!clip) return;
    set(clip.a, clip.b);
    apply(clip.a, clip.b, 'Pasted');
  });

  $('clear').addEventListener('click', function () {
    host('SE.clear(' + regArg() + ')', function (r) {
      if (!r.ok) return status(r.error, true);
      forget(r.segments);
      status('Linear · ' + r.cleared);
      refresh();
    });
  });

  // ---------- what's under the playhead ----------
  function refresh() {
    if (busy) return;
    host('SE.info(' + regArg() + ')', function (r) {
      var info = $('info');
      if (!r.ok) { info.textContent = ''; lastKey = null; return; }
      info.textContent = r.frames + 'f' + (r.count > 1 ? ' · ' + r.count : '');
      // landing on a segment eased earlier loads its curve into the editor
      if (r.key !== lastKey && r.curve) set(r.curve.a, r.curve.b);
      lastKey = r.key;
    });
  }

  var poll = null;
  document.addEventListener('mouseenter', function () {
    refresh();
    if (!poll) poll = setInterval(refresh, 1200);
  });
  document.addEventListener('mouseleave', function () { clearInterval(poll); poll = null; });
  window.addEventListener('focus', refresh);

  window.addEventListener('resize', draw);
  if (clip) $('paste').disabled = false;
  render();
  refresh();
})();
