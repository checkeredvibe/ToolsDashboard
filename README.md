# ToolsDashboard

Offline HTML dashboard providing engineering calculation and visualisation tools.
All results use SI units. No external network resources are used — open
`index.html` directly in a browser, or serve it via GitHub Pages.

## Architecture

- Fully offline, static HTML — no CDN links, no build step, no server required.
- Bootstrap 5.3.3 is self-hosted in `assets/vendor/bootstrap/` (plain CSS + JS
  files, nothing compiled).
- Plotly.js 2.35.2 is self-hosted in `assets/vendor/plotly/` for interactive,
  animated offline plots. Bundles included: `plotly-cartesian.min.js`
  (line/scatter/bar charts) and `plotly-gl3d.min.js` (3D surface/scatter plots,
  WebGL). Both ship with their license files; add mapbox/geo bundles only if a
  tool needs maps.
- `index.html` — main dashboard with a live-filtered, sortable grid of tool tiles.
  Features: match highlighting, category filter chips, result counter, clear
  button + `Esc` to reset the search, sort (default / A–Z / recently added via
  `data-updated`), and shareable filter state in the URL hash
  (`index.html#q=...&cat=...&sort=...`).
- `tools/<tool-name>.html` — one standalone HTML file per tool.
- `tools/_template.html` — copy-paste starter for new tool pages.
- `assets/css/template.css` — shared styles on top of Bootstrap (brand theme,
  tile grid, navbar).
- `assets/js/template.js` — shared logic: theme toggle (the only owner of this
  behavior).
- `assets/js/dashboard.js` — index-page logic: live search filter with
  highlighting, category chips, sorting, result counter, URL-hash state.
- `assets/js/tools.js` — shared SI-unit helpers (`SI.format`, `SI.parse`).
- `assets/js/<tool-name>.js` — per-tool logic (calculations + Plotly plots).
- `tools/<tool-name>.html` — tool pages use the `.tool-layout` grid from
  `template.css`: 30% inputs on the left, 70% results (values, interactive
  plots, tables) on the right, and a full-width bottom row with the formulas
  used and their sources.
- `assets/img/` — self-hosted images (navbar logo).

## Design decisions

- Brand theme: white + `#272974`.
- Light/dark mode via Bootstrap's `data-bs-theme` attribute on `<html>`,
  persisted in `localStorage` (key `dashboard-theme`).
- Theme toggle logic lives only in `template.js` — one owner per behavior;
  attaching the same listener from multiple scripts breaks the toggle.
- Tiles: uniform grid of square cards (288px minimum), icon + title +
  one-line description + small keywords. No featured/pinning.
- Tile `data-keywords` feed the live search filter — keep them matching the
  terms a user would actually type (at least five keywords per tool).
- Tile `data-category` drives the category filter chips; `data-updated`
  (ISO date) drives the "Recently added" sort.
- Footer: "This dashboard is partially created by Vibe-coding. Make sure you
  validate your calculations."

## New-tool recipe

1. Copy `tools/_template.html` to `tools/<tool-name>.html`.
2. Update the `<title>`, heading, and description; keep the shared
   `../assets/...` relative links (Bootstrap, template CSS/JS, tools.js).
3. Build the tool inside the `.tool-layout` grid: inputs card (left, 30%),
   results card(s) with Plotly plots (right, 70%), and a `.tool-bottom` card
   (100% width) listing the equations used and their sources.
4. Use the `SI.format` / `SI.parse` helpers from `tools.js` for all values;
   all inputs and results in SI units. Load
   `../assets/vendor/plotly/plotly-cartesian.min.js` for plots.
5. Add a tile to `index.html` (same markup as the existing tiles) linking to
   `tools/<tool-name>.html`, including descriptive `data-keywords`, a
   `data-category`, and a `data-updated` date.
6. Test offline by opening `index.html` directly in a browser.
