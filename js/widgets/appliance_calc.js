// js/widgets/appliance_calc.js

export default class ApplianceCalcWidget {
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
    const classes = this.config.classes || { "A": 120, "B": 150, "C": 190, "D": 240, "E": 300, "F": 370, "G": 450 };
    const defaultRate = this.config.default_rate || 0.28;
    const classKeys = Object.keys(classes);

    const optionsHtml = classKeys.map(c => `<option value="${c}" ${c === 'C' ? 'selected' : ''}>Class ${c} (${classes[c]} kWh/year)</option>`).join('');

    this.container.innerHTML = `
      <div class="tool-box">
        <div class="form-group" style="margin-bottom: 1rem;">
          <label for="energy-class" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Energy Efficiency Class</label>
          <select id="energy-class" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;">
            ${optionsHtml}
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label for="tariff-input" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Electricity Rate (£/kWh)</label>
          <input type="number" id="tariff-input" value="${defaultRate}" step="0.01" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
        </div>

        <div class="result-box" style="padding: 1rem; background: #f8f9fa; border-radius: 6px; border: 1px solid #e2e8f0;">
          <p style="margin: 0 0 0.5rem 0;"><strong>Annual Energy Consumption:</strong> <span id="kwh-output">190 kWh</span></p>
          <p style="margin: 0;"><strong>Estimated Annual Cost:</strong> <span id="cost-output" style="font-size: 1.25rem; font-weight: bold; color: #2563eb;">£53.20</span></p>
        </div>
      </div>
    `;
  }

  calculate() {
    const classSelect = this.container.querySelector('#energy-class');
    const tariffInput = this.container.querySelector('#tariff-input');
    const kwhOut = this.container.querySelector('#kwh-output');
    const costOut = this.container.querySelector('#cost-output');

    if (!classSelect || !tariffInput || !kwhOut || !costOut) return;

    const classes = this.config.classes || {};
    const selectedClass = classSelect.value;
    const kwh = classes[selectedClass] || 0;
    const rate = parseFloat(tariffInput.value) || 0;

    const annualCost = kwh * rate;

    kwhOut.innerText = `${kwh} kWh`;
    costOut.innerText = `£${annualCost.toFixed(2)}`;
  }

  bindEvents() {
    const classSelect = this.container.querySelector('#energy-class');
    const tariffInput = this.container.querySelector('#tariff-input');

    classSelect.addEventListener('change', () => this.calculate());
    tariffInput.addEventListener('input', () => this.calculate());
  }
}