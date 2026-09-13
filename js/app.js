import PasswordGenWidget from './widgets/password_gen.js';
import FinanceMarginWidget from './widgets/finance_margin.js';
import UnitConverterWidget from './widgets/unit_converter.js';
import ElecCalcWidget from './widgets/elec_calc.js';
import ApplianceCalcWidget from './widgets/appliance_calc.js';
import CountdownWidget from './widgets/countdown.js';
import DateDiffCalcWidget from './widgets/date_diff_calc.js';
import AgeCalcWidget from './widgets/age_calc.js';

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

    if (subKeys.length > 0 || rootItems.length > 0) {
      let itemsListHTML = '';

      if (rootItems.length > 0) {
        itemsListHTML += `
          <li class="nav-subgroup">
            <ul>
              ${rootItems.map(item => `<li><a href="${item.url}">${item.title}</a></li>`).join('')}
            </ul>
          </li>
        `;
      }

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

  const parts = categoryPath.split('/').map(p => p.trim());
  let accumPath = '/Cubit.Tools/';

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
 * 4. Modular Widget Dispatcher
 */
function mountWidget(container) {
  const widgetType = container.dataset.widget;

  switch (widgetType) {
    case 'password_gen':
    case 'lyrics_gen':
      new PasswordGenWidget(container);
      break;
    case 'finance_margin':
      new FinanceMarginWidget(container);
      break;
    case 'unit_converter':
      new UnitConverterWidget(container);
      break;
    case 'elec_calc':
      new ElecCalcWidget(container);
      break;
    case 'appliance_calc':
      new ApplianceCalcWidget(container);
      break;
    case 'countdown':
      new CountdownWidget(container);
      break;
    case 'date_diff_calc':
      new DateDiffCalcWidget(container);
      break;
    case 'age_calc':
      new AgeCalcWidget(container);
      break;
    default:
      container.innerHTML = `<p>Widget type "${widgetType}" not configured.</p>`;
  }
}

/**
 * 5. Quick Search Filter for Hub / Directory Pages
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
 * 6. Page Initialization
 */
async function initPage() {
  await loadComponents();
  initQuickSearch();

  const toolContainer = document.getElementById('tool-container');
  if (!toolContainer) return;

  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  const currentSegment = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : '';
  const prefix = getRelativePrefix();

  const dataFiles = ['passwords.json', 'calculators.json', 'date_time.json'];

  for (const file of dataFiles) {
    try {
      const response = await fetch(`${prefix}data/${file}`);
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

        // Bind attributes for the widget dispatcher
        toolContainer.dataset.widget = pageData.Widget_Type;
        toolContainer.dataset.config = pageData.Config_JSON;
        toolContainer.dataset.list = pageData.Data_List || '';

        mountWidget(toolContainer);
        break;
      }
    } catch (err) {
      console.warn(`Could not load dataset from ${file}:`, err);
    }
  }
}

document.addEventListener('DOMContentLoaded', initPage);