(() => {
  const content = document.querySelector('[data-toc-content]');
  const toc = document.querySelector('.article-toc');
  if (!content || !toc) return;

  let headings = [...content.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter(heading =>
    heading.textContent.trim() && !heading.closest('pre, code, nav, [hidden], [aria-hidden="true"], [data-toc-ignore]')
  );

  // Existing hand-written directories remain the no-JavaScript fallback.
  const manualHeading = headings[0];
  const manualList = manualHeading?.nextElementSibling;
  const manualLinks = [...(manualList?.querySelectorAll('a') || [])];
  const isManual = /^(目录|目次|table of contents)$/i.test(manualHeading?.textContent.trim() || '') &&
    manualList?.matches('ul, ol') && manualLinks.length > 0 && manualLinks.every(link => {
      const href = link.getAttribute('href');
      if (!href?.startsWith('#')) return false;
      try { return headings.includes(document.getElementById(decodeURIComponent(href.slice(1)))); }
      catch (_) { return false; }
    });
  if (isManual) headings = headings.filter(heading => heading !== manualHeading);
  if (headings.length < 2) return;

  const panel = toc.querySelector('details');
  const summary = panel.querySelector('summary');
  const nav = toc.querySelector('nav');
  const list = nav.querySelector('ul');
  const wide = window.matchMedia('(min-width: 1280px)');
  const stack = [{ level: 0, list }];
  const entries = headings.map((heading, index) => {
    const text = heading.textContent.trim().replace(/\s+/g, ' ');
    const slug = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
    const base = heading.id || `section-${slug || index + 1}`;
    let id = base, suffix = 2;
    while (document.getElementById(id) && document.getElementById(id) !== heading) id = `${base}-${suffix++}`;
    heading.id = id;
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;

    const link = document.createElement('a');
    link.href = `#${encodeURIComponent(id)}`;
    link.textContent = text;
    const item = document.createElement('li');
    item.appendChild(link);
    const level = Number(heading.tagName.slice(1));
    while (stack.at(-1).level >= level) stack.pop();
    const parent = stack.at(-1);
    if (!parent.list) {
      parent.list = document.createElement('ul');
      parent.item.appendChild(parent.list);
    }
    parent.list.appendChild(item);
    stack.push({ level, item });
    return { heading, link };
  });

  if (isManual) { manualHeading.hidden = true; manualList.hidden = true; }
  toc.querySelector('.article-toc__count').textContent = `${headings.length} 节`;
  panel.open = wide.matches;
  toc.hidden = false;
  document.documentElement.classList.add('has-article-toc');

  function revealHeading(heading) {
    for (let parent = heading.parentElement; parent && parent !== content; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') parent.open = true;
    }
  }
  nav.addEventListener('click', event => {
    const link = event.target.closest('a');
    const entry = entries.find(entry => entry.link === link);
    if (!entry || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!wide.matches) panel.open = false;
    revealHeading(entry.heading);
    entry.heading.focus({ preventScroll: true });
    // Let native fragment navigation own the URL, scroll behavior and history.
  });
  toc.addEventListener('keydown', event => {
    if (event.key === 'Escape' && panel.open) {
      panel.open = false;
      summary.focus();
      event.stopPropagation();
    }
  });

  let current = null, frame = 0;
  function updateCurrent() {
    frame = 0;
    const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) +
      parseFloat(getComputedStyle(headings[0]).scrollMarginTop) + 2;
    let next = entries[0];
    for (const entry of entries) {
      if (!entry.heading.getClientRects().length) continue;
      if (entry.heading.getBoundingClientRect().top <= offset) next = entry;
      else break;
    }
    if (next !== current) {
      current?.link.removeAttribute('aria-current');
      next.link.setAttribute('aria-current', 'location');
      current = next;
    }
    // Scroll only the directory, never the document, when its active item is clipped.
    if (panel.open) {
      const bounds = nav.getBoundingClientRect();
      const active = current.link.getBoundingClientRect();
      if (active.top < bounds.top) nav.scrollTop += active.top - bounds.top - 8;
      else if (active.bottom > bounds.bottom) nav.scrollTop += active.bottom - bounds.bottom + 8;
    }
  }
  function scheduleUpdate() {
    if (!frame) frame = requestAnimationFrame(updateCurrent);
  }
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('load', scheduleUpdate);
  panel.addEventListener('toggle', scheduleUpdate);
  wide.addEventListener('change', () => { panel.open = wide.matches; scheduleUpdate(); });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(scheduleUpdate).observe(content);

  function followHash(initial = false) {
    let heading;
    try { heading = document.getElementById(decodeURIComponent(window.location.hash.slice(1))); }
    catch (_) { return; }
    if (headings.includes(heading)) {
      const wasHidden = !heading.getClientRects().length;
      revealHeading(heading);
      // HTML headings gain IDs here, after the browser's first fragment lookup.
      if (initial || wasHidden) heading.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
    scheduleUpdate();
  }
  window.addEventListener('hashchange', () => followHash());
  followHash(true);
})();
