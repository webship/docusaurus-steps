'use strict';

// Step definitions for the search of the site that runs in the browser on an
// index the build writes (no outside service): the search box of the navbar
// and its suggestions, the page of all the results, and the words found,
// marked on the page a result opens.
//
// The search box loads the index when it gets the focus (or the pointer):
// its code, then /search-index.json (one per language). Once the index is in,
// the box becomes a combobox (role="combobox", aria-autocomplete="list") that
// lists its suggestions in a listbox under it. The steps wait for that, never
// for a time.

const { When, Then } = require('@cucumber/cucumber');
const {
  budget, clean, listed, shortUrl, poll, pageReady, afterAction, readySitePage, failure, centre, requests,
} = require('./docusaurus-helpers');

const SEARCH_BOX = 'nav.navbar input.navbar__search-input, nav.navbar input[aria-label="Search"], nav.navbar input[type="search"]';

/** What the search box of the navbar says about itself. */
async function searchState(world) {
  return world.page.evaluate((selector) => {
    const input = [...document.querySelectorAll(selector)].find((el) => el.getBoundingClientRect().width > 0) || null;
    if (!input) return { box: false };
    const listbox = input.getAttribute('aria-owns') ? document.getElementById(input.getAttribute('aria-owns')) : null;
    const open = Boolean(listbox) && getComputedStyle(listbox).display !== 'none';
    const options = open ? [...listbox.querySelectorAll('[role="option"]')].map((o) => {
      const title = o.querySelector('[class*="hitTitle"]');
      const path = o.querySelector('[class*="hitPath"]');
      return { title: (title ? title.textContent : o.textContent).replace(/\s+/g, ' ').trim(), path: path ? path.textContent.replace(/\s+/g, ' ').trim() : '' };
    }) : [];
    return {
      box: true,
      ready: input.getAttribute('role') === 'combobox',
      loading: Boolean(input.closest('.navbar__search') && /searchIndexLoading/.test(input.closest('.navbar__search').className)),
      value: input.value,
      open,
      options,
      nothing: open && Boolean(listbox.querySelector('[class*="noResults"]')),
    };
  }, SEARCH_BOX).catch(() => ({ box: false }));
}

/** Why the index did not load, from the requests of the page. */
function indexStory(world) {
  const state = requests(world.page);
  const answer = state.fetched.filter((f) => /search-index[^/]*\.json/.test(f.url)).pop();
  const failed = state.failures.filter((f) => /search-index[^/]*\.json/.test(f.url)).pop();
  if (failed) return `the request for ${shortUrl(failed.url)} failed (${failed.error})`;
  if (answer) return `${shortUrl(answer.url)} answered ${answer.status}`;
  return 'the page never asked for the search index';
}

/**
 * Search the site: focus the search box of the navbar (which loads the
 * index), wait until the index is in, type the words, and wait until the
 * suggestions (or "No results") are shown under the box.
 *
 * Example #1: When I search for "firewall"
 * Example #2: And I search for "version"
 * Example #3: When we search for "installation"
 * Example #4: When search for "nothing like this"
 * Example #5: And I search for "port"
 */
When(/^(I |we )*search for "([^"]*)?"$/, async function (pronoun, words) {
  await readySitePage(this, 'the search box');
  const box = this.page.locator(SEARCH_BOX).first();
  if (!(await box.count()) || !(await box.isVisible().catch(() => false))) {
    throw failure(this, 'The navbar has no visible search box.', 'The search box comes from a search plugin of the site (here the local search); at a narrow width it may be folded behind an icon.');
  }
  await centre(box);
  await box.click({ timeout: budget(this) });
  let state;
  const ready = await poll(this, async () => {
    state = await searchState(this);
    return state.ready;
  }, budget(this) * 2);
  if (!ready) {
    throw failure(this, `The search index did not load within ${budget(this) * 2} ms: ${indexStory(this)}.`, 'The local search works on a production build only: the development server has no index. Check that the build wrote search-index.json and that the server answers it.');
  }
  await box.fill('');
  await afterAction(this, () => box.pressSequentially(words, { delay: 30 }));
  const shown = await poll(this, async () => {
    state = await searchState(this);
    return state.open && (state.options.length > 0 || state.nothing) && state.value === words;
  }, budget(this));
  if (!shown) {
    throw failure(this, `Searched for "${words}", but no suggestion and no "No results" came under the search box (the box says "${state.value}").`, 'The suggestions open under the box once the index is in and a word is typed; check the browser console of the page.');
  }
});

/**
 * Assert the suggestions under the search box list (or do not list) a page
 * or a heading: a suggestion whose title contains the text, case and spacing
 * aside.
 *
 * Example #1: Then the search should suggest "Behind a firewall"
 * Example #2: And the search should suggest "Version 2.0"
 * Example #3: But the search should not suggest "Installation"
 * Example #4: Then search should suggest "Check the installation"
 * Example #5: And the search should not suggest "Version 3.0"
 */
Then(/^(?:the )?search should( not)* suggest "([^"]*)?"$/, async function (notCase, text) {
  await pageReady(this);
  const want = clean(text).toLowerCase();
  let state;
  const ok = await poll(this, async () => {
    state = await searchState(this);
    if (!state.open) return false;
    return state.options.some((o) => o.title.toLowerCase().includes(want)) === !notCase;
  }, notCase ? 2000 : budget(this));
  if (!ok) {
    if (!state || !state.open) throw failure(this, 'The search shows no suggestions: nothing is open under the search box.', 'Search first: When I search for "…".');
    throw failure(this, notCase
      ? `Expected the search not to suggest "${text}", but it does.`
      : `Expected the search to suggest "${text}", but it suggests ${listed(state.options.map((o) => o.title))}.`,
    'The suggestions are the pages, headings and texts of the index that hold the words; the index of a language holds the pages of that language.');
  }
});

/**
 * Assert the search found nothing: the box shows "No results" under it.
 *
 * Example #1: Then the search should find nothing
 * Example #2: And the search should find nothing
 * Example #3: Then search should find nothing
 * Example #4: But the search should find nothing
 * Example #5: Then the search should find nothing
 */
Then(/^(?:the )?search should find nothing$/, async function () {
  await pageReady(this);
  let state;
  const ok = await poll(this, async () => {
    state = await searchState(this);
    return state.open && state.nothing;
  }, budget(this));
  if (!ok) {
    throw failure(this, state && state.open
      ? `Expected the search to find nothing, but it suggests ${listed(state.options.map((o) => o.title))}.`
      : 'Expected the search to say it found nothing, but nothing is open under the search box.',
    'Search first: When I search for "…".');
  }
});

/**
 * Open one of the suggestions under the search box (by a part of its title):
 * its page opens in the same document, at the heading found, with the words
 * of the search marked on it.
 *
 * Example #1: When I open the search suggestion "Behind a firewall"
 * Example #2: And I open the search suggestion "Version 2.0"
 * Example #3: When we open the search suggestion "Check the installation"
 * Example #4: When open the search suggestion "Behind a firewall"
 * Example #5: And I open the search suggestion "What Comes Next"
 */
When(/^(I |we )*open the search suggestion "([^"]*)?"$/, async function (pronoun, text) {
  await pageReady(this);
  const want = clean(text).toLowerCase();
  const state = await searchState(this);
  const index = state.open ? state.options.findIndex((o) => o.title.toLowerCase().includes(want)) : -1;
  if (index < 0) {
    throw failure(this, `The search does not suggest "${text}"${state.open ? `; it suggests ${listed(state.options.map((o) => o.title))}` : ''}.`, 'Search first: When I search for "…".');
  }
  const from = this.page.url();
  const option = this.page.locator('nav.navbar [role="listbox"] [role="option"]').nth(index);
  await afterAction(this, () => option.click({ timeout: budget(this) }));
  const moved = await poll(this, async () => this.page.url() !== from, budget(this));
  if (!moved) throw failure(this, `The suggestion "${text}" did not open a page.`, 'Look at the screenshot of the failure.');
});

/**
 * Open the page of all the results of the search ("See all results" under
 * the suggestions), at /search?q=<words>.
 *
 * Example #1: When I open the page of all the search results
 * Example #2: And I open the page of all the search results
 * Example #3: When we open the page of all the search results
 * Example #4: When open the page of all the search results
 * Example #5: Then I open the page of all the search results
 */
When(/^(I |we )*open the page of all the search results$/, async function (pronoun) {
  await pageReady(this);
  const link = this.page.locator('nav.navbar [role="listbox"] [class*="hitFooter"] a').first();
  if (!(await link.count()) || !(await link.isVisible().catch(() => false))) {
    throw failure(this, 'The suggestions of the search show no link to all the results.', 'Search first (When I search for "…"); the link is under the suggestions when the search found something.');
  }
  await afterAction(this, () => link.click({ timeout: budget(this) }));
});

/** The results of the page of all the results, once the index is in. */
async function resultsPage(world) {
  return world.page.evaluate(() => {
    const items = [...document.querySelectorAll('article[class*="searchResultItem"]')];
    const heading = document.querySelector('h1');
    const status = [...document.querySelectorAll('#__docusaurus_skipToContent_fallback p, main p')].map((p) => p.textContent.trim()).find((t) => /\d|no /i.test(t)) || '';
    return {
      heading: heading ? heading.textContent.trim() : '',
      status,
      results: items.map((a) => {
        const title = a.querySelector('h2');
        const path = a.querySelector('[class*="searchResultItemPath"]');
        return { title: title ? title.textContent.replace(/\s+/g, ' ').trim() : '', path: path ? path.textContent.trim() : '' };
      }),
    };
  }).catch(() => ({ heading: '', status: '', results: [] }));
}

/**
 * Assert the page of all the search results (/search?q=…) lists (or does
 * not list) a result whose title contains the text. The page loads the index
 * itself; the step waits for its results.
 *
 * Example #1: Then the search results page should list "Behind a firewall"
 * Example #2: And the search results page should list "Version 2.0"
 * Example #3: But the search results page should not list "Installation"
 * Example #4: Then search results page should list "Check the installation"
 * Example #5: And the search results page should not list "FAQ"
 */
Then(/^(?:the )?search results page should( not)* list "([^"]*)?"$/, async function (notCase, text) {
  await pageReady(this);
  const want = clean(text).toLowerCase();
  let seen;
  const ok = await poll(this, async () => {
    seen = await resultsPage(this);
    if (!seen.results.length && !seen.status) return false;
    return seen.results.some((r) => r.title.toLowerCase().includes(want)) === !notCase;
  }, notCase ? 3000 : budget(this) * 2);
  if (!ok) {
    throw failure(this, notCase
      ? `Expected the search results not to list "${text}", but they do.`
      : `Expected the search results to list "${text}", but ${seen.results.length ? `they list ${listed(seen.results.map((r) => r.title))}` : `the page shows no result${seen.status ? ` ("${seen.status}")` : ''} (${indexStory(this)})`}.`,
    'The page of all the results is /search?q=<words>; it loads the index of its language, then lists every page, heading and text that holds the words.');
  }
});

/**
 * Open one of the results of the page of all the search results, by a part
 * of its title: its page opens in the same document.
 *
 * Example #1: When I open the search result "Behind a firewall"
 * Example #2: And I open the search result "Version 2.0"
 * Example #3: When we open the search result "Check the installation"
 * Example #4: When open the search result "Behind a firewall"
 * Example #5: And I open the search result "What Comes Next"
 */
When(/^(I |we )*open the search result "([^"]*)?"$/, async function (pronoun, text) {
  await pageReady(this);
  const want = clean(text).toLowerCase();
  let seen;
  await poll(this, async () => {
    seen = await resultsPage(this);
    return seen.results.some((r) => r.title.toLowerCase().includes(want));
  }, budget(this) * 2);
  const index = seen.results.findIndex((r) => r.title.toLowerCase().includes(want));
  if (index < 0) {
    throw failure(this, `The search results do not list "${text}"; they list ${listed(seen.results.map((r) => r.title))}.`, 'Open the page of all the results first (/search?q=<words>).');
  }
  const link = this.page.locator('article[class*="searchResultItem"] h2 a').nth(index);
  await centre(link);
  await afterAction(this, () => link.click({ timeout: budget(this) }));
});

/**
 * Assert the words of a search are (or are not) marked on the page a result
 * opened (`<mark>` in the content), as the site does for a page opened from
 * the search.
 *
 * Example #1: Then the words "firewall" should be marked on the page
 * Example #2: And the words "version" should be marked on the page
 * Example #3: But the words "firewall" should not be marked on the page
 * Example #4: Then words "installation" should be marked on the page
 * Example #5: And the words "port" should be marked on the page
 */
Then(/^(?:the )?words "([^"]*)?" should( not)* be marked on the page$/, async function (words, notCase) {
  await pageReady(this);
  const want = clean(words).toLowerCase();
  let marks = [];
  const ok = await poll(this, async () => {
    marks = await this.page.evaluate(() => [...document.querySelectorAll('article mark, main mark')].map((m) => m.textContent.trim().toLowerCase())).catch(() => []);
    return marks.some((m) => m.includes(want) || want.includes(m)) === !notCase;
  }, notCase ? 1500 : budget(this));
  if (!ok) {
    throw failure(this, notCase
      ? `Expected the words "${words}" not to be marked on the page, but they are.`
      : `Expected the words "${words}" to be marked on the page, but ${marks.length ? `it marks ${listed(marks)}` : 'nothing is marked on it'}.`,
    'A page opened from the search carries the words in its address (?_highlight=…) and marks them; highlightSearchTermsOnTargetPage turns that on.');
  }
});
