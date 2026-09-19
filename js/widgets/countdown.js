// js/widgets/countdown.js
//
// Live countdown timer. Config_JSON (all keys optional except a way to find the date):
//
// FIXED-DATE COUNTDOWNS (mode "fixed", the default)
//   "target_date": "12-25"              annual date, MM-DD (rolls to next year once the day has passed)
//   "target_date": "2028-07-14"         one-off date, YYYY-MM-DD (or "2028-07-14T20:00" for a time)
//   "rule": {...}                       a date that moves each year:
//       {"type":"nth_weekday","month":11,"weekday":4,"n":4}     4th Thursday of November (weekday 0=Sun..6=Sat, n=-1 for last)
//       {"type":"easter","offset":-47}                            days from Easter Sunday
//       {"type":"weekday_on_or_after","month":9,"day":15,"weekday":6}   first Saturday on or after 15 September
//       {"type":"friday13"}                                       next Friday the 13th
//       {"type":"daily"}  {"type":"weekly","weekday":5}           next time of day / next weekday, use with "time"
//   "dates": {"2027":"2027-02-06", ...}  table of dates by year (lunar and religious dates, solstices...)
//   "dates": [{"date":"2026-12-25","label":"Christmas Day"}, ...]   a list: counts down to the next one
//   "time": "17:00"                     time of day (default midnight); "utc": true reads times as UTC
//   "arrival_message": "..."            shown on the day itself (all-day events stay "arrived" until midnight)
//   "ended_message": "..."              shown when a one-off event or table has run out
//   "show_sleeps": true                 adds "N sleeps to go" under the timer
//
// PRESENTATION MODE: every countdown has a "Presentation mode" button that fills the screen with the timer
// (Esc exits; it also asks the screen to stay awake). Set "presentation_title" to change the heading shown there.
//
// PERSONAL COUNTDOWNS (the visitor picks the date; kept in their own browser only)
//   "mode": "custom"       "input": "datetime" | "date", "label", "default_days", "default_time"
//   "mode": "birthday"     asks for a date of birth, counts down to the next birthday ("anniversary": true turns it into an anniversary counter)
//   "mode": "retirement"   asks for a date of birth and a retirement age ("default_age")
//   "mode": "pregnancy"    due date and first day of last period; whichever was typed last drives the other
//   "prompt": "..."        (any personal mode) text shown until a date has been entered
//   "mode": "time_of_day"  asks for a time, counts down to the next time it is that time ("default_time")

const DAY_MS = 86400000;
const WEEK_DAYS = 7;
const PREGNANCY_DAYS = 280;

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function clock(str) {
  const parts = String(str || '00:00:00').split(':').map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function make(year, month, day, time, utc) {
  return utc
    ? new Date(Date.UTC(year, month - 1, day, time[0], time[1], time[2]))
    : new Date(year, month - 1, day, time[0], time[1], time[2]);
}

/** The moment a date-only event ends: the start of the next calendar day (not +24h, which is wrong on clock-change days). */
function dayEnd(date, utc) {
  return utc
    ? new Date(date.getTime() + DAY_MS)
    : new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

/** Day of month for the nth (1..4) or last (-1) given weekday of a month. */
function nthWeekdayDay(year, month, weekday, n) {
  if (n > 0) {
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    return 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
  }
  const last = new Date(year, month, 0);
  return last.getDate() - ((last.getDay() - weekday + 7) % 7);
}

/** Easter Sunday (Western churches) for a year, by the anonymous Gregorian algorithm. */
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/** { month, day } for a movable-date rule in a given year, or null if the rule isn't a yearly date rule. */
function ruleDate(rule, year) {
  switch (rule.type) {
    case 'nth_weekday':
      return { month: rule.month, day: nthWeekdayDay(year, rule.month, rule.weekday, rule.n) };
    case 'easter': {
      const e = easterSunday(year);
      const d = new Date(year, e.month - 1, e.day + (rule.offset || 0));
      return { month: d.getMonth() + 1, day: d.getDate() };
    }
    case 'weekday_on_or_after': {
      const start = new Date(year, rule.month - 1, rule.day);
      const d = new Date(year, rule.month - 1, rule.day + ((rule.weekday - start.getDay() + 7) % 7));
      return { month: d.getMonth() + 1, day: d.getDate() };
    }
    default:
      return null;
  }
}

/** Parses "YYYY-MM-DD", "YYYY-MM-DDTHH:MM" (local) or an ISO string ending in Z (UTC instant). */
function parseStamp(text, cfg) {
  const str = String(text).trim();
  if (/Z$/i.test(str)) return { date: new Date(str), timed: true };
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const hasTime = m[4] !== undefined;
  const time = hasTime ? [Number(m[4]), Number(m[5]), Number(m[6] || 0)] : clock(cfg.time);
  return {
    date: make(Number(m[1]), Number(m[2]), Number(m[3]), time, hasTime ? false : cfg.utc),
    timed: hasTime || Boolean(cfg.time),
    utc: !hasTime && Boolean(cfg.utc)
  };
}

/** Local-time Date from an <input type="date"> or <input type="datetime-local"> value. */
function parseInputValue(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0), 0);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateInput(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toDateTimeInput(d) {
  return `${toDateInput(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10] || 'th'}`;
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Calendar difference between two dates as years, months and days. */
function ymdDiff(from, to) {
  let years = to.getFullYear() - from.getFullYear();
  let months = to.getMonth() - from.getMonth();
  let days = to.getDate() - from.getDate();
  if (days < 0) {
    months--;
    days += new Date(to.getFullYear(), to.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  return { years, months, days };
}

/**
 * The next occurrence of a fixed-date countdown, from `now`.
 * Returns { date, timed, label } or null if there is nothing left (a one-off that has passed).
 * A date-only event counts as "arrived" until the end of that day.
 */
export function nextOccurrence(cfg, now = new Date()) {
  const rule = cfg.rule || null;
  const candidates = [];
  const nowMs = now.getTime();

  // Times of day and weekdays: no dates involved.
  if (rule && (rule.type === 'daily' || rule.type === 'weekly')) {
    const time = clock(cfg.time || '00:00');
    for (let add = 0; add <= 8; add++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add, time[0], time[1], time[2]);
      const okDay = rule.type === 'daily' || d.getDay() === rule.weekday;
      if (okDay && d.getTime() > nowMs) return { date: d, timed: true, label: '' };
    }
    return null;
  }

  if (rule && rule.type === 'friday13') {
    for (let i = 0; i < 60; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 13);
      if (d.getDay() === 5 && dayEnd(d, false).getTime() > nowMs) return { date: d, timed: false, label: '' };
    }
    return null;
  }

  if (cfg.dates) {
    const entries = Array.isArray(cfg.dates)
      ? cfg.dates
      : Object.keys(cfg.dates).map(k => cfg.dates[k]);
    for (const entry of entries) {
      const text = typeof entry === 'string' ? entry : entry.date;
      const label = typeof entry === 'string' ? '' : (entry.label || '');
      const parsed = parseStamp(text, cfg);
      if (parsed) candidates.push({ ...parsed, label });
    }
  } else if (cfg.target_date && String(cfg.target_date).length > 5) {
    const parsed = parseStamp(cfg.target_date, cfg);
    if (parsed) candidates.push({ ...parsed, label: '' });
  } else {
    const time = clock(cfg.time);
    for (let year = now.getFullYear() - 1; year <= now.getFullYear() + 2; year++) {
      let md = rule ? ruleDate(rule, year) : null;
      if (!md) {
        const [month, day] = String(cfg.target_date || '12-25').split('-').map(Number);
        md = { month, day };
      }
      candidates.push({ date: make(year, md.month, md.day, time, cfg.utc), timed: Boolean(cfg.time), utc: Boolean(cfg.utc), label: '' });
    }
  }

  candidates.sort((a, b) => a.date - b.date);
  return candidates.find(c => (c.timed ? c.date : dayEnd(c.date, c.utc)).getTime() > nowMs) || null;
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

const CARD_STYLE = 'background: var(--input-bg, #f8f9fa); padding: 1rem; border-radius: 8px; border: 1px solid var(--border, #e2e8f0);';
const NUMBER_STYLE = 'display: block; font-size: 2rem; font-weight: bold; color: var(--accent, #2563eb);';
const UNIT_STYLE = 'font-size: 0.875rem; color: var(--text-muted, #64748b); text-transform: uppercase;';
const INPUT_STYLE = 'width: 100%; padding: 0.5rem; border: 1px solid var(--border, #ccc); border-radius: 4px; background: var(--input-bg, #fff); color: var(--text-main, inherit); font: inherit;';
const LABEL_STYLE = 'display: block; margin-bottom: 0.4rem; font-weight: 600;';

export default class CountdownWidget {
  constructor(container) {
    this.container = container;
    try {
      this.config = JSON.parse(container.dataset.config || '{}');
    } catch (e) {
      this.config = {};
    }
    this.mode = this.config.mode || 'fixed';
    this.storageKey = `cubit-countdown:${(typeof location !== 'undefined' && location.pathname) || ''}`;
    this.values = this.loadSaved();
    this.pregnancyLastEdited = 'due';
    this.timerId = null;
    this.init();
  }

  init() {
    this.applyDefaults();
    this.render();
    this.bindEvents();
    this.startCountdown();
  }

  // ---- saved inputs (personal modes) -------------------------------------

  loadSaved() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
      return saved && typeof saved === 'object' ? saved : {};
    } catch (e) {
      return {};
    }
  }

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.values));
    } catch (e) {
      // Storage can be blocked (private windows); the countdown still works.
    }
  }

  applyDefaults() {
    const cfg = this.config;
    if (this.mode === 'custom' && !this.values.when) {
      if (cfg.default_days !== undefined) {
        const d = new Date();
        d.setDate(d.getDate() + Number(cfg.default_days));
        const time = clock(cfg.default_time || '09:00');
        d.setHours(time[0], time[1], 0, 0);
        this.values.when = cfg.input === 'date' ? toDateInput(d) : toDateTimeInput(d);
      }
    }
    if (this.mode === 'retirement' && !this.values.age) {
      this.values.age = String(cfg.default_age || 66);
    }
    if (this.mode === 'time_of_day' && !this.values.time) {
      this.values.time = cfg.default_time || '17:00';
    }
  }

  // ---- rendering -----------------------------------------------------------

  controlsHtml() {
    const cfg = this.config;
    const v = this.values;
    const field = (id, label, type, value, extra = '') =>
      `<div class="form-group"><label for="${id}" style="${LABEL_STYLE}">${label}</label>` +
      `<input type="${type}" id="${id}" value="${value || ''}" ${extra} style="${INPUT_STYLE}" /></div>`;
    const wrap = inner =>
      `<div class="cd-controls" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; text-align: left;">${inner}</div>`;

    switch (this.mode) {
      case 'custom':
        return wrap(field('cd-when', cfg.label || 'Date and time', cfg.input === 'date' ? 'date' : 'datetime-local', v.when));
      case 'birthday':
        return wrap(field('cd-dob', cfg.label || 'Date of birth', 'date', v.dob));
      case 'retirement':
        return wrap(
          field('cd-dob', cfg.label || 'Date of birth', 'date', v.dob) +
          field('cd-age', 'Retirement age', 'number', v.age, 'min="30" max="90" step="1"')
        );
      case 'pregnancy':
        return wrap(
          field('cd-due', 'Due date', 'date', v.due) +
          field('cd-lmp', 'First day of last period', 'date', v.lmp)
        );
      case 'time_of_day':
        return wrap(field('cd-time', cfg.label || 'Countdown to', 'time', v.time));
      default:
        return '';
    }
  }

  render() {
    const card = (id, unit) => `
          <div class="countdown-card" style="${CARD_STYLE}">
            <span id="${id}" class="cd-num" style="${NUMBER_STYLE}">00</span>
            <span class="cd-unit" style="${UNIT_STYLE}">${unit}</span>
          </div>`;
    this.container.innerHTML = `
      <style>
        .countdown-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .countdown-grid .countdown-card { min-width: 0; }
        @media (max-width: 560px) { .countdown-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .cd-present-title, .cd-hint, .cd-exit { display: none; }
        .cd-fs-btn { margin-top: 1.25rem; padding: 0.55rem 1.1rem; border-radius: 6px; cursor: pointer; font: inherit; font-weight: 600;
          color: var(--text-main, inherit); background: var(--input-bg, #f8f9fa); border: 1px solid var(--border, #cbd5e1); }
        .cd-fs-btn:hover, .cd-fs-btn:focus-visible { border-color: var(--accent, #2563eb); color: var(--accent, #2563eb); }
        /* Presentation mode: fills the screen, big numbers, no controls. */
        .cd-stage.cd-presenting { position: fixed !important; inset: 0; z-index: 2147483000; margin: 0 !important; width: 100vw; height: 100vh;
          box-sizing: border-box; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; overflow: hidden;
          display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 3vh 3vw !important;
          background: var(--bg, #0b1220) !important; color: var(--text-main, #fff); }
        .cd-stage.cd-presenting .cd-controls, .cd-stage.cd-presenting .cd-fs-btn { display: none !important; }
        .cd-stage.cd-presenting .cd-present-title { display: block; margin: 0 0 4vh; font-size: min(5vw, 8vh); line-height: 1.15; font-weight: 700; }
        .cd-stage.cd-presenting .countdown-grid { width: min(96vw, 190vh); gap: min(2vw, 3vh) !important; margin-bottom: 4vh !important; }
        .cd-stage.cd-presenting .countdown-card { padding: min(2.5vw, 4vh) 0.5rem !important; border-radius: 1.2vw !important; }
        .cd-stage.cd-presenting .cd-num { font-size: min(11vw, 20vh) !important; line-height: 1.05; font-variant-numeric: tabular-nums; }
        .cd-stage.cd-presenting[data-digits="4"] .cd-num { font-size: min(7vw, 18vh) !important; }
        .cd-stage.cd-presenting[data-digits="5"] .cd-num { font-size: min(5.6vw, 16vh) !important; }
        .cd-stage.cd-presenting .cd-unit { font-size: min(2.2vw, 4vh) !important; letter-spacing: 0.08em; }
        .cd-stage.cd-presenting #cd-message { font-size: min(3.2vw, 5.5vh) !important; }
        .cd-stage.cd-presenting #cd-extra { font-size: min(2.2vw, 4vh) !important; margin-top: 1.5vh !important; }
        .cd-stage.cd-presenting .cd-hint { display: block; position: absolute; bottom: 2.5vh; left: 0; right: 0; font-size: min(1.8vw, 3vh);
          color: var(--text-muted, #94a3b8); animation: cd-fade 1s ease 4s forwards; pointer-events: none; }
        .cd-stage.cd-presenting .cd-exit { display: block; position: absolute; top: 2vh; right: 2vw; padding: 0.5rem 1rem; border-radius: 6px;
          cursor: pointer; font: inherit; color: var(--text-main, #fff); background: var(--input-bg, #1e293b); border: 1px solid var(--border, #475569); opacity: 0; transition: opacity 0.3s; }
        .cd-stage.cd-presenting:not(.cd-idle) .cd-exit { opacity: 0.9; }
        .cd-stage.cd-presenting.cd-idle { cursor: none; }
        @keyframes cd-fade { to { opacity: 0; } }
        @media (max-aspect-ratio: 1/1) {
          .cd-stage.cd-presenting .countdown-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); width: 94vw; }
          .cd-stage.cd-presenting .cd-num { font-size: min(20vw, 12vh) !important; }
          .cd-stage.cd-presenting[data-digits="4"] .cd-num { font-size: min(13vw, 12vh) !important; }
          .cd-stage.cd-presenting[data-digits="5"] .cd-num { font-size: min(10.5vw, 10vh) !important; }
          .cd-stage.cd-presenting .cd-unit { font-size: min(3.6vw, 2.4vh) !important; }
          .cd-stage.cd-presenting .cd-present-title { font-size: min(8vw, 5vh); }
          .cd-stage.cd-presenting #cd-message { font-size: min(5vw, 3vh) !important; }
          .cd-stage.cd-presenting #cd-extra { font-size: min(4vw, 2.4vh) !important; }
        }
      </style>
      <div class="tool-box cd-stage" style="text-align: center;">
        <h2 class="cd-present-title"></h2>
        ${this.controlsHtml()}
        <div class="countdown-grid" style="display: grid; gap: 1rem; margin-bottom: 1.5rem;">
          ${card('cd-days', 'Days')}${card('cd-hours', 'Hours')}${card('cd-mins', 'Minutes')}${card('cd-secs', 'Seconds')}
        </div>
        <p id="cd-message" style="margin: 0; font-weight: 500; color: var(--text-main, #475569);"></p>
        <p id="cd-extra" style="margin: 0.5rem 0 0; font-size: 0.925rem; color: var(--text-muted, #64748b);"></p>
        <button type="button" class="cd-fs-btn" aria-label="Show the countdown full screen">&#9974; Presentation mode</button>
        <button type="button" class="cd-exit">Exit (Esc)</button>
        <div class="cd-hint">Press Esc to exit presentation mode</div>
      </div>
    `;
  }

  bindEvents() {
    const $ = id => this.container.querySelector(id);
    this.bindPresentation();
    const onInput = (sel, handler) => {
      const el = $(sel);
      if (el) el.addEventListener('input', () => { handler(el.value); this.save(); this.tick(); });
    };

    onInput('#cd-when', value => { this.values.when = value; });
    onInput('#cd-dob', value => { this.values.dob = value; });
    onInput('#cd-age', value => { this.values.age = value; });
    onInput('#cd-time', value => { this.values.time = value; });

    // Pregnancy: whichever box was typed in last drives the other one (due date = last period + 280 days).
    onInput('#cd-due', value => {
      this.values.due = value;
      this.pregnancyLastEdited = 'due';
      const due = parseInputValue(value);
      this.values.lmp = due ? toDateInput(new Date(due.getFullYear(), due.getMonth(), due.getDate() - PREGNANCY_DAYS)) : '';
      const lmpEl = $('#cd-lmp');
      if (lmpEl) lmpEl.value = this.values.lmp;
    });
    onInput('#cd-lmp', value => {
      this.values.lmp = value;
      this.pregnancyLastEdited = 'lmp';
      const lmp = parseInputValue(value);
      this.values.due = lmp ? toDateInput(new Date(lmp.getFullYear(), lmp.getMonth(), lmp.getDate() + PREGNANCY_DAYS)) : '';
      const dueEl = $('#cd-due');
      if (dueEl) dueEl.value = this.values.due;
    });
  }

  // ---- presentation mode -------------------------------------------------

  bindPresentation() {
    this.stage = this.container.querySelector('.cd-stage');
    const open = this.container.querySelector('.cd-fs-btn');
    const close = this.container.querySelector('.cd-exit');
    if (!this.stage || !open) return;
    this.presenting = false;
    this.idleTimer = null;

    open.addEventListener('click', () => this.enterPresentation());
    close.addEventListener('click', () => this.exitPresentation());

    const onFullscreenChange = () => {
      const active = document.fullscreenElement || document.webkitFullscreenElement;
      if (active === this.stage) this.setPresenting(true);
      else if (this.presenting && !this.overlayOnly) this.setPresenting(false);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.presenting) this.exitPresentation();
    });
    // Keep the pointer hidden after a few seconds of stillness, so nothing distracts on a wall screen.
    this.stage.addEventListener('mousemove', () => {
      if (!this.presenting) return;
      this.stage.classList.remove('cd-idle');
      clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => this.stage.classList.add('cd-idle'), 3000);
    });
    // The screen wake lock is released when the tab is hidden; ask for it again on return.
    document.addEventListener('visibilitychange', () => {
      if (this.presenting && document.visibilityState === 'visible') this.keepAwake(true);
    });
  }

  enterPresentation() {
    const stage = this.stage;
    const request = stage.requestFullscreen || stage.webkitRequestFullscreen;
    this.overlayOnly = false;
    if (request) {
      try {
        const result = request.call(stage);
        // Fullscreen can be refused (e.g. inside an iframe); fall back to filling the browser window.
        if (result && typeof result.catch === 'function') result.catch(() => this.useOverlay());
        return;
      } catch (e) {
        // fall through to the overlay
      }
    }
    this.useOverlay();
  }

  useOverlay() {
    this.overlayOnly = true;   // phones that can't do element fullscreen: fill the window instead
    this.setPresenting(true);
  }

  exitPresentation() {
    const active = document.fullscreenElement || document.webkitFullscreenElement;
    if (active) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      try { exit.call(document); } catch (e) { /* ignore */ }
    }
    this.setPresenting(false);
  }

  setPresenting(on) {
    if (this.presenting === on) return;
    this.presenting = on;
    const title = this.container.querySelector('.cd-present-title');
    if (on && title) {
      const h1 = typeof document !== 'undefined' ? document.querySelector('h1') : null;
      title.textContent = this.config.presentation_title || (h1 ? h1.textContent : '');
    }
    this.stage.classList.toggle('cd-presenting', on);
    this.stage.classList.remove('cd-idle');
    clearTimeout(this.idleTimer);
    if (on) this.idleTimer = setTimeout(() => this.stage.classList.add('cd-idle'), 4000);
    this.keepAwake(on);
    if (!on) this.overlayOnly = false;
  }

  /** Ask the device not to dim or sleep while the countdown is on show. Quietly ignored where unsupported. */
  async keepAwake(on) {
    try {
      if (!('wakeLock' in navigator)) return;
      if (on) {
        if (!this.wakeLock) {
          this.wakeLock = await navigator.wakeLock.request('screen');
          this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
        }
      } else if (this.wakeLock) {
        await this.wakeLock.release();
        this.wakeLock = null;
      }
    } catch (e) {
      this.wakeLock = null;
    }
  }

  // ---- what are we counting down to? --------------------------------------

  /** Returns { date, timed, label, prompt, done } for the current mode. `date` may be null. */
  resolveTarget(now) {
    const cfg = this.config;
    const v = this.values;

    switch (this.mode) {
      case 'custom': {
        const date = parseInputValue(v.when);
        return date
          ? { date, timed: cfg.input !== 'date', label: '' }
          : { date: null, prompt: 'Choose a date to start the countdown.' };
      }
      case 'birthday': {
        // Also used for anniversaries ("anniversary": true), which may start in the future.
        const dob = parseInputValue(v.dob);
        if (!dob) return { date: null, prompt: cfg.prompt || 'Enter your date of birth to count down to your next birthday.' };
        if (dob > now) {
          if (cfg.anniversary) return { date: dob, timed: false, label: '', turning: 0 };
          return { date: null, prompt: 'That date of birth is in the future - please check it.' };
        }
        // 29 February birthdays are celebrated on 1 March in years without a leap day.
        const on = year => new Date(year, dob.getMonth(), dob.getDate());
        let year = now.getFullYear();
        let date = on(year);
        if (dayEnd(date, false).getTime() <= now.getTime()) {
          year += 1;
          date = on(year);
        }
        return { date, timed: false, label: '', turning: year - dob.getFullYear() };
      }
      case 'retirement': {
        const dob = parseInputValue(v.dob);
        const age = parseInt(v.age, 10);
        if (!dob || !(age >= 30 && age <= 90)) return { date: null, prompt: cfg.prompt || 'Enter your date of birth and retirement age.' };
        return { date: new Date(dob.getFullYear() + age, dob.getMonth(), dob.getDate()), timed: false, label: '', retirementAge: age };
      }
      case 'pregnancy': {
        const due = parseInputValue(v.due);
        if (!due) return { date: null, prompt: 'Enter your due date, or the first day of your last period, to start the countdown.' };
        return { date: due, timed: false, label: '', pregnancy: true };
      }
      case 'time_of_day': {
        const time = clock(v.time);
        if (!v.time) return { date: null, prompt: cfg.prompt || 'Choose a time to count down to.' };
        for (let add = 0; add <= 1; add++) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add, time[0], time[1], 0);
          if (d.getTime() > now.getTime()) return { date: d, timed: true, label: '' };
        }
        return { date: null, prompt: 'Choose a time to count down to.' };
      }
      default: {
        const next = nextOccurrence(cfg, now);
        return next ? { ...next } : { date: null, ended: true };
      }
    }
  }

  // ---- ticking --------------------------------------------------------------

  formatTarget(target) {
    const day = target.date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const time = target.timed ? ` at ${target.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';
    return `${target.label ? `${target.label}: ` : 'Target: '}${day}${time}`;
  }

  /** Short "how long is that really" line under the timer. */
  extraText(now, target, diff) {
    const parts = [];
    const totalDays = Math.floor(diff / DAY_MS);

    if (totalDays >= 365) {
      const { years, months, days } = ymdDiff(now, target.date);
      const bits = [plural(years, 'year')];
      if (months) bits.push(plural(months, 'month'));
      if (days) bits.push(plural(days, 'day'));
      parts.push(`That's ${bits.join(', ')} to go.`);
    } else if (totalDays >= WEEK_DAYS) {
      const weeks = Math.floor(totalDays / WEEK_DAYS);
      const days = totalDays % WEEK_DAYS;
      parts.push(`That's ${plural(weeks, 'week')}${days ? ` and ${plural(days, 'day')}` : ''} to go.`);
    }

    if (this.config.show_sleeps) {
      parts.push(`${plural(Math.ceil(diff / DAY_MS), 'sleep')} to go!`);
    }
    if (target.turning) {
      parts.push(this.config.anniversary
        ? `It will be your ${ordinal(target.turning)} anniversary.`
        : `You'll be turning ${target.turning}.`);
    }
    if (target.retirementAge) parts.push(`Retirement at ${target.retirementAge}: ${target.date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}.`);

    if (target.pregnancy) {
      const lmp = parseInputValue(this.values.lmp);
      if (lmp) {
        const gestation = Math.floor((now.getTime() - lmp.getTime()) / DAY_MS);
        if (gestation >= 0 && gestation <= PREGNANCY_DAYS + 14) {
          parts.push(`You are ${plural(Math.floor(gestation / 7), 'week')} and ${plural(gestation % 7, 'day')} pregnant.`);
        }
      }
    }
    return parts.join(' ');
  }

  tick() {
    const daysEl = this.container.querySelector('#cd-days');
    if (!daysEl) return;
    const hoursEl = this.container.querySelector('#cd-hours');
    const minsEl = this.container.querySelector('#cd-mins');
    const secsEl = this.container.querySelector('#cd-secs');
    const msgEl = this.container.querySelector('#cd-message');
    const extraEl = this.container.querySelector('#cd-extra');

    const now = new Date();
    const target = this.resolveTarget(now);
    const zero = (message) => {
      daysEl.innerText = hoursEl.innerText = minsEl.innerText = secsEl.innerText = '00';
      msgEl.innerText = message;
      extraEl.innerText = '';
    };

    if (!target.date) {
      zero(target.ended ? (this.config.ended_message || this.config.arrival_message || 'This event has passed.') : (target.prompt || ''));
      return;
    }

    const diff = target.date.getTime() - now.getTime();
    if (diff <= 0) {
      zero(this.config.arrival_message || 'The countdown is over!');
      return;
    }

    const days = Math.floor(diff / DAY_MS);
    const hours = Math.floor((diff % DAY_MS) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    daysEl.innerText = pad2(days);
    if (this.stage) this.stage.dataset.digits = String(Math.max(2, Math.min(5, daysEl.innerText.length)));
    hoursEl.innerText = pad2(hours);
    minsEl.innerText = pad2(minutes);
    secsEl.innerText = pad2(seconds);
    msgEl.innerText = this.formatTarget(target);
    extraEl.innerText = this.extraText(now, target, diff);
  }

  startCountdown() {
    if (this.timerId) clearInterval(this.timerId);
    this.tick();
    this.timerId = setInterval(() => this.tick(), 1000);
  }
}