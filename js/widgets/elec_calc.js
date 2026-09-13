// js/widgets/elec_calc.js

export default class ElecCalcWidget {
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
    this.container.innerHTML = `
      <div class="tool-box">
        <div class="form-group" style="margin-bottom: 1rem;">
          <label for="watts-input" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Power (Watts)</label>
          <input type="number" id="watts-input" value="1000" step="any" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
        </div>

        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label for="volts-input" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Voltage (Volts)</label>
          <input type="number" id="volts-input" value="230" step="any" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
        </div>

        <div class="result-box" style="padding: 1rem; background: #f8f9fa; border-radius: 6px; border: 1px solid #e2e8f0;">
          <p style="margin: 0;"><strong>Current (Amperes):</strong> <span id="amps-output" style="font-size: 1.25rem; font-weight: bold; color: #2563eb;">4.35 A</span></p>
        </div>
      </div>
    `;
  }

  calculate() {
    const wattsEl = this.container.querySelector('#watts-input');
    const voltsEl = this.container.querySelector('#volts-input');
    const ampsOut = this.container.querySelector('#amps-output');

    if (!wattsEl || !voltsEl || !ampsOut) return;

    const watts = parseFloat(wattsEl.value) || 0;
    const volts = parseFloat(voltsEl.value) || 0;

    if (volts === 0) {
      ampsOut.innerText = 'Error: Voltage cannot be zero';
      return;
    }

    let amps = 0;
    const formula = this.config.formula || 'watts / volts';

    try {
      const fn = new Function('watts', 'volts', `return ${formula};`);
      amps = fn(watts, volts);
    } catch (e) {
      console.error('Calculation error:', e);
      amps = watts / volts;
    }

    ampsOut.innerText = `${isFinite(amps) ? amps.toFixed(2) : '0.00'} A`;
  }

  bindEvents() {
    const wattsEl = this.container.querySelector('#watts-input');
    const voltsEl = this.container.querySelector('#volts-input');

    wattsEl.addEventListener('input', () => this.calculate());
    voltsEl.addEventListener('input', () => this.calculate());
  }
}