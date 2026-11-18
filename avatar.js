/* The clay avatar: a floating head and two hands, built from simple 3D shapes.
   It follows the pointer and changes pose when main.js sends a "pose" event:
   wave · drill (stopwatch) · route (map pin) · sheets (paper) · desk (laptop) · lift (barbell) · hand · rest
   You can also drag it to spin it and tap it to make it hop. */
(() => {
const THREE = window.THREE;
if (!THREE) { document.documentElement.classList.add('no-gl'); return; }

const stage = document.getElementById('stage');
const dock = document.getElementById('dock');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
catch { document.documentElement.classList.add('no-gl'); }

if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  stage.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.12, 8.0);

  /* ---------- Lights: soft key, cool rim, lots of fill (the clay look) ---------- */
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc9bd, 1.25));
  const key = new THREE.DirectionalLight(0xfff4e6, 2.1);
  key.position.set(3.2, 4.5, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 6; key.shadow.bias = -0.0015; key.shadow.normalBias = 0.03;
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 16 });
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fa2ff, 1.1);
  rim.position.set(-4, 1.5, -3);
  scene.add(rim);

  /* ---------- Materials ---------- */
  const clay = (color, roughness = 0.86, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const M = {
    skin: clay(0xC9946C), skinDeep: clay(0xB87F5A), hair: clay(0x1B1A1E, 0.96), lip: clay(0x6E3A33),
    cobalt: clay(0x1E3AF0, 0.55), white: clay(0xF7F5F0, 0.8), ink: clay(0x17181C, 0.7), steel: clay(0xA4A6AD, 0.32, 0.7),
  };
  const mesh = (geo, mat, parent, pos, scale, rot) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = m.receiveShadow = true;
    if (pos) m.position.set(...pos);
    if (scale) m.scale.set(...scale);
    if (rot) m.rotation.set(...rot);
    parent.add(m);
    return m;
  };
  const sphere = new THREE.SphereGeometry(1, 40, 32);
  const ball = new THREE.SphereGeometry(1, 20, 16);

  const rig = new THREE.Group();          // everything
  rig.position.y = -0.12;
  scene.add(rig);

  /* ---------- Head ---------- */
  const head = new THREE.Group();
  rig.add(head);
  const SX = 0.95, SY = 1.03, SZ = 0.93;
  // The head starts as a sphere and is reshaped: the sides run down to a clear jaw corner,
  // then cut in sharply to a flat, slightly forward chin.
  const JAW = [[-1, 0.9], [-0.93, 0.96], [-0.76, 0.9], [-0.5, 1.12], [-0.1, 1.0], [1, 1.0]];   // [height, width factor]
  const wf = py => {
    for (let i = 1; i < JAW.length; i++) if (py <= JAW[i][0]) { const [a, wa] = JAW[i - 1], [b, wb] = JAW[i]; return wa + (wb - wa) * (py - a) / (b - a); }
    return 1;
  };
  const CHIN = -0.9;
  const fwd = py => (py < -0.45 ? 0.08 * Math.min(1, (-0.45 - py) / 0.4) : 0);
  const headGeo = new THREE.SphereGeometry(1, 72, 56);
  headGeo.rotateY(-Math.PI / 2);                       // put the geometry's seam at the back, under the hair
  const hp = headGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const px = hp.getX(i), py = hp.getY(i), pz = hp.getZ(i), cy = Math.max(py, CHIN);
    hp.setXYZ(i, px * SX * wf(cy), cy * SY, pz * SZ + (pz > 0 ? fwd(cy) * Math.min(1, pz * 3) : 0));
  }
  headGeo.computeVertexNormals();
  mesh(headGeo, M.skin, head);
  // point on the front of the face for a given x, y
  const face = (x, y, out = 0) => {
    const py = Math.max(y / SY, CHIN), px = x / (SX * wf(py));
    return [x, y, SZ * Math.sqrt(Math.max(0, 1 - py * py - px * px)) + fwd(py) + out];
  };

  mesh(ball, M.skin, head, [-0.93, -0.04, -0.02], [0.1, 0.18, 0.14]);
  mesh(ball, M.skin, head, [0.93, -0.04, -0.02], [0.1, 0.18, 0.14]);
  mesh(ball, M.skinDeep, head, face(0, -0.14, 0.02), [0.1, 0.11, 0.1]);          // nose

  const eyes = new THREE.Group(); head.add(eyes);
  for (const s of [-1, 1]) {
    mesh(ball, M.ink, eyes, face(0.33 * s, 0.06, -0.02), [0.082, 0.105, 0.05]);
    mesh(ball, M.white, eyes, face(0.33 * s + 0.028, 0.1, 0.022), [0.022, 0.022, 0.012]);
  }
  const brows = [];
  for (const s of [-1, 1]) {
    brows.push(mesh(new THREE.CapsuleGeometry(0.042, 0.24, 6, 12), M.hair, head, face(0.34 * s, 0.31, 0.0), null, [0, 0, Math.PI / 2 - 0.1 * s]));
  }
  // light moustache, small smile, chin beard
  for (const s of [-1, 1]) mesh(new THREE.CapsuleGeometry(0.026, 0.15, 6, 10), M.hair, head, face(0.105 * s, -0.3, 0.0), null, [0, 0, Math.PI / 2 - 0.22 * s]);
  mesh(new THREE.TorusGeometry(0.115, 0.022, 10, 24, Math.PI), M.lip, head, face(0, -0.44, 0.0), [1, 0.62, 1], [0.25, 0, Math.PI]);
  mesh(ball, M.hair, head, face(0, -0.74, -0.08), [0.2, 0.13, 0.14]);

  // curly hair: a cloud of clay blobs, taller on top and short at the sides
  let seed = 23;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const hair = new THREE.Group(); head.add(hair);
  for (let i = 0; i < 150; i++) {
    const u = rnd() * Math.PI * 2, phi = Math.acos(1 - rnd() * 0.86);
    const x = Math.sin(phi) * Math.cos(u), y = Math.cos(phi), z = Math.sin(phi) * Math.sin(u);
    if (z > 0.5 && y < 0.7) continue;                 // keep the forehead clear
    if (y < 0.16) continue;
    if (y < 0.42 && z > 0.12) continue;               // temples
    const top = y > 0.55;
    const r = top ? 0.2 + rnd() * 0.11 : 0.12 + rnd() * 0.05;
    const k = top ? 1.07 : 0.99;
    mesh(ball, M.hair, hair, [x * SX * k, y * SY * k + (top ? 0.05 : 0), z * SZ * k], [r, r * (0.85 + rnd() * 0.3), r]);
  }

  /* ---------- Hands ---------- */
  // A palm, four fingers that can curl, and a thumb
  const makeHand = side => {
    const g = new THREE.Group();
    mesh(sphere, M.skin, g, [0, -0.02, 0], [0.245, 0.235, 0.135]);
    const fingers = [];
    [-0.168, -0.058, 0.055, 0.162].forEach((x, i) => {
      const knuckle = new THREE.Group();
      knuckle.position.set(x, 0.12, 0); knuckle.rotation.z = -x * 0.95;
      const len = [0.2, 0.25, 0.235, 0.165][side > 0 ? i : 3 - i];       // index, middle, ring, little
      mesh(new THREE.CapsuleGeometry(0.058, len, 6, 12), M.skin, knuckle, [0, len / 2 + 0.035, 0]);
      g.add(knuckle); fingers.push(knuckle);
    });
    const thumb = new THREE.Group();
    thumb.position.set(-0.2 * side, -0.07, 0.03); thumb.rotation.z = 1.0 * side;
    mesh(new THREE.CapsuleGeometry(0.064, 0.15, 6, 12), M.skin, thumb, [0, 0.11, 0]);
    g.add(thumb);
    g.userData = { fingers, curl: 0.25 };
    rig.add(g);
    return g;
  };
  const handL = makeHand(-1), handR = makeHand(1);

  /* ---------- Props ---------- */
  const props = {};
  const prop = name => { const g = new THREE.Group(); g.visible = false; rig.add(g); props[name] = g; return g; };

  { // barbell
    const g = prop('barbell');
    mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.1, 16), M.steel, g, null, null, [0, 0, Math.PI / 2]);
    for (const s of [-1, 1]) {
      mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 40), M.cobalt, g, [1.2 * s, 0, 0], null, [0, 0, Math.PI / 2]);
      mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.09, 40), M.ink, g, [1.31 * s, 0, 0], null, [0, 0, Math.PI / 2]);
      mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 20), M.steel, g, [1.4 * s, 0, 0], null, [0, 0, Math.PI / 2]);
    }
  }
  let needle;
  { // stopwatch
    const g = prop('watch');
    mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 40), M.cobalt, g, null, null, [Math.PI / 2, 0, 0]);
    mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 40), M.white, g, [0, 0, 0.05], null, [Math.PI / 2, 0, 0]);
    mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 16), M.ink, g, [0, 0.39, 0]);
    needle = new THREE.Group(); needle.position.z = 0.07; g.add(needle);
    mesh(new THREE.BoxGeometry(0.03, 0.22, 0.015), M.ink, needle, [0, 0.1, 0]);
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12), M.ink, needle, null, null, [Math.PI / 2, 0, 0]);
  }
  { // map pin
    const g = prop('pin');
    mesh(sphere, M.cobalt, g, [0, 0.22, 0], [0.27, 0.27, 0.27]);
    mesh(new THREE.ConeGeometry(0.21, 0.46, 32), M.cobalt, g, [0, -0.13, 0], null, [Math.PI, 0, 0]);
    mesh(ball, M.white, g, [0, 0.22, 0.2], [0.1, 0.1, 0.1]);
  }
  { // worksheet
    const g = prop('paper');
    mesh(new THREE.BoxGeometry(0.66, 0.9, 0.025), M.white, g);
    mesh(new THREE.BoxGeometry(0.5, 0.035, 0.03), M.cobalt, g, [0, 0.3, 0.004]);
    for (let i = 0; i < 5; i++) mesh(new THREE.BoxGeometry(i % 2 ? 0.34 : 0.5, 0.022, 0.03), M.steel, g, [i % 2 ? -0.08 : 0, 0.16 - i * 0.11, 0.004]);
  }
  { // laptop
    const g = prop('laptop');
    mesh(new THREE.BoxGeometry(1.25, 0.05, 0.8), M.steel, g, [0, 0, 0]);
    const lid = new THREE.Group(); lid.position.set(0, 0.02, -0.4); lid.rotation.x = -0.3; g.add(lid);
    mesh(new THREE.BoxGeometry(1.25, 0.8, 0.045), M.steel, lid, [0, 0.4, 0]);
    mesh(new THREE.BoxGeometry(1.13, 0.68, 0.01), M.ink, lid, [0, 0.4, 0.026]);
    mesh(new THREE.BoxGeometry(0.5, 0.04, 0.012), M.cobalt, lid, [-0.22, 0.56, 0.032]);
    mesh(new THREE.BoxGeometry(0.72, 0.03, 0.012), M.white, lid, [-0.11, 0.44, 0.032]);
    mesh(new THREE.BoxGeometry(0.4, 0.03, 0.012), M.white, lid, [-0.27, 0.34, 0.032]);
  }

  /* ---------- Pose state ---------- */
  let pose = window.__pose || 'wave', poseAt = 0, clock = 0;
  const propOf = { drill: 'watch', route: 'pin', sheets: 'paper', desk: 'laptop', lift: 'barbell' };
  const pop = { s: 1, v: 0 };              // spring for the prop popping in
  const setPose = name => {
    if (name === pose) return;
    pose = name; poseAt = clock;
    for (const k in props) props[k].visible = propOf[name] === k;
    pop.s = 0.72; pop.v = 0;
  };
  addEventListener('pose', e => setPose(e.detail));

  const tL = new THREE.Vector3(), tR = new THREE.Vector3();
  const look = { x: 0, y: 0 }, lookT = { x: 0, y: 0 }, pointer = { x: 0, y: 0 };
  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const r = canvas.getBoundingClientRect();
    pointer.x = THREE.MathUtils.clamp((e.clientX - (r.left + r.width / 2)) / (innerWidth * 0.5), -1, 1);
    pointer.y = THREE.MathUtils.clamp((e.clientY - (r.top + r.height / 2)) / (innerHeight * 0.5), -1, 1);
  }, { passive: true });

  // Drag to spin (keeps its momentum, then springs back), tap to hop
  const spin = { a: 0, v: 0, drag: false, lastX: 0, moved: 0 };
  const hop = { y: 0, v: 0 };
  canvas.style.touchAction = 'pan-y';
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', e => { spin.drag = true; spin.lastX = e.clientX; spin.moved = 0; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointermove', e => {
    if (!spin.drag) return;
    const dx = e.clientX - spin.lastX; spin.lastX = e.clientX; spin.moved += Math.abs(dx);
    spin.a += dx * 0.012; spin.v = dx * 0.6;
  });
  const release = () => { if (!spin.drag) return; spin.drag = false; canvas.style.cursor = 'grab'; if (spin.moved < 6 && !reduce) hop.v = 5.2; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', () => { spin.drag = false; canvas.style.cursor = 'grab'; });
  let intro = reduce ? 1 : 0.86, introV = 0;      // small spring as it first appears

  const ease = k => k * k * (3 - 2 * k);
  let nextBlink = 2.5, blink = 0;

  const update = dt => {
    clock += dt;
    const t = (reduce || document.documentElement.classList.contains('still')) ? 0 : clock, since = clock - poseAt;
    const follow = 1 - Math.exp(-dt * 11);
    tL.set(-1.18, -1.12, 0.45); tR.set(1.18, -1.12, 0.45);
    let rotR = 0, rotL = 0, headUp = 0, poseLookX = 0, poseLookY = 0, effort = 0, curlL = 0.25, curlR = 0.25;

    switch (pose) {
      case 'wave':
        curlR = 0.05; tR.set(1.36, 0.3, 0.5); rotR = -0.25 + Math.sin(t * 7) * 0.42;
        break;
      case 'drill':
        tR.set(1.12, -0.86, 0.75); props.watch.position.set(1.12, -0.3, 0.75);
        needle.rotation.z = -t * 5; curlR = 1; poseLookY = 0.2; poseLookX = 0.22;
        break;
      case 'route':
        tR.set(1.16, -0.98, 0.6); props.pin.position.set(1.16, -0.32 + Math.sin(t * 2.2) * 0.07, 0.6);
        props.pin.rotation.y = t * 1.4; curlR = 1; poseLookY = 0.12; poseLookX = 0.2;
        break;
      case 'sheets':
        tR.set(1.2, -0.92, 0.72); props.paper.position.set(1.14, -0.36, 0.7);
        props.paper.rotation.set(-0.1, -0.35, -0.1); curlR = 1; poseLookY = 0.16; poseLookX = 0.24;
        break;
      case 'desk': {
        const tap = reduce ? 0 : Math.max(0, Math.sin(t * 13)) * 0.05, tap2 = reduce ? 0 : Math.max(0, Math.sin(t * 13 + 2)) * 0.05;
        headUp = 0.22; curlL = curlR = 0.55;
        props.laptop.position.set(0, -1.42, 0.55);
        tL.set(-0.36, -1.24 + tap, 0.86); tR.set(0.36, -1.24 + tap2, 0.86);
        poseLookY = 0.3;
        break;
      }
      case 'lift': {
        let p = 1;
        if (!reduce) {
          const c = (since % 2.8) / 2.8;
          p = c < 0.36 ? ease(c / 0.36) : c < 0.56 ? 1 : c < 0.86 ? 1 - ease((c - 0.56) / 0.3) : 0;
          effort = c < 0.36 ? Math.sin((c / 0.36) * Math.PI) : 0;
        }
        const y = -0.78 + p * 2.38, z = p < 0.62 ? 1.24 : 1.24 - ((p - 0.62) / 0.38) * 0.9;
        tL.set(-0.82, y, z); tR.set(0.82, y, z);
        handL.position.copy(tL); handR.position.copy(tR);   // grip stays locked to the bar
        props.barbell.position.set(0, y + 0.02, z); curlL = curlR = 1.5;
        poseLookY = -0.12 * p;
        break;
      }
      case 'hand':
        tR.set(1.22, 1.0, 0.3); rotR = -0.12; curlR = 0; poseLookX = 0.12; poseLookY = -0.1;
        break;
    }

    handL.position.lerp(tL, follow); handR.position.lerp(tR, follow);
    handR.rotation.z += (rotR - handR.rotation.z) * follow;
    handL.rotation.z += (rotL - handL.rotation.z) * follow;
    for (const [h, target] of [[handL, curlL], [handR, curlR]]) {      // fingers open to wave, close to grip
      h.userData.curl += (target - h.userData.curl) * follow;
      for (const k of h.userData.fingers) k.rotation.x = h.userData.curl;
    }

    // prop pop-in (subtle spring)
    pop.v += ((1 - pop.s) * 190 - pop.v * 17) * dt; pop.s += pop.v * dt;
    const active = props[propOf[pose]]; if (active) active.scale.setScalar(pop.s);

    // head: follows the pointer with a little lag, plus a gentle float
    lookT.x = (reduce ? 0 : pointer.x * 0.5) + poseLookX; lookT.y = (reduce ? 0 : pointer.y * 0.32) + poseLookY;
    const lag = 1 - Math.exp(-dt * 6);
    look.x += (lookT.x - look.x) * lag; look.y += (lookT.y - look.y) * lag;
    if (!spin.drag) {                       // spring the spin back to facing forward, carrying velocity
      const turns = Math.round(spin.a / (Math.PI * 2)) * Math.PI * 2;
      spin.v += ((turns - spin.a) * 38 - spin.v * 7) * dt; spin.a += spin.v * dt;
    }
    hop.v += (-hop.y * 120 - hop.v * 9) * dt; hop.y += hop.v * dt;
    introV += ((1 - intro) * 160 - introV * 15) * dt; intro += introV * dt;
    rig.rotation.y = spin.a; rig.position.y = -0.12 + Math.max(0, hop.y) * 0.5; rig.scale.setScalar(intro);
    head.rotation.set(look.y, look.x, -look.x * 0.08);
    head.position.y += ((headUp + Math.sin(t * 1.6) * 0.035) - head.position.y) * lag;
    for (const [i, b] of brows.entries()) b.rotation.z = Math.PI / 2 + (i ? -1 : 1) * (0.1 - effort * 0.3);

    // blink
    nextBlink -= dt;
    if (nextBlink < 0 && !reduce) { blink = 0.14; nextBlink = 2.4 + Math.random() * 3; }
    blink = Math.max(0, blink - dt);
    eyes.scale.y += ((blink > 0 || effort > 0.5 ? 0.12 : 1) - eyes.scale.y) * (1 - Math.exp(-dt * 40));
  };

  /* ---------- Sizing, docking and the render loop ---------- */
  const fit = () => {
    const host = canvas.parentElement, w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(fit); ro.observe(stage); ro.observe(dock);

  // Big in the hero; once the hero scrolls away it moves into the round dock in the corner.
  new IntersectionObserver(([e]) => {
    const docked = !e.isIntersecting;
    (docked ? dock : stage).appendChild(canvas);
    dock.toggleAttribute('data-on', docked);
    camera.position.z = docked ? 9.6 : 8.0;      // a little more room inside the small circle
    fit();
  }, { threshold: 0.12 }).observe(stage);

  for (const k in props) props[k].visible = propOf[pose] === k;
  let last = performance.now(), raf = 0;
  const frame = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  const run = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else run(); });
  fit(); update(0.016); renderer.render(scene, camera); run();   // draw once straight away
  // If the browser is not giving us animation frames (background tab), still keep the picture fresh
  setInterval(() => { if (!document.hidden && performance.now() - last > 400) { last = performance.now(); update(0.05); renderer.render(scene, camera); } }, 500);
}
})();
