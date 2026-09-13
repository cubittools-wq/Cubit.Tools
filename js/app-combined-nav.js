/**
 * Global Navigation Loader for Cubit.Tools
 */
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
        
        // 1. Build main top nav (Level 1 & Level 2)
        renderPrimaryNav(navTree);
        
        // 2. Build left sidebar breakdown (Full Depth)
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
 * Render Top Nav Bar (Password Generators, Date and Time, Calculators)
 * Shows up to 2 levels deep
 */
function renderPrimaryNav(navTree) {
  const primaryNavUl = document.getElementById('primary-nav-links');
  if (!primaryNavUl) return;

  // Define top-level section buckets
  const sections = [
    { key: 'Password Generators', label: 'Password Generators' },
    { key: 'Date and Time', label: 'Date & Time' },
    { key: 'Calculators', label: 'Calculators' }
  ];

  primaryNavUl.innerHTML = sections.map(sec => {
    const sectionData = navTree[sec.key] || { _sub: {}, _items: [] };
    const levelTwoKeys = Object.keys(sectionData._sub || {});

    let dropdownHTML = '';

    if (levelTwoKeys.length > 0) {
      dropdownHTML = `
        <div class="top-dropdown-panel">
          <ul class="level-two-list">
            ${levelTwoKeys.map(subKey => `
              <li class="level-two-item">
                <span class="level-two-title">${subKey}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    return `
      <li class="primary-nav-item">
        <button type="button" class="primary-nav-btn" aria-expanded="false">
          ${sec.label} ${levelTwoKeys.length > 0 ? '<span class="arrow">▾</span>' : ''}
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
        <a href="${item.url}">${item.title}</a>
      </li>
    `;
  });

  html += '</ul>';
  return html;
}

/**
 * Render Sidebar contents broken down by subcategory
 */
function renderLeftSidebarNav(navTree) {
  const container = document.getElementById('sidebar-nav-container');
  if (!container) return;

  const activeSection = 'Password Generators'; // Automatically target the password tree
  const sectionData = navTree[activeSection] || navTree;

  container.innerHTML = `
    <div class="sidebar-section-group">
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

  // Sidebar Controls
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

function getRelativePrefix() {
  const path = window.location.pathname;
  const cleanPath = path.replace(/^\/Cubit\.Tools/, '');
  const segments = cleanPath.split('/').filter(Boolean);
  return segments.length > 0 ? '../'.repeat(segments.length) : './';
}

document.addEventListener('DOMContentLoaded', loadComponents);