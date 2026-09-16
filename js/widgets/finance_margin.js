// js/widgets/finance_margin.js

export default class FinanceMarginWidget {
  constructor(container) {
    this.container = container;
    try {
      this.config = JSON.parse(container.dataset.config || '{}');
    } catch (e) {
      this.config = {};
    }
    this.activeInput = 'revenue'; // Default active trigger field
    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
    this.calculate('revenue');
  }

  render() {
    const currency = this.config.currency || '$';

    this.container.innerHTML = `
      <div class="tool-box" style="display: grid; gap: 1rem; max-width: 480px;">
        <div class="form-group">
          <label for="rev-input" style="display: block; font-weight: 600;">Total Revenue (${currency})</label>
          <input type="number" id="rev-input" data-field="revenue" value="100000" step="any" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
        </div>

        <div class="form-group">
          <label for="cost-input" style="display: block; font-weight: 600;">Total Costs (${currency})</label>
          <input type="number" id="cost-input" data-field="costs" value="80000" step="any" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
        </div>

        <div class="result-box" style="padding: 1rem; background: #f8f9fa; border-radius: 6px; border: 1px solid #e2e8f0; display: grid; gap: 1rem;">
          <div class="form-group">
            <label for="profit-input" style="display: block; font-weight: 600;">Net Profit (${currency})</label>
            <input type="number" id="profit-input" data-field="profit" value="20000" step="any" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-weight: bold;" />
          </div>

          <div class="form-group">
            <label for="margin-input" style="display: block; font-weight: 600; color: #2563eb;">Net Profit Margin (%)</label>
            <input type="number" id="margin-input" data-field="margin" value="20" step="any" style="width: 100%; padding: 0.5rem; border: 1px solid #2563eb; border-radius: 4px; font-weight: bold; color: #2563eb;" />
          </div>
        </div>
      </div>
    `;
  }

  calculate(changedField) {
    const revEl = this.container.querySelector('#rev-input');
    const costEl = this.container.querySelector('#cost-input');
    const profitEl = this.container.querySelector('#profit-input');
    const marginEl = this.container.querySelector('#margin-input');

    let rev = parseFloat(revEl.value) || 0;
    let cost = parseFloat(costEl.value) || 0;
    let profit = parseFloat(profitEl.value) || 0;
    let margin = parseFloat(marginEl.value) || 0;

    // Apply inverse formulas depending on what the user edited
    switch (changedField) {
      case 'margin':
        // Fix Revenue, adjust Costs and Profit based on new Margin (%)
        if (rev !== 0) {
          profit = rev * (margin / 100);
          cost = rev - profit;
        }
        break;

      case 'profit':
        // Fix Revenue, adjust Costs and Margin (%) based on new Profit ($)
        cost = rev - profit;
        margin = rev !== 0 ? (profit / rev) * 100 : 0;
        break;

      case 'costs':
      case 'revenue':
      default:
        // Standard forward calculation
        profit = rev - cost;
        margin = rev !== 0 ? (profit / rev) * 100 : 0;
        break;
    }

    // Update only the fields the user is NOT currently typing in
    if (changedField !== 'revenue') revEl.value = Number(rev.toFixed(2));
    if (changedField !== 'costs') costEl.value = Number(cost.toFixed(2));
    if (changedField !== 'profit') profitEl.value = Number(profit.toFixed(2));
    if (changedField !== 'margin') marginEl.value = Number(margin.toFixed(2));
  }

  bindEvents() {
    const inputs = this.container.querySelectorAll('input[data-field]');

    inputs.forEach(input => {
      input.addEventListener('input', (e) => {
        const fieldName = e.target.getAttribute('data-field');
        this.calculate(fieldName);
      });
    });
  }
}