// js/widgets/formula_calc.js
//
// A calculator that is described entirely by Config_JSON in the Sheet, so a new calculator needs a
// new row and no new code. Widget_Type = formula_calc.
//
// Config_JSON:
//   {
//     "currency": "£",
//     "inputs": [
//       {"id": "revenue", "label": "Revenue", "type": "money", "default": 1000, "help": "optional hint"},
//       {"id": "rate", "label": "VAT rate", "type": "select", "default": 20,
//        "options": [{"label": "Standard (20%)", "value": 20}, {"label": "Reduced (5%)", "value": 5}]}
//     ],
//     "outputs": [
//       {"id": "profit", "label": "Gross profit", "type": "money", "formula": "revenue - cost"},
//       {"id": "margin", "label": "Gross margin", "type": "percent", "formula": "profit / revenue * 100", "primary": true}
//     ],
//     "note": "optional line shown under the results"
//   }
//
// Types: money, percent, number, days, months, years, hours, x (a multiple, e.g. 4.5x); inputs also allow select.
// Formulas may use input ids, the ids of other outputs, numbers, + - * / ^, brackets,
// comparisons (< <= > >= == !=) and these functions: min, max, abs, sqrt, round, floor, ceil, ln, exp,
// if(condition, then, otherwise). Optional per-output "decimals" overrides the default rounding.
// Formulas are read by the small parser below. They are never run as JavaScript.

const FUNCTIONS = {
  min: Math.min,
  max: Math.max,
  abs: Math.abs,
  sqrt: Math.sqrt,
  round: (x, places = 0) => {
    const f = Math.pow(10, places);
    return Math.round((x + Number.EPSILON) * f) / f;
  },
  floor: Math.floor,
  ceil: Math.ceil,
  ln: Math.log,
  exp: Math.exp,
  if: (condition, a, b) => (condition ? a : b)
};

const SUFFIX = { percent: '%', days: 'days', months: 'months', years: 'years', hours: 'hours', x: 'x' };

function tokenize(text) {
  const tokens = [];
  const pattern = /\s*(?:(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|(<=|>=|==|!=|[-+*/^(),<>]))/gyi;
  let pos = 0;
  while (pos < text.length) {
    if (/^\s*$/.test(text.slice(pos))) break;
    pattern.lastIndex = pos;
    const m = pattern.exec(text);
    if (!m) throw new Error(`Unexpected character in formula near "${text.slice(pos, pos + 10)}"`);
    if (m[1] !== undefined) tokens.push({ type: 'num', value: parseFloat(m[1]) });
    else if (m[2] !== undefined) tokens.push({ type: 'name', value: m[2] });
    else tokens.push({ type: 'op', value: m[3] });
    pos = pattern.lastIndex;
  }
  return tokens;
}

/** Turns a formula into a function of (values). Throws if the formula is not valid. */
export function compileFormula(text) {
  const tokens = tokenize(String(text));
  let i = 0;
  const peek = () => tokens[i];
  const isOp = (v) => peek() && peek().type === 'op' && peek().value === v;
  const take = (v) => {
    if (!isOp(v)) throw new Error(`Expected "${v}" in formula`);
    i++;
  };

  function comparison() {
    let left = sum();
    while (peek() && peek().type === 'op' && ['<', '<=', '>', '>=', '==', '!='].includes(peek().value)) {
      const op = tokens[i++].value;
      const a = left;
      const b = sum();
      left = (v) => {
        const x = a(v);
        const y = b(v);
        switch (op) {
          case '<': return x < y ? 1 : 0;
          case '<=': return x <= y ? 1 : 0;
          case '>': return x > y ? 1 : 0;
          case '>=': return x >= y ? 1 : 0;
          case '==': return x === y ? 1 : 0;
          default: return x !== y ? 1 : 0;
        }
      };
    }
    return left;
  }

  function sum() {
    let left = product();
    while (isOp('+') || isOp('-')) {
      const op = tokens[i++].value;
      const a = left;
      const b = product();
      left = op === '+' ? (v) => a(v) + b(v) : (v) => a(v) - b(v);
    }
    return left;
  }

  function product() {
    let left = unary();
    while (isOp('*') || isOp('/')) {
      const op = tokens[i++].value;
      const a = left;
      const b = unary();
      left = op === '*' ? (v) => a(v) * b(v) : (v) => a(v) / b(v);
    }
    return left;
  }

  function unary() {
    if (isOp('-')) {
      i++;
      const a = unary();
      return (v) => -a(v);
    }
    if (isOp('+')) {
      i++;
      return unary();
    }
    return power();
  }

  function power() {
    const base = atom();
    if (isOp('^')) {
      i++;
      const exponent = unary(); // right-associative
      return (v) => Math.pow(base(v), exponent(v));
    }
    return base;
  }

  function atom() {
    const t = tokens[i++];
    if (!t) throw new Error('Formula ended unexpectedly');
    if (t.type === 'num') return () => t.value;
    if (t.type === 'name') {
      if (isOp('(')) {
        const fn = FUNCTIONS[t.value.toLowerCase()];
        if (!fn) throw new Error(`Unknown function "${t.value}"`);
        i++;
        const args = [];
        if (!isOp(')')) {
          args.push(comparison());
          while (isOp(',')) {
            i++;
            args.push(comparison());
          }
        }
        take(')');
        return (v) => fn(...args.map(a => a(v)));
      }
      return (v) => {
        if (!Object.prototype.hasOwnProperty.call(v, t.value)) throw new Error(`Unknown name "${t.value}" in formula`);
        return v[t.value];
      };
    }
    if (t.type === 'op' && t.value === '(') {
      const inner = comparison();
      take(')');
      return inner;
    }
    throw new Error(`Unexpected "${t.value}" in formula`);
  }

  const run = comparison();
  if (i < tokens.length) throw new Error(`Unexpected "${tokens[i].value}" in formula`);
  return run;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const STYLE_ID = 'formula-calc-style';
const STYLE = `
.fcalc { display: grid; gap: 1.25rem; }
.fcalc-fields { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.fcalc-field label { display: block; font-size: 0.95rem; font-weight: 600; margin-bottom: 0.4rem; color: var(--text-main); }
.fcalc-control { display: flex; align-items: stretch; border: 2px solid var(--border); border-radius: 8px; background: var(--input-bg); overflow: hidden; }
.fcalc-control:focus-within { border-color: var(--accent); }
.fcalc-control input, .fcalc-control select { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--text-main); font: inherit; font-size: 1.05rem; padding: 0.7rem 0.85rem; }
.fcalc-control select option { color: #0f172a; background: #fff; }
.fcalc-unit { display: flex; align-items: center; padding: 0 0.8rem; color: var(--text-muted); background: var(--card-bg); font-size: 0.95rem; white-space: nowrap; }
.fcalc-help { margin: 0.35rem 0 0; font-size: 0.82rem; color: var(--text-muted); }
.fcalc-results { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); border-top: 1px solid var(--border); padding-top: 1.25rem; }
.fcalc-result { border: 1px solid var(--border); border-radius: 8px; padding: 0.85rem 1rem; background: var(--input-bg); }
.fcalc-result.primary { border-color: var(--accent); grid-column: 1 / -1; }
.fcalc-result-label { font-size: 0.85rem; color: var(--text-muted); }
.fcalc-result-value { font-size: 1.35rem; font-weight: 700; color: var(--text-main); overflow-wrap: anywhere; }
.fcalc-result.primary .fcalc-result-value { font-size: 1.9rem; color: var(--accent); }
.fcalc-note { margin: 0; font-size: 0.85rem; color: var(--text-muted); }
`;

export default class FormulaCalcWidget {
  constructor(container) {
    this.container = container;
    try {
      this.config = JSON.parse(container.dataset.config || '{}');
    } catch (e) {
      this.config = {};
    }
    this.currency = this.config.currency === undefined ? '£' : String(this.config.currency);
    this.inputs = Array.isArray(this.config.inputs) ? this.config.inputs.filter(f => f && f.id) : [];
    this.outputs = [];

    const problems = [];
    (Array.isArray(this.config.outputs) ? this.config.outputs : []).forEach(o => {
      if (!o || !o.id) return;
      try {
        this.outputs.push({ ...o, run: compileFormula(o.formula || '') });
      } catch (err) {
        problems.push(`${o.label || o.id}: ${err.message}`);
      }
    });

    if (this.inputs.length === 0 || this.outputs.length === 0 || problems.length > 0) {
      console.warn('formula_calc: check Config_JSON', problems);
      container.innerHTML = '<p>This calculator is not set up correctly yet. Please check its Config_JSON.</p>';
      return;
    }

    this.render();
    this.container.addEventListener('input', () => this.calculate());
    this.container.addEventListener('change', () => this.calculate());
    this.calculate();
  }

  unitFor(field) {
    if (field.unit) return String(field.unit);
    if (field.type === 'money') return this.currency;
    return SUFFIX[field.type] || '';
  }

  render() {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = STYLE;
      document.head.appendChild(style);
    }

    const fields = this.inputs.map(f => {
      const id = `fcalc-in-${escapeHtml(f.id)}`;
      const unit = this.unitFor(f);
      const unitHtml = unit ? `<span class="fcalc-unit">${escapeHtml(unit)}</span>` : '';
      const help = f.help ? `<p class="fcalc-help">${escapeHtml(f.help)}</p>` : '';
      let control;
      if (f.type === 'select' && Array.isArray(f.options)) {
        const options = f.options.map(o =>
          `<option value="${escapeHtml(o.value)}"${String(o.value) === String(f.default) ? ' selected' : ''}>${escapeHtml(o.label)}</option>`
        ).join('');
        control = `<div class="fcalc-control"><select id="${id}" data-field="${escapeHtml(f.id)}">${options}</select></div>`;
      } else {
        const input = `<input type="number" inputmode="decimal" step="any" id="${id}" data-field="${escapeHtml(f.id)}" value="${escapeHtml(f.default === undefined ? '' : f.default)}"${f.min !== undefined ? ` min="${escapeHtml(f.min)}"` : ''} />`;
        // Currency symbols sit before the number; every other unit sits after it.
        control = `<div class="fcalc-control">${f.type === 'money' ? unitHtml + input : input + unitHtml}</div>`;
      }
      return `<div class="fcalc-field"><label for="${id}">${escapeHtml(f.label || f.id)}</label>${control}${help}</div>`;
    }).join('');

    const results = this.outputs.map(o => `
        <div class="fcalc-result${o.primary ? ' primary' : ''}">
          <div class="fcalc-result-label">${escapeHtml(o.label || o.id)}</div>
          <div class="fcalc-result-value" data-output="${escapeHtml(o.id)}">–</div>
        </div>`).join('');

    const note = this.config.note ? `<p class="fcalc-note">${escapeHtml(this.config.note)}</p>` : '';

    this.container.innerHTML = `
      <div class="tool-box fcalc">
        <div class="fcalc-fields">${fields}</div>
        <div class="fcalc-results" aria-live="polite">${results}</div>
        ${note}
      </div>`;
  }

  format(value, output) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '–';
    const type = output.type || 'number';
    const fixed = Number.isInteger(output.decimals) ? output.decimals : null;
    const opts = fixed !== null
      ? { minimumFractionDigits: fixed, maximumFractionDigits: fixed }
      : type === 'money'
        ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        : { minimumFractionDigits: 0, maximumFractionDigits: 2 };
    const text = Math.abs(value).toLocaleString('en-GB', opts);
    const sign = value < 0 && Number(text.replace(/,/g, '')) !== 0 ? '-' : '';
    if (type === 'money') return `${sign}${this.currency}${text}`;
    if (type === 'percent') return `${sign}${text}%`;
    if (type === 'x') return `${sign}${text}x`;
    const unit = output.unit || SUFFIX[type];
    return unit ? `${sign}${text} ${unit}` : `${sign}${text}`;
  }

  calculate() {
    const values = {};
    let complete = true;
    this.inputs.forEach(f => {
      const el = this.container.querySelector(`[data-field="${CSS.escape(f.id)}"]`);
      const n = el && el.value.trim() !== '' ? Number(el.value) : NaN;
      if (!Number.isFinite(n)) complete = false;
      values[f.id] = n;
    });

    // Outputs can refer to each other in any order: keep passing over the list until nothing new resolves.
    const pending = new Set(this.outputs);
    for (let pass = 0; complete && pass < this.outputs.length && pending.size > 0; pass++) {
      for (const o of [...pending]) {
        try {
          values[o.id] = o.run(values);
          pending.delete(o);
        } catch (err) {
          // Depends on an output that has not been worked out yet (or a name that does not exist).
        }
      }
    }

    this.outputs.forEach(o => {
      const el = this.container.querySelector(`[data-output="${CSS.escape(o.id)}"]`);
      if (el) el.textContent = this.format(pending.has(o) || !complete ? NaN : values[o.id], o);
    });
  }
}
