// Fatigue damage D estimator with a Weibull long-term stress-range
// distribution (DNV-CG-0129, App. C): one-slope S-N curve (App. C 2.2) or
// two-slope S-N curve (App. C 2.3); S-N parameters from Sec. 3 Table 1
// (in-air, also valid for seawater with cathodic protection per Sec. 3.1).
// Stresses in MPa (N/mm^2) as defined by the DNV S-N curves; lengths in m;
// design life in years; f0 entered in %; m fixed at 3 for one-slope.

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // Sec. 3 Table 1, S-N parameters for air, keyed by FAT value (MPa)
  const SN_CLASSES = {
    160: { name: 'B1', Nt: 5e6, dsQ: 127.24, logK2: 15.118, m: 4,   logK3: 19.327, m2: 6   },
    150: { name: 'B',  Nt: 5e6, dsQ: 119.29, logK2: 15.005, m: 4,   logK3: 19.159, m2: 6   },
    140: { name: 'B2', Nt: 5e6, dsQ: 111.34, logK2: 14.886, m: 4,   logK3: 18.979, m2: 6   },
    125: { name: 'C',  Nt: 5e6, dsQ: 96.21,  logK2: 13.640, m: 3.5, logK3: 17.607, m2: 5.5 },
    112: { name: 'C1', Nt: 5e6, dsQ: 86.20,  logK2: 13.473, m: 3.5, logK3: 17.344, m2: 5.5 },
    100: { name: 'C2', Nt: 5e6, dsQ: 76.97,  logK2: 13.301, m: 3.5, logK3: 17.074, m2: 5.5 },
    90:  { name: 'D',  Nt: 1e7, dsQ: 52.63,  logK2: 12.164, m: 3,   logK3: 15.606, m2: 5   },
    80:  { name: 'E',  Nt: 1e7, dsQ: 46.78,  logK2: 12.010, m: 3,   logK3: 15.350, m2: 5   },
    71:  { name: 'F',  Nt: 1e7, dsQ: 41.52,  logK2: 11.855, m: 3,   logK3: 15.091, m2: 5   }
  };

  // FAT X row of Sec. 3 Table 1 for a custom FAT class X (MPa)
  function fatXParams(X) {
    return {
      name: 'FAT ' + X, Nt: 1e7, dsQ: 0.585 * X,
      logK2: 6.301 + 3 * Math.log10(X), m: 3,
      logK3: 7 + 5 * Math.log10(0.585 * X), m2: 5
    };
  }

  const els = {
    method: $('in-method'),
    sliderDs0: $('slider-ds0'), numDs0: $('num-ds0'),
    sliderL: $('slider-l'), numL: $('num-l'),
    sliderF0: $('slider-f0'), numF0: $('num-f0'),
    numFat: $('num-fat'), fatPreset: $('in-fat-preset'), numM: $('num-m'), numM2: $('num-m2'), m2Row: $('m2-row'),
    numTd: $('num-td'), numN0: $('num-n0'), numEta: $('num-eta'),
    outD: $('out-d'), outStatus: $('out-status'), outLife: $('out-life'), outSeq: $('out-seq'),
    tableBody: $('out-table').querySelector('tbody')
  };

  // Lanczos log-gamma + Numerical Recipes series / continued fraction for the
  // lower and upper incomplete gamma functions
  function gammln(z) {
    const g = 7;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammln(1 + z));
    z -= 1;
    let x = c[0];
    for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
  const FPMIN = 1e-300;
  const EPS = 1e-15;
  function gser(s, x) {
    let ap = s, sum = 1 / s, del = sum;
    for (let n = 1; n <= 500; n++) {
      ap++;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * EPS) break;
    }
    return sum * Math.exp(-x + s * Math.log(x) - gammln(s));
  }
  function gcf(s, x) {
    let b = x + 1 - s, c = 1 / FPMIN, d = 1 / b, h = d;
    for (let i = 1; i <= 500; i++) {
      const an = -i * (i - s);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < FPMIN) d = FPMIN;
      c = an / c + b;
      if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return Math.exp(-x + s * Math.log(x) - gammln(s)) * h;
  }
  function gamma(s) { return Math.exp(gammln(s)); }
  function gammaLower(s, x) { return x < s + 1 ? gser(s, x) * gamma(s) : gamma(s) * (1 - gcf(s, x)); }
  function gammaUpper(s, x) { return x < s + 1 ? gamma(s) * (1 - gser(s, x)) : gcf(s, x) * gamma(s); }

  function readInputs() {
    return {
      method: els.method.value === 'two-slope' ? 'two-slope' : 'one-slope',
      dS0: SI.parse(els.numDs0.value),          // MPa
      X: SI.parse(els.numFat.value),            // MPa (FAT class)
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
      Number.isFinite(p.f0) && p.f0 >= 0 && p.f0 <= 1 &&
      Number.isFinite(p.TD) && p.TD > 0 &&
      Number.isFinite(p.L) && p.L >= 20 && p.L <= 300 &&
      Number.isFinite(p.n0) && p.n0 > 1 &&
      Number.isFinite(p.eta) && p.eta > 0 &&
      (2.21 - 0.54 * Math.log10(p.L)) > 0;
  }

  // S-N parameters: full Table 1 row for a preset class, FAT X row for custom X;
  // one-slope mode always uses the FAT X curve through (2e6, X) with m = 3
  function snParams(p) {
    if (p.method === 'two-slope') {
      const key = els.fatPreset.value;
      return key !== 'custom' && SN_CLASSES[key] ? SN_CLASSES[key] : fatXParams(p.X);
    }
    const logK2 = 6.301 + 3 * Math.log10(p.X);
    return { name: 'FAT ' + p.X, logK2, m: 3 };
  }

  // cycles to failure at stress range s (MPa) on the active S-N curve
  function nAt(s, sn, method) {
    if (method === 'two-slope') {
      const K2 = Math.pow(10, sn.logK2);
      const K3 = Math.pow(10, sn.logK3);
      return s >= sn.dsQ ? K2 * Math.pow(s, -sn.m) : K3 * Math.pow(s, -sn.m2);
    }
    return Math.pow(10, sn.logK2) * Math.pow(s, -sn.m);
  }

  // equivalent constant-amplitude stress range: N_D / N(S_eq) = D
  function solveSEq(sn, method, ND, D) {
    const target = ND / D;
    let lo = 1e-3, hi = 1e4;
    for (let i = 0; i < 200; i++) {
      const mid = Math.sqrt(lo * hi);
      if (nAt(mid, sn, method) > target) lo = mid; else hi = mid;
    }
    return Math.sqrt(lo * hi);
  }

  function compute(p) {
    const v0 = 1 / (4 * Math.log10(p.L));                       // Hz
    const ND = 31.557e6 * p.TD * p.f0 * v0;                      // cycles
    const xi = 2.21 - 0.54 * Math.log10(p.L);                    // Weibull slope
    const q = p.dS0 / Math.pow(Math.log(p.n0), 1 / xi);          // MPa, Weibull scale
    const sn = snParams(p);
    let D;
    const extra = { sn };
    if (p.method === 'two-slope') {
      const K2 = Math.pow(10, sn.logK2);
      const K3 = Math.pow(10, sn.logK3);
      const x = Math.pow(sn.dsQ / q, xi);
      const gUp = gammaUpper(1 + sn.m / xi, x);                  // upper complementary gamma
      const gLo = gammaLower(1 + sn.m2 / xi, x);                 // lower incomplete gamma
      D = ND * (Math.pow(q, sn.m) / K2 * gUp + Math.pow(q, sn.m2) / K3 * gLo);
      Object.assign(extra, { K2, K3, logK3: sn.logK3, m1: sn.m, m2: sn.m2, Nt: sn.Nt, dsQ: sn.dsQ, x, gUp, gLo });
    } else {
      const K2 = Math.pow(10, sn.logK2);
      const G = gamma(1 + sn.m / xi);
      D = (ND / K2) * Math.pow(q, sn.m) * G;
      Object.assign(extra, { K2, G, m1: sn.m });
    }
    const life = p.TD / D;                                       // years
    const sEq = solveSEq(sn, p.method, ND, D);                   // MPa
    return { v0, ND, xi, q, D, life, sEq, ...extra };
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
      ['Method', p.method === 'two-slope' ? 'two-slope (App. C 2.3)' : 'one-slope (App. C 2.2)', '—'],
      ['S-N curve', r.sn.name, '—'],
      ['Largest stress range Δσ₀', SI.format(p.dS0, 'MPa'), 'MPa'],
      ['FAT class X', SI.format(p.X, 'MPa'), 'MPa']
    ];
    if (p.method === 'two-slope') {
      rows.push(
        ['S-N slope m (N ≤ N_t)', String(r.m1), '—'],
        ['S-N slope m+Δm (N > N_t)', String(r.m2), '—'],
        ['Cycles at knuckle N_t', fmtVal(r.Nt), '—'],
        ['Stress range at knuckle Δσ_q', SI.format(r.dsQ, 'MPa'), 'MPa'],
        ['log K₂', fmtVal(Math.log10(r.K2)), '—'],
        ['K₂', fmtVal(r.K2), '(N/mm²)^m'],
        ['log K₃', fmtVal(r.logK3), '—'],
        ['K₃', fmtVal(r.K3), '(N/mm²)^(m+Δm)'],
        ['(Δσ_q/q)^ξ', fmtVal(r.x), '—'],
        ['Γ_C(1+m/ξ; x)', fmtVal(r.gUp), '—'],
        ['γ(1+(m+Δm)/ξ; x)', fmtVal(r.gLo), '—']
      );
    } else {
      rows.push(
        ['S-N slope m (fixed)', String(r.m1), '—'],
        ['log K₂', fmtVal(Math.log10(r.K2)), '—'],
        ['K₂', fmtVal(r.K2), '(N/mm²)^m'],
        ['Γ(1 + m/ξ)', fmtVal(r.G), '—']
      );
    }
    rows.push(
      ['Fraction time at sea f₀', SI.format(p.f0, '—') + ' (' + fmtVal(p.f0 * 100) + ' %)', '—'],
      ['Design life T_D', SI.format(p.TD, 'years'), 'years'],
      ['Rule length L', SI.format(p.L, 'm'), 'm'],
      ['Zero-crossing frequency v₀', SI.format(r.v0, 'Hz'), 'Hz'],
      ['Total cycles N_D', fmtVal(r.ND), '—'],
      ['n₀', fmtVal(p.n0), '—'],
      ['Weibull slope ξ', fmtVal(r.xi), '—'],
      ['Weibull scale q', SI.format(r.q, 'MPa'), 'MPa'],
      ['Damage D', fmtVal(r.D), '—'],
      ['Allowable damage η', fmtVal(p.eta), '—'],
      ['Fatigue life T_D / D', SI.format(r.life, 'years'), 'years'],
      ['Equivalent stress range S_eq', SI.format(r.sEq, 'MPa'), 'MPa']
    );
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

  // m+Δm shown in the disabled display field: class row value, 5 for FAT X
  function classM2() {
    const key = els.fatPreset.value;
    return key !== 'custom' && SN_CLASSES[key] ? SN_CLASSES[key].m2 : 5;
  }

  // Single update path: every input change re-renders all outputs live
  function update() {
    const p = readInputs();
    els.m2Row.hidden = p.method !== 'two-slope';
    els.numM2.value = classM2();
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
  wireSliderNum(els.sliderL, els.numL, 20, 300);
  wireSliderNum(els.sliderF0, els.numF0, 0, 100);

  [els.numTd, els.numN0, els.numEta].forEach(el => el.addEventListener('input', update));

  els.method.addEventListener('change', update);

  els.fatPreset.addEventListener('change', () => {
    if (els.fatPreset.value !== 'custom') {
      els.numFat.value = els.fatPreset.value;
    }
    update();
  });

  // typing a custom FAT value resets the preset dropdown to "custom"
  els.numFat.addEventListener('input', () => {
    if (els.fatPreset.value !== 'custom' && SI.parse(els.numFat.value) !== Number(els.fatPreset.value)) {
      els.fatPreset.value = 'custom';
    }
    update();
  });

  update();
})();
