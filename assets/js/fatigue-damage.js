// Fatigue damage D estimator: one-slope S-N curve + Weibull long-term
// stress-range distribution (DNV-CG-129, July 2026 ed., App. C 2.1/2.2,
// Sec. 2.3 Table 1). Stresses in MPa (N/mm^2) as defined by the DNV S-N
// curves; lengths in m; design life in years; f0 entered in %.

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const els = {
    sliderDs0: $('slider-ds0'), numDs0: $('num-ds0'),
    sliderL: $('slider-l'), numL: $('num-l'),
    sliderF0: $('slider-f0'), numF0: $('num-f0'),
    numFat: $('num-fat'), fatPreset: $('in-fat-preset'),
    radiosM: Array.from(document.querySelectorAll('input[name="in-m"]')),
    numTd: $('num-td'), numN0: $('num-n0'), numEta: $('num-eta'),
    outD: $('out-d'), outStatus: $('out-status'), outLife: $('out-life'), outSeq: $('out-seq'),
    tableBody: $('out-table').querySelector('tbody')
  };

  // Lanczos approximation of the complete gamma function
  function gamma(z) {
    const g = 7;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 + z));
    z -= 1;
    let x = c[0];
    for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }

  // FAT X row, DNV-CG-129 Sec. 2.3 Table 1: m = 3 lower branch, m = 5 upper branch
  function logK2(m, X) {
    return m === 5 ? 7 + 5 * Math.log10(0.585 * X) : 6.301 + 3 * Math.log10(X);
  }

  function readInputs() {
    const radio = els.radiosM.find(r => r.checked);
    return {
      dS0: SI.parse(els.numDs0.value),          // MPa
      X: SI.parse(els.numFat.value),            // MPa (FAT class)
      m: radio ? Number(radio.value) : 3,       // 3 or 5
      f0: SI.parse(els.numF0.value) / 100,      // fraction (input in %)
      TD: SI.parse(els.numTd.value),            // years
      L: SI.parse(els.numL.value),              // m
      n0: SI.parse(els.numN0.value),            // cycles
      eta: SI.parse(els.numEta.value)           // -
    };
  }

  function valid(p) {
    return Number.isFinite(p.dS0) && p.dS0 > 0 &&
      Number.isFinite(p.X) && p.X > 0 &&
      (p.m === 3 || p.m === 5) &&
      Number.isFinite(p.f0) && p.f0 >= 0 && p.f0 <= 1 &&
      Number.isFinite(p.TD) && p.TD > 0 &&
      Number.isFinite(p.L) && p.L > 1 &&
      Number.isFinite(p.n0) && p.n0 > 1 &&
      Number.isFinite(p.eta) && p.eta > 0 &&
      (2.21 - 0.54 * Math.log10(p.L)) > 0;
  }

  function compute(p) {
    const v0 = 1 / (4 * Math.log10(p.L));                       // Hz
    const ND = 31.557e6 * p.TD * p.f0 * v0;                      // cycles
    const lK2 = logK2(p.m, p.X);
    const K2 = Math.pow(10, lK2);                                // (N/mm^2)^m
    const xi = 2.21 - 0.54 * Math.log10(p.L);                    // Weibull slope
    const q = p.dS0 / Math.pow(Math.log(p.n0), 1 / xi);          // MPa, Weibull scale
    const G = gamma(1 + p.m / xi);
    const D = (ND / K2) * Math.pow(q, p.m) * G;                  // damage
    const life = p.TD / D;                                       // years
    const sEq = Math.pow(D * K2 / ND, 1 / p.m);                  // MPa
    return { v0, ND, lK2, K2, xi, q, G, D, life, sEq };
  }

  function fmtVal(v) {
    if (!Number.isFinite(v)) return '—';
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a > 999 || a < 0.001) return v.toExponential(2);
    return String(Number(v.toPrecision(4)));
  }

  function renderNumbers(p, r) {
    els.outD.textContent = fmtVal(r.D);
    els.outLife.textContent = SI.format(r.life, 'years');
    els.outSeq.textContent = SI.format(r.sEq, 'MPa');
    if (r.D <= p.eta) {
      els.outStatus.textContent = 'D ≤ η — OK';
      els.outStatus.className = 'badge text-bg-success';
    } else {
      els.outStatus.textContent = 'D > η — exceeds allowable';
      els.outStatus.className = 'badge text-bg-danger';
    }
  }

  function renderTable(p, r) {
    const rows = [
      ['Largest stress range Δσ₀', SI.format(p.dS0, 'MPa'), 'MPa'],
      ['FAT class X', SI.format(p.X, 'MPa'), 'MPa'],
      ['S-N slope m', String(p.m), '—'],
      ['log K₂', fmtVal(r.lK2), '—'],
      ['K₂', fmtVal(r.K2), '(N/mm²)^m'],
      ['Fraction time at sea f₀', SI.format(p.f0, '—') + ' (' + fmtVal(p.f0 * 100) + ' %)', '—'],
      ['Design life T_D', SI.format(p.TD, 'years'), 'years'],
      ['Rule length L', SI.format(p.L, 'm'), 'm'],
      ['Zero-crossing frequency v₀', SI.format(r.v0, 'Hz'), 'Hz'],
      ['Total cycles N_D', fmtVal(r.ND), '—'],
      ['n₀', fmtVal(p.n0), '—'],
      ['Weibull slope ξ', fmtVal(r.xi), '—'],
      ['Weibull scale q', SI.format(r.q, 'MPa'), 'MPa'],
      ['Γ(1 + m/ξ)', fmtVal(r.G), '—'],
      ['Damage D', fmtVal(r.D), '—'],
      ['Allowable damage η', fmtVal(p.eta), '—'],
      ['Fatigue life T_D / D', SI.format(r.life, 'years'), 'years'],
      ['Equivalent stress range S_eq', SI.format(r.sEq, 'MPa'), 'MPa']
    ];
    els.tableBody.innerHTML = rows
      .map(rw => '<tr><td>' + rw[0] + '</td><td class="result-value">' + rw[1] + '</td><td>' + rw[2] + '</td></tr>')
      .join('');
  }

  function clearOutputs() {
    els.outD.textContent = '—';
    els.outLife.textContent = '—';
    els.outSeq.textContent = '—';
    els.outStatus.textContent = '—';
    els.outStatus.className = 'badge';
    els.tableBody.innerHTML = '';
  }

  // Single update path: every input change re-renders all outputs live
  function update() {
    const p = readInputs();
    if (!valid(p)) { clearOutputs(); return; }
    const r = compute(p);
    renderNumbers(p, r);
    renderTable(p, r);
  }

  function wireSliderNum(slider, num, min, max) {
    slider.addEventListener('input', () => { num.value = slider.value; update(); });
    num.addEventListener('input', () => {
      const v = SI.parse(num.value);
      if (Number.isFinite(v)) slider.value = Math.min(Math.max(v, min), max);
      update();
    });
  }

  wireSliderNum(els.sliderDs0, els.numDs0, 1, 500);
  wireSliderNum(els.sliderL, els.numL, 10, 600);
  wireSliderNum(els.sliderF0, els.numF0, 0, 100);

  [els.numFat, els.numTd, els.numN0, els.numEta].forEach(el => el.addEventListener('input', update));

  els.fatPreset.addEventListener('change', () => {
    if (els.fatPreset.value !== 'custom') {
      els.numFat.value = els.fatPreset.value;
    }
    update();
  });

  els.radiosM.forEach(r => r.addEventListener('change', update));

  update();
})();
