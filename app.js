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
      (it.use ? '<div><h3 class="dt-h">What I use it for</h3><p>' + esc(it.use) + '</p></div>' : '') +
      (P().toolbox_intro ? '<p class="dt-note">' + esc(P().toolbox_intro) + '</p>' : '');
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
        return '<button class="walker" type="button" data-agent="' + esc(id) + '" aria-label="' + esc(a.name) + ': ' + esc(a.role) + '"><span class="wk-body">' +
          '<img class="wk-top" src="' + src + '" alt="" draggable="false" decoding="async"><img class="wk-leg wk-l" src="' + src + '" alt="" draggable="false" decoding="async"><img class="wk-leg wk-r" src="' + src + '" alt="" draggable="false" decoding="async">' +
          '<span class="wk-side"><img class="wk-s1" src="assets/team/' + key + '-side1.webp" alt="" draggable="false" decoding="async"><img class="wk-s2" src="assets/team/' + key + '-side2.webp" alt="" draggable="false" decoding="async"></span>' +
          '</span><i class="wk-shadow" aria-hidden="true"></i></button>';
      }).join('') + '</div></div>' +
      '<div class="org" id="org"><svg class="org-wires" aria-hidden="true"></svg><span class="peer-tag mono" hidden>peer</span>' +
      '<div class="org-row org-r0">' + orgNode(T.joe, 'joe') + '</div>' +
      '<div class="org-row org-r1"><div class="org-c2">' + orgNode(T.raphael, 'raphael') + '</div><div class="org-c3">' + orgNode(T.jarvis, 'jarvis') + '</div></div>' +
      '<div class="org-row org-r2">' + orgNode(levi, 'levi') + '</div>' +
      '<div class="org-row org-r3">' + depts.map(function (a) { var id = a.name.toLowerCase(); return '<div class="dept"><span class="dept-label mono">' + esc(a.dept) + '</span>' + orgNode(a, id) + '</div>'; }).join('') + '</div></div></div>';
    tb.innerHTML = ht;
    Yard.init($('#yard'));
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
     then wander off again. Anyone walking yields to whoever is in their way instead of bumping into them. */
  var Yard = (function () {
    var box = null, ws = [], raf = 0, last = 0, seen = false, io = null, GAP = 66;
    function fitYard() {
      if (!box) return;
      if (root.classList.contains('fit-tab')) { var h = Math.max(170, fitSpace(box, 6)); box.style.height = h + 'px'; box.classList.toggle('compact', h < 330); }
      else { box.style.height = ''; box.classList.remove('compact'); }
      var w0 = ws[0]; if (w0 && w0.el.offsetWidth) { SX = w0.el.offsetWidth + 2; SY = Math.round(w0.el.offsetHeight * .85); GAP = SX + 4; }
    }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function W() { return box.clientWidth; }
    function H() { return box.clientHeight; }
    function bw(w) { return w.el.offsetWidth || 64; }
    function bh(w) { return w.el.offsetHeight || 80; }
    function clampX(w, x) { return Math.max(0, Math.min(W() - bw(w), x)); }
    function clampY(w, y) { return Math.max(6, Math.min(H() - bh(w) - 2, y)); }
    function place(w) { w.el.style.transform = 'translate(' + w.x.toFixed(1) + 'px,' + w.y.toFixed(1) + 'px)'; w.el.style.zIndex = Math.round(w.y) + 10; }
    function face(w, dir) { w.el.classList.toggle('face-l', dir < 0); w.el.classList.toggle('face-r', dir > 0); }
    function setState(w, st) {
      w.st = st; w.el.classList.toggle('walking', st === 'walk'); w.el.classList.toggle('talking', st === 'chat');
      if (st !== 'walk' && st !== 'chat') { face(w, 0); w.el.classList.remove('side'); }
      if (st === 'chat') w.el.classList.add('side');
    }
    function free(o) { return o.st === 'idle' && !o.host && !o.friend; }
    var SX = 62, SY = 72;   /* personal space: nobody stands or walks inside this box around someone else (re-measured in fitYard) */
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
    function plan(w) {
      w.friend = null; w.blocked = 0; w.via = null; w.detours = 0;
      var pals = ws.filter(function (o) { return o !== w && free(o); });
      if (pals.length && Math.random() < .7) {
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
    function release(w) { if (w.friend) { w.friend.host = null; if (w.friend.st === 'idle') w.friend.wait = rnd(.4, 1.5); w.friend = null; } }
    function blockedBy(w, dx, dy, d) {
      var ux = dx / d, uy = dy / d;
      for (var i = 0; i < ws.length; i++) {
        var o = ws[i]; if (o === w) continue;   /* includes the friend: never walk through them to reach their far side */
        var ox = o.x - w.x, oy = o.y - w.y;
        if (Math.abs(ox) < SX && Math.abs(oy) < SY && ox * ux + oy * uy > 0) return o;
      }
      return null;
    }
    function running() { return box && seen && !document.hidden && !reduced() && !root.hasAttribute('data-paused') && box.offsetParent && !box.closest('.org-on'); }
    function frame(now) {
      raf = 0; if (!running()) return;
      var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      ws.forEach(function (w) {
        if (w.st === 'chat') {
          w.wait -= dt;
          if (w.wait <= 0) { var f = w.friend; release(w); setState(w, 'idle'); w.wait = rnd(.2, .8); if (f && f.st === 'chat') { f.friend = null; setState(f, 'idle'); f.wait = rnd(1.2, 2.6); } }
          return;
        }
        if (w.st === 'idle') { if (!w.host) { w.wait -= dt; if (w.wait <= 0) plan(w); } return; }
        /* walking */
        if (w.friend && w.friend.st === 'walk') { release(w); spot(w); }
        if (w.via) {   /* stepping around someone: walk to the side point first */
          var vx = w.via.x - w.x, vy = w.via.y - w.y, vd = Math.hypot(vx, vy);
          if (vd < 1.5) w.via = null;
          else {
            if (blockedBy(w, vx, vy, vd)) { w.via = null; w.blocked = 1.3; }
            else { var vs = Math.min(vd, w.speed * dt); w.x += vx / vd * vs; w.y += vy / vd * vs; if (Math.abs(vx) > 1) face(w, vx); w.el.classList.toggle('side', Math.abs(vx) > Math.abs(vy) * .7); w.el.classList.add('walking'); place(w); return; }
          }
        }
        var dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy);
        if (d < 1.5) {
          var f = w.friend;
          if (f) {
            setState(w, 'chat'); setState(f, 'chat'); f.friend = w; f.host = null;
            w.wait = f.wait = rnd(2.6, 5); face(w, f.x - w.x); face(f, w.x - f.x);
          } else { setState(w, 'idle'); w.wait = rnd(.8, 2.6); }
          return;
        }
        var ob = blockedBy(w, dx, dy, d);
        if (ob) {   /* someone is in the way: pause, then step around them; if that fails twice, choose somewhere else */
          w.blocked += dt; w.el.classList.remove('walking');
          if (w.blocked > 0.6 && w.detours < 2) {
            var up = w.y > ob.y ? 1 : -1, vy2 = clampY(w, ob.y + up * (SY + 8));
            if (Math.abs(vy2 - ob.y) < SY) vy2 = clampY(w, ob.y - up * (SY + 8));
            var vx2 = clampX(w, w.x + Math.sign(dx || 1) * 30);
            if (Math.abs(vy2 - ob.y) >= SY && !taken(w, vx2, vy2, w.friend)) { w.via = { x: vx2, y: vy2 }; w.detours++; w.blocked = 0; }
          }
          if (w.blocked > 1.4) { release(w); spot(w); w.blocked = 0; w.detours = 0; w.via = null; }
          return;
        }
        w.blocked = 0; w.el.classList.add('walking');
        var step = Math.min(d, w.speed * dt); w.x += dx / d * step; w.y += dy / d * step;
        if (Math.abs(dx) > 1) face(w, dx);
        w.el.classList.toggle('side', Math.abs(dx) > Math.abs(dy) * .7);   /* profile when mostly sideways, front view when walking up/down */
        place(w);
      });
      raf = requestAnimationFrame(frame);
    }
    function wake() { if (!raf && running()) { last = 0; raf = requestAnimationFrame(frame); } }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; ws.forEach(function (w) { w.el.classList.remove('walking', 'talking'); }); }
    function scatter() {
      var n = ws.length, cols = Math.max(2, Math.round(Math.sqrt(n * W() / Math.max(1, H())))), rows = Math.ceil(n / cols);
      ws.forEach(function (w, i) {
        var c = i % cols, r = Math.floor(i / cols);
        w.x = clampX(w, (c + .5) * W() / cols - bw(w) / 2 + rnd(-10, 10));
        w.y = clampY(w, (r + .5) * H() / rows - bh(w) / 2 + rnd(-8, 8));
        w.friend = w.host = null; setState(w, 'idle'); w.wait = rnd(.3, 3); place(w);
      });
    }
    function init(el) {
      stop(); box = el; if (!box) return;
      ws = $$('.walker', box).map(function (b) { return { el: b, x: 0, y: 0, tx: 0, ty: 0, wait: 0, speed: 36, st: 'idle', friend: null, host: null, blocked: 0 }; });
      if (io) io.disconnect();
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(function (es) { seen = es[0].isIntersecting; if (seen) { if (!box.dataset.placed) { box.dataset.placed = '1'; fitYard(); scatter(); } wake(); } else stop(); });
        io.observe(box);
      } else { seen = true; scatter(); wake(); }
    }
    document.addEventListener('visibilitychange', wake);
    function refit() { if (box && box.offsetParent) { fitYard(); scatter(); wake(); } }
    window.addEventListener('resize', refit);
    new MutationObserver(wake).observe(root, { attributes: true, attributeFilter: ['data-paused'] });
    return { init: init, wake: wake, stop: stop, refit: refit };
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
      return '<button class="live-item node" type="button" data-open="' + esc(p.id) + '">' + pic(p) + '<span><b>' + esc(p.name) + '</b><small>' + esc(p.one_liner) + '</small></span></button>';
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
    var bar = $('#runbar'), rbCount = $('#rb-count'), rbLabel = $('#rb-label'), rbPlay = $('#rb-play'), rbSpeed = $('#rb-speed');
    var runTabBtn = $('#btn-run-tab'), runTabLabel = $('#run-tab-label'), runBtn = $('#btn-run'), runLabel = $('#run-label'), runHint = $('#run-hint'), flowBtn = $('#btn-flow');
    var layer = null, svg = null, chip = null, dot = null, hideT = 0, clearT = 0, redrawQ = 0;
    var S = { state: 'idle', scope: 'page', steps: [], idx: -1, phase: 'dwell', t: 0, dwell: 4000, speed: 5, last: 0, raf: 0, wires: [], autoPaused: false };
    var SPEEDS = [1, 2, 3, 4, 5];

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
      if (bar) {
        bar.hidden = !(on || S.state === 'done');
        bar.classList.toggle('manual', isReduced);
        if (S.state === 'done') { rbCount.textContent = S.steps.length + ' / ' + S.steps.length; rbLabel.textContent = 'Workflow complete · ' + S.steps.length + ' steps'; }
        else if (on) {
          rbCount.textContent = (S.idx + 1) + ' / ' + S.steps.length;
          rbLabel.textContent = S.state === 'paused' && !isReduced ? 'Paused — Resume ▶' : (S.steps[S.idx] ? S.steps[S.idx].dataset.step : '');
        }
        var playing = S.state === 'running';
        $('use', rbPlay).setAttribute('href', playing ? '#i-pause' : '#i-play');
        rbPlay.setAttribute('aria-label', playing ? 'Pause' : 'Resume'); rbPlay.title = playing ? 'Pause (Space)' : 'Resume (Space)';
        rbSpeed.textContent = S.speed + '×';
        $('#rb-back').disabled = !on || S.idx <= 0; $('#rb-next').disabled = !on;
      }
      var pageRun = on && page, flowRun = on && !page;
      if (isReduced) {
        setRunBtn(pageRun ? 'stop' : 'play', pageRun ? 'Stop' : 'Step through the page');
        if (runHint) runHint.textContent = pageRun ? 'Next / Back in the bar below. Esc stops.' : 'Steps through every node on the page, one at a time';
        if (flowBtn) flowBtn.innerHTML = ic(flowRun ? 'stop' : 'play') + (flowRun ? 'Stop' : 'Step through this flow');
      } else {
        setRunBtn(pageRun ? 'stop' : 'play', pageRun ? 'Stop' : 'Run workflow');
        if (runHint) { if (!pageRun) runHint.textContent = S.state === 'done' && page ? 'Done. That was the whole page.' : 'Walks every node on the page. Pause, skip or stop any time.';
        else runHint.textContent = 'Step ' + (S.idx + 1) + ' of ' + S.steps.length + (S.speed !== 1 ? ' · ' + S.speed + '×' : ''); }
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
        setBar(el(), S.t / S.dwell);
        if (S.t >= S.dwell) { completeStep(); return; }
      }
      S.raf = requestAnimationFrame(frame);
    }
    function loop() { if (S.raf || S.state !== 'running' || reduced()) return; S.last = performance.now(); S.raf = requestAnimationFrame(frame); }
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
      clearTimeout(hideT); clearTimeout(clearT);
      S.scope = scope; teamOrg(scope === 'page' && curTab === 'team'); S.steps = collect(scope);
      if (!S.steps.length) return;
      S.steps.forEach(clearNode);
      S.state = 'running'; S.autoPaused = false; S.wires = []; listeners(true);
      go(0);
    }
    function stop(silent) {
      cancelAnimationFrame(S.raf); S.raf = 0; listeners(false);
      S.steps.forEach(clearNode); dropLayer(); teamOrg(false);
      S.state = 'idle'; S.idx = -1; ui();
    }
    function pause(auto) { if (S.state !== 'running') return; S.state = 'paused'; S.autoPaused = !!auto; cancelAnimationFrame(S.raf); S.raf = 0; ui(); }
    function resume() {
      if (S.state !== 'paused') return;
      S.state = 'running'; S.autoPaused = false; if (el()) scrollToStep(el()); ui(); loop();
    }
    function toggle() { if (S.state === 'running') pause(false); else if (S.state === 'paused') resume(); }
    function next() {
      if (!active()) return;
      if (S.idx >= S.steps.length - 1) { markDone(S.idx, S.t / 1000); complete(); return; }
      markDone(S.idx, S.t / 1000); go(S.idx + 1);
    }
    function back() { if (active()) go(Math.max(0, S.idx - 1)); }
    function cycleSpeed() { S.speed = SPEEDS[(SPEEDS.indexOf(S.speed) + 1) % SPEEDS.length]; ui(); }

    /* ----- auto-pause when the visitor takes over (never cancels) ----- */
    var SCROLL_KEYS = { ArrowUp: 1, ArrowDown: 1, PageUp: 1, PageDown: 1, Home: 1, End: 1 };
    function onUser(e) { if (S.state === 'running' && !reduced()) pause(true); }
    function onPointer(e) {
      if (e.target.closest && e.target.closest('#runbar, #btn-run, #btn-run-tab, #btn-flow, .tab-run')) return;
      onUser();
    }
    function onKey(e) {
      var tag = (e.target.tagName || '').toLowerCase();
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { stop(); return; }
      if ((e.key === ' ' || e.code === 'Space') && !e.ctrlKey && !e.metaKey && !e.altKey && !document.querySelector('dialog[open]') && tag !== 'input' && tag !== 'textarea' && tag !== 'button' && tag !== 'a' && tag !== 'select') {
        if (!reduced()) { e.preventDefault(); toggle(); }
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
    rbPlay.addEventListener('click', toggle); $('#rb-next').addEventListener('click', next); $('#rb-back').addEventListener('click', back);
    $('#rb-stop').addEventListener('click', function () { stop(); }); rbSpeed.addEventListener('click', cycleSpeed);
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
    var ctx = null, on = true, SEL = '.btn, .icon-btn, .tile, .live-item, .toplinks a, .toplinks .tl-act, .rb-b, .chip, .card-btn, .bulb, .xbtn, .pal-item, .pause, .tag.btn, .org-more, .orgn';
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
