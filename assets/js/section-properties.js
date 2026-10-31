// Section properties tool: composite-section geometry (parallel-axis theorem),
// section drawing and result table. All dimensions in mm; results in mm^2,
// mm^3, mm^4 (SI-derived metric units). Drawings are anchored so the lowest
// point of the section sits on y = 0.

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const DIM_MIN = 0.5;
  const DIM_MAX = 1000;
  const DIM_STEP = 0.1;

  const SECTIONS = {
    'i-beam': {
      label: 'I-beam',
      dims: [
        { key: 'h', label: 'Height h', def: 190, min: DIM_MIN, max: DIM_MAX },
        { key: 'b', label: 'Flange width b', def: 200, min: DIM_MIN, max: DIM_MAX },
        { key: 'tw', label: 'Web thickness t_w', def: 6.5, min: 1, max: 30 },
        { key: 'tf', label: 'Flange thickness t_f', def: 10, min: 1, max: 30 }
      ]
    },
    'flat-bar-v': {
      label: 'Flat bar',
      dims: [
        { key: 'h', label: 'Height h', def: 100, min: DIM_MIN, max: DIM_MAX },
        { key: 'b', label: 'Width b', def: 10, min: DIM_MIN, max: DIM_MAX }
      ]
    },
    bulb: {
      label: 'Bulb profile',
      dims: [
        { key: 'h', label: 'Height h', def: 120, min: DIM_MIN, max: DIM_MAX },
        { key: 't', label: 'Web thickness t', def: 6, min: 1, max: 30 },
        { key: 'rb', label: 'Bulb radius r_b', def: 8, min: DIM_MIN, max: DIM_MAX }
      ]
    },
    'round-tube': {
      label: 'Round tube',
      dims: [
        { key: 'd', label: 'Outer diameter d', def: 100, min: DIM_MIN, max: DIM_MAX },
        { key: 't', label: 'Wall thickness t', def: 5, min: 1, max: 30 }
      ]
    },
    'square-tube': {
      label: 'Square tube',
      dims: [
        { key: 'b', label: 'Outer width b', def: 100, min: DIM_MIN, max: DIM_MAX },
        { key: 't', label: 'Wall thickness t', def: 5, min: 1, max: 30 }
      ]
    },
    'rect-tube': {
      label: 'Rectangular tube',
      dims: [
        { key: 'h', label: 'Height h', def: 200, min: DIM_MIN, max: DIM_MAX },
        { key: 'b', label: 'Width b', def: 100, min: DIM_MIN, max: DIM_MAX },
        { key: 't', label: 'Wall thickness t', def: 6, min: 1, max: 30 }
      ]
    }
  };

  const els = {
    select: $('in-section'),
    dimBox: $('dim-controls'),
    centroidToggle: $('in-centroid'),
    out: {
      area: $('out-area'), yc: $('out-yc'), ix: $('out-ix'),
      iy: $('out-iy'), wx: $('out-wx'), wy: $('out-wy')
    },
    plot: $('out-plot'),
    tableBody: $('out-table').querySelector('tbody')
  };

  let dimRows = [];

  function fmt(v) {
    return Number(v.toPrecision(4));
  }

  // Dual-unit readout: value is in the mm-based unit, also show the SI (m-based) value
  function dual(value, mmUnit, mUnit, mmToM) {
    if (!Number.isFinite(value)) return '—';
    return SI.format(value, mmUnit) + '  (' + SI.format(value * mmToM, mUnit) + ')';
  }

  function buildDimControls(sectionKey) {
    els.dimBox.innerHTML = '';
    dimRows = [];
    SECTIONS[sectionKey].dims.forEach((d) => {
      const dmin = d.min !== undefined ? d.min : DIM_MIN;
      const dmax = d.max !== undefined ? d.max : DIM_MAX;
      const row = document.createElement('div');
      row.className = 'mb-3';
      row.innerHTML =
        '<label class="form-label mb-1" for="num-' + d.key + '">' + d.label + ' (mm)</label>' +
        '<div class="d-flex gap-2 align-items-center">' +
        '<input type="range" class="form-range flex-grow-1" id="slider-' + d.key + '" min="' + dmin + '" max="' + dmax + '" step="' + DIM_STEP + '" value="' + d.def + '">' +
        '<input type="number" class="form-control form-control-sm" style="width: 7.5rem;" id="num-' + d.key + '" min="' + dmin + '" max="' + dmax + '" step="any" value="' + d.def + '">' +
        '</div>';
      els.dimBox.appendChild(row);
      const slider = row.querySelector('#slider-' + d.key);
      const num = row.querySelector('#num-' + d.key);
      dimRows.push({ key: d.key, label: d.label, slider, num, min: dmin, max: dmax });
      slider.addEventListener('input', () => { num.value = slider.value; updateLight(); });
      slider.addEventListener('change', update);
      num.addEventListener('input', () => {
        const v = SI.parse(num.value);
        if (Number.isFinite(v)) {
          slider.value = Math.min(Math.max(v, dmin), dmax);
        }
        updateLight();
      });
      num.addEventListener('change', update);
    });
  }

  function readDims() {
    const o = {};
    dimRows.forEach(r => { o[r.key] = SI.parse(r.num.value); });
    return o;
  }

  function valid(key, d) {
    const v = Object.values(d);
    if (v.some(x => !Number.isFinite(x) || x < DIM_MIN)) return false;
    if (key === 'i-beam') return d.tw < d.b && 2 * d.tf < d.h;
    if (key === 'bulb') return d.rb >= d.t / 2 && d.rb < d.h;
    if (key === 'round-tube') return 2 * d.t < d.d;
    if (key === 'square-tube') return 2 * d.t < d.b;
    if (key === 'rect-tube') return 2 * d.t < Math.min(d.b, d.h);
    return true;
  }

  function compute(key, d) {
    let A, yc, Ix, Iy, halfW, h;
    if (key === 'i-beam') {
      h = d.h;
      A = d.b * d.h - (d.b - d.tw) * (d.h - 2 * d.tf);
      Ix = (d.b * Math.pow(d.h, 3) - (d.b - d.tw) * Math.pow(d.h - 2 * d.tf, 3)) / 12;
      Iy = (2 * d.tf * Math.pow(d.b, 3) + (d.h - 2 * d.tf) * Math.pow(d.tw, 3)) / 12;
      yc = d.h / 2;
      halfW = d.b / 2;
    } else if (key === 'flat-bar-v') {
      h = d.h;
      A = d.b * d.h;
      Ix = d.b * Math.pow(d.h, 3) / 12;
      Iy = d.h * Math.pow(d.b, 3) / 12;
      yc = d.h / 2;
      halfW = d.b / 2;
    } else if (key === 'bulb') {
      h = d.h;
      const webH = d.h - d.rb;
      const Aw = d.t * webH;
      const yWeb = webH / 2;
      const Ab = Math.PI * d.rb * d.rb / 2;
      const yBulb = webH + 4 * d.rb / (3 * Math.PI);
      A = Aw + Ab;
      yc = (Aw * yWeb + Ab * yBulb) / A;
      Ix = d.t * Math.pow(webH, 3) / 12 + Aw * Math.pow(yWeb - yc, 2)
        + Math.pow(d.rb, 4) * (Math.PI / 8 - 8 / (9 * Math.PI)) + Ab * Math.pow(yBulb - yc, 2);
      Iy = webH * Math.pow(d.t, 3) / 12 + Math.PI * Math.pow(d.rb, 4) / 8;
      halfW = d.rb;
    } else if (key === 'round-tube') {
      h = d.d;
      const di = d.d - 2 * d.t;
      A = Math.PI / 4 * (d.d * d.d - di * di);
      Ix = Math.PI / 64 * (Math.pow(d.d, 4) - Math.pow(di, 4));
      Iy = Ix;
      yc = d.d / 2;
      halfW = d.d / 2;
    } else if (key === 'square-tube') {
      h = d.b;
      const bi = d.b - 2 * d.t;
      A = d.b * d.b - bi * bi;
      Ix = (Math.pow(d.b, 4) - Math.pow(bi, 4)) / 12;
      Iy = Ix;
      yc = d.b / 2;
      halfW = d.b / 2;
    } else {
      h = d.h;
      const bi = d.b - 2 * d.t;
      const hi = d.h - 2 * d.t;
      A = d.b * d.h - bi * hi;
      Ix = (d.b * Math.pow(d.h, 3) - bi * Math.pow(hi, 3)) / 12;
      Iy = (d.h * Math.pow(d.b, 3) - hi * Math.pow(bi, 3)) / 12;
      yc = d.h / 2;
      halfW = d.b / 2;
    }
    const Wx = Ix / Math.max(yc, h - yc);
    const Wy = Iy / halfW;
    return { A, yc, Ix, Iy, Wx, Wy, halfW, h };
  }

  function circlePath(cx, cy, r, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = (2 * Math.PI * i) / n;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return 'M' + pts.map(p => p[0].toFixed(6) + ',' + p[1].toFixed(6)).join('L') + 'Z';
  }

  function rectPath(x0, y0, x1, y1) {
    return 'M' + [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(p => p[0] + ',' + p[1]).join('L') + 'Z';
  }

  function sectionShapes(key, d) {
    const fill = 'rgba(39, 41, 116, 0.55)';
    const line = { color: '#272974', width: 2 };
    const shapes = [];
    if (key === 'i-beam') {
      const { h, b, tw, tf } = d;
      shapes.push({
        type: 'path', fillrule: 'evenodd', fillcolor: fill, line,
        path: rectPath(-b / 2, 0, b / 2, tf) + rectPath(-tw / 2, tf, tw / 2, h - tf) + rectPath(-b / 2, h - tf, b / 2, h)
      });
    } else if (key === 'flat-bar-v') {
      shapes.push({ type: 'rect', x0: -d.b / 2, x1: d.b / 2, y0: 0, y1: d.h, fillcolor: fill, line });
    } else if (key === 'bulb') {
      const { h, t, rb } = d;
      const webTop = h - rb;
      const n = 48;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const a = (Math.PI * i) / n;
        pts.push([rb * Math.cos(a), webTop + rb * Math.sin(a)]);
      }
      const bulbPath = 'M' + pts.map(p => p[0].toFixed(6) + ',' + p[1].toFixed(6)).join('L') + 'Z';
      shapes.push({ type: 'path', fillrule: 'evenodd', fillcolor: fill, line, path: rectPath(-t / 2, 0, t / 2, webTop) + bulbPath });
    } else if (key === 'round-tube') {
      shapes.push({
        type: 'path', fillrule: 'evenodd', fillcolor: fill, line,
        path: circlePath(0, d.d / 2, d.d / 2, 64) + circlePath(0, d.d / 2, (d.d - 2 * d.t) / 2, 64)
      });
    } else if (key === 'square-tube') {
      const bi = d.b - 2 * d.t;
      shapes.push({
        type: 'path', fillrule: 'evenodd', fillcolor: fill, line,
        path: rectPath(-d.b / 2, 0, d.b / 2, d.b) + rectPath(-bi / 2, d.t, bi / 2, d.b - d.t)
      });
    } else {
      const bi = d.b - 2 * d.t;
      const hi = d.h - 2 * d.t;
      shapes.push({
        type: 'path', fillrule: 'evenodd', fillcolor: fill, line,
        path: rectPath(-d.b / 2, 0, d.b / 2, d.h) + rectPath(-bi / 2, d.t, bi / 2, d.h - d.t)
      });
    }
    return shapes;
  }

  function themeColors() {
    const dark = document.documentElement.dataset.bsTheme === 'dark';
    return {
      grid: dark ? '#35347a' : '#d5d7ea',
      font: dark ? '#f1f2fa' : '#1f2340',
      paper: dark ? '#1e1f4d' : '#ffffff',
      accent: dark ? '#ffe58a' : '#272974'
    };
  }

  function renderPlot(key, d, res) {
    const colors = themeColors();
    const traces = [];
    const shapes = sectionShapes(key, d);
    if (els.centroidToggle.checked) {
      traces.push({
        x: [-res.halfW * 1.4, res.halfW * 1.4], y: [res.yc, res.yc],
        mode: 'lines', line: { color: colors.accent, width: 1.5, dash: 'dash' }, hoverinfo: 'skip', showlegend: false
      });
      traces.push({
        x: [0, 0], y: [-res.h * 0.08, res.h * 1.12],
        mode: 'lines', line: { color: colors.accent, width: 1.5, dash: 'dash' }, hoverinfo: 'skip', showlegend: false
      });
      traces.push({
        x: [0], y: [res.yc], mode: 'markers',
        marker: { size: 12, color: colors.accent, symbol: 'x' },
        name: 'centroid', hoverinfo: 'name'
      });
    }
    Plotly.react(els.plot, traces, {
      title: SECTIONS[key].label,
      shapes,
      margin: { t: 40, r: 20, b: 45, l: 60 },
      paper_bgcolor: colors.paper,
      plot_bgcolor: colors.paper,
      font: { color: colors.font },
      xaxis: { title: 'x (mm)', gridcolor: colors.grid, zeroline: true, zerolinecolor: colors.grid, scaleanchor: 'y', scaleratio: 1 },
      yaxis: { title: 'y (mm)', gridcolor: colors.grid, zeroline: true, zerolinecolor: colors.grid }
    }, { responsive: true, displaylogo: false });
  }

  function renderNumbers(res) {
    els.out.area.textContent = dual(res.A, 'mm²', 'm²', 1e-6);
    els.out.yc.textContent = dual(res.yc, 'mm', 'm', 1e-3);
    els.out.ix.textContent = dual(res.Ix, 'mm⁴', 'm⁴', 1e-12);
    els.out.iy.textContent = dual(res.Iy, 'mm⁴', 'm⁴', 1e-12);
    els.out.wx.textContent = dual(res.Wx, 'mm³', 'm³', 1e-9);
    els.out.wy.textContent = dual(res.Wy, 'mm³', 'm³', 1e-9);
  }

  function renderTable(key, d, res) {
    const num = (v) => String(Number(v.toPrecision(4)));
    const rows = [
      ['Section', SECTIONS[key].label, '—'],
      ...SECTIONS[key].dims.map(dd => [dd.label, num(d[dd.key]), 'mm']),
      ['Area A', num(res.A), 'mm² = ' + num(res.A * 1e-6) + ' m²'],
      ['Centroid ȳ', num(res.yc), 'mm = ' + num(res.yc * 1e-3) + ' m'],
      ['I_x (strong)', num(res.Ix), 'mm⁴ = ' + num(res.Ix * 1e-12) + ' m⁴'],
      ['I_y (weak)', num(res.Iy), 'mm⁴ = ' + num(res.Iy * 1e-12) + ' m⁴'],
      ['W_x (strong)', num(res.Wx), 'mm³ = ' + num(res.Wx * 1e-9) + ' m³'],
      ['W_y (weak)', num(res.Wy), 'mm³ = ' + num(res.Wy * 1e-9) + ' m³']
    ];
    els.tableBody.innerHTML = rows
      .map(r => '<tr><td>' + r[0] + '</td><td class="result-value">' + r[1] + '</td><td>' + r[2] + '</td></tr>').join('');
  }

  function updateLight() {
    const key = els.select.value;
    const d = readDims();
    if (!valid(key, d)) { els.tableBody.innerHTML = ''; return; }
    const res = compute(key, d);
    renderNumbers(res);
    renderTable(key, d, res);
  }

  function update() {
    const key = els.select.value;
    const d = readDims();
    if (!valid(key, d)) {
      Object.values(els.out).forEach(el => { el.textContent = '—'; });
      Plotly.purge(els.plot);
      els.tableBody.innerHTML = '';
      return;
    }
    const res = compute(key, d);
    renderNumbers(res);
    renderTable(key, d, res);
    renderPlot(key, d, res);
  }

  els.select.addEventListener('change', () => { buildDimControls(els.select.value); update(); });
  els.centroidToggle.addEventListener('change', update);

  new MutationObserver(() => { if (els.plot.data) update(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });

  buildDimControls(els.select.value);
  update();
})();
