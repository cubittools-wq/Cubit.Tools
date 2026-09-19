// js/widgets/password_gen.js
//
// Passphrase generator widget.
//
// - Randomness comes from crypto.getRandomValues (never Math.random), with rejection
//   sampling so every pick is uniform.
// - Pages tagged "topic": "football" (or with an explicit "shared_pool" in Config_JSON) get a
//   large shared word pool from js/pools/<name>.js. Each passphrase always contains one
//   club-specific word from the page's Data_List; the remaining words come from the shared pool.
// - The strength shown to the user is a conservative estimate that assumes an attacker knows
//   the word lists, the separator and the number/symbol pattern.

const DEFAULT_WORD_COUNT = 4;
const MIN_WORDS = 3;
const MAX_WORDS = 8;
const SYMBOLS = ['!', '@', '#', '$', '%', '&', '*'];
const FALLBACK_WORDS = ['apple', 'river', 'stove', 'cloud', 'timber', 'beacon', 'shadow', 'magnet'];

// Topic -> shared pool file name (js/pools/<name>.js). Add more topics here as pools are written.
const POOLS_BY_TOPIC = {
  football: 'football'
};

/** Uniform random integer in [0, max) using crypto.getRandomValues (rejection sampling, no modulo bias). */
function randomInt(max) {
  if (!Number.isInteger(max) || max <= 1) return 0;
  const RANGE = 0x100000000; // 2^32
  const limit = RANGE - (RANGE % max);
  const buf = new Uint32Array(1);
  let x;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % max;
}

/** Fisher-Yates shuffle (in place) using randomInt. */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Pick `count` distinct items from `list` (or allow repeats if the list is too small). */
function pickDistinct(list, count) {
  if (list.length === 0) return [];
  if (list.length < count) {
    return Array.from({ length: count }, () => list[randomInt(list.length)]);
  }
  const copy = list.slice();
  const picked = [];
  for (let i = 0; i < count; i++) {
    const idx = randomInt(copy.length);
    picked.push(copy[idx]);
    copy[idx] = copy[copy.length - 1];
    copy.pop();
  }
  return picked;
}

/** log2 of the number of ordered ways to pick `count` distinct items from a list of size `n`. */
function bitsDistinct(n, count) {
  if (n <= 0) return 0;
  if (n < count) return count * Math.log2(n); // repeats allowed for tiny lists
  let bits = 0;
  for (let i = 0; i < count; i++) bits += Math.log2(n - i);
  return bits;
}

function strengthLabel(bits) {
  if (bits < 40) return 'Weak';
  if (bits < 60) return 'Fair';
  if (bits < 80) return 'Strong';
  return 'Very strong';
}

export default class PasswordGenWidget {
  constructor(container) {
    this.container = container;

    // Parse config and data list safely from DOM attributes injected by the page
    try {
      this.config = JSON.parse(container.dataset.config || '{}');
    } catch (e) {
      this.config = {};
    }

    // De-duplicated (case-insensitive) so the strength estimate is never inflated by repeats.
    const seen = new Set();
    this.clubWords = (container.dataset.list || '')
      .split(',')
      .map(w => w.trim())
      .filter(w => {
        const key = w.toLowerCase();
        if (!w || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    // Fallback word list if the sheet / JSON data_list is empty
    if (this.clubWords.length === 0) {
      this.clubWords = FALLBACK_WORDS.slice();
    }

    this.sharedPool = [];

    // Sheet rows may still say word_count: 3; never go below the default.
    const requested = parseInt(this.config.word_count, 10) || 0;
    this.defaultWordCount = Math.min(MAX_WORDS, Math.max(requested, DEFAULT_WORD_COUNT));

    this.init();
  }

  async init() {
    this.render();
    this.bindEvents();
    await this.loadSharedPool();
    this.generate();
  }

  /** Load js/pools/<name>.js relative to this module, based on config.shared_pool or config.topic. */
  async loadSharedPool() {
    if (this.config.shared_pool === false) return;
    const name = this.config.shared_pool || POOLS_BY_TOPIC[this.config.topic];
    if (!name || !/^[a-z0-9_-]+$/.test(name)) return;

    try {
      const mod = await import(new URL(`../pools/${name}.js`, import.meta.url).href);
      const clubSet = new Set(this.clubWords.map(w => w.toLowerCase()));
      // Keep club words and pool words disjoint so a passphrase never repeats a word.
      this.sharedPool = (mod.default || []).filter(w => !clubSet.has(String(w).toLowerCase()));
    } catch (err) {
      console.warn(`Could not load shared word pool "${name}":`, err);
      this.sharedPool = [];
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="tool-box">
        <div class="input-group">
          <textarea id="password-output" rows="1" readonly placeholder="Generating..." aria-label="Generated passphrase" style="resize: none; overflow: hidden; line-height: 1.4; overflow-wrap: anywhere;"></textarea>
          <button id="copy-btn" class="btn-secondary" type="button">Copy</button>
        </div>

        <div class="slider-group">
          <label for="word-count-slider">
            Number of Words: <strong id="word-count-val">${this.defaultWordCount}</strong>
          </label>
          <input type="range" id="word-count-slider" min="${MIN_WORDS}" max="${MAX_WORDS}" value="${this.defaultWordCount}" step="1" />
        </div>

        <div class="checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" id="include-numbers" checked />
            <span>Include Numbers (e.g., -42)</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="include-symbols" checked />
            <span>Include Symbols (e.g., !)</span>
          </label>
        </div>

        <button id="generate-btn" class="btn-primary" type="button">Generate New Passphrase</button>

        <p id="strength-info" aria-live="polite" style="margin-top: 1rem; font-size: 0.875rem; color: var(--text-muted);"></p>
      </div>
    `;
  }

  /** Choose the words for one passphrase. */
  pickWords(wordCount) {
    let words;
    if (this.sharedPool.length > 0) {
      // Always exactly one club word, the rest from the shared pool.
      words = [
        ...pickDistinct(this.clubWords, 1),
        ...pickDistinct(this.sharedPool, wordCount - 1)
      ];
      shuffle(words);
    } else {
      words = pickDistinct(this.clubWords, wordCount);
    }
    return words;
  }

  /** Conservative entropy estimate (bits) for the current settings. Ignores word order and capitalisation. */
  estimateBits(wordCount, includeNumbers, includeSymbols) {
    let bits;
    if (this.sharedPool.length > 0) {
      bits = Math.log2(this.clubWords.length) + bitsDistinct(this.sharedPool.length, wordCount - 1);
    } else {
      bits = bitsDistinct(this.clubWords.length, wordCount);
    }
    if (includeNumbers) bits += Math.log2(90);
    if (includeSymbols) bits += Math.log2(SYMBOLS.length);
    return bits;
  }

  generate() {
    const outputEl = this.container.querySelector('#password-output');
    const slider = this.container.querySelector('#word-count-slider');
    const numCheck = this.container.querySelector('#include-numbers');
    const symCheck = this.container.querySelector('#include-symbols');
    const strengthEl = this.container.querySelector('#strength-info');

    if (!outputEl) return;

    const wordCount = slider ? parseInt(slider.value, 10) : this.defaultWordCount;
    const includeNumbers = numCheck ? numCheck.checked : true;
    const includeSymbols = symCheck ? symCheck.checked : true;
    const separator = this.config.separator || '-';
    const capitalize = this.config.capitalize !== false;

    const selectedWords = this.pickWords(wordCount).map(word => {
      if (!capitalize) return word;
      // Formats multi-word or hyphenated chunks nicely (e.g., "camp-nou" -> "Camp-Nou")
      return word.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('-');
    });

    let passphrase = selectedWords.join(separator);

    if (includeNumbers) {
      passphrase += `${separator}${randomInt(90) + 10}`;
    }

    if (includeSymbols) {
      passphrase += SYMBOLS[randomInt(SYMBOLS.length)];
    }

    outputEl.value = passphrase;
    // Longer passphrases wrap onto extra lines instead of being clipped (the symbol sits at the end).
    outputEl.style.height = 'auto';
    // (offsetHeight - clientHeight) is the border, which box-sizing: border-box adds back in.
    outputEl.style.height = `${outputEl.scrollHeight + outputEl.offsetHeight - outputEl.clientHeight}px`;

    if (strengthEl) {
      const bits = this.estimateBits(wordCount, includeNumbers, includeSymbols);
      const label = strengthLabel(bits);
      const tip = bits < 60 ? ' Add a word to make it stronger.' : '';
      strengthEl.innerHTML =
        `Estimated strength: <strong>${label}</strong> (about ${Math.round(bits)} bits).${tip} ` +
        `This assumes an attacker knows our word list, so for important accounts use a password manager.`;
    }
  }

  bindEvents() {
    const slider = this.container.querySelector('#word-count-slider');
    const sliderValDisplay = this.container.querySelector('#word-count-val');
    const numCheck = this.container.querySelector('#include-numbers');
    const symCheck = this.container.querySelector('#include-symbols');
    const regenBtn = this.container.querySelector('#generate-btn');
    const copyBtn = this.container.querySelector('#copy-btn');
    const outputEl = this.container.querySelector('#password-output');

    slider.addEventListener('input', (e) => {
      sliderValDisplay.innerText = e.target.value;
      this.generate();
    });

    numCheck.addEventListener('change', () => this.generate());
    symCheck.addEventListener('change', () => this.generate());
    regenBtn.addEventListener('click', () => this.generate());

    copyBtn.addEventListener('click', async () => {
      if (!outputEl || !outputEl.value) return;
      try {
        await navigator.clipboard.writeText(outputEl.value);
        copyBtn.innerText = 'Copied!';
      } catch (err) {
        // Clipboard API can be blocked (permissions / insecure context); fall back to selection.
        outputEl.select();
        copyBtn.innerText = 'Press Ctrl+C';
      }
      setTimeout(() => { copyBtn.innerText = 'Copy'; }, 2000);
    });
  }
}
