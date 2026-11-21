/* Cat game. A small port of the "Study Buddy" from MarkBasa96/automation-roadmap (MIT, same author).
   Pure canvas, no image files. Self-contained: app.js only calls CatGame.open().
   WASD / arrows or the on-screen pad. Catch fish, dodge dogs, grab hearts.
   Pauses when the dialog closes or the tab is hidden. */
(function () {
  'use strict';

  var LEVELS = [
    { at: 0,   dogs: 0, fish: 1, speed: 0,    note: null },
    { at: 8,   dogs: 1, fish: 1, speed: 1.0,  note: 'a dog has noticed you' },
    { at: 20,  dogs: 1, fish: 2, speed: 1.12, note: 'double fish!' },
    { at: 35,  dogs: 2, fish: 2, speed: 1.24, note: 'there are TWO of them now' },
    { at: 55,  dogs: 2, fish: 3, speed: 1.36, note: 'three fish at once' },
    { at: 80,  dogs: 3, fish: 3, speed: 1.48, note: 'three dogs. good luck.' },
    { at: 110, dogs: 4, fish: 4, speed: 1.6,  note: 'the pack has arrived' }
  ];
  var START_LIVES = 3, MAX_LIVES = 5;
  var DOG_STAY = 12000, DOG_GAP = [5000, 13000];
  var HEART_GAP = [16000, 32000], HEART_LASTS = 11000;
  var QUIPS = ['meow.', 'fish. now.', 'no dogs in meetings.', 'purr.', 'you can mute me. i will judge.', 'still better than the standup.', 'i work for fish.'];
  var BEST_KEY = 'jb-cat-best', MUTE_KEY = 'jb-cat-sound';

  var dlg, cv, ctx, hudScore, hudBest, hudLives, muteBtn, hint, pad;
  var inited = false, raf = null, last = 0, tick = 0, running = false, hiddenPause = false;
  var W = 320, H = 213, dpr = 1;
  var keys = { w: false, a: false, s: false, d: false };
  var cat, fishes, dogs, slots, heart, heartNext, lives, score, best, dead, invuln, bubble, pop, shown, muted, reduce, lvIndex;
  var colors = {};
  var ac = null;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function now() { return performance.now(); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function store(get, k, v) {
    try { if (get) return window.localStorage.getItem(k); window.localStorage.setItem(k, v); } catch (e) {}
    return null;
  }

  /* ---------- sound (Web Audio, created only after a real click/key) ---------- */
  function tone(freq, to, dur, type, vol, delay) {
    if (muted) return;
    try {
      if (!ac) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ac = new AC(); }
      if (ac.state === 'suspended') ac.resume();
      var t0 = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t0);
      if (to) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol || 0.1, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(t0); o.stop(t0 + dur + 0.03);
    } catch (e) {}
  }
  var Sfx = {
    eat: function () { tone(680, 1020, .08, 'square', .09); tone(1020, 1360, .09, 'square', .07, .06); },
    hurt: function () { tone(190, 70, .22, 'sawtooth', .14); },
    die: function () { [523, 440, 349, 262].forEach(function (f, i) { tone(f, f * .92, .26, 'triangle', .13, i * .15); }); },
    level: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0, .12, 'square', .08, i * .07); }); },
    bark: function () { tone(240, 110, .11, 'sawtooth', .1); },
    heart: function () { [392, 523, 659].forEach(function (f, i) { tone(f, 0, .13, 'triangle', .1, i * .08); }); }
  };

  /* ---------- colours from the page tokens ---------- */
  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    function col(name, fb) {
      var v = cs.getPropertyValue(name).trim();
      if (!v) return fb;
      ctx.fillStyle = '#010203';
      ctx.fillStyle = v;
      return ctx.fillStyle === '#010203' ? fb : v;
    }
    colors.bg = col('--canvas', '#f4f2ee');
    colors.dot = col('--dot', '#cfcac2');
    colors.text = col('--text', '#1b1a18');
    colors.muted = col('--muted', '#6b675f');
    colors.card = col('--card', '#ffffff');
    colors.accent = col('--accent', '#ff6d3f');
    colors.line = col('--line', '#e2ddd4');
  }

  /* ---------- state ---------- */
  function levelFor(s) { var lv = LEVELS[0]; for (var i = 0; i < LEVELS.length; i++) if (s >= LEVELS[i].at) lv = LEVELS[i]; return lv; }
  function say(text, ms) { bubble = { text: text, until: now() + (ms || 2400) }; }

  function newFish() { return { x: rnd(28, Math.max(30, W - 28)), y: rnd(34, Math.max(36, H - 26)), t: rnd(0, 60) }; }
  function syncFish() {
    var want = levelFor(score).fish;
    while (fishes.length < want) fishes.push(newFish());
    while (fishes.length > want) fishes.pop();
  }
  function newDog() {
    var edge = Math.floor(rnd(0, 4));
    return {
      x: edge === 0 ? 10 : edge === 1 ? W - 10 : rnd(20, Math.max(22, W - 20)),
      y: edge === 2 ? 20 : edge === 3 ? H - 14 : rnd(30, Math.max(32, H - 20)),
      vx: 0, vy: 0, wander: 0
    };
  }
  function syncSlots(t) {
    var want = levelFor(score).dogs;
    while (slots.length < want) slots.push({ dog: null, nextAt: t + rnd(1200, 4000), until: 0 });
    while (slots.length > want) slots.pop();
  }

  function reset() {
    cat = { x: W / 2, y: H / 2, vx: 0, vy: 0, dir: 1, step: 0 };
    fishes = []; slots = []; heart = null; heartNext = 0;
    lives = START_LIVES; score = 0; dead = false; shown = 0; pop = 0; bubble = null;
    invuln = now() + 1200; lvIndex = 0;
    syncFish(); hud();
    say('meow.', 1600);
  }

  function hud() {
    hudScore.textContent = score;
    hudBest.textContent = best;
    var slotsShown = Math.max(START_LIVES, lives);
    var s = '';
    for (var i = 0; i < slotsShown; i++) s += i < lives ? '♥' : '♡';
    hudLives.textContent = s;
    hudLives.setAttribute('aria-label', lives + ' lives');
  }

  function gainFish() {
    var before = score;
    score++;
    if (score > best) { best = score; store(false, BEST_KEY, String(best)); }
    Sfx.eat(); pop = 22;
    var a = levelFor(before), b = levelFor(score);
    if (a.at !== b.at && b.note) { Sfx.level(); say(b.note, 3000); }
    else if (score % 10 === 0) say(QUIPS[Math.floor(Math.random() * QUIPS.length)], 2200);
    hud(); syncFish();
  }

  function loseLife(dog) {
    lives--; invuln = now() + 1600;
    if (lives <= 0) { dead = true; Sfx.die(); slots = []; heart = null; hud(); return; }
    Sfx.hurt();
    var ang = Math.atan2(cat.y - dog.y, cat.x - dog.x);
    cat.vx = Math.cos(ang) * 7; cat.vy = Math.sin(ang) * 7;
    dog.x -= Math.cos(ang) * 34; dog.y -= Math.sin(ang) * 34;
    say(lives === 1 ? 'last life!' : 'ow! ' + lives + ' left', 1600);
    hud();
  }

  /* ---------- drawing ---------- */
  function drawCat(x, y, dir, walking, flash) {
    var s = 4;
    function px(a, b, w, h, c) {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x + a * s * dir - (dir < 0 ? w * s : 0)), Math.round(y + b * s), w * s, h * s);
    }
    var body = flash ? '#fca5a5' : '#f59e0b', dark = flash ? '#ef4444' : '#b45309';
    var bob = walking ? Math.sin(cat.step / 3) * 1.2 : Math.sin(tick / 28) * 0.8;
    ctx.save(); ctx.translate(0, bob);
    var tw = Math.sin(tick / 9) * 1.6;
    px(-6, -1 + tw * .3, 2, 1, dark); px(-7, -3 + tw * .3, 1, 2, dark);
    px(-5, 0, 8, 4, body); px(1, -4, 5, 5, body);
    px(1, -6, 1, 2, dark); px(4, -6, 1, 2, dark);
    var lift = walking ? (Math.floor(cat.step / 4) % 2 ? 1 : 0) : 0;
    px(-4, 4 - lift, 2, 1, dark); px(1, 4 - (1 - lift), 2, 1, dark);
    px(4, -3, 1, 1, '#1f2937'); px(2, -3, 1, 1, '#1f2937'); px(3, -1, 1, 1, '#fda4af');
    ctx.restore();
  }
  function drawDog(d) {
    var s = 4, dir = d.vx < 0 ? -1 : 1, x = d.x, y = d.y;
    function px(a, b, w, h, c) {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x + a * s * dir - (dir < 0 ? w * s : 0)), Math.round(y + b * s), w * s, h * s);
    }
    var body = '#78716c', dark = '#44403c', trot = Math.floor(tick / 5) % 2;
    px(-7, -1, 2, 2, dark); px(-6, 0, 9, 5, body); px(2, -4, 6, 6, body);
    px(2, -6, 2, 2, dark); px(8, -1, 1, 2, dark); px(6, -3, 1, 1, '#fca5a5');
    px(-5, 5 - trot, 2, 1, dark); px(1, 5 - (1 - trot), 2, 1, dark);
  }
  function drawFish(f) {
    var s = 4, wob = Math.sin(f.t / 10) * 1.5;
    ctx.save(); ctx.translate(f.x, f.y + wob);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-2 * s, -s, 3 * s, 2 * s);
    ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(2 * s, -s); ctx.lineTo(2 * s, s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0c4a6e'; ctx.fillRect(-s, -s / 2, s / 2, s / 2);
    ctx.restore();
  }
  function drawHeart(h, t) {
    var beat = 1 + Math.sin(t / 180) * 0.09, fade = Math.min(1, (h.until - t) / 2200), s = 9 * beat;
    ctx.save(); ctx.globalAlpha = Math.max(0.15, Math.min(1, fade)); ctx.translate(h.x, h.y);
    ctx.fillStyle = '#ef4444'; ctx.beginPath();
    ctx.moveTo(0, s * .75);
    ctx.bezierCurveTo(-s * 1.5, -s * .25, -s * .6, -s * 1.25, 0, -s * .45);
    ctx.bezierCurveTo(s * .6, -s * 1.25, s * 1.5, -s * .25, 0, s * .75);
    ctx.fill(); ctx.restore();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  }
  function drawBubble(text) {
    ctx.font = '11px "Geist Mono", ui-monospace, monospace';
    var tw = ctx.measureText(text).width, bw = Math.min(W - 12, tw + 18), bh = 22;
    var bx = clamp(cat.x - bw / 2, 6, W - bw - 6), by = Math.max(6, cat.y - 44 - bh / 2);
    ctx.fillStyle = colors.card; ctx.strokeStyle = colors.line; ctx.lineWidth = 1;
    roundRect(bx, by, bw, bh, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = colors.text; ctx.textAlign = 'center';
    ctx.fillText(text, bx + bw / 2, by + 15);
  }
  function drawBackground() {
    ctx.fillStyle = colors.bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = colors.dot;
    for (var gx = 10; gx < W; gx += 20) for (var gy = 10; gy < H; gy += 20) ctx.fillRect(gx, gy, 1.6, 1.6);
  }
  function drawOverlay(title, sub) {
    ctx.fillStyle = colors.card; ctx.globalAlpha = .88; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.text; ctx.font = '600 16px "Geist", system-ui, sans-serif';
    ctx.fillText(title, W / 2, H / 2 - 4);
    ctx.fillStyle = colors.muted; ctx.font = '12px "Geist Mono", ui-monospace, monospace';
    ctx.fillText(sub, W / 2, H / 2 + 18);
  }

  /* ---------- loop ---------- */
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    var dt = last ? Math.min(40, ts - last) : 16.7; last = ts;
    var k = dt / 16.7;
    tick++;
    var t = now();

    drawBackground();

    if (dead) {
      drawOverlay('the dog got me!', 'score reset · best ' + best + ' · press Enter or tap to play again');
      return;
    }

    /* cat */
    var sp = .55 * k, fr = Math.pow(.82, k);
    if (keys.w) cat.vy -= sp; if (keys.s) cat.vy += sp;
    if (keys.a) { cat.vx -= sp; cat.dir = -1; } if (keys.d) { cat.vx += sp; cat.dir = 1; }
    cat.vx *= fr; cat.vy *= fr;
    cat.x = clamp(cat.x + cat.vx * k, 24, W - 24);
    cat.y = clamp(cat.y + cat.vy * k, 30, H - 20);
    var moving = Math.abs(cat.vx) + Math.abs(cat.vy) > .25;
    if (moving) cat.step += k;

    /* fish */
    syncFish();
    for (var i = fishes.length - 1; i >= 0; i--) {
      var f = fishes[i]; f.t += k; drawFish(f);
      if (Math.hypot(f.x - cat.x, f.y - cat.y) < 22) { fishes.splice(i, 1); gainFish(); }
    }

    /* heart */
    if (!heartNext) heartNext = t + rnd(HEART_GAP[0], HEART_GAP[1]);
    if (!heart && t >= heartNext) {
      if (lives >= MAX_LIVES) heartNext = t + rnd(HEART_GAP[0], HEART_GAP[1]);
      else heart = { x: rnd(28, Math.max(30, W - 28)), y: rnd(36, Math.max(38, H - 26)), until: t + HEART_LASTS };
    }
    if (heart) {
      if (t >= heart.until) { heart = null; heartNext = t + rnd(HEART_GAP[0], HEART_GAP[1]); }
      else {
        drawHeart(heart, t);
        if (Math.hypot(heart.x - cat.x, heart.y - cat.y) < 22) {
          heart = null; heartNext = t + rnd(HEART_GAP[0], HEART_GAP[1]);
          if (lives < MAX_LIVES) { lives++; Sfx.heart(); say('+1 life', 1500); hud(); }
        }
      }
    }

    /* dogs */
    syncSlots(t);
    var spd = (levelFor(score).speed || 1) * k;
    slots.forEach(function (s) {
      if (!s.dog && t >= s.nextAt) { s.dog = newDog(); s.until = t + DOG_STAY; Sfx.bark(); say('run!', 1100); }
      if (s.dog && t >= s.until) { s.dog = null; s.nextAt = t + rnd(DOG_GAP[0], DOG_GAP[1]); }
      var d = s.dog; if (!d) return;
      d.wander = clamp(d.wander + rnd(-.14, .14), -.9, .9);
      var ang = Math.atan2(cat.y - d.y, cat.x - d.x) + d.wander;
      d.vx = Math.cos(ang) * spd; d.vy = Math.sin(ang) * spd;
      d.x = clamp(d.x + d.vx, 14, W - 14); d.y = clamp(d.y + d.vy, 20, H - 16);
      drawDog(d);
      if (t > invuln && Math.hypot(d.x - cat.x, d.y - cat.y) < 22) loseLife(d);
    });

    /* +1 popper */
    if (pop > 0) {
      ctx.globalAlpha = pop / 22; ctx.fillStyle = colors.accent;
      ctx.font = '600 13px "Geist Mono", ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.fillText('+1', cat.x, cat.y - 28 - (22 - pop));
      ctx.globalAlpha = 1; pop--;
    }

    var flashing = !reduce && t < invuln && Math.floor(t / 90) % 2 === 0;
    drawCat(cat.x, cat.y, cat.dir, moving, flashing);

    if (bubble) { if (t > bubble.until) bubble = null; else drawBubble(bubble.text); }

    var lv = levelFor(score);
    if (lv.at > 0) {
      ctx.fillStyle = colors.muted; ctx.font = '500 10px "Geist Mono", ui-monospace, monospace'; ctx.textAlign = 'left';
      ctx.fillText('LV ' + (LEVELS.indexOf(lv) + 1), 10, 16);
    }
  }

  function loop(on) {
    if (on) { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
    else if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  function resize() {
    var r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(r.width); H = Math.round(r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (cat) { cat.x = clamp(cat.x, 24, W - 24); cat.y = clamp(cat.y, 30, H - 20); }
  }

  /* ---------- input ---------- */
  var MAP = { w: 'w', a: 'a', s: 's', d: 'd', arrowup: 'w', arrowleft: 'a', arrowdown: 's', arrowright: 'd' };
  function clearKeys() { keys.w = keys.a = keys.s = keys.d = false; if (pad) pad.querySelectorAll('.down').forEach(function (b) { b.classList.remove('down'); }); }

  function onKeyDown(e) {
    var k = (e.key || '').toLowerCase();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (dead && (k === 'enter' || k === ' ') && e.target === cv) { restart(); e.preventDefault(); return; }
    var m = MAP[k];
    if (!m) return;
    keys[m] = true;
    e.preventDefault();
  }
  function onKeyUp(e) {
    var m = MAP[(e.key || '').toLowerCase()];
    if (m) keys[m] = false;
  }
  function restart() { reset(); }

  function setPause(p) {
    if (p) { loop(false); clearKeys(); if (running && ctx && cat) { drawBackground(); drawCat(cat.x, cat.y, cat.dir, false, false); drawOverlay('paused', 'come back to resume'); } }
    else if (running && dlg.open && !document.hidden) loop(true);
  }

  function setMuted(m) {
    muted = m;
    store(false, MUTE_KEY, m ? 'off' : 'on');
    muteBtn.setAttribute('aria-pressed', m ? 'true' : 'false');
    muteBtn.setAttribute('aria-label', m ? 'Turn sound on' : 'Turn sound off');
    muteBtn.querySelector('use').setAttribute('href', m ? '#i-mute' : '#i-volume');
  }

  function init() {
    if (inited) return true;
    dlg = document.getElementById('dlg-game');
    cv = document.getElementById('g-canvas');
    if (!dlg || !cv || !cv.getContext) return false;
    ctx = cv.getContext('2d');
    hudScore = document.getElementById('g-score'); hudBest = document.getElementById('g-best'); hudLives = document.getElementById('g-lives');
    muteBtn = document.getElementById('g-mute'); hint = document.getElementById('g-hint'); pad = document.getElementById('dpad');
    best = parseInt(store(true, BEST_KEY) || '0', 10) || 0;
    reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    dlg.addEventListener('keydown', onKeyDown);
    dlg.addEventListener('keyup', onKeyUp);
    cv.addEventListener('blur', clearKeys);
    cv.addEventListener('pointerdown', function () { cv.focus({ preventScroll: true }); if (dead) restart(); });
    dlg.addEventListener('close', function () { running = false; loop(false); clearKeys(); });
    document.addEventListener('visibilitychange', function () { if (running) setPause(document.hidden); });
    window.addEventListener('blur', function () { clearKeys(); });
    if (window.ResizeObserver) new ResizeObserver(resize).observe(cv); else window.addEventListener('resize', resize);

    pad.querySelectorAll('button').forEach(function (b) {
      var d = b.getAttribute('data-dir');
      function down(e) { e.preventDefault(); keys[d] = true; b.classList.add('down'); try { b.setPointerCapture(e.pointerId); } catch (x) {} }
      function up() { keys[d] = false; b.classList.remove('down'); }
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });

    muteBtn.addEventListener('click', function () { setMuted(!muted); if (!muted) tone(660, 880, .08, 'square', .08); });
    var saved = store(true, MUTE_KEY);
    setMuted(saved !== 'on');   /* sound is off until the visitor turns it on */
    inited = true;
    return true;
  }

  function open() {
    if (!init()) return;
    if (window.JBDialog) window.JBDialog.open(dlg); else dlg.showModal();
    readColors();
    resize();
    reset();
    running = true;
    cv.focus({ preventScroll: true });
    loop(!document.hidden);
  }

  window.CatGame = { open: open, stop: function () { running = false; loop(false); } };
})();
