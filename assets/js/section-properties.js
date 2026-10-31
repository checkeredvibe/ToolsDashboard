// Section properties tool: composite-section geometry (parallel-axis theorem),
// section drawing and result table. All values in SI units (m, m^2, m^3, m^4).

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const SECTIONS = {
    'i-section': {
      label: 'I-section (HEA / IPE)',
      dims: [
        { key: 'h', label: 'Height h', def: 0.19 },
        { key: 'b', label: 'Flange width b', def: 0.2 },
        { key: 'tw', label: 'Web thickness t_w', def: 0.0065 },
        { key: 'tf', label: 'Flange thickness t_f', def: 0.01 }
      ]
    },
    'flat-bar': {
      label: 'Flat bar',
      dims: [
        { key: 'b', label: 'Width b', def: 0.2 },
        { key: 't', label: 'Thickness t', def: 0.01 }
      ]
    },
    bulb: {
      label: 'Bulb profile',
      dims: [
        { key: 'h', label: 'Height h', def: 0.12 },
        { key: 't', label: 'Web thickness t', def: 0.006 },
        { key: 'r', label: 'Bulb radius r', def: 0.006 }
      ]
    },
    rhs: {
      label: 'RHS (hollow rectangle)',
      dims: [
        { key: 'h', label: 'Height h', def: 0.2 },
        { key: 'b', label: 'Width b', def: 0.1 },
        { key: 't', label: 'Wall thickness t', def: 0.006 }
      ]
    },
    round: {
      label: 'Solid round bar',
      dims: [
        { key: 'd', label: 'Diameter d', def: 0.1 }
      ]
    }
  };

  const DIM_MIN = 0.0005;
  const DIM_MAX = 0.5;
  const DIM_STEP = 0.0005;

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

  function buildDimControls(sectionKey) {
    els.dimBox.innerHTML = '';
    dimRows = [];
    SECTIONS[sectionKey].dims.forEach((d) => {
      const row = document.createElement('div');
      row.className = 'mb-3';
      row.innerHTML =
        '<label class="form-label mb-1">' + d.label + ' (m) <output class="result-value" id="out-' + d.key + '">' + d.def + '</output></label>' +
        '<div class="d-flex gap-2 align-items-center">' +
        '<input type="range" class="form-range flex-grow-1" id="slider-' + d.key + '" min="' + DIM_MIN + '" max="' + DIM_MAX + '" step="' + DIM_STEP + '" value="' + d.def + '">' +
        '<input type="number" class="form-control form-control-sm" style="width: 7.5rem;" id="num-' + d.key + '" min="' + DIM_MIN + '" max="' + DIM_MAX + '" step="any" value="' + d.def + '">' +
        '</div>';
      els.dimBox.appendChild(row);
      const slider = row.querySelector('#slider-' + d.key);
      const num = row.querySelector('#num-' + d.key);
      const outv = row.querySelector('#out-' + d.key);
      const entry = { key: d.key, label: d.label, slider, num, outv };
      dimRows.push(entry);
      slider.addEventListener('input', () => { num.value = slider.value; outv.textContent = fmt(slider.value); updateLight(); });
      slider.addEventListener('change', update);
      num.addEventListener('input', () => {
        const v = SI.parse(num.value);
        if (Number.isFinite(v)) {
          const c = Math.min(Math.max(v, DIM_MIN), DIM_MAX);
          slider.value = c;
          outv.textContent = fmt(c);
        }
        updateLight();
      });
      num.addEventListener('change', update);
    });
  }

  function fmt(v) {
    return Number(v.toPrecision(4));
  }

  function readDims() {
    const o = {};
    dimRows.forEach(r => { o[r.key] = SI.parse(r.num.value); });
    return o;
  }

  function valid(d) {
    const v = Object.values(d);
    if (v.some(x => !Number.isFinite(x) || x < DIM_MIN)) return false;
    if (d.tw !== undefined && (d.tw >= d.b / 2 || 2 * d.tf >= d.h)) return false;
    if (d.t !== undefined && d.r !== undefined && d.r > d.h / 2) return false;
    if (d.t !== undefined && d.b !== undefined && d.h !== undefined && d.tw === undefined && 2 * d.t >= Math.min(d.b, d.h)) return false;
    return true;
  }

  function compute(sectionKey, d) {
    let A, yc, Ix, Iy, halfW, h;
    if (sectionKey === 'i-section') {
      h = d.h;
      A = d.b * d.h - (d.b - d.tw) * (d.h - 2 * d.tf);
      Ix = (d.b * Math.pow(d.h, 3) - (d.b - d.tw) * Math.pow(d.h - 2 * d.tf, 3)) / 12;
      Iy = (2 * d.tf * Math.pow(d.b, 3) + (d.h - 2 * d.tf) * Math.pow(d.tw, 3)) / 12;
      yc = d.h / 2;
      halfW = d.b / 2;
    } else if (sectionKey === 'flat-bar') {
      h = d.t;
      A = d.b * d.t;
      Ix = d.b * Math.pow(d.t, 3) / 12;
      Iy = d.t * Math.pow(d.b, 3) / 12;
      yc = d.t / 2;
      halfW = d.b / 2;
    } else if (sectionKey === 'bulb') {
      h = d.h;
      const webH = d.h - d.r;
      const Aw = d.t * webH;
      const yWeb = d.r + webH / 2;
      const Ab = Math.PI * d.r * d.r / 2;
      const yBulb = d.r - 4 * d.r / (3 * Math.PI);
      A = Aw + Ab;
      yc = (Aw * yWeb + Ab * yBulb) / A;
      const IxWeb = d.t * Math.pow(webH, 3) / 12 + Aw * Math.pow(yWeb - yc, 2);
      const IxBulb = Math.pow(d.r, 4) * (Math.PI / 8 - 8 / (9 * Math.PI)) + Ab * Math.pow(yBulb - yc, 2);
      Ix = IxWeb + IxBulb;
      Iy = webH * Math.pow(d.t, 3) / 12 + Math.PI * Math.pow(d.r, 4) / 8;
      halfW = Math.max(d.t / 2, d.r);
    } else if (sectionKey === 'rhs') {
      h = d.h;
      A = d.b * d.h - (d.b - 2 * d.t) * (d.h - 2 * d.t);
      Ix = (d.b * Math.pow(d.h, 3) - (d.b - 2 * d.t) * Math.pow(d.h - 2 * d.t, 3)) / 12;
      Iy = (d.h * Math.pow(d.b, 3) - (d.h - 2 * d.t) * Math.pow(d.b - 2 * d.t, 3)) / 12;
      yc = d.h / 2;
      halfW = d.b / 2;
    } else {
      h = d.d;
      A = Math.PI * d.d * d.d / 4;
      Ix = Math.PI * Math.pow(d.d, 4) / 64;
      Iy = Ix;
      yc = d.d / 2;
      halfW = d.d / 2;
    }
    const Wx = Ix / Math.max(yc, h - yc);
    const Wy = Iy / halfW;
    return { A, yc, Ix, Iy, Wx, Wy, halfW, h };
  }

  function sectionShapes(sectionKey, d, bg) {
    const shapes = [];
    const fill = 'rgba(39, 41, 116, 0.55)';
    const line = { color: '#272974', width: 2 };
    const path = (pts) => 'M' + pts.map(p => p.join(',')).join('L') + 'Z';
    if (sectionKey === 'i-section') {
      const { h, b, tw, tf } = d;
      const x0 = -b / 2, x1 = -tw / 2, x2 = tw / 2, x3 = b / 2;
      shapes.push({ type: 'path', path: path([[x0, h], [x3, h], [x3, h - tf], [x2, h - tf], [x2, tf], [x1, tf], [x1, h - tf], [x0, h - tf]]), fillcolor: fill, line });
    } else if (sectionKey === 'flat-bar') {
      shapes.push({ type: 'rect', x0: -d.b / 2, x1: d.b / 2, y0: 0, y1: d.t, fillcolor: fill, line });
    } else if (sectionKey === 'bulb') {
      const { h, t, r } = d;
      shapes.push({ type: 'rect', x0: -t / 2, x1: t / 2, y0: r, y1: h, fillcolor: fill, line });
      const n = 48;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const a = Math.PI + (Math.PI * i) / n;
        pts.push([r * Math.cos(a), r + r * Math.sin(a)]);
      }
      shapes.push({ type: 'path', path: path(pts), fillcolor: fill, line });
    } else if (sectionKey === 'rhs') {
      const { h, b, t } = d;
      shapes.push({ type: 'rect', x0: -b / 2, x1: b / 2, y0: 0, y1: h, fillcolor: fill, line });
      shapes.push({ type: 'rect', x0: -(b / 2 - t), x1: b / 2 - t, y0: t, y1: h - t, fillcolor: bg, line });
    } else {
      const n = 64;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const a = 2 * Math.PI * i / n;
        pts.push([(d.d / 2) * Math.cos(a), (d.d / 2) + (d.d / 2) * Math.sin(a)]);
      }
      shapes.push({ type: 'path', path: path(pts), fillcolor: fill, line });
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

  function renderPlot(sectionKey, d, res) {
    const colors = themeColors();
    const traces = [];
    const shapes = sectionShapes(sectionKey, d, colors.paper);
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
      title: SECTIONS[sectionKey].label,
      shapes,
      margin: { t: 40, r: 20, b: 45, l: 60 },
      paper_bgcolor: colors.paper,
      plot_bgcolor: colors.paper,
      font: { color: colors.font },
      xaxis: { title: 'x (m)', gridcolor: colors.grid, zeroline: true, zerolinecolor: colors.grid, scaleanchor: 'y', scaleratio: 1 },
      yaxis: { title: 'y (m)', gridcolor: colors.grid, zeroline: true, zerolinecolor: colors.grid },
      showlegend: false
    }, { responsive: true, displaylogo: false });
  }

  function renderNumbers(res) {
    els.out.area.textContent = SI.format(res.A, 'm²');
    els.out.yc.textContent = SI.format(res.yc, 'm');
    els.out.ix.textContent = SI.format(res.Ix, 'm⁴');
    els.out.iy.textContent = SI.format(res.Iy, 'm⁴');
    els.out.wx.textContent = SI.format(res.Wx, 'm³');
    els.out.wy.textContent = SI.format(res.Wy, 'm³');
  }

  function renderTable(sectionKey, d, res) {
    const num = (v) => String(Number(v.toPrecision(4)));
    const rows = [
      ['Section', SECTIONS[sectionKey].label, '—'],
      ...SECTIONS[sectionKey].dims.map(dd => [dd.label, num(d[dd.key]), 'm']),
      ['Area A', num(res.A), 'm²'],
      ['Centroid ȳ', num(res.yc), 'm'],
      ['I_x (strong)', num(res.Ix), 'm⁴'],
      ['I_y (weak)', num(res.Iy), 'm⁴'],
      ['W_x (strong)', num(res.Wx), 'm³'],
      ['W_y (weak)', num(res.Wy), 'm³']
    ];
    els.tableBody.innerHTML = rows
      .map(r => '<tr><td>' + r[0] + '</td><td class="result-value">' + r[1] + '</td><td>' + r[2] + '</td></tr>').join('');
  }

  function updateLight() {
    const key = els.select.value;
    const d = readDims();
    if (!valid(d)) { els.tableBody.innerHTML = ''; return; }
    const res = compute(key, d);
    renderNumbers(res);
    renderTable(key, d, res);
  }

  function update() {
    const key = els.select.value;
    const d = readDims();
    if (!valid(d)) {
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
