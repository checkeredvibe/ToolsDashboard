// Shared template logic for all pages: theme toggle (Bootstrap data-bs-theme).

(function () {
  'use strict';

  const THEME_KEY = 'dashboard-theme';
  const root = document.documentElement;
  const storedTheme = localStorage.getItem(THEME_KEY);
  if (storedTheme) root.dataset.bsTheme = storedTheme;

  const toggleBtn = document.getElementById('theme-toggle');
  if (!toggleBtn) return;

  function syncToggleIcon() {
    toggleBtn.textContent = root.dataset.bsTheme === 'dark' ? '☀️' : '🌙';
  }

  toggleBtn.addEventListener('click', () => {
    const next = root.dataset.bsTheme === 'dark' ? 'light' : 'dark';
    root.dataset.bsTheme = next;
    localStorage.setItem(THEME_KEY, next);
    syncToggleIcon();
  });
  syncToggleIcon();
})();
