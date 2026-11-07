/* Native scrolling, bounded repeated segments, and one shared review preview. */
(() => {
  'use strict';
  const storageKey = 'hentilix-collection-position';
  const readPosition = () => {
    try { return JSON.parse(sessionStorage.getItem(storageKey)) || {}; } catch { return {}; }
  };
  const returnLink = document.querySelector('[data-collection-return]');
  if (returnLink) {
    const destination = new URL(returnLink.href);
    destination.searchParams.set('item', returnLink.dataset.collectionReturn);
    returnLink.href = destination.href;
    return;
  }
  const gallery = document.querySelector('.collection-gallery');
  if (!gallery || !window.CollectionLayout) return;
  const {layoutCovers, wrapOffset, locateAnchor, restoreAnchor} = window.CollectionLayout;
  const viewport = gallery.querySelector('.collection-viewport');
  const preview = gallery.querySelector('.collection-preview');
  const root = document.documentElement;
  const navigation = document.querySelector('.site-nav');
  const toolbar = gallery.querySelector('.collection-toolbar');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const panels = Array.from(gallery.querySelectorAll('.collection-panel'));
  const collator = new Intl.Collator('zh-CN', {numeric: true, sensitivity: 'base'});
  const states = new Map(panels.map(panel => [panel.dataset.category, {
    panel, wall: panel.querySelector('.collection-wall'),
    sources: Array.from(panel.querySelectorAll('.wall-cover')).sort((a, b) => collator.compare(a.dataset.title, b.dataset.title)),
    layout: null, offset: 0, width: 0, height: 0,
  }]));
  let active, hovered, showTimer, closeTimer, resizeFrame, saved = readPosition();
  let previousScrollTop = 0;
  let requestedKey = new URL(location.href).searchParams.get('item');

  function hidePreview() {
    clearTimeout(showTimer);
    clearTimeout(closeTimer);
    hovered?.classList.remove('is-previewed');
    hovered?.removeAttribute('aria-describedby');
    hovered = null;
    preview.hidden = true;
  }
  function showPreview(cover) {
    hidePreview();
    hovered = cover;
    const rect = cover.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    cover.style.setProperty('--cover-origin', `${rect.left < 10 ? 'left' : rect.right > innerWidth - 20 ? 'right' : 'center'} ${rect.top < viewportRect.top + 10 ? 'top' : 'center'}`);
    cover.classList.add('is-previewed');
    preview.querySelector('h2').textContent = cover.dataset.title;
    preview.querySelector('p').textContent = cover.dataset.preview;
    preview.hidden = false;
    cover.setAttribute('aria-describedby', preview.id);
    const box = preview.getBoundingClientRect();
    let left = rect.right + 10;
    if (left + box.width > innerWidth - 12) left = rect.left - box.width - 10;
    left = Math.max(12, Math.min(left, innerWidth - box.width - 12));
    const top = Math.max(viewportRect.top + 8, Math.min(rect.top, innerHeight - box.height - 12));
    preview.style.left = `${left}px`;
    preview.style.top = `${top}px`;
  }
  function deferClose() {
    clearTimeout(showTimer);
    clearTimeout(closeTimer);
    closeTimer = setTimeout(hidePreview, 160);
  }
  viewport.addEventListener('pointerover', event => {
    if (!finePointer.matches || event.pointerType === 'touch') return;
    const cover = event.target.closest('.wall-cover');
    if (!cover || cover.contains(event.relatedTarget)) return;
    hidePreview();
    showTimer = setTimeout(() => showPreview(cover), 180);
  });
  viewport.addEventListener('pointerout', event => {
    const cover = event.target.closest('.wall-cover');
    if (cover && !cover.contains(event.relatedTarget)) deferClose();
  });
  preview.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  preview.addEventListener('pointerleave', deferClose);
  viewport.addEventListener('focusin', event => {
    const cover = event.target;
    if (!cover.matches('.wall-cover') || !cover.matches(':focus-visible')) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (document.activeElement === cover) showPreview(cover);
    }));
  });
  viewport.addEventListener('focusout', hidePreview);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hidePreview(); });
  finePointer.addEventListener('change', hidePreview);

  function positionAnchor(state) {
    if (!state?.layout) return null;
    const offset = wrapOffset(viewport.scrollTop, state.layout.height) - state.layout.height;
    return locateAnchor(state.layout, state.sources.map(source => source.dataset.key), offset);
  }
  function savePosition(key) {
    if (!active?.layout) return;
    const anchor = positionAnchor(active);
    saved = {category: active.panel.dataset.category, ...anchor, selected: key || saved.selected, collapsed: root.classList.contains('wall-nav-collapsed')};
    try { sessionStorage.setItem(storageKey, JSON.stringify(saved)); } catch { /* Browsing still works without storage. */ }
  }
  viewport.addEventListener('click', event => {
    const cover = event.target.closest('.wall-cover');
    if (cover) savePosition(cover.dataset.key);
  });
  window.addEventListener('pagehide', () => savePosition());

  function offsetFor(state, anchor) {
    return restoreAnchor(state.layout, state.sources.map(source => source.dataset.key), anchor);
  }
  function render(state, anchor) {
    hidePreview();
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const ratios = state.sources.map(source => Number(source.dataset.aspect) > 0 ? Number(source.dataset.aspect) : 1);
    // Reserve enough rows for the expanded wall, so hiding navigation never rebuilds covers.
    const layout = layoutCovers(ratios, width, state.panel.dataset.category, Math.max(height, innerHeight) * 2);
    state.layout = layout;
    state.width = width;
    state.height = height;
    state.offset = anchor ? offsetFor(state, anchor) : state.offset;
    const nearby = new Set(layout.tiles.filter(tile => tile.y + tile.height >= state.offset - height && tile.y < state.offset + height * 2).map(tile => tile.index));
    const fragment = document.createDocumentFragment();
    for (let segmentIndex = 0; segmentIndex < 3; segmentIndex++) {
      const segment = document.createElement('div');
      segment.className = 'wall-segment';
      segment.style.height = `${layout.height}px`;
      if (segmentIndex !== 1) segment.setAttribute('aria-hidden', 'true');
      const included = new Set();
      layout.tiles.forEach((tile, slot) => {
        const cover = state.sources[tile.index].cloneNode(true);
        cover.dataset.slot = slot;
        cover.style.cssText = `left:${tile.x}px;top:${tile.y}px;width:${tile.width}px;height:${tile.height}px;`;
        if (segmentIndex !== 1 || included.has(tile.index)) {
          cover.tabIndex = -1;
          cover.setAttribute('aria-hidden', 'true');
        }
        included.add(tile.index);
        const img = cover.querySelector('img');
        if (nearby.has(tile.index)) img.loading = 'eager';
        segment.appendChild(cover);
      });
      fragment.appendChild(segment);
    }
    const focusKey = state.wall.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    state.wall.replaceChildren(fragment);
    viewport.scrollTop = wrapOffset(state.offset, layout.height);
    previousScrollTop = viewport.scrollTop;
    if (focusKey) Array.from(state.wall.querySelectorAll('.wall-cover:not([aria-hidden])')).find(cover => cover.dataset.key === focusKey)?.focus({preventScroll: true});
  }

  function sizeViewport() {
    // Use the destination geometry, not a halfway frame of the folding transition.
    const toolbarHeight = toolbar.getBoundingClientRect().height;
    root.style.setProperty('--wall-toolbar-height', `${toolbarHeight}px`);
    const top = root.classList.contains('wall-nav-collapsed') ? 0 : (navigation?.getBoundingClientRect().height || 0) + toolbarHeight;
    const height = Math.max(160, (window.visualViewport?.height || innerHeight) - top);
    viewport.style.setProperty('--wall-height', `${height}px`);
  }
  viewport.addEventListener('transitionend', event => {
    if (event.target === viewport && event.propertyName === 'height' && hovered) showPreview(hovered);
  });
  function setNavigationCollapsed(collapsed) {
    collapsed = Boolean(collapsed && active?.sources.length && !navigation?.classList.contains('is-open'));
    if (root.classList.contains('wall-nav-collapsed') === collapsed) return;
    root.classList.toggle('wall-nav-collapsed', collapsed);
    hidePreview();
    sizeViewport();
  }
  // Use input direction: wrapping a repeated segment is not an upward gesture.
  viewport.addEventListener('wheel', event => {
    if (!event.ctrlKey && Math.abs(event.deltaY) > Math.max(2, Math.abs(event.deltaX))) setNavigationCollapsed(event.deltaY > 0);
  }, {passive: true});
  let touchY = null;
  viewport.addEventListener('touchstart', event => {
    touchY = event.touches.length === 1 ? event.touches[0].clientY : null;
  }, {passive: true});
  viewport.addEventListener('touchmove', event => {
    if (touchY === null || event.touches.length !== 1) return;
    const delta = touchY - event.touches[0].clientY;
    if (Math.abs(delta) <= 6) return;
    touchY = event.touches[0].clientY;
    setNavigationCollapsed(delta > 0);
  }, {passive: true});
  document.addEventListener('keydown', event => {
    if (event.key === 'Tab' || event.key === 'Escape') setNavigationCollapsed(false);
    if (!viewport.contains(event.target)) return;
    if (['ArrowDown', 'PageDown', 'End'].includes(event.key) || (event.key === ' ' && !event.shiftKey)) setNavigationCollapsed(true);
    if (['ArrowUp', 'PageUp', 'Home'].includes(event.key) || (event.key === ' ' && event.shiftKey)) setNavigationCollapsed(false);
  });
  function activate() {
    const panel = panels.find(panel => !panel.hidden);
    if (!panel) return;
    hidePreview();
    active = states.get(panel.dataset.category);
    sizeViewport();
    if (!active.sources.length) { setNavigationCollapsed(false); viewport.scrollTop = 0; return; }
    let anchor;
    let collapsed = false;
    if (saved.category === panel.dataset.category && (!requestedKey || requestedKey === saved.selected)) {
      anchor = {key: saved.key, occurrence: saved.occurrence, fraction: saved.fraction};
      collapsed = saved.collapsed;
      saved = {...saved, category: null};
    } else if (requestedKey && active.sources.some(source => source.dataset.key === requestedKey)) {
      anchor = {key: requestedKey, fraction: 0};
    }
    requestedKey = null;
    render(active, anchor);
    setNavigationCollapsed(collapsed);
  }
  viewport.addEventListener('scroll', () => {
    hidePreview();
    if (!active?.layout) return;
    const period = active.layout.height;
    const top = viewport.scrollTop;
    // Scrollbar drags have no wheel event; focus scrolling is handled by the key listeners.
    const focusMoved = document.activeElement?.matches('.wall-cover:focus-visible');
    if (!focusMoved && Math.abs(top - previousScrollTop) > 2) setNavigationCollapsed(top > previousScrollTop);
    if (top < period - 1 || top >= period * 2 + 1) viewport.scrollTop = wrapOffset(top, period);
    previousScrollTop = viewport.scrollTop;
    active.offset = wrapOffset(viewport.scrollTop, period) - period;
  }, {passive: true});

  // Loading an image refines the reserved ratio without losing the visible row.
  function imageState(event) {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    const cover = img.closest('.wall-cover');
    if (!cover) return;
    const panel = cover.closest('.collection-panel');
    const state = states.get(panel.dataset.category);
    const source = state.sources.find(source => source.dataset.key === cover.dataset.key);
    if (event.type === 'error') {
      source.classList.add('is-broken');
      state.wall.querySelectorAll('.wall-cover').forEach(copy => {
        if (copy.dataset.key === source.dataset.key) copy.classList.add('is-broken');
      });
      return;
    }
    const ratio = img.naturalWidth / img.naturalHeight;
    if (!Number.isFinite(ratio) || ratio <= 0 || Math.abs(ratio - Number(source.dataset.aspect)) < .001) return;
    source.dataset.aspect = ratio;
    queueResize(true);
  }
  viewport.addEventListener('load', imageState, true);
  viewport.addEventListener('error', imageState, true);
  let ratioChanged = false;
  function queueResize(force = false) {
    ratioChanged ||= force;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      const anchor = positionAnchor(active);
      sizeViewport();
      if (active?.layout && (ratioChanged || active.width !== viewport.clientWidth || active.layout.height < viewport.clientHeight * 2)) render(active, anchor);
      ratioChanged = false;
    });
  }
  new ResizeObserver(() => queueResize()).observe(toolbar);
  window.addEventListener('resize', () => queueResize());
  window.visualViewport?.addEventListener('resize', () => queueResize());
  window.addEventListener('collectionchange', activate);
  window.addEventListener('hashchange', () => {
    const tab = Array.from(gallery.querySelectorAll('.collection-tab')).find(tab => tab.dataset.category === location.hash.slice(1));
    if (tab && tab.getAttribute('aria-selected') !== 'true') tab.click();
  });
  gallery.querySelector('.collection-exit').addEventListener('click', event => {
    event.preventDefault();
    setNavigationCollapsed(false);
    gallery.querySelector('.collection-tab[aria-selected="true"]')?.focus();
  });
  document.documentElement.classList.add('wall-enhanced');
  activate();
})();
