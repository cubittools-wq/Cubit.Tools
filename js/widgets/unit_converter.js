// js/widgets/unit_converter.js

export default class UnitConverterWidget {
  constructor(container) {
    this.container = container;
    try {
      this.config = JSON.parse(container.dataset.config || '{}');
    } catch (e) {
      this.config = {};
    }
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
            <input type="number" id="conv-to-val" readonly style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; background: #f8f9fa; margin-bottom: 0.5rem;" />
            <select id="conv-to-unit" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;">
              ${optionsToHtml}
            </select>
          </div>
        </div>
      </div>
    `;
  }

  formatUnitName(unit) {
    return unit.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  calculate() {
    const fromValEl = this.container.querySelector('#conv-from-val');
    const toValEl = this.container.querySelector('#conv-to-val');
    const fromUnitEl = this.container.querySelector('#conv-from-unit');
    const toUnitEl = this.container.querySelector('#conv-to-unit');

    if (!fromValEl || !toValEl || !fromUnitEl || !toUnitEl) return;

    const val = parseFloat(fromValEl.value);
    if (isNaN(val)) {
      toValEl.value = '';
      return;
    }

    const fromUnit = fromUnitEl.value;
    const toUnit = toUnitEl.value;

    // Handle linear conversion factors
    if (this.config.factors) {
      const factors = this.config.factors;
      const baseValue = val * (factors[fromUnit] || 1);
      const targetValue = baseValue / (factors[toUnit] || 1);
      
      toValEl.value = parseFloat(targetValue.toFixed(6));
    } 
    // Handle non-linear formulas (e.g., temperature)
    else if (this.config.formulas) {
      toValEl.value = this.computeFormula(val, fromUnit, toUnit);
    }
  }

  computeFormula(val, from, to) {
    if (from === to) return val;

    // Check for direct conversion formula
    const directKey = `${from}_to_${to}`;
    if (this.config.formulas && this.config.formulas[directKey]) {
      try {
        const fn = new Function('val', `return ${this.config.formulas[directKey]};`);
        return parseFloat(fn(val).toFixed(2));
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
        
        const baseVal = toBaseFn(val);
        const finalVal = fromBaseFn(baseVal);
        return parseFloat(finalVal.toFixed(2));
      } catch (e) {
        console.error('Base-routed formula evaluation error:', e);
      }
    }

    return val;
  }

  bindEvents() {
    const fromValEl = this.container.querySelector('#conv-from-val');
    const fromUnitEl = this.container.querySelector('#conv-from-unit');
    const toUnitEl = this.container.querySelector('#conv-to-unit');

    fromValEl.addEventListener('input', () => this.calculate());
    fromUnitEl.addEventListener('change', () => this.calculate());
    toUnitEl.addEventListener('change', () => this.calculate());
  }
}