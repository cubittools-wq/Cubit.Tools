let currentWordList = [];

// 1. Fetch JSON and Populate Page Content based on URL Slug
async function initPage() {
  // Extract trailing folder name safely
  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  const currentSegment = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : '';

  try {
    // Relative path fix for subfolder navigation
    const depth = pathSegments.length;
    const relativePrefix = depth > 1 ? '../'.repeat(depth - 1) : './';

    const response = await fetch(`${relativePrefix}data/passwords.json`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    
    // Match slug in JSON (supports exact slug or partial directory name matching)
    const pageData = data.find(item => 
      item.Slug === currentSegment || 
      item.Slug.includes(currentSegment) ||
      currentSegment.includes(item.Slug)
    ) || data[0]; // Fallback to first item for testing if match fails

    if (pageData) {
      if (document.getElementById('meta-title')) document.getElementById('meta-title').innerText = pageData.Meta_Title;
      if (document.getElementById('meta-desc')) document.getElementById('meta-desc').setAttribute('content', pageData.Meta_Desc);
      if (document.getElementById('page-h1')) document.getElementById('page-h1').innerText = pageData.H1_Title;
      if (document.getElementById('page-intro')) document.getElementById('page-intro').innerText = pageData.Intro_Text;
      if (document.getElementById('seo-body')) document.getElementById('seo-body').innerText = pageData.SEO_Body;

      if (pageData.Word_List) {
        currentWordList = pageData.Word_List.split(',').map(w => w.trim());
      }

      renderToolUI();
      generatePassword();
    }
  } catch (err) {
    console.error('Error loading JSON data:', err);
  }
}

// 2. Inject Dynamic Tool UI into the Template
function renderToolUI() {
  const container = document.getElementById('tool-container');
  if (!container) return;

  container.innerHTML = `
    <div style="display: flex; gap: 10px; margin-bottom: 20px;">
      <div id="password-output" style="flex: 1; background: #0f172a; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 1.2rem; word-break: break-all; border: 1px solid #334155;">Generating...</div>
      <button id="copy-btn" style="background: #38bdf8; color: #0f172a; border: none; padding: 12px 20px; border-radius: 6px; font-weight: bold; cursor: pointer;">Copy</button>
    </div>

    <div style="display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <label for="length-slider">Length: <span id="length-val">16</span></label>
        <input type="range" id="length-slider" min="8" max="32" value="16">
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <label for="inc-numbers">Include Numbers</label>
        <input type="checkbox" id="inc-numbers" checked>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <label for="inc-symbols">Include Symbols</label>
        <input type="checkbox" id="inc-symbols" checked>
      </div>
      <button id="generate-btn" style="background: #38bdf8; color: #0f172a; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 10px;">Generate Password</button>
    </div>
  `;

  document.getElementById('length-slider').addEventListener('input', (e) => {
    document.getElementById('length-val').innerText = e.target.value;
  });

  document.getElementById('generate-btn').addEventListener('click', generatePassword);

  document.getElementById('copy-btn').addEventListener('click', () => {
    const text = document.getElementById('password-output').innerText;
    navigator.clipboard.writeText(text);
    const btn = document.getElementById('copy-btn');
    btn.innerText = 'Copied!';
    setTimeout(() => btn.innerText = 'Copy', 1500);
  });
}

// 3. Password Generation Logic
function generatePassword() {
  const lengthSlider = document.getElementById('length-slider');
  if (!lengthSlider) return;

  const length = parseInt(lengthSlider.value);
  const useNumbers = document.getElementById('inc-numbers').checked;
  const useSymbols = document.getElementById('inc-symbols').checked;

  let base = '';
  let reservedLength = 0;
  if (useNumbers) reservedLength += 2;
  if (useSymbols) reservedLength += 1;

  const maxWordSpace = length - reservedLength;

  if (currentWordList.length > 0) {
    const shuffledWords = [...currentWordList].sort(() => 0.5 - Math.random());

    for (const word of shuffledWords) {
      const separator = base.length > 0 ? '-' : '';
      if ((base + separator + word).length <= maxWordSpace) {
        base += separator + word;
      }
    }
  }

  if (base.length === 0) base = 'pass';

  if (useNumbers) base += Math.floor(Math.random() * 89 + 10);
  if (useSymbols) {
    const symbols = '!@#$%^&*';
    base += symbols[Math.floor(Math.random() * symbols.length)];
  }

  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  while (base.length < length) {
    base += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  document.getElementById('password-output').innerText = base;
}

document.addEventListener('DOMContentLoaded', initPage);