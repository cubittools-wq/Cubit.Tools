let currentWordList = [];

/**
 * 1. Folder Depth & Relative Path Helpers
 */
function getRelativePrefix() {
  const path = window.location.pathname;
  const cleanPath = path.replace(/^\/Cubit\.Tools/, '');
  const segments = cleanPath.split('/').filter(Boolean);
  return segments.length > 0 ? '../'.repeat(segments.length) : './';
}

/**
 * 2. Fetch Header, Footer, and Hierarchical Navigation
 */
async function loadComponents() {
  const prefix = getRelativePrefix();

  try {
    const [headerRes, footerRes, navRes] = await Promise.all([
      fetch(`${prefix}components/header.html`),
      fetch(`${prefix}components/footer.html`),
      fetch(`${prefix}data/nav.json`)
    ]);

    if (headerRes.ok && document.getElementById('site-header')) {
      document.getElementById('site-header').innerHTML = await headerRes.text();
      
      if (navRes.ok) {
        const navTree = await navRes.json();
        renderTopLevelNav(navTree);
      }
    }
    
    if (footerRes.ok && document.getElementById('site-footer')) {
      document.getElementById('site-footer').innerHTML = await footerRes.text();
    }
  } catch (err) {
    console.error('Error loading global components:', err);
  }
}

/**
 * Render Header Nav (Shows Top-Level Categories as Dropdowns)
 */
function renderTopLevelNav(navTree) {
  const navUl = document.getElementById('main-nav-links');
  if (!navUl) return;

  const topCategories = Object.keys(navTree);

  navUl.innerHTML = topCategories.map(cat => {
    const rootItems = navTree[cat]._items || [];
    const subCategories = navTree[cat]._sub || {};
    const subKeys = Object.keys(subCategories);

    let dropHTML = '';

    // If there are subcategories OR direct items, build a dropdown menu
    if (subKeys.length > 0 || rootItems.length > 0) {
      let itemsListHTML = '';

      // Render direct items if present (e.g. Category_Path = "General")
      if (rootItems.length > 0) {
        itemsListHTML += `
          <li class="nav-subgroup">
            <ul>
              ${rootItems.map(item => `<li><a href="${item.url}">${item.title}</a></li>`).join('')}
            </ul>
          </li>
        `;
      }

      // Render subcategory items if present (e.g. Category_Path = "Sports/Football")
      if (subKeys.length > 0) {
        itemsListHTML += subKeys.map(sub => `
          <li class="nav-subgroup">
            <span class="subgroup-title">${sub}</span>
            <ul>
              ${(subCategories[sub]._items || []).map(item => `
                <li><a href="${item.url}">${item.title}</a></li>
              `).join('')}
            </ul>
          </li>
        `).join('');
      }

      dropHTML = `<ul class="dropdown-menu">${itemsListHTML}</ul>`;
    }

    return `
      <li class="nav-dropdown">
        <a href="#" class="dropdown-toggle">${cat} ▾</a>
        ${dropHTML}
      </li>
    `;
  }).join('');
}

/**
 * 3. Render Dynamic Breadcrumb Trail
 */
function renderBreadcrumbs(categoryPath, pageTitle) {
  const container = document.getElementById('breadcrumb-container');
  if (!container || !categoryPath) return;

  const parts = categoryPath.split('/').map(p => p.strip());
  let accumPath = '/Cubit.Tools/passwords/';

  const crumbs = parts.map(part => {
    accumPath += `${part.toLowerCase().replace(/\s+/g, '-')}/`;
    return `<a href="${accumPath}">${part}</a>`;
  });

  container.innerHTML = `
    <nav class="breadcrumbs">
      <a href="/Cubit.Tools/">Home</a> &gt; 
      ${crumbs.join(' &gt; ')} &gt; 
      <span>${pageTitle}</span>
    </nav>
  `;
}

/**
 * 4. Password Generator Logic
 */
function generatePassword() {
  const outputEl = document.getElementById('password-output');
  const countEl = document.getElementById('word-count-slider');
  const numCheck = document.getElementById('include-numbers');
  const symCheck = document.getElementById('include-symbols');

  if (!outputEl) return;

  const wordCount = countEl ? parseInt(countEl.value, 10) : 3;
  const includeNumbers = numCheck ? numCheck.checked : true;
  const includeSymbols = symCheck ? symCheck.checked : true;

  if (!currentWordList || currentWordList.length === 0) {
    currentWordList = ['apple', 'river', 'stove', 'cloud', 'timber', 'beacon', 'shadow', 'magnet'];
  }

  const selectedWords = [];
  for (let i = 0; i < wordCount; i++) {
    const randomWord = currentWordList[Math.floor(Math.random() * currentWordList.length)];
    selectedWords.push(randomWord);
  }

  let passphrase = selectedWords.join('-');

  if (includeNumbers) {
    passphrase += `-${Math.floor(Math.random() * 90) + 10}`;
  }

  if (includeSymbols) {
    const symbols = ['!', '@', '#', '$', '%', '&', '*'];
    passphrase += symbols[Math.floor(Math.random() * symbols.length)];
  }

  outputEl.value = passphrase;
}

/**
 * 5. Interactive UI Setup
 */
function renderToolUI() {
  const container = document.getElementById('tool-container');
  if (!container) return;

  container.innerHTML = `
    <div class="tool-box">
      <div class="input-group">
        <input type="text" id="password-output" readonly placeholder="Generating..." />
        <button id="copy-btn" class="btn-secondary">Copy</button>
      </div>

      <div class="slider-group">
        <label for="word-count-slider">
          Number of Words: <strong id="word-count-val">3</strong>
        </label>
        <input type="range" id="word-count-slider" min="2" max="6" value="3" step="1" />
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

      <button id="generate-btn" class="btn-primary">Generate New Passphrase</button>
    </div>
  `;

  const slider = document.getElementById('word-count-slider');
  const sliderValDisplay = document.getElementById('word-count-val');
  const numCheck = document.getElementById('include-numbers');
  const symCheck = document.getElementById('include-symbols');

  slider.addEventListener('input', (e) => {
    sliderValDisplay.innerText = e.target.value;
    generatePassword();
  });

  numCheck.addEventListener('change', generatePassword);
  symCheck.addEventListener('change', generatePassword);
  document.getElementById('generate-btn').addEventListener('click', generatePassword);

  document.getElementById('copy-btn').addEventListener('click', () => {
    const output = document.getElementById('password-output');
    if (output && output.value) {
      navigator.clipboard.writeText(output.value);
      const copyBtn = document.getElementById('copy-btn');
      copyBtn.innerText = 'Copied!';
      setTimeout(() => { copyBtn.innerText = 'Copy'; }, 2000);
    }
  });
}

/**
 * 6. Quick Search Filter for Hub / Directory Pages
 */
function initQuickSearch() {
  const searchInput = document.getElementById('hub-search-input');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const cards = document.querySelectorAll('.hub-card');

    cards.forEach(card => {
      const title = card.innerText.toLowerCase();
      card.style.display = title.includes(query) ? 'block' : 'none';
    });
  });
}

/**
 * 7. Page Initialization
 */
async function initPage() {
  await loadComponents();
  initQuickSearch();

  const toolContainer = document.getElementById('tool-container');
  if (!toolContainer) return;

  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  const currentSegment = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : '';

  const prefix = getRelativePrefix();

  try {
    const response = await fetch(`${prefix}data/passwords.json`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    
    const pageData = data.find(item => 
      item.Slug === currentSegment || 
      item.Slug.includes(currentSegment) ||
      currentSegment.includes(item.Slug)
    ) || data[0];

    if (pageData) {
      if (document.getElementById('meta-title')) document.title = pageData.Meta_Title;
      if (document.getElementById('meta-desc')) document.getElementById('meta-desc').setAttribute('content', pageData.Meta_Desc);
      if (document.getElementById('page-h1')) document.getElementById('page-h1').innerText = pageData.H1_Title;
      if (document.getElementById('page-intro')) document.getElementById('page-intro').innerText = pageData.Intro_Text;
      if (document.getElementById('seo-body')) document.getElementById('seo-body').innerText = pageData.SEO_Body;

      renderBreadcrumbs(pageData.Category_Path, pageData.H1_Title);

      if (pageData.Word_List) {
        currentWordList = pageData.Word_List.split(',').map(w => w.trim());
      }

      renderToolUI();
      generatePassword();
    }
  } catch (err) {
    console.error('Error loading page JSON data:', err);
    renderToolUI();
    generatePassword();
  }
}

document.addEventListener('DOMContentLoaded', initPage);