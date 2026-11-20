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

    var padX = 16, padTop = 26, padBot = 16;
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
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(padX, Y(0) + 0.5); ctx.lineTo(padX + gw, Y(0) + 0.5);
    ctx.stroke();
    ctx.setLineDash([1, 4]);
    ctx.beginPath(); ctx.moveTo(X(0.5) + 0.5, padTop); ctx.lineTo(X(0.5) + 0.5, Y(0)); ctx.stroke();
    ctx.setLineDash([]);

    // area
    var grad = ctx.createLinearGradient(0, padTop, 0, Y(0));
    grad.addColorStop(0, 'rgba(116,171,255,0.26)');
    grad.addColorStop(1, 'rgba(116,171,255,0)');
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
    ctx.strokeStyle = '#74abff'; ctx.lineWidth = 2.8; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();

    // keyframe dots
    [0, 1].forEach(function (x) {
      ctx.beginPath(); ctx.arc(X(x), Y(0), 5, 0, Math.PI * 2);
      ctx.fillStyle = '#252525'; ctx.fill();
      ctx.lineWidth = 2.2; ctx.strokeStyle = '#d6d6d6'; ctx.stroke();
    });
  }

  // ---------- controls ----------
  function render() {
    // left knob lives in the left half, right knob in the right half; 100% = at the centre
    // (each half stops 18px short of the centre icon)
    var lp = 'calc((50% - 18px) * ' + state.a + ')';
    var rw = 'calc((50% - 18px) * ' + state.b + ')';
    knobL.style.left = lp;
    knobR.style.left = 'calc(100% - (50% - 18px) * ' + state.b + ')';
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
      var x0 = e.clientX, half = track.getBoundingClientRect().width / 2 - 18, moved = false;
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

  // ---------- ⋯ menu ----------
  var menu = $('menu'), moreBtn = $('moreBtn');
  function showMenu(open) {
    menu.hidden = !open;
    moreBtn.classList.toggle('open', open);
  }
  moreBtn.addEventListener('click', function (e) { e.stopPropagation(); showMenu(menu.hidden); });
  menu.addEventListener('click', function (e) {
    e.stopPropagation();
    if (e.target.closest('.item:not(:disabled)')) showMenu(false);
  });
  document.addEventListener('click', function () { showMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') showMenu(false); });

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

  // ---------- library ----------
  var library = load('se.library', []);   // [{id, name, a, b}]
  var libEl = $('lib'), libList = $('libList');
  var SVGNS = 'http://www.w3.org/2000/svg';
  var clickT = null;

  function saveLib() { save('se.library', library); }

  function thumb(a, b) {
    var W = 100, H = 52, N = 80, pts = [], max = 1, i;
    for (i = 0; i <= N; i++) {
      var t = i / N, dx = dbez(a, 1 - b, t), dy = dbez(0, 1, t);
      var sp = Math.min(dx > 1e-4 ? dy / dx : 40, 40);
      pts.push([bez(a, 1 - b, t), sp]);
      if (sp > max) max = sp;
    }
    var d = pts.map(function (p, k) {
      return (k ? 'L' : 'M') + (3 + p[0] * (W - 6)).toFixed(1) + ' ' + (H - 4 - p[1] / max * (H - 14)).toFixed(1);
    }).join('');
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'card-thumb');
    var area = document.createElementNS(SVGNS, 'path');
    area.setAttribute('class', 'area'); area.setAttribute('d', d + 'L' + (W - 3) + ' ' + (H - 3) + 'L3 ' + (H - 3) + 'Z');
    var line = document.createElementNS(SVGNS, 'path');
    line.setAttribute('class', 'line'); line.setAttribute('d', d);
    line.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(area); svg.appendChild(line);
    return svg;
  }

  function same(item) { return Math.abs(item.a - state.a) < 1e-4 && Math.abs(item.b - state.b) < 1e-4; }
  function byId(id) { for (var i = 0; i < library.length; i++) if (library[i].id === id) return library[i]; return null; }

  // ----- card ⋯ menu (one shared popover) -----
  var cardMenu = $('cardMenu'), menuItem = null, menuBtn = null;
  function closeCardMenu() {
    cardMenu.hidden = true;
    if (menuBtn) menuBtn.classList.remove('open');
    var del = $('cmDelete'); del.classList.remove('confirm'); del.querySelector('span').textContent = 'Delete';
    menuItem = menuBtn = null;
  }
  function openCardMenu(item, btn) {
    if (menuItem === item) return closeCardMenu();
    closeCardMenu();
    menuItem = item; menuBtn = btn; btn.classList.add('open');
    cardMenu.hidden = false;
    var r = btn.getBoundingClientRect(), mw = cardMenu.offsetWidth, mh = cardMenu.offsetHeight;
    var left = Math.min(r.right - mw, window.innerWidth - mw - 6);
    var top = r.bottom + 4;
    if (top + mh > window.innerHeight - 6) top = r.top - mh - 4;
    cardMenu.style.left = Math.max(6, left) + 'px';
    cardMenu.style.top = Math.max(6, top) + 'px';
  }
  cardMenu.addEventListener('click', function (e) { e.stopPropagation(); });
  cardMenu.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  $('cmRename').addEventListener('click', function () { var it = menuItem; closeCardMenu(); renderLib(it.id); });
  $('cmUpdate').addEventListener('click', function () {
    var it = menuItem; closeCardMenu();
    it.a = state.a; it.b = state.b; saveLib(); renderLib();
  });
  $('cmDelete').addEventListener('click', function () {
    var del = $('cmDelete');
    if (!del.classList.contains('confirm')) {          // first click asks, second deletes
      del.classList.add('confirm'); del.querySelector('span').textContent = 'Click to confirm';
      return;
    }
    var it = menuItem; closeCardMenu();
    library = library.filter(function (x) { return x !== it; });
    saveLib(); renderLib();
  });
  document.addEventListener('pointerdown', function () { if (!cardMenu.hidden) closeCardMenu(); });
  libList.addEventListener('scroll', function () { if (!cardMenu.hidden) closeCardMenu(); });

  // ----- drag to reorder -----
  function dragCard(li, e) {
    var startX = e.clientX, startY = e.clientY, dragging = false, offX = 0, offY = 0;
    function place(ev) {
      li.style.transform = '';
      var r = li.getBoundingClientRect();
      li.style.transform = 'translate(' + (ev.clientX - offX - r.left) + 'px,' + (ev.clientY - offY - r.top) + 'px) scale(1.04)';
    }
    function move(ev) {
      if (!dragging) {
        if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < 6) return;
        dragging = true;
        clearTimeout(clickT);
        var r = li.getBoundingClientRect();
        offX = startX - r.left; offY = startY - r.top;
        li.classList.add('dragging');
        libList.classList.add('sorting');
      }
      // which card is under the pointer?
      var cards = libList.querySelectorAll('.card');
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        if (c === li) continue;
        var r2 = c.getBoundingClientRect();
        if (ev.clientX >= r2.left && ev.clientX <= r2.right && ev.clientY >= r2.top && ev.clientY <= r2.bottom) {
          var kids = Array.prototype.slice.call(libList.children);
          if (kids.indexOf(li) < kids.indexOf(c)) libList.insertBefore(li, c.nextSibling);
          else libList.insertBefore(li, c);
          break;
        }
      }
      // auto-scroll near the edges
      var lr = libList.getBoundingClientRect();
      if (ev.clientY < lr.top + 20) libList.scrollTop -= 8;
      else if (ev.clientY > lr.bottom - 20) libList.scrollTop += 8;
      place(ev);
    }
    function up() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!dragging) return;
      li.classList.remove('dragging');
      libList.classList.remove('sorting');
      li.style.transform = '';
      li._dragged = true;
      setTimeout(function () { li._dragged = false; }, 0);
      var order = Array.prototype.map.call(libList.querySelectorAll('.card'), function (c) { return byId(c.dataset.id); });
      library = order.filter(Boolean);
      saveLib();
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function renderLib(editId) {
    var toFocus = null;
    libList.innerHTML = '';
    $('libEmpty').style.display = library.length ? 'none' : '';
    library.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'card' + (same(item) ? ' active' : '');
      li.dataset.id = item.id;

      var g = document.createElement('div');
      g.className = 'card-graph';
      g.appendChild(thumb(item.a, item.b));
      li.appendChild(g);

      var foot = document.createElement('div');
      foot.className = 'card-foot';
      li.appendChild(foot);

      if (item.id === editId) {
        li.classList.add('editing');
        var inp = document.createElement('input');
        inp.className = 'card-input';
        inp.value = item.name;
        inp.maxLength = 40;
        var done = false;
        var finish = function (ok) {
          if (done) return; done = true;
          var v = inp.value.trim();
          if (ok && v) item.name = v;
          if (!ok && item.isNew) library = library.filter(function (x) { return x !== item; });
          delete item.isNew;
          saveLib();
          renderLib();
        };
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') finish(true);
          if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
        });
        inp.addEventListener('blur', function () { finish(true); });
        inp.addEventListener('click', function (e) { e.stopPropagation(); });
        inp.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        foot.appendChild(inp);
        toFocus = inp;
      } else {
        var name = document.createElement('span');
        name.className = 'card-name';
        name.textContent = item.name;
        name.title = item.name + '  ·  ' + fmt(item.a) + ' / ' + fmt(item.b);
        foot.appendChild(name);

        var more = document.createElement('button');
        more.className = 'card-more';
        more.title = 'Options';
        more.innerHTML = '<svg viewBox="0 0 16 16"><circle cx="3.5" cy="8" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="12.5" cy="8" r="1.2"/></svg>';
        more.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        more.addEventListener('click', function (e) { e.stopPropagation(); openCardMenu(item, more); });
        li.appendChild(more);

        li.addEventListener('pointerdown', function (e) { if (e.button === 0) dragCard(li, e); });
        // single click = load and go back; double click = rename
        li.addEventListener('click', function (e) {
          if (li._dragged || e.detail > 1) return;
          clearTimeout(clickT);
          clickT = setTimeout(function () { set(item.a, item.b); openLib(false); status(item.name); }, 230);
        });
        li.addEventListener('dblclick', function (e) {
          if (li._dragged) return;
          e.preventDefault(); clearTimeout(clickT); renderLib(item.id);
        });
      }
      libList.appendChild(li);
    });
    if (toFocus) { toFocus.focus(); toFocus.select(); }
  }

  function openLib(open) {
    closeCardMenu();
    libEl.hidden = !open;
    if (open) renderLib();
  }

  $('libBtn').addEventListener('click', function () { openLib(true); });
  $('libBack').addEventListener('click', function () { openLib(false); });
  $('savePreset').addEventListener('click', function () { openLib(true); $('libAdd').click(); });
  $('libAdd').addEventListener('click', function () {
    var n = library.length + 1, names = library.map(function (x) { return x.name; });
    while (names.indexOf('Curve ' + n) !== -1) n++;
    var item = { id: Date.now().toString(36), name: 'Curve ' + n, a: state.a, b: state.b, isNew: true };
    library.unshift(item);
    renderLib(item.id);
    libList.scrollTop = 0;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || libEl.hidden || document.activeElement.tagName === 'INPUT') return;
    if (!cardMenu.hidden) closeCardMenu(); else openLib(false);
  });

  window.addEventListener('resize', draw);
  if (clip) $('paste').disabled = false;
  render();
  refresh();
})();
