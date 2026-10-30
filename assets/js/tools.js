// Shared calculation and SI-unit helpers for all tool pages.
// Each tools/*.html page includes this after template.js.

const SI = {
  format(value, unit, digits = 4) {
    if (!Number.isFinite(value)) return '—';
    return `${Number(value.toPrecision(digits))} ${unit}`;
  },
  parse(input) {
    const v = parseFloat(input);
    return Number.isFinite(v) ? v : NaN;
  }
};
