const DOMAIN = 'https://cubittools-wq.github.io';
const BASE_URL = 'https://cubittools-wq.github.io/Cubit.Tools/';

/**
 * Global Navigation Loader for Cubit.Tools
 */
async function loadComponents() {
  try {
    const [headerRes, footerRes, navRes] = await Promise.all([
      fetch(`${BASE_URL}components/header-combined.html`),
      fetch(`${BASE_URL}components/footer.html`),
      fetch(`${BASE_URL}data/nav.json`)
    ]);

    if (headerRes.ok && document.getElementById('site-header')) {
      document.getElementById('site-header').innerHTML = await headerRes.text();
      
      if (navRes.ok) {
        const navTree = await navRes.json();
        
        // 1. Build main top nav dropdowns
        renderPrimaryNav(navTree);
        
        // 2. Build left sidebar breakdown based on current section
        renderLeftSidebarNav(navTree);
        
        // 3. Attach interactive toggles
        setupNavInteractions();
      }
    }
    
    if (footerRes.ok && document.getElementById('site-footer')) {
      document.getElementById('site-footer').innerHTML = await footerRes.text();
    }
  } catch (err) {
    console.error('Error loading dynamic navigation:', err);
  }
}

/**
 * Render Top Nav Bar dynamically from navTree keys
 */
function renderPrimaryNav(navTree) {
  const primaryNavUl = document.getElementById('primary-nav-links');
  if (!primaryNavUl) return;

  const topCategories = Object.keys(navTree);

  primaryNavUl.innerHTML = topCategories.map(cat => {
    const sectionData = navTree[cat] || { _sub: {}, _items: [] };
    const levelTwoKeys = Object.keys(sectionData._sub || {});
    const rootItems = sectionData._items || [];

    let dropdownHTML = '';

    if (levelTwoKeys.length > 0 || rootItems.length > 0) {
      let itemsListHTML = '';

      if (rootItems.length > 0) {
        itemsListHTML += `
          <li class="level-two-item">
            <ul>
              ${rootItems.map(item => `<li><a href="${DOMAIN}${item.url}">${item.title}</a></li>`).join('')}
            </ul>
          </li>
        `;
      }

      if (levelTwoKeys.length > 0) {
        itemsListHTML += levelTwoKeys.map(subKey => `
          <li class="level-two-item">
            <span class="level-two-title">${subKey}</span>
            <ul>
              ${(sectionData._sub[subKey]._items || []).map(item => `
                <li><a href="${DOMAIN}${item.url}">${item.title}</a></li>
              `).join('')}
            </ul>
          </li>
        `).join('');
      }

      dropdownHTML = `
        <div class="top-dropdown-panel">
          <ul class="level-two-list">
            ${itemsListHTML}
          </ul>
        </div>
      `;
    }

    return `
      <li class="primary-nav-item">
        <button type="button" class="primary-nav-btn" aria-expanded="false">
          ${cat} ${dropdownHTML ? '<span class="arrow">▾</span>' : ''}
        </button>
        ${dropdownHTML}
      </li>
    `;
  }).join('');
}

/**
 * Recursively render unlimited depth for the Left Sidebar
 */
function buildSidebarTreeHTML(node) {
  let html = '<ul class="sidebar-tree">';

  const subKeys = Object.keys(node._sub || {});
  subKeys.forEach(subKey => {
    html += `
      <li class="sidebar-branch">
        <details open>
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
        <a href="${DOMAIN}${item.url}">${item.title}</a>
      </li>
    `;
  });

  html += '</ul>';
  return html;
}

/**
 * Render Sidebar contents dynamically matching the current top-level category
 */
function renderLeftSidebarNav(navTree) {
  const container = document.getElementById('sidebar-nav-container');
  if (!container) return;

  const topCategories = Object.keys(navTree);
  if (topCategories.length === 0) return;

  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  let activeSection = topCategories[0];

  for (const cat of topCategories) {
    const slugifiedCat = cat.toLowerCase().replace(/\s+/g, '-');
    if (pathSegments.some(seg => seg.toLowerCase() === slugifiedCat)) {
      activeSection = cat;
      break;
    }
  }

  const sectionData = navTree[activeSection] || navTree[topCategories[0]];

  container.innerHTML = `
    <div class="sidebar-section-group">
      <h3 class="sidebar-heading">${activeSection}</h3>
      ${buildSidebarTreeHTML(sectionData)}
    </div>
  `;
}

/**
 * Toggle interactions for top nav and sidebar drawer
 */
function setupNavInteractions() {
  const navBtns = document.querySelectorAll('.primary-nav-btn');

  navBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const parent = btn.closest('.primary-nav-item');
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';

      document.querySelectorAll('.primary-nav-item').forEach(item => {
        item.classList.remove('active');
        const b = item.querySelector('.primary-nav-btn');
        if (b) b.setAttribute('aria-expanded', 'false');
      });

      if (!isExpanded) {
        parent.classList.add('active');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.primary-nav-item').forEach(item => {
      item.classList.remove('active');
      const b = item.querySelector('.primary-nav-btn');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  });

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

document.addEventListener('DOMContentLoaded', loadComponents);