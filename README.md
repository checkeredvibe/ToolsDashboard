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
- `tools/template.html` — general copy-paste starter for new tool pages. It
  contains one example of every supported field type, wired by
  `assets/js/template-tool.js` (demo model `y = A·sin(2πfx)`):
  - inputs: text, number, single slider, two-sided slider (slide or type
    min/max, both stay in sync, step 0.1), on/off switch, dropdown select,
    multi-select checkboxes, date/time picker, color picker, single-choice
    radio group, local .csv file upload (FileReader, never sent anywhere);
    a bundled placeholder `assets/data/example.csv` is auto-loaded into the
    CSV preview on page load (over Pages/HTTP; via file:// fetch is blocked,
    so upload manually there)
  - outputs: number readout, interactive 2D Plotly plot (hover + PNG download
    via the built-in modebar), 3D surface plot (gl3d bundle), table, image
    snapshot (`Plotly.toImage`), CSV preview table — all local, no network
  - plots redraw only on slider release (`change` event); while dragging,
    only the cheap number/table update runs (`input` event) to avoid lag
  - bottom row: equations used + sources
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
- `assets/data/example.csv` — placeholder CSV auto-loaded by the template's
  CSV preview card (projectile trajectory sample data, SI units).

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
- Footer: "TG2026 - Make sure you validate your calculations before using them
  for professional purposes." plus a bottom-left "Last updated on: <date>
  <HH:MM:SS>" timestamp, filled automatically by `template.js` from
  `document.lastModified` (served file's last-modified time on Pages, file
  mtime via `file://`). Keep the `<span id="last-updated">` in every page
  footer.
- GitHub Pages never serves files/directories starting with `_` (reserved for
  Jekyll), even in legacy branch mode — so the tool template is
  `tools/template.html` + `assets/js/template-tool.js`, not `_template.*`.

## New-tool recipe

1. **Ask the engineer first.** Before writing any code, explicitly ask the
   engineer building the tool:
   - which **input parameters** the tool needs (names, SI units, sensible
     default/min/max values);
   - which **outputs** it must show (numbers, plots, tables, images, …);
   - which **field types** to use for each input and output (text, number,
     single slider, two-sided slider, toggle, dropdown, checkboxes,
     date/time, color, radio, CSV upload — and number/2D plot/3D plot/
     table/image/CSV preview on the output side), as listed in
     `tools/template.html`.
   Do not guess these — the engineer decides.
2. Copy `tools/template.html` to `tools/<tool-name>.html` (the template is
   already wired with one example of every field type).
3. Update the `<title>`, heading, and description; keep the shared
   `../assets/...` relative links (Bootstrap, template CSS/JS, tools.js).
4. Build your tool inside the `.tool-layout` grid: "Input" header + input
   cards (left, 30%), "Output" header + output cards with plots/tables
   (right, 70%), and a `.tool-bottom` card (100% width) listing the
   equations used and their sources.
5. Use the `SI.format` / `SI.parse` helpers from `tools.js` for all values;
   all inputs and results in SI units. Load
   `../assets/vendor/plotly/plotly-cartesian.min.js` for 2D plots and/or
   `../assets/vendor/plotly/plotly-gl3d.min.js` for 3D plots.
6. Copy `assets/js/template-tool.js` to `assets/js/<tool-name>.js` and replace
   the demo model with your calculations.
7. Add a tile to `index.html` (same markup as the existing tiles) linking to
   `tools/<tool-name>.html`, including descriptive `data-keywords`, a
   `data-category`, and a `data-updated` date.
8. Test offline by opening `index.html` directly in a browser.
