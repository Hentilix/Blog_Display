(() => {
  const root = document.documentElement;
  const themeButton = document.getElementById("theme-toggle");
  const themeIcon = themeButton?.querySelector(".theme-toggle__icon");

  function syncGiscusTheme(theme) {
    const frame = document.querySelector("iframe.giscus-frame");
    if (!frame?.contentWindow) return;

    frame.contentWindow.postMessage(
      { giscus: { setConfig: { theme } } },
      "https://giscus.app"
    );
  }

  function applyTheme(theme, persist = false) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    root.dataset.theme = nextTheme;

    if (themeButton) {
      const isDark = nextTheme === "dark";
      const label = isDark ? "切换到白天模式" : "切换到夜间模式";
      themeButton.setAttribute("aria-pressed", String(isDark));
      themeButton.setAttribute("aria-label", label);
      themeButton.title = label;
      if (themeIcon) themeIcon.textContent = isDark ? "☀" : "☾";
    }

    if (persist) {
      try {
        window.localStorage.setItem("hentilix-theme", nextTheme);
      } catch (_) {
        // The current page still changes theme when storage is unavailable.
      }
    }

    syncGiscusTheme(nextTheme);
    document.dispatchEvent(new CustomEvent("hentilix:themechange", { detail: { theme: nextTheme } }));
  }

  applyTheme(root.dataset.theme);
  themeButton?.addEventListener("click", () => {
    applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
  });

  const giscusScript = document.querySelector("script[src*='giscus.app/client.js']");
  const giscusFrame = document.querySelector("iframe.giscus-frame");
  if (giscusScript && giscusFrame) {
    giscusFrame.addEventListener("load", () => {
      syncGiscusTheme(root.dataset.theme);
    }, { once: true });
  } else if (giscusScript) {
    const giscusObserver = new MutationObserver(() => {
      const frame = document.querySelector("iframe.giscus-frame");
      if (!frame) return;
      frame.addEventListener("load", () => syncGiscusTheme(root.dataset.theme), { once: true });
      giscusObserver.disconnect();
    });
    giscusObserver.observe(document.body, { childList: true, subtree: true });
  }

  const tabs = Array.from(document.querySelectorAll(".collection-tab"));
  const panels = Array.from(document.querySelectorAll(".collection-panel"));

  if (tabs.length && panels.length) {
    const activateTab = (tab, updateHash = true) => {
      const category = tab.dataset.category;

      tabs.forEach((candidate) => {
        const selected = candidate === tab;
        candidate.setAttribute("aria-selected", String(selected));
        candidate.tabIndex = selected ? 0 : -1;
      });

      panels.forEach((panel) => {
        panel.hidden = panel.id !== `collection-panel-${category}`;
      });

      if (updateHash) history.replaceState(null, "", `#${category}`);
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activateTab(tab));
      tab.addEventListener("keydown", (event) => {
        let nextIndex = index;
        if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
        else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = tabs.length - 1;
        else return;

        event.preventDefault();
        tabs[nextIndex].focus();
        activateTab(tabs[nextIndex]);
      });
    });

    const hashCategory = window.location.hash.slice(1);
    const initialTab = tabs.find((tab) => tab.dataset.category === hashCategory) || tabs[0];
    activateTab(initialTab, false);

    const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
    panels.forEach((panel) => {
      const grid = panel.querySelector(".collection-grid");
      if (!grid) return;
      Array.from(grid.querySelectorAll(".collection-card"))
        .sort((a, b) => collator.compare(a.dataset.title || "", b.dataset.title || ""))
        .forEach((card) => grid.appendChild(card));
    });
  }

  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const cursor = document.getElementById("star-cursor");
  const canvas = document.getElementById("star-trail");
  const context = canvas?.getContext("2d");

  if (!finePointer.matches || reducedMotion.matches || !cursor || !canvas || !context) return;

  document.body.classList.add("custom-cursor-active");

  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let previousX = null;
  let previousY = null;
  let lastSpawn = 0;
  let animationFrame = 0;
  const stars = [];
  const interactiveSelector = "a, button, [role='button'], input[type='button'], input[type='submit'], .post-preview, .collection-card";
  const textEntrySelector = "iframe, textarea, [contenteditable='true'], input:not([type='button']):not([type='submit']):not([type='reset']):not([type='checkbox']):not([type='radio']):not([type='range'])";

  function resizeCanvas() {
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function addStar(x, y) {
    stars.push({
      x,
      y,
      driftX: (Math.random() - 0.5) * 0.36,
      driftY: -0.24 - Math.random() * 0.42,
      size: 1 + Math.random() * 2.1,
      life: 1,
      decay: 0.018 + Math.random() * 0.016,
    });
    if (stars.length > 34) stars.splice(0, stars.length - 34);
  }

  function drawStar(star) {
    const points = 4;
    const innerRadius = star.size * 0.28;
    context.beginPath();
    for (let index = 0; index < points * 2; index += 1) {
      const radius = index % 2 === 0 ? star.size : innerRadius;
      const angle = (Math.PI * index) / points - Math.PI / 2;
      const x = star.x + Math.cos(angle) * radius;
      const y = star.y + Math.sin(angle) * radius;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.globalAlpha = Math.max(0, star.life);
    context.fill();
  }

  function animate() {
    context.clearRect(0, 0, width, height);
    context.fillStyle = getComputedStyle(root).getPropertyValue("--accent-strong").trim() || "#1769c2";

    for (let index = stars.length - 1; index >= 0; index -= 1) {
      const star = stars[index];
      star.x += star.driftX;
      star.y += star.driftY;
      star.life -= star.decay;
      if (star.life <= 0) {
        stars.splice(index, 1);
        continue;
      }
      drawStar(star);
    }

    context.globalAlpha = 1;
    if (stars.length) animationFrame = window.requestAnimationFrame(animate);
    else animationFrame = 0;
  }

  function startAnimation() {
    if (!animationFrame) animationFrame = window.requestAnimationFrame(animate);
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas, { passive: true });

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;

    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(textEntrySelector)) {
      cursor.classList.remove("is-visible", "is-interactive");
      return;
    }

    cursor.classList.add("is-visible");
    cursor.classList.toggle("is-interactive", Boolean(target?.closest(interactiveSelector)));
    cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`;

    const now = performance.now();
    const distance = previousX === null ? Infinity : Math.hypot(event.clientX - previousX, event.clientY - previousY);
    if (distance >= 9 && now - lastSpawn >= 18) {
      addStar(event.clientX, event.clientY);
      previousX = event.clientX;
      previousY = event.clientY;
      lastSpawn = now;
      startAnimation();
    }
  }, { passive: true });

  document.documentElement.addEventListener("pointerleave", () => {
    cursor.classList.remove("is-visible", "is-interactive");
  });

})();
