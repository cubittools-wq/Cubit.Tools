let currentWordList = [];

/**
 * 1. Calculate Folder Depth & Generate Relative Path Prefixes
 * Ensures components load correctly from root or subfolders on GitHub Pages
 */
function getRelativePrefix() {
  const path = window.location.pathname;
  // Strip repository name if hosted on github.io subpath
  const cleanPath = path.replace(/^\/Cubit\.Tools/, '');
  const segments = cleanPath.split('/').filter(Boolean);
  
  // If we are in a subfolder, prefix with '../' for each level
  return segments.length > 0 ? '../'.repeat(segments.length) : './';
}

/**
 * 2. Fetch Shared Header and Footer Components
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
      
      // Inject links built from Google Sheet
      if (navRes.ok) {
        const navItems = await navRes.json();
        renderDynamicNav(navItems);
      }
    }
    
    if (footerRes.ok && document.getElementById('site-footer')) {
      document.getElementById('site-footer').innerHTML = await footerRes.text();
    }
  } catch (err) {
    console.error('Error loading global components or navigation:', err);
  }
}

function renderDynamicNav(navItems) {
  const navUl = document.getElementById('main-nav-links');
  if (!navUl) return;

  const currentPath = window.location.pathname;

  navUl.innerHTML = navItems.map(item => {
    const isActive = currentPath.includes(item.url) ? 'class="active"' : '';
    return `<li><a href="${item.url}" ${isActive}>${item.title}</a></li>`;
  }).join('');
}

/**
 * 3. Highlight Active Navigation Links
 */
function highlightActiveNavLink() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('#main-nav-links a, .footer-links a');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && href !== '/' && href !== './' && currentPath.includes(href.replace('../', '').replace('./', ''))) {
      link.classList.add('active');
    }
  });
}

/**
 * 4. Password Generation Logic
 */
function generatePassword() {
  const outputEl = document.getElementById('password-output');
  if (!outputEl) return;

  if (!currentWordList || currentWordList.length === 0) {
    // Fallback word list if JSON dataset is missing or empty
    currentWordList = ['apple', 'river', 'stove', 'cloud', 'timber', 'beacon', 'shadow', 'magnet'];
  }

  // Pick 3 random words
  const word1 = currentWordList[Math.floor(Math.random() * currentWordList.length)];
  const word2 = currentWordList[Math.floor(Math.random() * currentWordList.length)];
  const word3 = currentWordList[Math.floor(Math.random() * currentWordList.length)];

  // Append a random 2-digit number and special character for entropy
  const num = Math.floor(Math.random() * 90) + 10;
  const symbols = ['!', '@', '#', '$', '%', '&', '*'];
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];

  const passphrase = `${word1}-${word2}-${word3}-${num}${symbol}`;
  outputEl.value = passphrase;
}

/**
 * 5. Render Interactive Tool UI
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
      <button id="generate-btn" class="btn-primary">Generate New Passphrase</button>
    </div>
  `;

  // Attach Event Listeners
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
 * 6. Main Application Initialization
 */
async function initPage() {
  // Load UI Header & Footer
  await loadComponents();

  // If page does not contain a tool container (e.g. root index.html, about, privacy), stop here
  const toolContainer = document.getElementById('tool-container');
  if (!toolContainer) return;

  // Extract current page slug from path (e.g., /passwords/sci-fi-password-generator/)
  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  const currentSegment = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : '';

  const prefix = getRelativePrefix();

  try {
    const response = await fetch(`${prefix}data/passwords.json`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    
    // Find matching entry in passwords.json by slug
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

      if (pageData.Word_List) {
        currentWordList = pageData.Word_List.split(',').map(w => w.trim());
      }

      renderToolUI();
      generatePassword();
    }
  } catch (err) {
    console.error('Error loading page JSON data:', err);
    // Render basic fallback tool UI if JSON fails to fetch
    renderToolUI();
    generatePassword();
  }
}

// Run application when DOM is ready
document.addEventListener('DOMContentLoaded', initPage);