// Shared template logic for all pages: theme toggle (Bootstrap data-bs-theme)
// and collapsible tiles (cards) inside the Input/Output columns on tool pages.

(function () {
  'use strict';

  const THEME_KEY = 'dashboard-theme';
  const COLLAPSED_KEY = 'dashboard-collapsed-cards';
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
  initCollapsibleCards();

  function initCollapsibleCards() {
    const layout = document.querySelector('.tool-layout');
    if (!layout) return;
    const columns = Array.from(layout.children).filter(
      (el) => el.querySelector(':scope > .tool-col-header')
    );
    if (columns.length === 0) return;

    const storageKey = COLLAPSED_KEY + ':' + location.pathname;
    const entries = [];
    let bodyCounter = 0;

    columns.forEach((column) => {
      const colHeader = column.querySelector(':scope > .tool-col-header');
      const section = column.id === 'input-tiles' || /^input/i.test(colHeader.textContent.trim()) ? 'input' : 'output';
      const cards = Array.from(column.querySelectorAll('.card')).filter(
        (card) => !card.parentElement.closest('.card')
      );
      cards.forEach((card, i) => {
        const cardHeader = card.querySelector(':scope > .card-header');
        const body = card.querySelector(':scope > .card-body');
        if (!cardHeader || !body) return;
        if (!body.id) body.id = 'tool-card-body-' + (++bodyCounter);
        const key = section + ':' + (card.id || i);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'card-toggle';
        btn.setAttribute('aria-controls', body.id);
        const label = document.createElement('span');
        label.textContent = cardHeader.textContent.trim();
        const chevron = document.createElement('span');
        chevron.className = 'col-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        btn.append(label, chevron);
        cardHeader.textContent = '';
        cardHeader.appendChild(btn);

        const setCollapsed = (collapsed) => {
          card.classList.toggle('card-collapsed', collapsed);
          btn.setAttribute('aria-expanded', String(!collapsed));
          const collapsedKeys = entries
            .filter((e) => e.card.classList.contains('card-collapsed'))
            .map((e) => e.key);
          try { localStorage.setItem(storageKey, collapsedKeys.join(',')); } catch (err) {}
          if (!collapsed) {
            requestAnimationFrame(() => {
              if (window.Plotly) {
                card.querySelectorAll('.js-plotly-plot').forEach((plot) => {
                  try { window.Plotly.Plots.resize(plot); } catch (err) {}
                });
              }
              window.dispatchEvent(new Event('resize'));
            });
          }
        };

        btn.addEventListener('click', () => setCollapsed(!card.classList.contains('card-collapsed')));
        entries.push({ card, btn, key });
      });
    });

    let saved = '';
    try { saved = localStorage.getItem(storageKey) || ''; } catch (err) {}
    const collapsedKeys = new Set(saved.split(',').filter(Boolean));
    entries.forEach(({ card, btn, key }) => {
      const collapsed = collapsedKeys.has(key);
      card.classList.toggle('card-collapsed', collapsed);
      btn.setAttribute('aria-expanded', String(!collapsed));
    });
  }

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
