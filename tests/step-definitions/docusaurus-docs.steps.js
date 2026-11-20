'use strict';

// Step definitions for the pages of the docs: the categories of the sidebar
// and its active page, the table of contents and the heading it marks while
// the page scrolls, the headings and their anchor links, the next and the
// previous page, the breadcrumbs, the "Edit this page" link, the version of
// the page and its version banner.

const { When, Then } = require('@cucumber/cucumber');
const {
  budget, clean, same, listed, splitList, shortUrl, poll, pageReady, afterAction, readySitePage,
  failure, region, centre,
} = require('./docusaurus-helpers');

/** The categories of the sidebar, as the page shows them. */
async function categories(world) {
  return world.page.evaluate(() => {
    const clean = (t) => String(t || '').replace(/[​ ]/g, ' ').replace(/\s+/g, ' ').trim();
    const containers = [...document.querySelectorAll('.theme-doc-sidebar-container, .navbar-sidebar')];
    const visible = (el) => el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== 'hidden';
    const out = [];
    for (const container of containers.filter(visible)) {
      for (const [index, li] of [...container.querySelectorAll('li.theme-doc-sidebar-item-category')].entries()) {
        const head = li.querySelector(':scope > .menu__list-item-collapsible, :scope > div');
        const label = head ? clean(head.textContent) : '';
        const caret = li.querySelector(':scope > div > button.menu__caret, :scope > div > button[aria-expanded]');
        const link = li.querySelector(':scope > div > a.menu__link');
        const list = li.querySelector(':scope > ul');
        const style = list ? getComputedStyle(list) : null;
        out.push({
          container: container.classList.contains('navbar-sidebar') ? 'menu' : 'sidebar',
          index,
          label,
          collapsed: li.classList.contains('menu__list-item--collapsed'),
          expanded: caret ? caret.getAttribute('aria-expanded') : (link ? link.getAttribute('aria-expanded') : null),
          settled: !list || (style.display === 'none' && li.classList.contains('menu__list-item--collapsed')) || (style.display !== 'none' && (list.style.height === 'auto' || list.style.height === '') && !li.classList.contains('menu__list-item--collapsed')),
          visible: visible(li),
        });
      }
    }
    return out;
  }).catch(() => []);
}

async function findCategory(world, label) {
  const all = await categories(world);
  return { category: all.find((c) => c.visible && same(c.label, label)) || null, all };
}

/**
 * Expand or collapse a category of the sidebar with its arrow button (its
 * accessible name is "Expand sidebar category '<label>'" or "Collapse …"),
 * and wait until the category has finished opening or closing (the sidebar
 * animates the height of the list).
 *
 * Example #1: When I expand the "Guides" category in the sidebar
 * Example #2: And I collapse the "Getting Started" category in the sidebar
 * Example #3: When we expand the "Reference" category in the sidebar
 * Example #4: When expand the "Guides" category in the sidebar
 * Example #5: And I collapse the "Guides" category in the sidebar
 */
When(/^(I |we )*(expand|collapse) the "([^"]*)?" category in the sidebar$/, async function (pronoun, action, label) {
  await readySitePage(this, `the "${label}" category`);
  await region(this, 'sidebar');
  const { category, all } = await findCategory(this, label);
  if (!category) {
    throw failure(this, `The sidebar has no category "${label}". Its categories: ${listed(all.filter((c) => c.visible).map((c) => c.label))}.`, 'Name the category by the label the sidebar shows (it may be translated).');
  }
  const wantCollapsed = action === 'collapse';
  if (category.collapsed === wantCollapsed && category.settled) return;
  const scope = category.container === 'menu' ? '.navbar-sidebar' : '.theme-doc-sidebar-container';
  const li = this.page.locator(`${scope} li.theme-doc-sidebar-item-category`).nth(category.index);
  const button = li.locator(':scope > div > button').first();
  const target = (await button.count()) ? button : li.locator(':scope > div > a').first();
  await centre(target);
  await afterAction(this, () => target.click({ timeout: budget(this) }));
  let seen;
  const ok = await poll(this, async () => {
    seen = (await findCategory(this, label)).category;
    return Boolean(seen) && seen.collapsed === wantCollapsed && seen.settled;
  }, budget(this) / 2);
  if (!ok) throw failure(this, `The "${label}" category of the sidebar did not ${action}.`, 'A category without an arrow button (collapsible: false) cannot be collapsed; look at the screenshot of the failure.');
});

/**
 * Assert a category of the sidebar is expanded (its pages shown) or
 * collapsed. A category that holds the page shown is expanded when the page
 * opens; the others follow `collapsed` in their _category_.json.
 *
 * Example #1: Then the "Getting Started" category in the sidebar should be expanded
 * Example #2: And the "Guides" category in the sidebar should be collapsed
 * Example #3: Then "Reference" category in the sidebar should be collapsed
 * Example #4: But the "Guides" category in the sidebar should be expanded
 * Example #5: And the "Getting Started" category in the sidebar should be collapsed
 */
Then(/^(?:the )?"([^"]*)?" category in the sidebar should be (expanded|collapsed)$/, async function (label, state) {
  await readySitePage(this, `the "${label}" category`);
  await region(this, 'sidebar');
  let seen = null;
  let all = [];
  const ok = await poll(this, async () => {
    const r = await findCategory(this, label);
    seen = r.category;
    all = r.all;
    return Boolean(seen) && seen.settled && seen.collapsed === (state === 'collapsed');
  }, budget(this) / 2);
  if (!ok) {
    if (!seen) throw failure(this, `The sidebar has no category "${label}". Its categories: ${listed(all.filter((c) => c.visible).map((c) => c.label))}.`, 'Name the category by the label the sidebar shows (it may be translated).');
    throw failure(this, `Expected the "${label}" category of the sidebar to be ${state}, but it is ${seen.collapsed ? 'collapsed' : 'expanded'}.`, 'A category opens when its arrow is clicked, when the page shown is in it, or when its _category_.json says collapsed: false.');
  }
});

/**
 * Assert which page the sidebar marks as the one shown: its link has
 * `aria-current="page"` (and the class `menu__link--active`).
 *
 * Example #1: Then the active page in the sidebar should be "Installation"
 * Example #2: And the active page in the sidebar should be "Writing Content"
 * Example #3: Then active page in the sidebar should be "Introduction"
 * Example #4: And the active page in the sidebar should be "Configuration"
 * Example #5: Then the active page in the sidebar should be "Deployment"
 */
Then(/^(?:the )?active page in the sidebar should be "([^"]*)?"$/, async function (label) {
  await readySitePage(this, 'the active page of the sidebar');
  const sidebar = await region(this, 'sidebar');
  let active = [];
  const ok = await poll(this, async () => {
    active = await sidebar.evaluate((el) => [...el.querySelectorAll('a[aria-current="page"]')].map((a) => a.textContent.replace(/\s+/g, ' ').trim()));
    return active.some((a) => same(a, label));
  }, budget(this) / 2);
  if (!ok) {
    throw failure(this, `Expected the sidebar to mark "${label}" as the page shown, but it marks ${listed(active)}.`, 'The sidebar marks the page whose address the browser shows: check the address, and that the page is in this sidebar.');
  }
});

/** The headings of the content, with their anchors. */
async function headings(world) {
  return world.page.evaluate(() => [...document.querySelectorAll('article h1, article h2, article h3, article h4, article h5, article h6, main h1, main h2, main h3, main h4')]
    .filter((h, i, all) => all.indexOf(h) === i)
    .map((h) => {
      const anchor = h.querySelector('a.hash-link');
      const text = [...h.childNodes].filter((n) => !(n.nodeType === 1 && n.classList.contains('hash-link'))).map((n) => n.textContent).join('').replace(/[​ ]/g, ' ').replace(/\s+/g, ' ').trim();
      return { text, id: h.id, anchor: anchor ? anchor.getAttribute('href') : null };
    })).catch(() => []);
}

async function findHeading(world, text) {
  const all = await headings(world);
  return { heading: all.find((h) => same(h.text, text)) || null, all };
}

function headingLocator(world, id) {
  return world.page.locator(`[id="${String(id).replace(/"/g, '\\"')}"]`).first();
}

/**
 * Scroll down (or up) to a heading of the page, as a reader does, until the
 * heading is at the top of the window, below the navbar. The table of
 * contents follows the scroll.
 *
 * Example #1: When I scroll to the heading "Links"
 * Example #2: And I scroll to the heading "Tables"
 * Example #3: When we scroll to the heading "Long pages"
 * Example #4: When scroll to the heading "Headings"
 * Example #5: And I scroll to the heading "Notes and warnings"
 */
When(/^(I |we )*scroll to the heading "([^"]*)?"$/, async function (pronoun, text) {
  await readySitePage(this, `the heading "${text}"`);
  const { heading, all } = await findHeading(this, text);
  if (!heading || !heading.id) {
    throw failure(this, `The page has no heading "${text}". Its headings: ${listed(all.map((h) => h.text))}.`, 'Name the heading by its text, without the "#" of its anchor.');
  }
  await afterAction(this, () => headingLocator(this, heading.id).evaluate((el) => el.scrollIntoView({ block: 'start' })));
});

/**
 * Assert a heading of the page is in the window, not hidden under the navbar
 * that stays at the top.
 *
 * Example #1: Then the heading "Headings" should be in view
 * Example #2: And the heading "Behind a firewall" should be in view
 * Example #3: Then heading "Getting help" should be in view
 * Example #4: But the heading "Links" should not be in view
 * Example #5: And the heading "Tables" should be in view
 */
Then(/^(?:the )?heading "([^"]*)?" should( not)* be in view$/, async function (text, notCase) {
  await readySitePage(this, `the heading "${text}"`);
  const { heading, all } = await findHeading(this, text);
  if (!heading || !heading.id) {
    throw failure(this, `The page has no heading "${text}". Its headings: ${listed(all.map((h) => h.text))}.`, 'Name the heading by its text, without the "#" of its anchor.');
  }
  let box;
  const ok = await poll(this, async () => {
    box = await headingLocator(this, heading.id).evaluate((el) => {
      const r = el.getBoundingClientRect();
      const bar = document.querySelector('nav.navbar');
      const top = bar && getComputedStyle(bar).position === 'fixed' ? bar.getBoundingClientRect().bottom : 0;
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), below: Math.round(top), height: window.innerHeight };
    });
    const inView = box.top >= box.below - 2 && box.bottom <= box.height;
    return inView === !notCase;
  }, notCase ? 1500 : budget(this) / 2);
  if (!ok) {
    throw failure(this, notCase
      ? `Expected the heading "${text}" out of view, but it is in the window (top ${box.top} px).`
      : `Expected the heading "${text}" in view, but its top is at ${box.top} px (the window shows ${box.below} to ${box.height} px below the navbar).`,
    'A link to a heading scrolls it below the navbar; a page that ends soon after the heading cannot scroll it to the top, but keeps it in the window.');
  }
});

/**
 * Click the anchor link of a heading (the "#" that shows when the pointer is
 * on the heading; its accessible name is "Direct link to <heading>"), which
 * puts the heading's address in the address bar and scrolls to it.
 *
 * Example #1: When I click the anchor link of the heading "Getting help"
 * Example #2: And I click the anchor link of the heading "Download"
 * Example #3: When we click the anchor link of the heading "Links"
 * Example #4: When click the anchor link of the heading "Tables"
 * Example #5: And I click the anchor link of the heading "Behind a firewall"
 */
When(/^(I |we )*click the anchor link of the heading "([^"]*)?"$/, async function (pronoun, text) {
  await readySitePage(this, `the anchor link of the heading "${text}"`);
  const { heading, all } = await findHeading(this, text);
  if (!heading) throw failure(this, `The page has no heading "${text}". Its headings: ${listed(all.map((h) => h.text))}.`, 'Name the heading by its text, without the "#" of its anchor.');
  if (!heading.anchor) throw failure(this, `The heading "${text}" has no anchor link.`, 'The headings of a page of the docs and of a blog post get an anchor link; the title (h1) has none.');
  const element = headingLocator(this, heading.id);
  await centre(element);
  await element.hover();
  await afterAction(this, () => element.locator('a.hash-link').first().click({ timeout: budget(this) }));
});

/**
 * Assert the address of the page points to a heading: its fragment is the
 * heading's id (`#getting-help`), as after its anchor link was clicked or a
 * link to it was opened.
 *
 * Example #1: Then the address should point to the heading "Getting help"
 * Example #2: And the address should point to the heading "Behind a firewall"
 * Example #3: Then address should point to the heading "Headings"
 * Example #4: And the address should point to the heading "Download"
 * Example #5: Then the address should point to the heading "Links"
 */
Then(/^(?:the )?address should point to the heading "([^"]*)?"$/, async function (text) {
  await readySitePage(this, `the heading "${text}"`);
  const { heading, all } = await findHeading(this, text);
  if (!heading || !heading.id) throw failure(this, `The page has no heading "${text}". Its headings: ${listed(all.map((h) => h.text))}.`, 'Name the heading by its text, without the "#" of its anchor.');
  let hash = '';
  const ok = await poll(this, async () => {
    hash = decodeURIComponent(new URL(this.page.url()).hash || '');
    return hash === `#${heading.id}`;
  }, budget(this) / 2);
  if (!ok) throw failure(this, `Expected the address to point to the heading "${text}" (#${heading.id}), but its fragment is "${hash || '(none)'}".`, 'The address points to a heading once its anchor link, a link of the table of contents or a link to #<id> was followed.');
});

/**
 * Assert which heading the table of contents marks as the one being read
 * (`table-of-contents__link--active`); it follows the scroll of the page.
 *
 * Example #1: Then the table of contents should highlight "Links"
 * Example #2: And the table of contents should highlight "Notes and warnings"
 * Example #3: Then table of contents should highlight "Tables"
 * Example #4: And the table of contents should highlight "Long pages"
 * Example #5: Then the table of contents should highlight "Headings"
 */
Then(/^(?:the )?table of contents should highlight "([^"]*)?"$/, async function (text) {
  await readySitePage(this, 'the table of contents');
  const toc = await region(this, 'table of contents');
  let active = [];
  const ok = await poll(this, async () => {
    active = await toc.evaluate((el) => [...el.querySelectorAll('a.table-of-contents__link--active')].map((a) => a.textContent.replace(/\s+/g, ' ').trim()));
    return active.some((a) => same(a, text));
  }, budget(this) / 2);
  if (!ok) {
    throw failure(this, `Expected the table of contents to highlight "${text}", but it highlights ${listed(active)}.`, 'The table of contents marks the heading of the part of the page at the top of the window: scroll to the heading first (When I scroll to the heading "…").');
  }
});

/** The links of the pager at the foot of a page of the docs. */
async function pager(world) {
  return world.page.evaluate(() => {
    const nav = document.querySelector('nav.pagination-nav');
    const read = (cls) => {
      const a = nav && nav.querySelector(`a.pagination-nav__link--${cls}`);
      if (!a) return null;
      const label = a.querySelector('.pagination-nav__label');
      return { label: (label ? label.textContent : a.textContent).replace(/[«»]/g, '').replace(/\s+/g, ' ').trim(), href: a.getAttribute('href') };
    };
    return { nav: Boolean(nav), name: nav ? nav.getAttribute('aria-label') : '', prev: read('prev'), next: read('next') };
  }).catch(() => ({ nav: false, name: '', prev: null, next: null }));
}

/**
 * Assert the title the pager at the foot of a page of the docs gives the
 * next or the previous page.
 *
 * Example #1: Then the next page should be "Configuration"
 * Example #2: And the previous page should be "Getting Started"
 * Example #3: Then next page should be "Installation"
 * Example #4: And the previous page should be "Introduction"
 * Example #5: Then the next page should be "Deployment"
 */
Then(/^(?:the )?(next|previous) page should be "([^"]*)?"$/, async function (which, title) {
  await readySitePage(this, `the ${which} page`);
  const cls = which === 'next' ? 'next' : 'prev';
  let seen;
  const ok = await poll(this, async () => {
    seen = await pager(this);
    return Boolean(seen[cls]) && same(seen[cls].label, title);
  }, budget(this) / 2);
  if (!ok) {
    if (!seen.nav) throw failure(this, `The page has no pager at its foot (${shortUrl(this.page.url())}).`, 'The pages of the docs end with a pager to the previous and the next page of the sidebar; pagination_next/pagination_prev in the front matter can change or remove them.');
    throw failure(this, `Expected the ${which} page to be "${title}", but the pager gives ${seen[cls] ? `"${seen[cls].label}"` : `no ${which} page`}.`, 'The pager follows the order of the sidebar.');
  }
});

/**
 * Assert the pager at the foot of a page of the docs has no link to the next
 * (or the previous) page: the first and the last pages of a sidebar.
 *
 * Example #1: Then there should be no previous page
 * Example #2: And there should be no next page
 * Example #3: Then there should be no next page
 * Example #4: But there should be no previous page
 * Example #5: And there should be no previous page
 */
Then(/^there should be no (next|previous) page$/, async function (which) {
  await readySitePage(this, `the ${which} page`);
  const seen = await pager(this);
  const link = seen[which === 'next' ? 'next' : 'prev'];
  if (link) throw failure(this, `Expected no ${which} page, but the pager links to "${link.label}" (${link.href}).`, 'Only the first page of a sidebar has no previous page, and only its last page has no next one.');
});

/**
 * Go to the next or the previous page with the pager at the foot of a page
 * of the docs; the page opens in the same document.
 *
 * Example #1: When I go to the next page
 * Example #2: And I go to the previous page
 * Example #3: When we go to the next page
 * Example #4: When go to the previous page
 * Example #5: Then I go to the next page
 */
When(/^(I |we )*go to the (next|previous) page$/, async function (pronoun, which) {
  await readySitePage(this, `the ${which} page`);
  const cls = which === 'next' ? 'next' : 'prev';
  const link = this.page.locator(`nav.pagination-nav a.pagination-nav__link--${cls}`).first();
  if (!(await link.count())) throw failure(this, `The page has no link to the ${which} page at its foot.`, 'The pager is at the foot of the pages of the docs; the first page has no previous page and the last no next one.');
  const href = await link.getAttribute('href');
  await centre(link);
  await afterAction(this, () => link.click({ timeout: budget(this) }));
  const arrived = await poll(this, async () => new URL(this.page.url()).pathname.replace(/\/+$/, '') === String(href).replace(/\/+$/, ''), budget(this) / 2);
  if (!arrived) throw failure(this, `The link to the ${which} page leads to ${href}, but the browser shows ${shortUrl(this.page.url())}.`, 'Look at the screenshot of the failure.');
});

/**
 * Assert the breadcrumbs above the title of a page of the docs, as a list
 * read from the first crumb (the link to the home page, read by its
 * accessible name, "Home page") to the page itself.
 *
 * Example #1: Then the breadcrumbs should be "Home page, Guides, Writing Content"
 * Example #2: And the breadcrumbs should be "Home page, Introduction"
 * Example #3: Then breadcrumbs should be "Home page, Getting Started, Installation"
 * Example #4: And the breadcrumbs should be "Home page, Getting Started"
 * Example #5: Then the breadcrumbs should be "Home page, Reference, FAQ"
 */
Then(/^(?:the )?breadcrumbs should be "([^"]*)?"$/, async function (list) {
  await readySitePage(this, 'the breadcrumbs');
  const crumbsRegion = await region(this, 'breadcrumbs');
  const wanted = splitList(list);
  let seen = [];
  const ok = await poll(this, async () => {
    seen = await crumbsRegion.evaluate((el) => [...el.querySelectorAll('li')].map((li) => {
      const text = li.textContent.replace(/[​ ]/g, ' ').replace(/\s+/g, ' ').trim();
      const link = li.querySelector('a');
      return text || (link ? link.getAttribute('aria-label') || '' : '');
    }));
    return seen.length === wanted.length && seen.every((s, i) => same(s, wanted[i]));
  }, budget(this) / 2);
  if (!ok) throw failure(this, `Expected the breadcrumbs ${listed(wanted)}, but they are ${listed(seen)}.`, 'The breadcrumbs follow the categories of the sidebar, from the home page to the page shown.');
});

/** The "Edit this page" link of the page, or null. */
async function editLink(world) {
  return world.page.evaluate(() => {
    const a = document.querySelector('a.theme-edit-this-page');
    return a ? { href: a.getAttribute('href'), text: a.textContent.trim(), target: a.getAttribute('target') } : null;
  }).catch(() => null);
}

/**
 * Assert the page has an "Edit this page" link to an address, the whole of
 * it ("to") or its end ("ending with"), or that it has none. The address is
 * the editUrl of the site's configuration followed by the file of the page.
 *
 * Example #1: Then the page should have an edit link ending with "docs/intro.mdx"
 * Example #2: And the page should have an edit link to "https://example.com/docs/edit/main/docs/intro.mdx"
 * Example #3: Then page should have an edit link ending with "version-1.0/intro.mdx"
 * Example #4: But the page should not have an edit link
 * Example #5: And the page should have an edit link ending with "blog/2026-07-08-version-2-0.mdx"
 */
Then(/^(?:the )?page should (?:have an edit link (to|ending with) "([^"]*)?"|(not) have an edit link)$/, async function (mode, url, notCase) {
  await readySitePage(this, 'the edit link');
  let link = null;
  if (notCase) {
    link = await editLink(this);
    if (link) throw failure(this, `Expected no "Edit this page" link, but the page links to ${link.href}.`, 'A page has an edit link when editUrl is set for its plugin; a generated index of a category has none.');
    return;
  }
  const ok = await poll(this, async () => {
    link = await editLink(this);
    if (!link) return false;
    return mode === 'to' ? link.href === url : link.href.endsWith(url);
  }, budget(this) / 2);
  if (!ok) {
    throw failure(this, link
      ? `Expected the "Edit this page" link ${mode} "${url}", but it is ${link.href}.`
      : `Expected an "Edit this page" link ${mode} "${url}", but the page has none.`,
    'The link is the editUrl of the docs or the blog in docusaurus.config followed by the path of the file; a version of the docs points to versioned_docs/version-<name>/.');
  }
});

/** The version banner of the page and the version the page shows. */
async function versionInfo(world) {
  return world.page.evaluate(() => {
    const banner = document.querySelector('.theme-doc-version-banner');
    const badge = document.querySelector('.theme-doc-version-badge');
    const meta = document.querySelector('meta[name="docusaurus_version"]');
    const visible = (el) => Boolean(el) && el.getBoundingClientRect().height > 0;
    return {
      banner: visible(banner) ? banner.textContent.replace(/\s+/g, ' ').trim() : '',
      links: visible(banner) ? [...banner.querySelectorAll('a')].map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href') })) : [],
      badge: badge ? badge.textContent.replace(/\s+/g, ' ').trim() : '',
      meta: meta ? meta.getAttribute('content') : '',
    };
  }).catch(() => ({ banner: '', links: [], badge: '', meta: '' }));
}

/**
 * Assert the page does (or does not) show a version banner: a page of an
 * old version ("…which is no longer actively maintained.") or of the
 * unreleased one ("This is unreleased documentation…") shows one above its
 * title; a page of the latest version shows none.
 *
 * Example #1: Then the page should show a version banner
 * Example #2: But the page should not show a version banner
 * Example #3: Then page should show a version banner
 * Example #4: And the page should not show a version banner
 * Example #5: And the page should show a version banner
 */
Then(/^(?:the )?page should( not)* show a version banner$/, async function (notCase) {
  await readySitePage(this, 'the version banner');
  let seen;
  const ok = await poll(this, async () => {
    seen = await versionInfo(this);
    return Boolean(seen.banner) === !notCase;
  }, notCase ? 1500 : budget(this) / 2);
  if (!ok) {
    throw failure(this, notCase
      ? `Expected no version banner, but the page shows "${seen.banner}".`
      : `Expected a version banner, but the page shows none${seen.badge ? ` (${seen.badge})` : ''}.`,
    'Only a page of an old version or of the unreleased version shows a banner; the latest version (lastVersion) shows none. A version can turn it off with banner: none.');
  }
});

/**
 * Assert the link of the version banner (to the same page in the latest
 * version) leads to a path.
 *
 * Example #1: Then the version banner should link to "/docs/intro"
 * Example #2: And the version banner should link to "/docs/getting-started/installation"
 * Example #3: Then version banner should link to "/docs/intro"
 * Example #4: And the version banner should link to "/fr/docs/intro"
 * Example #5: Then the version banner should link to "/docs/guides/writing-content"
 */
Then(/^(?:the )?version banner should link to "([^"]*)?"$/, async function (path) {
  await readySitePage(this, 'the version banner');
  let seen;
  const ok = await poll(this, async () => {
    seen = await versionInfo(this);
    return seen.links.some((l) => String(l.href).replace(/\/+$/, '') === String(path).replace(/\/+$/, ''));
  }, budget(this) / 2);
  if (!ok) {
    throw failure(this, seen.banner
      ? `Expected the version banner to link to ${path}, but it links to ${listed(seen.links.map((l) => l.href))}.`
      : `Expected the version banner to link to ${path}, but the page shows no version banner.`,
    'The banner links to the same page in the latest version, or to the first page of that version when the page is not in it.');
  }
});

/**
 * Assert which version of the docs the page belongs to, by its label: the
 * badge above the title ("Version: 2.0"), or the version the page's metadata
 * names ("current" for the unreleased version).
 *
 * Example #1: Then the page should belong to the version "2.0"
 * Example #2: And the page should belong to the version "Next"
 * Example #3: Then page should belong to the version "1.0"
 * Example #4: And the page should belong to the version "2.0"
 * Example #5: Then the page should belong to the version "1.0"
 */
Then(/^(?:the )?page should belong to the version "([^"]*)?"$/, async function (version) {
  await readySitePage(this, 'the version of the page');
  let seen;
  const ok = await poll(this, async () => {
    seen = await versionInfo(this);
    const label = clean(seen.badge.replace(/^[^:]*:\s*/, ''));
    return same(label, version) || same(seen.meta, version);
  }, budget(this) / 2);
  if (!ok) {
    throw failure(this, `Expected a page of the version "${version}", but ${seen.badge ? `its badge says "${seen.badge}"` : 'it shows no version badge'}${seen.meta ? ` (version "${seen.meta}")` : ''}.`, 'Only the pages of the docs belong to a version; a site with a single version shows no badge.');
  }
});
