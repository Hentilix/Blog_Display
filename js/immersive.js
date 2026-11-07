(() => {
  const root = document.documentElement;
  const nav = document.querySelector('.site-nav');
  const menuButton = document.querySelector('.site-menu-toggle');
  const links = document.getElementById('site-links');
  const mobile = matchMedia('(max-width: 900px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

  if (nav && menuButton && links) {
    root.classList.add('nav-enhanced');
    menuButton.hidden = false;
    function closeMenu(restoreFocus = false) {
      menuButton.setAttribute('aria-expanded', 'false');
      links.classList.remove('is-open');
      nav.classList.remove('is-open');
      if (restoreFocus) menuButton.focus();
    }
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') !== 'true';
      menuButton.setAttribute('aria-expanded', String(open));
      links.classList.toggle('is-open', open);
      nav.classList.toggle('is-open', open);
    });
    links.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMenu();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const contact = nav.querySelector('details[open]');
      if (contact) { contact.open = false; contact.querySelector('summary').focus(); }
      else if (menuButton.getAttribute('aria-expanded') === 'true') closeMenu(true);
    });
    document.addEventListener('click', (event) => {
      if (!nav.contains(event.target)) {
        closeMenu();
        nav.querySelectorAll('details[open]').forEach(detail => { detail.open = false; });
      }
    });
    mobile.addEventListener('change', () => closeMenu());
  }

  const scene = document.querySelector('.rain-scene');
  let inView = true;
  const canAnimate = () => inView && !document.hidden && !reducedMotion.matches;
  let scrollFrame = 0;
  function updateScroll() {
    scrollFrame = 0;
    nav?.classList.toggle('is-scrolled', scrollY > 30);
    if (scene && canAnimate()) {
      const progress = Math.min(scrollY / scene.offsetHeight, 1);
      scene.style.setProperty('--scene-scale', String(1 + progress * .06));
    }
  }
  window.addEventListener('scroll', () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
  }, { passive: true });
  updateScroll();

  const canvas = document.getElementById('rain-canvas');
  const ctx = canvas?.getContext('2d');
  if (!scene || !ctx) return;
  const wakeLayer = scene.querySelector('.rain-scene__wake');
  // Six reusable lenses keep the blur local; older strokes yield to new ones.
  const lenses = wakeLayer && (CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)'))
    ? Array.from({ length: 6 }, () => {
      const element = document.createElement('span');
      element.className = 'rain-wake';
      wakeLayer.appendChild(element);
      return { element, animation: null };
    }) : [];
  let width = 0, height = 0, frame = 0, previousTime = 0;
  let pointerX = 0, pointerY = 0, lensIndex = 0, lastWake = -Infinity;
  let lastWakeX = null, lastWakeY = null;
  let smoothX = 0, smoothY = 0, rippleElapsed = 0;
  let drops = [], rings = [];
  let dark = root.dataset.theme === 'dark';
  const randomDrop = () => ({ x: Math.random() * width, y: Math.random() * height, depth: .3 + Math.random() * .7 });
  function resize() {
    width = scene.clientWidth; height = scene.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drops = Array.from({ length: width < 600 ? 18 : 48 }, randomDrop);
    rings = [];
  }
  function clearWake() {
    lenses.forEach(lens => { lens.animation?.cancel(); lens.animation = null; });
    lastWakeX = lastWakeY = null;
    lastWake = -Infinity;
  }
  function leavePointer() {
    pointerX = pointerY = 0;
    lastWakeX = lastWakeY = null;
  }
  function spawnWake(x, y, time) {
    if (time - lastWake < 80 || (lastWakeX !== null && Math.hypot(x - lastWakeX, y - lastWakeY) < 20)) return;
    const angle = lastWakeX === null ? -20 : Math.atan2(y - lastWakeY, x - lastWakeX) * 180 / Math.PI;
    if (lenses.length) {
      const lens = lenses[lensIndex++ % lenses.length];
      lens.animation?.cancel();
      const position = `translate3d(${x - 130}px, ${y - 100}px, 0) rotate(${angle}deg)`;
      lens.animation = lens.element.animate([
        { transform: `${position} scale(.55, .7)`, opacity: .75 },
        { transform: `${position} scale(.85, .9)`, opacity: 1, offset: .12 },
        { transform: `${position} scale(1, 1)`, opacity: .95, offset: .38 },
        { transform: `${position} scale(1.3, 1.1)`, opacity: 0 }
      ], { duration: 1200, easing: 'linear' });
    }
    rings.push({ x, y, age: 0, pointer: true });
    if (rings.length > 16) rings.shift();
    lastWakeX = x; lastWakeY = y; lastWake = time;
  }
  function syncAnimation() {
    cancelAnimationFrame(frame); frame = 0; previousTime = 0;
    scene.style.setProperty('--mist-play-state', canAnimate() ? 'running' : 'paused');
    if (canAnimate()) frame = requestAnimationFrame(draw);
    else {
      clearWake(); leavePointer(); rings = []; rippleElapsed = 0;
      ctx.clearRect(0, 0, width, height);
      scene.style.setProperty('--scene-x', '0px'); scene.style.setProperty('--scene-y', '0px');
      if (reducedMotion.matches) scene.style.setProperty('--scene-scale', '1');
    }
  }
  function draw(time) {
    if (!canAnimate()) { frame = 0; return; }
    const dt = previousTime ? Math.min((time - previousTime) / 1000, .04) : .016;
    previousTime = time;
    ctx.clearRect(0, 0, width, height);
    smoothX += (pointerX - smoothX) * Math.min(dt * 3, 1);
    smoothY += (pointerY - smoothY) * Math.min(dt * 3, 1);
    scene.style.setProperty('--scene-x', `${smoothX * 8}px`);
    scene.style.setProperty('--scene-y', `${smoothY * 5}px`);
    ctx.lineWidth = .7;
    for (const drop of drops) {
      const speed = 110 + drop.depth * 150;
      drop.y += speed * dt; drop.x += (12 + smoothX * 32) * dt;
      if (drop.y > height + 30) { drop.y = -30; drop.x = Math.random() * width; }
      if (drop.x > width) drop.x = 0;
      ctx.strokeStyle = `rgba(${dark ? '200,230,218' : '35,73,62'},${.035 + drop.depth * .07})`;
      ctx.beginPath(); ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x + 2 + smoothX * 3, drop.y + 8 + drop.depth * 14); ctx.stroke();
    }
    // Ambient water moves slowly; the existing pointer wake keeps its immediate response.
    rippleElapsed += dt;
    if (rippleElapsed > 1.6) {
      rings.push({ x: Math.random() * width, y: height * (.68 + Math.random() * .2), age: 0 });
      rippleElapsed = 0;
    }
    rings = rings.filter(ring => ring.age < (ring.pointer ? 2 : 3.6));
    for (const ring of rings) {
      ring.age += dt;
      const opacity = ring.pointer ? .3 * (1 - ring.age / 2) : .1 * Math.sin(Math.PI * Math.min(ring.age / 3.6, 1));
      ctx.strokeStyle = `rgba(${dark ? '190,225,210' : '32,70,59'},${Math.max(0, opacity)})`;
      ctx.beginPath(); ctx.ellipse(ring.x, ring.y, (ring.pointer ? 14 : 4) + ring.age * (ring.pointer ? 30 : 18), (ring.pointer ? 6 : 1) + ring.age * (ring.pointer ? 16 : 4), 0, 0, Math.PI * 2); ctx.stroke();
    }
    frame = requestAnimationFrame(draw);
  }
  scene.addEventListener('pointermove', event => {
    if (!finePointer.matches || event.pointerType !== 'mouse' || !canAnimate()) return;
    const bounds = scene.getBoundingClientRect();
    const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
    pointerX = x / width - .5;
    pointerY = y / height - .5;
    spawnWake(x, y, performance.now());
  }, { passive: true });
  scene.addEventListener('pointerleave', leavePointer);
  finePointer.addEventListener('change', () => {
    if (!finePointer.matches) { clearWake(); leavePointer(); }
  });
  new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting; syncAnimation();
  }).observe(scene);
  new ResizeObserver(resize).observe(scene);
  document.addEventListener('visibilitychange', syncAnimation);
  reducedMotion.addEventListener('change', syncAnimation);
  document.addEventListener('hentilix:themechange', event => { dark = event.detail.theme === 'dark'; });
  resize(); syncAnimation();
})();
