// Shared template logic for all pages: theme toggle (Bootstrap data-bs-theme)
// and collapsible Input/Output sections on tool pages.

(function () {
  'use strict';

  const THEME_KEY = 'dashboard-theme';
  const COLLAPSED_KEY = 'dashboard-collapsed-sections';
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
      d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }
  renderLastUpdated();
  initCollapsibleSections();

  function initCollapsibleSections() {
    const layout = document.querySelector('.tool-layout');
    if (!layout) return;
    const columns = Array.from(layout.children).filter(
      (el) => el.querySelector(':scope > .tool-col-header')
    );
    if (columns.length === 0) return;

    const storageKey = COLLAPSED_KEY + ':' + location.pathname;
    const entries = [];

    columns.forEach((column) => {
      const header = column.querySelector(':scope > .tool-col-header');
      const isInput = column.id === 'input-tiles' || /^input/i.test(header.textContent.trim());
      column.classList.add('tool-col', isInput ? 'tool-col-input' : 'tool-col-output');
      column.dataset.section = isInput ? 'input' : 'output';
      if (!column.id) column.id = isInput ? 'input-tiles' : 'output-tiles';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tool-col-toggle';
      btn.setAttribute('aria-controls', column.id);
      const label = document.createElement('span');
      label.textContent = header.textContent.trim();
      const chevron = document.createElement('span');
      chevron.className = 'col-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      btn.append(label, chevron);
      header.textContent = '';
      header.appendChild(btn);

      const setCollapsed = (collapsed) => {
        column.classList.toggle('section-collapsed', collapsed);
        btn.setAttribute('aria-expanded', String(!collapsed));
        const collapsedSections = entries
          .filter((e) => e.column.classList.contains('section-collapsed'))
          .map((e) => e.column.dataset.section);
        try { localStorage.setItem(storageKey, collapsedSections.join(',')); } catch (err) {}
        if (!collapsed) {
          requestAnimationFrame(() => {
            if (window.Plotly) {
              column.querySelectorAll('.js-plotly-plot').forEach((plot) => {
                try { window.Plotly.Plots.resize(plot); } catch (err) {}
              });
            }
            window.dispatchEvent(new Event('resize'));
          });
        }
      };

      btn.addEventListener('click', () => setCollapsed(!column.classList.contains('section-collapsed')));
      entries.push({ column, btn, setCollapsed });
    });

    let saved = '';
    try { saved = localStorage.getItem(storageKey) || ''; } catch (err) {}
    const collapsedSections = new Set(saved.split(',').filter(Boolean));
    entries.forEach(({ column, btn }) => {
      const collapsed = collapsedSections.has(column.dataset.section);
      column.classList.toggle('section-collapsed', collapsed);
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
