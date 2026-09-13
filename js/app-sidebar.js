const BASE_URL = 'https://cubittools-wq.github.io/Cubit.Tools/';
let currentWordList = [];

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
        <a href="${BASE_URL}${item.url.replace(/^\//, '')}">${item.title}</a>
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

function setupSidebarInteractions() {
  const openBtn = document.getElementById('sidebar-open-btn');
  const closeBtn = document.getElementById('sidebar-close-btn');
  const drawer = document.getElementById('sidebar-drawer');
  const overlay = document.getElementById('sidebar-overlay');

  function toggleSidebar(open) {
    drawer.classList.toggle('open', open);
    overlay.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', !open);
  }

  if (openBtn) openBtn.addEventListener('click', () => toggleSidebar(true));
  if (closeBtn) closeBtn.addEventListener('click', () => toggleSidebar(false));
  if (overlay) overlay.addEventListener('click', () => toggleSidebar(false));
}

async function loadComponents() {
  try {
    const [headerRes, footerRes, navRes] = await Promise.all([
      fetch(`${BASE_URL}components/header-sidebar.html`),
      fetch(`${BASE_URL}components/footer.html`),
      fetch(`${BASE_URL}data/nav.json`)
    ]);

    if (headerRes.ok && document.getElementById('site-header')) {
      document.getElementById('site-header').innerHTML = await headerRes.text();
      if (navRes.ok) {
        const navTree = await navRes.json();
        renderSidebarNav(navTree);
        setupSidebarInteractions();
      }
    }
    
    if (footerRes.ok && document.getElementById('site-footer')) {
      document.getElementById('site-footer').innerHTML = await footerRes.text();
    }
  } catch (err) {
    console.error('Error loading global components:', err);
  }
}