// Shared template logic for all pages: theme toggle (Bootstrap data-bs-theme).

(function () {
  'use strict';

  const THEME_KEY = 'dashboard-theme';
  const root = document.documentElement;
  const storedTheme = localStorage.getItem(THEME_KEY);
  if (storedTheme) root.dataset.bsTheme = storedTheme;

  function renderLastUpdated() {
    const el = document.getElementById('last-updated');
    if (!el) return;
    const d = new Date(document.lastModified);
    if (Number.isNaN(d.getTime())) {
      el.textContent = 'Last updated on: unknown';
      return;
    }
    el.textContent = 'Last updated on: ' +
      d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }
  renderLastUpdated();

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
