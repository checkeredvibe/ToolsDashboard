// Demo wiring for tools/template.html: shows how each input field type
// feeds the output fields. Copy and replace the demo model with your own.

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const els = {
    text: $('in-text'),
    number: $('in-number'),
    slider: $('in-slider'),
    sliderValue: $('in-slider-value'),
    rangeMin: $('in-range-min'),
    rangeMax: $('in-range-max'),
    rangeMinVal: $('in-range-min-val'),
    rangeMaxVal: $('in-range-max-val'),
    rangeFill: $('range-fill'),
    toggle: $('in-toggle'),
    select: $('in-select'),
    checks: [$('in-check-1'), $('in-check-2'), $('in-check-3')],
    datetime: $('in-datetime'),
    color: $('in-color'),
    radios: Array.from(document.querySelectorAll('input[name="in-radio"]')),
    outNumber: $('out-number'),
    plot: $('out-plot'),
    plot3d: $('out-plot-3d'),
    plotContour: $('out-plot-contour'),
    tableBody: $('out-table').querySelector('tbody'),
    outImage: $('out-image'),
    btnCopy: $('btn-copy-results'),
    btnPng: $('btn-download-png')
  };

  const RANGE_MIN = 0;
  const RANGE_MAX = 20;

  function readInputs() {
    let lo = SI.parse(els.rangeMinVal.value);
    let hi = SI.parse(els.rangeMaxVal.value);
    if (!Number.isFinite(lo)) lo = RANGE_MIN;
    if (!Number.isFinite(hi)) hi = RANGE_MAX;
    lo = Math.min(Math.max(lo, RANGE_MIN), RANGE_MAX);
    hi = Math.min(Math.max(hi, RANGE_MIN), RANGE_MAX);
    if (lo > hi) [lo, hi] = [hi, lo];
    const radio = els.radios.find(r => r.checked);
    return {
      label: els.text.value.trim() || 'Signal',
      f: SI.parse(els.number.value),
      A: SI.parse(els.slider.value),
      xMin: lo,
      xMax: hi,
      markers: els.toggle.checked,
      waveform: els.select.value,
      checks: els.checks.filter(c => c.checked).map(c => c.id),
      datetime: els.datetime.value,
      color: els.color.value,
      radio: radio ? radio.value : null
    };
  }

  function setWindow(lo, hi, source) {
    if (!Number.isFinite(lo)) lo = RANGE_MIN;
    if (!Number.isFinite(hi)) hi = RANGE_MAX;
    lo = Math.min(Math.max(lo, RANGE_MIN), RANGE_MAX);
    hi = Math.min(Math.max(hi, RANGE_MIN), RANGE_MAX);
    if (lo > hi) {
      if (source === 'min-slider') lo = hi;
      else if (source === 'max-slider') hi = lo;
      else { const t = lo; lo = hi; hi = t; }
    }
    els.rangeMin.value = lo;
    els.rangeMax.value = hi;
    els.rangeMinVal.value = lo;
    els.rangeMaxVal.value = hi;
    const pct = (v) => ((v - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * 100;
    els.rangeFill.style.left = pct(lo) + '%';
    els.rangeFill.style.width = (pct(hi) - pct(lo)) + '%';
    // Keep the handle closer to the middle on top so both stay grabbable at equal values
    const mid = (RANGE_MIN + RANGE_MAX) / 2;
    els.rangeMin.style.zIndex = lo >= mid ? 5 : 3;
    els.rangeMax.style.zIndex = hi <= mid ? 5 : 4;
  }

  function syncDualRange() {
    setWindow(SI.parse(els.rangeMinVal.value), SI.parse(els.rangeMaxVal.value), 'typed');
  }

  function themeColors() {
    const dark = document.documentElement.dataset.bsTheme === 'dark';
    return {
      grid: dark ? '#35347a' : '#d5d7ea',
      font: dark ? '#f1f2fa' : '#1f2340',
      paper: dark ? '#1e1f4d' : '#ffffff'
    };
  }

  function wave(p, x) {
    const ph = 2 * Math.PI * p.f * x;
    switch (p.waveform) {
      case 'square': return p.A * Math.sign(Math.sin(ph));
      case 'triangle': return p.A * (2 / Math.PI) * Math.asin(Math.sin(ph));
      case 'sawtooth': return p.A * (2 * ((p.f * x) % 1) - 1);
      default: return p.A * Math.sin(ph);
    }
  }

  function demoModel(p) {
    const n = 400;
    const xs = [];
    const ys = [];
    for (let i = 0; i <= n; i++) {
      const x = p.xMin + ((p.xMax - p.xMin) * i) / n;
      xs.push(x);
      ys.push(wave(p, x));
    }
    const yRms = Math.sqrt(ys.reduce((s, y) => s + y * y, 0) / ys.length);
    return { xs, ys, yRms };
  }

  function surfaceGrid(p) {
    const n = 40;
    const xs = [];
    const ys = [];
    const z = [];
    for (let i = 0; i <= n; i++) {
      const x = p.xMin + ((p.xMax - p.xMin) * i) / n;
      xs.push(x);
      for (let j = 0; j <= n; j++) {
        const y = -p.A + (2 * p.A * j) / n;
        if (i === 0) ys.push(y);
        z[i] = z[i] || [];
        z[i].push(Math.sin(2 * Math.PI * p.f * x) * Math.cos(2 * Math.PI * p.f * y * 0.5));
      }
    }
    return { xs, ys, z };
  }

  const plotConfig = { responsive: true, displaylogo: false };

  function update() {
    const p = readInputs();
    syncDualRange();
    if (!Number.isFinite(p.f) || p.f <= 0 || !Number.isFinite(p.A) || p.xMax <= p.xMin) {
      els.outNumber.textContent = '—';
      Plotly.purge(els.plot);
      Plotly.purge(els.plot3d);
      Plotly.purge(els.plotContour);
      els.tableBody.innerHTML = '';
      els.outImage.hidden = true;
      return;
    }
    const res = demoModel(p);
    const grid = surfaceGrid(p);
    setWindow(p.xMin, p.xMax, 'model');
    const colors = themeColors();

    els.outNumber.textContent = SI.format(res.yRms, 'm');

    Plotly.react(els.plot, [{
      x: res.xs,
      y: res.ys,
      mode: p.markers ? 'lines+markers' : 'lines',
      line: { color: p.color, width: 2 },
      marker: { size: 5, color: p.color }
    }], {
      title: p.label,
      margin: { t: 40, r: 20, b: 45, l: 60 },
      paper_bgcolor: colors.paper,
      plot_bgcolor: colors.paper,
      font: { color: colors.font },
      xaxis: { title: 'x (m)', gridcolor: colors.grid, zeroline: false },
      yaxis: { title: 'y (m)', gridcolor: colors.grid, zeroline: true, zerolinecolor: colors.grid }
    }, plotConfig);

    Plotly.react(els.plot3d, [{
      type: 'surface',
      x: grid.xs,
      y: grid.ys,
      z: grid.z,
      colorscale: 'Viridis'
    }], {
      title: 'Demo surface z(x, y)',
      margin: { t: 40, r: 10, b: 10, l: 10 },
      paper_bgcolor: colors.paper,
      font: { color: colors.font },
      scene: {
        xaxis: { title: 'x (m)', gridcolor: colors.grid },
        yaxis: { title: 'y (m)', gridcolor: colors.grid },
        zaxis: { title: 'z', gridcolor: colors.grid }
      }
    }, plotConfig);

    Plotly.react(els.plotContour, [{
      type: 'contour',
      x: grid.xs,
      y: grid.ys,
      z: grid.z,
      colorscale: 'Viridis',
      contours: { coloring: 'heatmap' }
    }], {
      title: 'Contour of z(x, y)',
      margin: { t: 40, r: 20, b: 45, l: 60 },
      paper_bgcolor: colors.paper,
      plot_bgcolor: colors.paper,
      font: { color: colors.font },
      xaxis: { title: 'x (m)', gridcolor: colors.grid },
      yaxis: { title: 'y (m)', gridcolor: colors.grid }
    }, plotConfig);

    const num = (v) => String(Number(v.toPrecision(4)));
    els.tableBody.innerHTML = [
      ['Amplitude A', num(p.A), 'm'],
      ['Frequency f', num(p.f), 'Hz'],
      ['Waveform', p.waveform, '—'],
      ['Window x', num(p.xMin) + ' … ' + num(p.xMax), 'm'],
      ['y RMS', num(res.yRms), 'm'],
      ['Markers', p.markers ? 'on' : 'off', '—'],
      ['Checkboxes', p.checks.length ? p.checks.join(', ') : 'none', '—'],
      ['Datetime', p.datetime || 'not set', '—'],
      ['Line color', p.color, '—'],
      ['Radio', p.radio || 'none', '—']
    ].map(r => '<tr><td>' + r[0] + '</td><td class="result-value">' + r[1] + '</td><td>' + r[2] + '</td></tr>').join('');

    Plotly.toImage(els.plot, { format: 'png', width: 900, height: 440 }).then((url) => {
      els.outImage.src = url;
      els.outImage.hidden = false;
    });
  }

  function resultsText() {
    const p = readInputs();
    const rows = Array.from(els.tableBody.querySelectorAll('tr'))
      .map(tr => Array.from(tr.children).map(td => td.textContent).join(' = '));
    return (els.outNumber.textContent !== '—' ? 'y RMS = ' + els.outNumber.textContent + '\n' : '') + rows.join('\n');
  }

  els.btnCopy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(resultsText());
      els.btnCopy.textContent = '✓ Copied';
    } catch (e) {
      els.btnCopy.textContent = '✗ Failed';
    }
    setTimeout(() => { els.btnCopy.innerHTML = '&#128203; Copy results'; }, 1500);
  });

  els.btnPng.addEventListener('click', () => {
    Plotly.downloadImage(els.plot, { format: 'png', width: 1200, height: 600, filename: 'plot' });
  });

  els.slider.addEventListener('input', () => {
    els.sliderValue.textContent = els.slider.value;
    update();
  });
  els.rangeMin.addEventListener('input', () => setWindow(SI.parse(els.rangeMin.value), SI.parse(els.rangeMax.value), 'min-slider'));
  els.rangeMax.addEventListener('input', () => setWindow(SI.parse(els.rangeMin.value), SI.parse(els.rangeMax.value), 'max-slider'));
  els.rangeMinVal.addEventListener('input', () => setWindow(SI.parse(els.rangeMinVal.value), SI.parse(els.rangeMaxVal.value), 'typed'));
  els.rangeMaxVal.addEventListener('input', () => setWindow(SI.parse(els.rangeMinVal.value), SI.parse(els.rangeMaxVal.value), 'typed'));
  ['in-range-min', 'in-range-max', 'in-range-min-val', 'in-range-max-val'].forEach(id => $(id).addEventListener('input', update));
  ['in-text', 'in-number', 'in-toggle', 'in-select', 'in-datetime', 'in-color'].forEach(id => $(id).addEventListener('input', update));
  els.checks.forEach(c => c.addEventListener('change', update));
  els.radios.forEach(r => r.addEventListener('change', update));

  new MutationObserver(() => { if (els.plot.data) update(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });

  syncDualRange();
  update();
})();
