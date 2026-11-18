/* Page behaviour: header, contact menu, scroll reveals, the two live demos.
   The 3D avatar lives in avatar.js and listens for the "pose" event sent from here. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Hero entrance: wait for the font so lines don't jump ---------- */
  const show = () => document.body.classList.add('loaded');
  const start = () => { requestAnimationFrame(show); setTimeout(show, 150); };   // timer is a safety net if the tab opens in the background
  (document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1200))]) : Promise.resolve()).then(start);

  /* ---------- Header state + reading progress ---------- */
  const bar = $('#bar'), progress = $('#progress');
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
      bar.classList.toggle('scrolled', y > 8);
      document.documentElement.classList.toggle('at-top', y < innerHeight * 0.3);
      progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      ticking = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Scroll reveals ---------- */
  const revealIO = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  $$('[data-reveal]').forEach(el => revealIO.observe(el));

  /* ---------- Which section is in the middle of the screen ---------- */
  // Drives the avatar's pose and the highlighted nav link.
  const navLinks = $$('.links a');
  const setPose = name => {
    if (window.__pose === name) return;
    window.__pose = name;
    dispatchEvent(new CustomEvent('pose', { detail: name }));
  };
  window.__pose = 'wave';
  const midIO = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      if (e.target.dataset.pose) setPose(e.target.dataset.pose);
      const sec = e.target.closest('section[id]');
      if (sec) navLinks.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + sec.id));
    }
  }, { rootMargin: '-50% 0px -50% 0px' });
  $$('[data-pose]').forEach(el => midIO.observe(el));

  /* ---------- Contact: three cards over a blurred page ---------- */
  const btn = $('#contactBtn'), pop = $('#contactPop');
  const behind = [$('#bar'), $('main'), $('.foot'), $('#dock'), $('.resume')];
  let opener = null;
  const setOpen = open => {
    if (open === pop.hasAttribute('data-open')) return;
    if (open) opener = document.activeElement;
    btn.setAttribute('aria-expanded', open);
    pop.toggleAttribute('data-open', open);
    behind.forEach(el => { if (el) el.inert = open; });           // keeps the keyboard inside the cards while they are open
    if (open) $('.reach-close', pop).focus({ preventScroll: true });
    else if (opener && opener.focus) opener.focus({ preventScroll: true });
  };
  btn.addEventListener('click', () => setOpen(true));
  $$('[data-close]', pop).forEach(el => el.addEventListener('click', () => setOpen(false)));
  $$('a.reach-card', pop).forEach(a => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
  ['wheel', 'touchmove'].forEach(type => pop.addEventListener(type, e => e.preventDefault(), { passive: false }));   // the page behind does not scroll

  $$('[data-open-contact]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); setOpen(true); }));
  const copyBtn = $('#copyBtn'), copyLabel = $('span', copyBtn);
  let copyTimer;
  const swapLabel = (text, done) => {
    copyBtn.classList.add('swap');
    setTimeout(() => { copyLabel.textContent = text; copyBtn.classList.toggle('done', done); copyBtn.classList.remove('swap'); }, 120);
  };
  copyBtn.addEventListener('click', async e => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(copyBtn.dataset.copy); } catch { return; }
    swapLabel('Copied', true);
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => swapLabel('Copy', false), 1800);
  });

  /* ---------- Back-to-top dock ---------- */
  $('#dock').addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));

  /* Run a demo only while it is on screen */
  const whileVisible = (el, onStart, onStop) => {
    new IntersectionObserver(([e]) => (e.isIntersecting ? onStart() : onStop()), { threshold: 0.15 }).observe(el);
  };

  /* ==========================================================
     QuantDrill: a self-playing round using the real rank ladder
     ========================================================== */
  (() => {
    const RANKS = [['Intern', 0], ['Graduate', 15], ['Analyst', 25], ['Quant Analyst', 30], ['Associate', 35], ['Trading Associate', 40], ['Junior Trader', 45], ['Trader', 50], ['Options Trader', 55], ['Senior Trader', 60], ['Quant', 70], ['Senior Quant', 80], ['Portfolio Manager', 90], ['Partner', 100]];
    const root = $('#qd'), q = $('#qdQ'), a = $('#qdA'), scoreEl = $('#qdScore'), rankEl = $('#qdRank'), timer = $('#qdTimer'), ladder = $('#qdLadder');
    ladder.innerHTML = RANKS.map(() => '<li></li>').join('');
    const ticks = $$('li', ladder);
    const R = n => Math.floor(Math.random() * n);
    const question = () => {
      const kind = R(4);
      if (kind === 0) { const x = 12 + R(88), y = 2 + R(11); return [`${x} × ${y}`, x * y]; }
      if (kind === 1) { const x = 100 + R(900), y = 100 + R(900); return [`${x} + ${y}`, x + y]; }
      if (kind === 2) { const y = 100 + R(500), x = y + 10 + R(500); return [`${x} − ${y}`, x - y]; }
      const y = 2 + R(11), ans = 12 + R(88); return [`${ans * y} ÷ ${y}`, ans];
    };
    let score = 0, rank = 0, timers = [], running = false;
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const paint = () => {
      scoreEl.textContent = score;
      timer.style.transform = `scaleX(${1 - score / 100})`;
      let r = 0; RANKS.forEach(([, min], i) => { if (score >= min) r = i; });
      ticks.forEach((t, i) => t.classList.toggle('on', i <= r));
      if (r !== rank) {
        rank = r; rankEl.classList.add('swap');
        later(() => { rankEl.textContent = RANKS[r][0]; rankEl.classList.remove('swap'); }, 140);
      }
    };
    const round = () => {
      if (!running) return;
      if (document.documentElement.classList.contains('still')) { later(round, 400); return; }   // motion paused
      if (score >= 100) { score = 0; rank = -1; }
      const [text, ans] = question();
      q.textContent = text; a.textContent = '';
      const digits = String(ans);
      [...digits].forEach((d, i) => later(() => { a.textContent += d; }, 240 + i * 75));
      later(() => { score++; paint(); }, 240 + digits.length * 75 + 60);
      later(round, 760);
    };
    paint();
    if (reduce) { q.textContent = '47 × 8'; a.textContent = '376'; return; }
    whileVisible(root, () => { if (!running) { running = true; round(); } }, () => { running = false; timers.forEach(clearTimeout); timers = []; });
  })();

  /* ==========================================================
     Courier dispatch: a toy version of the real study
     ========================================================== */
  (() => {
    const canvas = $('#sim'), ctx = canvas.getContext('2d');
    const seg = $('.seg'), avgEl = $('#simAvg'), maxEl = $('#simMax');
    const COLS = 11, ROWS = 7, COURIERS = 4, SPEED = 2.1, SPAWN = 0.55, CAP = 18;
    const INK = '12,13,16', COBALT = '30,58,240';

    // Slightly irregular street grid (fixed seed so it looks the same every visit)
    let seed = 42;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const nodes = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
      nodes.push({ c, r, x: (c + .5 + (rnd() - .5) * .55) / COLS, y: (r + .5 + (rnd() - .5) * .5) / ROWS });
    const at = (c, r) => nodes[r * COLS + c];
    const dist = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
    const route = (from, to) => {           // walk the grid: one axis, then the other
      const path = []; let { c, r } = from; const colsFirst = Math.random() < .5;
      const stepC = () => { while (c !== to.c) { c += Math.sign(to.c - c); path.push(at(c, r)); } };
      const stepR = () => { while (r !== to.r) { r += Math.sign(to.r - r); path.push(at(c, r)); } };
      colsFirst ? (stepC(), stepR()) : (stepR(), stepC());
      return path;
    };

    let rule = 'oldest', t = 0, lastSpawn = 0, orders = [], couriers = [], waits = [], pulses = [];
    const reset = () => {
      t = 0; lastSpawn = 0; orders = []; waits = []; pulses = [];
      couriers = Array.from({ length: COURIERS }, (_, i) => { const n = at(2 + i * 2, 1 + (i * 2) % (ROWS - 2)); return { node: n, x: n.x, y: n.y, path: [], k: 0, order: null }; });
    };
    reset();

    // Cheapest total travel for the free couriers, found by trying every pairing (the numbers are tiny)
    const matchAll = (idle, open) => {
      const cand = open.slice().sort((a, b) => a.born - b.born).slice(0, 8), k = Math.min(idle.length, cand.length);
      let bestCost = Infinity, bestPairs = [];
      const go = (i, used, cost, pairs) => {
        if (cost >= bestCost) return;
        if (i === k) { bestCost = cost; bestPairs = pairs.slice(); return; }
        for (let j = 0; j < cand.length; j++) {
          if (used & (1 << j)) continue;
          pairs.push([idle[i], cand[j]]); go(i + 1, used | (1 << j), cost + dist(idle[i].node, cand[j].node), pairs); pairs.pop();
        }
      };
      go(0, 0, 0, []);
      bestPairs.forEach(([c, o]) => take(c, o));
    };
    let lastBatch = 0;
    const assign = () => {
      const idle = couriers.filter(c => !c.order), open = orders.filter(o => !o.taken);
      if (!idle.length || !open.length) return;
      if (rule === 'oldest') {
        open.sort((a, b) => a.born - b.born);
        for (const o of open) {
          if (!idle.length) break;
          idle.sort((a, b) => dist(a.node, o.node) - dist(b.node, o.node));
          take(idle.shift(), o);
        }
      } else if (rule === 'nearest') {
        while (idle.length && open.length) {
          let best = null;
          for (const c of idle) for (const o of open) { const d = dist(c.node, o.node); if (!best || d < best.d) best = { c, o, d }; }
          take(best.c, best.o);
          idle.splice(idle.indexOf(best.c), 1); open.splice(open.indexOf(best.o), 1);
        }
      } else if (rule === 'optimal') {
        matchAll(idle, open);
      } else if (Math.abs(t - lastBatch) > 1.5) {       // batched: wait, then match a whole batch at once
        lastBatch = t; matchAll(idle, open);
      }
    };
    const take = (c, o) => { o.taken = true; c.order = o; c.path = route(c.node, o.node); c.k = 0; };

    const step = dt => {
      t += dt;
      if (t - lastSpawn > SPAWN && orders.length < CAP) {
        lastSpawn = t;
        let n, tries = 0;
        do { n = nodes[Math.floor(Math.random() * nodes.length)]; } while (tries++ < 20 && (orders.some(o => o.node === n) || couriers.some(c => c.node === n)));
        orders.push({ node: n, born: t, taken: false });
      }
      assign();
      for (const c of couriers) {
        if (!c.order) continue;
        if (!c.path.length) { deliver(c); continue; }
        c.k += SPEED * dt;
        while (c.k >= 1 && c.path.length) { c.k -= 1; c.node = c.path.shift(); }
        if (!c.path.length) { c.x = c.node.x; c.y = c.node.y; deliver(c); continue; }
        const n = c.path[0];
        c.x = c.node.x + (n.x - c.node.x) * c.k; c.y = c.node.y + (n.y - c.node.y) * c.k;
      }
      pulses = pulses.filter(p => t - p.t < .6);
    };
    const deliver = c => {
      waits.push(t - c.order.born); if (waits.length > 30) waits.shift();
      pulses.push({ x: c.node.x, y: c.node.y, t });
      orders.splice(orders.indexOf(c.order), 1);
      c.order = null; c.k = 0;
    };

    let W = 0, H = 0, top = 0;
    const size = () => {
      const r = canvas.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
      W = r.width; H = r.height; top = Math.min(64, H * .2);
      canvas.width = W * d; canvas.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    const X = n => 14 + n.x * (W - 28), Y = n => top + n.y * (H - top - 36);

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      // streets
      ctx.lineCap = 'round';
      for (const n of nodes) {
        if (n.c < COLS - 1) line(n, at(n.c + 1, n.r), n.r === 3 ? .2 : .09, n.r === 3 ? 1.5 : 1);
        if (n.r < ROWS - 1) line(n, at(n.c, n.r + 1), n.c === 5 ? .2 : .09, n.c === 5 ? 1.5 : 1);
      }
      // planned routes
      for (const c of couriers) {
        if (!c.order || !c.path.length) continue;
        ctx.beginPath(); ctx.moveTo(X(c), Y(c));
        for (const n of c.path) ctx.lineTo(X(n), Y(n));
        ctx.strokeStyle = `rgba(${COBALT},.5)`; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
      }
      // orders: a ring that fills in the longer it waits
      for (const o of orders) {
        const age = Math.min(1, (t - o.born) / 7);
        ctx.beginPath(); ctx.arc(X(o.node), Y(o.node), 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(250,249,246,1)`; ctx.fill();
        ctx.fillStyle = `rgba(${INK},${age * .9})`; ctx.fill();
        ctx.strokeStyle = `rgba(${INK},.85)`; ctx.lineWidth = 1.5; ctx.stroke();
      }
      // delivered pulses
      for (const p of pulses) {
        const k = (t - p.t) / .6, e = 1 - Math.pow(1 - k, 3);
        ctx.beginPath(); ctx.arc(X(p), Y(p), 6 + e * 16, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${COBALT},${(1 - k) * .7})`; ctx.lineWidth = 1.5; ctx.stroke();
      }
      // couriers
      for (const c of couriers) {
        ctx.beginPath(); ctx.arc(X(c), Y(c), 6.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${COBALT})`; ctx.fill();
        ctx.strokeStyle = '#FAF9F6'; ctx.lineWidth = 2.5; ctx.stroke();
      }
    };
    const line = (a, b, alpha, w) => { ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.strokeStyle = `rgba(${INK},${alpha})`; ctx.lineWidth = w; ctx.stroke(); };

    let lastRead = 0;
    const read = now => {
      if (now - lastRead < 250) return; lastRead = now;
      if (!waits.length) { avgEl.textContent = maxEl.textContent = '0.0'; return; }
      avgEl.textContent = (waits.reduce((s, w) => s + w, 0) / waits.length).toFixed(1);
      maxEl.textContent = Math.max(...waits).toFixed(1);
    };

    let raf = 0, prev = 0;
    const frame = now => {
      const dt = Math.min(.05, (now - prev) / 1000 || 0); prev = now;
      if (!document.documentElement.classList.contains('still')) step(dt);
      draw(); read(now);
      raf = requestAnimationFrame(frame);
    };
    new ResizeObserver(() => { size(); draw(); }).observe(canvas);
    size();

    $$('button', seg).forEach(b => b.addEventListener('click', () => {
      rule = b.dataset.rule;
      $('.seg-pill', seg).style.transform = `translateX(${$$('button', seg).indexOf(b) * 100}%)`;
      $$('button', seg).forEach(x => x.setAttribute('aria-selected', x === b));
      waits = []; lastRead = 0;
    }));

    if (reduce) { for (let i = 0; i < 400; i++) step(.03); draw(); read(1e9); return; }
    whileVisible(canvas, () => { if (!raf) { prev = performance.now(); raf = requestAnimationFrame(frame); } }, () => { cancelAnimationFrame(raf); raf = 0; });
    document.addEventListener('visibilitychange', () => { prev = performance.now(); });
  })();
})();
