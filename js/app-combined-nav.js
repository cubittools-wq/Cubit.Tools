let currentWordList = [];

function getRelativePrefix() {
  const path = window.location.pathname;
  const cleanPath = path.replace(/^\/Cubit\.Tools/, '');
  const segments = cleanPath.split('/').filter(Boolean);
  return segments.length > 0 ? '../'.repeat(segments.length) : './';
}

/* --- Mega Nav Builder --- */
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
      html += `<li><a href="${item.url}">${item.title}</a></li>`;
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
    const treeHTML = buildMegaTreeHTML(navTree[cat]);
    return `
      <li class="mega-dropdown">
        <button type="button" class="mega-toggle" aria-expanded="false">
          ${cat} <span class="arrow">▾</span>
        </button>
        <div class="mega-panel">
          <div class="mega-grid">${treeHTML}</div>
        </div>
      </li>
    `;
  }).join('');
}

/* --- Sidebar Nav Builder --- */
function buildSidebarTreeHTML(node) {
  let html = '<ul class="sidebar-tree">';

  const subKeys = Object.keys(node._sub || {});
  subKeys.forEach(subKey => {
    html += `
      <li class="sidebar-branch">
        <details>
          <summary class="sidebar-folder">${subKey}</summary>
          ${buildSidebarTreeHTML(node._sub[subKey])}
        </details>
      </li>
    `;
  });

  const items = node._items || [];
  items.forEach(item => {
    html += `
      <li class="sidebar-leaf">
        <a href="${item.url}">${item.title}</a>
      </li>
    `;
  });

  html += '</ul>';
  return html;
}

function renderSidebarNav(navTree) {
  const container = document.getElementById('sidebar-nav-container');
  if (!container) return;

  const topCategories = Object.keys(navTree);

  container.innerHTML = topCategories.map(cat => `
    <div class="sidebar-section">
      <details>
        <summary class="sidebar-root-title">${cat}</summary>
        ${buildSidebarTreeHTML(navTree[cat])}
      </details>
    </div>
  `).join('');
}

/* --- Interaction Handlers --- */
function setupInteractions() {
  // Mega Nav Toggles
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

  // Sidebar Drawer Toggles
  const openBtn = document.getElementById('sidebar-open-btn');
  const closeBtn = document.getElementById('sidebar-close-btn');
  const drawer = document.getElementById('sidebar-drawer');
  const overlay = document.getElementById('sidebar-overlay');

  function toggleSidebar(open) {
    if (!drawer || !overlay) return;
    drawer.classList.toggle('open', open);
    overlay.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', !open);
  }

  if (openBtn) openBtn.addEventListener('click', () => toggleSidebar(true));
  if (closeBtn) closeBtn.addEventListener('click', () => toggleSidebar(false));
  if (overlay) overlay.addEventListener('click', () => toggleSidebar(false));
}

/* --- Global Loader --- */
async function loadComponents() {
  const prefix = getRelativePrefix();

  try {
    const [headerRes, footerRes, navRes] = await Promise.all([
      fetch(`${prefix}components/header-combined.html`),
      fetch(`${prefix}components/footer.html`),
      fetch(`${prefix}data/nav.json`)
    ]);

    if (headerRes.ok && document.getElementById('site-header')) {
      document.getElementById('site-header').innerHTML = await headerRes.text();
      if (navRes.ok) {
        const navTree = await navRes.json();
        renderMegaNav(navTree);
        renderSidebarNav(navTree);
        setupInteractions();
      }
    }
    
    if (footerRes.ok && document.getElementById('site-footer')) {
      document.getElementById('site-footer').innerHTML = await footerRes.text();
    }
  } catch (err) {
    console.error('Error loading global components:', err);
  }
}

document.addEventListener('DOMContentLoaded', loadComponents);