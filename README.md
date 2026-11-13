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
    radio group, local file uploads — .csv (FileReader) and image (object URL
    preview), never sent anywhere;
    a bundled placeholder `assets/data/example.csv` is auto-loaded into the
    CSV preview on page load (over Pages/HTTP; via file:// fetch is blocked,
    so upload manually there)
  - outputs: number readout, interactive 2D line plot, scatter plot, 3D
    surface plot (gl3d bundle; all with hover + PNG download via the built-in
    modebar), table, image snapshot (`Plotly.toImage`), CSV preview table —
    all local, no network
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
- Tool pages include scripts in this fixed order: `bootstrap.bundle.min.js`,
  only the Plotly bundle(s) the tool needs (`plotly-cartesian.min.js` and/or
  `plotly-gl3d.min.js`), `template.js`, `tools.js`, then `assets/js/<tool-name>.js`.
  The navbar links back to `../index.html` ("&larr; Engineering Tools Dashboard").
- `tools/<tool-name>.html` — tool pages use the `.tool-layout` grid from
  `template.css`: 30% inputs on the left, 70% results (values, interactive
  plots, tables) on the right, and a full-width bottom row with the formulas
  used and their sources.
- `assets/img/` — self-hosted images (navbar logo).
- `assets/data/example.csv` — placeholder CSV auto-loaded by the template's
  CSV preview card (projectile trajectory sample data, SI units).
- `assets/data/bulb-profiles.js` — predefined bulb flats HP 60x4–HP 430x20
  (EN 10067 / DIN 1025-2 dimension table, ArcelorMittal publication), used by
  the Section Properties tool's bulb-profile dropdown.

## Current tools

- `tools/section-properties.html` (category `mechanics`) — area, centroid, second
  moment of area and section modulus of beam sections (I-beam, flat bar, bulb
  profile, tubes) with a section drawing; dropdown of standard bulb flats
  (EN 10067 / DIN 1025-2 via `assets/data/bulb-profiles.js`); mm inputs, SI results.
- `tools/graph-digitizer.html` (category `data`) — digitize scanned graphs: image
  upload, 4-point homography calibration (skew/perspective/log-safe),
  click-to-read values, multiple series, re-plot, CSV/PNG export.
- `tools/image-renamer.html` (category `media`) — rename images in a folder,
  manually one by one or in batch with a prefix + counter pattern; fully offline.
- `tools/stiffened-plate-buckling.html` (category `buckling`) — stiffened
  panel buckling capacity per DNV-CG-0128 (Dec 2023) Sec.3 closed form method:
  overall panel (γ_GEB), plate EPP (Table 3 cases 1/2/15) and stiffener SI/PI
  checks ([3.3.4], Table 5) with utilization η per limit state and limit
  buckling stress γ_c·σ; flat bar, bulb (equivalent angle), angle and T
  profiles; stresses in N/mm² (compression positive), lengths in mm (net).
- `tools/fatigue-damage.html` (category `fatigue`) — fatigue damage D estimator
  with a Weibull long-term stress-range distribution (DNV-CG-0129, App. C):
  one-slope (C 2.2) or two-slope (C 2.3) S-N curve via a method selector; FAT class
  presets B1–F / custom FAT X (Sec. 3 Table 1); m fixed at 3 with a displayed
  m+Δm; outputs damage D vs allowable η, fatigue life and equivalent stress
  range S_eq with a full results table. Stresses in MPa (N/mm²).
- `tools/template.html` (category `template`) — starter page with one example of
  every supported field type (see Architecture).

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
  <HH:MM:SS> CET" timestamp (converted to the Europe/Amsterdam timezone and
  labelled CET), filled by `template.js` from the page's
  `<meta name="last-updated" content="ISO-timestamp">` tag (per-page last
  edit time — on GitHub Pages `document.lastModified` is the deploy time,
  identical on all pages). Falls back to `document.lastModified` when the meta
  tag is absent (per-file mtime via `file://`). Keep both the meta tag and the
  `<span id="last-updated">` in every page; bump the meta content when you
  edit a page.
- GitHub Pages never serves files/directories starting with `_` (reserved for
  Jekyll), even in legacy branch mode — so the tool template is
  `tools/template.html` + `assets/js/template-tool.js`, not `_template.*`.

## New-tool recipe

1. **Ask the engineer first — in two rounds, not all at once.** Do not dump
   every question in one go; ask in stages and use the answers before asking
   the next round:
   - **Round 1 — scope and sources only:** ask **what the tool should do**
     (its purpose and the physics/engineering problem it solves) and whether
     the engineer has **specific references** (textbooks, standards, papers,
     norms) that must be used for the calculations — these go into the
     bottom "Calculations used & sources" card. Process the answers (pick the
     relevant equations/sources) before continuing.
   - **Round 2 — parameters and fields:** only then ask which **input
     parameters** the tool needs (names, SI units, min/max), the **default
     values** for every input parameter (and why), which **outputs** it must
     show (numbers, plots, tables, images, …), and which **field types** to
     use for each input and output (text, number, single slider, two-sided
     slider, toggle, dropdown, checkboxes, date/time, color, radio, CSV/image
     upload — and number/line plot/scatter/3D plot/table/image/CSV preview
     on the output side), as listed in `tools/template.html`.
   Do not guess these — the engineer decides.
2. Copy `tools/template.html` to `tools/<tool-name>.html` (the template is
   already wired with one example of every field type).
3. Update the `<title>`, heading, and description; keep the shared
   `../assets/...` relative links (Bootstrap, template CSS/JS, tools.js).
4. Build your tool inside the `.tool-layout` grid: "Input" header + input
   cards (left, 30%), "Output" header + output cards with plots/tables
   (right, 70%), and a `.tool-bottom` card (100% width) listing the
   equations used and their sources.
5. Slider inputs must stay in sync with a direct number/text entry for the
   same value (type exactly, or slide); plots redraw on slider release
   (`change`), cheap outputs update live (`input`).
6. Use the `SI.format` / `SI.parse` helpers from `tools.js` for all values;
   all inputs and results in SI units. Load
   `../assets/vendor/plotly/plotly-cartesian.min.js` for 2D plots and/or
   `../assets/vendor/plotly/plotly-gl3d.min.js` for 3D plots.
7. Copy `assets/js/template-tool.js` to `assets/js/<tool-name>.js` and replace
   the demo model with your calculations.
8. Add a tile to `index.html` (same markup as the existing tiles) linking to
   `tools/<tool-name>.html`, including descriptive `data-keywords` (at least
   five), a `data-category`, and a `data-updated` date.
9. Test offline by opening `index.html` directly in a browser.

## Validation checklist before finishing a tool

- Page works offline from `file://` and from GitHub Pages; no external requests
  (check the browser network tab).
- All values in SI; plot axes and readouts labeled with units via `SI.format`.
- The tile is findable via its `data-keywords`, appears under its `data-category`
  chip, and sorts correctly by `data-updated`.
- `<meta name="last-updated">` and `<span id="last-updated">` are present and the
  meta is bumped; the theme toggle still works.
- The bottom card lists the actual equations and sources from round 1.

## Git workflow

- Work on a feature branch (e.g. `GraphDigitizer`) and open a PR to `main`
  (merged PRs #1–#7 show the pattern).
- Commit messages in the repo style: "Tool name: what changed".
