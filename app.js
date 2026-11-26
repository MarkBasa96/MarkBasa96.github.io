/* Joemark Basa portfolio: rendering, wires, tour, face, dialogs, palette.
   Reads inline JSON first (works in a sandbox or file://), then refreshes from data/*.json if reachable. */
(function () {
  'use strict';

  /* ---------- helpers ---------- */
  var root = document.documentElement;
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function noop() {}
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function ic(name, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
  function store(get, k, v) {
    try { if (get) return window.localStorage.getItem(k); window.localStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  function reduced() { return reduceMQ.matches; }
  var darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
  var noHoverMQ = window.matchMedia('(hover: none)');
  var paused = false;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function ym(s) { var m = /^(\d{4})-(\d{2})/.exec(s || ''); return m ? MONTHS[+m[2] - 1] + ' ' + m[1] : ''; }
  function ymd(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? (+m[3]) + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1] : ''; }

  /* ---------- data ---------- */
  function readJSON(id) { try { return JSON.parse(document.getElementById(id).textContent); } catch (e) { return null; } }
  var DATA = { projects: readJSON('data-projects') || { projects: [] }, profile: readJSON('data-profile') || {} };
  function P() { return DATA.profile; }
  function projects() { return DATA.projects.projects || []; }
  function pubList() { return projects().filter(function (p) { return p.visibility === 'public' && p.featured; }); }
  function labList() { return projects().filter(function (p) { return p.visibility !== 'public'; }); }

  /* ---------- toast ---------- */
  var toastEl = $('#toast'), toastT = 0;
  function toast(msg, ms) {
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 1900);
  }

  /* ---------- dialogs ---------- */
  var openers = new WeakMap();
  function openDlg(d, opener) {
    openers.set(d, opener || document.activeElement);
    d.classList.remove('closing');
    if (!d.open) d.showModal();
    root.classList.add('modal-lock');   /* the page behind stays still; only the modal scrolls */
  }
  function closeDlg(d) {
    if (!d.open || d.classList.contains('closing')) return;
    if (reduced()) { d.close(); return; }
    d.classList.add('closing');
    setTimeout(function () { d.classList.remove('closing'); if (d.open) d.close(); }, 190);
  }
  window.JBDialog = { open: openDlg, close: closeDlg };

  $$('dialog.modal').forEach(function (d) {
    d.addEventListener('cancel', function (e) { e.preventDefault(); closeDlg(d); });
    d.addEventListener('click', function (e) { if (e.target === d) closeDlg(d); });
    d.addEventListener('close', function () {
      d.style.transform = ''; d.style.transition = ''; d.classList.remove('dragging');
      if (!document.querySelector('dialog[open]')) root.classList.remove('modal-lock');
      var o = openers.get(d);
      if (o && o.focus && document.contains(o) && !document.querySelector('dialog[open]')) { try { o.focus({ preventScroll: true }); } catch (e) {} }
    });
    $$('[data-close]', d).forEach(function (b) { b.addEventListener('click', function () { closeDlg(d); }); });
    /* drag the handle down to close (bottom sheet on phones) */
    var h = $('.sheet-handle', d);
    if (h) {
      var y0 = 0, t0 = 0, dy = 0, drag = false;
      h.addEventListener('pointerdown', function (e) { drag = true; y0 = e.clientY; t0 = e.timeStamp; dy = 0; d.classList.add('dragging'); try { h.setPointerCapture(e.pointerId); } catch (x) {} });
      h.addEventListener('pointermove', function (e) { if (!drag) return; dy = Math.max(0, e.clientY - y0); d.style.transform = 'translateY(' + dy + 'px)'; });
      var end = function (e) {
        if (!drag) return; drag = false; d.classList.remove('dragging');
        var v = dy / Math.max(1, e.timeStamp - t0);
        if (dy > 110 || (dy > 30 && v > 0.6)) closeDlg(d);
        else { d.style.transition = 'transform .2s'; d.style.transform = ''; setTimeout(function () { d.style.transition = ''; }, 220); }
      };
      h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
    }
  });

  /* ---------- theme ---------- */
  function effTheme() { return root.getAttribute('data-theme') || (darkMQ.matches ? 'dark' : 'light'); }
  function applyMode() {
    var m = effTheme();
    root.setAttribute('data-mode', m);
    var b = $('#btn-theme');
    b.setAttribute('aria-label', m === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    b.title = m === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  }
  function toggleTheme() {
    var next = effTheme() === 'dark' ? 'light' : 'dark';
    if (!reduced()) { root.classList.add('theming'); setTimeout(function () { root.classList.remove('theming'); }, 320); }
    root.setAttribute('data-theme', next);
    store(false, 'jb-theme', next);
    $$('meta[name="theme-color"]').forEach(function (m) { m.setAttribute('content', next === 'dark' ? '#0e0e10' : '#f4f2ee'); });
    applyMode();
  }
  if (darkMQ.addEventListener) darkMQ.addEventListener('change', applyMode);
  applyMode();

  /* ---------- wires ---------- */
  function pathD(x1, y1, x2, y2, axis) {
    if (axis === 'h') { var dx = (x2 - x1) * 0.5; return 'M' + x1 + ' ' + y1 + ' C' + (x1 + dx) + ' ' + y1 + ' ' + (x2 - dx) + ' ' + y2 + ' ' + x2 + ' ' + y2; }
    var dy = (y2 - y1) * 0.55;
    return 'M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + (y1 + dy) + ' ' + x2 + ' ' + (y2 - dy) + ' ' + x2 + ' ' + y2;
  }
  function setPre(path) {
    try { path.style.setProperty('--len', Math.ceil(path.getTotalLength()) + 'px'); } catch (e) {}
  }
  function travel(el, ms) {
    if (paused || reduced()) return;
    el.style.setProperty('--tt', (ms || 600) + 'ms');
    el.classList.remove('wtravel'); void el.offsetWidth; el.classList.add('wtravel');
    setTimeout(function () { el.classList.remove('wtravel'); }, (ms || 600) + 80);
  }

  var wires = $$('.wire[data-wire]');
  var WIRE_H = [78, 96, 68, 70, 90, 72, 70, 84];
  wires.forEach(function (w, i) {
    w.style.height = (WIRE_H[i] || 76) + 'px';
    w.innerHTML = '<div class="wbox"><svg aria-hidden="true"><path class="wp"/><path class="wh"/></svg><i class="wend a"></i><i class="wend b"></i><i class="wdot"></i><span class="wchip"></span></div>';
    $('.wh', w).addEventListener('mouseenter', function () { travel($('.wbox', w), 650); });
  });
  function layoutWires() {
    wires.forEach(function (w) {
      var box = $('.wbox', w), W = box.clientWidth, H = box.clientHeight;
      if (!W) return;
      var x1 = parseFloat(w.dataset.from) * W, x2 = parseFloat(w.dataset.to) * W;
      var d = pathD(x1, 0, x2, H, 'v');
      var wp = $('.wp', w); wp.setAttribute('d', d); $('.wh', w).setAttribute('d', d); setPre(wp);
      var a = $('.wend.a', w), b = $('.wend.b', w);
      a.style.left = x1 + 'px'; a.style.top = '0px'; b.style.left = x2 + 'px'; b.style.top = H + 'px';
      $('.wdot', w).style.offsetPath = "path('" + d + "')";
      $('.wdot', w).style.setProperty('offset-path', "path('" + d + "')");
    });
  }

  /* flow (How I work): links computed from real node positions */
  var flowPaths = [];
  function layoutFlow() {
    var flow = $('#flow'); if (!flow) return;
    var nodes = $$('.fnode', flow), fr = flow.getBoundingClientRect(), svg = $('svg.fw', flow);
    if (!svg || nodes.length < 2) return;
    for (var i = 0; i < nodes.length - 1; i++) {
      var a = nodes[i].getBoundingClientRect(), b = nodes[i + 1].getBoundingClientRect(), d;
      if (b.left > a.right - 4) d = pathD(a.right - fr.left, a.top + a.height / 2 - fr.top, b.left - fr.left, b.top + b.height / 2 - fr.top, 'h');
      else d = pathD(a.left + a.width / 2 - fr.left, a.bottom - fr.top, b.left + b.width / 2 - fr.left, b.top - fr.top, 'v');
      var p = flowPaths[i]; if (!p) continue;
      p.path.setAttribute('d', d); setPre(p.path);
      p.dot.style.setProperty('offset-path', "path('" + d + "')");
      try { var len = p.path.getTotalLength(), mid = p.path.getPointAtLength(len / 2); p.chip.style.left = mid.x + 'px'; p.chip.style.top = mid.y + 'px'; } catch (e) {}
    }
  }
  function buildFlow() {
    var flow = $('#flow'), steps = P().workflow || [];
    flow.innerHTML = '<svg class="fw" aria-hidden="true"></svg>' + steps.map(function (s, i) {
      return '<article class="node fnode io" data-fi="' + i + '" data-step="' + esc('Step ' + (i + 1) + ': ' + s.title) + '"><div class="node-head"><span class="nt">' + esc(s.type) + '</span><span class="st"><i class="dot"></i>' + ic('check', 'chk') + '</span></div><h3>' + esc(s.title) + '</h3><p>' + esc(s.text) + '</p></article>';
    }).join('');
    var svg = $('svg.fw', flow); flowPaths = [];
    for (var i = 0; i < steps.length - 1; i++) {
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('class', 'wp');
      svg.appendChild(path);
      var dot = document.createElement('i'); dot.className = 'wdot'; flow.appendChild(dot);
      var chip = document.createElement('span'); chip.className = 'wchip fchip'; chip.textContent = '1 item'; flow.appendChild(chip);
      flowPaths.push({ path: path, dot: dot, chip: chip });
    }
  }

  var layoutQueued = false;
  function layoutAll() {
    if (layoutQueued) return; layoutQueued = true;
    requestAnimationFrame(function () { layoutQueued = false; layoutWires(); layoutFlow(); });
  }

  /* draw each wire once, the first time it scrolls into view */
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      $$('.wp.pre', en.target).forEach(function (p) { p.classList.add('drawn'); });
      if (en.target.classList.contains('pre')) en.target.classList.add('drawn');
      io.unobserve(en.target);
    });
  }, { threshold: 0.2 }) : null;
  function armDraw() {
    if (!io || reduced()) return;
    $$('.wire, #timeline').forEach(function (el) {
      if (el.dataset.armed) return; el.dataset.armed = '1';
      if (el.id === 'timeline') el.classList.add('pre'); else $$('.wp', el).forEach(function (p) { p.classList.add('pre'); });
      io.observe(el);
    });
  }
  function armFlowDraw() {
    if (!io || reduced()) return;
    var f = $('#flow'); $$('.wp', f).forEach(function (p) { p.classList.add('pre'); }); io.observe(f);
  }

  /* ---------- render ---------- */
  function setText(id, t) { var e = document.getElementById(id); if (e && t != null) e.textContent = t; }

  function renderHero() {
    var p = P();
    setText('h-name', p.name); setText('p-headline', p.headline); setText('p-sub', p.sub); setText('p-sub2', p.about2);
    var sk = $('#p-skills'); if (sk && (p.core_skills || []).length) sk.innerHTML = p.core_skills.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
    setText('p-status', p.status); setText('p-loc', p.location + (p.location_note ? ' · ' + p.location_note.split(',')[0] : ''));
    $('#stats').innerHTML = (p.stats || []).map(function (s) { return '<li><b>' + esc(s.value) + '</b><span>' + esc(s.label) + '</span></li>'; }).join('');
    setText('reply-note', p.reply_note);
    var l = $('#email-link'); if (l) { l.textContent = p.email; l.href = 'mailto:' + p.email; }
    $$('.last-updated').forEach(function (e) { e.textContent = ymd(DATA.projects.last_updated); });
  }

  var filter = 'all';
  var FILTERS = [['all', 'All'], ['automation', 'Automation'], ['apps', 'Apps'], ['ai', 'AI/Content']];
  function statusChip(p) {
    var label = p.status_label || (p.status === 'live' ? 'Live' : p.status === 'demo' ? 'Demo' : 'In progress');
    return '<span class="sc ' + esc(p.status) + '"><i class="dot"></i>' + esc(label) + '</span>';
  }
  /* real app icon when we have one (rounded), else the generic line glyph */
  function pic(p) {
    if (p.icon_img) return '<img class="pimg" src="' + esc(p.icon_img) + '" alt="" width="28" height="28" decoding="async" data-glyph="' + esc(p.icon || 'glyph') + '">';
    return ic(p.icon || 'glyph', 'pic');
  }
  function recChip(p) {
    var r = p.recognition; if (!r) return '';
    return '<a class="rec" href="' + esc(r.url) + '" target="_blank" rel="noopener" title="Open the XERJ Corpus Hub contributor page">' + ic('star') + '<span>' + esc(r.label) + '</span>' + ic('ext') + '</a>';
  }
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.classList.contains('pimg')) { var s = document.createElement('span'); s.innerHTML = ic(t.getAttribute('data-glyph') || 'glyph', 'pic'); t.replaceWith(s.firstChild); }
  }, true);
  function layoutClasses(n) {
    var out = [];
    if (n === 0) return out;
    if (n === 1) return ['c4'];
    out.push('c2r2');
    var r = n - 1, block = Math.min(r, 4), i;
    if (block === 1) out.push('c2r2');
    else if (block === 2) out.push('c2', 'c2');
    else if (block === 3) out.push('c2', '', '');
    else out.push('', '', '', '');
    var rest = r - block;
    for (i = 0; i < rest; i++) out.push('c2');
    if (rest % 2 === 1) out[out.length - 1] = 'c4';
    return out;
  }
  function renderFilters() {
    $('#filters').innerHTML = FILTERS.map(function (f) {
      return '<button class="chip" type="button" data-filter="' + f[0] + '" aria-pressed="' + (filter === f[0]) + '">' + f[1] + '</button>';
    }).join('');
  }
  function renderProjects() {
    var list = pubList().filter(function (p) { return filter === 'all' || p.group === filter; });
    list.sort(function (a, b) { return (b.spotlight ? 1 : 0) - (a.spotlight ? 1 : 0); });
    var cls = layoutClasses(list.length);
    $('#pgrid').innerHTML = list.map(function (p, i) {
      var big = cls[i] === 'c2r2' || cls[i] === 'c4';
      return '<article class="node io card ' + cls[i] + '" data-step="' + esc(p.name) + '"><div class="node-head">' + pic(p) +
        '<h3><button class="card-btn" type="button" data-open="' + esc(p.id) + '">' + esc(p.name) + '</button></h3>' + statusChip(p) + '</div>' +
        '<div class="card-body"><p>' + esc(p.one_liner) + '</p>' + (big && p.details ? '<p class="det">' + esc(p.details) + '</p>' : '') +
        '<div class="card-more">' + recChip(p) + (p.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') +
        '<span class="go">Details' + ic('arrow') + '</span></div></div></article>';
    }).join('');
    $$('.chip', $('#filters')).forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.filter === filter)); });
    $('#lab').innerHTML = labList().filter(function (p) { return filter === 'all' || p.group === filter; }).map(function (p) {
      return '<li class="lab-row" id="lab-' + esc(p.id) + '" data-step="Lab: ' + esc(p.name) + '">' + pic(p) + '<b>' + esc(p.name) + '</b><span class="lab-tags">' + statusChip(p) + '<span class="sc"><i class="dot"></i>Private</span></span><p>' + esc(p.one_liner) + '</p></li>';
    }).join('');
    layoutAll();
  }

  function openProject(id, opener) {
    var p = projects().filter(function (x) { return x.id === id; })[0]; if (!p) return;
    $('#dp-title').innerHTML = pic(p) + '<span>' + esc(p.name) + '</span>';
    var links = '';
    if (p.url) links += '<a class="btn btn-accent" href="' + esc(p.url) + '" target="_blank" rel="noopener">' + (p.status === 'live' && p.url.indexOf('github.com') < 0 ? 'Open live site' : 'Open repo') + ic('ext') + '</a>';
    if (p.repo && p.url.indexOf('github.com/' + p.repo) < 0) links += '<a class="btn btn-line" href="https://github.com/' + esc(p.repo) + '" target="_blank" rel="noopener">' + ic('github') + 'GitHub repo</a>';
    $('#dp-body').innerHTML = '<div class="pm-meta">' + statusChip(p) + (p.updated ? '<span>Updated ' + esc(ym(p.updated)) + '</span>' : '') + '</div>' +
      '<p>' + esc(p.details || p.one_liner) + '</p>' + (p.recognition ? '<div class="rec-block">' + ic('star') + '<div><p>' + esc(p.recognition.text) + '</p><a href="' + esc(p.recognition.url) + '" target="_blank" rel="noopener">See the contributor page' + ic('ext') + '</a></div></div>' : '') + '<div class="card-more">' + (p.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
      (links ? '<div class="modal-actions">' + links + '</div>' : '');
    openDlg($('#dlg-project'), opener);
  }

  function renderTimeline() {
    var p = P(), xs = (p.experience || []).map(function (e) {
      return { dates: e.from + ' – ' + e.to, role: e.role, org: e.org + (e.place ? ' · ' + e.place : ''), bullets: e.bullets || [] };
    });
    if ((p.earlier || []).length) xs.push({ dates: '2015 – 2020', role: 'Earlier roles', org: 'Sales & service', bullets: p.earlier });
    $('#timeline').innerHTML = xs.map(function (x, i) {
      var open = i === 0;
      return '<article class="node io xnode' + (open ? ' open' : '') + '" data-step="' + esc(x.role + ' · ' + x.org) + '"><h3><button class="xbtn" type="button" aria-expanded="' + open + '" aria-controls="xp' + i + '">' +
        '<span class="node-head"><span class="nt">' + esc(x.dates) + '</span><span class="st">' + ic('chev') + '</span></span>' +
        '<span class="x-main"><span class="x-role">' + esc(x.role) + '</span><span class="x-org">' + esc(x.org) + '</span></span></button></h3>' +
        '<div class="xpanel" id="xp' + i + '"><div><ul>' + x.bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul><button class="btn btn-line btn-sm more-btn" type="button" data-role="' + i + '">More about this role' + ic('arrow') + '</button></div></div></article>';
    }).join('');
    var ed = p.education || {};
    $('#edu').innerHTML = '<div class="node io" data-step="Education"><div class="node-head"><span class="nt">Education</span></div><p><b>' + esc(ed.degree) + '</b><small>' + esc(ed.school) + ' · ' + esc(ed.years) + '</small></p></div>' +
      '<div class="node io" data-step="Certificates"><div class="node-head"><span class="nt">Certificates</span></div><ul>' + (p.certificates || []).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div>' + (p.recognition || []).map(function (r) {
      return '<div class="node io recog" data-step="Recognition"><div class="node-head"><span class="nt">Recognition</span>' + ic('star', 'rstar') + '</div><p><b>' + esc(r.title) + '</b><small>' + esc(r.summary) + '</small></p><ul>' +
        (r.items || []).map(function (it) { return '<li><b>' + esc(it.project) + '</b> · ' + esc(it.date) + '. ' + esc(it.text) + '</li>'; }).join('') + '</ul><a class="rec rec-link" href="' + esc(r.url) + '" target="_blank" rel="noopener">' + ic('star') + '<span>See the contributor page</span>' + ic('ext') + '</a></div>';
    }).join('');
  }

  function chipsHTML(list) { return '<ul class="rchips">' + list.map(function (t) { return '<li class="tag">' + esc(t) + '</li>'; }).join('') + '</ul>'; }
  function openRole(i, opener) {
    var p = P(), exp = p.experience || [], title, body = '';
    if (i < exp.length) {
      var e = exp[i], d = e.details || {};
      title = '<span>' + esc(e.role) + '</span>';
      body = '<div class="pm-meta"><span>' + esc(e.org + (e.place ? ' · ' + e.place : '')) + '</span><span>' + esc(e.from + ' – ' + e.to) + '</span></div>';
      body += '<section class="rsec"><h3>What I did</h3><ul class="rlist">' + (d.did || e.bullets || []).map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></section>';
      if ((d.tools || []).length) body += '<section class="rsec"><h3>Tools</h3>' + chipsHTML(d.tools) + '</section>';
      if ((d.results || []).length) body += '<section class="rsec"><h3>Results</h3>' + chipsHTML(d.results).replace('class="rchips"', 'class="rchips res"') + '</section>';
      if (d.built) body += '<section class="rsec"><h3>How I built it</h3><p>' + esc(d.built) + '</p></section>';
    } else {
      title = '<span>Earlier roles</span>';
      body = '<div class="pm-meta"><span>2015 – 2020</span><span>Sales &amp; service</span></div>' + (p.earlier_details || []).map(function (r) {
        return '<section class="rsec"><h3>' + esc(r.role) + '</h3><div class="rmeta">' + esc(r.org + ' · ' + r.place + ' · ' + r.dates) + '</div><ul class="rlist">' + r.bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></section>';
      }).join('');
    }
    $('#dro-title').innerHTML = title; $('#dro-body').innerHTML = body;
    $('#dro-body').scrollTop = 0;
    openDlg($('#dlg-role'), opener);
  }

  function agentData(id) {
    var T = ((P().off_clock || {}).team) || {};
    if (id === 'joe' || id === 'raphael' || id === 'jarvis') return T[id];
    return (T.agents || []).filter(function (x) { return x.name.toLowerCase() === id; })[0];
  }
  function openAgent(id, opener) {
    var g = agentData(id); if (!g) return; var m = g.more || {};
    $('#dag-title').textContent = g.name;
    var body = '<div class="ag-head">' + figHTML(g) + '<div class="ag-who">' + (g.from ? '<span class="from mono">' + esc(g.from) + '</span>' : '') + '<p>' + esc(g.role) + '</p></div></div>';
    if (m.intro) body += '<p class="ag-intro">' + esc(m.intro) + '</p>';
    if ((m.does || []).length) body += '<section class="rsec"><h3>What ' + (id === 'joe' ? 'I do' : 'they do') + '</h3><ul class="rlist">' + m.does.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></section>';
    if (m.when) body += '<section class="rsec"><h3>' + (id === 'joe' ? 'When I step in' : 'When I call on them') + '</h3><p>' + esc(m.when) + '</p></section>';
    if (m.never) body += '<section class="rsec"><h3>What ' + (id === 'joe' ? 'I keep' : 'they never do') + '</h3><p>' + esc(m.never) + '</p></section>';
    $('#dag-body').innerHTML = body; $('#dag-body').scrollTop = 0;
    openDlg($('#dlg-agent'), opener);
  }

  /* Toolbox: every tool is a shiny billiard ball. They drift and collide on their own (silently);
     grab one (mouse drag, or press and hold on a phone), fling it, and the collisions click. */
  var BALL_HUE = ['#ff6d3f', '#7c5cff', '#1f8fff', '#16a34a', '#e0447c', '#f5a524', '#0ea5a4', '#8b5e3c'];
  function renderTools() {
    var box = $('#tools'); if (!box) return;
    var html = '<div class="pit" id="pit" data-step="Toolbox"><p class="pit-hint mono">Tap a ball to see what it does, or grab one and throw it</p>', gi = 0;
    (P().toolbox || []).forEach(function (g) {
      var hue = BALL_HUE[gi++ % BALL_HUE.length];
      g.items.forEach(function (it) {
        html += '<button class="ball" type="button" style="--b:' + hue + '" data-name="' + esc(it.name) + '" aria-label="' + esc(it.name) + ' (' + esc(g.group) + ')">' +
          '<span class="ball-disc">' + (it.img ? '<img class="ticon" src="' + esc(it.img) + '" alt="" width="26" height="26" draggable="false" loading="lazy" decoding="async">' : ic('glyph')) + '</span>' +
          '<span class="sr-only">' + esc(it.name) + ', ' + esc(g.group) + '</span></button>';
      });
    });
    box.innerHTML = html + '<span class="ball-tip mono" id="ball-tip" aria-hidden="true"></span></div>';
    $$('img.ticon', box).forEach(function (img) {
      img.addEventListener('error', function () { var s2 = document.createElement('span'); s2.innerHTML = ic('glyph'); img.replaceWith(s2.firstChild); });
    });
    Pit.init($('#pit'));
    box.addEventListener('click', function (e) { var el = e.target.closest('.ball'); if (el && e.detail === 0) openTool(el.dataset.name, el); });   /* keyboard: Enter/Space */
  }

  function openTool(name, opener) {
    var hit = null; (P().toolbox || []).forEach(function (g) { g.items.forEach(function (it) { if (it.name === name) hit = { it: it, g: g.group }; }); });
    if (!hit) return; var it = hit.it, d = $('#dlg-tool');
    $('#dt-title').innerHTML = (it.img ? '<img class="dt-ic" src="' + esc(it.img) + '" alt="" width="28" height="28">' : '') + esc(it.name);
    $('#dt-body').innerHTML = '<p class="mono dt-group">' + esc(hit.g) + '</p>' +
      (it.what ? '<div><h3 class="dt-h">What it is</h3><p>' + esc(it.what) + '</p></div>' : '') +
      (it.use ? '<div><h3 class="dt-h">What I use it for</h3><p>' + esc(it.use) + '</p></div>' : '');
    openDlg(d, opener);
  }
  var Pit = (function () {
    var box = null, tip = null, bs = [], raf = 0, last = 0, seen = false, io = null, grab = null, loud = 0, lastClack = 0, nudgeT = 0, W = 0, H = 0;
    function rnd(a, b) { return a + Math.random() * (b - a); }
    var rFit = 0;
    function radius() { return rFit || (W < 520 ? 24 : 33); }
    function measure() { W = box.clientWidth; H = box.clientHeight; var r = radius(); bs.forEach(function (b) { b.r = r; b.el.style.width = b.el.style.height = (2 * r) + 'px'; }); }
    function place(b) { b.el.style.transform = 'translate(' + (b.x - b.r).toFixed(1) + 'px,' + (b.y - b.r).toFixed(1) + 'px)'; }
    /* the play area is sized to the number of balls, so there is no big empty space below them */
    function fit() {
      W = box.clientWidth;
      if (root.classList.contains('fit-tab')) {   /* phone: exactly the space left above the bottom bar */
        var fh = Math.max(200, fitSpace(box, 8)); box.style.height = fh + 'px';
        rFit = Math.max(11, Math.min(24, Math.floor(Math.sqrt(W * fh * 0.30 / (bs.length * Math.PI))))); return;   /* more tools = smaller balls, always one screen */
      }
      rFit = 0;
      var cap = Math.floor(Math.sqrt(W * 600 * 0.30 / (Math.max(1, bs.length) * Math.PI)));   /* desktop: shrink balls only when there are too many to fit */
      if (cap < radius()) rFit = Math.max(16, cap);
      var r = radius(), cell = 2 * r + 16;
      var h = Math.ceil(bs.length * cell * cell * 1.35 / Math.max(1, W)) + 2 * r;
      if (W >= 700) h = Math.max(h, Math.min(640, window.innerHeight - 230));   /* desktop: use the screen height so the balls fill what you see */
      box.style.height = Math.max(260, Math.min(640, h)) + 'px';
    }
    function rack() {   /* start spread over the whole area (shuffled, a little jitter), not stacked at the top */
      fit(); measure();
      var r = radius(), n = bs.length, cols = Math.max(1, Math.round(Math.sqrt(n * W / Math.max(1, H)))), rows = Math.ceil(n / cols);
      var cw = W / cols, ch = H / rows, order = bs.map(function (b, i) { return i; });
      for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t; }
      order.forEach(function (bi, k) {
        var b = bs[bi], c = k % cols, row = Math.floor(k / cols);
        var lastRow = row === rows - 1, inRow = lastRow ? n - row * cols : cols, cwr = W / inRow;   /* centre a short last row */
        var jx = Math.max(0, (cwr - 2 * r) / 2 - 2), jy = Math.max(0, (ch - 2 * r) / 2 - 2);
        b.x = Math.max(r + 1, Math.min(W - r - 1, (c + .5) * cwr + rnd(-jx, jx) * .6));
        b.y = Math.max(r + 1, Math.min(H - r - 1, (row + .5) * ch + rnd(-jy, jy) * .6));
        b.vx = reduced() ? 0 : rnd(-60, 60); b.vy = reduced() ? 0 : rnd(-60, 60);
        place(b);
      });
    }

    function clack(v) {
      var now = performance.now(); if (now - lastClack < 35 || v < 40) return; lastClack = now;
      if (window.__JBFeel && window.__JBFeel.clack) window.__JBFeel.clack(v);
    }
    function step(dt) {
      var r, i, j, a, b, dx, dy, d, min, nx, ny, rel, imp, ov, fr = Math.pow(0.55, dt), noisy = grab || performance.now() < loud;
      for (i = 0; i < bs.length; i++) {
        a = bs[i]; if (a === grab) continue;
        a.vx *= fr; a.vy *= fr; a.x += a.vx * dt; a.y += a.vy * dt; r = a.r;
        if (a.x < r) { a.x = r; if (a.vx < 0) { if (noisy) clack(-a.vx * .6); a.vx = -a.vx * .82; } }
        if (a.x > W - r) { a.x = W - r; if (a.vx > 0) { if (noisy) clack(a.vx * .6); a.vx = -a.vx * .82; } }
        if (a.y < r) { a.y = r; if (a.vy < 0) { if (noisy) clack(-a.vy * .6); a.vy = -a.vy * .82; } }
        if (a.y > H - r) { a.y = H - r; if (a.vy > 0) { if (noisy) clack(a.vy * .6); a.vy = -a.vy * .82; } }
      }
      for (i = 0; i < bs.length; i++) for (j = i + 1; j < bs.length; j++) {
        a = bs[i]; b = bs[j]; dx = b.x - a.x; dy = b.y - a.y; min = a.r + b.r;
        if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
        d = Math.hypot(dx, dy); if (d >= min || d === 0) continue;
        nx = dx / d; ny = dy / d; ov = min - d;
        var ma = a === grab ? 0 : 1, mb = b === grab ? 0 : 1, sum = ma + mb; if (!sum) continue;
        a.x -= nx * ov * ma / sum; a.y -= ny * ov * ma / sum; b.x += nx * ov * mb / sum; b.y += ny * ov * mb / sum;
        rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (rel >= 0) continue;
        imp = -(1 + .94) * rel / sum;
        a.vx -= imp * nx * ma; a.vy -= imp * ny * ma; b.vx += imp * nx * mb; b.vy += imp * ny * mb;
        if (noisy) clack(-rel);
      }
      bs.forEach(place);
    }
    function energy() { return bs.reduce(function (e, b) { return e + b.vx * b.vx + b.vy * b.vy; }, 0); }
    function running() { return box && seen && !document.hidden && box.offsetParent && !root.hasAttribute('data-paused'); }
    function frame(now) {
      raf = 0; if (!running()) return;
      var dt = Math.min(0.033, (now - (last || now)) / 1000); last = now;
      step(dt / 2); step(dt / 2);
      /* keep the table alive: when everything has nearly stopped, give one ball a gentle push (never with reduced motion) */
      if (!grab && !reduced() && now > nudgeT && energy() < bs.length * 120) {
        var b = bs[Math.floor(Math.random() * bs.length)], ang = rnd(0, Math.PI * 2), sp = rnd(160, 260);
        b.vx += Math.cos(ang) * sp; b.vy += Math.sin(ang) * sp; nudgeT = now + rnd(1800, 3600);
      }
      if (grab || reduced() === false || energy() > 4) raf = requestAnimationFrame(frame);
    }
    function wake() { if (!raf && running()) { last = 0; raf = requestAnimationFrame(frame); } }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function showTip(b) {
      if (!tip) return;
      tip.textContent = b.el.dataset.name; tip.classList.add('on');
      tip.style.transform = 'translate(' + Math.max(4, Math.min(W - tip.offsetWidth - 4, b.x - tip.offsetWidth / 2)).toFixed(0) + 'px,' + Math.max(2, b.y - b.r - 34).toFixed(0) + 'px)';
    }
    function hideTip(delay) { clearTimeout(hideTip.t); hideTip.t = setTimeout(function () { if (tip && !grab) tip.classList.remove('on'); }, delay || 0); }
    function local(e) { var rc = box.getBoundingClientRect(); return { x: e.clientX - rc.left, y: e.clientY - rc.top }; }
    function onDown(e) {
      var el = e.target.closest('.ball'); if (!el || (e.button != null && e.button > 0)) return;
      var b = bs.filter(function (x) { return x.el === el; })[0]; if (!b) return;
      e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (er) {}
      if (window.__JBFeel) window.__JBFeel.prime();
      var p = local(e); grab = b; b.ox = b.x - p.x; b.oy = b.y - p.y; b.hist = [{ x: b.x, y: b.y, t: performance.now() }]; b.vx = b.vy = 0;
      b.moved = 0; el.classList.add('held'); box.classList.add('grabbing'); showTip(b); wake();
    }
    function onMove(e) {
      if (!grab) return; var b = grab, p = local(e), nx = Math.max(b.r, Math.min(W - b.r, p.x + b.ox)), ny = Math.max(b.r, Math.min(H - b.r, p.y + b.oy)), now = performance.now();
      b.moved += Math.hypot(nx - b.x, ny - b.y); b.x = nx; b.y = ny;
      b.hist.push({ x: nx, y: ny, t: now }); while (b.hist.length > 2 && now - b.hist[0].t > 60) b.hist.shift();
      place(b); showTip(b);
    }
    function onUp() {
      if (!grab) return; var b = grab, h = b.hist, f = h[0], l = h[h.length - 1], dt = Math.max(16, l.t - f.t) / 1000;
      b.vx = Math.max(-2400, Math.min(2400, (l.x - f.x) / dt)); b.vy = Math.max(-2400, Math.min(2400, (l.y - f.y) / dt));
      if (performance.now() - l.t > 120) { b.vx = b.vy = 0; }
      b.el.classList.remove('held'); box.classList.remove('grabbing'); grab = null;
      if (b.moved < 6 && performance.now() - b.hist[0].t < 400 && h.length <= 3) { b.vx = b.vy = 0; hideTip(0); openTool(b.el.dataset.name, b.el); return; }
      loud = performance.now() + 2600; hideTip(b.moved < 6 ? 1400 : 500); wake();
    }
    function init(el) {
      stop(); box = el; if (!box) return; tip = $('#ball-tip', box);
      bs = $$('.ball', box).map(function (x) { return { el: x, x: 0, y: 0, vx: 0, vy: 0, r: 30 }; });
      box.addEventListener('pointerdown', onDown);
      box.addEventListener('pointermove', onMove);
      box.addEventListener('pointerup', onUp); box.addEventListener('pointercancel', onUp); box.addEventListener('lostpointercapture', onUp);
      box.addEventListener('focusin', function (e) { var b = bs.filter(function (x) { return x.el === e.target; })[0]; if (b) showTip(b); });
      box.addEventListener('focusout', function () { hideTip(); });
      box.addEventListener('keydown', function (e) {
        var b = bs.filter(function (x) { return x.el === e.target; })[0]; if (!b || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault(); var ang = rnd(0, Math.PI * 2); b.vx = Math.cos(ang) * 900; b.vy = Math.sin(ang) * 900; loud = performance.now() + 2000; wake();
      });
      if (io) io.disconnect();
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(function (es) { seen = es[0].isIntersecting; if (seen) { if (!box.dataset.racked) { box.dataset.racked = '1'; rack(); } wake(); } else stop(); });
        io.observe(box);
      } else { seen = true; rack(); wake(); }
    }
    document.addEventListener('visibilitychange', wake);
    function refit() {
      if (!box || !box.offsetParent) return; fit(); measure();
      bs.forEach(function (b) { b.x = Math.min(Math.max(b.r, b.x), W - b.r); b.y = Math.min(Math.max(b.r, b.y), H - b.r); place(b); }); wake();
    }
    window.addEventListener('resize', refit);
    new MutationObserver(wake).observe(root, { attributes: true, attributeFilter: ['data-paused'] });
    return { init: init, wake: wake, refit: refit };
  })();

  /* off the clock */
  function monogram(name, hue) { return '<span class="av" style="--hue:' + esc(hue || '#ff6d3f') + '" aria-hidden="true">' + esc(name.charAt(0)) + '</span>'; }
  /* pixel-art figure standing on a floor line; the at-desk pose shows on hover and when the run visits the card */
  function figHTML(a) {
    if (a.img) return '<span class="fig fig-photo"><img class="ph" src="' + esc(a.img) + '" alt="" width="64" height="64" decoding="async"></span>';
    var k = esc(a.sprite);
    return '<span class="fig"><img class="spr spr-front" src="assets/team/' + k + '-front.webp" alt="" loading="lazy" decoding="async" data-name="' + esc(a.name) + '" data-hue="' + esc(a.hue || '') + '">' +
      '<img class="spr spr-desk" src="assets/team/' + k + '-desk.webp" alt="" loading="lazy" decoding="async"></span>';
  }
  document.addEventListener('error', function (e) {
    var t = e.target; if (!t || t.tagName !== 'IMG') return;
    if (t.classList.contains('spr-desk')) t.remove();
    else if (t.classList.contains('spr-front')) { var f = t.closest('.fig'); if (f) f.innerHTML = monogram(t.getAttribute('data-name') || '?', t.getAttribute('data-hue')); }
  }, true);
  function orgNode(a, id) {
    return '<article class="node orgn" id="org-' + esc(id) + '" data-org="' + esc(id) + '" data-step="Team · ' + esc(a.name) + '">' + figHTML(a) +
      '<div class="oi"><b>' + esc(a.name) + '</b>' + (a.from ? '<span class="from mono">' + esc(a.from) + '</span>' : '') + '<p>' + esc(a.role) + '</p></div>' +
      '<button class="org-more" type="button" data-agent="' + esc(id) + '" aria-label="More about ' + esc(a.name) + '">' + ic('arrow') + '</button></article>';
  }
  var orgMQ = window.matchMedia('(max-width: 719px)'), orgRO = null;
  function layoutOrg() {
    var org = $('#org'); if (!org) return;
    var svg = $('.org-wires', org), or = org.getBoundingClientRect(), mobile = orgMQ.matches, d = [];
    function rel(el) { var r = el.getBoundingClientRect(); return { l: r.left - or.left, r: r.right - or.left, t: r.top - or.top, b: r.bottom - or.top, cx: r.left - or.left + r.width / 2, cy: r.top - or.top + r.height / 2 }; }
    function node(id) { var e = document.getElementById('org-' + id); return e ? { n: rel(e), top: e.closest('.dept') ? rel(e.closest('.dept')) : null } : null; }
    function link(pa, ch, cls) {
      var p = node(pa), c = node(ch); if (!p || !c) return;
      var x1, y1, x2, y2, path;
      if (mobile) {
        x1 = p.n.l + 16; y1 = p.n.b; x2 = c.n.l; y2 = c.n.cy;
        path = 'M' + x1 + ' ' + y1 + ' V' + (y2 - 8) + ' Q' + x1 + ' ' + y2 + ' ' + (x1 + 8) + ' ' + y2 + ' H' + x2;
      } else {
        x1 = p.n.cx; y1 = p.n.b; x2 = c.n.cx; y2 = (c.top || c.n).t; var k = (y2 - y1) / 2;
        path = 'M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + (y1 + k) + ' ' + x2 + ' ' + (y2 - k) + ' ' + x2 + ' ' + y2;
      }
      d.push('<path class="ow' + (cls ? ' ' + cls : '') + '" data-l="' + pa + '>' + ch + '" d="' + path + '"/>');
    }
    link('joe', 'raphael'); link('raphael', 'levi');
    $$('.dept .orgn', org).forEach(function (e) { link('levi', e.dataset.org); });
    var tag = $('.peer-tag', org);
    if (mobile) { link('raphael', 'jarvis', 'peer'); if (tag) tag.hidden = true; }
    else {
      var r = node('raphael'), j = node('jarvis');
      if (r && j) { var py = r.n.t + 54; d.push('<path class="ow peer" data-l="raphael>jarvis" d="M' + r.n.r + ' ' + py + ' L' + j.n.l + ' ' + py + '"/>'); if (tag) { tag.hidden = false; tag.style.left = (r.n.r + j.n.l) / 2 + 'px'; tag.style.top = py + 'px'; } }
    }
    svg.setAttribute('width', or.width); svg.setAttribute('height', or.height); svg.innerHTML = d.join('');
  }
  /* Team tab: Joe's photo on top, the agents wander freely below. The org chart only appears during a Run. */
  function renderOffClock() {
    var oc = P().off_clock, tb = $('#oc-team'); if (!oc || !tb) return;
    var T = oc.team, levi = T.agents[0], depts = T.agents.slice(1);
    var crew = [[T.raphael, 'raphael'], [T.jarvis, 'jarvis']].concat(T.agents.map(function (a) { return [a, a.name.toLowerCase()]; }));
    var ht = '<div class="oc-team"><h2 class="team-h">' + esc(T.title) + '</h2>' +
      '<div class="team-free"><button class="team-joe" type="button" data-agent="joe" aria-label="About ' + esc(T.joe.name) + '"><img src="' + esc(T.joe.img) + '" alt="" width="120" height="120" decoding="async"><span class="tj-name mono">' + esc(T.joe.name) + '</span></button>' +
      '<p class="yard-hint mono">Tap anyone to see what they do</p>' +
      '<div class="yard" id="yard">' + crew.map(function (c) {
        var a = c[0], id = c[1];
        var key = esc(a.sprite || id), src = 'assets/team/' + key + '-front.webp';
        return '<button class="walker" type="button" data-agent="' + esc(id) + '" data-key="' + key + '" aria-label="' + esc(a.name) + ': ' + esc(a.role) + '"><span class="wk-body">' +
          '<img class="wk-top" src="' + src + '" alt="" draggable="false" decoding="async"><img class="wk-leg wk-l" src="' + src + '" alt="" draggable="false" decoding="async"><img class="wk-leg wk-r" src="' + src + '" alt="" draggable="false" decoding="async">' +
          '<span class="wk-side"><img class="wk-s1" src="assets/team/' + key + '-side1.webp" alt="" draggable="false" decoding="async"><img class="wk-s2" src="assets/team/' + key + '-side2.webp" alt="" draggable="false" decoding="async"></span>' +
          '<span class="wk-back"><img class="wk-b1" alt="" draggable="false" decoding="async"><img class="wk-b2" alt="" draggable="false" decoding="async"></span><span class="wk-pose"></span>' +
          '</span><i class="wk-shadow" aria-hidden="true"></i></button>';
      }).join('') + '</div></div>' +
      '<div class="org" id="org"><svg class="org-wires" aria-hidden="true"></svg><span class="peer-tag mono" hidden>peer</span>' +
      '<div class="org-row org-r0">' + orgNode(T.joe, 'joe') + '</div>' +
      '<div class="org-row org-r1"><div class="org-c2">' + orgNode(T.raphael, 'raphael') + '</div><div class="org-c3">' + orgNode(T.jarvis, 'jarvis') + '</div></div>' +
      '<div class="org-row org-r2">' + orgNode(levi, 'levi') + '</div>' +
      '<div class="org-row org-r3">' + depts.map(function (a) { var id = a.name.toLowerCase(); return '<div class="dept"><span class="dept-label mono">' + esc(a.dept) + '</span>' + orgNode(a, id) + '</div>'; }).join('') + '</div></div></div>';
    tb.innerHTML = ht;
    Yard.init($('#yard')); JoeCam.init($('.team-joe img', tb));
    if (orgRO) orgRO.disconnect();
    if ('ResizeObserver' in window) { orgRO = new ResizeObserver(layoutOrg); orgRO.observe($('#org')); }
  }
  function teamOrg(on) {
    var t = $('.oc-team'); if (!t) return;
    if (t.classList.contains('org-on') === on) return;
    t.classList.toggle('org-on', on);
    if (on) { layoutOrg(); Yard.stop(); } else Yard.wake();
  }

  /* The crew: agents stroll over to a teammate, stop beside them facing each other for a short chat,
     then wander off again. Anyone walking yields to whoever is in their way instead of bumping into them.
     Living-agents layer (Phase 3): back view, pick up and drop (pixel dust + cracks), solo and pair activities,
     signature moves, gossip with Joe. A small "director" holds the limits so the yard never gets crowded.
     Everything is drawn inside .yard: two pixel canvases (under = cracks, over = dust and effects). */
  var Yard = (function () {
    var box = null, ws = [], raf = 0, last = 0, seen = false, io = null, GAP = 66, SX = 62, SY = 72;   /* personal space: nobody stands or walks inside this box around someone else (re-measured in fitYard) */
    var phoneMQ = window.matchMedia('(max-width: 719px)');
    /* tunable constants (listed in 02-process/team-activities-build-notes.md) */
    var K = { sway: 70, damp: 7, maxAng: 35 * Math.PI / 180, lift: .45, grav: 2400, fric: 5, maxV: 700, toss: 500, hardV: 300,
      gossip1: [20, 35], gossipN: [45, 80], gossipNPhone: [60, 100], sigGap: [4, 9], sigCool: 40, waveWindow: 10000 };
    var ACTST = { act: 1, pair: 1, sig: 1, gossip: 1 };
    var SIDEP = { whisper: 1, throw: 1, act1: 1, act2: 1, act3: 1, sheathe: 1 };            /* side-type frames face RIGHT; the code mirrors them */
    var ACTOK = { levi: ['act1', 'act2', 'act3'], kenshin: ['act1', 'act2', 'sheathe'], senku: ['act1', 'act2'], erina: ['act1', 'act2'], rohan: ['act1', 'act2'] };
    var drag = null, swallow = 0, lastPtr = -1e9, gossipT = 0, sigAt = -1e9, sigGap = 6, asideT = 0, S = 3;
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function W() { return box.clientWidth; }
    function H() { return box.clientHeight; }
    function bw(w) { return w.el.offsetWidth || 64; }
    function bh(w) { return w.el.offsetHeight || 80; }
    function phone() { return phoneMQ.matches; }
    function clampX(w, x) { return Math.max(0, Math.min(W() - bw(w), x)); }
    function clampY(w, y) { return Math.max(6, Math.min(H() - bh(w) - 2, y)); }
    function place(w) {
      w.el.style.transform = 'translate(' + w.x.toFixed(1) + 'px,' + w.y.toFixed(1) + 'px)';
      w.el.style.zIndex = (w.st === 'held' || w.st === 'fall') ? 9000 : Math.round(w.y) + 10;
    }
    function face(w, dir) { if (dir) w.fd = dir > 0 ? 1 : -1; w.el.classList.toggle('face-l', dir < 0); w.el.classList.toggle('face-r', dir > 0); }
    function setState(w, st) {
      w.st = st; w.el.classList.toggle('walking', st === 'walk'); w.el.classList.toggle('talking', st === 'chat'); w.el.classList.toggle('acting', !!ACTST[st]);
      if (st !== 'walk' && st !== 'chat' && !ACTST[st]) { face(w, 0); w.el.classList.remove('side', 'back'); }
      if (st === 'chat') w.el.classList.add('side');
    }
    function free(o) { return o.st === 'idle' && !o.host && !o.friend && !o.gos && !o.pk; }
    function taken(w, x, y, skip) {
      return ws.some(function (o) {
        if (o === w || o === skip) return false;
        if (Math.abs(o.x - x) < SX && Math.abs(o.y - y) < SY) return true;
        return o.st === 'walk' && Math.abs(o.tx - x) < SX && Math.abs(o.ty - y) < SY;
      });
    }
    function spot(w) {
      for (var i = 0; i < 24; i++) { var x = clampX(w, rnd(0, W())), y = clampY(w, rnd(0, H())); if (!taken(w, x, y)) { w.tx = x; w.ty = y; return; } }
      w.tx = w.x; w.ty = w.y;   /* nowhere free right now: stay put */
    }

    /* ---------- pixel layer: two canvases, whole-pixel squares only (no anti-aliasing) ---------- */
    var cu = null, co = null, gu = null, go = null, g = null, dirtyO = false, dirtyU = false, fxList = [], cracks = [];
    function mkCanvas(cls) { var c = document.createElement('canvas'); c.className = 'yard-fx ' + cls; c.setAttribute('aria-hidden', 'true'); return c; }
    function fxSize() {
      if (!co || !box) return;
      S = phone() ? 2 : 3;   /* one canvas pixel = S screen pixels (3 desktop, 2 phone) */
      var cw = Math.ceil(W() / S), ch = Math.ceil(H() / S);
      [cu, co].forEach(function (c) { c.width = cw; c.height = ch; c.style.width = cw * S + 'px'; c.style.height = ch * S + 'px'; });
      gu = cu.getContext('2d'); go = co.getContext('2d'); dirtyO = dirtyU = false;
    }
    function clearFx() {
      if (go && dirtyO) { go.clearRect(0, 0, co.width, co.height); dirtyO = false; }
      if (gu && dirtyU) { gu.clearRect(0, 0, cu.width, cu.height); dirtyU = false; }
    }
    function R(x, y, w, h, c, a) {
      g.globalAlpha = a == null ? 1 : a; g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w || 1, h || 1);
      if (g === go) dirtyO = true; else dirtyU = true;
    }
    function line(x0, y0, x1, y1, c, a) { var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (var i = 0; i <= n; i++) R(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, 1, 1, c, a); }
    function arcPx(cx, cy, rx, ry, a0, a1, c, a) { var n = Math.max(6, Math.round(Math.abs(a1 - a0) * Math.max(rx, ry))); for (var i = 0; i <= n; i++) { var an = a0 + (a1 - a0) * i / n; R(cx + Math.cos(an) * rx, cy + Math.sin(an) * ry, 1, 1, c, a); } }
    function plus(x, y, c, a) { R(x - 1, y, 3, 1, c, a); R(x, y - 1, 1, 3, c, a); }
    function ang(d, a) { return d > 0 ? a : Math.PI - a; }
    function crescent(cx, cy, rx, ry, a0, a1, p, col, edge) {   /* head first, the tail fades in three steps */
      var n = Math.max(6, Math.round(Math.abs(a1 - a0) * Math.max(rx, ry))), head = Math.max(0, Math.min(1, p)) * n;
      for (var i = 0; i <= n && i <= head; i++) {
        var age = (head - i) / n, al = age < .12 ? 1 : age < .3 ? .65 : .35, an = a0 + (a1 - a0) * i / n, c = Math.cos(an), s = Math.sin(an);
        R(cx + c * (rx + 1), cy + s * (ry + 1), 1, 1, edge, al);
        R(cx + c * rx, cy + s * ry, 1, 1, col, al); R(cx + c * (rx - 1), cy + s * (ry - 1), 1, 1, col, al);
      }
    }
    function ball(x, y, seam, al) {   /* small orange ball, 4 x 4 pixels */
      R(x - 1, y - 2, 2, 1, '#ff8a2a', al); R(x - 2, y - 1, 4, 2, '#ff8a2a', al); R(x - 1, y + 1, 2, 1, '#ff8a2a', al);
      if (seam === 1) R(x - 2, y, 4, 1, '#7a3a0a', al); else R(x - 1, y - 2, 1, 4, '#7a3a0a', al);
    }
    var ZZ = [[0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]];
    function zz(x, y, k, a) { ZZ.forEach(function (p) { R(x + p[0] * k, y + p[1] * k, k, k, '#dfe6f5', a); }); }
    var FONT = { p: [7, 5, 7, 4, 4], s: [3, 4, 2, 1, 6], t: [2, 7, 2, 2, 3] };
    function bubble(x, y, text) {   /* x, y = top-left in canvas units */
      var wd = text === '.' ? 8 : text.length * 4 - 1 + 4, dk = '#1b1f2a';
      R(x - 1, y - 1, wd + 2, 11, dk); R(x, y, wd, 9, '#ffffff');
      if (text === '.') { for (var d = 0; d < 3; d++) R(x + 1 + d * 2, y + 6, 1, 1, dk); return wd; }
      for (var i = 0; i < text.length; i++) { var gl = FONT[text.charAt(i)]; for (var r = 0; r < 5; r++) for (var c = 0; c < 3; c++) if (gl[r] & (4 >> c)) R(x + 2 + i * 4 + c, y + 2 + r, 1, 1, dk); }
      return wd;
    }
    function isDark() { return effTheme() === 'dark'; }
    function puff(cx, cy, big) { fxList.push({ t: 0, life: big ? .55 : .4, cx: cx, cy: cy, big: big }); }
    function drawPuff(p) {
      var k = p.t / p.life, cols = isDark() ? ['#d3d8e3', '#a3abbb', '#d8ccb0'] : ['#9c9ca6', '#70717b', '#c4b08a'];
      var al = k < .34 ? 1 : k < .67 ? .6 : .3, n = p.big ? 12 : 6, r = (p.big ? 13 : 7) * (.35 + k), sz = k < .5 ? 2 : 1, i, an;   /* chunky 2-px squares first, shrinking to 1 px as they fade */
      for (i = 0; i < n; i++) { an = i / n * Math.PI * 2 + .4; R(p.cx + Math.cos(an) * r - sz / 2, p.cy - 1 + Math.sin(an) * r * .35 - k * 3, sz, sz, cols[i % 3], al); }
      if (p.big) for (i = 0; i < 10; i++) { an = (i % 5) / 5 * Math.PI * 2 + (i < 5 ? .8 : 1.4); var rr = r * (i < 5 ? .6 : .85); R(p.cx + Math.cos(an) * rr, p.cy - 3 + Math.sin(an) * rr * .3 - k * 3, 1, 1, cols[0], al * .8); }
    }
    function addCracks(cx, cy) {
      var base = [Math.PI * .88, Math.PI * .12, Math.PI * .5], out = [];
      base.forEach(function (b) {
        var an = b + rnd(-.25, .25), n = Math.round(rnd(16, 26) / S), pts = [], x = cx, y = cy;
        for (var i = 0; i < n; i++) { x += Math.cos(an); y += Math.sin(an) * .45 + (Math.random() < .35 ? (Math.random() < .5 ? -1 : 1) : 0) * .6; pts.push([x, y]); }   /* jagged: random 1-pixel kinks */
        out.push(pts);
      });
      cracks.push({ t: 0, lines: out });
    }
    function drawCracks(c) {
      var grow = Math.min(1, c.t / .12), al = c.t < 1.02 ? 1 : Math.max(0, 1 - (c.t - 1.02) / .5), col = isDark() ? '#c8cde0' : '#14161f';
      c.lines.forEach(function (pts) { var m = Math.ceil(pts.length * grow); for (var i = 0; i < m; i++) R(pts[i][0], pts[i][1], 1, 1, col, .6 * al); });
    }
    function drawParticles(dt) {
      var i, p;
      g = go;
      for (i = fxList.length - 1; i >= 0; i--) { p = fxList[i]; p.t += dt; if (p.t >= p.life) fxList.splice(i, 1); else drawPuff(p); }
      g = gu;
      for (i = cracks.length - 1; i >= 0; i--) { p = cracks[i]; p.t += dt; if (p.t >= 1.52) cracks.splice(i, 1); else drawCracks(p); }
      g = go;
    }

    /* ---------- frames: lazy-loaded per agent on first use, silent fallback when a file is missing ---------- */
    function frameOK(w, n) { return !/^(act\d|sheathe)$/.test(n) || (ACTOK[w.key] || []).indexOf(n) >= 0; }
    function getFrame(w, name) {
      var f = w.fr[name]; if (f) return f;
      f = w.fr[name] = { st: 0, img: null };
      if (!frameOK(w, name)) { f.st = -1; return f; }   /* this agent has no such pose: never even request it */
      var im = new Image(); im.className = 'wk-p' + (SIDEP[name] ? ' sd' : ''); im.alt = ''; im.draggable = false; f.img = im;
      im.onload = function () { f.st = 1; im.style.height = (im.naturalHeight / 240 * 100) + '%'; w.pose.appendChild(im); if (w.view === name) applyView(w); };
      im.onerror = function () { f.st = -1; if (w.view === name) applyView(w); };
      im.src = 'assets/team/' + w.key + '-' + name + '.webp';
      return f;
    }
    function showPoseImg(w, name) { var f = name && w.fr[name]; $$('.wk-p', w.pose).forEach(function (im) { im.classList.toggle('on', !!f && im === f.img); }); }
    function applyView(w) {
      var v = w.view, cl = w.el.classList;
      if (!v || v === 'front') { cl.remove('posed', 'side', 'back'); showPoseImg(w, null); return; }
      if (v === 'side') { cl.remove('posed', 'back'); cl.add('side'); showPoseImg(w, null); return; }
      var f = getFrame(w, v);
      if (f.st === 1) { cl.add('posed'); cl.remove('side', 'back'); showPoseImg(w, v); }
      else if (f.st === -1) { showPoseImg(w, null); cl.remove('posed', 'back'); cl.toggle('side', !!SIDEP[v]); }   /* missing: side frames fall back to side2, the rest to front */
    }
    function setView(w, v) { if (w.view === v) return; w.view = v; applyView(w); }
    function clearView(w) {
      w.view = null; w.el.classList.remove('posed', 'side', 'back', 'mir', 'lifted'); showPoseImg(w, null);
      bodyT(w, ''); w.body.style.transformOrigin = ''; w.sh.style.transform = ''; face(w, 0);
    }
    function bodyT(w, tr) { if (w.bt !== tr) { w.bt = tr; w.body.style.transform = tr; } }
    function ensureBack(w) {   /* back1 / back2 load the first time that agent walks up the screen */
      if (w.bk) return; w.bk = 2;
      var n = 0, imgs = [$('.wk-b1', w.back), $('.wk-b2', w.back)];
      imgs.forEach(function (im, i) {
        im.onload = function () { if (++n === 2 && w.bk === 2) { w.back.style.height = (im.naturalHeight / 240 * 100) + '%'; w.bk = 1; } };
        im.onerror = function () { w.bk = -1; };
        im.src = 'assets/team/' + w.key + '-back' + (i + 1) + '.webp';
      });
    }
    function walkView(w, dx, dy) {   /* sideways: profile. up the screen: back view. down: front */
      var side = Math.abs(dx) > Math.abs(dy) * .7, up = !side && dy < 0, cl = w.el.classList;
      if (up) ensureBack(w);
      cl.toggle('side', side); cl.toggle('back', up && w.bk === 1);
    }

    /* ---------- planning ---------- */
    function plan(w, mode) {   /* mode 'chat': go and talk to a free teammate; otherwise walk to a free spot */
      w.friend = null; w.blocked = 0; w.via = null; w.detours = 0; w.pk = null;
      var pals = ws.filter(function (o) { return o !== w && free(o); });
      if (mode === 'chat' && pals.length) {
        var f = pals[Math.floor(Math.random() * pals.length)], first = (w.x < f.x ? -1 : 1), ty = clampY(w, f.y), tx = null;
        [first, -first].forEach(function (side) {
          var x = f.x + side * GAP;
          if (tx === null && x >= 0 && x <= W() - bw(w) && !taken(w, x, ty, f)) tx = x;
        });
        if (tx !== null) { w.tx = tx; w.ty = ty; w.friend = f; f.host = w; f.wait = 99; }   /* the friend stays put until we arrive */
        else spot(w);
      } else spot(w);
      w.speed = rnd(32, 44); setState(w, 'walk');
    }
    function release(w) { if (w.friend) { w.friend.host = null; if (w.friend.st === 'idle') w.friend.wait = rnd(.4, 1.5); w.friend = null; } w.pk = null; }
    function blockedBy(w, dx, dy, d) {
      var ux = dx / d, uy = dy / d;
      for (var i = 0; i < ws.length; i++) {
        var o = ws[i]; if (o === w) continue;   /* includes the friend: never walk through them to reach their far side */
        var ox = o.x - w.x, oy = o.y - w.y;
        if (Math.abs(ox) < SX && Math.abs(oy) < SY && ox * ux + oy * uy > 0) return o;
      }
      return null;
    }

    /* ---------- director: limits so the yard stays alive but never crowded ---------- */
    function maxDo() { return phone() ? 4 : 5; }
    function doing() { var n = 0; ws.forEach(function (w) { if (ACTST[w.st]) n++; else if (w.pk) n += 2; else if (w.gos) n++; }); return n; }
    function pairsNow() { var n = 0; ws.forEach(function (w) { if (w.pk || (w.a && w.a.kind === 'pair' && w.a.lead === w)) n++; }); return n; }
    function sigsNow() { var n = 0; ws.forEach(function (w) { if (w.st === 'sig') n++; }); return n; }
    function dirTo(w) { return w.x + bw(w) / 2 < W() / 2 ? 1 : -1; }
    function roomAhead(w, dir, dist) {   /* nobody inside `dist` px in front of w (and a little behind) */
      return !ws.some(function (o) {
        if (o === w || (w.a && w.a.who && w.a.who.indexOf(o) >= 0)) return false;
        var dx = (o.x - w.x) * dir; return Math.abs(o.y - w.y) < SY && dx > -SX * .5 && dx < dist;
      });
    }
    function sigOK(w) {
      var now = performance.now();
      if (sigsNow() >= (phone() ? 1 : 2) || now - sigAt < sigGap * 1000 || now - w.lastSig < K.sigCool * 1000 || doing() >= maxDo()) return false;
      return roomAhead(w, dirTo(w), .9 * w.bH);
    }
    function decide(w) {   /* an idle wait ran out: roll what to do next (weights from the plan) */
      var pool = [['walk', 30], ['chat', 15], ['solo', 32], ['pair', 15], ['sig', 8]];
      while (pool.length) {
        var sum = 0; pool.forEach(function (p) { sum += p[1]; });
        var r = Math.random() * sum, i = 0; while (i < pool.length - 1 && r >= pool[i][1]) { r -= pool[i][1]; i++; }
        var kind = pool.splice(i, 1)[0][0];
        if (kind === 'walk') { plan(w, 'walk'); return; }
        if (kind === 'chat') { plan(w, 'chat'); return; }
        if (kind === 'solo' && trySolo(w)) return;
        if (kind === 'pair' && tryPairAny(w)) return;
        if (kind === 'sig' && sigOK(w)) { startSig(w); return; }
      }
      plan(w, 'walk');
    }

    /* ---------- solo activities ---------- */
    function alt(a, b, ms) { return function (t) { return Math.floor(t / ms) % 2 ? b : a; }; }
    function one(n) { return function () { return n; }; }
    function bobTf(px, ms) { return function (w, a, t) { return Math.floor(t / ms) % 2 ? 'translateY(' + (-px) + 'px)' : ''; }; }
    var ACT = {
      type:    { d: [5, 9], p: one('desk'), tf: bobTf(2, 140) },
      phone:   { d: [4, 7], p: one('phone'), mir: true },
      read:    { d: [5, 8], p: one('read'), fx: function (w, a, t, o) { if (t % 2000 < 130 && t > 1000) { R(o.x - 2, o.y - o.u * .5, 3, 1, '#ffffff'); R(o.x - 1, o.y - o.u * .5 - 1, 1, 1, '#ffffff', .7); } } },
      notes:   { d: [4, 6], p: one('desk'), fx: function (w, a, t, o) { var k = Math.floor(t / 110) % 2; R(o.x + 6, o.y - o.u * .34 + k, 1, 1, '#f5c542'); R(o.x + 7, o.y - o.u * .34 + k + 1, 1, 1, '#f5c542'); R(o.x + 8, o.y - o.u * .34 + k + 2, 1, 1, '#2b2f3b'); } },
      coffee:  { d: [4, 6], p: one('coffee'), fx: function (w, a, t, o) { for (var i = 0; i < 3; i++) { var k = ((t + i * 300) % 900) / 900; R(o.x + (i - 1) * 2 + (Math.floor(k * 4) % 2), o.y - o.u * .58 - k * 7, 1, 1, '#eef1f8', 1 - k); } } },
      sit:     { d: [5, 9], p: one('sit') },
      stretch: { d: [2.5, 4], p: alt('stretch', 'front', 600) },
      nap:     { d: [7, 11], p: one('nap'), fx: function (w, a, t, o) { [0, 800].forEach(function (off) { var k = ((t + off) % 1600) / 1600; zz(o.x + 3 + k * 7, o.y - o.u * .58 - k * 12, k < .5 ? 1 : 2, k > .8 ? .4 : 1); }); } },
      rope:    { d: [3, 5], p: one('stretch'),
        tf: function (w, a, t) { return 'translateY(' + (-Math.sin(Math.PI * ((t % 450) / 450)) * 4).toFixed(1) + 'px)'; },
        fx: function (w, a, t, o) {
          var hop = Math.sin(Math.PI * ((t % 450) / 450)) * 4 / S, over = Math.floor(t / 225) % 2 === 0;
          if (over) arcPx(o.x, o.y - o.u * .5 - hop, o.u * .36, o.u * .55, Math.PI, Math.PI * 2, '#b07a3a'); else arcPx(o.x, o.y - 2, o.u * .36, o.u * .16, 0, Math.PI, '#b07a3a');
        } },
      dance:   { d: [3, 5], p: alt('cheer', 'dance', 350), tf: function (w, a, t) { return Math.floor(t / 350) % 2 ? 'translateX(1px)' : 'translateX(-1px)'; } },
      wave:    { d: [1.8, 2.6], p: one('wave'), needPtr: true },
      cheer:   { d: [1.5, 1.5], p: one('cheer'), quiet: true }
    };
    var SOLO = ['type', 'phone', 'read', 'notes', 'coffee', 'sit', 'stretch', 'nap', 'rope', 'dance', 'wave'];
    function org(w, dir) { return { x: (w.x + bw(w) / 2) / S, y: (w.y + w.bH) / S, u: w.bH / S, d: dir, ph: phone() }; }
    function trySolo(w) {
      if (doing() >= maxDo()) return false;
      var okp = performance.now() - lastPtr < K.waveWindow;
      var list = SOLO.filter(function (n) { return n !== w.lastAct && (n !== 'wave' || okp); });
      if (!roomAhead(w, dirTo(w), GAP)) return false;
      startSolo(w, list[Math.floor(Math.random() * list.length)]); return true;
    }
    function startSolo(w, name) {
      var d = ACT[name]; if (!d.quiet) w.lastAct = name;
      w.a = { kind: 'solo', name: name, t: 0, dur: rnd(d.d[0], d.d[1]) * 1000, who: [w], dir: dirTo(w) };
      setState(w, 'act');
    }
    function updSolo(w, dt) {
      var a = w.a, d = ACT[a.name], t = a.t, o = org(w, a.dir);
      setView(w, d.p(t, a));
      w.el.classList.toggle('mir', !!d.mir && t > a.dur / 2);
      bodyT(w, d.tf ? d.tf(w, a, t) : '');
      if (d.fx) d.fx(w, a, t, o);
      return t >= a.dur;
    }

    /* ---------- pair activities: ball toss, cards, high-five ---------- */
    function rowClear(w, f, x1, x2, y) {
      var lo = Math.min(x1, x2) - SX * .5, hi = Math.max(x1, x2) + SX * .5;
      return !ws.some(function (o) { return o !== w && o !== f && Math.abs(o.y - y) < SY && o.x > lo && o.x < hi; });
    }
    function tryPair(w, kind) {
      var D = (kind === 'ball' ? (phone() ? 1.8 : 2.5) : kind === 'cards' ? 1.2 : 2) * GAP;
      var pals = ws.filter(function (o) { return o !== w && free(o) && Math.hypot(o.x - w.x, o.y - w.y) < 3 * GAP; })
        .sort(function (a, b) { return Math.hypot(a.x - w.x, a.y - w.y) - Math.hypot(b.x - w.x, b.y - w.y); });
      for (var i = 0; i < pals.length; i++) {
        var f = pals[i], first = (w.x < f.x ? -1 : 1), ty = clampY(w, f.y);
        for (var s = 0; s < 2; s++) {
          var x = f.x + (s ? -first : first) * D;
          if (x >= 0 && x <= W() - bw(w) && !taken(w, x, ty, f) && rowClear(w, f, x, f.x, ty)) {
            w.friend = f; f.host = w; f.wait = 99; w.pk = kind; w.tx = x; w.ty = ty; w.blocked = 0; w.via = null; w.detours = 0; w.speed = rnd(32, 44); setState(w, 'walk'); return true;
          }
        }
      }
      return false;
    }
    function tryPairAny(w) {
      if (pairsNow() >= (phone() ? 1 : 2) || doing() + 2 > maxDo()) return false;
      var kinds = ['ball', 'cards', 'hifive'].sort(function () { return Math.random() - .5; });
      for (var i = 0; i < kinds.length; i++) if (tryPair(w, kinds[i])) return true;
      return false;
    }
    function startPair(w, f) {
      var kind = w.pk, pa = { kind: 'pair', sub: kind, t: 0, ph: 0, t0: 0, lead: w, who: [w, f], a: w, b: f, dur: kind === 'ball' ? rnd(5, 8) * 1000 : kind === 'cards' ? rnd(6, 10) * 1000 : 1e9 };
      w.pk = null; w.friend = null; f.host = null; f.friend = null; w.a = f.a = pa;
      setState(w, 'pair'); setState(f, 'pair'); face(w, f.x - w.x); face(f, w.x - f.x);
    }
    function hand(w) { return { x: (w.x + bw(w) / 2 + (w.fd || 1) * bw(w) * .33) / S, y: (w.y + w.bH * .3) / S }; }
    function updPair(pa, dt) {
      var a = pa.a, b = pa.b, t = pa.t, i;
      if (pa.sub === 'ball') {
        var n = Math.floor(t / 700), q = (t % 700) / 700, th = n % 2 ? b : a, rc = th === a ? b : a, h1 = hand(th), h2 = hand(rc);
        setView(th, q < .38 ? 'throw' : 'side'); setView(rc, 'side');
        ball(h1.x + (h2.x - h1.x) * q, h1.y + (h2.y - h1.y) * q - 4 * q * (1 - q) * a.bH * .55 / S, 0);
        return t >= pa.dur;
      }
      if (pa.sub === 'cards') {
        setView(a, 'sit'); setView(b, 'sit');
        var mx = ((a.x + b.x) / 2 + bw(a) / 2) / S, my = (a.y + a.bH) / S - 1, fl = Math.floor(t / 1500);
        for (i = 0; i < 3; i++) {
          var flips = 0; for (var k = 0; k <= fl; k++) if (k % 3 === i && k > 0) flips++;
          var up = flips % 2 === 0, cx = mx - 7 + i * 7;
          R(cx - 3, my - 7, 6, 8, '#1b1f2a'); R(cx - 2, my - 6, 4, 6, up ? '#f7f4ea' : '#4a78d6'); if (up) R(cx - 1, my - 4, 1, 2, '#d33a3a');
        }
        return t >= pa.dur;
      }
      /* high-five: walk toward each other, slap, cheer */
      var dx = b.x - a.x, dirA = dx > 0 ? 1 : -1;
      if (pa.ph === 0) {
        setView(a, 'side'); setView(b, 'side'); a.el.classList.add('walking'); b.el.classList.add('walking');
        if (Math.abs(dx) > GAP * .85) { a.x += dirA * 40 * dt; b.x -= dirA * 40 * dt; place(a); place(b); }
        else { pa.ph = 1; pa.t0 = t; a.el.classList.remove('walking'); b.el.classList.remove('walking'); }
      } else if (pa.ph === 1) {
        var k1 = t - pa.t0; setView(a, 'throw'); setView(b, 'throw');
        if (k1 > 150 && k1 < 380) { var mxx = ((a.x + b.x) / 2 + bw(a) / 2) / S, myy = (a.y + a.bH * .3) / S; plus(mxx, myy, '#ffffff'); R(mxx - 2, myy - 2, 1, 1, '#ffffff'); R(mxx + 2, myy - 2, 1, 1, '#ffffff'); R(mxx - 2, myy + 2, 1, 1, '#ffffff'); R(mxx + 2, myy + 2, 1, 1, '#ffffff'); }
        if (k1 >= 500) { pa.ph = 2; pa.t0 = t; }
      } else { setView(a, 'cheer'); setView(b, 'cheer'); if (t - pa.t0 >= 800) return true; }
      return false;
    }

    /* ---------- signature moves: poses where frames exist, code effects for all nine ---------- */
    function ease(p) { p = Math.max(0, Math.min(1, p)); return p * p * (3 - 2 * p); }
    function levHop(w, t, o) { var h = (o.ph ? .2 : .35) * w.bH, p = (t - 250) / 850, v = p > 0 && p < 1 ? h * 4 * p * (1 - p) : 0; return Math.min(v, w.y); }
    function kenSlide(w, t, o) { if (o.ph) return 0; var m = .4 * w.bH; return t < 450 ? 0 : t < 700 ? m * ease((t - 450) / 250) : t < 950 ? m : t < 1350 ? m * (1 - (t - 950) / 400) : 0; }
    var DOODLE = (function () { var p = [[0, 0], [3, -3], [6, 1], [9, -3], [12, 1], [15, -2]]; for (var i = 1; i <= 10; i++) { var a = i / 10 * Math.PI * 2; p.push([15 + Math.sin(a) * 3, -2 - 3 + Math.cos(a) * 3]); } return p; })();
    var SIG = {
      levi: { ms: 1500,
        pose: function (t) { return t < 250 ? 'act1' : t < 700 ? 'act2' : t < 1100 ? 'act3' : 'act1'; },
        tf: function (w, t, o) { var h = levHop(w, t, o); return h ? 'translateY(' + (-h).toFixed(1) + 'px)' : ''; },
        fx: function (w, t, o) {
          var hu = levHop(w, t, o) / S, d = o.d, u = o.u;
          if (!o.ph && t > 150 && t < 900) line(o.x + d * 2, o.y - u * .65 - hu, o.x + d * u * .85, o.y - u * 1.55, '#9aa3b2', .9);
          if (t >= 400 && t <= 650) crescent(o.x + d * 2, o.y - u * .55 - hu, u * .55, u * .55, ang(d, -1.1), ang(d, 1.0), (t - 400) / 250, '#ffffff', '#1b1f2a');
          if (!o.ph && t >= 700 && t <= 950) crescent(o.x - d * 2, o.y - u * .55 - hu, u * .55, u * .55, ang(d, 4.1), ang(d, 2.2), (t - 700) / 250, '#ffffff', '#1b1f2a');
          if (t >= 1100 && t < 1300) { var k = (t - 1100) / 200; for (var i = 0; i < 3; i++) R(o.x - 3 + i * 3, o.y - 1 - k * 2, 1, 1, '#b9b9c0', 1 - k); }
        } },
      kenshin: { ms: 1350,
        pose: function (t) { return t < 450 ? 'act1' : t < 950 ? 'act2' : 'sheathe'; },
        tf: function (w, t, o) { var s = kenSlide(w, t, o); return s ? 'translateX(' + (o.d * s).toFixed(1) + 'px)' : ''; },
        fx: function (w, t, o) {
          var d = o.d, u = o.u, su = kenSlide(w, t, o) / S;
          if (t > 100 && t < 450 && Math.floor(t / 90) % 2) plus(o.x - d * 3, o.y - u * .35, '#ffffff');
          if (t >= 450 && t <= 620) crescent(o.x + d * (u * .15 + su), o.y - u * .45, u * .7, u * .7, ang(d, -.9), ang(d, .7), (t - 450) / 170, '#ffffff', '#8a93a3');
        } },
      senku: { ms: 1500,
        pose: function (t) { return t < 350 ? 'act1' : t < 600 ? 'act2' : t < 850 ? 'act1' : 'act2'; },
        fx: function (w, t, o) {
          var d = o.d, u = o.u, fx0 = o.x + d * u * .3, fy0 = o.y - u * 1.0, i, k;
          R(fx0 - 1, fy0 - 1, 3, 3, t < 650 ? '#4ade80' : t < 950 ? '#a3d34a' : '#f5c542');
          if (t > 300 && t < 1300) for (i = 0; i < (o.ph ? 3 : 5); i++) { k = (((t - 300 - i * 150) % 700) + 700) % 700 / 700; R(fx0 - 2 + (i * 7) % 5, fy0 - 2 - k * u * .45, 1, 1, '#bdf7d3', 1 - k * .7); }
          if (!o.ph && t >= 900 && t < 1250) { k = (t - 900) / 350; for (i = 0; i < 5; i++) R(fx0 + Math.cos(i * 1.26) * (1 + k * 3), fy0 - 4 - k * 3 + Math.sin(i * 1.26) * (1 + k * 2), 2, 2, '#d6dae2', 1 - k); }
        } },
      erina: { ms: 1400,
        pose: function (t) { return t < 400 ? 'act1' : t < 1100 ? 'act2' : 'act1'; },
        fx: function (w, t, o) {
          var d = o.d, u = o.u, n = o.ph ? 2 : 4, i;
          if (t > 120 && t < 300) plus(o.x + d * u * .32, o.y - u * .4, '#ffffff');
          if (t >= 400 && t < 1300) for (i = 0; i < n; i++) { var an = i * Math.PI * 2 / n + t * .004, x = o.x + Math.cos(an) * u * .42, y = o.y - u * .78 + Math.sin(an) * u * .2; if ((Math.floor(t / 110) + i) % 2) plus(x, y, '#ffd54a'); else R(x, y, 1, 1, '#ffd54a'); }
        } },
      rohan: { ms: 1700,
        pose: function (t) { return t < 800 ? (Math.floor(t / 150) % 2 ? 'act2' : 'act1') : t < 1200 ? 'act2' : 'act1'; },
        fx: function (w, t, o) {
          var d = o.d, u = o.u, k = u / 28, x0 = o.x + d * u * .3, y0 = o.y - u * .95, N = DOODLE.length, p = Math.max(0, Math.min(1, (t - 100) / 900)), m = Math.floor(p * (N - 1)), i, e;
          function pt(j) { return [x0 + d * DOODLE[j][0] * k, y0 + DOODLE[j][1] * k]; }
          for (i = 0; i < m; i++) { var a = pt(i), b = pt(i + 1); line(a[0], a[1] + 1, b[0], b[1] + 1, '#1b1f2a', .7); }
          for (i = 0; i < m; i++) { var a2 = pt(i), b2 = pt(i + 1); line(a2[0], a2[1], b2[0], b2[1], '#ffffff'); }
          if (t >= 1000 && t < 1700) { var ag = (t - 1000) / 700; e = pt(N - 1);
            for (i = 0; i < (o.ph ? 2 : 4); i++) { var px = e[0] + d * (3 + i * 4) * ag, py = e[1] - 2 + ag * ag * u * .8 + i; R(px - 1, py - 1, 6, 7, '#1b1f2a', 1 - ag * .5); R(px, py, 4, 5, '#f4f1e8', 1 - ag * .5); } }
        } },
      nami: { ms: 1700, pose: one('side'),
        fx: function (w, t, o) {
          var d = o.d, u = o.u, hx = o.x + d * u * .15, hy = o.y - u * .5, up = [o.x + d * u * .25, o.y - u * 1.2], fw = [o.x + d * u * .65, o.y - u * .9], tip, i, q;
          if (t < 300) { q = ease(t / 300); tip = [hx + (up[0] - hx) * q, hy + (up[1] - hy) * q]; }
          else if (t < 500) { q = ease((t - 300) / 200); tip = [up[0] + (fw[0] - up[0]) * q, up[1] + (fw[1] - up[1]) * q]; }
          else if (t < 1400) tip = fw; else { q = ease((t - 1400) / 300); tip = [fw[0] + (hx - fw[0]) * q, fw[1] + (hy - fw[1]) * q]; }
          line(hx, hy + 1, tip[0], tip[1] + 1, '#1b1f2a', .6);
          for (i = 0; i < 3; i++) line(hx + (tip[0] - hx) * i / 3, hy + (tip[1] - hy) * i / 3, hx + (tip[0] - hx) * (i + 1) / 3, hy + (tip[1] - hy) * (i + 1) / 3, i % 2 ? '#7a4a16' : '#d8932a');
          if (t >= 450 && t < 1500) {
            var cx = Math.round(tip[0] + d * u * .05), cy = Math.max(6, Math.round(tip[1] - u * .38)), v = Math.floor(t / 150) % 2, rows = v ? [[-3, -2, 7], [-6, 0, 12], [-6, 2, 12]] : [[-4, -2, 9], [-6, 0, 13], [-5, 2, 11]];
            rows.forEach(function (r, ri) { R(cx + r[0] - 1, cy + r[1] - 1, r[2] + 2, 3, '#1b1f2a', .55); }); rows.forEach(function (r, ri) { R(cx + r[0], cy + r[1], r[2], 2, ri === 0 ? '#aab2c0' : '#8f98a8'); });
            for (i = 0; i < (o.ph ? 4 : 8); i++) R(cx - 5 + (i * 13) % 11, cy + 5 + (t * .03 + i * 4) % 14, 1, 2, '#6ab4ff');
            if (t >= 800 && t < 1000) { var bp = [[2, 4], [0, 7], [3, 9], [0, 12], [2, 15]], j; for (j = 0; j < bp.length - 1; j++) line(cx + d * bp[j][0] + 1, cy + bp[j][1], cx + d * bp[j + 1][0] + 1, cy + bp[j + 1][1], '#1b1f2a'); for (j = 0; j < bp.length - 1; j++) line(cx + d * bp[j][0], cy + bp[j][1], cx + d * bp[j + 1][0], cy + bp[j + 1][1], '#ffe14a'); }
          }
        } },
      kuroko: { ms: 1700, pose: one('side'), walk: function (t) { return t < 600; },
        fx: function (w, t, o) {
          var d = o.d, u = o.u, hx = o.x + d * u * .32, hy = o.y - u * .4, gy = o.y - 2, bx, by, seam = Math.floor(t / 100) % 2, i, q;
          var bn = o.ph ? 300 : 600;
          if (t < bn) { bx = hx; by = gy - (gy - hy) * Math.abs(Math.cos(Math.PI * t / 300)); ball(bx, by, seam, 1); }
          else if (t < 1000) { ball(o.x + d * u * .3, o.y - u * .95, seam, 1); }
          else if (t < 1250) { q = (t - 1000) / 250; var sx = o.x + d * u * .3, sy = o.y - u * .95;
            for (i = 3; i >= 1; i--) { var qq = Math.max(0, q - i * .12); ball(sx + d * u * .9 * qq, sy - qq * 2, seam, .5 / i); }
            ball(sx + d * u * .9 * q, sy - q * 2, seam, 1 - q * q * q); }
          else if (t >= 1500) { if (t < 1600) plus(hx, hy, '#ffffff'); ball(hx, hy, 0, 1); }
        } },
      raphael: { ms: 1500, pose: one('front'),
        tf: function (w, t) { return Math.floor(t / 150) % 2 ? 'translateY(-2px)' : ''; },
        fx: function (w, t, o) {
          var u = o.u, lv = t < 500 ? .5 : t < 1000 ? .75 : 1, i, an;
          if (t < 1400) { var cy = o.y - u * .12 - u * .8 * Math.min(1, t / 1000);
            [0, 3, 6].forEach(function (off, ri) { for (var j = 0; j < 18; j += 2) { var a2 = j / 18 * Math.PI * 2 + t * .003; R(o.x + Math.cos(a2) * u * .34, cy + off + Math.sin(a2) * u * .09, 1, 1, '#4fd8ff', lv * (ri ? ri === 1 ? .4 : .2 : 1)); } }); }
          if (t > 300 && t < 1400) for (i = 0; i < (o.ph ? 3 : 6); i++) { an = t * .005 + i * (Math.PI * 2 / (o.ph ? 3 : 6)); R(o.x + Math.cos(an) * u * .42, o.y - u * .55 + Math.sin(an) * u * .1, 1, 1, '#bff3ff'); }
          if (t > 1000 && t < 1250) plus(o.x + 2, o.y - u * .78, '#ffffff');
        } },
      jarvis: { ms: 1600, pose: one('side'),
        fx: function (w, t, o) {
          var d = o.d, u = o.u, fd = t > 1400 ? (1600 - t) / 200 : 1, pw = Math.round(u * .6), x0 = o.x + d * u * .38, y1 = Math.round(o.y - u), y2 = Math.round(o.y - u * .42), ph = y2 - y1, i;
          var wc = Math.round(pw * ease((t - 100) / 300)); if (wc < 2) return;
          var xm = d > 0 ? x0 : x0 - wc;
          R(xm, y1, wc, ph, '#46d2ff', .16 * fd); R(xm, y1, wc, 1, '#46d2ff', .8 * fd); R(xm, y2, wc, 1, '#46d2ff', .8 * fd); R(xm, y1, 1, ph, '#46d2ff', .8 * fd); R(xm + wc - 1, y1, 1, ph, '#46d2ff', .8 * fd);
          for (i = 0; i < 3; i++) { var bh2 = Math.round((ph - 5) * ease((t - 500 - i * 120) / 500) * (.5 + i * .25)); if (bh2 > 0) R(xm + 2 + i * 5, y2 - 2 - bh2, 3, bh2, '#8be9ff', .9 * fd); }
          if (t > 300 && t < 800) line(o.x + d * 2, o.y - u * .86, xm, o.y - u * .86, '#46d2ff', .6 * fd);
          if (t > 700 && t < 1400) R(xm, y1 + (t - 700) / 700 * ph, wc, 1, '#ffffff', .5 * fd);
          if (!o.ph) for (i = 0; i < 4; i++) { var r0 = t * .006 + i * Math.PI / 2; arcPx(xm + wc / 2, y1 - 6, 4, 4, r0, r0 + 1, '#46d2ff', .8 * fd); }
        } }
    };
    function startSig(w) {
      var dir = dirTo(w); w.a = { kind: 'sig', t: 0, who: [w], dir: dir };
      setState(w, 'sig'); face(w, dir); sigAt = performance.now(); sigGap = rnd(K.sigGap[0], K.sigGap[1]); w.lastSig = sigAt;
      JoeCam.react(w.id);
    }
    function updSig(w) {
      var a = w.a, d = SIG[w.id] || SIG.raphael, t = a.t, o = org(w, a.dir);
      setView(w, d.pose(t));
      w.el.classList.toggle('walking', !!(d.walk && d.walk(t)));
      bodyT(w, d.tf ? d.tf(w, t, o) : '');
      d.fx(w, t, o);
      if (t >= d.ms) { cheerAround(w); return true; }
      return false;
    }
    function cheerAround(w) {   /* one or two free neighbours cheer when a signature move ends */
      var n = 0;
      ws.forEach(function (o) { if (n < 2 && o !== w && free(o) && Math.hypot(o.x - w.x, o.y - w.y) < 3 * GAP && doing() < maxDo()) { startSolo(o, 'cheer'); n++; } });
    }

    /* ---------- gossip with Joe ---------- */
    function startGossip() {
      if (drag || JoeCam.busy() || ws.some(function (o) { return o.st === 'held' || o.st === 'fall' || o.st === 'land' || o.gos; })) return false;
      var cands = ws.filter(free); if (!cands.length || doing() >= maxDo()) return false;
      var w = cands[Math.floor(Math.random() * cands.length)], pr = JoeCam.rect(); if (!pr) return false;
      var br = box.getBoundingClientRect(), pcx = pr.left + pr.width / 2 - br.left, wc = w.x + bw(w) / 2, side = wc < pcx ? 'left' : 'right', i, tx = 0, ok = false;
      for (i = 0; i < 2 && !ok; i++) {
        var sd = i ? (side === 'left' ? 'right' : 'left') : side;
        tx = clampX(w, pcx + (sd === 'left' ? -1 : 1) * (pr.width / 2 + bw(w) * .15) - bw(w) / 2);
        if (!taken(w, tx, 4)) { ok = true; side = sd; }
      }
      if (!ok) return false;
      w.friend = null; w.blocked = 0; w.via = null; w.detours = 0; w.pk = null; w.tx = tx; w.ty = 4; w.speed = 46; w.gos = { side: side, t: 0 }; setState(w, 'walk');
      return true;
    }
    function beginWhisper(w) {
      var side = w.gos.side; w.gos = null; w.a = { kind: 'gossip', t: 0, ph: 0, who: [w], side: side };
      setState(w, 'gossip'); face(w, side === 'left' ? 1 : -1); JoeCam.scene(side === 'left' ? 'listen-sl' : 'listen-sr', 2300);
    }
    function updGossip(w) {
      var a = w.a, t = a.t;
      if (t < 3800) {
        setView(w, 'whisper');
        var hx = (w.x + bw(w) / 2) / S, hy = Math.max(1, (w.y + w.bH * .08) / S), cw = co.width, txt = t < 1100 ? 'psst' : '.', wd = txt === '.' ? 8 : 19;
        var bx = a.side === 'left' ? hx - 12 - wd : hx + 12; if (bx < 2 || bx + wd > cw - 2) bx = a.side === 'left' ? hx + 12 : hx - 12 - wd;
        bubble(Math.max(2, Math.min(cw - wd - 2, bx)), hy, txt);
        if (a.ph === 0 && t >= 2200) { a.ph = 1; JoeCam.scene('surprised', 1700); }
      } else {
        setView(w, 'laugh'); bodyT(w, Math.floor(t / 120) % 2 ? 'translateY(-2px)' : '');
        if (a.ph === 1) { a.ph = 2; JoeCam.scene('laugh', 2100); }
      }
      return t >= 5800;
    }

    /* ---------- finishing, interrupting ---------- */
    function stopAct(w) {
      var a = w.a; if (!a) return;
      (a.who || [w]).forEach(function (p) { p.a = null; clearView(p); setState(p, 'idle'); p.wait = rnd(1, 3); place(p); });
    }
    function interrupt(w) {   /* picked up: end whatever it was doing, and whoever it was doing it with */
      if (w.a) { if (w.a.kind === 'gossip') JoeCam.release(); stopAct(w); }
      if (w.st === 'chat') { var f = w.friend; release(w); if (f && f.st === 'chat') { f.friend = null; setState(f, 'idle'); f.wait = rnd(1.2, 2.6); } }
      else release(w);
      if (w.host) { var h = w.host; w.host = null; if (h.friend === w) { h.friend = null; h.pk = null; if (h.st === 'walk') spot(h); } }
      w.gos = null;
    }
    function dropNow(w) {
      w.z = 0; w.vx = w.vy = w.vz = 0; w.bounced = false; clearView(w); setState(w, 'idle'); w.x = clampX(w, w.x); w.y = clampY(w, w.y); w.wait = rnd(.8, 2); place(w);
    }

    /* ---------- pick up, carry, drop ---------- */
    function local(e) { var rc = box.getBoundingClientRect(); return { x: e.clientX - rc.left, y: e.clientY - rc.top }; }
    function wOf(el) { for (var i = 0; i < ws.length; i++) if (ws[i].el === el) return ws[i]; return null; }
    function onDown(e) {
      if ((e.button != null && e.button > 0) || drag || box.closest('.org-on')) return;
      var el = e.target.closest('.walker'); if (!el) return;
      var w = wOf(el); if (!w || w.st === 'fall' || w.st === 'land') return;
      var p = local(e); drag = { w: w, id: e.pointerId, sx: p.x, sy: p.y, px: p.x, py: p.y, on: false, hist: [] };
      try { el.setPointerCapture(e.pointerId); } catch (er) {}
    }
    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var p = local(e), now = performance.now();
      if (!drag.on) { if (Math.hypot(p.x - drag.sx, p.y - drag.sy) < 6) return; startCarry(drag.w); drag.on = true; }
      drag.px = p.x; drag.py = p.y; drag.hist.push({ x: p.x, y: p.y, t: now });
      while (drag.hist.length > 2 && now - drag.hist[0].t > 100) drag.hist.shift();
      if (reduced() || !raf) placeHeld(drag.w);   /* no loop running (reduced motion): follow the pointer directly, no sway */
    }
    function onUp(e) {
      if (!drag || (e && e.type !== 'lostpointercapture' && e.pointerId !== drag.id)) return;
      var d = drag; drag = null;
      if (!d.on) return;   /* a tap: the click opens the modal, as before */
      swallow = performance.now() + 400; endCarry(d);
    }
    function onClickCap(e) {
      var el = e.target.closest && e.target.closest('.walker'), w = el && wOf(el);
      if (performance.now() < swallow || (w && (w.st === 'fall' || w.st === 'land' || w.st === 'held'))) { e.stopPropagation(); e.preventDefault(); }
    }
    function startCarry(w) {
      interrupt(w); setState(w, 'held'); w.el.classList.add('lifted');
      w.z = K.lift * w.bH; w.th = 0; w.om = 0; w.phx = null; w.pvx = 0; w.acc = []; w.bounced = false;
      setView(w, 'held'); w.body.style.transformOrigin = '50% 6%'; w.sh.style.transform = 'scale(.6)'; w.bt = '';
      placeHeld(w);
    }
    function placeHeld(w) {
      var nx = drag.px - bw(w) / 2, ny = drag.py - .06 * w.bH + w.z;   /* the hand (50 % across, 6 % down the sprite) sits under the pointer */
      w.x = clampX(w, nx); w.y = Math.max(w.z, clampY(w, ny)); place(w);
      if (reduced()) bodyT(w, 'translateY(' + (-w.z).toFixed(1) + 'px)');
    }
    function heldStep(w, dt) {
      if (!drag || drag.w !== w) return;
      placeHeld(w);
      var hx = w.x + bw(w) / 2, v = w.phx == null ? 0 : (hx - w.phx) / dt, a = (v - w.pvx) / dt;
      w.phx = hx; w.pvx = v; w.acc.push(a); if (w.acc.length > 3) w.acc.shift();
      var ax = w.acc.reduce(function (s, x) { return s + x; }, 0) / w.acc.length;
      w.om += (-K.sway * w.th - K.damp * w.om + ax / w.bH) * dt; w.th += w.om * dt;   /* pendulum about the hand; pointer accelerating right swings the body left */
      if (w.th > K.maxAng) { w.th = K.maxAng; w.om = 0; } else if (w.th < -K.maxAng) { w.th = -K.maxAng; w.om = 0; }
      bodyT(w, 'translateY(' + (-w.z).toFixed(1) + 'px) rotate(' + w.th.toFixed(3) + 'rad)');
      w.el.style.setProperty('--dg', Math.max(.25, 1.1 - Math.abs(v) / 1500).toFixed(2) + 's');
      asideT -= dt; if (asideT <= 0) { asideT = .3; stepAside(w); }
    }
    function stepAside(h) {   /* others step out of the way of the one being carried */
      ws.forEach(function (o) {
        if (o !== h && free(o) && Math.abs(o.x - h.x) < SX * .8 && Math.abs(o.y - h.y) < SY * .8) { spot(o); if (o.tx !== o.x || o.ty !== o.y) { o.speed = rnd(40, 52); setState(o, 'walk'); } }
      });
    }
    function endCarry(d) {
      var w = d.w, h = d.hist, vx = 0, vy = 0, now = performance.now();
      if (h.length > 1 && now - h[h.length - 1].t < 120) { var f = h[0], l = h[h.length - 1], dt = Math.max(16, l.t - f.t) / 1000; vx = (l.x - f.x) / dt; vy = (l.y - f.y) / dt; }
      var sp = Math.hypot(vx, vy); if (sp > K.maxV) { vx *= K.maxV / sp; vy *= K.maxV / sp; }
      if (reduced() || !raf) { dropNow(w); return; }   /* reduced motion: put down at once, no dust, no cracks */
      w.vx = vx; w.vy = vy; w.vz = vy < 0 ? Math.min(K.toss, -vy * .8) : 0; w.zf = w.z; w.fallT = 0;
      setState(w, 'fall');
    }
    function fallStep(w, dt) {
      var fr = Math.exp(-K.fric * dt);
      if (w.st === 'land') { landStep(w, dt); return; }
      w.vx *= fr; w.vy *= fr; w.x = clampX(w, w.x + w.vx * dt); w.y = clampY(w, w.y + w.vy * dt);
      w.vz -= K.grav * dt; w.z += w.vz * dt; w.om += (-K.sway * w.th - K.damp * w.om) * dt; w.th += w.om * dt;
      if (w.th > K.maxAng) { w.th = K.maxAng; w.om = 0; } else if (w.th < -K.maxAng) { w.th = -K.maxAng; w.om = 0; }
      if (w.z > 0) {
        bodyT(w, 'translateY(' + (-w.z).toFixed(1) + 'px) rotate(' + w.th.toFixed(3) + 'rad)');
        w.sh.style.transform = 'scale(' + (.6 + .4 * Math.max(0, 1 - w.z / Math.max(1, w.zf))).toFixed(2) + ')'; place(w); return;
      }
      land(w, -w.vz);
    }
    function land(w, v) {
      w.z = 0; w.th = 0; w.om = 0; w.body.style.transformOrigin = '50% 100%'; w.sh.style.transform = '';
      var cx = (w.x + bw(w) / 2) / S, cy = (w.y + w.bH) / S;
      setView(w, 'front'); setState(w, 'land');
      if (w.bounced) {   /* second touch-down after a hard landing: dust, cracks, shake it off */
        puff(cx, cy, true); addCracks(cx, cy); JoeCam.facepalm(); w.lp = { ph: 'shake', t: 0 }; bodyT(w, ''); place(w); return;
      }
      if (v > K.hardV) { w.lp = { ph: 'sq', t: 0, dur: .09, next: 'bounce', vz: .25 * v }; bodyT(w, 'scale(1.1,.8)'); }
      else { puff(cx, cy, false); w.lp = { ph: 'sq', t: 0, dur: .06, next: 'idle' }; bodyT(w, 'scale(1.06,.9)'); }
      place(w);
    }
    function landStep(w, dt) {
      var L = w.lp; L.t += dt;
      if (L.ph === 'sq') {
        if (L.t < L.dur) return;
        if (L.next === 'bounce') { w.bounced = true; w.vz = L.vz; w.z = .01; w.th = 0; w.om = 0; w.zf = (L.vz * L.vz) / (2 * K.grav); bodyT(w, ''); setState(w, 'fall'); w.el.classList.add('lifted'); }
        else finishLand(w);
      } else {
        bodyT(w, Math.floor(L.t / .06) % 2 ? 'translateX(2px)' : 'translateX(-2px)');
        if (L.t >= .4) finishLand(w);
      }
    }
    function finishLand(w) { w.bounced = false; clearView(w); setState(w, 'idle'); w.wait = rnd(.8, 2); place(w); }

    /* ---------- frame loop ---------- */
    function running() { return box && seen && !document.hidden && !reduced() && !root.hasAttribute('data-paused') && box.offsetParent && !box.closest('.org-on'); }
    function step(w, dt) {
      var f;
      if (w.st === 'held') { heldStep(w, dt); return; }
      if (w.st === 'fall' || w.st === 'land') { fallStep(w, dt); return; }
      if (ACTST[w.st]) {
        var a = w.a; if (!a) { setState(w, 'idle'); return; }
        if (a.lead && a.lead !== w) return;   /* the partner is driven by the lead */
        a.t += dt * 1000;
        var done = a.kind === 'solo' ? updSolo(w, dt) : a.kind === 'pair' ? updPair(a, dt) : a.kind === 'sig' ? updSig(w) : updGossip(w);
        if (done) {
          var wasG = a.kind === 'gossip'; stopAct(w);
          if (wasG) { JoeCam.release('smile'); w.wait = .2; plan(w, 'walk'); }
        }
        return;
      }
      if (w.st === 'chat') {
        w.wait -= dt;
        if (w.wait <= 0) { f = w.friend; release(w); setState(w, 'idle'); w.wait = rnd(.2, .8); if (f && f.st === 'chat') { f.friend = null; setState(f, 'idle'); f.wait = rnd(1.2, 2.6); } }
        return;
      }
      if (w.st === 'idle') { if (!w.host) { w.wait -= dt; if (w.wait <= 0) decide(w); } return; }
      /* walking */
      if (w.gos) { w.gos.t += dt; if (w.gos.t > 30) { w.gos = null; spot(w); } }
      if (w.friend && w.friend.st === 'walk') { release(w); spot(w); }
      if (w.via) {   /* stepping around someone: walk to the side point first */
        var vx = w.via.x - w.x, vy = w.via.y - w.y, vd = Math.hypot(vx, vy);
        if (vd < 1.5) w.via = null;
        else {
          if (blockedBy(w, vx, vy, vd)) { w.via = null; w.blocked = 1.3; }
          else { var vs = Math.min(vd, w.speed * dt); w.x += vx / vd * vs; w.y += vy / vd * vs; if (Math.abs(vx) > 1) face(w, vx); walkView(w, vx, vy); w.el.classList.add('walking'); place(w); return; }
        }
      }
      var dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy);
      if (d < 1.5) {
        if (w.gos) { beginWhisper(w); return; }
        f = w.friend;
        if (f) {
          if (w.pk) startPair(w, f);
          else { setState(w, 'chat'); setState(f, 'chat'); f.friend = w; f.host = null; w.wait = f.wait = rnd(2.6, 5); face(w, f.x - w.x); face(f, w.x - f.x); }
        } else { setState(w, 'idle'); w.wait = rnd(.8, 2.6); }
        return;
      }
      var ob = blockedBy(w, dx, dy, d);
      if (ob) {   /* someone is in the way: pause, then step around them; if that fails twice, choose somewhere else */
        w.blocked += dt; w.el.classList.remove('walking');
        if (w.blocked > 0.6 && w.detours < 2) {
          var up = w.y > ob.y ? 1 : -1, vy2 = clampY(w, ob.y + up * (SY + 8));
          if (Math.abs(vy2 - ob.y) < SY) vy2 = clampY(w, ob.y - up * (SY + 8));
          var vx2 = clampX(w, w.x + (dx < 0 ? -1 : 1) * 30);
          if (Math.abs(vy2 - ob.y) >= SY && !taken(w, vx2, vy2, w.friend)) { w.via = { x: vx2, y: vy2 }; w.detours++; w.blocked = 0; }
        }
        if (w.blocked > 1.4) { release(w); spot(w); w.blocked = 0; w.detours = 0; w.via = null; }
        return;
      }
      w.blocked = 0; w.el.classList.add('walking');
      var st = Math.min(d, w.speed * dt); w.x += dx / d * st; w.y += dy / d * st;
      if (Math.abs(dx) > 1) face(w, dx);
      walkView(w, dx, dy);
      place(w);
    }
    function director(dt) {
      gossipT -= dt;
      if (gossipT <= 0) { var g2 = phone() ? K.gossipNPhone : K.gossipN; gossipT = startGossip() ? rnd(g2[0], g2[1]) : 6; }
    }
    function frame(now) {
      raf = 0; if (!running()) return;
      var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      clearFx(); g = go;
      director(dt);
      ws.forEach(function (w) { step(w, dt); });
      drawParticles(dt);
      raf = requestAnimationFrame(frame);
    }
    function wake() {
      if (!raf && running()) { last = 0; ws.forEach(function (w) { w.el.classList.toggle('talking', w.st === 'chat'); }); raf = requestAnimationFrame(frame); JoeCam.start(); }
    }
    function stop() {   /* tab change, Run, hidden tab, resize, reduced motion: end every activity, clear effects, remove activity classes */
      if (raf) cancelAnimationFrame(raf); raf = 0; drag = null;
      ws.forEach(function (w) {
        if (w.st === 'held' || w.st === 'fall' || w.st === 'land') dropNow(w);
        else if (w.a) stopAct(w);
        w.gos = null; w.el.classList.remove('walking', 'talking', 'acting', 'lifted', 'mir');
      });
      fxList.length = 0; cracks.length = 0; clearFx(); JoeCam.stop();
    }
    function sync() { if (running()) wake(); else stop(); }
    function fitYard() {
      if (!box) return;
      if (root.classList.contains('fit-tab')) { var h = Math.max(170, fitSpace(box, 6)); box.style.height = h + 'px'; box.classList.toggle('compact', h < 330); }
      else { box.style.height = ''; box.classList.remove('compact'); }
      var w0 = ws[0]; if (w0 && w0.el.offsetWidth) { SX = w0.el.offsetWidth + 2; SY = Math.round(w0.el.offsetHeight * .85); GAP = SX + 4; }
      ws.forEach(function (w) { w.bH = w.body.offsetHeight || 84; });
      fxSize();
    }
    function scatter() {
      stop(); drag = null;
      var n = ws.length, cols = Math.max(2, Math.round(Math.sqrt(n * W() / Math.max(1, H())))), rows = Math.ceil(n / cols);
      ws.forEach(function (w, i) {
        var c = i % cols, r = Math.floor(i / cols);
        w.x = clampX(w, (c + .5) * W() / cols - bw(w) / 2 + rnd(-10, 10));
        w.y = clampY(w, (r + .5) * H() / rows - bh(w) / 2 + rnd(-8, 8));
        w.friend = w.host = w.gos = w.a = null; w.pk = null; clearView(w); setState(w, 'idle'); w.wait = rnd(.3, 3); place(w);
      });
      gossipT = rnd(K.gossip1[0], K.gossip1[1]);
    }
    function focus() {   /* what Joe's photo should watch: held/falling > gossip > signature > pair > solo > a random walker */
      var best = null, pr = -1, rank = { held: 6, fall: 6, land: 6, gossip: 5, sig: 4, pair: 3, act: 2 };
      ws.forEach(function (w) { var p = rank[w.st] || 0; if (p > pr) { pr = p; best = w; } });
      if (pr <= 0) best = ws[Math.floor(Math.random() * ws.length)];
      return best ? { el: best.el, drag: pr === 6 } : null;
    }
    function init(el) {
      stop(); box = el; if (!box) return;
      ws = $$('.walker', box).map(function (b) {
        return { el: b, body: $('.wk-body', b), pose: $('.wk-pose', b), back: $('.wk-back', b), sh: $('.wk-shadow', b), key: b.dataset.key, id: b.dataset.agent,
          x: 0, y: 0, tx: 0, ty: 0, wait: 0, speed: 36, st: 'idle', friend: null, host: null, blocked: 0, fr: {}, bk: 0, view: null, bt: '', a: null, gos: null, pk: null, z: 0, bH: 84, lastAct: '', lastSig: -1e9, fd: 1 };
      });
      cu = mkCanvas('yard-fx-under'); co = mkCanvas('yard-fx-over'); box.insertBefore(cu, box.firstChild); box.appendChild(co);
      box.addEventListener('pointerdown', onDown); box.addEventListener('pointermove', onMove);
      box.addEventListener('pointerup', onUp); box.addEventListener('pointercancel', onUp); box.addEventListener('lostpointercapture', onUp);
      box.addEventListener('click', onClickCap, true);
      if (io) io.disconnect();
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(function (es) { seen = es[0].isIntersecting; if (seen) { if (!box.dataset.placed) { box.dataset.placed = '1'; fitYard(); scatter(); } wake(); } else stop(); });
        io.observe(box);
      } else { seen = true; fitYard(); scatter(); wake(); }
    }
    document.addEventListener('visibilitychange', sync);
    document.addEventListener('pointermove', function () { lastPtr = performance.now(); }, { passive: true });
    document.addEventListener('pointerdown', function () { lastPtr = performance.now(); }, { passive: true });
    function refit() { if (box && box.offsetParent) { fitYard(); scatter(); wake(); } }
    window.addEventListener('resize', refit);
    new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-paused'] });
    try { reduceMQ.addEventListener('change', sync); } catch (e) { if (reduceMQ.addListener) reduceMQ.addListener(sync); }
    return { init: init, wake: wake, stop: stop, refit: refit, focus: focus };
  })();

  /* Joe watches his team (Team tab photo only): two stacked layers crossfade. Watching is the default; he smiles now and then,
     reacts to signature moves, listens to gossip, and follows an agent being carried. Hero photo, badge and favicon stay c.webp. */
  var JoeCam = (function () {
    var BASE = 'assets/face/', TEAM = 'assets/face/team/', A = null, B = null, active = null, wrap = null, baseSrc = '', cur = '', on = false, timer = 0, sTok = 0;
    var TEAMF = ['listen-sl', 'listen-sr', 'surprised', 'laugh', 'shocked', 'worried', 'proud', 'amused', 'impressed', 'nervous', 'facepalm'];
    var FALL = { nervous: 'worried', facepalm: 'shocked', impressed: 'amused', proud: 'smile', amused: 'smile', worried: 'c', shocked: 'c', surprised: 'c', laugh: 'smile', 'listen-sl': 'l', 'listen-sr': 'r' };
    var REACT = { levi: 'impressed', kenshin: 'shocked', senku: 'worried', erina: 'amused', rohan: 'impressed', nami: 'nervous', kuroko: 'impressed', raphael: 'proud', jarvis: 'amused' };
    var DIR_ANGLE = { l: 0, dl: 45, dr: 90, d: 135, r: 180, ul: -135, u: -90, ur: -45 };   /* same table as the cursor-follow Face: the files' left/right are mirrored */
    var loaded = {}, bad = {}, pending = {}, holdUntil = 0, nextLook = 0, nextSmile = 0, lastReact = -1e9, lastSwap = 0, reactT = 0;
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function url(n) { return (TEAMF.indexOf(n) >= 0 ? TEAM : BASE) + n + '.webp'; }
    function load(n) {
      if (loaded[n]) return Promise.resolve(true); if (bad[n]) return Promise.resolve(false); if (pending[n]) return pending[n];
      pending[n] = new Promise(function (res) { var im = new Image(); im.onload = function () { loaded[n] = true; res(true); }; im.onerror = function () { bad[n] = true; res(false); }; im.src = url(n); });
      return pending[n];
    }
    function swap(src, ms) {
      var next = active === A ? B : A, old = active; wrap.style.setProperty('--tjf', ms + 'ms'); next.src = src;
      var go = function () { next.classList.add('on', 'top'); old.classList.remove('top'); active = next; setTimeout(function () { if (old !== active) old.classList.remove('on'); }, ms + 40); };
      return (next.decode ? next.decode().catch(noop) : Promise.resolve()).then(go);
    }
    function show(n, ms) {
      if (!A || n === cur) return; var tok = ++sTok;
      load(n).then(function (ok) {
        if (tok !== sTok || !on) return;
        if (!ok) { if (FALL[n] && FALL[n] !== n) { cur = ''; show(FALL[n], ms); } return; }
        cur = n; lastSwap = performance.now(); swap(url(n), ms == null ? 200 : ms);
      });
    }
    function frameFor(f) {
      var pr = A.getBoundingClientRect(), er = f.el.getBoundingClientRect(), dx = er.left + er.width / 2 - (pr.left + pr.width / 2), dy = er.top + er.height / 2 - (pr.top + pr.height / 2);
      var dist = Math.hypot(dx, dy), an = Math.atan2(dy, dx) * 180 / Math.PI, best = 'c', bd = 999;
      if (dist < 60) return 'c';
      Object.keys(DIR_ANGLE).forEach(function (k) { var d = Math.abs(an - DIR_ANGLE[k]) % 360; d = d > 180 ? 360 - d : d; if (d < bd) { bd = d; best = k; } });
      return best;
    }
    function tick() {
      timer = 0; if (!on) return;
      var now = performance.now();
      if (now >= holdUntil) {
        var f = Yard.focus();
        if (f && f.drag) { if (now - lastSwap >= 250) show(frameFor(f), 120); }
        else if (now >= nextSmile) { show('smile'); holdUntil = now + rnd(1500, 2500); nextSmile = holdUntil + rnd(12000, 25000); nextLook = holdUntil; }
        else if (now >= nextLook && f) { show(frameFor(f)); nextLook = now + rnd(1200, 3000); }
      }
      timer = setTimeout(tick, 120);
    }
    function init(img) {
      if (!img || !img.parentNode) return; A = img; active = A;
      wrap = document.createElement('span'); wrap.className = 'tj-photo'; A.parentNode.insertBefore(wrap, A); wrap.appendChild(A);
      A.classList.add('on'); B = document.createElement('img'); B.alt = ''; B.width = A.width; B.height = A.height; B.decoding = 'async'; wrap.appendChild(B);
      baseSrc = A.getAttribute('src'); cur = '';
    }
    function start() { if (on || !A || reduced()) return; on = true; var n = performance.now(); nextSmile = n + rnd(12000, 25000); nextLook = n; holdUntil = 0; tick(); }
    function stop() {
      on = false; clearTimeout(timer); timer = 0; clearTimeout(reactT); ++sTok; holdUntil = 0;
      if (A && wrap) { A.classList.add('on'); A.classList.remove('top'); B.classList.remove('on', 'top'); A.src = baseSrc; active = A; cur = ''; }   /* back to the photo that was there before */
    }
    function now() { return performance.now(); }
    function hold(n, ms) { holdUntil = now() + ms; nextLook = holdUntil; show(n); }
    return {
      init: init, start: start, stop: stop,
      rect: function () { return A ? A.getBoundingClientRect() : null; },
      busy: function () { return on && now() < holdUntil; },
      scene: function (n, ms) { if (on) hold(n, Math.max(ms, 1500)); },   /* gossip: forced expression, 1.5 s minimum */
      release: function (n) { if (!on) return; if (n) hold(n, 1500); else holdUntil = 0; },
      react: function (id) {   /* 0.4 s after a signature move starts; at most one reaction every 8 s; an overlapping move gets none */
        if (!on || !REACT[id] || now() - lastReact < 8000 || now() < holdUntil) return;
        lastReact = now(); clearTimeout(reactT);
        reactT = setTimeout(function () { if (on) hold(REACT[id], rnd(1500, 3000)); }, 400);
      },
      facepalm: function () { if (!on || now() - lastReact < 8000) return; lastReact = now(); hold('facepalm', rnd(1800, 3000)); }
    };
  })();
  window.addEventListener('resize', layoutOrg);
  document.addEventListener('jb-brain-count', renderOffClock);

  function waHref() { var parts = (P().wa_parts || []); return 'https://wa.me/' + parts.join(''); }
  function brand(n) { return '<svg class="brand" aria-hidden="true"><use href="#b-' + n + '"/></svg>'; }
  function renderContact() {
    var p = P(), links = p.links || {};
    var btns = [
      '<a class="btn btn-line" href="mailto:' + esc(p.email) + '" data-smile>' + brand('gmail') + 'Email</a>',
      '<button class="btn btn-line" type="button" data-act="whatsapp" data-smile>' + brand('whatsapp') + 'WhatsApp</button>',
      '<a class="btn btn-line" href="' + esc(links.linkedin) + '" target="_blank" rel="noopener" data-smile>' + brand('linkedin') + 'LinkedIn</a>',
      '<a class="btn btn-line" href="' + esc(links.github) + '" target="_blank" rel="noopener" data-smile>' + brand('github') + 'GitHub</a>',
      '<button class="btn btn-accent btn-book" type="button" data-act="book" data-smile>' + ic('calendar') + 'Book a call</button>'
    ];
    $('#contact-btns').innerHTML = btns.join('');
  }

  function chipText(key) {
    var n;
    if (key === 'projects') { n = pubList().length; return n + ' projects'; }
    if (key === 'steps') return (P().workflow || []).length + ' steps';
    if (key === 'roles') return (P().experience || []).length + ' roles';
    if (key === 'tools') { n = 0; (P().toolbox || []).forEach(function (g) { n += g.items.length; }); return n + ' tools'; }
    if (key === 'cat') return '1 cat';
    if (key === 'skills') return '6 skills';
    if (key === 'offclock') return (((P().off_clock && P().off_clock.team && P().off_clock.team.agents) || []).length + 2) + ' agents';
    if (key === 'notes') return window.JBBrainCount ? window.JBBrainCount.toLocaleString('en-US') + ' notes' : 'notes';
    if (key === 'channels') return $$('#contact-btns .btn').length + ' channels';
    return '';
  }
  function setChips() {
    var nodes = $$('[data-node]');
    wires.forEach(function (w, i) {
      var n = nodes[i + 1]; if (n) $('.wchip', w).textContent = chipText(n.dataset.chip);
    });
  }

  function renderAll() {
    if (window.__JBRun) window.__JBRun.stop();
    renderHero(); renderFilters(); renderProjects(); renderTimeline(); renderTools(); renderOffClock(); renderContact(); renderShowcase();
    buildFlow();
    linkBooking();
    setChips(); layoutAll(); armDraw(); armFlowDraw();
    setTimeout(layoutAll, 60);
  }

  /* ---------- actions ---------- */
  function copyEmail() {
    var email = P().email || '';
    function done(ok) { toast(ok ? 'Copied' : 'Press Ctrl+C to copy'); }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(email).then(function () { done(true); }, function () { fallback(); }); return; }
    } catch (e) {}
    fallback();
    function fallback() {
      try {
        var t = document.createElement('textarea'); t.value = email; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-999px;top:0;opacity:0';
        document.body.appendChild(t); t.select(); var ok = document.execCommand('copy'); document.body.removeChild(t); done(ok);
      } catch (e) { done(false); }
    }
  }
  function bookCall(opener) {
    var u = P().booking_url;
    if (!u || u.charAt(0) === '#') openDlg($('#dlg-booking'), opener); else window.open(u, '_blank', 'noopener');
  }
  /* With a real booking address, "Book a call" buttons become genuine links (open in a new tab everywhere, also inside the claude.ai preview). */
  function linkBooking() {
    var ru = P().resume_url;
    if (ru && /^https?:/i.test(ru)) $$('[data-act="resume"]').forEach(function (b) {
      if (b.tagName === 'A') return;
      var l = document.createElement('a'); l.className = b.className; l.href = ru; l.target = '_blank'; l.rel = 'noopener'; l.innerHTML = b.innerHTML; b.replaceWith(l);
    });
    var u = P().booking_url; if (!u || !/^https?:/i.test(u)) return;
    $$('[data-act="book"]').forEach(function (b) {
      if (b.tagName === 'A') return;
      var l = document.createElement('a'); l.className = b.className; l.href = u; l.target = '_blank'; l.rel = 'noopener';
      l.setAttribute('data-smile', ''); l.innerHTML = b.innerHTML; b.replaceWith(l);
    });
  }
  function openResume() { window.open(P().resume_url, '_blank', 'noopener'); }
  /* ---------- tabs: one page at a time, like a sidebar app ---------- */
  var TABS = ['home', 'work', 'how', 'brain', 'experience', 'toolbox', 'team', 'contact', 'faq'];
  var RUN_TABS = ['work', 'how', 'experience', 'team'];   /* tabs that get a Run workflow button */
  function runAvail(name) { root.classList.toggle('no-run', RUN_TABS.indexOf(name) < 0); }
  runAvail('home');
  var TAB_ALIAS = { top: 'home', showcase: 'home', offclock: 'team', 'break': 'team' };
  var curTab = 'home';
  function tabOf(id) {
    if (!id) return null;
    if (TABS.indexOf(id) >= 0) return id;
    if (TAB_ALIAS[id]) return TAB_ALIAS[id];
    var el = document.getElementById(id), p = el && el.closest && el.closest('.tabpanel');
    return p ? p.dataset.tab : null;
  }
  var introT = 0;
  function intro(panel) {
    if (!panel || reduced()) return;
    var els = $$('.group > *, .hero-copy > *, .hero > .face', panel), base = window.pageYOffset;
    var top0 = Math.min.apply(null, els.map(function (e) { return e.getBoundingClientRect().top + base; }).concat([1e9]));
    els.forEach(function (e) {
      var dy = Math.max(0, e.getBoundingClientRect().top + base - top0);
      e.style.setProperty('--d', Math.round(Math.min(dy * 0.55, 1100)) + 'ms'); e.classList.add('fi');
    });
    panel.classList.add('intro');
    clearTimeout(introT);
    introT = setTimeout(function () { panel.classList.remove('intro'); els.forEach(function (e) { e.classList.remove('fi'); e.style.removeProperty('--d'); }); }, 2300);
  }
  function showTab(name, opts) {
    opts = opts || {};
    if (TABS.indexOf(name) < 0) name = 'home';
    if (name !== curTab || opts.force) {
      if (window.__JBRun) window.__JBRun.stop();
      $$('.tabpanel').forEach(function (p) { p.classList.toggle('on', p.dataset.tab === name); });
      $$('#tabnav [data-tab]').forEach(function (a) {
        var on = a.dataset.tab === name; a.classList.toggle('on', on);
        if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
      curTab = name; runAvail(name); root.classList.toggle('on-contact', name === 'contact'); if (window.__CatBar) window.__CatBar.sync(); intro($('#tab-' + name));
      if (!opts.noHash) { try { history.replaceState(null, '', name === 'home' ? location.pathname + location.search : '#' + name); } catch (e) {} }
      if (!opts.keepScroll) window.scrollTo(0, 0);
      layoutAll(); layoutOrg(); setTimeout(function () { layoutAll(); layoutOrg(); }, 80);
      applyFit(); setTimeout(applyFit, 120);
      var strip = $('#tabnav .on'); if (strip && strip.scrollIntoView) { try { strip.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {} }
    }
  }
  /* ---------- phones: Second brain, Toolbox, Team, Contact and FAQ fit exactly one screen ---------- */
  var FIT_TABS = ['brain', 'toolbox', 'team', 'contact', 'faq'], fitMQ = window.matchMedia('(max-width: 959px)');
  function fitSpace(el, gap) {   /* px from the element's top (page at the top) down to the bottom bar or screen edge */
    var bar = document.querySelector('.bottombar'), limit = window.innerHeight;
    if (bar && getComputedStyle(bar).display !== 'none') limit = bar.getBoundingClientRect().top;
    return Math.floor(limit - (el.getBoundingClientRect().top + window.pageYOffset) - (gap || 0) - (fitTrim[curTab] || 0));
  }
  var fitBusy = false, fitTrim = {};   /* per-tab correction for spacing below the stretchy area, measured once */
  function applyFit() {
    if (fitBusy) return; fitBusy = true;
    var on = fitMQ.matches && FIT_TABS.indexOf(curTab) >= 0, y = window.pageYOffset;
    root.classList.toggle('fit-tab', on);
    if (on && y) window.scrollTo(0, 0);
    var stage = document.getElementById('brain-stage');
    if (stage) stage.style.height = on && curTab === 'brain' ? Math.max(220, fitSpace(stage, 10)) + 'px' : '';
    if (typeof Pit !== 'undefined' && Pit.refit && curTab === 'toolbox') Pit.refit();
    if (typeof Yard !== 'undefined' && Yard.refit && curTab === 'team') Yard.refit();
    fitBusy = false;
    /* if anything still spills past the screen (margins under the area), shrink the stretchy area by exactly that much */
    if (on && ['brain', 'toolbox', 'team'].indexOf(curTab) >= 0 && !applyFit.again) {
      var over = document.documentElement.scrollHeight - window.innerHeight;
      if (over > 0) { fitTrim[curTab] = (fitTrim[curTab] || 0) + over; applyFit.again = true; applyFit(); applyFit.again = false; }
    }
  }
  window.addEventListener('resize', function () { clearTimeout(applyFit.t); applyFit.t = setTimeout(applyFit, 120); });
  /* FAQ on phones: answers start closed, and opening one closes the others */
  (function () {
    var items = Array.prototype.slice.call(document.querySelectorAll('#faq details'));
    if (fitMQ.matches) items.forEach(function (d) { d.open = false; });
    items.forEach(function (d) { d.addEventListener('toggle', function () { if (d.open && fitMQ.matches) items.forEach(function (o) { if (o !== d) o.open = false; }); }); });
  })();

  function jump(id) {
    if (id === 'home' || id === 'top') { showTab('home'); window.scrollTo(0, 0); return; }
    var t = tabOf(id); if (!t) return;
    var el = document.getElementById(id);
    if (TABS.indexOf(id) >= 0 || !el) { showTab(t); window.scrollTo(0, 0); return; }
    showTab(t, { keepScroll: true });
    requestAnimationFrame(function () { el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (!id || !tabOf(id)) return;
    e.preventDefault(); jump(id);
  });
  window.addEventListener('hashchange', function () { var id = location.hash.slice(1); if (id && tabOf(id)) jump(id); });

  /* ---------- home showcase ---------- */
  function renderShowcase() {
    var box = $('#tiles'); if (!box) return;
    var tiles = [
      { tab: 'how', icon: 'route', t: 'Automations that run themselves', x: 'n8n, Power Automate and Claude Code. 20+ workflow automations shipped, and one email workflow cut each priority request from 20 minutes to 2–3.' },
      { tab: 'work', icon: 'grid', t: 'Apps people actually use', x: 'Gastos, Patas, Demi Plank, GoniLift and more. Live now, ready to try.' },
      { tab: 'team', icon: 'bot', t: 'An AI team on call', x: 'Raphael, Jarvis and six specialists, each with a job and a voice of their own.' },
      { tab: 'brain', icon: 'brain', t: 'A second brain', x: 'Every note I write, linked, so my AI remembers decisions, mistakes and preferences between sessions.' },
      { tab: 'experience', icon: 'briefcase', t: 'Led a team', x: 'Led 4 VAs on 300+ requests a month, with SOPs, QA and a KPI dashboard.' },
      { tab: 'contact', icon: 'mail', t: "Let's work together", x: 'Part-time and project work. Usually replies within a day, Manila time.' }
    ];
    box.innerHTML = tiles.map(function (k) {
      return '<a class="node io tile" href="#' + k.tab + '" data-step="' + esc(k.t) + '"><span class="tile-ic">' + ic(k.icon) + '</span><b>' + esc(k.t) + '</b><p>' + esc(k.x) + '</p><span class="tile-go mono">Open ' + ic('arrow') + '</span></a>';
    }).join('');
    var ls = $('#livestrip');
    if (ls) ls.innerHTML = pubList().map(function (p) {
      return '<button class="live-item node" type="button" data-open="' + esc(p.id) + '"><span class="app3d">' + pic(p) + '</span><span><b>' + esc(p.name) + '</b><small>' + esc(p.one_liner) + '</small></span></button>';
    }).join('');
  }
  function act(name, opener) {
    if (name === 'book') bookCall(opener);
    else if (name === 'whatsapp') window.open(waHref(), '_blank', 'noopener');
    else if (name === 'copy') copyEmail();
    else if (name === 'theme') toggleTheme();
    else if (name === 'resume') openResume();
    else if (name === 'game') { if (window.CatGame) window.CatGame.open(); }
    else if (name === 'light') Face.toggle();
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-act],[data-open],[data-filter],[data-role],[data-agent],.orgn,.xbtn');
    if (!t) return;
    if (t.dataset.act) { act(t.dataset.act, t); return; }
    if (t.dataset.open) { openProject(t.dataset.open, t); return; }
    if (t.dataset.agent) { openAgent(t.dataset.agent, t); return; }
    if (t.classList.contains('orgn')) { openAgent(t.dataset.org, t); return; }
    if (t.dataset.role != null && t.dataset.role !== '') { openRole(+t.dataset.role, t); return; }
    if (t.dataset.filter) { filter = t.dataset.filter; renderProjects(); return; }
    if (t.classList.contains('xbtn')) {
      var node = t.closest('.xnode'), open = !node.classList.contains('open');
      node.classList.toggle('open', open); t.setAttribute('aria-expanded', String(open));
    }
  });
  $('#btn-theme').addEventListener('click', toggleTheme);
  if ($('#btn-copy')) $('#btn-copy').addEventListener('click', copyEmail);
  if ($('#btn-game')) $('#btn-game').addEventListener('click', function () { if (window.CatGame) window.CatGame.open(); });


  /* ---------- phones & tablets: burger drawer ---------- */
  (function () {
    var btn = $('#btn-menu'), nav = $('#tabnav'), scrim = $('#nav-scrim'), mainEl = $('#main'), mq = window.matchMedia('(max-width: 959px)');
    if (!btn || !nav) return;
    /* fade order comes from each item's position (CSS nth-child), so items swapped later (the Résumé link) keep their place */
    function isOpen() { return root.classList.contains('nav-open'); }
    function setOpen(on, focusBack) {
      if (on === isOpen()) return;
      root.classList.toggle('nav-open', on);
      btn.setAttribute('aria-expanded', String(on));
      btn.setAttribute('aria-label', on ? 'Close menu' : 'Open menu');
      $('use', btn).setAttribute('href', on ? '#i-close' : '#i-menu');
      if (mainEl) mainEl.inert = on;
      if (on) { var f = $('a.on', nav) || $('a', nav); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 60); }
      else if (focusBack) btn.focus({ preventScroll: true });
    }
    btn.addEventListener('click', function () { setOpen(!isOpen()); });
    if (scrim) scrim.addEventListener('click', function () { setOpen(false); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a, .tl-act')) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) { e.stopPropagation(); setOpen(false, true); } }, true);
    function onMQ() { if (!mq.matches) setOpen(false); }
    if (mq.addEventListener) mq.addEventListener('change', onMQ); else if (mq.addListener) mq.addListener(onMQ);
  })();

  /* ---------- the run engine ----------
     One engine for the whole page run (hero button) and for the How-I-work flow (scoped to its 5 nodes).
     Steps are every element with data-step, in DOM order, so new projects and sections join automatically.
     Per step: scroll the node to ~40% of the viewport, draw a live wire from the previous node's output port
     to this node's input port (travelling dot + "1 item" chip), then the node "runs" for a reading-time dwell
     (spinner, "running…", a progress bar) and turns green with "done · 4.2s". The clock is the engine's own,
     so pausing freezes the bar exactly where it is. Reduced motion: same controller, instant scroll, Next / Back only. */
  function rand(a, b) { return a + Math.random() * (b - a); }
  function prepNode(n) {
    if (n.dataset.rprep) return; n.dataset.rprep = '1';
    var host = $('.node-head .st', n) || $('.node-head', n), s = document.createElement('span');
    s.className = 'rstat' + (host ? '' : ' rbadge'); s.innerHTML = '<i class="spin" aria-hidden="true"></i><span class="rtxt"></span>';
    if (host) { if (host.classList.contains('st')) host.insertBefore(s, host.firstChild); else host.appendChild(s); } else n.appendChild(s);
    var bar = document.createElement('i'); bar.className = 'rbar'; bar.setAttribute('aria-hidden', 'true'); bar.innerHTML = '<i></i>'; n.appendChild(bar);
  }
  function setStat(n, mode, txt) {
    prepNode(n);
    var t = $('.rtxt', n); if (t) t.textContent = txt || '';
    n.classList.toggle('lit', mode === 'run'); n.classList.toggle('done', mode === 'done');
  }
  function setBar(n, p) { var b = $('.rbar > i', n); if (b) b.style.transform = 'scaleX(' + Math.max(0, Math.min(1, p)) + ')'; }
  function clearNode(n) { n.classList.remove('lit', 'done'); setBar(n, 0); var t = $('.rtxt', n); if (t) t.textContent = ''; }
  function scrollToNode(n, instant) { n.scrollIntoView({ behavior: instant || reduced() ? 'auto' : 'smooth', block: 'center' }); }

  /* phones and tablets: one Run button at the top of each tab in RUN_TABS (desktop uses the sidebar button) */
  $$('.tabpanel').forEach(function (p) {
    if (RUN_TABS.indexOf(p.dataset.tab) < 0) return;
    var row = document.createElement('div'); row.className = 'tab-run-row wrap';
    row.innerHTML = '<button class="btn btn-run tab-run" type="button">' + ic('play') + '<span>Run workflow</span></button>';
    p.insertBefore(row, p.firstChild);
  });

  var Run = (function () {
    var SVGNS = 'http://www.w3.org/2000/svg', TRAVEL = 700;
    var runTabBtn = $('#btn-run-tab'), runTabLabel = $('#run-tab-label'), runBtn = $('#btn-run'), runLabel = $('#run-label'), flowBtn = $('#btn-flow');
    var layer = null, svg = null, chip = null, dot = null, hideT = 0, clearT = 0, redrawQ = 0, backT = 0, IDLE_BACK = 4000;
    var S = { state: 'idle', scope: 'page', steps: [], idx: -1, phase: 'dwell', t: 0, dwell: 4000, speed: 5, last: 0, raf: 0, wires: [] };

    function visible(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.closest('dialog:not([open])'); }
    function collect(scope) { return $$(scope === 'flow' ? '#flow [data-step]' : '[data-step]').filter(visible); }
    function words(el) { return ((el.innerText || '').trim().split(/\s+/).filter(Boolean)).length; }
    function dwellFor(el) { return Math.max(4000, Math.min(10000, 2500 + 280 * words(el))); }
    function el() { return S.steps[S.idx]; }
    function active() { return S.state === 'running' || S.state === 'paused'; }

    /* ----- overlay wires (document coordinates, pointer-events none) ----- */
    function ensureLayer() {
      if (layer) return;
      layer = document.createElement('div'); layer.id = 'run-layer'; layer.setAttribute('aria-hidden', 'true');
      svg = document.createElementNS(SVGNS, 'svg'); layer.appendChild(svg);
      chip = document.createElement('span'); chip.className = 'rchip mono'; chip.textContent = '1 item'; chip.hidden = true; layer.appendChild(chip);
      dot = document.createElementNS(SVGNS, 'circle'); dot.setAttribute('r', '5'); dot.setAttribute('class', 'rdot'); dot.style.display = 'none'; svg.appendChild(dot);
      document.body.appendChild(layer); sizeLayer();
    }
    function sizeLayer() { if (!layer) return; layer.style.width = document.documentElement.clientWidth + 'px'; layer.style.height = Math.max(document.documentElement.scrollHeight, window.innerHeight) + 'px'; }
    function dropLayer() { if (layer) { layer.remove(); layer = svg = chip = dot = null; } S.wires = []; }
    function pathFor(a, b) {
      var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(), sx = window.pageXOffset, sy = window.pageYOffset, x1, y1, x2, y2, d, c;
      if (rb.top >= ra.bottom - 8) {   /* stacked: bottom port to top port */
        x1 = ra.left + ra.width / 2 + sx; y1 = ra.bottom + sy; x2 = rb.left + rb.width / 2 + sx; y2 = rb.top + sy; c = Math.max(36, Math.abs(y2 - y1) / 2);
        d = 'M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + (y1 + c) + ' ' + x2 + ' ' + (y2 - c) + ' ' + x2 + ' ' + y2;
      } else {                           /* same row or above: right port to left port */
        x1 = ra.right + sx; y1 = ra.top + ra.height / 2 + sy; x2 = rb.left + sx; y2 = rb.top + rb.height / 2 + sy; c = Math.max(50, Math.abs(x2 - x1) / 2);
        d = 'M' + x1 + ' ' + y1 + ' C' + (x1 + c) + ' ' + y1 + ' ' + (x2 - c) + ' ' + y2 + ' ' + x2 + ' ' + y2;
      }
      return d;
    }
    /* A step's wire reuses the gray wire already on the page when there is one (How I work flow, the org chart,
       the divider on Home). Otherwise it draws its own. Reused wires are copied exactly on top of the gray one. */
    function staticSegs(a, b) {
      var fi = a.classList.contains('fnode') && b.classList.contains('fnode') ? +a.dataset.fi : -1;
      if (fi >= 0 && +b.dataset.fi === fi + 1 && flowPaths[fi]) return [{ get: function () { return flowPaths[fi].path; }, rev: false }];
      if (a.dataset.org && b.dataset.org) {
        var edges = $$('#org .ow[data-l]').map(function (p) { return p.dataset.l.split('>'); }), prev = {}, q = [a.dataset.org], seen = {};
        seen[a.dataset.org] = 1;
        while (q.length) {
          var u = q.shift(); if (u === b.dataset.org) break;
          edges.forEach(function (e) {
            [[e[0], e[1], false], [e[1], e[0], true]].forEach(function (x) { if (x[0] === u && !seen[x[1]]) { seen[x[1]] = 1; prev[x[1]] = { from: u, l: e.join('>'), rev: x[2] }; q.push(x[1]); } });
          });
        }
        if (!seen[b.dataset.org]) return null;
        var out = [], cur = b.dataset.org;
        while (cur !== a.dataset.org) { var st = prev[cur]; (function (l, rev) { out.unshift({ get: function () { return $('#org .ow[data-l="' + l + '"]'); }, rev: rev }); })(st.l, st.rev); cur = st.from; }
        return out;
      }
      var ws = $$('.wire[data-wire]');
      for (var i = 0; i < ws.length; i++) {
        var w = ws[i], pv = w.previousElementSibling, nx = w.nextElementSibling;
        if (pv && nx && pv.contains(a) && nx.contains(b)) return [{ get: function () { return $('.wp', w); }, rev: false }];
      }
      return null;
    }
    function origin(p) { var r = p.ownerSVGElement.getBoundingClientRect(); return { x: r.left + window.pageXOffset, y: r.top + window.pageYOffset }; }
    function syncSeg(sg) {
      var p = sg.get(); if (!p) return false;
      var o = origin(p); sg.el.setAttribute('d', p.getAttribute('d')); sg.el.setAttribute('transform', 'translate(' + o.x + ' ' + o.y + ')');
      sg.len = p.getTotalLength(); sg.o = o; sg.src = p; return true;
    }
    function drawWire(i) {
      ensureLayer();
      var a = S.steps[i - 1], b = S.steps[i], segs = staticSegs(a, b), w;
      if (segs) {
        segs.forEach(function (sg) { sg.el = document.createElementNS(SVGNS, 'path'); sg.el.setAttribute('class', 'rwire'); svg.insertBefore(sg.el, dot); });
        if (segs.every(syncSeg)) { w = { segs: segs, total: segs.reduce(function (t, sg) { return t + sg.len; }, 0) }; S.wires[i] = w; return w; }
        segs.forEach(function (sg) { sg.el.remove(); });
      }
      var path = document.createElementNS(SVGNS, 'path'); path.setAttribute('class', 'rwire'); svg.insertBefore(path, dot);
      path.setAttribute('d', pathFor(a, b));
      w = { own: path }; S.wires[i] = w; return w;
    }
    function dropWire(w) { if (!w) return; if (w.own) w.own.remove(); (w.segs || []).forEach(function (sg) { sg.el.remove(); }); }
    function redraw() {
      redrawQ = 0; if (!layer) return; sizeLayer();
      S.wires.forEach(function (w, i) {
        if (!w) return;
        if (w.own) { if (S.steps[i - 1] && S.steps[i]) w.own.setAttribute('d', pathFor(S.steps[i - 1], S.steps[i])); }
        else { w.segs.forEach(syncSeg); w.total = w.segs.reduce(function (t, sg) { return t + (sg.len || 0); }, 0); }
      });
    }
    function queueRedraw() { if (!redrawQ) redrawQ = requestAnimationFrame(redraw); }
    function setWireProgress(i, p) {
      var w = S.wires[i]; if (!w) return;
      var pt, mid;
      if (w.own) {
        var len = w.own.getTotalLength(); w.own.style.strokeDasharray = len; w.own.style.strokeDashoffset = len * (1 - p);
        pt = w.own.getPointAtLength(len * p); mid = w.own.getPointAtLength(len / 2);
      } else {
        var at = w.total * p, c = 0;
        var pointAt = function (x) {
          var acc = 0;
          for (var k = 0; k < w.segs.length; k++) {
            var sg = w.segs[k];
            if (x <= acc + sg.len || k === w.segs.length - 1) { var l = Math.max(0, Math.min(sg.len, x - acc)), pp = sg.src.getPointAtLength(sg.rev ? sg.len - l : l); return { x: pp.x + sg.o.x, y: pp.y + sg.o.y }; }
            acc += sg.len;
          }
        };
        w.segs.forEach(function (sg) {
          var q = Math.max(0, Math.min(1, (at - c) / (sg.len || 1)));
          sg.el.style.strokeDasharray = sg.len + ' ' + sg.len; sg.el.style.strokeDashoffset = sg.rev ? -sg.len * (1 - q) : sg.len * (1 - q);
          c += sg.len;
        });
        pt = pointAt(at); mid = pointAt(w.total / 2);
      }
      dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y); dot.style.display = p >= 1 ? 'none' : '';
      if (p >= .5) { chip.style.left = mid.x + 'px'; chip.style.top = mid.y + 'px'; chip.hidden = false; }
    }
    function trail(i) {
      var w = S.wires[i];
      if (w) { (w.own ? [w.own] : w.segs.map(function (sg) { return sg.el; })).forEach(function (e) { e.style.strokeDasharray = ''; e.style.strokeDashoffset = ''; e.classList.add('trail'); }); }
      if (chip) chip.hidden = true; if (dot) dot.style.display = 'none';
    }

    /* ----- ui ----- */
    function ui() {
      var on = active(), page = S.scope === 'page', isReduced = reduced();
      document.documentElement.classList.toggle('running', on || S.state === 'done');
      document.documentElement.classList.toggle('run-paused', S.state === 'paused');
      var pageRun = on && page, flowRun = on && !page;
      if (isReduced) {
        setRunBtn(pageRun ? 'stop' : 'play', pageRun ? 'Stop' : 'Step through the page');
        if (flowBtn) flowBtn.innerHTML = ic(flowRun ? 'stop' : 'play') + (flowRun ? 'Stop' : 'Step through this flow');
      } else {
        setRunBtn(pageRun ? 'stop' : 'play', pageRun ? 'Stop' : 'Run workflow');
        if (flowBtn) flowBtn.innerHTML = ic(flowRun ? 'stop' : 'play') + (flowRun ? 'Stop' : 'Run this flow');
      }
    }
    function setRunBtn(icon, label) {
      if (runBtn) { runLabel.textContent = label; $('use', runBtn).setAttribute('href', '#i-' + icon); }
      $$('.tab-run').forEach(function (b) { $('span', b).textContent = icon === 'stop' ? 'Stop' : (reduced() ? 'Step through the page' : 'Run workflow'); $('use', b).setAttribute('href', '#i-' + icon); });
      if (runTabBtn) { runTabLabel.textContent = icon === 'stop' ? 'Stop' : (reduced() ? 'Step through this page' : 'Run this page'); $('use', runTabBtn).setAttribute('href', '#i-' + icon); }
    }

    /* ----- scrolling ----- */
    function scrollToStep(n) {
      var r = n.getBoundingClientRect(), vh = window.innerHeight, top;
      if (r.height < vh * 0.55) top = r.top + window.pageYOffset + r.height / 2 - vh * 0.4; else top = r.top + window.pageYOffset - 96;
      window.scrollTo({ top: Math.max(0, top), behavior: reduced() ? 'auto' : 'smooth' });
    }

    /* ----- stepping ----- */
    function frame(now) {
      S.raf = 0; if (S.state !== 'running') return;
      var dt = Math.min(100, now - S.last); S.last = now; S.t += dt * S.speed;
      if (S.phase === 'travel') {
        var p = Math.min(1, S.t / TRAVEL); setWireProgress(S.idx, p);
        if (p >= 1) beginDwell();
      } else {
        if (!reduced()) setBar(el(), S.t / S.dwell);
        if (S.t >= S.dwell) { completeStep(); return; }
      }
      S.raf = requestAnimationFrame(frame);
    }
    function loop() { if (S.raf || S.state !== 'running') return; S.last = performance.now(); S.raf = requestAnimationFrame(frame); }
    function beginDwell() {
      S.phase = 'dwell'; S.t = 0; S.dwell = dwellFor(el());
      setStat(el(), 'run', 'running…'); setBar(el(), 0);
      if (S.idx > 0 && S.wires[S.idx]) { setWireProgress(S.idx, 1); }
    }
    function markDone(i, secs) { var n = S.steps[i]; setStat(n, 'done', secs != null ? 'done · ' + secs.toFixed(1) + 's' : 'done'); setBar(n, 1); trail(i); }
    function completeStep() {
      markDone(S.idx, S.t / 1000);
      if (S.idx >= S.steps.length - 1) { complete(); return; }
      go(S.idx + 1);
    }
    function go(k) {
      k = Math.max(0, Math.min(S.steps.length - 1, k));
      S.steps.forEach(function (n, i) { if (i >= k) clearNode(n); else if (!n.classList.contains('done')) markDone(i, null); });
      S.wires.forEach(function (w, i) { if (w && i >= k) { dropWire(w); S.wires[i] = null; } });
      S.wires.length = Math.min(S.wires.length, k);
      S.idx = k; S.t = 0; scrollToStep(el());
      var manual = reduced();
      if (k > 0) {
        drawWire(k);
        if (manual) { trail(k); }
      }
      if (k > 0 && !manual) { S.phase = 'travel'; setStat(el(), 'idle'); setWireProgress(k, 0); }
      else { beginDwell(); if (manual) { setBar(el(), 0); } }
      ui(); loop();
    }
    function complete() {
      S.state = 'done'; var n = S.steps.length;
      dropLayer(); ui(); toast('Workflow complete · ' + n + ' steps', 4200);
      clearTimeout(hideT); hideT = setTimeout(function () { if (S.state === 'done') { S.state = 'idle'; teamOrg(false); ui(); } }, 4200);
      clearTimeout(clearT); clearT = setTimeout(function () { if (S.state === 'idle') S.steps.forEach(clearNode); }, 14000);
      listeners(false);
    }

    /* ----- controls ----- */
    function start(scope) {
      if (active()) stop(true);
      clearTimeout(hideT); clearTimeout(clearT); clearTimeout(backT);
      S.scope = scope; teamOrg(scope === 'page' && curTab === 'team'); S.steps = collect(scope);
      if (!S.steps.length) return;
      S.steps.forEach(clearNode);
      S.state = 'running'; S.wires = []; listeners(true);
      go(0);
    }
    function stop(silent) {
      cancelAnimationFrame(S.raf); S.raf = 0; clearTimeout(backT); listeners(false);
      S.steps.forEach(clearNode); dropLayer(); teamOrg(false);
      S.state = 'idle'; S.idx = -1; ui();
    }
    function pause() { if (S.state !== 'running') return; S.state = 'paused'; cancelAnimationFrame(S.raf); S.raf = 0; ui(); }
    function resume() {
      if (S.state !== 'paused') return;
      clearTimeout(backT); S.state = 'running'; if (el()) scrollToStep(el()); ui(); loop();
    }
    function toggle() { if (S.state === 'running') pause(); else if (S.state === 'paused') { resume(); } }

    /* ----- auto-pause when the visitor takes over; carries on by itself after a quiet moment ----- */
    var SCROLL_KEYS = { ArrowUp: 1, ArrowDown: 1, PageUp: 1, PageDown: 1, Home: 1, End: 1 };
    function waitThenResume() { clearTimeout(backT); backT = setTimeout(function () { if (document.querySelector('dialog[open]') || document.hidden) waitThenResume(); else resume(); }, IDLE_BACK); }
    function onUser() { if (S.state === 'running') { pause(); waitThenResume(); } else if (S.state === 'paused' && backT) waitThenResume(); }
    function onPointer(e) {
      if (e.target.closest && e.target.closest('#btn-run, #btn-run-tab, #btn-flow, .tab-run')) return;
      onUser();
    }
    function onKey(e) {
      var tag = (e.target.tagName || '').toLowerCase();
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { stop(); return; }
      if ((e.key === ' ' || e.code === 'Space') && !e.ctrlKey && !e.metaKey && !e.altKey && !document.querySelector('dialog[open]') && tag !== 'input' && tag !== 'textarea' && tag !== 'button' && tag !== 'a' && tag !== 'select') {
        e.preventDefault(); clearTimeout(backT); backT = 0; toggle();   /* a Space pause stays until Space again */
        return;
      }
      if (SCROLL_KEYS[e.key] && tag !== 'input' && tag !== 'textarea') onUser();
    }
    function listeners(on) {
      var m = on ? 'addEventListener' : 'removeEventListener';
      window[m]('wheel', onUser, { passive: true }); window[m]('touchmove', onUser, { passive: true });
      document[m]('pointerdown', onPointer, true); document[m]('keydown', onKey);
    }

    /* ----- wiring ----- */
    function pageToggle() { if (active() && S.scope === 'page') stop(); else start('page'); }
    if (runBtn) runBtn.addEventListener('click', pageToggle); $$('.tab-run').forEach(function (b) { b.addEventListener('click', pageToggle); }); if (runTabBtn) runTabBtn.addEventListener('click', pageToggle);
    if (flowBtn) flowBtn.addEventListener('click', function () { if (active() && S.scope === 'flow') stop(); else start('flow'); });
    window.addEventListener('resize', queueRedraw);
    if ('ResizeObserver' in window) new ResizeObserver(queueRedraw).observe(document.body);
    if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', function () { stop(); });
    ui();
    window.__JBRun = { start: start, stop: stop };
    return { start: start, stop: stop, ui: ui, active: active };
  })();

  /* ---------- face ---------- */
  var Face = (function () {
    var face = $('#face'), stage = $('#stage'), fa = $('#fa'), fb = $('#fb'), bulb = $('#bulb'), title = $('#face-title'), dot = $('#face-dot'), tip = $('#tip'), dim = $('#dim');
    var BASE = 'assets/face/', CLIPS = 'assets/clips/';
    var names = ['c', 'u', 'd', 'l', 'r', 'ul', 'ur', 'dl', 'dr', 'smile', 'sleep'];
    var loaded = {}, bad = {}, clipBad = {}, videos = {}, pending = {};
    var active = fa, current = 'c', lightOn = true, busy = false, seq = 0, setTok = 0;
    var ptr = { x: 0, y: 0, has: false }, gazeQ = 0, smileHold = 0, tapTimer = 0, inView = true, zone = 'c';
    /* Frame names describe the photo as labelled at generation time; their left/right turned out
       mirrored (Joe, 2026-11-21), so cursor-right uses the "l*" frames and cursor-left the "r*" ones. */
    var DIR_ANGLE = { l: 0, dl: 45, dr: 90, d: 135, r: 180, ul: -135, u: -90, ur: -45 };

    /* Resolves true/false. Frames that may not exist yet (in-bed) are only requested when needed. */
    function ensureFrame(n) {
      if (loaded[n]) return Promise.resolve(true);
      if (bad[n]) return Promise.resolve(false);
      if (pending[n]) return pending[n];
      pending[n] = new Promise(function (res) {
        var im = new Image();
        im.onload = function () { loaded[n] = true; res(true); };
        im.onerror = function () { bad[n] = true; res(false); };
        im.src = BASE + n + '.webp';
      });
      return pending[n];
    }
    names.forEach(ensureFrame);

    function url(n) { return BASE + n + '.webp'; }
    function setFrame(name, ms) {
      if (name === current && active.classList.contains('on')) return Promise.resolve();
      var tok = ++setTok, next = active === fa ? fb : fa, old = active;
      stage.style.setProperty('--fade', (ms == null ? 120 : ms) + 'ms');
      next.src = url(name);
      var go = function () {
        if (tok !== setTok) return;
        next.classList.add('on', 'top'); old.classList.remove('top'); active = next; current = name;
        setTimeout(function () { if (tok === setTok && old !== active) old.classList.remove('on'); }, (ms == null ? 120 : ms) + 30);
      };
      return (next.decode ? next.decode().catch(noop) : Promise.resolve()).then(go);
    }
    function snap(name) { return setFrame(name, 0); }

    /* ----- clips ----- */
    function getVideo(n) {
      if (videos[n]) return videos[n];
      var v = document.createElement('video');
      v.className = 'fvid'; v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'none'; v.setAttribute('aria-hidden', 'true');
      v.src = CLIPS + n + '.mp4';
      stage.insertBefore(v, dim);
      videos[n] = v; return v;
    }
    function prefetch(n) { if (reduced() || clipBad[n]) return; var v = getVideo(n); if (v.preload !== 'auto') { v.preload = 'auto'; try { v.load(); } catch (e) {} } }
    function stopVideos() { Object.keys(videos).forEach(function (k) { var v = videos[k]; try { v.pause(); } catch (e) {} v.classList.remove('on'); }); }
    function hideVideos() { Object.keys(videos).forEach(function (k) { videos[k].classList.remove('on'); }); }
    function playClip(n, tok) {
      return new Promise(function (resolve) {
        if (clipBad[n]) { resolve(false); return; }
        var v = getVideo(n), done = false, to;
        function fin(ok) {
          if (done) return; done = true; clearTimeout(to);
          v.removeEventListener('ended', onEnd); v.removeEventListener('error', onErr); v.removeEventListener('playing', onPlaying);
          if (!ok) { clipBad[n] = true; try { v.pause(); } catch (e) {} v.classList.remove('on'); }
          resolve(ok);
        }
        function onEnd() { fin(true); }
        function onErr() { fin(false); }
        function onPlaying() { clearTimeout(to); if (tok === seq) v.classList.add('on'); else fin(false); }
        to = setTimeout(function () { fin(false); }, 4500);
        v.addEventListener('ended', onEnd); v.addEventListener('error', onErr); v.addEventListener('playing', onPlaying);
        try { v.currentTime = 0; } catch (e) {}
        var p = v.play(); if (p && p.catch) p.catch(onErr);
      });
    }

    /* ----- ui ----- */
    function setTitle(asleep) {
      if (title) title.innerHTML = '<span class="fn">Joemark · </span>' + (asleep ? 'asleep' : 'online');
      if (dot) dot.className = 'dot' + (asleep ? '' : ' live');
      tip.textContent = asleep ? 'Shh, he’s asleep. Turn the light back on.' : 'Yes, he’s watching your cursor.';
    }
    function bulbUI() {
      bulb.setAttribute('aria-pressed', String(!lightOn));
      var l = lightOn ? 'Turn the light off' : 'Turn the light on';
      bulb.setAttribute('aria-label', l); bulb.title = l;
      var bt = $('.bulb-txt', bulb); if (bt) bt.textContent = lightOn ? 'Put me to sleep' : 'Wake me up';
      var bd = $('.bulb-badge', bulb); if (bd && busy) bd.hidden = true;
    }

    /* ----- gaze ----- */
    function canGaze() { return lightOn && !busy && !reduced() && !noHoverMQ.matches && !smileHold && !document.hidden; }
    function angDiff(a, b) { var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
    function pick() {
      if (!ptr.has) return 'c';
      var r = stage.getBoundingClientRect(), dx = ptr.x - (r.left + r.width / 2), dy = ptr.y - (r.top + r.height / 2);
      var dist = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
      if (zone === 'c' ? dist < 90 : dist < 76) return 'c';
      var best = 'r', bd = 999;
      Object.keys(DIR_ANGLE).forEach(function (k) { var d = angDiff(ang, DIR_ANGLE[k]); if (d < bd) { bd = d; best = k; } });
      if (zone !== 'c' && DIR_ANGLE[zone] != null && angDiff(ang, DIR_ANGLE[zone]) < 31) return zone;
      return best;
    }
    function gaze() {
      gazeQ = 0;
      if (!canGaze()) return;
      zone = pick(); setFrame(zone);
    }
    function queueGaze() { if (!gazeQ) gazeQ = requestAnimationFrame(gaze); }
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      ptr.x = e.clientX; ptr.y = e.clientY; ptr.has = true; queueGaze();
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', function () { ptr.has = false; queueGaze(); });

    /* ----- smile ----- */
    function smileOn() {
      if (!lightOn || busy || reduced()) return;
      smileHold++; setFrame('smile');
    }
    function smileOff() { if (smileHold > 0) smileHold--; if (!smileHold) { zone = 'c'; if (canGaze()) { zone = pick(); setFrame(zone); } else if (lightOn && !busy && !reduced()) setFrame('c'); } }
    var smileEl = null;
    document.addEventListener('pointerover', function (e) {
      if (e.pointerType === 'touch') return;
      var t = e.target.closest && e.target.closest('[data-smile]');
      if (t === smileEl) return;
      if (smileEl) { smileEl = null; smileOff(); }
      if (t) { smileEl = t; smileOn(); }
    });
    document.addEventListener('pointerout', function (e) {
      if (!smileEl || e.pointerType === 'touch') return;
      var to = e.relatedTarget; if (to && smileEl.contains(to)) return;
      smileEl = null; smileOff();
    });
    document.addEventListener('focusin', function (e) { var t = e.target.closest && e.target.closest('[data-smile]'); if (t && !smileEl && e.target.matches(':focus-visible')) { smileEl = t; smileOn(); } });
    document.addEventListener('focusout', function (e) { if (smileEl && e.target.closest && e.target.closest('[data-smile]') === smileEl && !smileEl.matches(':hover')) { smileEl = null; smileOff(); } });
    function tapSmile() {
      if (!lightOn || busy || reduced()) return;
      clearTimeout(tapTimer); smileHold++; setFrame('smile');
      tapTimer = setTimeout(smileOff, 1400);
    }
    document.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      if (e.target.closest && (e.target.closest('[data-smile]') || e.target.closest('#stage'))) tapSmile();
    }, { passive: true });

    /* ----- touch glance cycle ----- */
    var glanceSeq = ['ul', 'ur', 'c'], gi = 0;
    setInterval(function () {
      if (!noHoverMQ.matches || paused || reduced() || !lightOn || busy || smileHold || document.hidden || !inView) return;
      setFrame(glanceSeq[gi % glanceSeq.length], 600); gi++;
    }, 3000);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { inView = en[0].isIntersecting; }).observe(face);

    /* ----- bulb: sleep / wake ----- */
    function settleAsleep() { setTitle(true); face.classList.add('zzz'); busy = false; }
    async function lightOff() {
      var tok = ++seq; lightOn = false; busy = true; bulbUI(); document.documentElement.classList.add('lights-off'); face.classList.add('asleep'); face.classList.remove('zzz'); clearTimeout(tapTimer); smileHold = 0;
      if (reduced()) { stopVideos(); await snap('sleep'); if (tok === seq) settleAsleep(); return; }
      stopVideos(); await setFrame('c', 120);
      if (tok !== seq) return;
      var ok = await playClip('to-bed', tok);
      if (tok !== seq) return;
      if (ok) {
        if (await ensureFrame('in-bed')) { await snap('in-bed'); if (tok !== seq) return; hideVideos(); }
        /* else: leave the clip's last frame on screen */
      } else { hideVideos(); await setFrame(loaded.sleep ? 'sleep' : 'c', 250); if (tok !== seq) return; }
      settleAsleep();
    }
    async function lightOnFn() {
      var tok = ++seq; lightOn = true; busy = true; bulbUI(); document.documentElement.classList.remove('lights-off'); face.classList.remove('asleep', 'zzz');
      if (reduced()) { stopVideos(); await snap('c'); if (tok === seq) { setTitle(false); busy = false; } return; }
      stopVideos();
      var ok = await playClip('get-up', tok);
      if (tok !== seq) return;
      if (ok) { await snap('c'); if (tok !== seq) return; hideVideos(); }
      else { hideVideos(); await setFrame('c', 250); if (tok !== seq) return; }
      setTitle(false); busy = false; zone = 'c'; queueGaze();
    }
    function toggle() { if (lightOn) lightOff(); else lightOnFn(); }
    bulb.addEventListener('click', toggle);
    ['pointerenter', 'focus'].forEach(function (ev) { bulb.addEventListener(ev, function () { prefetch(lightOn ? 'to-bed' : 'get-up'); if (lightOn) ensureFrame('in-bed'); }, { passive: true }); });

    /* first visit: wave once, then gaze */
    async function wave() {
      if (reduced() || !lightOn) return;
      if (store(true, 'jb-seen')) return;
      store(false, 'jb-seen', '1');
      busy = true; var tok = ++seq;
      var ok = await playClip('wave', tok);
      if (tok !== seq) return;
      if (ok) { await snap('c'); hideVideos(); } else hideVideos();
      busy = false; queueGaze();
    }
    /* No wave clip yet (Flow audio step kept failing). Re-enable when assets/clips/wave.mp4 exists:
       if (document.readyState === 'complete') wave(); else window.addEventListener('load', function () { setTimeout(wave, 300); }); */
    void wave;

    if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', function () {
      if (reduced()) { seq++; busy = false; stopVideos(); snap(lightOn ? 'c' : 'sleep'); if (!lightOn) settleAsleep(); }
    });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) queueGaze(); });

    setTitle(false); bulbUI();
    return { toggle: toggle, isOn: function () { return lightOn; } };
  })();

  /* ---------- command palette ---------- */
  var pal = $('#dlg-palette'), palInput = $('#pal-input'), palList = $('#pal-list'), palItems = [], palIdx = 0;
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
  $('#cmdk-label').textContent = isMac ? '⌘ K' : 'Ctrl K';

  function palCommands() {
    var list = [
      { g: 'Actions', label: 'Copy email', icon: 'copy', run: function () { copyEmail(); } },
      { g: 'Actions', label: 'Book a call', icon: 'calendar', run: function (o) { bookCall(o); } },
      { g: 'Actions', label: 'Open résumé (PDF)', icon: 'doc', run: function () { openResume(); } },
      { g: 'Actions', label: 'Toggle theme', icon: 'sun', run: function () { toggleTheme(); } },
      { g: 'Actions', label: Face.isOn() ? 'Turn the light off' : 'Turn the light on', icon: 'bulb', run: function () { Face.toggle(); } },
      RUN_TABS.indexOf(curTab) >= 0 ? { g: 'Actions', label: 'Run workflow (this page)', icon: 'play', run: function () { Run.start('page'); } } : null,
      { g: 'Actions', label: 'Play cat game', icon: 'cat', run: function () { if (window.CatGame) window.CatGame.open(); } },
      { g: 'Pages', label: 'Home', icon: 'home', run: function () { jump('home'); } },
      { g: 'Pages', label: 'Work', icon: 'grid', run: function () { jump('work'); } },
      { g: 'Pages', label: 'How I work', icon: 'route', run: function () { jump('how'); } },
      { g: 'Pages', label: 'Second brain', icon: 'brain', run: function () { jump('brain'); } },
      { g: 'Pages', label: 'Experience', icon: 'briefcase', run: function () { jump('experience'); } },
      { g: 'Pages', label: 'Toolbox', icon: 'spark', run: function () { jump('toolbox'); } },
      { g: 'Pages', label: 'Team', icon: 'bot', run: function () { jump('team'); } },
      { g: 'Pages', label: 'Contact', icon: 'mail', run: function () { jump('contact'); } },
      { g: 'Pages', label: 'FAQ', icon: 'quiz', run: function () { jump('faq'); } }
    ].filter(Boolean);
    projects().forEach(function (p) {
      list.push({ g: 'Projects', label: p.name, hint: p.visibility === 'public' ? '' : 'private', icon: p.icon || 'glyph', img: p.icon_img || '', run: function (o) {
        if (p.visibility === 'public') openProject(p.id, o); else { filter = 'all'; renderProjects(); jump('lab-' + p.id); }
      } });
    });
    return list;
  }
  /* Content search: every node on every tab (projects, roles, tools, skills, team…). Only the innermost
     matching node is listed, with a short snippet around the match. */
  function goToHit(n, tab) {
    showTab(tab, { keepScroll: true });
    requestAnimationFrame(function () {
      var x = n.closest('.xnode');
      if (x && !x.classList.contains('open')) { var xb = $('.xbtn', x); if (xb) xb.click(); }
      n.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
      n.classList.add('search-hit'); setTimeout(function () { n.classList.remove('search-hit'); }, 1600);
    });
  }
  function contentHits(q) {
    if (q.length < 2) return [];
    var names = {}, hits = [];
    $$('#tabnav a[data-tab]').forEach(function (a) { names[a.dataset.tab] = a.textContent.trim(); });
    $$('.tabpanel [data-step]').forEach(function (n) {
      var parts = [], w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT), t;
      while ((t = w.nextNode())) if (!t.parentElement.closest('.pit-hint, .ball-tip, .yard-hint')) parts.push(t.nodeValue);
      var txt = parts.join(' ').replace(/\s+/g, ' ').replace(/ ([.,:;!?])/g, '$1').trim(), at = txt.toLowerCase().indexOf(q);
      if (at < 0) return;
      if ($$('[data-step]', n).some(function (c) { return (c.textContent || '').toLowerCase().indexOf(q) >= 0; })) return;
      var tab = n.closest('.tabpanel').dataset.tab, s = Math.max(0, at - 24), e = Math.min(txt.length, at + q.length + 48);
      hits.push({ g: 'On the site', label: n.dataset.step, hint: names[tab] || '', icon: 'search', run: function () { goToHit(n, tab); },
        snip: [(s ? '…' : '') + txt.slice(s, at), txt.slice(at, at + q.length), txt.slice(at + q.length, e) + (e < txt.length ? '…' : '')] });
    });
    return hits.slice(0, 15);
  }
  function searchMatch(q) { return palCommands().filter(function (c) { return !q || c.label.toLowerCase().indexOf(q) >= 0; }).concat(contentHits(q)); }
  function itemsHTML(items, sel, pre) {
    var html = '', lastG = '';
    items.forEach(function (c, i) {
      if (c.g !== lastG) { html += '<li class="pal-group" role="presentation">' + c.g + '</li>'; lastG = c.g; }
      html += '<li class="pal-item" role="option" id="' + pre + i + '" data-i="' + i + '" aria-selected="' + (i === sel) + '">' + (c.img ? '<img class="pimg pimg-s" src="' + esc(c.img) + '" alt="" width="20" height="20">' : ic(c.icon)) + (c.snip ? '<span class="pal-txt"><span>' + esc(c.label) + '</span><em>' + esc(c.snip[0]) + '<mark>' + esc(c.snip[1]) + '</mark>' + esc(c.snip[2]) + '</em></span>' : '<span>' + esc(c.label) + '</span>') + (c.hint ? '<small>' + c.hint + '</small>' : '') + '</li>';
    });
    return html;
  }
  function renderPal() {
    var q = palInput.value.trim().toLowerCase();
    palItems = searchMatch(q);
    if (palIdx >= palItems.length) palIdx = 0;
    var html = itemsHTML(palItems, palIdx, 'pal-');
    palList.innerHTML = html || '<li class="pal-empty" role="presentation">Nothing matches.</li>';
    palInput.setAttribute('aria-activedescendant', palItems.length ? 'pal-' + palIdx : '');
  }
  function palSelect(i) {
    palIdx = Math.max(0, Math.min(palItems.length - 1, i));
    $$('.pal-item', palList).forEach(function (el) { el.setAttribute('aria-selected', String(+el.dataset.i === palIdx)); });
    var el = document.getElementById('pal-' + palIdx);
    palInput.setAttribute('aria-activedescendant', el ? el.id : '');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }
  var palOpener = null;
  function openPal() {
    if ($$('dialog[open]').some(function (d) { return d !== pal; })) return;
    palOpener = document.activeElement; palInput.value = ''; palIdx = 0; renderPal();
    palInput.placeholder = 'Type a command, a project or a skill'; $('.pal-search use').setAttribute('href', '#i-cmd');
    openDlg(pal, palOpener); palInput.focus();
  }
  function runPal(i) {
    var c = palItems[i]; if (!c) return;
    pal.close();
    setTimeout(function () { c.run(palOpener); }, 20);
  }
  palInput.addEventListener('input', function () { palIdx = 0; renderPal(); });
  palInput.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); palSelect(palIdx + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); palSelect(palIdx - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); runPal(palIdx); }
  });
  palList.addEventListener('click', function (e) { var li = e.target.closest('.pal-item'); if (li) runPal(+li.dataset.i); });
  palList.addEventListener('mousemove', function (e) { var li = e.target.closest('.pal-item'); if (li && +li.dataset.i !== palIdx) palSelect(+li.dataset.i); });
  $('#btn-cmdk').addEventListener('click', openPal);
  /* ---------- phone quick search: a small box slides out of the search icon; suggestions only once you type ---------- */
  (function () {
    var btn = $('#btn-search'), box = $('#m-sbox'), inp = $('#m-sinput'), list = $('#m-sresults');
    if (!btn || !box || !inp || !list) return;
    var items = [], idx = 0;
    function isOpen() { return root.classList.contains('msearch-open'); }
    function render() {
      var q = inp.value.trim().toLowerCase();
      if (!q) { list.hidden = true; list.innerHTML = ''; inp.setAttribute('aria-expanded', 'false'); return; }
      items = searchMatch(q).slice(0, 14); idx = 0;
      list.innerHTML = itemsHTML(items, idx, 'ms-') || '<li class="pal-empty" role="presentation">Nothing matches.</li>';
      list.hidden = false; inp.setAttribute('aria-expanded', 'true');
      inp.setAttribute('aria-activedescendant', items.length ? 'ms-0' : '');
    }
    function open() {
      if (root.classList.contains('nav-open') && $('#btn-menu')) $('#btn-menu').click();
      root.classList.add('msearch-open'); inp.tabIndex = 0; btn.setAttribute('aria-expanded', 'true');
      inp.focus({ preventScroll: true }); render();
    }
    function close(keepText) {
      root.classList.remove('msearch-open'); inp.tabIndex = -1; btn.setAttribute('aria-expanded', 'false');
      if (!keepText) inp.value = ''; list.hidden = true; list.innerHTML = ''; inp.blur();
    }
    function pick(i) { var c = items[i]; if (!c) return; close(); setTimeout(function () { c.run(btn); }, 30); }
    btn.addEventListener('click', function () { if (isOpen()) close(); else window.__QS.open(); });
    var x = $('#m-sclose'); if (x) x.addEventListener('click', function () { close(); btn.focus({ preventScroll: true }); });
    inp.addEventListener('input', render);
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); btn.focus(); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(idx); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); if (!items.length) return;
        idx = (idx + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
        $$('.pal-item', list).forEach(function (el) { el.setAttribute('aria-selected', String(+el.dataset.i === idx)); });
        inp.setAttribute('aria-activedescendant', 'ms-' + idx); var el = document.getElementById('ms-' + idx); if (el) el.scrollIntoView({ block: 'nearest' });
      }
    });
    list.addEventListener('click', function (e) { var li = e.target.closest('.pal-item'); if (li) pick(+li.dataset.i); });
    document.addEventListener('pointerdown', function (e) { if (isOpen() && !e.target.closest('#m-sbox, #m-sresults, #btn-search')) close(); }, true);
    window.__QS = { open: open, close: close, isOpen: isOpen };
    var deskMQ = window.matchMedia('(min-width: 960px)'), home = btn.parentNode, anchor = btn.nextSibling;
    function place() {
      if (deskMQ.matches) [box, list, btn].forEach(function (el) { document.body.appendChild(el); });
      else { home.insertBefore(btn, anchor); home.insertBefore(list, btn); home.insertBefore(box, list); }
    }
    place(); deskMQ.addEventListener('change', function () { close(); place(); });
    var _open = open; open = function () { if (deskMQ.matches && window.pageYOffset > 10) window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); _open(); };
    window.__QS.open = open;
  })();
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key || '').toLowerCase() === 'k') {
      e.preventDefault();
      if (pal.open) { closeDlg(pal); return; }
      if (window.__QS) { if (window.__QS.isOpen()) window.__QS.close(); else window.__QS.open(); } else openPal();
    }
  });

  /* ---------- click feel: soft synthesized sounds + a small press-pop ---------- */
  var Feel = (function () {
    var ctx = null, on = true, SEL = '.btn, .icon-btn, .tile, .live-item, .toplinks a, .toplinks .tl-act, .chip, .card-btn, .bulb, .xbtn, .pal-item, .pause, .tag.btn, .org-more, .orgn';
    try { on = localStorage.getItem('jb-sound') !== 'off'; } catch (e) {}
    function ensure() {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
        try { ctx = new AC(); } catch (e) { return null; }
      }
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
      return ctx;
    }
    function tone(c, t, f0, f1, dur, gain) {
      var o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
    }
    function play(kind) {
      if (!on) return;
      var c = ensure(); if (!c) return; var t = c.currentTime;
      if (kind === 'confirm') { tone(c, t, 620, 540, 0.09, 0.05); tone(c, t + 0.07, 930, 820, 0.12, 0.045); }
      else if (kind === 'soft') tone(c, t, 440, 330, 0.06, 0.035);
      else if (kind === 'mew') { tone(c, t, 640, 980, 0.12, 0.05); tone(c, t + 0.1, 980, 520, 0.2, 0.05); }
      else tone(c, t, 560, 280, 0.06, 0.055);
    }
    function kindOf(el) {
      if (el.matches('.btn-accent, .btn-run, #btn-run, #btn-run-tab, .tab-run')) return 'confirm';
      if (el.matches('.toplinks a, .tl-act, .chip, .pal-item')) return 'soft';
      return 'tick';
    }
    document.addEventListener('pointerdown', function (e) {
      var t = e.target.closest && e.target.closest(SEL); if (!t || t.disabled || t.closest('.modal-game')) return;
      play(kindOf(t));
    }, true);
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest(SEL); if (!t || t.disabled || reduced() || paused) return;
      t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop');
      setTimeout(function () { t.classList.remove('pop'); }, 340);
    }, true);
    /* hover: a light key tick (picker option A at volume 15), far quieter than the click, only for a real mouse */
    var noiseBuf = null, hoverEl = null, lastHover = 0;
    function noise(c) {
      if (noiseBuf) return noiseBuf;
      var n = Math.floor(c.sampleRate * 0.2), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      return (noiseBuf = b);
    }
    function lightTick() {
      if (!on || !ctx || ctx.state !== 'running') return;   /* browsers only allow sound after the first click or key press */
      var c = ctx, t = c.currentTime + 0.003, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = noise(c); f.type = 'highpass'; f.frequency.value = 3800; f.Q.value = 0.7;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.026, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);
      s.connect(f); f.connect(g); g.connect(c.destination); s.start(t, Math.random() * 0.05); s.stop(t + 0.04);
      tone(c, t, 150, 82, 0.03, 0.012);
    }
    var HSEL = SEL + ', .pet-cat';
    document.addEventListener('pointerover', function (e) {
      if (e.pointerType === 'touch') return;
      var t = e.target.closest && e.target.closest(HSEL);
      if (!t || t.disabled || t.closest('.modal-game')) { hoverEl = null; return; }
      if (t === hoverEl) return;
      hoverEl = t;
      var now = performance.now(); if (now - lastHover < 70) return; lastHover = now;
      lightTick();
    }, true);
    var btn = $('#btn-sound');
    function ui() {
      if (!btn) return;
      btn.setAttribute('aria-pressed', String(!on)); btn.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on'); btn.title = on ? 'Sound on' : 'Sound off';
      $('use', btn).setAttribute('href', on ? '#i-volume' : '#i-mute');
    }
    if (btn) btn.addEventListener('click', function () {
      on = !on; try { localStorage.setItem('jb-sound', on ? 'on' : 'off'); } catch (e) {}
      ui(); if (on) play('confirm');
    });
    function clack(v) {
      if (!on) return; var c = ensure(); if (!c || c.state !== 'running') return;
      var t = c.currentTime + 0.002, amp = Math.min(0.2, 0.035 + v * 0.00011), src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = noise(c); f.type = 'bandpass'; f.frequency.value = 2400 + Math.random() * 900; f.Q.value = 2.4;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.0015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(f); f.connect(g); g.connect(c.destination); src.start(t, Math.random() * 0.1); src.stop(t + 0.07);
      tone(c, t, 1900 + Math.random() * 300, 1300, 0.035, amp * 0.45);
    }
    ui();
    window.__JBFeel = { clack: clack, prime: function () { if (on) ensure(); } };
    return { play: play, clack: clack };
  })();

  /* ---------- phones: pull down from the top to refresh; the pixel cat walks while it loads ---------- */
  (function () {
    var el = $('#ptr'), cat = el && $('.ptr-cat', el), txt = el && $('.ptr-txt', el), mainEl = $('#main');
    if (!el || !cat || !txt) return;
    var mq = window.matchMedia('(max-width: 959px)'), TH = 78, MAX = 130, y0 = 0, x0 = 0, dist = 0, pulling = false, armed = false, busy = false, fi = 0, walkT = 0;
    var FR = ['walk1', 'walk2', 'walk3', 'walk4'];
    FR.forEach(function (n) { var i = new Image(); i.src = 'assets/cat/' + n + '.webp'; });
    var NO = '.pit, .yard, #brain-stage, dialog, .m-sbox, .m-sresults, input, textarea, .walker, .ball';
    function canStart(t) {
      return mq.matches && !busy && window.pageYOffset <= 0 && !root.classList.contains('nav-open') && !root.classList.contains('msearch-open') &&
        !document.querySelector('dialog[open]') && !(t && t.closest && t.closest(NO));
    }
    function step() { fi = (fi + 1) % FR.length; cat.src = 'assets/cat/' + FR[fi] + '.webp'; }
    function show(d) {
      var p = Math.min(1, d / TH);
      el.style.transform = 'translateY(' + (d - 70) + 'px)'; el.style.opacity = String(Math.min(1, d / 40));
      if (mainEl) mainEl.style.transform = 'translateY(' + (d * .55) + 'px)';
      cat.style.transform = 'translateX(' + ((p - .5) * 40).toFixed(1) + 'px)';
      var arm = d >= TH; if (arm !== armed) { armed = arm; txt.textContent = arm ? 'Release to refresh' : 'Pull to refresh'; el.classList.toggle('armed', arm); }
    }
    function reset(animated) {
      el.classList.toggle('anim', !!animated); if (mainEl) mainEl.classList.toggle('ptr-anim', !!animated);
      el.style.transform = ''; el.style.opacity = ''; cat.style.transform = ''; if (mainEl) mainEl.style.transform = '';
      armed = false; el.classList.remove('armed', 'loading'); txt.textContent = 'Pull to refresh';
      setTimeout(function () { el.classList.remove('anim'); if (mainEl) mainEl.classList.remove('ptr-anim'); }, 320);
    }
    document.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1 || !canStart(e.target)) { pulling = false; return; }
      y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dist = 0; pulling = true; walkT = 0;
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!pulling) return;
      var dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
      if (dist === 0 && (dy <= 0 || Math.abs(dx) > Math.abs(dy))) { pulling = false; return; }
      if (window.pageYOffset > 0) { pulling = false; reset(true); return; }
      e.preventDefault();
      dist = Math.min(MAX, dy * .55);
      var now = performance.now(); if (now - walkT > 110) { walkT = now; step(); }
      show(dist);
    }, { passive: false });
    function end() {
      if (!pulling) return; pulling = false;
      if (dist >= TH) {
        busy = true; el.classList.add('loading', 'anim'); txt.textContent = 'Refreshing…';
        if (mainEl) { mainEl.classList.add('ptr-anim'); mainEl.style.transform = 'translateY(' + (TH * .55) + 'px)'; }
        el.style.transform = 'translateY(' + (TH - 70) + 'px)'; el.style.opacity = '1';
        var t = setInterval(step, 120), x = -20; var mv = setInterval(function () { x += 4; if (x > 20) x = -20; cat.style.transform = 'translateX(' + x + 'px)'; }, 120);
        setTimeout(function () { clearInterval(t); clearInterval(mv); location.reload(); }, 1100);
      } else reset(true);
      dist = 0;
    }
    document.addEventListener('touchend', end, { passive: true });
    document.addEventListener('touchcancel', function () { if (pulling) { pulling = false; dist = 0; reset(true); } }, { passive: true });
  })();

  /* ---------- phones: on Contact a pixel cat strolls in the bottom strip, stopping now and then ---------- */
  window.__CatBar = (function () {
    var bar = $('#catbar'), img = bar && $('img', bar); if (!bar || !img) return null;
    var W = { walk: ['walk1', 'walk2', 'walk3', 'walk4'], sit: ['sit1', 'sit2'], lick: ['lick1', 'lick2'] }, raf = 0, last = 0;
    var C = { x: 40, dir: 1, mode: 'sit', fi: 0, next: 0, until: 0, target: 0 };
    Object.keys(W).forEach(function (k) { W[k].forEach(function (n) { var i = new Image(); i.src = 'assets/cat/' + n + '.webp'; }); });
    var mq = window.matchMedia('(max-width: 959px)');
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function on() { return mq.matches && root.classList.contains('on-contact') && !document.hidden; }
    function setMode(m, t) { C.mode = m; C.fi = 0; C.until = performance.now() + t; C.next = 0; if (m === 'walk') { var w = bar.clientWidth - img.offsetWidth; C.target = rnd(0, Math.max(0, w)); C.dir = C.target > C.x ? 1 : -1; } }
    function frame(now) {
      raf = 0; if (!on()) return;
      var dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
      if (C.mode === 'walk') {
        var step = 46 * dt * C.dir; C.x += step;
        if ((C.dir > 0 && C.x >= C.target) || (C.dir < 0 && C.x <= C.target)) { C.x = C.target; setMode(Math.random() < .3 ? 'lick' : 'sit', rnd(1800, 4200)); }
      } else if (now > C.until) setMode('walk', 0);
      if (now > C.next) {
        var fr = W[C.mode]; C.fi = (C.fi + 1) % fr.length; img.src = 'assets/cat/' + fr[C.fi] + '.webp';
        img.className = 'catbar-cat m-' + C.mode; C.next = now + (C.mode === 'walk' ? 140 : C.mode === 'lick' ? 380 : (C.fi ? 180 : rnd(1400, 2600)));
      }
      img.style.transform = 'translateX(' + C.x.toFixed(1) + 'px)' + (C.dir < 0 ? ' scaleX(-1)' : '');
      raf = requestAnimationFrame(frame);
    }
    function sync() { if (on() && !raf) { last = 0; if (reduced()) { setMode('sit', 1e9); img.style.transform = 'translateX(' + C.x + 'px)'; return; } raf = requestAnimationFrame(frame); } }
    document.addEventListener('visibilitychange', sync);
    return { sync: sync };
  })();

  /* ---------- Demi, the pixel cat that lives next to the portrait ---------- */
  var Pet = (function () {
    var root = $('#pet'); if (!root) return {};
    var btn = $('.pet-cat', root), img = $('img', btn);
    var BASE = 'assets/cat/';
    var DEF = {
      sit: { f: ['sit1', 'sit2'], w: 148 }, lick: { f: ['lick1', 'lick2'], w: 141 }, meow: { f: ['meow1', 'meow2'], w: 150 },
      sleep: { f: ['sleep1', 'sleep2'], w: 224 }, walk: { f: ['walk1', 'walk2', 'walk3', 'walk4'], w: 279 }
    };
    var seen = {};
    Object.keys(DEF).forEach(function (k) { DEF[k].f.forEach(function (n) { var i = new Image(); i.src = BASE + n + '.webp'; seen[n] = i; }); });
    var S = { mode: 'sit', fi: 0, x: -1, dir: 1, target: 0, until: 0, nextFrame: 0, blinkAt: 0, running: false, timer: 0, visible: true, lights: true };

    function now() { return performance.now(); }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function W() { return root.clientWidth; }
    function pxPer() { return Math.max(W() * 0.00085, 0.28); }   /* css px of one native sprite pixel */
    function range() {
      var w = W(), half = DEF.walk.w * pxPer() / 2, rl = root.getBoundingClientRect().left, vw = document.documentElement.clientWidth;
      var lo = Math.max(w * 0.62, half + 2), hi = Math.min(w * 0.97 - half * 0.2, vw - 6 - rl - half);
      if (hi < lo + 24) hi = lo + 24;
      return [lo, hi];
    }
    function show(name) { if (img.getAttribute('data-n') !== name) { img.src = BASE + name + '.webp'; img.setAttribute('data-n', name); } }
    function place() {
      var r = range(); if (S.x < 0) S.x = r[0] + (r[1] - r[0]) * 0.22;
      S.x = Math.max(r[0], Math.min(r[1], S.x));
      btn.style.left = S.x + 'px'; btn.style.setProperty('--w', DEF[S.mode].w);
      img.style.transform = S.dir < 0 ? 'scaleX(-1)' : '';
    }
    function setMode(m, dur) {
      S.mode = m; S.fi = 0; S.until = now() + (dur || 3000); S.nextFrame = 0;
      root.classList.toggle('is-asleep', m === 'sleep');
      if (m === 'walk') {
        var r = range(), span = r[1] - r[0], to;
        do { to = r[0] + Math.random() * span; } while (Math.abs(to - S.x) < span * 0.25);
        S.target = to; S.dir = to > S.x ? 1 : -1; S.until = now() + 20000;
      } else if (m === 'sit' && Math.random() < 0.5) S.dir = Math.random() < 0.5 ? 1 : -1;
      show(DEF[m].f[0]); place();
    }
    function nextMode() {
      if (!S.lights) { setMode('sleep', 60000); return; }
      var pool = [['walk', 6], ['lick', 2], ['meow', 2], ['sleep', 1], ['sit', 1]].filter(function (p) { return p[0] !== S.mode || p[0] === 'sit'; });
      if (S.mode !== 'sit') pool = [['sit', 2]].concat(pool.filter(function (p) { return p[0] !== 'sit'; }));
      var tot = pool.reduce(function (a, p) { return a + p[1]; }, 0), r = Math.random() * tot, pick = pool[0][0];
      for (var i = 0; i < pool.length; i++) { r -= pool[i][1]; if (r <= 0) { pick = pool[i][0]; break; } }
      var dur = { sit: rnd(1800, 3500), lick: rnd(3200, 4800), meow: rnd(2200, 3200), sleep: rnd(8000, 12000), walk: 20000 }[pick];
      setMode(pick, dur);
    }
    var last = 0;
    function tick() {
      var t = now(), dt = Math.min(120, t - (last || t)); last = t;
      if (paused || reduced()) { show(S.lights ? 'sit1' : 'sleep1'); return; }
      var d = DEF[S.mode];
      if (S.mode === 'walk') {
        var sp = pxPer() * 70 * (dt / 1000), dx = S.target - S.x;
        if (Math.abs(dx) <= sp) { S.x = S.target; nextMode(); return; }
        S.x += Math.sign(dx) * sp; S.dir = dx > 0 ? 1 : -1;
        if (t >= S.nextFrame) { S.fi = (S.fi + 1) % d.f.length; show(d.f[S.fi]); S.nextFrame = t + 150; }
        place(); return;
      }
      if (t >= S.until) { nextMode(); return; }
      if (S.mode === 'sit') {
        if (t >= S.blinkAt) { show('sit2'); S.blinkAt = t + rnd(2200, 4200); S.nextFrame = t + 170; }
        else if (S.nextFrame && t >= S.nextFrame) { show('sit1'); S.nextFrame = 0; }
      } else if (t >= S.nextFrame) {
        S.fi = (S.fi + 1) % d.f.length; show(d.f[S.fi]);
        S.nextFrame = t + (S.mode === 'sleep' ? 1300 : S.mode === 'meow' ? 440 : 400);
      }
    }
    function loop() { if (S.timer) return; S.timer = setInterval(function () { if (S.visible && !document.hidden) tick(); }, 70); }
    function wake() { loop(); }

    btn.addEventListener('click', function () {
      if (!S.lights) return;
      setMode('meow', 2600); Feel.play('mew');
      btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); setTimeout(function () { btn.classList.remove('pop'); }, 340);
    });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { S.visible = en[0].isIntersecting; }).observe(root);
    if ('MutationObserver' in window) new MutationObserver(function () {
      var on = !document.documentElement.classList.contains('lights-off');
      if (on === S.lights) return; S.lights = on;
      if (!on) setMode('sleep', 600000); else setMode('sit', 2500);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', place);
    if ('ResizeObserver' in window) new ResizeObserver(place).observe(root);
    place(); S.blinkAt = now() + 2500; setMode('sit', 3000); loop();
    return { wake: wake };
  })();

  /* ---------- go ---------- */
  renderAll();
  setTimeout(applyFit, 60); setTimeout(applyFit, 600);
  (function () { var id = location.hash.slice(1), t = tabOf(id); if (t && t !== 'home') { showTab(t, { force: true, noHash: true, keepScroll: true }); if (id !== t && document.getElementById(id)) setTimeout(function () { jump(id); }, 60); } })();
  intro($('.tabpanel.on'));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutAll);
  window.addEventListener('load', layoutAll);
  if ('ResizeObserver' in window) { var ro = new ResizeObserver(layoutAll); ro.observe(document.body); }
  else window.addEventListener('resize', layoutAll);
  Run.ui();
  document.addEventListener('jb-brain-count', setChips);

  /* refresh from the editable JSON if it can be reached (skipped silently in a sandbox / file://) */
  if (window.fetch && location.protocol !== 'file:') {
    Promise.all(['data/projects.json', 'data/profile.json'].map(function (u) {
      return fetch(u, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    })).then(function (res) {
      var p = res[0], q = res[1];
      if (!p || !q || !Array.isArray(p.projects) || !Array.isArray(q.experience)) return;
      if (JSON.stringify(p) !== JSON.stringify(DATA.projects) || JSON.stringify(q) !== JSON.stringify(DATA.profile)) { DATA.projects = p; DATA.profile = q; renderAll(); }
    }).catch(noop);
  }
})();

/* Phones: hide the top and bottom bars while scrolling down, show them again on any scroll up (2026-11-24) */
(function () {
  var root = document.documentElement, mq = window.matchMedia('(max-width: 959px)'), lastY = window.pageYOffset, acc = 0, backT = 0;
  function show() {
    if (!root.classList.contains('bars-hide')) return;
    root.classList.remove('bars-hide'); root.classList.add('bars-back');
    clearTimeout(backT); backT = setTimeout(function () { root.classList.remove('bars-back'); }, 600);
  }
  window.addEventListener('scroll', function () {
    var y = window.pageYOffset, dy = y - lastY; lastY = y;
    if (!mq.matches || root.classList.contains('nav-open') || root.classList.contains('modal-lock') || document.querySelector('.m-search.open, .m-sbox.open')) { show(); acc = 0; return; }
    if (y < 60) { show(); acc = 0; return; }
    acc = (acc > 0) === (dy > 0) ? acc + dy : dy;   /* add up movement in one direction, so tiny jitters do nothing */
    if (acc > 24) root.classList.add('bars-hide');
    else if (acc < -12) show();
  }, { passive: true });
  mq.addEventListener && mq.addEventListener('change', show);
})();
