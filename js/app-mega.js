const BASE_URL = 'https://cubittools-wq.github.io/Cubit.Tools/';
let currentWordList = [];

function buildMegaTreeHTML(node) {
  let html = '';
  const subKeys = Object.keys(node._sub || {});
  const items = node._items || [];

  if (subKeys.length > 0) {
    subKeys.forEach(subKey => {
      html += `
        <div class="mega-column">
          <span class="mega-group-title">${subKey}</span>
          ${buildMegaTreeHTML(node._sub[subKey])}
        </div>
      `;
    });
  }

  if (items.length > 0) {
    html += '<ul class="mega-links">';
    items.forEach(item => {
      html += `<li><a href="${BASE_URL}${item.url.replace(/^\//, '')}">${item.title}</a></li>`;
    });
    html += '</ul>';
  }

  return html;
}

function renderMegaNav(navTree) {
  const navUl = document.getElementById('main-nav-links');
  if (!navUl) return;

  const topCategories = Object.keys(navTree);

  navUl.innerHTML = topCategories.map(cat => {
    const categoryData = navTree[cat];
    const treeHTML = buildMegaTreeHTML(categoryData);

    return `
      <li class="mega-dropdown">
        <button type="button" class="mega-toggle" aria-expanded="false">
          ${cat} <span class="arrow">▾</span>
        </button>
        <div class="mega-panel">
          <div class="mega-grid">
            ${treeHTML}
          </div>
        </div>
      </li>
    `;
  }).join('');
}

function setupMegaInteractions() {
  const toggles = document.querySelectorAll('.mega-toggle');

  toggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const parent = toggle.closest('.mega-dropdown');
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';

      document.querySelectorAll('.mega-dropdown').forEach(item => {
        item.classList.remove('active');
        const btn = item.querySelector('.mega-toggle');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });

      if (!isExpanded) {
        parent.classList.add('active');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.mega-dropdown').forEach(item => {
      item.classList.remove('active');
      const btn = item.querySelector('.mega-toggle');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  });
}

async function loadComponents() {
  try {
    const [headerRes, footerRes, navRes] = await Promise.all([
      fetch(`${BASE_URL}components/header-mega.html`),
      fetch(`${BASE_URL}components/footer.html`),
      fetch(`${BASE_URL}data/nav.json`)
    ]);

    if (headerRes.ok && document.getElementById('site-header')) {
      document.getElementById('site-header').innerHTML = await headerRes.text();
      if (navRes.ok) {
        const navTree = await navRes.json();
        renderMegaNav(navTree);
        setupMegaInteractions();
      }
    }
    
    if (footerRes.ok && document.getElementById('site-footer')) {
      document.getElementById('site-footer').innerHTML = await footerRes.text();
    }
  } catch (err) {
    console.error('Error loading global components:', err);
  }
}