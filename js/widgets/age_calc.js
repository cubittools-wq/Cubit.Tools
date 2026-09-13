// js/widgets/age_calc.js

export default class AgeCalcWidget {
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
        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label for="dob-input" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Date of Birth</label>
          <input type="date" id="dob-input" value="1990-06-15" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
        </div>

        <div class="result-box" style="padding: 1rem; background: #f8f9fa; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center;">
          <p style="margin: 0 0 0.5rem 0; font-size: 0.875rem; color: #64748b; text-transform: uppercase;">Your Exact Age</p>
          <span id="age-output" style="font-size: 1.5rem; font-weight: bold; color: #2563eb;">--</span>
        </div>
      </div>
    `;
  }

  calculate() {
    const dobEl = this.container.querySelector('#dob-input');
    const outputEl = this.container.querySelector('#age-output');

    if (!dobEl || !outputEl) return;

    const dobValue = dobEl.value;
    if (!dobValue) {
      outputEl.innerText = 'Please select a date';
      return;
    }

    const birthDate = new Date(dobValue);
    const today = new Date();

    if (birthDate > today) {
      outputEl.innerText = 'Date of birth cannot be in the future';
      return;
    }

    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();

    if (days < 0) {
      months--;
      // Get number of days in the previous month
      const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += prevMonth.getDate();
    }

    if (months < 0) {
      years--;
      months += 12;
    }

    outputEl.innerText = `${years} Years, ${months} Months, ${days} Days`;
  }

  bindEvents() {
    const dobEl = this.container.querySelector('#dob-input');
    dobEl.addEventListener('change', () => this.calculate());
  }
}