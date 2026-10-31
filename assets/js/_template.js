// Demo wiring for tools/_template.html: shows how each input field type
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
    outNumber: $('out-number'),
    plot: $('out-plot'),
    tableBody: $('out-table').querySelector('tbody'),
    outImage: $('out-image')
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
    return {
      label: els.text.value.trim() || 'Signal',
      f: SI.parse(els.number.value),
      A: SI.parse(els.slider.value),
      xMin: lo,
      xMax: hi,
      markers: els.toggle.checked
    };
  }

  function syncDualRange(source) {
    let lo = SI.parse(els.rangeMinVal.value);
    let hi = SI.parse(els.rangeMaxVal.value);
    if (!Number.isFinite(lo)) lo = SI.parse(els.rangeMin.value);
    if (!Number.isFinite(hi)) hi = SI.parse(els.rangeMax.value);
    if (lo > hi) { const t = lo; lo = hi; hi = t; }
    els.rangeMin.value = lo;
    els.rangeMax.value = hi;
    els.rangeMinVal.value = lo;
    els.rangeMaxVal.value = hi;
    const pct = (v) => ((v - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * 100;
    els.rangeFill.style.left = pct(lo) + '%';
    els.rangeFill.style.width = (pct(hi) - pct(lo)) + '%';
  }

  function themeColors() {
    const dark = document.documentElement.dataset.bsTheme === 'dark';
    return {
      line: dark ? '#c7c8f0' : '#272974',
      grid: dark ? '#35347a' : '#d5d7ea',
      font: dark ? '#f1f2fa' : '#1f2340',
      paper: dark ? '#1e1f4d' : '#ffffff'
    };
  }

  function demoModel(p) {
    const n = 400;
    const xs = [];
    const ys = [];
    for (let i = 0; i <= n; i++) {
      const x = p.xMin + ((p.xMax - p.xMin) * i) / n;
      xs.push(x);
      ys.push(p.A * Math.sin(2 * Math.PI * p.f * x));
    }
    const yRms = Math.sqrt(ys.reduce((s, y) => s + y * y, 0) / ys.length);
    return { xs, ys, yRms };
  }

  function update() {
    const p = readInputs();
    if (!Number.isFinite(p.f) || p.f <= 0 || !Number.isFinite(p.A) || p.xMax <= p.xMin) {
      els.outNumber.textContent = '—';
      Plotly.purge(els.plot);
      els.tableBody.innerHTML = '';
      els.outImage.hidden = true;
      return;
    }
    const res = demoModel(p);

    els.outNumber.textContent = SI.format(res.yRms, 'm');

    const colors = themeColors();
    Plotly.react(els.plot, [{
      x: res.xs,
      y: res.ys,
      mode: p.markers ? 'lines+markers' : 'lines',
      line: { color: colors.line, width: 2 },
      marker: { size: 5, color: colors.line }
    }], {
      title: p.label,
      margin: { t: 40, r: 20, b: 45, l: 60 },
      paper_bgcolor: colors.paper,
      plot_bgcolor: colors.paper,
      font: { color: colors.font },
      xaxis: { title: 'x (m)', gridcolor: colors.grid, zeroline: false },
      yaxis: { title: 'y (m)', gridcolor: colors.grid, zeroline: true, zerolinecolor: colors.grid }
    }, { responsive: true, displaylogo: false });

    const num = (v) => String(Number(v.toPrecision(4)));
    els.tableBody.innerHTML = [
      ['Amplitude A', num(p.A), 'm'],
      ['Frequency f', num(p.f), 'Hz'],
      ['Window x', num(p.xMin) + ' … ' + num(p.xMax), 'm'],
      ['y RMS', num(res.yRms), 'm'],
      ['Markers', p.markers ? 'on' : 'off', '—']
    ].map(r => '<tr><td>' + r[0] + '</td><td class="result-value">' + r[1] + '</td><td>' + r[2] + '</td></tr>').join('');

    Plotly.toImage(els.plot, { format: 'png', width: 900, height: 440 }).then((url) => {
      els.outImage.src = url;
      els.outImage.hidden = false;
    });
  }

  els.slider.addEventListener('input', () => {
    els.sliderValue.textContent = els.slider.value;
    update();
  });
  els.rangeMin.addEventListener('input', () => syncDualRange('slider'));
  els.rangeMax.addEventListener('input', () => syncDualRange('slider'));
  els.rangeMinVal.addEventListener('input', () => syncDualRange('number'));
  els.rangeMaxVal.addEventListener('input', () => syncDualRange('number'));
  ['in-text', 'in-number', 'in-toggle'].forEach(id => $(id).addEventListener('input', update));

  new MutationObserver(() => { if (els.plot.data) update(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });

  syncDualRange();
  update();
})();
