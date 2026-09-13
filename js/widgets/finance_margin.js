// js/widgets/finance_margin.js

export default class FinanceMarginWidget {
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
    const currency = this.config.currency || '$';

    this.container.innerHTML = `
      <div class="tool-box">
        <div class="form-group" style="margin-bottom: 1rem;">
          <label for="rev-input" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Total Revenue (${currency})</label>
          <input type="number" id="rev-input" value="100000" step="any" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
        </div>

        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label for="cost-input" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Total Costs (${currency})</label>
          <input type="number" id="cost-input" value="80000" step="any" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
        </div>

        <div class="result-box" style="padding: 1rem; background: #f8f9fa; border-radius: 6px; border: 1px solid #e2e8f0;">
          <p style="margin: 0 0 0.5rem 0;"><strong>Net Profit:</strong> <span id="net-profit-output">${currency}20,000.00</span></p>
          <p style="margin: 0;"><strong>Net Profit Margin:</strong> <span id="net-margin-output" style="font-size: 1.25rem; font-weight: bold; color: #2563eb;">20.00%</span></p>
        </div>
      </div>
    `;
  }

  calculate() {
    const revInput = this.container.querySelector('#rev-input');
    const costInput = this.container.querySelector('#cost-input');
    const profitOut = this.container.querySelector('#net-profit-output');
    const marginOut = this.container.querySelector('#net-margin-output');

    if (!revInput || !costInput) return;

    const revenue = parseFloat(revInput.value) || 0;
    const costs = parseFloat(costInput.value) || 0;
    const currency = this.config.currency || '$';

    const netProfit = revenue - costs;
    let netMargin = 0;

    if (revenue !== 0) {
      netMargin = ((revenue - costs) / revenue) * 100;
    }

    profitOut.innerText = `${currency}${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    marginOut.innerText = `${netMargin.toFixed(2)}%`;
  }

  bindEvents() {
    const revInput = this.container.querySelector('#rev-input');
    const costInput = this.container.querySelector('#cost-input');

    revInput.addEventListener('input', () => this.calculate());
    costInput.addEventListener('input', () => this.calculate());
  }
}