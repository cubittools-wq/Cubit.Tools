import PasswordGenWidget from 'https://cubittools-wq.github.io/Cubit.Tools/js/widgets/password_gen.js';
import FinanceMarginWidget from 'https://cubittools-wq.github.io/Cubit.Tools/js/widgets/finance_margin.js';
import UnitConverterWidget from 'https://cubittools-wq.github.io/Cubit.Tools/js/widgets/unit_converter.js';
import ElecCalcWidget from 'https://cubittools-wq.github.io/Cubit.Tools/js/widgets/elec_calc.js';
import ApplianceCalcWidget from 'https://cubittools-wq.github.io/Cubit.Tools/js/widgets/appliance_calc.js';
import CountdownWidget from 'https://cubittools-wq.github.io/Cubit.Tools/js/widgets/countdown.js';
import DateDiffCalcWidget from 'https://cubittools-wq.github.io/Cubit.Tools/js/widgets/date_diff_calc.js';
import AgeCalcWidget from 'https://cubittools-wq.github.io/Cubit.Tools/js/widgets/age_calc.js';
import { attachSearch } from 'https://cubittools-wq.github.io/Cubit.Tools/js/site-search.js';

const DOMAIN = 'https://cubittools-wq.github.io';
const BASE_URL = 'https://cubittools-wq.github.io/Cubit.Tools/';

/**
 * Theme Toggle Handler
 */
function initThemeToggle() {
  const toggleBtn = document.getElementById('theme-toggle');
  if (!toggleBtn) return;

  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  toggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  });
}

/**
 * Fetch Header, Footer, and Hierarchical Navigation
 */
async function loadComponents() {
  try {
    const [headerRes, footerRes, navRes] = await Promise.all([
      fetch(`${BASE_URL}components/header.html`),
      fetch(`${BASE_URL}components/footer.html`),
      fetch(`${BASE_URL}data/nav.json`)
    ]);

    if (headerRes.ok && document.getElementById('site-header')) {
      document.getElementById('site-header').innerHTML = await headerRes.text();
      
      initThemeToggle();
      attachSearch(
        document.getElementById('header-search-input'),
        document.getElementById('header-search-results'),
        { scope: '', limit: 8 }
      );

      if (navRes.ok) {
        const nav = await navRes.json();
        renderBrowseMenu(nav);
        setupNavInteractions();
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
 * Render the "Browse" mega-menu: every top-level category with its sub-categories and tool counts.
 * Data comes from data/nav.json, which build_site.py generates from the Google Sheet.
 */
function renderBrowseMenu(nav) {
  const navUl = document.getElementById('primary-nav-links');
  if (!navUl) return;

  const categories = (nav && nav.categories) || [];
  if (categories.length === 0) return;

  const MAX_SUBS = 8;
  const columns = categories.map(cat => {
    const subs = cat.children || [];
    const subLinks = subs.slice(0, MAX_SUBS).map(sub =>
      `<li><a href="${sub.url}">${escapeHtml(sub.name)}<span>${sub.count}</span></a></li>`
    ).join('');
    const more = subs.length > MAX_SUBS
      ? `<li class="more"><a href="${cat.url}">All ${subs.length} categories &rarr;</a></li>`
      : '';
    return `
      <div class="browse-col">
        <h4><a href="${cat.url}">${escapeHtml(cat.name)} (${cat.count})</a></h4>
        <ul>${subLinks}${more}</ul>
      </div>
    `;
  }).join('');

  navUl.innerHTML = `
    <li class="primary-nav-item">
      <button type="button" class="primary-nav-btn" aria-expanded="false">
        Browse <span class="arrow">&#9662;</span>
      </button>
      <div class="top-dropdown-panel browse-panel">
        <div class="browse-grid">${columns}</div>
      </div>
    </li>
  `;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Toggle interactions for the top nav dropdowns
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
}

/**
 * Render Dynamic Breadcrumb Trail
 */
function renderBreadcrumbs(categoryPath, pageTitle) {
  const container = document.getElementById('breadcrumb-container');
  if (!container || !categoryPath) return;
  // Pages built by build_site.py already contain a full breadcrumb trail (with links to real category pages).
  if (container.querySelector('nav')) return;

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
 * Modular Widget Dispatcher
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
 * Search box on the homepage and category pages (scoped to the category via data-scope).
 */
function initHubSearch() {
  attachSearch(
    document.getElementById('hub-search-input'),
    document.getElementById('hub-search-results'),
    { limit: 20 }
  );
}

/**
 * Page Initialization
 */
async function initPage() {
  await loadComponents();
  initHubSearch();

  const toolContainer = document.getElementById('tool-container');
  if (!toolContainer) return;

  // Pages built by the current build_site.py carry their own widget config and data, so there is no need to
  // download the full tool datasets. Older pages fall through to the lookup below.
  if (toolContainer.dataset.baked === '1' && toolContainer.dataset.widget) {
    mountWidget(toolContainer);
    return;
  }

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

        mountWidget(toolContainer);
        break;
      }
    } catch (err) {
      console.warn(`Could not load dataset from ${file}:`, err);
    }
  }
}

document.addEventListener('DOMContentLoaded', initPage);