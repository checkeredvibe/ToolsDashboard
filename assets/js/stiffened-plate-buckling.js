// Stiffened panel buckling capacity per DNV-CG-0128 (Edition December 2023),
// Sec.3 Closed Form Method (CFM): overall stiffened panel capacity ([3.1]),
// plate (EPP) capacity ([3.2] + Table 3 cases 1, 2, 15), stiffener induced
// (SI) and plate induced (PI) failure ([3.3.4] + Table 5), effective width of
// attached plating ([3.3.5]), flat bar web thickness reduction ([3.3.2]).
// Sign convention of the guideline: compressive stresses are positive.
// Stresses in N/mm^2, lateral pressure P in kN/m^2, lengths in mm.

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const E = 206000;   // N/mm^2
  const NU = 0.3;     // Poisson ratio

  const els = {
    profile: $('in-profile'),
    bulbPreset: $('in-bulb-preset'),
    bulbBlock: $('bulb-block'), scantlingBlock: $('scantling-block'),
    sectionPropsBlock: $('section-props-block'), flatNote: $('flat-note'),
    bulbPropsBody: $('bulb-props-body'), equivPropsBody: $('equiv-props-body'),
    sectionPropsBody: $('section-props-body'),
    sliderS: $('slider-s'), numS: $('num-s'),
    sliderL: $('slider-l'), numL: $('num-l'),
    sliderTp: $('slider-tp'), numTp: $('num-tp'),
    sliderHw: $('slider-hw'), numHw: $('num-hw'),
    sliderTw: $('slider-tw'), numTw: $('num-tw'),
    flangeRow: $('flange-row'),
    sliderBf: $('slider-bf'), numBf: $('num-bf'),
    sliderTf: $('slider-tf'), numTf: $('num-tf'),
    numRehP: $('num-rehp'), numRehS: $('num-rehs'),
    numSx: $('num-sx'), numSy: $('num-sy'), numTau: $('num-tau'), numP: $('num-p'),
    numPsix: $('num-psix'), numPsiy: $('num-psiy'),
    pSide: $('in-pside'),
    method: $('in-method'), panelType: $('in-panel-type'),
    endCond: $('in-endcond'), sFactor: $('in-s'),
    numLtor: $('num-ltor'), lb1Toggle: $('in-lb1'),
    numEtaAll: $('num-eta-all'),
    outEta: $('out-eta'), outMode: $('out-mode'), outGc: $('out-gc'),
    outSxlim: $('out-sx-lim'), outSylim: $('out-sy-lim'), outTaulim: $('out-tau-lim'),
    outWarn: $('out-warn'),
    utilBody: $('out-util-table').querySelector('tbody'),
    detBody: $('out-detail-table').querySelector('tbody')
  };

  // ---------- Table 3 buckling / reduction factors ----------

  // Case 1: Kx (stress along longer edge, simply supported)
  function case1Kx(psi, alpha, flong) {
    if (psi >= 0) return flong * 8.4 / (psi + 1.1);
    if (psi >= -1) return flong * (7.63 - psi * (6.26 - 10 * psi));
    return flong * 5.975 * (1 - psi) * (1 - psi);
  }

  function case1Cx(sigmaX, lam, psi) {
    if (sigmaX <= 0) return 1;
    const c = Math.min(1.25 - 0.12 * psi, 1.25);
    const lamC = (c / 2) * (1 + Math.sqrt(1 - 0.88 / c));
    if (lam <= lamC) return 1;
    return c * (1 / lam - 0.22 / (lam * lam));
  }

  // Case 2: Ky (transverse stress)
  function case2Ky(psi, alpha, ftran) {
    if (psi >= 0) {
      let f1;
      if (alpha <= 6) f1 = (1 - psi) * (alpha - 1);
      else f1 = Math.min(0.6 * (1 - 6 * psi / alpha) * (alpha + 14 / alpha), 14.5 - 0.35 / (alpha * alpha));
      return ftran * 2 * Math.pow(1 + 1 / (alpha * alpha), 2) /
        (1 + psi + (1 - psi) / 100 * (2.4 / (alpha * alpha) + 6.9 * f1));
    }
    const beta = (1 - psi) / alpha;
    const omega = Math.min(3, alpha);
    if (psi < 1 - 4 * alpha / 3) {
      const f5 = 9 / 16 * Math.pow(1 + Math.max(-1, psi), 2);
      const f3 = f5 * (f5 / 1.81 + (1 + 3 * psi) / 5.24);
      return 5.972 * ftran * beta * beta / (1 - f3);
    }
    let f1 = 0, f2 = 0, f3 = 0;
    if (alpha > 6 * (1 - psi)) {
      f1 = Math.min(0.6 * (1 / beta + 14 * beta), 14.5 - 0.35 * beta * beta);
    } else if (alpha >= 3 * (1 - psi)) {
      f1 = 1 / beta - 1;
    } else if (alpha >= 1.5 * (1 - psi)) {
      f1 = 1 / beta - Math.pow(2 - omega * beta, 4) - 9 * (omega * beta - 1) * (2 / 3 - beta);
    } else if (alpha > 1.5 && alpha >= 1 - psi) {
      f1 = 2 * (1 / beta - 16 * Math.pow(1 - omega / 3, 4)) * (1 / beta - 1);
      f2 = 3 * beta - 2;
    } else if (alpha <= 1.5 && alpha >= 1 - psi) {
      const f4 = Math.pow(1.5 - Math.min(1.5, alpha), 2);
      f1 = 2 * (1.5 / (1 - psi) - 1) * (1 / beta - 1);
      f2 = psi * (1 - 16 * f4 * f4) / (1 - alpha);
    } else if (alpha >= 0.75 * (1 - psi)) {
      const f4 = Math.pow(1.5 - Math.min(1.5, alpha), 2);
      f1 = 0;
      f2 = 1 + 2.31 * (beta - 1) - 48 * (4 / 3 - beta) * f4 * f4;
      f3 = 3 * f4 * (beta - 1) * (f4 / 1.81 - (alpha - 1) / 1.31);
    }
    return 200 * ftran * Math.pow(1 + beta * beta, 2) /
      ((1 - f3) * (100 + 2.4 * beta * beta + 6.9 * f1 + 23 * f2));
  }

  function case2Cy(sigmaY, lam, psi, K, c1) {
    if (sigmaY <= 0) return 1;
    const c = Math.min(1.25 - 0.12 * psi, 1.25);
    const lamC = 0.5 * c * (1 + Math.sqrt(1 - 0.88 / c));
    const R = lam < lamC ? lam * (1 - lam / c) : 0.22;
    const lamP2 = Math.min(Math.max(lam * lam - 0.5, 1), 3);
    const F = Math.max((1 - (K / 0.91 - 1) / lamP2) * c1, 0);
    const T = lam + 14 / (15 * lam) + 1 / 3;
    const H = Math.max(lam - 2 * lam / (c * (T + Math.sqrt(T * T - 4))), R);
    return c * (1 / lam - (R + F * F * (H - R)) / (lam * lam));
  }

  // Case 15: shear, simply supported
  function case15Ktau(alpha) { return Math.sqrt(3) * (5.34 + 4 / (alpha * alpha)); }
  function case15Ctau(lam) { return lam <= 0.84 ? 1 : 0.84 / lam; }

  // ---------- numeric helpers ----------

  function bisect(f, lo, hi) {
    if (!(hi > lo)) return null;
    let flo = f(lo), fhi = f(hi);
    if (flo > 0) return 0;
    if (fhi < 0) return null;
    for (let i = 0; i < 90; i++) {
      const mid = 0.5 * (lo + hi);
      if (f(mid) < 0) lo = mid; else hi = mid;
    }
    return 0.5 * (lo + hi);
  }

  function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

  // ---------- main calculation ----------

  function calculate(inp) {
    const warn = [];
    const s = inp.s, ell = inp.l, tp = inp.tp;
    const a = Math.max(ell, s), b = Math.min(ell, s);
    if (s > ell) warn.push('Stiffener spacing s exceeds stiffener span l; plate cases assume stress along the longer edge.');
    const alpha = a / b;
    const ReHP = inp.rehp, ReHS = inp.rehs;

    const fixedEnds = inp.endCond === 'fixed';
    const sniped = inp.endCond === 'sniped';
    const oneFixed = inp.endCond === 'one-fixed';

    // --- plate (EPP) capacity, [3.2] ---
    const sigmaE = Math.PI * Math.PI * E / (12 * (1 - NU * NU)) * Math.pow(tp / b, 2);
    const cProfile = { flat: 0.10, bulb: 0.30, angle: 0.40, T: 0.30 }[inp.profile];
    let Flong = 1;
    if (fixedEnds && inp.profile !== 'flat') Flong = cProfile + 1;
    else if (fixedEnds && inp.profile === 'flat') {
      Flong = inp.tw / tp > 1 ? cProfile + 1 : cProfile * Math.pow(inp.tw / tp, 3) + 1;
    }
    const Ftran = 1;
    const c1 = inp.panelType === 'SP-B' ? 1 : Math.max(1 - 1 / alpha, 0);

    const Kx = case1Kx(inp.psix, alpha, Flong);
    const lamX = Math.sqrt(ReHP / (Kx * sigmaE));
    const Cx = case1Cx(inp.sx, lamX, inp.psix);

    const Ky = case2Ky(inp.psiy, alpha, Ftran);
    const lamY = Math.sqrt(ReHP / (Ky * sigmaE));
    const Cy = case2Cy(inp.sy, lamY, inp.psiy, Ky, c1);

    const Ktau = case15Ktau(alpha);
    const lamTau = Math.sqrt(ReHP / (Ktau * sigmaE));
    const Ctau = case15Ctau(lamTau);

    const scx = Cx * ReHP, scy = Cy * ReHP, tauc = Ctau * ReHP / Math.sqrt(3);

    const betap = Math.max(b / tp * Math.sqrt(ReHP / E), 1.0);
    const bothComp = inp.sx >= 0 && inp.sy >= 0;
    const B = bothComp ? 0.7 - 0.3 * betap / (alpha * alpha) : 1.0;
    const e0 = bothComp ? 2 / Math.pow(betap, 0.25) : 2.0;
    const S = inp.S;

    let scxEq = scx, scyEq = scy, tauEq = tauc;
    if (!bothComp) { scxEq = ReHP; scyEq = ReHP; tauEq = ReHP; }

    const k23 = 2 / Math.pow(betap, 0.25);
    const gc1 = (inp.sx <= 0 && inp.sy <= 0 && inp.tau === 0) ? Infinity : bisect((g) => {
      const rx = g * Math.max(inp.sx, 0) * S / scxEq, ry = g * Math.max(inp.sy, 0) * S / scyEq,
        rt = g * Math.abs(inp.tau) * S / tauEq;
      return Math.pow(rx, e0) - B * Math.pow(rx, e0 / 2) * Math.pow(ry, e0 / 2) +
        Math.pow(ry, e0) + Math.pow(rt, e0) - 1;
    }, 1e-9, 1e6);
    let gc2 = Infinity;
    if (inp.sx >= 0 && (inp.sx > 0 || inp.tau > 0))
      gc2 = 1 / (S * Math.pow(Math.pow(inp.sx / scxEq, k23) + Math.pow(Math.abs(inp.tau) / tauEq, k23), 1 / k23));
    let gc3 = Infinity;
    if (inp.sy >= 0 && (inp.sy > 0 || inp.tau > 0))
      gc3 = 1 / (S * Math.pow(Math.pow(inp.sy / scyEq, k23) + Math.pow(Math.abs(inp.tau) / tauEq, k23), 1 / k23));
    const gc4 = inp.tau > 0 ? tauEq / (Math.abs(inp.tau) * S) : Infinity;
    const gcPlate = Math.min(gc1 === null ? Infinity : gc1, gc2, gc3, gc4);
    const etaPlate = gcPlate === Infinity ? 0 : (gcPlate <= 0 ? Infinity : 1 / gcPlate);

    // --- effective width of attached plating, [3.3.5] ---
    let beff1;
    if (inp.sx > 0) beff1 = Cx * b;
    else beff1 = b;
    const ellEff = fixedEnds ? ell / Math.sqrt(3) : (oneFixed ? 0.75 * ell : ell);
    const ratio = ellEff / s;
    const chiS = ratio >= 1 ? Math.min(1.12 / (1 + 1.75 / Math.pow(ratio, 1.6)), 1.0) : 0.407 * ratio;
    const beff = inp.sx > 0 ? Math.min(beff1, chiS * s) : chiS * s;

    // --- stiffener section properties ---
    let twRed = inp.tw;
    if (inp.profile === 'flat') {
      twRed = inp.tw * (1 - 2 * Math.PI * Math.PI / 3 * Math.pow(inp.hw / s, 2) * (1 - beff1 / s));
      if (twRed <= 0) { warn.push('Reduced web thickness t_w,red <= 0 ([3.3.2]): flat bar too slender for this spacing.'); twRed = Math.max(twRed, 0.01); }
    }
    const hw = inp.hw, tw = inp.tw, bf = inp.bf, tf = inp.tf;
    const parts = [{ A: beff * tp, z: -tp / 2, Iown: beff * tp * tp * tp / 12 }];
    const twWeb = inp.profile === 'flat' ? twRed : tw;
    parts.push({ A: hw * twWeb, z: hw / 2, Iown: twWeb * Math.pow(hw, 3) / 12 });
    if (inp.profile !== 'flat') {
      // Equivalent angle of a bulb: flange on top of the reduced web (h_w + t_f = h'_w), DNV-RU-SHIP Pt.3 Ch.3 Sec.7 [1.4.1] Figure 16
      const zf = (inp.profile === 'T' || inp.profile === 'bulb') ? hw + tf / 2 : hw - tf / 2;
      parts.push({ A: bf * tf, z: zf, Iown: tf * Math.pow(bf, 3) / 12 });
    }
    const Atot = parts.reduce((t, p) => t + p.A, 0);
    const zNA = parts.reduce((t, p) => t + p.A * p.z, 0) / Atot;
    const Imm = parts.reduce((t, p) => t + p.Iown + p.A * Math.pow(p.z - zNA, 2), 0);
    const Icm4 = Imm / 1e4;
    const zTop = (inp.profile === 'T' || inp.profile === 'bulb') ? hw + tf : hw;
    const Z_SI = Imm / (zTop - zNA) / 1e3;   // cm^3, at flange top
    const Z_PI = Imm / (zNA + tp) / 1e3;     // cm^3, at attached plating
    const wna = zNA + tp / 2;                // mm
    const As = parts.slice(1).reduce((t, p) => t + p.A, 0);
    const Ap = s * tp;

    const ef = inp.profile === 'flat' ? hw : hw + 0.5 * tf;
    let yw = tw / 2;
    if (inp.profile === 'T') yw = bf / 2;
    else if (inp.profile === 'angle' || inp.profile === 'bulb') yw = bf - (hw * tw * tw + tf * bf * bf) / (2 * As);

    // Table 5 (flat bar uses t_w, not t_w,red)
    const Aw = hw * tw, Af = bf * tf;
    let IP, IT, Iom;
    if (inp.profile === 'flat') {
      IP = Math.pow(hw, 3) * tw / 3e4;
      IT = hw * Math.pow(tw, 3) / 3e4 * (1 - 0.63 * tw / hw);
      Iom = Math.pow(hw, 3) * Math.pow(tw, 3) / 36e6;
    } else {
      IP = (Aw * Math.pow(ef - 0.5 * tf, 2) / 3 + Af * ef * ef) / 1e4;
      IT = (ef - 0.5 * tf) * Math.pow(tw, 3) / 3e4 * (1 - 0.63 * tw / (ef - 0.5 * tf)) +
        bf * Math.pow(tf, 3) / 3e4 * (1 - 0.63 * tf / bf);
      if (inp.profile === 'T') Iom = Math.pow(bf, 3) * tf * ef * ef / 12e6;
      else Iom = (Math.pow(Af, 3) + Math.pow(Aw, 3)) / 36e6 +
        ef * ef / 1e6 * ((Af * bf * bf + Aw * tw * tw) / 3 - Math.pow(Af * bf + Aw * tw, 2) / (4 * (Af + Aw)));
    }

    // --- overall stiffened panel capacity, [3.1] ---
    const psiC = inp.psiy >= 0 ? 0.5 * (1 + inp.psiy) : 1 / (2 * (1 - inp.psiy));
    const sxAv = (inp.sx > 0 && inp.sy > 0) ? Math.max(inp.sx - NU * psiC * inp.sy * As / (Ap + As), 0) : inp.sx;
    const Nx = sxAv * (Ap + As) / s;
    const Ny = psiC * Math.max(inp.sy, 0) * tp;
    const Nxy = Math.abs(inp.tau) * tp;
    const D11 = E * Icm4 * 1e4 / s;
    const D22 = E * Math.pow(tp, 3) / (12 * (1 - NU * NU));
    const D12 = NU * D22;
    const D33 = E * Math.pow(tp, 3) / (12 * (1 + NU));
    const LB1 = inp.lb1 ? 0.8 * ell : ell;
    const LB2 = 6 * s;

    let gBi = Infinity;
    if (Nx > 0 || Ny > 0) {
      for (let n = 1; n <= 60; n++) {
        const denom = LB2 * LB2 * Nx + n * n * LB1 * LB1 * Ny;
        if (denom <= 0) continue;
        const g = Math.PI * Math.PI / (LB1 * LB1 * LB2 * LB2) *
          (D11 * Math.pow(LB2, 4) + 2 * (D12 + D33) * n * n * LB1 * LB1 * LB2 * LB2 +
            Math.pow(n, 4) * D22 * Math.pow(LB1, 4)) / denom;
        if (g > 0 && g < gBi) gBi = g;
      }
    }
    let gTau = Infinity;
    if (Nxy > 0) {
      const r = (D12 + D33) * (D12 + D33) / (D11 * D22);
      const base = Math.pow(LB1 / 2, 2) * Nxy;
      if (D11 * D22 >= (D12 + D33) * (D12 + D33)) {
        gTau = Math.sqrt(Math.sqrt(D11 * D11 * D11 * D22)) / base *
          (8.125 + 5.64 * Math.sqrt(r) - 0.6 * r);
      } else {
        gTau = Math.sqrt(2 * D11 * (D12 + D33)) / base *
          (8.3 + 1.525 / r - 0.493 / (r * r));
      }
    }
    let gGEB;
    const hasComp = inp.sx > 0 || inp.sy > 0;
    if (inp.tau !== 0 && hasComp) {
      gGEB = 0.5 * gTau * gTau * (-1 / gBi + Math.sqrt(1 / (gBi * gBi) + 4 / (gTau * gTau)));
    } else if (hasComp) gGEB = gBi;
    else if (inp.tau !== 0) gGEB = gTau;
    else gGEB = Infinity;
    const etaGEB = gGEB === Infinity ? 0 : (gGEB <= 0 ? Infinity : 1 / gGEB);
    if (gGEB !== Infinity && gGEB <= 1) warn.push('Global elastic buckling multiplier gamma_GEB <= 1: the panel buckles globally below the applied load.');

    // --- torsional (tripping) reference stress sigma_ET ---
    const ltor = inp.ltor > 0 ? inp.ltor : ell;
    const eps = inp.profile === 'flat' ? Math.pow(tp, 3) / (3 * s) : 1 / (3 * s / Math.pow(tp, 3) + 2 * hw / Math.pow(tw, 3));
    let sigmaET = Infinity, mTor = 1;
    for (let m = 1; m <= 20; m++) {
      const sET = (E / IP) * (Math.pow(m * Math.PI / ltor, 2) * Iom * 1e2 +
        IT / (2 * (1 + NU)) + Math.pow(ltor / (m * Math.PI), 2) * eps * 1e-4);
      if (sET < sigmaET) { sigmaET = sET; mTor = m; }
    }

    // --- stiffener capacity (SI and PI), [3.3.4] ---
    let sxSt = inp.sx;
    if (inp.method === 'FE' && inp.sx > 0 && inp.sy > 0) sxSt = Math.max(inp.sx - NU * inp.sy, 0);
    const sigmaA = sxSt * (Ap + As) / (beff1 * tp + As);

    const vmDenom = Math.sqrt(Math.pow(sxAv, 2) + Math.pow(inp.sy, 2) - sxAv * inp.sy + 3 * inp.tau * inp.tau);
    const gReH = vmDenom > 0 ? Math.min(ReHP, ReHS) / vmDenom : Infinity;
    const lamG = gGEB === Infinity ? (gReH === Infinity ? 0 : Infinity) : Math.sqrt(gReH / gGEB);
    const Csl = lamG <= 1.56 ? 1 - Math.pow(lamG, 4) / 12 : 3 / Math.pow(lamG, 4);

    const FEbuck = Math.pow(Math.PI / ell, 2) * E * Icm4 * 1e4;
    const w0 = ell / 1000;
    const CsnipSI = -1.2, CsnipPI = 1.2;
    const divM1 = sniped ? 8e3 : 24e3;

    function stiffCheck(mode) {
      const ReH = mode === 'SI' ? ReHS : ReHP;
      const Z = mode === 'SI' ? Z_SI : Z_PI;
      const Ci = mode === 'SI' ? (inp.pSameSide ? 1 : -1) : (inp.pSameSide ? -1 : 1);
      const M1 = Ci * Math.abs(inp.p) * s * ell * ell / divM1;
      const Csnip = mode === 'SI' ? CsnipSI : CsnipPI;
      const phi0 = ltor / (mTor * hw) * 1e-4;

      const M0 = (g) => (gGEB === Infinity) ? 0 : FEbuck * Csl * (g / (gGEB - g)) * w0;
      const M2 = (g) => sniped ? Csnip * wna * g * sxSt * (Ap + As) : 0;
      const sw = (g) => {
        if (mode !== 'SI' || sigmaA <= 0 || sigmaET === Infinity) return 0;
        const denom = 1 - g * sigmaA / sigmaET;
        if (denom <= 0) return Infinity;
        return E * yw * ef * phi0 * Math.pow(mTor * Math.PI / ltor, 2) * (1 / denom - 1);
      };
      const lhs = (g) => (g * sigmaA + (M0(g) + M1 + M2(g)) / (1000 * Z) + sw(g)) * S / ReH;

      if (sigmaA <= 0 && lhs(1) <= 0) return { gc: Infinity, eta: 0, detail: { M1, sigmaA } };
      let hi = 1e6;
      if (gGEB !== Infinity) hi = Math.min(hi, 0.999 * gGEB);
      if (sigmaA > 0 && sigmaET !== Infinity) hi = Math.min(hi, 0.999 * sigmaET / sigmaA);
      if (lhs(hi) <= 0) return { gc: hi, eta: 1 / hi, capped: true, detail: { M1, sigmaA } };
      const gc = bisect((g) => lhs(g) - 1, 1e-6, hi);
      return { gc: gc === null ? Infinity : gc, eta: gc === null ? 0 : (gc <= 0 ? Infinity : 1 / gc), detail: { M1, sigmaA } };
    }

    const si = stiffCheck('SI');
    const pi = stiffCheck('PI');
    if (sigmaA > 0 && sigmaET <= sigmaA) warn.push('sigma_ET <= sigma_a: torsional buckling of the stiffener occurs below the applied stress.');

    const modes = [
      { key: 'Overall panel (GEB)', eta: etaGEB, gc: gGEB },
      { key: 'Plate (EPP)', eta: etaPlate, gc: gcPlate },
      { key: 'Stiffener induced (SI)', eta: si.eta, gc: si.gc },
      { key: 'Plate induced (PI)', eta: pi.eta, gc: pi.gc }
    ];
    let gov = modes[0];
    for (const m of modes) if (m.eta > gov.eta) gov = m;
    const eta = gov.eta;
    const gcGov = eta === Infinity ? 0 : (eta === 0 ? Infinity : 1 / eta);

    return {
      warn, alpha, sigmaE, Flong, Kx, lamX, Cx, Ky, lamY, Cy, Ktau, lamTau, Ctau,
      scx, scy, tauc, betap, B, e0, gc1, gc2, gc3, gc4, gcPlate, etaPlate,
      beff1, beff, chiS, twRed, As, Ap, zNA, Icm4, Z_SI, Z_PI, wna, ef, yw, IP, IT, Iom,
      sxAv, Nx, Ny, D11, D22, LB1, gBi, gTau, gGEB, etaGEB, lamG, Csl,
      sigmaET, mTor, sigmaA, si, pi, modes, gov, eta, gcGov,
      M1SI: si.detail.M1, M1PI: pi.detail.M1
    };
  }

  // ---------- UI wiring ----------

  function readInputs() {
    const profile = els.profile.value;
    return {
      profile,
      s: SI.parse(els.numS.value), l: SI.parse(els.numL.value), tp: SI.parse(els.numTp.value),
      hw: SI.parse(els.numHw.value), tw: SI.parse(els.numTw.value),
      bf: SI.parse(els.numBf.value), tf: SI.parse(els.numTf.value),
      rehp: SI.parse(els.numRehP.value), rehs: SI.parse(els.numRehS.value),
      sx: SI.parse(els.numSx.value), sy: SI.parse(els.numSy.value),
      tau: SI.parse(els.numTau.value), p: SI.parse(els.numP.value),
      psix: SI.parse(els.numPsix.value), psiy: SI.parse(els.numPsiy.value),
      pSameSide: els.pSide.value === 'same',
      method: els.method.value, panelType: els.panelType.value,
      endCond: els.endCond.value, S: SI.parse(els.sFactor.value),
      ltor: SI.parse(els.numLtor.value), lb1: els.lb1Toggle.checked,
      etaAll: SI.parse(els.numEtaAll.value)
    };
  }

  function pair(slider, num, onChange) {
    slider.addEventListener('input', () => { num.value = slider.value; onChange(); });
    slider.addEventListener('change', onChange);
    num.addEventListener('input', () => { slider.value = num.value; onChange(); });
    num.addEventListener('change', onChange);
  }

  // mm-based formatting: scientific notation for values larger than 999.9
  function fmtV(v, d = 4) {
    if (!Number.isFinite(v)) return '\u2014';
    if (Math.abs(v) > 999.9) return v.toExponential(3);
    return Number(v.toPrecision(d));
  }
  function fmt(v, unit, d = 4) { return fmtV(v, d) + ' ' + (unit || ''); }

  function row(body, name, value, unit) {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td'); td1.textContent = name;
    const td2 = document.createElement('td'); td2.textContent = value;
    const td3 = document.createElement('td'); td3.textContent = unit || '';
    tr.append(td1, td2, td3); body.appendChild(tr);
  }

  function render(r, inp) {
    const ok = r.eta <= inp.etaAll;
    els.outEta.textContent = Number.isFinite(r.eta) ? Number(r.eta.toPrecision(4)) : '\u221E';
    els.outGc.textContent = Number.isFinite(r.gcGov) && r.gcGov > 0 ? Number(r.gcGov.toPrecision(4)) : '\u2014';
    els.outMode.textContent = r.gov.key;
    els.outMode.className = 'badge ' + (ok ? 'text-bg-success' : 'text-bg-danger');
    const statusEl = $('out-status');
    statusEl.textContent = ok ? 'OK (\u03B7 \u2264 \u03B7_all)' : 'Exceeded';
    statusEl.className = 'badge ' + (ok ? 'text-bg-success' : 'text-bg-danger');
    els.outSxlim.textContent = fmt(r.gcGov * inp.sx, 'N/mm\u00B2');
    els.outSylim.textContent = fmt(r.gcGov * inp.sy, 'N/mm\u00B2');
    els.outTaulim.textContent = fmt(r.gcGov * Math.abs(inp.tau), 'N/mm\u00B2');

    els.outWarn.innerHTML = '';
    for (const w of r.warn) {
      const div = document.createElement('div');
      div.className = 'alert alert-warning py-1 px-2 small mb-1';
      div.textContent = w;
      els.outWarn.appendChild(div);
    }

    els.utilBody.innerHTML = '';
    for (const m of r.modes) {
      const tr = document.createElement('tr');
      const etaTxt = Number.isFinite(m.eta) ? Number(m.eta.toPrecision(4)) : (m.eta === Infinity ? '\u221E' : '\u2014');
      const gcTxt = Number.isFinite(m.gc) ? (m.gc > 0 ? Number(m.gc.toPrecision(4)) : '\u221E') : '\u2014';
      const status = m.eta <= inp.etaAll ?
        '<span class="badge text-bg-success">OK</span>' :
        '<span class="badge text-bg-danger">Exceeded</span>';
      tr.innerHTML = '<td>' + m.key + '</td><td>' + gcTxt + '</td><td>' + etaTxt + '</td><td>' + status + '</td>';
      els.utilBody.appendChild(tr);
    }

    els.detBody.innerHTML = '';
    const B = els.detBody;
    row(B, 'Aspect ratio a/b', fmt(r.alpha, '\u2013'), '\u2013');
    row(B, 'Elastic reference stress \u03C3_E', fmt(r.sigmaE, 'N/mm\u00B2'), 'N/mm\u00B2');
    row(B, 'F_long', fmt(r.Flong, '\u2013'), '\u2013');
    row(B, 'K_x / \u03BB / C_x', fmt(r.Kx, '\u2013') + ' / ' + fmt(r.lamX, '\u2013') + ' / ' + fmt(r.Cx, '\u2013'), '\u2013');
    row(B, 'K_y / \u03BB / C_y', fmt(r.Ky, '\u2013') + ' / ' + fmt(r.lamY, '\u2013') + ' / ' + fmt(r.Cy, '\u2013'), '\u2013');
    row(B, 'K_\u03C4 / \u03BB / C_\u03C4', fmt(r.Ktau, '\u2013') + ' / ' + fmt(r.lamTau, '\u2013') + ' / ' + fmt(r.Ctau, '\u2013'), '\u2013');
    row(B, '\u03C3_cx\u2032 / \u03C3_cy\u2032 / \u03C4_c\u2032', fmt(r.scx, 'N/mm\u00B2') + ' / ' + fmt(r.scy, 'N/mm\u00B2') + ' / ' + fmt(r.tauc, 'N/mm\u00B2'), 'N/mm\u00B2');
    row(B, '\u03B2_p / B / e\u2080', fmt(r.betap, '\u2013') + ' / ' + fmt(r.B, '\u2013') + ' / ' + fmt(r.e0, '\u2013'), '\u2013');
    row(B, '\u03B3_c1 / \u03B3_c2 / \u03B3_c3 / \u03B3_c4 (plate)',
      [r.gc1, r.gc2, r.gc3, r.gc4].map((g) => Number.isFinite(g) ? Number(g.toPrecision(4)) : '\u221E').join(' / '), '\u2013');
    row(B, 'b_eff1 / b_eff', fmt(r.beff1, 'mm') + ' / ' + fmt(r.beff, 'mm'), 'mm');
    row(B, 't_w,red (flat bar)', fmt(r.twRed, 'mm'), 'mm');
    row(B, 'A_s / A_p', fmt(r.As, 'mm\u00B2') + ' / ' + fmt(r.Ap, 'mm\u00B2'), 'mm\u00B2');
    row(B, 'Neutral axis from plate surface', fmt(r.zNA, 'mm'), 'mm');
    row(B, 'I (with effective plate)', fmt(r.Icm4 * 1e4, 'mm\u2074'), 'mm\u2074');
    row(B, 'Z (SI, flange top) / Z (PI, plate)', fmt(r.Z_SI * 1e3, 'mm\u00B3') + ' / ' + fmt(r.Z_PI * 1e3, 'mm\u00B3'), 'mm\u00B3');
    row(B, 'e_f / y_w', fmt(r.ef, 'mm') + ' / ' + fmt(r.yw, 'mm'), 'mm');
    row(B, 'I_P / I_T', fmt(r.IP * 1e4, 'mm\u2074') + ' / ' + fmt(r.IT * 1e4, 'mm\u2074'), 'mm\u2074');
    row(B, 'I_\u03C9', fmt(r.Iom * 1e6, 'mm\u2076'), 'mm\u2076');
    row(B, '\u03C3_x,av', fmt(r.sxAv, 'N/mm\u00B2'), 'N/mm\u00B2');
    row(B, 'D_11 / D_22', fmt(r.D11, 'N\u00B7mm') + ' / ' + fmt(r.D22, 'N\u00B7mm'), 'N\u00B7mm');
    row(B, '\u03B3_GEB,bi / \u03B3_GEB,\u03C4 / \u03B3_GEB',
      [r.gBi, r.gTau, r.gGEB].map((g) => Number.isFinite(g) ? Number(g.toPrecision(4)) : '\u221E').join(' / '), '\u2013');
    row(B, '\u03BB_G / C_sl', fmt(r.lamG, '\u2013') + ' / ' + fmt(r.Csl, '\u2013'), '\u2013');
    row(B, '\u03C3_ET (min over m_tor) / m_tor', fmt(r.sigmaET, 'N/mm\u00B2') + ' / ' + r.mTor, '');
    row(B, '\u03C3_a (effective axial stress)', fmt(r.sigmaA, 'N/mm\u00B2'), 'N/mm\u00B2');
    row(B, 'M_1 (SI) / M_1 (PI)', fmt(r.M1SI, 'N\u00B7mm') + ' / ' + fmt(r.M1PI, 'N\u00B7mm'), 'N\u00B7mm');

  }

  function update() {
    const inp = readInputs();
    const missing = ['s', 'l', 'tp', 'hw', 'tw', 'rehp', 'rehs', 'sx', 'sy', 'tau'].some((k) => !Number.isFinite(inp[k]));
    if (missing) return;
    if (inp.profile !== 'flat' && (!Number.isFinite(inp.bf) || !Number.isFinite(inp.tf))) return;
    let res;
    try { res = calculate(inp); } catch (e) { return; }
    if (inp.profile !== 'bulb') renderSectionProps(inp);
    render(res, inp);
  }

  const updateFull = () => update();

  pair(els.sliderS, els.numS, updateFull);
  pair(els.sliderL, els.numL, updateFull);
  pair(els.sliderTp, els.numTp, updateFull);
  pair(els.sliderHw, els.numHw, updateFull);
  pair(els.sliderTw, els.numTw, updateFull);
  pair(els.sliderBf, els.numBf, updateFull);
  pair(els.sliderTf, els.numTf, updateFull);

  // Equivalent angle idealization of a bulb flat per DNV-RU-SHIP Pt.3 Ch.3
  // Sec.7 [1.4.1] (referenced from CG-128 [3.3.3]).
  function bulbEquivalent(p) {
    const h = p.h, t = p.t;
    const alpha = h <= 120 ? 1.1 + Math.pow(120 - h, 2) / 3000 : 1.0;
    const hw = h - h / 9.2 + 2;
    const tf = h / 9.2 - 2;
    const bf = alpha * (t + h / 6.7 - 2);
    return { hw: Number(hw.toPrecision(4)), tw: t, bf: Number(bf.toPrecision(4)), tf: Number(tf.toPrecision(4)) };
  }

  // Geometric properties of the stiffener alone (no attached plating)
  function stiffenerOnlyProps(profile, hw, tw, bf, tf) {
    const parts = [{ A: hw * tw, z: hw / 2, Iown: tw * Math.pow(hw, 3) / 12 }];
    if (profile !== 'flat') {
      const zf = (profile === 'T' || profile === 'bulb') ? hw + tf / 2 : hw - tf / 2;
      parts.push({ A: bf * tf, z: zf, Iown: tf * Math.pow(bf, 3) / 12 });
    }
    const A = parts.reduce((t2, p) => t2 + p.A, 0);
    const z = parts.reduce((t2, p) => t2 + p.A * p.z, 0) / A;
    const Imm = parts.reduce((t2, p) => t2 + p.Iown + p.A * Math.pow(p.z - z, 2), 0);
    const zTop = (profile === 'T' || profile === 'bulb') ? hw + tf : hw;
    const ef = profile === 'flat' ? hw : hw + 0.5 * tf;
    let yw = tw / 2;
    if (profile === 'T') yw = bf / 2;
    else if (profile === 'angle' || profile === 'bulb') yw = bf - (hw * tw * tw + tf * bf * bf) / (2 * A);
    return { A, z, Icm4: Imm / 1e4, Ztop: Imm / (zTop - z) / 1e3, Zplate: Imm / z / 1e3, ef, yw };
  }

  function setScantlings(v) {
    for (const key of ['Hw', 'Tw', 'Bf', 'Tf']) {
      const num = els['num' + key], slider = els['slider' + key];
      num.value = v[key.toLowerCase()];
      slider.value = num.value;
    }
  }

  function fillBulbPresets() {
    if (typeof BULB_PROFILES === 'undefined') return;
    const seen = new Set();
    for (const p of BULB_PROFILES) {
      if (seen.has(p.name)) continue;
      seen.add(p.name);
      const opt = document.createElement('option');
      opt.value = p.name;
      opt.textContent = p.name;
      if (p.name === 'HP 140x7') opt.selected = true;
      els.bulbPreset.appendChild(opt);
    }
  }

  function propRow(body, name, value, unit) {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td'); td1.textContent = name;
    const td2 = document.createElement('td'); td2.textContent = typeof value === 'number' ? fmtV(value) : value;
    const td3 = document.createElement('td'); td3.textContent = unit || '';
    tr.append(td1, td2, td3); body.appendChild(tr);
  }

  function renderBulbProps(p) {
    const eq = bulbEquivalent(p);
    els.bulbPropsBody.innerHTML = '';
    propRow(els.bulbPropsBody, 'Height h\u2032\u2098', Number(p.h), 'mm');
    propRow(els.bulbPropsBody, 'Web thickness t\u2032\u2098', Number(p.t), 'mm');
    propRow(els.bulbPropsBody, 'Section area', p.a * 100, 'mm\u00B2');
    propRow(els.bulbPropsBody, 'Centroid from web back', p.dx * 10, 'mm');
    propRow(els.bulbPropsBody, 'Moment of inertia I\u2093', p.ix * 1e4, 'mm\u2074');
    propRow(els.bulbPropsBody, 'Section modulus W\u2093', p.wx * 1e3, 'mm\u00B3');
    els.equivPropsBody.innerHTML = '';
    propRow(els.equivPropsBody, 'Web height h\u2098', eq.hw, 'mm');
    propRow(els.equivPropsBody, 'Web thickness t\u2098', eq.tw, 'mm');
    propRow(els.equivPropsBody, 'Flange breadth b\u1DA0', eq.bf, 'mm');
    propRow(els.equivPropsBody, 'Flange thickness t\u1DA0', eq.tf, 'mm');
    const sp = stiffenerOnlyProps('angle', eq.hw, eq.tw, eq.bf, eq.tf);
    propRow(els.equivPropsBody, 'Section area A\u209B', Number(sp.A.toPrecision(4)), 'mm\u00B2');
    propRow(els.equivPropsBody, 'Centroid from plate', Number(sp.z.toPrecision(4)), 'mm');
    propRow(els.equivPropsBody, 'Moment of inertia I', sp.Icm4 * 1e4, 'mm\u2074');
    propRow(els.equivPropsBody, 'Section modulus Z (flange top)', sp.Ztop * 1e3, 'mm\u00B3');
    propRow(els.equivPropsBody, 'Section modulus Z (plate side)', sp.Zplate * 1e3, 'mm\u00B3');
    propRow(els.equivPropsBody, 'e\u1DA0 (CG-128 symbols)', Number(sp.ef.toPrecision(4)), 'mm');
    return eq;
  }

  function applyBulbPreset() {
    if (typeof BULB_PROFILES === 'undefined') return;
    const p = BULB_PROFILES.find((q) => q.name === els.bulbPreset.value);
    if (!p) return;
    setScantlings(renderBulbProps(p));
  }

  els.bulbPreset.addEventListener('change', () => { applyBulbPreset(); updateFull(); });

  function renderSectionProps(inp) {
    const sp = stiffenerOnlyProps(inp.profile, inp.hw, inp.tw, inp.bf, inp.tf);
    els.sectionPropsBody.innerHTML = '';
    propRow(els.sectionPropsBody, 'Section area A\u209B', Number(sp.A.toPrecision(4)), 'mm\u00B2');
    propRow(els.sectionPropsBody, 'Centroid from plate', Number(sp.z.toPrecision(4)), 'mm');
    propRow(els.sectionPropsBody, 'Moment of inertia I', sp.Icm4 * 1e4, 'mm\u2074');
    propRow(els.sectionPropsBody, 'Section modulus Z (flange top)', sp.Ztop * 1e3, 'mm\u00B3');
    propRow(els.sectionPropsBody, 'Section modulus Z (plate side)', sp.Zplate * 1e3, 'mm\u00B3');
    propRow(els.sectionPropsBody, 'e\u1DA0', Number(sp.ef.toPrecision(4)), 'mm');
    propRow(els.sectionPropsBody, 'y\u2098', Number(sp.yw.toPrecision(4)), 'mm');
  }

  function syncProfile() {
    const flat = els.profile.value === 'flat';
    const bulb = els.profile.value === 'bulb';
    els.bulbBlock.hidden = !bulb;
    els.scantlingBlock.hidden = bulb;
    els.sectionPropsBlock.hidden = bulb;
    els.flangeRow.hidden = flat;
    els.flatNote.hidden = !flat;
    if (bulb) applyBulbPreset();
    updateFull();
  }
  els.profile.addEventListener('change', syncProfile);

  for (const el of [els.numRehP, els.numRehS, els.numSx, els.numSy, els.numTau, els.numP,
    els.numPsix, els.numPsiy, els.pSide, els.method, els.panelType, els.endCond,
    els.sFactor, els.numLtor, els.numEtaAll]) {
    el.addEventListener('input', updateFull);
    el.addEventListener('change', updateFull);
  }
  els.lb1Toggle.addEventListener('change', updateFull);

  fillBulbPresets();
  syncProfile();
})();
