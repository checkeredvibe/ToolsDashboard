# ToolsDashboard

Offline HTML dashboard providing engineering calculation and visualisation tools.
All results use SI units. No external network resources are used — open
`index.html` directly in a browser.

## Structure

- `index.html` — main dashboard with clickable tiles linking to each tool
- `tools/` — one standalone HTML file per tool
- `assets/css/template.css` — shared dashboard template styles
- `assets/js/template.js` — shared layout/header/footer logic
- `assets/js/tools.js` — shared SI-unit and calculation helpers
- `assets/img/` — self-hosted icons for tiles

## Adding a new tool

1. Copy an existing page in `tools/` (or the template stub) to `<tool-name>.html`.
2. Link the shared stylesheet and scripts from `../assets/...`.
3. Add a tile to `index.html` linking to `tools/<tool-name>.html`.
