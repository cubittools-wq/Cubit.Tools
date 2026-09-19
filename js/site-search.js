// js/site-search.js
//
// Client-side search over data/search-index.json (built from the Google Sheet by build_site.py).
// Used by the header search box on every page and by the search box on the homepage and category pages.

const BASE_URL = 'https://cubittools-wq.github.io/Cubit.Tools/';

let indexPromise = null;

function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch(`${BASE_URL}data/search-index.json`)
      .then(res => (res.ok ? res.json() : []))
      .then(list => list.map(e => ({
        ...e,
        _t: e.t.toLowerCase(),
        _c: (e.c || '').toLowerCase(),
        _d: (e.d || '').toLowerCase()
      })))
      .catch(() => []);
  }
  return indexPromise;
}

function scoreEntry(entry, tokens) {
  let total = 0;
  for (const tok of tokens) {
    let s = 0;
    if (entry._t === tok) s += 100;
    else if (entry._t.startsWith(tok)) s += 20;
    else if (entry._t.includes(` ${tok}`)) s += 10;
    else if (entry._t.includes(tok)) s += 6;
    else if (entry._c.includes(tok)) s += 2;
    else if (entry._d.includes(tok)) s += 1;
    if (s === 0) return 0; // every word must match somewhere
    total += s;
  }
  if (entry.k) total += 3; // slight boost for category pages
  return total;
}

function inScope(entry, scope) {
  if (!scope) return true;
  return entry.p === scope || (entry.p || '').startsWith(`${scope}/`);
}

function renderResults(panel, results, query) {
  panel.textContent = '';
  if (results.length === 0) {
    const none = document.createElement('div');
    none.className = 'search-empty';
    none.textContent = `No tools found for "${query}".`;
    panel.appendChild(none);
    panel.hidden = false;
    return;
  }
  for (const e of results) {
    const a = document.createElement('a');
    a.className = 'search-result';
    a.href = BASE_URL + e.u;

    const title = document.createElement('span');
    title.className = 'search-result-title';
    title.textContent = e.t;
    if (e.k) {
      const badge = document.createElement('span');
      badge.className = 'search-result-badge';
      badge.textContent = 'Category';
      title.appendChild(badge);
    }

    const meta = document.createElement('span');
    meta.className = 'search-result-meta';
    meta.textContent = e.k ? `${e.d} in ${e.c}` : e.c;

    a.append(title, meta);
    panel.appendChild(a);
  }
  panel.hidden = false;
}

/**
 * Attach live search to an input. `panel` receives the results.
 * options.scope: category path (e.g. "passwords/sports") to search within; empty = whole site.
 * options.limit: maximum results to show.
 */
export function attachSearch(input, panel, options = {}) {
  if (!input || !panel) return;
  const scope = options.scope ?? input.dataset.scope ?? '';
  const limit = options.limit ?? 10;
  let active = -1;

  const links = () => Array.from(panel.querySelectorAll('.search-result'));
  const setActive = (i) => {
    const items = links();
    items.forEach(el => el.classList.remove('active'));
    active = items.length ? (i + items.length) % items.length : -1;
    if (active >= 0) {
      items[active].classList.add('active');
      items[active].scrollIntoView({ block: 'nearest' });
    }
  };
  const close = () => { panel.hidden = true; active = -1; };

  async function run() {
    const query = input.value.trim().toLowerCase();
    if (!query) { close(); return; }
    const tokens = query.split(/\s+/).filter(Boolean);
    const index = await loadIndex();
    if (input.value.trim().toLowerCase() !== query) return; // a newer keystroke is already handling this
    const results = index
      .filter(e => inScope(e, scope) && !(e.k && e.p === scope))
      .map(e => ({ e, s: scoreEntry(e, tokens) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s || a.e.t.length - b.e.t.length)
      .slice(0, limit)
      .map(x => x.e);
    renderResults(panel, results, input.value.trim());
    active = -1;
  }

  input.addEventListener('input', run);
  input.addEventListener('focus', () => { loadIndex(); if (input.value.trim()) run(); });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setActive(active + 1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setActive(active - 1); }
    else if (ev.key === 'Escape') { close(); input.blur(); }
    else if (ev.key === 'Enter') {
      const items = links();
      const target = items[active >= 0 ? active : 0];
      if (target) { ev.preventDefault(); window.location.href = target.href; }
    }
  });
  document.addEventListener('click', (ev) => {
    if (!panel.contains(ev.target) && ev.target !== input) close();
  });
}
