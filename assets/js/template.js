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
    // Prefer the per-page <meta name="last-updated" content="ISO"> tag (set to
    // the page's last edit time) — on GitHub Pages document.lastModified is the
    // deploy time, identical for all pages. Fall back to document.lastModified
    // (per-file mtime via file://).
    const meta = document.querySelector('meta[name="last-updated"]');
    let d = new Date(meta && meta.content ? meta.content : '');
    if (Number.isNaN(d.getTime())) d = new Date(document.lastModified);
    if (Number.isNaN(d.getTime())) {
      el.textContent = 'Last updated on: unknown';
      return;
    }
    el.textContent = 'Last updated on: ' +
      d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Europe/Amsterdam' }) + ' ' +
      d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Europe/Amsterdam' }) + ' CET';
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
