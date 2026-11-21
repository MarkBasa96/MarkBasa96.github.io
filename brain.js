/* "My second brain": a live 3D graph of Joe's Obsidian vault (note names only, no contents).
   Ported from the raphael-brain-graph plugin. Lazy: data/brain.json is read once for the count,
   three.js + OrbitControls load only when the section scrolls near, rendering pauses off-screen / tab hidden / Pause motion. */
(function () {
  'use strict';
  var section = document.getElementById('brain');
  if (!section) return;
  var stageEl = document.getElementById('brain-stage');
  var countEl = document.getElementById('brain-count');
  var statusEl = document.getElementById('brain-status');
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var coarseMQ = window.matchMedia('(pointer: coarse)');
  function calm() { return reduceMQ.matches; }
  function isPaused() { return document.documentElement.hasAttribute('data-paused'); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function say(t) { if (statusEl) { statusEl.textContent = t; statusEl.hidden = !t; } }

  /* ---------- data (small, fetched once; also gives the real note count) ---------- */
  var dataP = null;
  function getData() {
    if (dataP) return dataP;
    dataP = (window.fetch ? fetch('data/brain.json').then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); }) : Promise.reject(new Error('nofetch')))
      .then(function (d) {
        if (!d || !Array.isArray(d.nodes) || !Array.isArray(d.edges)) throw new Error('shape');
        var n = d.nodes.filter(function (x) { return !x.ghost; }).length;
        window.JBBrainCount = n; try { document.dispatchEvent(new Event('jb-brain-count')); } catch (e) {}
        if (countEl) countEl.textContent = ' ' + n.toLocaleString('en-US') + ' notes and counting.';
        return d;
      });
    dataP.catch(function () { if (countEl) countEl.textContent = ''; });
    return dataP;
  }
  function idle(fn) { if (window.requestIdleCallback) requestIdleCallback(fn, { timeout: 2500 }); else setTimeout(fn, 600); }
  idle(function () { getData().catch(function () {}); });

  /* ---------- lazy script loading ---------- */
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.async = false;
      s.onload = res; s.onerror = function () { rej(new Error('load ' + src)); };
      document.head.appendChild(s);
    });
  }

  var started = false;
  function start() {
    if (started) return; started = true;
    say('Waking the brain…');
    Promise.all([getData(), loadScript('assets/brain/three.min.js').then(function () { return loadScript('assets/brain/OrbitControls.js'); })])
      .then(function (r) { try { build(r[0]); say(''); } catch (e) { say('This browser could not start the 3D view.'); if (window.console) console.warn(e); } })
      .catch(function () { say('The graph could not load here.'); });
  }
  if ('IntersectionObserver' in window) {
    var nearIO = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { nearIO.disconnect(); start(); } }, { rootMargin: '500px 0px' });
    nearIO.observe(stageEl);
  } else { start(); }

  /* ---------- the scene ---------- */
  function build(DATA) {
    var THREE = window.THREE;
    var PALETTE = ['#f2c27b', '#5fe3e0', '#9fb4ff', '#ff8a6b', '#c99bff', '#7ee8a5', '#ffd36e', '#6fb8ff', '#ff9ec7', '#b8f27b', '#7be0ff', '#e8a6ff', '#ffb36b', '#8fffd2', '#a3a8ff', '#ffe08f'];
    var colorOf = {}, nextColor = 0;
    function commColor(key) { if (key === 'core') return '#fff4dc'; if (!(key in colorOf)) colorOf[key] = PALETTE[nextColor++ % PALETTE.length]; return colorOf[key]; }
    var seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }

    /* brain geometry: two hemispheres split by a groove, wrinkled cortex, temporal lobes, cerebellum */
    function dir() { var z = rnd() * 2 - 1, a = rnd() * 6.283, r = Math.sqrt(1 - z * z); return [r * Math.cos(a), z, r * Math.sin(a)]; }
    function cortexPoint(surface) {
      for (;;) {
        var d, dx, dy, dz;
        if (rnd() < .11) { d = dir(); dx = d[0]; dy = d[1]; dz = d[2]; var s0 = surface ? .85 + rnd() * .15 : rnd(), f0 = 1 + .05 * Math.sin(dy * 40); return [dx * .5 * s0 * f0, dy * .24 * s0 * f0 - .52, dz * .3 * s0 * f0 - .68]; }
        d = dir(); dx = d[0]; dy = d[1]; dz = d[2];
        var s = surface ? (rnd() < .85 ? .94 + rnd() * .06 : .4 + rnd() * .5) : .3 + rnd() * .7;
        var th = Math.atan2(dz, dx), ph = Math.asin(dy);
        var gyri = 1 + .055 * Math.sin(th * 13 + Math.sin(ph * 7) * 2.5) * Math.sin(ph * 11 + Math.cos(th * 5));
        var x = dx * .72, y = dy * .66, z = dz * 1.02;
        if (y < -.2) y = -.2 + (y + .2) * .45;
        if (y < .02 && z > -.45 && z < .5) y -= .16 * Math.cos((z - .02) * 3.2);
        if (z > .5) y -= .08 * (z - .5) * 3;
        x *= s * gyri; y *= s * gyri; z *= s * gyri;
        if (Math.abs(x) < .045 && y > -.05 && s > .9) continue;
        x += (x < 0 ? -1 : 1) * .035;
        return [x, y, z];
      }
    }
    function stemPoint(k, n) { var t = n > 1 ? k / (n - 1) : .5, a = k * 2.4, r = .04 + .06 * rnd(); return [Math.cos(a) * r, -.42 - t * .5, Math.sin(a) * r - .3]; }

    var SCALE = 260;
    function d2(a, b) { return (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) + (a[2] - b[2]) * (a[2] - b[2]); }
    var cand = [], centers = {};
    function ensureFree(n) { var free = 0; cand.forEach(function (c) { if (!c.used) free++; }); while (free < n + 10) { cand.push({ p: cortexPoint(true), used: false }); free++; } }
    function newCenter() {
      var cs = Object.keys(centers).map(function (k) { return centers[k]; }), best = null, bd = -1;
      cand.forEach(function (c) { if (c.used) return; var m = cs.length ? Infinity : rnd(); cs.forEach(function (q) { m = Math.min(m, d2(c.p, q)); }); if (m > bd) { bd = m; best = c; } });
      return best.p;
    }
    function nearestFree(center) { var best = null, bd = Infinity; cand.forEach(function (c) { if (c.used) return; var d = d2(c.p, center); if (d < bd) { bd = d; best = c; } }); best.used = true; return best; }

    var COMM = DATA.comms.map(function (c) { return { key: c.key, label: c.label, c: commColor(c.key), members: [] }; });
    var comIndex = {}; COMM.forEach(function (c, i) { comIndex[c.key] = i; });
    var nodes = DATA.nodes.map(function (n) { return { name: n.name, ghost: !!n.ghost, ci: comIndex[n.c] || 0, links: [] }; });
    var edges = DATA.edges;
    edges.forEach(function (e) { nodes[e[0]].links.push(e[1]); nodes[e[1]].links.push(e[0]); });
    nodes.forEach(function (n, i) { COMM[n.ci].members.push(i); });
    ensureFree(Math.ceil(nodes.filter(function (n) { return COMM[n.ci].key !== 'core'; }).length * 1.3));
    COMM.map(function (c, i) { return i; }).sort(function (a, b) { return COMM[b].members.length - COMM[a].members.length; }).forEach(function (ci) {
      var cm = COMM[ci], mem = cm.members.slice().sort(function (a, b) { return nodes[b].links.length - nodes[a].links.length; });
      if (cm.key === 'core') { mem.forEach(function (ni, k) { nodes[ni].pos = stemPoint(k, mem.length); }); return; }
      var center = centers[cm.key] = newCenter();
      mem.forEach(function (ni) { nodes[ni].pos = nearestFree(center).p; });
    });
    nodes.forEach(function (n) {
      n.p = new THREE.Vector3(n.pos[0], n.pos[1], n.pos[2]).multiplyScalar(SCALE);
      n.size = n.ghost ? 1.6 : 2.2 + Math.min(9, Math.sqrt(n.links.length) * 1.6);
    });
    var N = nodes.length;

    /* ---------- DOM inside the stage ---------- */
    var noteCount = nodes.filter(function (n) { return !n.ghost; }).length;
    stageEl.insertAdjacentHTML('afterbegin',
      '<div class="bg-sky" aria-hidden="true"></div><canvas class="bg-stars" aria-hidden="true"></canvas><div class="bg-gl"></div><div class="bg-vig" aria-hidden="true"></div>' +
      '<div class="bg-card bg-hud"><b>SECOND BRAIN</b><p><span>' + noteCount.toLocaleString('en-US') + '</span> notes / <span>' + edges.length.toLocaleString('en-US') + '</span> links / <span>' + COMM.length + '</span> communities</p></div>' +
      '<div class="bg-card bg-legend"><header><span>LABELED COMMUNITIES</span><button type="button" id="bg-toggle" aria-expanded="true">hide</button></header><ul id="bg-list"></ul></div>' +
      '<div class="bg-card bg-hint" id="bg-hint"></div><div class="bg-card bg-tip" id="bg-tip" hidden></div>');
    var glEl = stageEl.querySelector('.bg-gl'), starsEl = stageEl.querySelector('.bg-stars'), sx = starsEl.getContext('2d');
    var tip = document.getElementById('bg-tip'), hint = document.getElementById('bg-hint'), list = document.getElementById('bg-list'), toggleBtn = document.getElementById('bg-toggle');
    stageEl.classList.add('ready');
    function W() { return stageEl.clientWidth || 600; }
    function H() { return stageEl.clientHeight || 400; }
    var DPR = Math.min(window.devicePixelRatio || 1, 1.5);

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0); renderer.setPixelRatio(DPR); renderer.setSize(W(), H());
    glEl.appendChild(renderer.domElement);
    var cv = renderer.domElement;
    var scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x03040a, .0011);
    var cam = new THREE.PerspectiveCamera(55, W() / H(), 1, 4000);
    function camPos() { var k = W() / H() < 1.2 ? 1.45 : 1; cam.position.set(470 * k, 110 * k, 250 * k); }
    camPos();
    var controls = new THREE.OrbitControls(cam, cv);
    controls.enableDamping = !calm(); controls.enablePan = false; controls.enableZoom = false;
    controls.autoRotate = !calm(); controls.autoRotateSpeed = .45; controls.minDistance = 180; controls.maxDistance = 1500;

    /* zoom / (on touch) rotate only after the canvas is focused, so the page keeps scrolling normally */
    var active = false;
    function setActive(a) {
      active = a; controls.enableZoom = a;
      if (coarseMQ.matches) { controls.enableRotate = a; cv.style.touchAction = a ? 'none' : 'pan-y'; }
      stageEl.classList.toggle('active', a);
      hint.textContent = coarseMQ.matches ? (a ? 'drag to orbit / pinch to zoom' : 'tap to explore') : (a ? 'drag orbit / scroll zoom / Esc to release' : 'drag to orbit / click to enable zoom');
    }
    if (coarseMQ.matches) { controls.enableRotate = false; cv.style.touchAction = 'pan-y'; }
    setActive(false);
    cv.addEventListener('pointerdown', function () { setActive(true); });
    document.addEventListener('pointerdown', function (e) { if (active && !stageEl.contains(e.target)) setActive(false); });
    stageEl.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setActive(false); } });
    stageEl.addEventListener('focusout', function (e) { if (!stageEl.contains(e.relatedTarget)) setActive(false); });
    cv.addEventListener('wheel', function (e) { if (!active) return; e.preventDefault(); }, { passive: false });

    function glowTex() {
      var c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d');
      var r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.18, 'rgba(255,255,255,.85)'); r.addColorStop(.42, 'rgba(255,255,255,.22)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
    }
    var tex = glowTex();
    var VS = 'attribute float size;attribute float tw;attribute float hi;varying vec3 vC;varying float vA;uniform float t;uniform float focus;' +
      'void main(){vC=color;vec4 mv=modelViewMatrix*vec4(position,1.);float s=size*(1.+.35*sin(t*2.2+tw));vA=.75+.25*sin(t*3.1+tw*1.7);' +
      'if(focus>.5){if(hi>.5){s*=1.9+.5*sin(t*4.+tw);vA*=1.7;}else{s*=.9;vA*=.5;}}' +
      'gl_PointSize=s*(520./-mv.z)*2.2;gl_Position=projectionMatrix*mv;}';
    var FS = 'uniform sampler2D map;uniform float dim;varying vec3 vC;varying float vA;void main(){vec4 g=texture2D(map,gl_PointCoord);gl_FragColor=vec4(vC*vA*dim,g.a*min(vA,1.));}';
    function cloud(count, fill) {
      var pos = new Float32Array(count * 3), col = new Float32Array(count * 3), siz = new Float32Array(count), tw = new Float32Array(count), hi = new Float32Array(count);
      for (var i = 0; i < count; i++) { var o = fill(i); pos.set(o.p, i * 3); col.set(o.c, i * 3); siz[i] = o.s; tw[i] = rnd() * 6.28; }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setAttribute('size', new THREE.BufferAttribute(siz, 1)); g.setAttribute('tw', new THREE.BufferAttribute(tw, 1)); g.setAttribute('hi', new THREE.BufferAttribute(hi, 1));
      var m = new THREE.ShaderMaterial({ uniforms: { t: { value: 0 }, map: { value: tex }, dim: { value: 1 }, focus: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, vertexShader: VS, fragmentShader: FS });
      var pts = new THREE.Points(g, m); scene.add(pts); m.geo = g; return m;
    }
    var dustMat = cloud(2400, function () { var p = cortexPoint(rnd() < .85).map(function (v) { return v * SCALE; }), k = .5 + rnd() * .35; return { p: p, c: [.5 * k, .72 * k, 1 * k], s: 2 + rnd() * 2.4 }; });
    var noteMat = cloud(N, function (i) {
      var n = nodes[i], c = new THREE.Color(COMM[n.ci].c);
      if (n.ghost) c.lerp(new THREE.Color('#5a6478'), .7); else c.lerp(new THREE.Color('#ffffff'), Math.min(.5, n.links.length / 40));
      return { p: [n.p.x, n.p.y, n.p.z], c: [c.r, c.g, c.b], s: n.size };
    });
    var BASE_LINE = .055;
    var lg = new THREE.BufferGeometry(), lmat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: BASE_LINE, blending: THREE.AdditiveBlending, depthWrite: false });
    (function () {
      var lp = new Float32Array(edges.length * 6), lc = new Float32Array(edges.length * 6);
      edges.forEach(function (e, k) {
        var A = nodes[e[0]].p, B = nodes[e[1]].p; lp.set([A.x, A.y, A.z, B.x, B.y, B.z], k * 6);
        var f = .28 + .72 * Math.pow(Math.max(0, 1 - A.distanceTo(B) / (SCALE * .9)), 2);
        var c1 = new THREE.Color(COMM[nodes[e[0]].ci].c).multiplyScalar(f), c2 = new THREE.Color(COMM[nodes[e[1]].ci].c).multiplyScalar(f);
        lc.set([c1.r, c1.g, c1.b, c2.r, c2.g, c2.b], k * 6);
      });
      lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lg.setAttribute('color', new THREE.BufferAttribute(lc, 3)); lg.computeBoundingSphere();
      scene.add(new THREE.LineSegments(lg, lmat));
    })();
    var hlMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false });
    var hl = new THREE.LineSegments(new THREE.BufferGeometry(), hlMat); scene.add(hl);
    var MAXS = 260, sp = new Float32Array(MAXS * 3), sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    var smat = new THREE.PointsMaterial({ size: 9, map: tex, color: 0xeaffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Points(sg, smat));
    var sparks = [];
    function spark(a, b, speed) { if (sparks.length < MAXS && a != null && b != null) sparks.push({ a: a, b: b, u: 0, v: speed || (.6 + rnd() * .9) }); }
    function lightUp(l) { var arr = new Float32Array(l.length * 6); l.forEach(function (e, k) { var A = nodes[e[0]].p, B = nodes[e[1]].p; arr.set([A.x, A.y, A.z, B.x, B.y, B.z], k * 6); }); hl.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3)); }

    /* ---------- hover / pick ---------- */
    var hover = -1, lit = -1, litKey = null, litEdges = [], tipT = 0;
    function place(x, y) { tip.style.left = Math.max(6, Math.min(x + 14, W() - 220)) + 'px'; tip.style.top = Math.max(6, Math.min(y + 12, H() - 56)) + 'px'; }
    function setHover(i, x, y) {
      if (i === hover) { if (i >= 0) place(x, y); return; }
      hover = i; cv.style.cursor = i >= 0 ? 'pointer' : 'grab';
      if (i < 0) { tip.hidden = true; lightUp([]); lmat.opacity = lit >= 0 ? .02 : BASE_LINE; noteMat.uniforms.dim.value = 1; frame(); return; }
      var n = nodes[i]; lightUp(n.links.map(function (j) { return [i, j]; })); n.links.forEach(function (j) { spark(i, j, 1.4); }); lmat.opacity = .025; noteMat.uniforms.dim.value = .7;
      tip.innerHTML = esc(n.name) + '<small><i style="background:' + COMM[n.ci].c + '"></i>' + esc(COMM[n.ci].label) + '</small>';
      tip.hidden = false; place(x, y); frame();
    }
    var v = new THREE.Vector3();
    function pick(ex, ey) {
      var best = -1, bd = 196, w = W(), h = H();
      for (var i = 0; i < N; i++) { v.copy(nodes[i].p).project(cam); if (v.z > 1) continue; var sx_ = (v.x + 1) / 2 * w, sy_ = (1 - v.y) / 2 * h, d = (sx_ - ex) * (sx_ - ex) + (sy_ - ey) * (sy_ - ey); if (d < bd) { bd = d; best = i; } }
      return best;
    }
    function local(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    cv.addEventListener('pointermove', function (e) { if (e.pointerType === 'touch') return; var p = local(e); setHover(pick(p[0], p[1]), p[0], p[1]); });
    cv.addEventListener('pointerleave', function () { setHover(-1); });
    var downAt = null;
    cv.addEventListener('pointerdown', function (e) { downAt = [e.clientX, e.clientY]; });
    cv.addEventListener('pointerup', function (e) {
      if (e.pointerType !== 'touch' || !downAt) return;
      var moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]); downAt = null; if (moved > 6) return;
      var p = local(e), i = pick(p[0], p[1]); setHover(i, p[0], p[1]);
      clearTimeout(tipT); if (i >= 0) tipT = setTimeout(function () { setHover(-1); }, 3200);
    });

    /* ---------- legend ---------- */
    function focusCommunity(ci) {
      var hi = noteMat.geo.attributes.hi; hi.array.fill(0); lit = ci; litKey = ci >= 0 ? COMM[ci].key : null; litEdges = [];
      if (ci >= 0) {
        var set = {}; COMM[ci].members.forEach(function (i) { hi.array[i] = 1; set[i] = 1; });
        litEdges = edges.filter(function (e) { return set[e[0]] && set[e[1]]; }); if (litEdges.length < 12) litEdges = edges.filter(function (e) { return set[e[0]] || set[e[1]]; });
        smat.color.set(COMM[ci].c).lerp(new THREE.Color('#ffffff'), .45);
      } else smat.color.set('#eaffff');
      hi.needsUpdate = true; noteMat.uniforms.focus.value = dustMat.uniforms.focus.value = ci >= 0 ? 1 : 0; lmat.opacity = ci >= 0 ? .02 : BASE_LINE;
      Array.prototype.forEach.call(list.querySelectorAll('li'), function (x) { x.classList.toggle('on', x.dataset.key === litKey); });
      frame();
    }
    COMM.map(function (c, i) { return i; }).sort(function (a, b) { return COMM[b].members.length - COMM[a].members.length; }).forEach(function (ci) {
      var c = COMM[ci], li = document.createElement('li'); li.dataset.key = c.key; li.tabIndex = 0;
      li.innerHTML = '<i style="background:' + c.c + ';color:' + c.c + '"></i><span title="' + esc(c.label) + '">' + esc(c.label) + '</span><span>' + c.members.length + '</span>';
      var go = function () { focusCommunity(litKey === c.key ? -1 : comIndex[c.key]); };
      li.addEventListener('click', go); li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      list.appendChild(li);
    });
    var legend = stageEl.querySelector('.bg-legend');
    function setLegend(open) { list.hidden = !open; toggleBtn.textContent = open ? 'hide' : 'show'; toggleBtn.setAttribute('aria-expanded', String(open)); legend.classList.toggle('shut', !open); }
    toggleBtn.addEventListener('click', function () { setLegend(list.hidden); });
    setLegend(W() > 640 && H() > 450);

    /* ---------- living sky (twinkles + the odd shooting star) ---------- */
    var twinkles = [], meteors = [], nextMeteor = 2.5;
    function sizeSky() {
      starsEl.width = W() * DPR; starsEl.height = H() * DPR; sx.setTransform(DPR, 0, 0, DPR, 0, 0);
      twinkles = []; var cnt = Math.min(160, Math.round(W() * H() / 5000));
      for (var i = 0; i < cnt; i++) twinkles.push({ x: Math.random() * W(), y: Math.random() * H(), r: .4 + Math.random() * 1.2, p: Math.random() * 6.28, s: .6 + Math.random() * 2.2, c: ['#ffffff', '#cfe0ff', '#ffd9a8', '#a9c4ff'][Math.floor(Math.random() * 4)] });
    }
    function meteor() {
      var fromTop = Math.random() < .7, x = fromTop ? Math.random() * W() : W() * (.6 + Math.random() * .4), y = fromTop ? -10 : Math.random() * H() * .4;
      var a = Math.PI * (.72 + Math.random() * .12), s = 450 + Math.random() * 350;
      meteors.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: .7 + Math.random() * .5, len: 70 + Math.random() * 90 });
    }
    function drawSky(dt, t, moving) {
      sx.clearRect(0, 0, W(), H());
      twinkles.forEach(function (s) {
        var a = .12 + .38 * (.5 + .5 * Math.sin(t * s.s + s.p)); sx.globalAlpha = a; sx.fillStyle = s.c; sx.beginPath(); sx.arc(s.x, s.y, s.r, 0, 6.283); sx.fill();
      });
      if (moving && (nextMeteor -= dt) <= 0) { meteor(); nextMeteor = 3 + Math.random() * 5; }
      meteors = meteors.filter(function (m) { return (m.life += dt) < m.max; });
      meteors.forEach(function (m) {
        m.x += m.vx * dt; m.y += m.vy * dt; var k = 1 - m.life / m.max, n = Math.hypot(m.vx, m.vy), tx = m.x - m.vx / n * m.len, ty = m.y - m.vy / n * m.len;
        var g = sx.createLinearGradient(m.x, m.y, tx, ty); g.addColorStop(0, 'rgba(235,245,255,' + (.95 * k) + ')'); g.addColorStop(1, 'rgba(235,245,255,0)');
        sx.globalAlpha = 1; sx.strokeStyle = g; sx.lineWidth = 1.4; sx.beginPath(); sx.moveTo(m.x, m.y); sx.lineTo(tx, ty); sx.stroke();
      });
      sx.globalAlpha = 1;
    }
    sizeSky();

    /* ---------- resize ---------- */
    function resize() { cam.aspect = W() / H(); cam.updateProjectionMatrix(); renderer.setSize(W(), H()); sizeSky(); frame(); }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stageEl); else window.addEventListener('resize', resize);

    /* ---------- loop: only while visible, tab shown, and (for motion) not paused ---------- */
    var visible = false, running = false, t = 0, last = 0, drawn = false;
    function moving() { return !calm() && !isPaused(); }
    function tick(now) {
      running = false;
      if (!visible || document.hidden) return;
      var dt = Math.min((now - last) / 1000, .05); last = now; if (!(dt > 0)) dt = .016;
      var mv = moving();
      if (mv) t += dt;
      controls.autoRotate = mv; controls.enableDamping = !calm();
      noteMat.uniforms.t.value = dustMat.uniforms.t.value = t;
      drawSky(dt, t, mv);
      if (mv) {
        if (edges.length && rnd() < .4) { var e = edges[Math.floor(rnd() * edges.length)]; spark(e[0], e[1]); }
        if (lit >= 0 && litEdges.length) for (var k = 0; k < 2; k++) { var le = litEdges[Math.floor(rnd() * litEdges.length)]; rnd() < .5 ? spark(le[0], le[1], 1.1) : spark(le[1], le[0], 1.1); }
        if (hover >= 0 && nodes[hover].links.length && rnd() < .25) spark(hover, nodes[hover].links[Math.floor(rnd() * nodes[hover].links.length)], 1.4);
        sparks = sparks.filter(function (s) { return (s.u += s.v * dt) < 1; });
      }
      sparks.forEach(function (s, k) { v.copy(nodes[s.a].p).lerp(nodes[s.b].p, Math.min(s.u, 1)); sp.set([v.x, v.y, v.z], k * 3); });
      sg.setDrawRange(0, sparks.length); sg.attributes.position.needsUpdate = true;
      hlMat.opacity = .55 + .35 * Math.sin(t * 9);
      controls.update(); renderer.render(scene, cam); drawn = true;
      /* in calm / paused mode we draw on demand (controls change, hover, resize); otherwise keep going */
      if (mv || sparks.length) schedule();
    }
    function schedule() { if (running || !visible || document.hidden) return; running = true; last = performance.now(); requestAnimationFrame(tick); }
    function frame() { schedule(); }
    controls.addEventListener('change', frame);
    stageEl.classList.toggle('calm', calm());
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; stageEl.classList.toggle('on', visible); if (visible) frame(); }).observe(stageEl);
    else { visible = true; frame(); }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) frame(); });
    var pauseBtn = document.getElementById('btn-pause'); if (pauseBtn) pauseBtn.addEventListener('click', function () { setTimeout(frame, 30); });
    if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', function () { stageEl.classList.toggle('calm', calm()); frame(); });
    frame();
  }
})();
