// Graph Digitizer: digitize scanned/printed graphs. Upload an image, click the
// 4 plot-frame corners, enter the corner values, then click any point to read
// its (x, y). Pixel->data mapping is a projective transform (homography) fitted
// through the 4 corner points; log axes are handled in log10 space. Fully
// offline: the image is read with FileReader and never leaves the machine.

(function () {
  'use strict';

  // ---------- pure math helpers (exported for offline unit tests) ----------

  // Gaussian elimination with partial pivoting; A is n x n, b is n. Returns x or null.
  function solveLinearSystem(A, b) {
    const n = A.length;
    const M = A.map((row, i) => row.concat([b[i]]));
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      }
      if (Math.abs(M[piv][col]) < 1e-12) return null;
      if (piv !== col) { const t = M[piv]; M[piv] = M[col]; M[col] = t; }
      for (let r = col + 1; r < n; r++) {
        const f = M[r][col] / M[col][col];
        for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
      }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) {
      let s = M[r][n];
      for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c];
      x[r] = s / M[r][r];
    }
    return x;
  }

  // Homography as flat [h11..h32, 1] mapping pixel (u,v) -> data (x,y),
  // fitted from exactly 4 pixel->data correspondences. Returns null if degenerate.
  function computeHomography(pixels, dataPoints) {
    const A = [];
    const b = [];
    for (let i = 0; i < 4; i++) {
      const u = pixels[i][0];
      const v = pixels[i][1];
      const x = dataPoints[i][0];
      const y = dataPoints[i][1];
      A.push([u, v, 1, 0, 0, 0, -x * u, -x * v]);
      b.push(x);
      A.push([0, 0, 0, u, v, 1, -y * u, -y * v]);
      b.push(y);
    }
    const h = solveLinearSystem(A, b);
    if (!h) return null;
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  }

  // Apply flat homography H to point (u, v) -> [x, y].
  function applyHomography(H, u, v) {
    const w = H[6] * u + H[7] * v + H[8];
    return [(H[0] * u + H[1] * v + H[2]) / w, (H[3] * u + H[4] * v + H[5]) / w];
  }

  // Inverse of a flat 3x3 homography (adjugate / determinant). Returns null if singular.
  function invertHomography(H) {
    const a = H[0], b = H[1], c = H[2];
    const d = H[3], e = H[4], f = H[5];
    const g = H[6], h = H[7], i = H[8];
    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    if (Math.abs(det) < 1e-15) return null;
    return [
      (e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det,
      (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det,
      (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det
    ];
  }

  // "Nice" 1-2-5 ticks covering [min, max] (~target ticks).
  function niceTicks(min, max, target = 8) {
    if (!(min < max)) return [];
    const raw = (max - min) / target;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    let step;
    if (norm < 1.5) step = 1;
    else if (norm < 3) step = 2;
    else if (norm < 7) step = 5;
    else step = 10;
    step *= mag;
    const ticks = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(v);
    return ticks;
  }

  // Log ticks: decades as major, 2..9 multiples as minor. min/max must be > 0.
  function logTicks(min, max) {
    const ticks = [];
    const k0 = Math.floor(Math.log10(min));
    const k1 = Math.ceil(Math.log10(max));
    for (let k = k0; k <= k1; k++) {
      const base = Math.pow(10, k);
      if (base >= min * (1 - 1e-12) && base <= max * (1 + 1e-12)) ticks.push({ value: base, major: true });
      for (let m = 2; m <= 9; m++) {
        const v = m * base;
        if (v > min && v < max) ticks.push({ value: v, major: false });
      }
    }
    return ticks;
  }

  // Data-space coordinates of the 4 calibration corners (order BL, BR, TR, TL),
  // transformed to log10 space when the axis is logarithmic. Validates the values.
  function cornerData(cal, logX, logY) {
    const xL = cal.xL, xR = cal.xR, yB = cal.yB, yT = cal.yT;
    if (![xL, xR, yB, yT].every(Number.isFinite)) {
      return { corners: null, error: 'Enter all four corner values as numbers.' };
    }
    if (logX && (xL <= 0 || xR <= 0)) return { corners: null, error: 'Logarithmic x-axis needs both x corner values > 0.' };
    if (logY && (yB <= 0 || yT <= 0)) return { corners: null, error: 'Logarithmic y-axis needs both y corner values > 0.' };
    if (xL >= xR) return { corners: null, error: 'x at left must be smaller than x at right.' };
    if (yB >= yT) return { corners: null, error: 'y at bottom must be smaller than y at top.' };
    const tx = logX ? Math.log10 : (v) => v;
    const ty = logY ? Math.log10 : (v) => v;
    return {
      corners: [[tx(xL), ty(yB)], [tx(xR), ty(yB)], [tx(xR), ty(yT)], [tx(xL), ty(yT)]],
      error: null
    };
  }

  // SI readout formatting: |v| > 999 -> scientific notation with two decimals
  // and no "+" in the exponent (94866 -> "9.49e4 m", 24545000 -> "2.45e7").
  function formatSiValue(v, unit) {
    const u = unit && unit !== '-' ? unit : '';
    if (Number.isFinite(v) && Math.abs(v) > 999) {
      return v.toExponential(2).replace('e+', 'e') + (u ? ' ' + u : '');
    }
    if (typeof SI !== 'undefined') return SI.format(v, u).trim();
    if (!Number.isFinite(v)) return '—';
    return (String(Number(v.toPrecision(4))) + (u ? ' ' + u : '')).trim();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { solveLinearSystem, computeHomography, applyHomography, invertHomography, niceTicks, logTicks, cornerData, formatSiValue };
    return;
  }

  // ---------- DOM wiring (browser only) ----------

  const $ = (id) => document.getElementById(id);

  const els = {
    btnUpload: $('btn-upload'),
    inImage: $('in-image'),
    imageStatus: $('image-status'),
    errorMsg: $('error-msg'),
    xTitle: $('in-x-title'),
    xUnit: $('in-x-unit'),
    yTitle: $('in-y-title'),
    yUnit: $('in-y-unit'),
    logX: $('in-log-x'),
    logY: $('in-log-y'),
    calXL: $('in-cal-x-left'),
    calXR: $('in-cal-x-right'),
    calYB: $('in-cal-y-bottom'),
    calYT: $('in-cal-y-top'),
    calibStatus: $('calib-status'),
    calibError: $('calib-error'),
    btnUndoCal: $('btn-undo-cal'),
    btnClearCal: $('btn-clear-cal'),
    seriesName: $('in-series-name'),
    seriesColor: $('in-series-color'),
    seriesSelect: $('in-series-select'),
    btnAddSeries: $('btn-add-series'),
    btnRemoveSeries: $('btn-remove-series'),
    showGrid: $('in-show-grid'),
    showCrosshair: $('in-show-crosshair'),
    btnZoomIn: $('btn-zoom-in'),
    btnZoomOut: $('btn-zoom-out'),
    btnZoomFit: $('btn-zoom-fit'),
    wrap: $('graph-wrap'),
    imgCanvas: $('graph-image'),
    overlay: $('graph-overlay'),
    graphInstruction: $('graph-instruction'),
    outCursorX: $('out-cursor-x'),
    outCursorY: $('out-cursor-y'),
    outLastX: $('out-last-x'),
    outLastY: $('out-last-y'),
    outResidual: $('out-residual'),
    pointsTableBody: $('points-table').querySelector('tbody'),
    pointsEmpty: $('points-empty'),
    pointsCount: $('points-count'),
    btnUndoPoint: $('btn-undo-point'),
    btnClearPoints: $('btn-clear-points'),
    plot: $('out-plot'),
    btnCsv: $('btn-csv'),
    btnPng: $('btn-png')
  };

  const PALETTE = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#469990', '#9a6324'];
  const CAL_LABELS = ['bottom-left', 'bottom-right', 'top-right', 'top-left'];
  const MAX_TABLE_ROWS = 500;

  const state = {
    img: null,
    view: { scale: 1, tx: 0, ty: 0 },
    fitScale: 1,
    cssW: 600,
    cssH: 320,
    calPoints: [],   // [{u, v}] in image px, order BL, BR, TR, TL
    H: null,         // pixel -> data, flat 9
    Hinv: null,      // data -> pixel, flat 9
    residual: null,
    calError: null,
    series: [{ name: 'Curve 1', color: PALETTE[0], points: [] }],
    active: 0,
    cursor: null,    // {u, v} image px under the mouse
    lastPoint: null  // {x, y}
  };

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dpr = () => window.devicePixelRatio || 1;
  const unitOf = (u) => (u && u !== '-' ? u : '');
  const axisTitle = (t, u) => (unitOf(u) ? t + ' (' + unitOf(u) + ')' : t);
  const fmtVal = (v, u) => formatSiValue(v, u);

  function themeColors() {
    const dark = document.documentElement.dataset.bsTheme === 'dark';
    return {
      grid: dark ? 'rgba(199,200,240,0.30)' : 'rgba(39,41,116,0.16)',
      gridMajor: dark ? 'rgba(199,200,240,0.55)' : 'rgba(39,41,116,0.32)',
      font: dark ? '#f1f2fa' : '#1f2340',
      frame: dark ? '#c7c8f0' : '#272974',
      paper: dark ? '#16173a' : '#ffffff',
      marker: '#ffc107'
    };
  }

  function fmtTick(v) {
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e6 || a < 1e-3) return v.toExponential(1);
    return String(Number(v.toPrecision(4)));
  }

  // ---------- calibration ----------

  function readCal() {
    return {
      xL: SI.parse(els.calXL.value),
      xR: SI.parse(els.calXR.value),
      yB: SI.parse(els.calYB.value),
      yT: SI.parse(els.calYT.value)
    };
  }

  function calibrated() { return !!state.H; }

  function recomputeCalibration() {
    state.calError = null;
    state.H = null;
    state.Hinv = null;
    state.residual = null;
    const cd = cornerData(readCal(), els.logX.checked, els.logY.checked);
    if (cd.error) {
      state.calError = cd.error;
      updateCalibUi();
      return;
    }
    if (state.calPoints.length === 4) {
      const pixels = state.calPoints.map((p) => [p.u, p.v]);
      const H = computeHomography(pixels, cd.corners);
      const Hinv = H ? invertHomography(H) : null;
      if (!H || !Hinv) {
        state.calError = 'The 4 clicked points are degenerate (e.g. collinear) — pick the 4 distinct frame corners.';
      } else {
        state.H = H;
        state.Hinv = Hinv;
        let res = 0;
        for (let i = 0; i < 4; i++) {
          const d = applyHomography(H, pixels[i][0], pixels[i][1]);
          const p2 = applyHomography(Hinv, d[0], d[1]);
          res = Math.max(res, Math.hypot(p2[0] - pixels[i][0], p2[1] - pixels[i][1]));
        }
        state.residual = res;
      }
    }
    updateCalibUi();
  }

  function updateCalibUi() {
    const n = state.calPoints.length;
    let status;
    let instruction;
    if (!state.img) {
      status = 'Upload an image first.';
      instruction = 'Upload an image to start.';
    } else if (n < 4) {
      status = 'Click corner ' + (n + 1) + '/4 (' + CAL_LABELS[n] + ') of the plot frame on the graph. Drag a marker to adjust it.';
      instruction = 'Calibration: click corner ' + (n + 1) + ' of 4 — ' + CAL_LABELS[n] + ' of the plot frame';
    } else if (state.calError) {
      status = '4 points placed, but the calibration is invalid — see the message below.';
      instruction = '4 corner points placed — fix the axis values in the left input column (see the message there).';
    } else {
      status = '4 points placed — make sure the axis values on the left are set correctly. Calibrated (residual ' + state.residual.toFixed(2) + ' px); click on the graph to digitize points.';
      instruction = '4 corner points placed — make sure the axis values in the left input column are set correctly (x left/right, y bottom/top). Click on the graph to digitize.';
    }
    els.calibStatus.textContent = status;
    els.graphInstruction.textContent = instruction;
    if (state.calError) {
      els.calibError.textContent = state.calError;
      els.calibError.classList.remove('d-none');
    } else {
      els.calibError.classList.add('d-none');
    }
    els.btnUndoCal.disabled = n === 0;
    els.btnClearCal.disabled = n === 0;
    els.outResidual.textContent = state.residual != null ? state.residual.toFixed(2) + ' px' : '—';
  }

  function pixelToData(u, v) {
    const d = applyHomography(state.H, u, v);
    return {
      x: els.logX.checked ? Math.pow(10, d[0]) : d[0],
      y: els.logY.checked ? Math.pow(10, d[1]) : d[1]
    };
  }

  function dataToPixel(x, y) {
    const xl = els.logX.checked ? Math.log10(x) : x;
    const yl = els.logY.checked ? Math.log10(y) : y;
    return applyHomography(state.Hinv, xl, yl);
  }

  // ---------- canvas layout & drawing ----------

  function layoutCanvases() {
    const w = els.wrap.clientWidth || 600;
    let h = 320;
    if (state.img) h = clamp(Math.round((w * state.img.height) / state.img.width), 200, 720);
    state.cssW = w;
    state.cssH = h;
    els.wrap.style.height = h + 'px';
    const k = dpr();
    for (const c of [els.imgCanvas, els.overlay]) {
      c.width = Math.max(1, Math.round(w * k));
      c.height = Math.max(1, Math.round(h * k));
    }
  }

  function fitView() {
    if (!state.img) return;
    const s = Math.min(state.cssW / state.img.width, state.cssH / state.img.height);
    state.fitScale = s;
    state.view = { scale: s, tx: (state.cssW - state.img.width * s) / 2, ty: (state.cssH - state.img.height * s) / 2 };
  }

  const cssFromImage = (u, v) => ({ x: u * state.view.scale + state.view.tx, y: v * state.view.scale + state.view.ty });

  function draw() {
    const colors = themeColors();
    let ctx = els.imgCanvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = colors.paper;
    ctx.fillRect(0, 0, els.imgCanvas.width, els.imgCanvas.height);
    if (state.img) {
      const v = state.view;
      ctx.setTransform(dpr() * v.scale, 0, 0, dpr() * v.scale, dpr() * v.tx, dpr() * v.ty);
      ctx.drawImage(state.img, 0, 0);
    }
    ctx = els.overlay.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, els.overlay.width, els.overlay.height);
    if (state.img) drawOverlay(ctx, dpr(), state.view, { crosshair: true, colors });
  }

  // Draws the digital overlay in image-pixel coordinates; the ctx transform must
  // map image px -> target px via (k*view.scale, k*view.tx, ...).
  function drawOverlay(ctx, k, view, opts) {
    ctx.setTransform(k * view.scale, 0, 0, k * view.scale, k * view.tx, k * view.ty);
    const colors = opts.colors;
    const lw = 1 / view.scale;
    const fs = 12 / view.scale;

    if (calibrated() && els.showGrid.checked) drawGrid(ctx, view, colors, lw, fs);

    if (state.calPoints.length >= 2) {
      ctx.strokeStyle = colors.frame;
      ctx.lineWidth = 2 * lw;
      ctx.beginPath();
      ctx.moveTo(state.calPoints[0].u, state.calPoints[0].v);
      for (let i = 1; i < state.calPoints.length; i++) ctx.lineTo(state.calPoints[i].u, state.calPoints[i].v);
      if (state.calPoints.length === 4) ctx.closePath();
      ctx.stroke();
    }

    state.calPoints.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.u, p.v, 7 / view.scale, 0, 2 * Math.PI);
      ctx.fillStyle = colors.marker;
      ctx.fill();
      ctx.lineWidth = lw;
      ctx.strokeStyle = '#000000';
      ctx.stroke();
      ctx.fillStyle = '#000000';
      ctx.font = 'bold ' + 11 / view.scale + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), p.u, p.v);
    });

    state.series.forEach((s) => {
      if (!calibrated()) return;
      s.points.forEach((p, i) => {
        const q = dataToPixel(p.x, p.y);
        ctx.beginPath();
        ctx.arc(q[0], q[1], 4 / view.scale, 0, 2 * Math.PI);
        ctx.fillStyle = s.color;
        ctx.fill();
        ctx.lineWidth = lw;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.fillStyle = colors.font;
        ctx.font = 10 / view.scale + 'px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(i + 1), q[0] + 6 / view.scale, q[1] - 4 / view.scale);
      });
    });

    if (opts.crosshair && state.cursor && els.showCrosshair.checked) {
      const c = state.cursor;
      ctx.strokeStyle = colors.font;
      ctx.lineWidth = lw;
      ctx.setLineDash([6 / view.scale, 4 / view.scale]);
      ctx.beginPath();
      ctx.moveTo(c.u, 0);
      ctx.lineTo(c.u, state.img.height);
      ctx.moveTo(0, c.v);
      ctx.lineTo(state.img.width, c.v);
      ctx.stroke();
      ctx.setLineDash([]);
      if (calibrated()) {
        const d = pixelToData(c.u, c.v);
        const label = fmtVal(d.x, els.xUnit.value) + ' , ' + fmtVal(d.y, els.yUnit.value);
        ctx.font = 12 / view.scale + 'px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        const wpx = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(128,128,128,0.75)';
        ctx.fillRect(c.u + 8 / view.scale, c.v - 20 / view.scale, wpx + 8 / view.scale, 18 / view.scale);
        ctx.fillStyle = colors.font;
        ctx.fillText(label, c.u + 12 / view.scale, c.v - 6 / view.scale);
      }
    }
  }

  function drawGrid(ctx, view, colors, lw, fs) {
    const cal = readCal();
    const logX = els.logX.checked;
    const logY = els.logY.checked;
    const xTicks = logX ? logTicks(cal.xL, cal.xR) : niceTicks(cal.xL, cal.xR).map((v) => ({ value: v, major: true }));
    const yTicks = logY ? logTicks(cal.yB, cal.yT) : niceTicks(cal.yB, cal.yT).map((v) => ({ value: v, major: true }));
    ctx.font = fs + 'px sans-serif';
    for (const t of xTicks) {
      const p1 = dataToPixel(t.value, cal.yB);
      const p2 = dataToPixel(t.value, cal.yT);
      ctx.strokeStyle = t.major === false ? colors.grid : colors.gridMajor;
      ctx.lineWidth = (t.major === false ? 0.75 : 1.25) * lw;
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.stroke();
      if (t.major !== false) {
        ctx.fillStyle = colors.font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(fmtTick(t.value), p1[0], p1[1] + 4 / view.scale);
      }
    }
    for (const t of yTicks) {
      const p1 = dataToPixel(cal.xL, t.value);
      const p2 = dataToPixel(cal.xR, t.value);
      ctx.strokeStyle = t.major === false ? colors.grid : colors.gridMajor;
      ctx.lineWidth = (t.major === false ? 0.75 : 1.25) * lw;
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.stroke();
      if (t.major !== false) {
        ctx.fillStyle = colors.font;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(fmtTick(t.value), p1[0] - 4 / view.scale, p1[1]);
      }
    }
    const bx = dataToPixel((cal.xL + cal.xR) / 2, cal.yB);
    ctx.fillStyle = colors.font;
    ctx.font = 'bold ' + fs + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(axisTitle(els.xTitle.value.trim() || 'x', els.xUnit.value), bx[0], bx[1] + 18 / view.scale);
    const ly = dataToPixel(cal.xL, (cal.yB + cal.yT) / 2);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(axisTitle(els.yTitle.value.trim() || 'y', els.yUnit.value), ly[0] - 6 / view.scale, ly[1]);
  }

  // ---------- mouse interaction: click = point/corner, drag = pan, wheel = zoom ----------

  function eventCss(e) {
    const r = els.overlay.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  const imageFromCss = (c) => ({ u: (c.x - state.view.tx) / state.view.scale, v: (c.y - state.view.ty) / state.view.scale });

  let dragMarker = -1;
  let downCss = null;
  let panning = false;
  let lastCss = null;

  els.overlay.addEventListener('mousedown', (e) => {
    if (!state.img) return;
    const c = eventCss(e);
    for (let i = state.calPoints.length - 1; i >= 0; i--) {
      const s = cssFromImage(state.calPoints[i].u, state.calPoints[i].v);
      if (Math.hypot(c.x - s.x, c.y - s.y) <= 10) { dragMarker = i; return; }
    }
    downCss = c;
    lastCss = c;
    panning = false;
  });

  els.overlay.addEventListener('mousemove', (e) => {
    if (!state.img) return;
    const c = eventCss(e);
    state.cursor = imageFromCss(c);
    if (dragMarker >= 0) {
      const im = imageFromCss(c);
      state.calPoints[dragMarker] = { u: clamp(im.u, 0, state.img.width), v: clamp(im.v, 0, state.img.height) };
      recomputeCalibration();
    } else if (downCss) {
      if (!panning && Math.hypot(c.x - downCss.x, c.y - downCss.y) > 4) panning = true;
      if (panning) {
        state.view.tx += c.x - lastCss.x;
        state.view.ty += c.y - lastCss.y;
      }
      lastCss = c;
    }
    updateCursorReadout();
    draw();
  });

  els.overlay.addEventListener('mouseup', (e) => {
    if (!state.img) return;
    if (dragMarker >= 0) { dragMarker = -1; draw(); return; }
    if (downCss && !panning) handleClick(imageFromCss(eventCss(e)));
    downCss = null;
    panning = false;
  });

  els.overlay.addEventListener('mouseleave', () => {
    state.cursor = null;
    updateCursorReadout();
    draw();
  });

  els.overlay.addEventListener('wheel', (e) => {
    if (!state.img) return;
    e.preventDefault();
    const c = eventCss(e);
    const im = imageFromCss(c);
    const s = clamp(state.view.scale * (e.deltaY < 0 ? 1.25 : 0.8), state.fitScale * 0.5, 60);
    state.view.scale = s;
    state.view.tx = c.x - im.u * s;
    state.view.ty = c.y - im.v * s;
    draw();
  }, { passive: false });

  function handleClick(im) {
    const u = clamp(im.u, 0, state.img.width);
    const v = clamp(im.v, 0, state.img.height);
    if (state.calPoints.length < 4) {
      state.calPoints.push({ u, v });
      recomputeCalibration();
      draw();
      return;
    }
    if (!calibrated()) {
      state.calError = 'Calibration is not valid yet — check the 4 corner points and the corner values.';
      updateCalibUi();
      return;
    }
    const d = pixelToData(u, v);
    state.series[state.active].points.push({ x: d.x, y: d.y });
    state.lastPoint = d;
    refreshPointsUi();
    updateReadouts();
    draw();
    renderPlot();
  }

  function zoomAt(factor) {
    if (!state.img) return;
    const c = { x: state.cssW / 2, y: state.cssH / 2 };
    const im = imageFromCss(c);
    const s = clamp(state.view.scale * factor, state.fitScale * 0.5, 60);
    state.view.scale = s;
    state.view.tx = c.x - im.u * s;
    state.view.ty = c.y - im.v * s;
    draw();
  }

  els.btnZoomIn.addEventListener('click', () => zoomAt(1.5));
  els.btnZoomOut.addEventListener('click', () => zoomAt(1 / 1.5));
  els.btnZoomFit.addEventListener('click', () => { fitView(); draw(); });

  window.addEventListener('resize', () => { layoutCanvases(); draw(); });

  // ---------- image upload (local only) ----------

  function showError(msg) {
    els.errorMsg.textContent = msg;
    els.errorMsg.classList.remove('d-none');
  }
  function clearError() { els.errorMsg.classList.add('d-none'); }

  function loadFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showError('"' + file.name + '" is not an image file.');
      return;
    }
    clearError();
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        state.img = img;
        state.calPoints = [];
        state.H = null;
        state.Hinv = null;
        state.residual = null;
        state.calError = null;
        state.cursor = null;
        state.lastPoint = null;
        state.series.forEach((s) => { s.points = []; });
        layoutCanvases();
        fitView();
        recomputeCalibration();
        refreshPointsUi();
        updateReadouts();
        refreshUi();
        els.imageStatus.textContent = file.name + ' — ' + img.width + ' × ' + img.height + ' px';
        draw();
        renderPlot();
      };
      img.onerror = () => showError('Could not decode "' + file.name + '" as an image.');
      img.src = String(reader.result);
    };
    reader.onerror = () => showError('Could not read "' + file.name + '".');
    reader.readAsDataURL(file);
  }

  els.btnUpload.addEventListener('click', () => els.inImage.click());
  els.inImage.addEventListener('change', () => {
    loadFile(els.inImage.files && els.inImage.files[0]);
    els.inImage.value = '';
  });
  els.wrap.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.wrap.style.outline = '2px dashed var(--brand)';
  });
  els.wrap.addEventListener('dragleave', () => { els.wrap.style.outline = ''; });
  els.wrap.addEventListener('drop', (e) => {
    e.preventDefault();
    els.wrap.style.outline = '';
    loadFile(e.dataTransfer.files && e.dataTransfer.files[0]);
  });

  // ---------- input wiring ----------

  ['in-cal-x-left', 'in-cal-x-right', 'in-cal-y-bottom', 'in-cal-y-top'].forEach((id) => {
    $(id).addEventListener('input', () => { recomputeCalibration(); draw(); renderPlot(); });
  });
  els.logX.addEventListener('change', () => { recomputeCalibration(); draw(); renderPlot(); });
  els.logY.addEventListener('change', () => { recomputeCalibration(); draw(); renderPlot(); });
  [els.xTitle, els.xUnit, els.yTitle, els.yUnit].forEach((el) => {
    el.addEventListener('input', () => { updateReadouts(); refreshPointsUi(); draw(); renderPlot(); });
  });
  els.showGrid.addEventListener('change', draw);
  els.showCrosshair.addEventListener('change', () => { updateCursorReadout(); draw(); });
  els.btnUndoCal.addEventListener('click', () => { state.calPoints.pop(); recomputeCalibration(); draw(); });
  els.btnClearCal.addEventListener('click', () => { state.calPoints = []; recomputeCalibration(); draw(); });

  // ---------- series ----------

  function renderSeriesSelect() {
    els.seriesSelect.innerHTML = state.series
      .map((s, i) => '<option value="' + i + '">' + escapeHtml(s.name) + '</option>')
      .join('');
    els.seriesSelect.value = String(state.active);
    els.seriesName.value = state.series[state.active].name;
    els.seriesColor.value = state.series[state.active].color;
    els.btnRemoveSeries.disabled = state.series.length <= 1;
  }

  els.btnAddSeries.addEventListener('click', () => {
    const n = state.series.length;
    state.series.push({ name: 'Curve ' + (n + 1), color: PALETTE[n % PALETTE.length], points: [] });
    state.active = n;
    renderSeriesSelect();
    refreshPointsUi();
    renderPlot();
  });
  els.btnRemoveSeries.addEventListener('click', () => {
    if (state.series.length <= 1) return;
    state.series.splice(state.active, 1);
    state.active = Math.min(state.active, state.series.length - 1);
    renderSeriesSelect();
    refreshPointsUi();
    draw();
    renderPlot();
  });
  els.seriesSelect.addEventListener('change', () => {
    state.active = parseInt(els.seriesSelect.value, 10) || 0;
    renderSeriesSelect();
    refreshPointsUi();
  });
  els.seriesName.addEventListener('input', () => {
    state.series[state.active].name = els.seriesName.value;
    const opt = els.seriesSelect.options[state.active];
    if (opt) opt.textContent = els.seriesName.value.trim() || ('Curve ' + (state.active + 1));
    refreshPointsUi();
    renderPlot();
  });
  els.seriesName.addEventListener('change', () => {
    state.series[state.active].name = els.seriesName.value.trim() || ('Curve ' + (state.active + 1));
    renderSeriesSelect();
    refreshPointsUi();
    renderPlot();
  });
  els.seriesColor.addEventListener('input', () => {
    state.series[state.active].color = els.seriesColor.value;
    draw();
    renderPlot();
  });

  // ---------- points table, readouts, exports ----------

  function totalPoints() {
    return state.series.reduce((s, x) => s + x.points.length, 0);
  }

  function refreshPointsUi() {
    const rows = [];
    let count = 0;
    state.series.forEach((s) => {
      s.points.forEach((p, i) => {
        count++;
        if (count <= MAX_TABLE_ROWS) {
          rows.push(
            '<tr><td><span style="display:inline-block;width:0.7em;height:0.7em;border-radius:50%;background:' + s.color + ';"></span> ' +
            escapeHtml(s.name) + '</td><td>' + (i + 1) + '</td><td class="result-value">' +
            escapeHtml(fmtVal(p.x, els.xUnit.value)) + '</td><td class="result-value">' +
            escapeHtml(fmtVal(p.y, els.yUnit.value)) + '</td></tr>'
          );
        }
      });
    });
    els.pointsTableBody.innerHTML = rows.join('');
    els.pointsEmpty.hidden = count > 0;
    els.pointsCount.textContent = count + (count === 1 ? ' point' : ' points');
    els.btnUndoPoint.disabled = state.series[state.active].points.length === 0;
    els.btnClearPoints.disabled = count === 0;
    els.btnCsv.disabled = count === 0;
  }

  els.btnUndoPoint.addEventListener('click', () => {
    const s = state.series[state.active];
    const p = s.points.pop();
    if (p && state.lastPoint && state.lastPoint.x === p.x && state.lastPoint.y === p.y) state.lastPoint = null;
    refreshPointsUi();
    updateReadouts();
    draw();
    renderPlot();
  });
  els.btnClearPoints.addEventListener('click', () => {
    state.series.forEach((s) => { s.points = []; });
    state.lastPoint = null;
    refreshPointsUi();
    updateReadouts();
    draw();
    renderPlot();
  });

  function updateCursorReadout() {
    if (state.cursor && state.img) {
      if (calibrated()) {
        const d = pixelToData(state.cursor.u, state.cursor.v);
        els.outCursorX.textContent = fmtVal(d.x, els.xUnit.value);
        els.outCursorY.textContent = fmtVal(d.y, els.yUnit.value);
      } else {
        els.outCursorX.textContent = state.cursor.u.toFixed(1) + ' px';
        els.outCursorY.textContent = state.cursor.v.toFixed(1) + ' px';
      }
    } else {
      els.outCursorX.textContent = '—';
      els.outCursorY.textContent = '—';
    }
  }

  function updateReadouts() {
    updateCursorReadout();
    if (state.lastPoint) {
      els.outLastX.textContent = fmtVal(state.lastPoint.x, els.xUnit.value);
      els.outLastY.textContent = fmtVal(state.lastPoint.y, els.yUnit.value);
    } else {
      els.outLastX.textContent = '—';
      els.outLastY.textContent = '—';
    }
    els.outResidual.textContent = state.residual != null ? state.residual.toFixed(2) + ' px' : '—';
  }

  function refreshUi() {
    const hasImg = !!state.img;
    els.btnZoomIn.disabled = !hasImg;
    els.btnZoomOut.disabled = !hasImg;
    els.btnZoomFit.disabled = !hasImg;
    els.btnPng.disabled = !hasImg;
  }

  function csvCell(s) {
    s = String(s);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  els.btnCsv.addEventListener('click', () => {
    const xu = unitOf(els.xUnit.value);
    const yu = unitOf(els.yUnit.value);
    const lines = ['series,index,x' + (xu ? ' [' + xu + ']' : '') + ',y' + (yu ? ' [' + yu + ']' : '')];
    state.series.forEach((s) => {
      s.points.forEach((p, i) => {
        lines.push([csvCell(s.name), i + 1, p.x, p.y].join(','));
      });
    });
    downloadBlob(new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }), 'digitized-points.csv');
  });

  els.btnPng.addEventListener('click', () => {
    if (!state.img) return;
    const s = 2;
    const c = document.createElement('canvas');
    c.width = Math.round(state.img.width * s);
    c.height = Math.round(state.img.height * s);
    const ctx = c.getContext('2d');
    ctx.drawImage(state.img, 0, 0, c.width, c.height);
    drawOverlay(ctx, s, { scale: 1, tx: 0, ty: 0 }, { crosshair: false, colors: themeColors() });
    c.toBlob((blob) => { if (blob) downloadBlob(blob, 'digitized-graph.png'); }, 'image/png');
  });

  // ---------- Plotly re-plot of the digitized points ----------

  const plotConfig = { responsive: true, displaylogo: false };

  function renderPlot() {
    if (typeof Plotly === 'undefined') return;
    const colors = themeColors();
    const traces = state.series
      .filter((s) => s.points.length > 0)
      .map((s) => ({
        x: s.points.map((p) => p.x),
        y: s.points.map((p) => p.y),
        mode: 'markers',
        name: s.name,
        marker: { size: 8, color: s.color }
      }));
    Plotly.react(els.plot, traces, {
      title: 'Digitized points',
      margin: { t: 40, r: 20, b: 45, l: 70 },
      paper_bgcolor: colors.paper,
      plot_bgcolor: colors.paper,
      font: { color: colors.font },
      xaxis: { title: axisTitle(els.xTitle.value.trim() || 'x', els.xUnit.value), type: els.logX.checked ? 'log' : 'linear', gridcolor: colors.grid, zeroline: false },
      yaxis: { title: axisTitle(els.yTitle.value.trim() || 'y', els.yUnit.value), type: els.logY.checked ? 'log' : 'linear', gridcolor: colors.grid, zeroline: false }
    }, plotConfig);
  }

  new MutationObserver(() => { draw(); renderPlot(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });

  // ---------- init ----------

  renderSeriesSelect();
  layoutCanvases();
  recomputeCalibration();
  refreshPointsUi();
  updateReadouts();
  refreshUi();
  draw();
  renderPlot();
})();
