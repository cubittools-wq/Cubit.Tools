// js/widgets/unit_converter.js

export default class UnitConverterWidget {
  constructor(container) {
    this.container = container;
    try {
      this.config = JSON.parse(container.dataset.config || '{}');
    } catch (e) {
      this.config = {};
    }
    // Which box the user typed in last: the other box is the one that gets calculated.
    this.lastEdited = 'from';
    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
    this.calculate();
  }

  render() {
    const defaultFrom = this.config.default_from || Object.keys(this.config.factors || {})[0] || 'meters';
    const defaultTo = this.config.default_to || Object.keys(this.config.factors || {})[1] || 'feet';
    const units = this.config.factors ? Object.keys(this.config.factors) : (this.config.units || []);

    const optionsHtml = units.map(u => `<option value="${u}" ${u === defaultFrom ? 'selected' : ''}>${this.formatUnitName(u)}</option>`).join('');
    const optionsToHtml = units.map(u => `<option value="${u}" ${u === defaultTo ? 'selected' : ''}>${this.formatUnitName(u)}</option>`).join('');

    this.container.innerHTML = `
      <div class="tool-box">
        <div class="converter-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
          <div class="form-group">
            <label for="conv-from-val" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">From</label>
            <input type="number" id="conv-from-val" value="1" step="any" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 0.5rem;" />
            <select id="conv-from-unit" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;">
              ${optionsHtml}
            </select>
          </div>

          <div class="form-group">
            <label for="conv-to-val" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">To</label>
            <input type="number" id="conv-to-val" step="any" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 0.5rem;" />
            <select id="conv-to-unit" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;">
              ${optionsToHtml}
            </select>
          </div>
        </div>
        <p style="margin: 0; font-size: 0.875rem; color: var(--text-muted, #666);">Type a value in either box and the other updates.</p>
      </div>
    `;
  }

  formatUnitName(unit) {
    return unit.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /** Formats a result for display: up to 10 significant digits, no floating-point noise, no trailing zeros. */
  formatNumber(n) {
    if (!Number.isFinite(n)) return '';
    if (n === 0) return '0';
    return String(parseFloat(n.toPrecision(10)));
  }

  /** Converts `val` from one unit to another (linear factors or the config's formulas). */
  convert(val, fromUnit, toUnit) {
    if (fromUnit === toUnit) return val;

    // Linear conversion factors
    if (this.config.factors) {
      const factors = this.config.factors;
      return (val * (factors[fromUnit] || 1)) / (factors[toUnit] || 1);
    }
    // Non-linear formulas (e.g., temperature)
    if (this.config.formulas) {
      return this.computeFormula(val, fromUnit, toUnit);
    }
    return val;
  }

  /**
   * Recalculates whichever box the user did NOT type in last, so the two boxes work both ways.
   * Changing a unit keeps the box last typed in and recalculates the other one.
   */
  calculate() {
    const fromValEl = this.container.querySelector('#conv-from-val');
    const toValEl = this.container.querySelector('#conv-to-val');
    const fromUnitEl = this.container.querySelector('#conv-from-unit');
    const toUnitEl = this.container.querySelector('#conv-to-unit');

    if (!fromValEl || !toValEl || !fromUnitEl || !toUnitEl) return;

    const fromIsSource = this.lastEdited !== 'to';
    const sourceEl = fromIsSource ? fromValEl : toValEl;
    const targetEl = fromIsSource ? toValEl : fromValEl;
    const sourceUnit = fromIsSource ? fromUnitEl.value : toUnitEl.value;
    const targetUnit = fromIsSource ? toUnitEl.value : fromUnitEl.value;

    const val = parseFloat(sourceEl.value);
    if (isNaN(val)) {
      targetEl.value = '';
      return;
    }

    targetEl.value = this.formatNumber(this.convert(val, sourceUnit, targetUnit));
  }

  computeFormula(val, from, to) {
    if (from === to) return val;

    // Check for direct conversion formula
    const directKey = `${from}_to_${to}`;
    if (this.config.formulas && this.config.formulas[directKey]) {
      try {
        const fn = new Function('val', `return ${this.config.formulas[directKey]};`);
        return fn(val);
      } catch (e) {
        console.error('Direct formula evaluation error:', e);
      }
    }

    // Route through base unit (celsius) if direct formula is missing
    const baseUnit = this.config.base_unit || 'celsius';
    const toBaseKey = `${from}_to_${baseUnit}`;
    const fromBaseKey = `${baseUnit}_to_${to}`;

    if (this.config.formulas && this.config.formulas[toBaseKey] && this.config.formulas[fromBaseKey]) {
      try {
        const toBaseFn = new Function('val', `return ${this.config.formulas[toBaseKey]};`);
        const fromBaseFn = new Function('val', `return ${this.config.formulas[fromBaseKey]};`);
        return fromBaseFn(toBaseFn(val));
      } catch (e) {
        console.error('Base-routed formula evaluation error:', e);
      }
    }

    return val;
  }

  bindEvents() {
    const fromValEl = this.container.querySelector('#conv-from-val');
    const toValEl = this.container.querySelector('#conv-to-val');
    const fromUnitEl = this.container.querySelector('#conv-from-unit');
    const toUnitEl = this.container.querySelector('#conv-to-unit');

    fromValEl.addEventListener('input', () => { this.lastEdited = 'from'; this.calculate(); });
    toValEl.addEventListener('input', () => { this.lastEdited = 'to'; this.calculate(); });
    fromUnitEl.addEventListener('change', () => this.calculate());
    toUnitEl.addEventListener('change', () => this.calculate());
  }
}