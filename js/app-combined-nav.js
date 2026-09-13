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

/**
 * Load a widget module by type. Uses dynamic import() so this file can stay
 * a plain (non type="module") script - the <script> tags across the site
 * that load app-combined-nav.js don't set type="module".
 */
async function loadWidgetClass(widgetType) {
  switch (widgetType) {
    case 'password_gen':
    case 'lyrics_gen':
      return (await import(`${BASE_URL}js/widgets/password_gen.js`)).default;
    case 'finance_margin':
      return (await import(`${BASE_URL}js/widgets/finance_margin.js`)).default;
    case 'unit_converter':
      return (await import(`${BASE_URL}js/widgets/unit_converter.js`)).default;
    case 'elec_calc':
      return (await import(`${BASE_URL}js/widgets/elec_calc.js`)).default;
    case 'appliance_calc':
      return (await import(`${BASE_URL}js/widgets/appliance_calc.js`)).default;
    case 'countdown':
      return (await import(`${BASE_URL}js/widgets/countdown.js`)).default;
    case 'date_diff_calc':
      return (await import(`${BASE_URL}js/widgets/date_diff_calc.js`)).default;
    case 'age_calc':
      return (await import(`${BASE_URL}js/widgets/age_calc.js`)).default;
    default:
      return null;
  }
}

/**
 * Modular Widget Dispatcher
 */
async function mountWidget(container) {
  const widgetType = container.dataset.widget;

  try {
    const WidgetClass = await loadWidgetClass(widgetType);
    if (WidgetClass) {
      new WidgetClass(container);
    } else {
      container.innerHTML = `<p>Widget type "${widgetType}" not configured.</p>`;
    }
  } catch (err) {
    console.error(`Error loading widget "${widgetType}":`, err);
    container.innerHTML = `<p>Widget type "${widgetType}" failed to load.</p>`;
  }
}

/**
 * Render Dynamic Breadcrumb Trail
 */
function renderBreadcrumbs(categoryPath, pageTitle) {
  const container = document.getElementById('breadcrumb-container');
  if (!container || !categoryPath) return;

  const parts = categoryPath.split('/').map(p => p.trim());
  let accumPath = BASE_URL;

  const crumbs = parts.map(part => {
    accumPath += `${part.toLowerCase().replace(/\s+/g, '-')}/`;
    return `<a href="${accumPath}">${part}</a>`;
  });

  container.innerHTML = `
    <nav class="breadcrumbs">
      <a href="${BASE_URL}">Home</a> &gt; 
      ${crumbs.join(' &gt; ')} &gt; 
      <span>${pageTitle}</span>
    </nav>
  `;
}

/**
 * Find this page's row in the data sheets and mount its widget
 */
async function initToolPage() {
  const toolContainer = document.getElementById('tool-container');
  if (!toolContainer) return;

  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  const currentSegment = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : '';

  const dataFiles = ['passwords.json', 'calculators.json', 'date_time.json'];

  for (const file of dataFiles) {
    try {
      const response = await fetch(`${BASE_URL}data/${file}`);
      if (!response.ok) continue;

      const data = await response.json();
      const pageData = data.find(item =>
        item.Slug === currentSegment ||
        item.Slug.endsWith('/' + currentSegment) ||
        currentSegment === item.Slug.split('/').pop()
      );

      if (pageData) {
        if (document.getElementById('meta-title')) document.title = pageData.Meta_Title;
        if (document.getElementById('meta-desc')) document.getElementById('meta-desc').setAttribute('content', pageData.Meta_Desc);
        if (document.getElementById('page-h1')) document.getElementById('page-h1').innerText = pageData.H1_Title;
        if (document.getElementById('page-intro')) document.getElementById('page-intro').innerText = pageData.Intro_Text;
        if (document.getElementById('seo-body')) document.getElementById('seo-body').innerHTML = pageData.SEO_Body;

        renderBreadcrumbs(pageData.Category, pageData.H1_Title);

        toolContainer.dataset.widget = pageData.Widget_Type;
        toolContainer.dataset.config = pageData.Config_JSON;
        toolContainer.dataset.list = pageData.Data_List || '';

        await mountWidget(toolContainer);
        break;
      }
    } catch (err) {
      console.warn(`Could not load dataset from ${file}:`, err);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadComponents();
  initToolPage();
});