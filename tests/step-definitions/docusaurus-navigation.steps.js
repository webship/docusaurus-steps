'use strict';

// Step definitions for moving around the site: following a link in the same
// document, back and forward, a link or a text in a named part of the page
// (the navbar, the sidebar, the table of contents, the breadcrumbs, the
// footer, …), the active link of the navbar and a link that opens in a new
// tab.
//
// The router of the site opens a page in the same document once the page has
// hydrated: it changes the address at once, keeps the old page on screen
// while the code of the new one loads, then shows the new page. Every step
// here waits for that end (docusaurus-helpers.js, afterAction).

const { When, Then } = require('@cucumber/cucumber');
const {
  budget, clean, same, listed, shortUrl, poll, pageReady, afterAction, readySitePage, failure,
  documentId, region, regionLocator, findClickable, centre, pathOf, readableName,
} = require('./docusaurus-helpers');

/** Fail with what the link or text step found when nothing matched. */
function notFound(world, what, where, seen) {
  return failure(world, `Could not find ${what} in the ${where}. It shows: ${listed(seen).slice(0, 600)}.`, where === 'sidebar'
    ? 'A link inside a collapsed category is hidden: expand the category first. At a narrow width the sidebar is in the navigation menu.'
    : 'The text is matched as a person reads it, letter case and spacing aside; check the screenshot of the failure.');
}

/**
 * Click a link and assert the site opened its page in the same document,
 * the way its router does once the page has hydrated: the address changes,
 * the page is not loaded again from the server, and the step waits until the
 * new page is shown and ready. The link is found by what a person reads
 * (its text or its accessible name); the first visible one is clicked.
 *
 * Example #1: When I click the link "Installation" without a full page reload
 * Example #2: And I click the link "Blog" without a full page reload
 * Example #3: When we click the link "Older entries" without a full page reload
 * Example #4: When click the link "Configuration" without a full page reload
 * Example #5: And I click the link "Writing content" without a full page reload
 */
When(/^(I |we )*click the link "([^"]*)?" without a full page reload$/, async function (pronoun, text) {
  await readySitePage(this, `the link "${text}"`);
  const { match, seen } = await findClickable(this, this.page.locator('body'), text);
  if (!match) throw notFound(this, `a visible link "${text}"`, 'page', seen);
  const href = await match.getAttribute('href');
  const before = await documentId(this);
  const from = this.page.url();
  await centre(match);
  await afterAction(this, () => match.click({ timeout: budget(this) }));
  const target = pathOf(href, from);
  const arrived = await poll(this, async () => pathOf(this.page.url()) === target, budget(this));
  const after = await documentId(this);
  if (!before || before !== after) {
    throw failure(this, `The link "${text}" loaded ${shortUrl(this.page.url())} again from the server (a full page load) instead of in the same document.`, 'The router opens a page in the same document once the page has hydrated: a link to another site, a link with target="_blank", a file (a feed, an image) or a click before hydration loads the page from the server.');
  }
  if (!arrived) {
    throw failure(this, `The link "${text}" points to ${target}, but the browser shows ${shortUrl(this.page.url())}.`, 'Check that the link leads to a page of the site, and look at the screenshot: something on top of the link may have taken the click.');
  }
});

/**
 * Go back or forward in the browser's history, and assert the page came
 * from the same document (the router keeps the earlier pages), then wait
 * until it is shown and ready.
 *
 * Example #1: When I go back without a full page reload
 * Example #2: And I go forward without a full page reload
 * Example #3: When we go back without a full page reload
 * Example #4: When go forward without a full page reload
 * Example #5: Then I go back without a full page reload
 */
When(/^(I |we )*go (back|forward) without a full page reload$/, async function (pronoun, direction) {
  await readySitePage(this, `the way ${direction}`);
  const before = await documentId(this);
  const from = this.page.url();
  // The history moves after the evaluation has returned: a step to another document must not cut it.
  await afterAction(this, () => this.page.evaluate((d) => { setTimeout(() => (d === 'back' ? history.back() : history.forward()), 0); }, direction));
  const moved = await poll(this, async () => this.page.url() !== from, budget(this) / 2);
  if (!moved) {
    throw failure(this, `Going ${direction} did not change the page: the browser still shows ${shortUrl(from)}.`, direction === 'back' ? 'The history has no earlier page in this scenario: open a page, then another, then go back.' : 'Going forward needs a page you went back from first.');
  }
  const to = this.page.url();
  let left = !/^https?:/.test(to);
  try { left = left || new URL(to).origin !== new URL(from).origin; } catch { left = true; }
  if (left) {
    throw failure(this, `Going ${direction} left the site: the browser shows ${to}.`, 'Every scenario starts on a blank page: go back only from a page that was opened from another page of the site.');
  }
  const after = await documentId(this);
  if (!before || before !== after) {
    throw failure(this, `Going ${direction} loaded ${shortUrl(this.page.url())} from the server (a full page load) instead of in the same document.`, 'A page that was loaded from the server (not opened by the router) comes back from the server too.');
  }
});

/**
 * Click a link (or a button) in a named part of the page, and wait for what
 * it does: another page, shown in the same document when it is the site's
 * own, or a change on the page. The parts: the navbar, the navigation menu
 * (the navbar at a narrow width), the sidebar, the table of contents, the
 * breadcrumbs, the version banner, the announcement bar, the footer, the blog
 * sidebar, the search results and the content.
 *
 * Example #1: When I click "Installation" in the sidebar
 * Example #2: And I click "Blog" in the navbar
 * Example #3: When I click "Links" in the table of contents
 * Example #4: When we click "latest version" in the version banner
 * Example #5: And I click "Support" in the footer
 */
When(/^(I |we )*click "([^"]*)?" in the (navbar|navigation menu|sidebar|table of contents|breadcrumbs|version banner|announcement bar|footer|blog sidebar|search results|content)$/, async function (pronoun, text, where) {
  await readySitePage(this, `"${text}" in the ${where}`);
  const scope = await region(this, where);
  const { match, seen } = await findClickable(this, scope, text, { buttons: true });
  if (!match) throw notFound(this, `"${text}"`, where, seen);
  await centre(match);
  await afterAction(this, () => match.click({ timeout: budget(this) }));
});

/**
 * Assert a text is (or is not) shown in a named part of the page: the
 * navbar, the navigation menu, the sidebar, the table of contents, the
 * breadcrumbs, the version banner, the announcement bar, the footer, the blog
 * sidebar, the search results or the content. Only what is visible counts:
 * the items of a collapsed category are in the page but not shown.
 *
 * Example #1: Then I should see "Installation" in the sidebar
 * Example #2: And I should see "Headings" in the table of contents
 * Example #3: But I should not see "Deployment" in the sidebar
 * Example #4: Then we should see "Version 2.0 is out." in the announcement bar
 * Example #5: And I should see "no longer actively maintained" in the version banner
 */
Then(/^(I |we )*should( not)* see "([^"]*)?" in the (navbar|navigation menu|sidebar|table of contents|breadcrumbs|version banner|announcement bar|footer|blog sidebar|search results|content)$/, async function (pronoun, notCase, text, where) {
  await pageReady(this);
  const want = clean(text).toLowerCase();
  let seen = '';
  const ok = await poll(this, async () => {
    const located = await regionLocator(this, where);
    if (!located) {
      seen = '';
      return Boolean(notCase);
    }
    seen = clean(await located.evaluate((el) => el.innerText || ''));
    return seen.toLowerCase().includes(want) === !notCase;
  }, notCase ? 2000 : budget(this));
  if (!ok) {
    throw failure(this, notCase
      ? `Expected not to see "${text}" in the ${where}, but it is there.`
      : `Expected to see "${text}" in the ${where}, but ${seen ? `it shows: "${seen.slice(0, 400)}"` : `the page has no visible ${where}`}.`,
    notCase ? 'A text counts once it is visible in that part of the page.' : 'Only visible text counts: the items of a collapsed category, a closed menu or a hidden tab panel are not shown.');
  }
});

/**
 * Assert a link of the navbar is (or is not) marked as the active one: the
 * site marks the item of the part of the site the page belongs to ("Docs" on
 * a page of the docs, "Blog" on the blog) with `navbar__link--active` and
 * `aria-current="page"`.
 *
 * Example #1: Then the navbar link "Blog" should be active
 * Example #2: And the navbar link "Docs" should not be active
 * Example #3: Then navbar link "Docs" should be active
 * Example #4: But the navbar link "Blog" should not be active
 * Example #5: And the navbar link "Docs" should be active
 */
Then(/^(?:the )?navbar link "([^"]*)?" should( not)* be active$/, async function (text, notCase) {
  await readySitePage(this, `the navbar link "${text}"`);
  const navbar = await region(this, 'navbar');
  let state = null;
  const ok = await poll(this, async () => {
    const links = navbar.locator('a.navbar__link, a.navbar__item');
    const count = await links.count();
    state = null;
    for (let i = 0; i < count; i += 1) {
      const link = links.nth(i);
      if (!same(await readableName(link), text)) continue;
      state = await link.evaluate((el) => el.classList.contains('navbar__link--active') || el.getAttribute('aria-current') === 'page');
      break;
    }
    return state !== null && state === !notCase;
  }, notCase ? 2000 : budget(this) / 2);
  if (!ok) {
    if (state === null) throw failure(this, `The navbar has no link "${text}".`, 'Name the link by the text the navbar shows; at a narrow width the links are in the navigation menu.');
    throw failure(this, notCase ? `Expected the navbar link "${text}" not to be active, but it is.` : `Expected the navbar link "${text}" to be active on ${shortUrl(this.page.url())}, but it is not.`, 'A navbar link is active on the pages of the part of the site it leads to (activeBasePath or activeBaseRegex in the navbar item).');
  }
});

/**
 * Assert a link of the navbar (an item of the navbar or of one of its menus)
 * leads to an address on another site and opens it in a new tab
 * (`target="_blank"`), without following it.
 *
 * Example #1: Then the navbar link "Source" should open "https://example.com/source" in a new tab
 * Example #2: And the navbar link "Forum" should open "https://example.com/forum" in a new tab
 * Example #3: Then navbar link "Source" should open "https://example.com/source" in a new tab
 * Example #4: And the navbar link "Source" should open "https://example.com/source" in a new tab
 * Example #5: Then the navbar link "Forum" should open "https://example.com/forum" in a new tab
 */
Then(/^(?:the )?navbar link "([^"]*)?" should open "([^"]*)?" in a new tab$/, async function (text, url) {
  await readySitePage(this, `the navbar link "${text}"`);
  const found = await this.page.evaluate((wanted) => {
    const clean = (t) => String(t || '').replace(/[​ ]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const links = [...document.querySelectorAll('nav.navbar a')];
    const link = links.find((a) => clean(a.textContent) === clean(wanted) || clean(a.textContent).startsWith(clean(wanted)));
    return link ? { href: link.getAttribute('href'), target: link.getAttribute('target'), rel: link.getAttribute('rel') || '' } : null;
  }, text);
  if (!found) throw failure(this, `The navbar has no link "${text}" (in its items or its menus).`, 'Name the link by the text the navbar shows.');
  if (found.href !== url) throw failure(this, `Expected the navbar link "${text}" to lead to ${url}, but it leads to ${found.href}.`, 'Check the href of the item in themeConfig.navbar.items.');
  if (found.target !== '_blank') throw failure(this, `Expected the navbar link "${text}" to open in a new tab, but it has target="${found.target || ''}".`, 'An item with href (an address of another site) opens in a new tab; an item with to (a page of the site) does not.');
});
