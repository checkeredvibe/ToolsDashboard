// Index dashboard logic: live filter with match highlighting, category chips,
// sort control, result counter, and URL-hash state.
// Theme toggle is handled once by template.js, which loads first.

(function () {
  'use strict';

  const grid = document.getElementById('tile-grid');
  const tiles = Array.from(grid.querySelectorAll(':scope > .tile'));
  const searchInput = document.getElementById('tool-search');
  const searchClear = document.getElementById('search-clear');
  const sortSelect = document.getElementById('tool-sort');
  const noResults = document.getElementById('no-results');
  const resultCount = document.getElementById('result-count');
  const chipsBox = document.getElementById('category-chips');

  const state = { q: '', cat: 'all', sort: 'default' };

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function highlight(text, q) {
    if (!q) return escapeHtml(text);
    const esc = escapeHtml(text);
    const escQ = escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return esc.replace(new RegExp('(' + escQ + ')', 'ig'), '<mark>$1</mark>');
  }

  function haystack(tile) {
    return (
      tile.querySelector('.card-title').textContent + ' ' +
      tile.querySelector('.card-text').textContent + ' ' +
      (tile.dataset.keywords || '') + ' ' +
      (tile.dataset.category || '')
    ).toLowerCase();
  }

  // --- Category chips ---
  const categories = ['all'].concat(
    Array.from(new Set(tiles.map(t => t.dataset.category).filter(Boolean)))
  );

  function renderChips() {
    chipsBox.innerHTML = '';
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm chip' + (state.cat === cat ? ' chip-active' : '');
      btn.dataset.category = cat;
      btn.setAttribute('aria-pressed', state.cat === cat ? 'true' : 'false');
      btn.textContent = cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1);
      btn.addEventListener('click', () => {
        state.cat = cat;
        renderChips();
        applyFilters();
        syncHash();
      });
      chipsBox.appendChild(btn);
    });
  }

  // --- Sort ---
  function applySort() {
    const sorted = tiles.slice();
    if (state.sort === 'az') {
      sorted.sort((a, b) =>
        a.querySelector('.card-title').textContent.localeCompare(b.querySelector('.card-title').textContent));
    } else if (state.sort === 'recent') {
      sorted.sort((a, b) => (b.dataset.updated || '').localeCompare(a.dataset.updated || ''));
    }
    sorted.forEach(t => grid.appendChild(t));
  }

  // --- Filter + highlight + counter ---
  function applyFilters() {
    const q = state.q.trim().toLowerCase();
    let visible = 0;
    tiles.forEach(tile => {
      const match =
        (state.cat === 'all' || tile.dataset.category === state.cat) &&
        (q === '' || haystack(tile).includes(q));
      tile.hidden = !match;
      if (match) visible++;
      const title = tile.querySelector('.card-title');
      const text = tile.querySelector('.card-text');
      title.innerHTML = highlight(title.textContent, q);
      text.innerHTML = highlight(text.textContent, q);
    });
    noResults.hidden = visible !== 0;
    resultCount.textContent = 'Showing ' + visible + ' of ' + tiles.length + ' tools';
    searchClear.classList.toggle('d-none', q === '');
  }

  // --- URL hash state (#q=...&cat=...&sort=...) ---
  function syncHash() {
    const params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.cat !== 'all') params.set('cat', state.cat);
    if (state.sort !== 'default') params.set('sort', state.sort);
    const hash = params.toString();
    history.replaceState(null, '', hash ? '#' + hash : location.pathname + location.search);
  }

  function readHash() {
    const params = new URLSearchParams(location.hash.slice(1));
    state.q = params.get('q') || '';
    state.cat = params.get('cat') || 'all';
    state.sort = params.get('sort') || 'default';
    if (!categories.includes(state.cat)) state.cat = 'all';
    if (!['default', 'az', 'recent'].includes(state.sort)) state.sort = 'default';
  }

  // --- Events ---
  searchInput.addEventListener('input', () => {
    state.q = searchInput.value;
    applyFilters();
    syncHash();
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      state.q = '';
      applyFilters();
      syncHash();
    }
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    state.q = '';
    applyFilters();
    syncHash();
    searchInput.focus();
  });

  sortSelect.addEventListener('change', () => {
    state.sort = sortSelect.value;
    applySort();
    applyFilters();
    syncHash();
  });

  window.addEventListener('hashchange', () => {
    readHash();
    searchInput.value = state.q;
    sortSelect.value = state.sort;
    renderChips();
    applySort();
    applyFilters();
  });

  // --- Init ---
  readHash();
  searchInput.value = state.q;
  sortSelect.value = state.sort;
  renderChips();
  applySort();
  applyFilters();
})();
