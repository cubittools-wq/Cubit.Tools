// js/widgets/password_gen.js

export default class PasswordGenWidget {
  constructor(container) {
    this.container = container;
    
    // Parse config and data list safely from DOM attributes injected by Python
    try {
      this.config = JSON.parse(container.dataset.config || '{}');
    } catch (e) {
      this.config = {};
    }

    this.wordList = (container.dataset.list || '')
      .split(',')
      .map(w => w.trim())
      .filter(Boolean);

    // Fallback word list if GSheet/JSON data_list is empty
    if (this.wordList.length === 0) {
      this.wordList = ['apple', 'river', 'stove', 'cloud', 'timber', 'beacon', 'shadow', 'magnet'];
    }

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
    this.generate();
  }

  render() {
    const defaultWordCount = this.config.word_count || 3;

    this.container.innerHTML = `
      <div class="tool-box">
        <div class="input-group">
          <input type="text" id="password-output" readonly placeholder="Generating..." />
          <button id="copy-btn" class="btn-secondary" type="button">Copy</button>
        </div>

        <div class="slider-group">
          <label for="word-count-slider">
            Number of Words: <strong id="word-count-val">${defaultWordCount}</strong>
          </label>
          <input type="range" id="word-count-slider" min="2" max="6" value="${defaultWordCount}" step="1" />
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

  generate() {
    const outputEl = this.container.querySelector('#password-output');
    const slider = this.container.querySelector('#word-count-slider');
    const numCheck = this.container.querySelector('#include-numbers');
    const symCheck = this.container.querySelector('#include-symbols');

    if (!outputEl) return;

    const wordCount = slider ? parseInt(slider.value, 10) : 3;
    const includeNumbers = numCheck ? numCheck.checked : true;
    const includeSymbols = symCheck ? symCheck.checked : true;
    const separator = this.config.separator || '-';
    const capitalize = this.config.capitalize !== false;

    const selectedWords = [];
    for (let i = 0; i < wordCount; i++) {
      let word = this.wordList[Math.floor(Math.random() * this.wordList.length)];
      
      if (capitalize) {
        // Formats multi-word or hyphenated chunks nicely (e.g., "Karma-Police" -> "Karma-Police")
        word = word.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('-');
      }
      selectedWords.push(word);
    }

    let passphrase = selectedWords.join(separator);

    if (includeNumbers) {
      passphrase += `${separator}${Math.floor(Math.random() * 90) + 10}`;
    }

    if (includeSymbols) {
      const symbols = ['!', '@', '#', '$', '%', '&', '*'];
      passphrase += symbols[Math.floor(Math.random() * symbols.length)];
    }

    outputEl.value = passphrase;
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

    copyBtn.addEventListener('click', () => {
      if (outputEl && outputEl.value) {
        navigator.clipboard.writeText(outputEl.value);
        copyBtn.innerText = 'Copied!';
        setTimeout(() => { copyBtn.innerText = 'Copy'; }, 2000);
      }
    });
  }
}