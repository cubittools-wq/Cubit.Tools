// js/widgets/elec_calc.js
//
// Watts <-> amps calculator. Every box can be typed in:
// - type watts  -> amps updates
// - type amps   -> watts updates
// - change volts -> the box you did NOT type in last (watts or amps) is recalculated, so the
//   value you entered last stays exactly as typed.
//
// Config_JSON "formula" (optional) is amps as a function of `watts` and `volts`, default "watts / volts".
// Watts from amps is worked out from the same formula (it must scale in proportion to watts,
// which is true of watts / volts and of power-factor variants such as watts / (volts * 0.9)).

export default class ElecCalcWidget {
  constructor(container) {
    this.container = container;
    try {
      this.config = JSON.parse(container.dataset.config || '{}');
    } catch (e) {
      this.config = {};
    }
    // Which of watts / amps was typed in last (used when the voltage changes).
    this.lastPowerField = 'watts';
    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
    this.calculate('watts');
  }

  render() {
    const inputStyle = 'width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;';
    this.container.innerHTML = `
      <div class="tool-box">
        <div class="form-group" style="margin-bottom: 1rem;">
          <label for="watts-input" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Power (Watts)</label>
          <input type="number" id="watts-input" data-field="watts" value="1000" step="any" style="${inputStyle}" />
        </div>

        <div class="form-group" style="margin-bottom: 1rem;">
          <label for="volts-input" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Voltage (Volts)</label>
          <input type="number" id="volts-input" data-field="volts" value="230" step="any" style="${inputStyle}" />
        </div>

        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label for="amps-input" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--accent, #2563eb);">Current (Amps)</label>
          <input type="number" id="amps-input" data-field="amps" step="any" style="width: 100%; padding: 0.5rem; border: 1px solid var(--accent, #2563eb); border-radius: 4px; font-weight: bold;" />
        </div>

        <p id="elec-message" aria-live="polite" style="margin: 0; min-height: 1.25rem; font-size: 0.875rem; color: var(--text-muted, #666);">Type a value in the watts or amps box and the other updates.</p>
      </div>
    `;
  }

  /** Amps for a given power and voltage, using the Sheet's formula if there is one. */
  ampsFromWatts(watts, volts) {
    const formula = this.config.formula || 'watts / volts';
    try {
      const fn = new Function('watts', 'volts', `return ${formula};`);
      return fn(watts, volts);
    } catch (e) {
      console.error('Calculation error:', e);
      return watts / volts;
    }
  }

  /** Watts for a given current and voltage: the formula run backwards (it scales in proportion to watts). */
  wattsFromAmps(amps, volts) {
    const ampsPerWatt = this.ampsFromWatts(1, volts);
    return ampsPerWatt ? amps / ampsPerWatt : NaN;
  }

  /** Rounds for display (max 4 decimal places, no trailing zeros). Blank if the result isn't a number. */
  format(n) {
    return Number.isFinite(n) ? String(Number(n.toFixed(4))) : '';
  }

  /**
   * `changed` is the box the user just typed in ('watts', 'amps' or 'volts').
   * The other box is recalculated; when volts changes, the last-typed of watts / amps is kept.
   */
  calculate(changed) {
    const wattsEl = this.container.querySelector('#watts-input');
    const voltsEl = this.container.querySelector('#volts-input');
    const ampsEl = this.container.querySelector('#amps-input');
    const msgEl = this.container.querySelector('#elec-message');
    if (!wattsEl || !voltsEl || !ampsEl) return;

    if (changed === 'watts' || changed === 'amps') this.lastPowerField = changed;
    const source = changed === 'volts' ? this.lastPowerField : changed;
    const target = source === 'watts' ? ampsEl : wattsEl;
    const sourceEl = source === 'watts' ? wattsEl : ampsEl;

    const volts = parseFloat(voltsEl.value);
    if (!(volts > 0)) {
      target.value = '';
      if (msgEl) msgEl.textContent = 'Enter a voltage above zero.';
      return;
    }
    if (msgEl) msgEl.textContent = 'Type a value in the watts or amps box and the other updates.';

    const typed = parseFloat(sourceEl.value);
    if (isNaN(typed)) {
      target.value = '';
      return;
    }

    target.value = this.format(
      source === 'watts' ? this.ampsFromWatts(typed, volts) : this.wattsFromAmps(typed, volts)
    );
  }

  bindEvents() {
    this.container.querySelectorAll('input[data-field]').forEach(input => {
      input.addEventListener('input', () => this.calculate(input.dataset.field));
    });
  }
}