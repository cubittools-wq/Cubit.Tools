// js/widgets/date_diff_calc.js

export default class DateDiffCalcWidget {
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
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    this.container.innerHTML = `
      <div class="tool-box">
        <div class="converter-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
          <div class="form-group">
            <label for="start-date" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Start Date</label>
            <input type="date" id="start-date" value="${today}" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
          </div>

          <div class="form-group">
            <label for="end-date" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">End Date</label>
            <input type="date" id="end-date" value="${nextWeek}" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
          </div>
        </div>

        <div class="result-box" style="padding: 1rem; background: #f8f9fa; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center;">
          <p style="margin: 0 0 0.25rem 0; font-size: 0.875rem; color: #64748b; text-transform: uppercase;">Difference</p>
          <span id="days-output" style="font-size: 2rem; font-weight: bold; color: #2563eb;">7 Days</span>
        </div>
      </div>
    `;
  }

  calculate() {
    const startEl = this.container.querySelector('#start-date');
    const endEl = this.container.querySelector('#end-date');
    const outputEl = this.container.querySelector('#days-output');

    if (!startEl || !endEl || !outputEl) return;

    const startDate = new Date(startEl.value);
    const endDate = new Date(endEl.value);

    if (isNaN(startDate) || isNaN(endDate)) {
      outputEl.innerText = 'Invalid Date';
      return;
    }

    const diffTime = endDate - startDate;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      outputEl.innerText = '1 Day';
    } else if (diffDays === -1) {
      outputEl.innerText = '-1 Day';
    } else {
      outputEl.innerText = `${diffDays.toLocaleString()} Days`;
    }
  }

  bindEvents() {
    const startEl = this.container.querySelector('#start-date');
    const endEl = this.container.querySelector('#end-date');

    startEl.addEventListener('change', () => this.calculate());
    endEl.addEventListener('change', () => this.calculate());
  }
}