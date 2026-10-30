// Index dashboard logic: theme toggle, live filter, featured pins.

(function () {
  'use strict';

  const THEME_KEY = 'dashboard-theme';
  const PINS_KEY = 'dashboard-pins';

  // --- Theme toggle (persisted) ---
  const toggleBtn = document.getElementById('theme-toggle');
  const storedTheme = localStorage.getItem(THEME_KEY);
  if (storedTheme) document.body.dataset.theme = storedTheme;

  function syncToggleIcon() {
    toggleBtn.textContent = document.body.dataset.theme === 'dark' ? '☀️' : '🌙';
  }

  toggleBtn.addEventListener('click', () => {
    const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
    syncToggleIcon();
  });
  syncToggleIcon();

  // --- Featured pins (persisted, pinned tiles render large at top) ---
  const grid = document.getElementById('tile-grid');
  const tiles = Array.from(grid.querySelectorAll('.tile'));

  function getPins() {
    try { return JSON.parse(localStorage.getItem(PINS_KEY)) || []; }
    catch { return []; }
  }

  function savePins(pins) {
    localStorage.setItem(PINS_KEY, JSON.stringify(pins));
  }

  function renderPins() {
    const pins = getPins();
    tiles.forEach(tile => {
      const id = tile.dataset.id;
      tile.classList.toggle('featured', pins.includes(id));
      tile.querySelector('.pin').classList.toggle('pinned', pins.includes(id));
      grid.appendChild(tile); // re-append: pinned (featured) tiles are grouped first via CSS order
    });
    // Stable order: pinned tiles first, then the rest, preserving original order within groups
    const pinned = tiles.filter(t => t.classList.contains('featured'));
    const rest = tiles.filter(t => !t.classList.contains('featured'));
    [...pinned, ...rest].forEach(t => grid.appendChild(t));
  }

  tiles.forEach(tile => {
    tile.querySelector('.pin').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const pins = getPins();
      const id = tile.dataset.id;
      const i = pins.indexOf(id);
      if (i === -1) pins.push(id); else pins.splice(i, 1);
      savePins(pins);
      renderPins();
    });
  });
  renderPins();

  // --- Live search filter ---
  const searchInput = document.getElementById('tool-search');
  const noResults = document.getElementById('no-results');

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    let visible = 0;
    tiles.forEach(tile => {
      const haystack = (
        tile.querySelector('h2').textContent + ' ' +
        tile.querySelector('p').textContent + ' ' +
        tile.dataset.keywords
      ).toLowerCase();
      const match = haystack.includes(q);
      tile.hidden = !match;
      if (match) visible++;
    });
    noResults.hidden = visible !== 0;
  });
})();
