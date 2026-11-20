'use strict';

// Shared helpers for the step files of this pack.
//
// Not a step file: it registers no step definitions. It holds the plumbing
// the steps use and that a project can require for its own steps: the wait
// on the site's own signals, the requests of the page, the console of the
// page, the parts of the page by name (the navbar, the sidebar, the table of
// contents, …), the menus of the navbar, and the friendly failures. It also
// puts its recorders on every page of the run (onNewPage).
//
// Waiting: a page of the site is ready when
//   - the document is loaded;
//   - the site has hydrated: <html data-has-hydrated="true">, the attribute
//     the site's own runtime sets once React has taken the page over (the
//     server HTML says "false");
//   - no script of a page is still loading: while the router loads the code
//     of the next page it adds <script data-rspack="…"> (or data-webpack)
//     tags to the head, and removes each one once it is in; the old page
//     stays on screen until all of them are in;
//   - the progress bar of a page change (#nprogress, shown when a change
//     takes longer than 200 ms) is gone;
//   - no request of the page is running (fetch or XHR: the search index, the
//     site's own requests);
//   - and all of that has held for a moment (150 ms).
// No step sleeps.
//
// Every lookup starts with what a person reads (a label, a role, a text) and
// falls back to the theme's stable class names (theme-doc-sidebar-container,
// theme-doc-toc-desktop, theme-code-block, theme-admonition-*, …), which the
// theme documents for styling.

const { gotoUrl, friendly, onNewPage } = require('webship-js/tests/step-definitions/webship');

/**
 * The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least
 * 10 seconds. Kept below webship-js's 45 second step timeout.
 */
function budget(world) {
  return Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, 10000);
}

/** Escape a literal string for use in a RegExp. */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** White space collapsed and trimmed (zero-width spaces too). */
function clean(text) {
  return String(text === null || text === undefined ? '' : text).replace(/[​ ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Letter case and white space ignored. */
function same(a, b) {
  return clean(a).toLowerCase() === clean(b).toLowerCase();
}

/** A list for an error message: `"a", "b", "c"` or `(none)`. */
function listed(values) {
  const items = [...new Set((values || []).map(clean).filter(Boolean))];
  return items.length ? items.map((item) => `"${item}"`).join(', ') : '(none)';
}

/** "a, b and c" or "a, b, c" read as a list. */
function splitList(text) {
  return String(text).split(/\s*,\s*|\s+and\s+/).map(clean).filter(Boolean);
}

/** The site's root without a trailing slash. */
function siteRoot(world) {
  return String(world.launchUrl || (world.parameters && world.parameters.launchUrl) || '').replace(/\/+$/, '');
}

/** Join the site's root and a path with exactly one slash. Absolute URLs pass through. */
function siteUrl(world, url) {
  if (!url) return siteRoot(world) + '/';
  if (/^https?:\/\//.test(url)) return url;
  return siteRoot(world) + '/' + String(url).replace(/^\/+/, '');
}

/** The path of the page the browser shows, without the query, the fragment and a trailing slash. */
function currentPath(world) {
  try {
    return new URL(world.page.url()).pathname.replace(/\/+$/, '') || '/';
  } catch {
    return '';
  }
}

/** The path of an address, without the query, the fragment and a trailing slash. */
function pathOf(url, base) {
  try {
    return new URL(url, base || 'https://x.invalid').pathname.replace(/\/+$/, '') || '/';
  } catch {
    return String(url || '');
  }
}

/** An address without the site's origin, shortened for a message. */
function shortUrl(url) {
  return String(url || '').replace(/^https?:\/\/[^/]+/, '').slice(0, 90);
}

/**
 * Poll a condition evaluated in Node until it holds or the time is up.
 * Resolves true or false; it never throws for a condition that throws.
 */
async function poll(world, condition, timeout = budget(world), interval = 50) {
  const deadline = Date.now() + timeout;
  for (;;) {
    let ok = false;
    try {
      ok = await condition();
    } catch {
      ok = false;
    }
    if (ok) return true;
    if (Date.now() >= deadline) return false;
    await world.page.waitForTimeout(interval);
  }
}

// ---------------------------------------------------------------------------
// The requests of the page, and a request the browser cut
// ---------------------------------------------------------------------------

const TRACKED = new WeakMap();

/**
 * The requests of a page, kept from the moment it opens: the fetch and XHR
 * requests still running, the main documents with their status, and the
 * requests that failed. Attached once per page (onNewPage, below).
 */
function requests(page) {
  let state = TRACKED.get(page);
  if (!state) {
    state = { pending: new Set(), documents: [], failures: [], fetched: [] };
    TRACKED.set(page, state);
    page.on('request', (request) => {
      const type = request.resourceType();
      if (type === 'fetch' || type === 'xhr') state.pending.add(request);
    });
    page.on('response', (response) => {
      const request = response.request();
      let main = false;
      try {
        main = request.resourceType() === 'document' && request.frame() === page.mainFrame();
      } catch {
        main = false;
      }
      if (main) {
        state.documents.push({ url: response.url(), status: response.status(), at: Date.now() });
        if (state.documents.length > 20) state.documents.shift();
      }
      const type = request.resourceType();
      if (type === 'fetch' || type === 'xhr') {
        state.fetched.push({ url: response.url(), status: response.status(), at: Date.now() });
        if (state.fetched.length > 100) state.fetched.shift();
      }
    });
    const done = (request) => { state.pending.delete(request); };
    page.on('requestfinished', done);
    page.on('requestfailed', (request) => {
      state.pending.delete(request);
      const error = (request.failure() && request.failure().errorText) || 'failed';
      state.failures.push({ url: request.url(), error, at: Date.now() });
      if (state.failures.length > 30) state.failures.shift();
    });
    // A new document drops the requests of the page it replaces.
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) state.pending.clear();
    });
  }
  return state;
}

/** The fetch and XHR requests of the page still running. */
function runningRequests(page) {
  return [...requests(page).pending].map((request) => request.url());
}

/** The status of the last main document the page loaded, or 0. */
function lastDocumentStatus(page) {
  const docs = requests(page).documents;
  return docs.length ? docs[docs.length - 1].status : 0;
}

/**
 * A sentence for a failure when the browser shows its own error page
 * (`chrome-error://…`) instead of the site's answer, or when a request of the
 * site failed with net::ERR_NETWORK_CHANGED: the request was cut before the
 * site answered, as Chromium does to every request in flight when the network
 * of the machine changes (a container starting or stopping on it). An empty
 * string otherwise.
 */
function cutRequest(world) {
  const url = world && world.page ? world.page.url() : '';
  if (/^chrome-error:/.test(url)) return `the browser shows its own error page (${url}): the request was cut before the site answered`;
  const state = world && world.page ? TRACKED.get(world.page) : null;
  const cut = state && state.failures.find((f) => /ERR_NETWORK_CHANGED|ERR_NETWORK_IO_SUSPENDED|ERR_INTERNET_DISCONNECTED/.test(f.error) && Date.now() - f.at < 60000);
  if (cut) return `a request of the site (${shortUrl(cut.url)}) was cut by the browser (${cut.error})`;
  return '';
}

/** The hint of a failure `cutRequest` explains. */
const CUT_REQUEST_HINT = 'Nothing is wrong with the scenario: Chromium cuts every request in flight when the network of the machine changes (a container starting or stopping on it). Run the scenario again, or run the suite inside the project\'s container.';

/** A failure, or the one that says a request was cut when the browser cut one. */
function failure(world, message, hint) {
  const cut = cutRequest(world);
  if (cut) return friendly({ message: `${message} But ${cut}.`, hint: CUT_REQUEST_HINT });
  return friendly({ message, hint });
}

// ---------------------------------------------------------------------------
// The console of the page
// ---------------------------------------------------------------------------

const CONSOLES = new WeakMap();

/**
 * The errors of the page's console and its uncaught errors, kept from the
 * moment it opens, cleared when the main document changes.
 */
function consoleOf(page) {
  let list = CONSOLES.get(page);
  if (!list) {
    list = [];
    CONSOLES.set(page, list);
    const keep = (entry) => {
      list.push(entry);
      if (list.length > 300) list.shift();
    };
    page.on('console', (message) => {
      const type = message.type();
      if (type === 'error' || type === 'warning') keep({ type, text: message.text(), at: Date.now() });
    });
    page.on('pageerror', (error) => keep({ type: 'pageerror', text: String((error && error.message) || error), at: Date.now() }));
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) list.splice(0, list.length);
    });
  }
  return list;
}

/**
 * The hydration errors of the console: React's own words in development
 * ("Hydration failed", "did not match") and its error codes in production
 * (#418, #419, #421, #422, #423, #425: the server's HTML and the first render
 * in the browser differ). The site's runtime reports them through its
 * onRecoverableError handler.
 */
function hydrationErrors(page) {
  return consoleOf(page)
    .filter((entry) => entry.type !== 'warning')
    .map((entry) => entry.text.split('\n')[0])
    .filter((text) => /hydrat|did not match|didn't match|Minified React error #(?:418|419|421|422|423|425)\b/i.test(text));
}

// ---------------------------------------------------------------------------
// The script every document of the run carries
// ---------------------------------------------------------------------------

/**
 * Put into every document before the site's own scripts (addInitScript): an
 * identity of the document (a full page load gives a new one, a client-side
 * navigation keeps it), and a record of what the page writes to the
 * clipboard (navigator.clipboard.writeText, document.execCommand('copy')).
 */
function documentScript() {
  if (window.__webshipDocs) return;
  const state = {
    document: Math.random().toString(36).slice(2) + Date.now().toString(36),
    copied: [],
  };
  Object.defineProperty(window, '__webshipDocs', { value: state, enumerable: false });
  const remember = (text) => {
    state.copied.push(String(text));
    if (state.copied.length > 20) state.copied.shift();
  };
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      const original = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = (text) => {
        remember(text);
        return original(text);
      };
    }
  } catch (e) { /* a browser without the clipboard API */ }
  const exec = document.execCommand.bind(document);
  document.execCommand = function (command) {
    if (String(command).toLowerCase() === 'copy') {
      const active = document.activeElement;
      const text = active && typeof active.value === 'string' && active.value ? active.value : String(document.getSelection() || '');
      remember(text);
    }
    return exec.apply(document, arguments);
  };
}

/** The identity of the document the page shows (see documentScript). */
async function documentId(world) {
  return world.page.evaluate(() => (window.__webshipDocs ? window.__webshipDocs.document : '')).catch(() => '');
}

/** What the page wrote to the clipboard, newest last. */
async function copiedTexts(world) {
  return world.page.evaluate(() => (window.__webshipDocs ? window.__webshipDocs.copied.slice() : [])).catch(() => []);
}

// The recorders go on every page of the run, before any step uses it.
onNewPage(async (world, page) => {
  requests(page);
  consoleOf(page);
  await page.addInitScript(documentScript);
});

// ---------------------------------------------------------------------------
// Is the page ready?
// ---------------------------------------------------------------------------

/** Runs in the page: what the site still has to do, by its own signals. */
function sitePending() {
  const out = [];
  if (document.readyState === 'loading') out.push('the document is still loading');
  const root = document.getElementById('__docusaurus');
  if (!root) return { site: false, out };
  if (document.documentElement.getAttribute('data-has-hydrated') !== 'true') out.push('the page is not hydrated yet');
  const scripts = document.querySelectorAll('script[data-rspack], script[data-webpack]').length;
  if (scripts) out.push(`${scripts} script(s) of a page still loading`);
  if (document.getElementById('nprogress')) out.push('the progress bar of a page change is still shown');
  return { site: true, out };
}

/** What the page still has to do: '' when it is ready (see the head of this file). */
async function pendingWork(world) {
  let state;
  try {
    state = await world.page.evaluate(sitePending);
  } catch (err) {
    // A navigation replaced the document while it was read: not ready yet.
    return /Execution context was destroyed|navigation|Target closed|has been closed/i.test(String(err && err.message)) ? 'a new page is loading' : '';
  }
  const busy = state.out.slice();
  const running = runningRequests(world.page);
  if (running.length) busy.push(`${running.length} request(s) running: ${running.slice(0, 3).map(shortUrl).join(', ')}`);
  return busy.join('; ');
}

/** Is the page a page of the site (it has the root the site's runtime renders into)? */
async function isSitePage(world) {
  return world.page.evaluate(() => Boolean(document.getElementById('__docusaurus'))).catch(() => false);
}

/**
 * Wait until the page is ready (see the head of this file) and stays so for
 * a moment (150 ms). Returns '' when it is, else what it was still doing when
 * the time ran out; `strict` makes that a failure.
 */
async function pageReady(world, { timeout, strict = false } = {}) {
  const limit = timeout || budget(world) * 2;
  const deadline = Date.now() + limit;
  requests(world.page);
  let busy = '';
  let quietSince = 0;
  for (;;) {
    busy = await pendingWork(world);
    if (!busy) {
      if (!quietSince) quietSince = Date.now();
      if (Date.now() - quietSince >= 150) return '';
    } else {
      quietSince = 0;
    }
    if (Date.now() > deadline) break;
    await world.page.waitForTimeout(40);
  }
  if (strict) {
    throw failure(world, `The page did not get ready within ${limit} ms (${world.page.url()}): ${busy}.`, 'A page is ready when it is loaded and hydrated, no script of a page is still loading, the progress bar of a page change is gone and no request of the page is running. A script or a request that never ends is a fault of the site or of its server: check the browser console and the network.');
  }
  return busy;
}

/**
 * Run an action that may make the site work (a click, a key), and wait for
 * that work to finish: for a page change, a script, a request or a new
 * document to start (a moment at most), then for the page to be ready, then
 * for webship-js's own settle (requests, timers, a quiet DOM).
 */
async function afterAction(world, fn) {
  const page = world.page;
  const state = requests(page);
  const url = page.url();
  const docs = state.documents.length;
  const result = await fn();
  const startBy = Date.now() + 600;
  while (Date.now() < startBy) {
    if (page.url() !== url || state.documents.length !== docs || state.pending.size) break;
    const loading = await page.evaluate(() => document.querySelectorAll('script[data-rspack], script[data-webpack]').length > 0 || Boolean(document.getElementById('nprogress'))).catch(() => true);
    if (loading) break;
    await page.waitForTimeout(25);
  }
  await page.waitForLoadState('domcontentloaded', { timeout: budget(world) }).catch(() => {});
  await pageReady(world);
  if (typeof world.smartSettle === 'function') await world.smartSettle(1500).catch(() => {});
  return result;
}

/** Open an address of the site and wait for the page to be ready. */
async function open(world, url) {
  requests(world.page);
  await gotoUrl(world.page, siteUrl(world, url));
  await world.page.waitForLoadState('load', { timeout: budget(world) }).catch(() => {});
  await pageReady(world);
}

/**
 * Fail unless the page is a page of the site, hydrated and ready: the first
 * thing most steps do. `what` names the step's subject for the message.
 */
async function readySitePage(world, what) {
  const busy = await pageReady(world);
  if (!(await isSitePage(world))) {
    throw failure(world, `Expected a page of the site to look for ${what}, but ${world.page.url()} has no root of the site (#__docusaurus).`, 'Check LAUNCH_URL and the path: a proxy error page, a redirect to another site or a file that is not a page (a feed, an image) has no root of the site.');
  }
  if (busy && /not hydrated/.test(busy)) {
    throw failure(world, `The page did not hydrate, so ${what} cannot be used (${world.page.url()}): ${busy}.`, 'The page scripts did not load or failed: check the browser console and the network for /assets/js/runtime~main.*.js and main.*.js.');
  }
}

// ---------------------------------------------------------------------------
// The parts of the page, by name
// ---------------------------------------------------------------------------

/**
 * The parts of a page a step can name, each with the selectors that find it
 * (the first one visible wins). The theme's class names come first: they do
 * not change with the language of the page, unlike the aria-labels.
 */
const REGIONS = {
  navbar: ['nav.theme-layout-navbar', 'nav.navbar'],
  'navigation menu': ['.theme-layout-navbar-sidebar', '.navbar-sidebar'],
  sidebar: ['.theme-doc-sidebar-container nav', 'nav.menu'],
  'table of contents': ['.theme-doc-toc-desktop', '.theme-doc-toc-mobile'],
  breadcrumbs: ['nav.theme-doc-breadcrumbs', 'nav[aria-label="Breadcrumbs"]'],
  'version banner': ['.theme-doc-version-banner'],
  'announcement bar': ['.theme-announcement-bar'],
  footer: ['footer.theme-layout-footer', 'footer.footer'],
  'blog sidebar': ['.blog-wrapper aside nav', 'nav[aria-label="Blog recent posts navigation"]'],
  'search results': ['.navbar__search [role="listbox"]', 'article[class*="searchResultItem"]'],
  content: ['article', 'main', '#__docusaurus_skipToContent_fallback'],
};

/** The names a step accepts for a part of the page, for a regex. */
const REGION_NAMES = Object.keys(REGIONS).join('|');

/** The first visible element of a part of the page, or null. */
async function regionLocator(world, name) {
  const selectors = REGIONS[name];
  if (!selectors) throw new Error(`Unknown part of the page "${name}".`);
  for (const selector of selectors) {
    const all = world.page.locator(selector);
    const count = await all.count().catch(() => 0);
    for (let i = 0; i < count; i += 1) {
      const candidate = all.nth(i);
      if (await candidate.isVisible().catch(() => false)) return candidate;
    }
  }
  return null;
}

/** Wait for a part of the page to be visible, or fail saying what is there. */
async function region(world, name) {
  let found = null;
  await poll(world, async () => {
    found = await regionLocator(world, name);
    return Boolean(found);
  });
  if (!found) {
    throw failure(world, `Expected the ${name} on ${shortUrl(world.page.url()) || world.page.url()}, but the page shows none.`, REGION_HINTS[name] || 'Check the address of the page: not every page has every part.');
  }
  return found;
}

const REGION_HINTS = {
  sidebar: 'Only the pages of the docs have a sidebar; at a narrow width it moves into the navigation menu (open it first).',
  'table of contents': 'A page with headings has a table of contents; at a narrow width it is the "On this page" button above the page.',
  breadcrumbs: 'The pages of the docs show breadcrumbs above their title.',
  'version banner': 'Only the pages of an old or an unreleased version of the docs show a version banner.',
  'announcement bar': 'The announcement bar is set in themeConfig.announcementBar; once closed it stays closed in that browser.',
  'blog sidebar': 'The pages of the blog show the recent posts beside the posts, on a wide screen.',
  'search results': 'Search first ("When I search for …"): the results open under the search box.',
  'navigation menu': 'At a narrow width the navbar folds into a menu: open it first ("When I open the navigation menu").',
};

/** The text a person reads for an element: its accessible name, else its text. */
async function readableName(locator) {
  return locator.evaluate((el) => {
    const label = el.getAttribute('aria-label');
    const text = (el.innerText || el.textContent || '').replace(/[​ ]/g, ' ').replace(/\s+/g, ' ').trim();
    return text || label || '';
  }).catch(() => '');
}

/**
 * The visible links (and buttons, with `buttons`) of a part of the page
 * whose text is `text` (case and spacing ignored); an exact match first,
 * then a link whose text starts with it. Resolves `{ match, seen }`.
 */
async function findClickable(world, scope, text, { buttons = false } = {}) {
  const selector = buttons ? 'a[href], button, [role="button"], [role="tab"], [role="option"]' : 'a[href]';
  const all = scope.locator(selector);
  const count = await all.count();
  const seen = [];
  let prefix = null;
  for (let i = 0; i < count; i += 1) {
    const item = all.nth(i);
    if (!(await item.isVisible().catch(() => false))) continue;
    const name = await readableName(item);
    const label = clean(await item.getAttribute('aria-label').catch(() => ''));
    seen.push(name);
    if (same(name, text) || (label && same(label, text))) return { match: item, seen };
    if (!prefix && clean(name).toLowerCase().startsWith(clean(text).toLowerCase())) prefix = item;
  }
  return { match: prefix, seen };
}

/** Bring an element to the middle of the window, so the fixed navbar never covers it. */
async function centre(locator) {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' })).catch(() => {});
}

/** Click an element the way a person does, then wait for what it starts. */
async function clickAndWait(world, locator) {
  await centre(locator);
  await afterAction(world, () => locator.click({ timeout: budget(world) }));
}

// ---------------------------------------------------------------------------
// The menus of the navbar
// ---------------------------------------------------------------------------

/**
 * The menus of the navbar on a wide screen: each `div.dropdown` with its
 * toggle and its items. `kind` is 'locale' (its items carry a lang
 * attribute), 'version' (its toggle links to a page of the docs, as the
 * version menu's does) or 'menu'.
 */
async function navbarMenus(world) {
  return world.page.evaluate(() => {
    const clean = (t) => String(t || '').replace(/[​ ]/g, ' ').replace(/\s+/g, ' ').trim();
    return [...document.querySelectorAll('nav.navbar .navbar__items .dropdown')].map((dropdown, index) => {
      const toggle = dropdown.querySelector(':scope > a, :scope > button');
      const items = [...dropdown.querySelectorAll('.dropdown__menu a, .dropdown__menu button')];
      const href = toggle ? toggle.getAttribute('href') : null;
      let kind = 'menu';
      if (items.some((a) => a.hasAttribute('lang'))) kind = 'locale';
      else if (href && href !== '#' && items.length && items.every((a) => (a.getAttribute('href') || '').startsWith('/'))) kind = 'version';
      return {
        index,
        kind,
        label: toggle ? clean(toggle.textContent) : '',
        items: items.map((a) => ({ label: clean(a.textContent), href: a.getAttribute('href'), active: a.classList.contains('dropdown__link--active'), external: a.getAttribute('target') === '_blank' })),
        visible: dropdown.getBoundingClientRect().width > 0 && getComputedStyle(dropdown).display !== 'none',
      };
    });
  }).catch(() => []);
}

/** The menu of the navbar a step names: 'version', 'locale', or a label. */
async function findMenu(world, which) {
  const menus = (await navbarMenus(world)).filter((m) => m.visible);
  let menu = null;
  if (which === 'version' || which === 'locale') menu = menus.find((m) => m.kind === which) || null;
  else menu = menus.find((m) => same(m.label, which)) || null;
  return { menu, menus };
}

/** Describe the menus of the navbar for a message. */
function describeMenus(menus) {
  if (!menus.length) return 'the navbar has no menu';
  return 'the navbar has ' + menus.map((m) => `${m.kind === 'menu' ? 'the menu' : `the ${m.kind} menu`} "${m.label}" (${listed(m.items.map((i) => i.label))})`).join(', ');
}

/** The name a step gives a menu, for messages. */
function menuName(which) {
  if (which === 'version') return 'the version menu';
  if (which === 'locale') return 'the language menu';
  return `the "${which}" menu of the navbar`;
}

/**
 * Open a menu of the navbar the way a person with a mouse does: point at it
 * (the menus open on hover). Resolves the menu's locator once its items are
 * visible.
 */
async function openMenu(world, which) {
  await readySitePage(world, menuName(which));
  let found = null;
  let menus = [];
  await poll(world, async () => {
    const r = await findMenu(world, which);
    found = r.menu;
    menus = r.menus;
    return Boolean(found);
  }, budget(world) / 2);
  if (!found) {
    throw failure(world, `Expected ${menuName(which)}, but ${describeMenus(menus)}.`, which === 'version'
      ? 'The version menu is a navbar item of type docsVersionDropdown; the docs need more than one version (docusaurus docs:version).'
      : which === 'locale' ? 'The language menu is a navbar item of type localeDropdown; the site needs more than one locale (i18n.locales).'
        : 'Name the menu by the label the navbar shows. At a narrow width the menus move into the navigation menu.');
  }
  const dropdown = world.page.locator('nav.navbar .navbar__items .dropdown').nth(found.index);
  await centre(dropdown);
  await dropdown.hover();
  const menuList = dropdown.locator('.dropdown__menu');
  const shown = await poll(world, () => menuList.isVisible(), budget(world) / 2);
  if (!shown) {
    throw failure(world, `${menuName(which)} did not open when the pointer was on it.`, 'The menus of the navbar open on hover (and with Enter on the keyboard). Something may cover the navbar: check the screenshot.');
  }
  return { dropdown, menu: found };
}

// ---------------------------------------------------------------------------
// Colour mode
// ---------------------------------------------------------------------------

/** The colour mode the page shows and the one chosen (light, dark or system). */
async function colourMode(world) {
  return world.page.evaluate(() => ({
    shown: document.documentElement.getAttribute('data-theme') || '',
    choice: document.documentElement.getAttribute('data-theme-choice') || '',
  })).catch(() => ({ shown: '', choice: '' }));
}

module.exports = {
  budget,
  escapeRegExp,
  clean,
  same,
  listed,
  splitList,
  siteRoot,
  siteUrl,
  currentPath,
  pathOf,
  shortUrl,
  poll,
  requests,
  runningRequests,
  lastDocumentStatus,
  cutRequest,
  CUT_REQUEST_HINT,
  failure,
  consoleOf,
  hydrationErrors,
  documentScript,
  documentId,
  copiedTexts,
  sitePending,
  pendingWork,
  isSitePage,
  pageReady,
  afterAction,
  open,
  readySitePage,
  REGIONS,
  REGION_NAMES,
  regionLocator,
  region,
  readableName,
  findClickable,
  centre,
  clickAndWait,
  navbarMenus,
  findMenu,
  describeMenus,
  menuName,
  openMenu,
  colourMode,
  friendly,
};
