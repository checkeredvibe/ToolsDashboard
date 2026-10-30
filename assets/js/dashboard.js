// Index dashboard logic: live filter, featured pins.
// Theme toggle is handled once by template.js, which loads first.

(function () {
  'use strict';

  const PINS_KEY = 'dashboard-pins';

  // --- Featured pins (persisted; pinned tiles span wider and sort first) ---
  const grid = document.getElementById('tile-grid');
  const tiles = Array.from(grid.querySelectorAll(':scope > .tile'));

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
      const pinned = pins.includes(tile.dataset.id);
      tile.classList.toggle('featured', pinned);
      tile.querySelector('.pin').classList.toggle('pinned', pinned);
    });
    const featured = tiles.filter(t => t.classList.contains('featured'));
    const rest = tiles.filter(t => !t.classList.contains('featured'));
    [...featured, ...rest].forEach(t => grid.appendChild(t));
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
        tile.querySelector('.card-title').textContent + ' ' +
        tile.querySelector('.card-text').textContent + ' ' +
        tile.dataset.keywords
      ).toLowerCase();
      const match = haystack.includes(q);
      tile.hidden = !match;
      if (match) visible++;
    });
    noResults.hidden = visible !== 0;
  });
})();
