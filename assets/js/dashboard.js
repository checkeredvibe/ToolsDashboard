// Index dashboard logic: live filter.
// Theme toggle is handled once by template.js, which loads first.

(function () {
  'use strict';

  const grid = document.getElementById('tile-grid');
  const tiles = Array.from(grid.querySelectorAll(':scope > .tile'));

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
