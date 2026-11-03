// Projectile motion tool: calculations, Plotly trajectory plot and animation.
// All values in SI units; formatting via the shared SI helpers from tools.js.

(function () {
  'use strict';

  const form = document.getElementById('inputs-form');
  const plotEl = document.getElementById('plot');
  const animateBtn = document.getElementById('animate-btn');

  const out = {
    time: document.getElementById('out-time'),
    range: document.getElementById('out-range'),
    apex: document.getElementById('out-apex'),
    impact: document.getElementById('out-impact')
  };

  function readInputs() {
    return {
      v0: SI.parse(document.getElementById('in-speed').value),
      angleDeg: SI.parse(document.getElementById('in-angle').value),
      h0: SI.parse(document.getElementById('in-height').value),
      g: SI.parse(document.getElementById('in-gravity').value),
      steps: Math.round(SI.parse(document.getElementById('in-steps').value)) || 200
    };
  }

  function isValid(p) {
    return Number.isFinite(p.v0) && p.v0 > 0 &&
      Number.isFinite(p.angleDeg) && p.angleDeg >= 0 && p.angleDeg <= 90 &&
      Number.isFinite(p.h0) && p.h0 >= 0 &&
      Number.isFinite(p.g) && p.g > 0 &&
      Number.isFinite(p.steps) && p.steps >= 10;
  }

  function compute(p) {
    const theta = p.angleDeg * Math.PI / 180;
    const vx = p.v0 * Math.cos(theta);
    const vy = p.v0 * Math.sin(theta);
    const tFlight = (vy + Math.sqrt(vy * vy + 2 * p.g * p.h0)) / p.g;
    const range = vx * tFlight;
    const tApex = vy / p.g;
    const hMax = p.h0 + (vy * vy) / (2 * p.g);
    const vyImpact = vy - p.g * tFlight;
    const vImpact = Math.hypot(vx, vyImpact);
    const t = [];
    const x = [];
    const y = [];
    for (let i = 0; i <= p.steps; i++) {
      const ti = (tFlight * i) / p.steps;
      t.push(ti);
      x.push(vx * ti);
      y.push(p.h0 + vy * ti - 0.5 * p.g * ti * ti);
    }
    return { theta, vx, vy, tFlight, range, tApex, hMax, vImpact, t, x, y };
  }

  function themeColors() {
    const dark = document.documentElement.dataset.bsTheme === 'dark';
    return {
      line: dark ? '#c7c8f0' : '#272974',
      marker: dark ? '#ffe58a' : '#272974',
      grid: dark ? '#35347a' : '#d5d7ea',
      font: dark ? '#f1f2fa' : '#1f2340',
      paper: dark ? '#1e1f4d' : '#ffffff'
    };
  }

  function layoutFor(res, colors) {
    return {
      margin: { t: 20, r: 20, b: 45, l: 60 },
      paper_bgcolor: colors.paper,
      plot_bgcolor: colors.paper,
      font: { color: colors.font },
      xaxis: { title: 'x (m)', zeroline: false, gridcolor: colors.grid, range: [0, res.range * 1.05] },
      yaxis: { title: 'y (m)', zeroline: true, zerolinecolor: colors.grid, gridcolor: colors.grid, range: [0, Math.max(res.hMax * 1.1, 1)] },
      showlegend: false
    };
  }

  const config = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] };

  function draw(res) {
    const colors = themeColors();
    const tracePath = { x: res.x, y: res.y, mode: 'lines', line: { color: colors.line, width: 2.5 }, hoverinfo: 'skip' };
    const traceMarker = { x: [res.x[0]], y: [res.y[0]], mode: 'markers', marker: { color: colors.marker, size: 10 } };
    Plotly.newPlot(plotEl, [tracePath, traceMarker], layoutFor(res, colors), config);
    return colors;
  }

  function buildFrames(res) {
    const frames = [];
    for (let i = 0; i < res.x.length; i++) {
      frames.push({
        name: String(i),
        data: [{ x: [res.x[i]], y: [res.y[i]] }]
      });
    }
    return frames;
  }

  function update() {
    const p = readInputs();
    if (!isValid(p)) {
      Object.values(out).forEach(el => { el.textContent = '—'; });
      Plotly.purge(plotEl);
      return;
    }
    const res = compute(p);
    out.time.textContent = SI.format(res.tFlight, 's');
    out.range.textContent = SI.format(res.range, 'm');
    out.apex.textContent = SI.format(res.hMax, 'm');
    out.impact.textContent = SI.format(res.vImpact, 'm/s');
    draw(res);
    plotEl._frames = buildFrames(res);
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); update(); });
  form.addEventListener('input', update);

  animateBtn.addEventListener('click', () => {
    if (!plotEl._frames || plotEl._frames.length === 0) return;
    Plotly.animate(plotEl, plotEl._frames, {
      frame: { duration: 20, redraw: false },
      transition: { duration: 0 },
      mode: 'afterall'
    });
  });

  const observer = new MutationObserver(() => {
    const p = readInputs();
    if (isValid(p) && plotEl.data) update();
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });

  update();
})();
