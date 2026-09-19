// js/widgets/password_gen.js
//
// Passphrase generator widget.
//
// - Randomness comes from crypto.getRandomValues (never Math.random), with rejection
//   sampling so every pick is uniform.
// - Pages tagged "topic": "football" (or with an explicit "shared_pool" in Config_JSON) also get a
//   pool of generic football words from js/pools/<name>.js. About half of every passphrase comes
//   from the club's own Data_List (nicknames, ground, players, managers, chants...), so it reads as
//   that club, and the rest comes from the generic pool so the result stays varied.
// - Multi-part words (e.g. "marcelo-bielsa") are joined in CamelCase ("MarceloBielsa") so that
//   the separator only ever sits between whole words, and the slider count matches what you see.
// - Long entries (e.g. whole lyric lines) would make very long passphrases, so any entry of more
//   than MAX_WORDS_PER_ENTRY words is shortened to one word taken from it. Each pick is still one
//   random entry from the Data_List, so the number of possible passphrases is unchanged.

const DEFAULT_WORD_COUNT = 4;
const MIN_WORDS = 3;
const MAX_WORDS = 8;
// Below this many distinctive club words we use the whole list.
const MIN_PREFERRED_CLUB_WORDS = 20;
const SYMBOLS = ['!', '@', '#', '$', '%', '&', '*'];
const FALLBACK_WORDS = ['apple', 'river', 'stove', 'cloud', 'timber', 'beacon', 'shadow', 'magnet'];

// Entries with more words than this (lyric lines, chants) are shortened to a single word.
const MAX_WORDS_PER_ENTRY = 3;

// Words that make poor "keywords" when a long line is shortened.
const STOP_WORDS = new Set((
  'about above after again against all also always among and any are because been before being between both ' +
  'but can come could does done down each else even ever every for from get gets gone got had has have here ' +
  'her hers him his how into its just keep know like made make many may might more most much must never not ' +
  'now off once one only onto other our out over own really same she should since some than that the their ' +
  'them then there these they this those through too under until upon very want was were what when where ' +
  'which while who whom whose why will with without would yes you your yours ' +
  'dont im youre thats its ive ill wont cant theyre weve hes shes whats wheres whos theyd id youve couldnt ' +
  'isnt didnt doesnt wasnt werent wouldnt shouldnt havent hasnt arent gonna wanna gotta ' +
  'a am an as at be by do go he i if in is it me my no of on or so to up us we ' +
  'look take back next side call need said feel went comes stay tell mean means still think'
).split(' '));

// Rude words are never used as a keyword, and short entries containing them are left out.
const PROFANE = /fuck|shit|cunt|bitch|wank|twat|bollock/;

/** Removes apostrophes ("don't" -> "dont") so passphrases are easy to type on any site. */
function stripApostrophes(text) {
  return text.replace(/['\u2019`]/g, '');
}

function capitalise(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** One random meaningful word from a long entry, e.g. "there-are-doors-that-open-by-themselves" -> "doors". */
function keywordFromEntry(entry) {
  const words = entry.split('-').map(stripApostrophes).filter(Boolean);
  const usable = words.filter(w => !PROFANE.test(w.toLowerCase()) && !/^\d+$/.test(w));
  const meaningful = usable.filter(w => !STOP_WORDS.has(w.toLowerCase()));
  // Prefer longer, more distinctive words (5+ letters), then 4+, then whatever is left.
  for (const minLength of [5, 4]) {
    const candidates = meaningful.filter(w => w.length >= minLength);
    if (candidates.length > 0) return candidates[randomInt(candidates.length)];
  }
  const fallback = meaningful.length > 0 ? meaningful : usable;
  if (fallback.length === 0) return words[0] || entry;
  return fallback.reduce((a, b) => (b.length > a.length ? b : a));
}

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

/** Fixes a doubled final name in a word, e.g. "ben-alnwick-alnwick" -> "ben-alnwick". */
function tidyWord(word) {
  const parts = word.split('-');
  const n = parts.length;
  if (n >= 3 && parts[n - 1] && parts[n - 1] === parts[n - 2]) parts.pop();
  return parts.join('-');
}

/** Words that don't count as "the same name" when checking two club words for overlap. */
const NAME_FILLER = new Set(['the', 'of', 'and', 'on', 'de', 'di', 'da', 'del', 'van', 'von', 'le', 'la', 'el', 'al']);

/** Lower-case parts of a word, e.g. "marcelo-bielsa" -> ["marcelo", "bielsa"] (filler words removed). */
function nameParts(word) {
  return word.toLowerCase().split('-').filter(p => p && !NAME_FILLER.has(p));
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

    // De-duplicated (case-insensitive) so a word never appears twice in the list.
    const seen = new Set();
    this.clubWords = (container.dataset.list || '')
      .split(',')
      .map(w => tidyWord(w.trim()))
      .filter(w => !(PROFANE.test(w.toLowerCase()) && w.split('-').length <= MAX_WORDS_PER_ENTRY))
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
    this.preferredClubWords = this.clubWords;

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

      // Club lists include bare first names ("ian", "dean") and some very long chants. They pad out the
      // list but say little about the club, so prefer everything else and only fall back to them
      // when a club has hardly any other words.
      let firstNames = new Set();
      try {
        const names = await import(new URL('../pools/first_names.js', import.meta.url).href);
        firstNames = new Set((names.default || []).map(w => String(w).toLowerCase()));
      } catch (err) {
        // Optional file: without it, bare first names are treated like any other club word.
      }
      const preferred = this.clubWords.filter(w => !firstNames.has(w.toLowerCase()) && w.split('-').length <= 3);
      if (preferred.length >= MIN_PREFERRED_CLUB_WORDS) this.preferredClubWords = preferred;
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
      </div>
    `;
  }

  /**
   * Pick up to `count` distinct words from the Data_List. When `avoidSharedNames` is set (football
   * pages), words that share a name are never picked together, so a passphrase never contains both
   * "billy-bremner" and "bremner" (or "gary" and "gary-speed").
   */
  pickClubWords(count, avoidSharedNames) {
    const chosen = [];
    const usedParts = new Set();
    // Distinctive words first; the rest of the list only if those run out.
    const groups = [this.preferredClubWords, this.clubWords];
    for (const group of groups) {
      const candidates = group.filter(w => !chosen.includes(w));
      while (chosen.length < count && candidates.length > 0) {
        const idx = randomInt(candidates.length);
        const word = candidates[idx];
        candidates[idx] = candidates[candidates.length - 1];
        candidates.pop();
        const parts = nameParts(word);
        if (avoidSharedNames && parts.some(p => usedParts.has(p))) continue;
        chosen.push(word);
        parts.forEach(p => usedParts.add(p));
      }
      if (chosen.length >= count || group === this.clubWords) break;
    }
    return chosen;
  }

  /** Choose the words for one passphrase. */
  pickWords(wordCount) {
    const hasPool = this.sharedPool.length > 0;
    // With a generic pool: half the words (rounded up) are club words. Without one: all of them.
    const clubTarget = hasPool ? Math.ceil(wordCount / 2) : wordCount;

    const words = this.pickClubWords(clubTarget, hasPool);

    // Without a generic pool there's nothing else to draw on, so a tiny club list has to repeat words.
    if (!hasPool && words.length < clubTarget) {
      const spare = this.clubWords.filter(w => !words.includes(w));
      words.push(...pickDistinct(spare.length ? spare : this.clubWords, clubTarget - words.length));
    }

    if (hasPool) {
      words.push(...pickDistinct(this.sharedPool, wordCount - words.length));
    }
    return shuffle(words);
  }

  /** Turns a Data_List entry into the text used in the passphrase. */
  displayWord(entry, capitalize) {
    const parts = entry.split('-').map(stripApostrophes).filter(Boolean);
    if (parts.length > MAX_WORDS_PER_ENTRY) {
      const keyword = keywordFromEntry(entry);
      return capitalize ? capitalise(keyword) : keyword;
    }
    // Multi-part words are joined without hyphens (e.g. "marcelo-bielsa" -> "MarceloBielsa")
    return capitalize ? parts.map(capitalise).join('') : parts.join('-');
  }

  generate() {
    const outputEl = this.container.querySelector('#password-output');
    const slider = this.container.querySelector('#word-count-slider');
    const numCheck = this.container.querySelector('#include-numbers');
    const symCheck = this.container.querySelector('#include-symbols');

    if (!outputEl) return;

    const wordCount = slider ? parseInt(slider.value, 10) : this.defaultWordCount;
    const includeNumbers = numCheck ? numCheck.checked : true;
    const includeSymbols = symCheck ? symCheck.checked : true;
    const separator = this.config.separator || '-';
    const capitalize = this.config.capitalize !== false;

    // Shortened lyric lines can occasionally give the same keyword twice; try again if so.
    let selectedWords = [];
    for (let attempt = 0; attempt < 10; attempt++) {
      selectedWords = this.pickWords(wordCount).map(word => this.displayWord(word, capitalize));
      const lower = selectedWords.map(w => w.toLowerCase());
      if (new Set(lower).size === lower.length) break;
    }

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