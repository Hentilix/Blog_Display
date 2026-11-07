(async () => {
  const search = document.getElementById('search');
  const status = document.getElementById('search-status');
  const retry = document.getElementById('search-retry');
  retry.addEventListener('click', () => window.location.reload());

  function showError() {
    search.dataset.state = 'error';
    status.textContent = '搜索暂时无法加载，请重新加载后再试。';
    status.hidden = false;
    retry.hidden = false;
  }

  try {
    await import(search.dataset.bundle);
    const instance = window.PagefindComponents.getInstanceManager().getInstance('default');
    instance.setTranslations({
      zero_results: '没有找到“[SEARCH_TERM]”的相关内容，试试其他关键词。',
      one_result: '找到 [COUNT] 条结果',
      many_results: '找到 [COUNT] 条结果',
      error_search: '搜索暂时无法加载，请重新加载后再试。'
    });
    instance.on('error', showError);
    instance.on('search', term => {
      search.dataset.state = 'ready';
      status.hidden = true;
      retry.hidden = true;
      // Preserve the query when following a result and returning, or sharing a link.
      const url = new URL(window.location.href);
      if (term) url.searchParams.set('q', term);
      else url.searchParams.delete('q');
      history.replaceState(history.state, '', url);
    });
    const query = new URL(window.location.href).searchParams.get('q');
    if (query) instance.triggerSearch(query);
  } catch (_) {
    showError();
  }
})();
