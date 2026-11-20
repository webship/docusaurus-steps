'use strict';

// Step definitions for the page as a whole: the wait for the page to be
// ready, hydration and its errors, the production build, the generator of the
// page, the not-found page, and where the keyboard focus goes after a page
// change.
//
// What each step relies on is in docusaurus-helpers.js; the recorders of the
// requests and of the console are put on every page there.

const { When, Then } = require('@cucumber/cucumber');
const {
  budget, escapeRegExp, poll, pageReady, isSitePage, readySitePage, failure,
  hydrationErrors, lastDocumentStatus,
} = require('./docusaurus-helpers');

/**
 * Wait until the page is ready, by the site's own signals: the document is
 * loaded, the site has hydrated (`<html data-has-hydrated="true">`), no script
 * of a page is still loading, the progress bar of a page change is gone and
 * no request of the page is running, for a moment. Fails, saying what the
 * page was still doing, when that takes too long. The steps of this pack
 * already wait for it; this is the wait for a project's own steps.
 *
 * Example #1: When I wait for the page to be ready
 * Example #2: And I wait for the page to be ready
 * Example #3: When we wait for the page to be ready
 * Example #4: Then I wait for the page to be ready
 * Example #5: When wait for the page to be ready
 */
When(/^(I |we )*wait for the page to be ready$/, async function (pronoun) {
  await pageReady(this, { strict: true });
});

/**
 * Assert the site has (or has not) hydrated the page: its runtime sets
 * `<html data-has-hydrated="true">` once React has taken the page over, and
 * only then do the links open pages in the same document, the tabs answer
 * and the stored choices (the colour mode, a tab) apply. The server's HTML
 * says "false".
 *
 * Example #1: Then I should see a hydrated page
 * Example #2: And we should see a hydrated page
 * Example #3: But I should not see a hydrated page
 * Example #4: Then should see a hydrated page
 * Example #5: And I should see a hydrated page
 */
Then(/^(I |we )*should( not)* see a hydrated page$/, async function (pronoun, notCase) {
  if (notCase) {
    const hydrated = await this.page.evaluate(() => document.documentElement.getAttribute('data-has-hydrated') === 'true').catch(() => false);
    if (hydrated) {
      throw failure(this, 'Expected a page the site has not hydrated, but <html data-has-hydrated="true"> says it has.', 'To look at a page before hydration, load it with JavaScript turned off, or hold its scripts back with a network mock.');
    }
    return;
  }
  await pageReady(this);
  if (!(await isSitePage(this))) {
    throw failure(this, `Expected a hydrated page of the site, but ${this.page.url()} has no root of the site (#__docusaurus).`, 'Check LAUNCH_URL and the path: a proxy error page, a redirect or another site does not carry the root of the site.');
  }
  const ok = await poll(this, () => this.page.evaluate(() => document.documentElement.getAttribute('data-has-hydrated') === 'true'));
  if (!ok) {
    throw failure(this, `The page HTML is there, but the site did not hydrate it within ${budget(this)} ms (<html data-has-hydrated> is not "true").`, 'The page scripts did not load or failed: check the browser console and the network for /assets/js/runtime~main.*.js and main.*.js, and look for "Minified React error" in the console.');
  }
});

/**
 * Assert the page hydrated without (or, to prove the check, with) hydration
 * errors: React reports a mismatch between the server's HTML and the first
 * render in the browser as an error (#418, #423, #425 in production), which
 * the site's runtime writes to the console. The step waits for the page to be
 * ready, then reads the errors recorded since the page opened.
 *
 * Example #1: Then there should be no hydration errors
 * Example #2: And there should be no hydration errors
 * Example #3: But there should be hydration errors
 * Example #4: Then there should be hydration errors
 * Example #5: And there should be hydration errors
 */
Then(/^there should be (no )?hydration errors$/, async function (noCase) {
  await pageReady(this);
  if (noCase) {
    await this.page.waitForTimeout(300);
    const errors = hydrationErrors(this.page);
    if (errors.length) {
      throw failure(this, `React reported ${errors.length} hydration error(s) on this page:\n  ${errors.join('\n  ')}`, 'The server\'s HTML and the first render in the browser differ. Typical causes: `window`, `Date.now()` or `Math.random()` read while rendering, or markup nested in a way the browser rewrites. Render what only the browser knows in useEffect, or in a <BrowserOnly> block.');
    }
    return;
  }
  const found = await poll(this, async () => hydrationErrors(this.page).length > 0, 3000);
  if (!found) {
    throw failure(this, 'Expected hydration errors on this page, but React reported none.', 'This phrasing proves the check can fail: use it on a page that renders differently on the server and in the browser.');
  }
});

/**
 * Assert the page is (or is not) served by a production build. A production
 * build loads its code from /assets/js/ with a content hash in each name
 * (`main.53b8df17.js`); the development server (`start`) loads `/main.js`
 * with no hash, keeps a hot-reload connection open and sets a
 * `webpackHotUpdate…` global.
 *
 * Example #1: Then the site should be served as a production build
 * Example #2: And the site should be a production build
 * Example #3: But the site should not be served as a production build
 * Example #4: Then site should be a production build
 * Example #5: And the site should be served as a production build
 */
Then(/^(?:the )?site should( not)* be (?:served as )?a production build$/, async function (notCase) {
  await pageReady(this);
  const read = () => this.page.evaluate(() => {
    const scripts = [...document.querySelectorAll('script[src]')].map((s) => new URL(s.src, location.href).pathname);
    return {
      hashed: scripts.some((p) => /\/assets\/js\/main\.[0-9a-f]{6,}\.js$/.test(p)),
      unhashed: scripts.some((p) => /\/main\.js$/.test(p)),
      hot: Object.keys(window).some((k) => /^webpackHotUpdate/.test(k)),
      scripts: scripts.slice(0, 4),
    };
  }).catch(() => ({ hashed: false, unhashed: false, hot: false, scripts: [] }));
  let seen;
  const ok = await poll(this, async () => {
    seen = await read();
    const production = seen.hashed && !seen.hot;
    return production === !notCase;
  }, 3000);
  if (!ok) {
    throw failure(this, notCase
      ? `Expected the development server, but the page is a production build (its code: ${seen.scripts.join(', ')}).`
      : `Expected a production build, but the page looks like the development server (its code: ${seen.scripts.join(', ') || 'none'}${seen.hot ? '; a hot-reload global is set' : ''}).`,
    'Build the site (`build`) and serve the build (`serve`); the suite needs the production build, and LAUNCH_URL must point at it.');
  }
});

/** Wait until the generator meta tag satisfies `test` (or, with `notCase`, does not). */
async function generator(world, notCase, test, message, hint) {
  let content = null;
  const ok = await poll(world, async () => {
    content = await world.page.locator('meta[name="generator"]').first().getAttribute('content', { timeout: 1000 }).catch(() => null);
    return test.test(content || '') === !notCase;
  }, 3000);
  if (!ok) {
    throw failure(world, `${message} ${content === null ? 'No <meta name="generator"> tag was found.' : `The generator meta tag is "${content}".`}`, hint);
  }
}

const GENERATOR_HINT = 'A production build writes `<meta name="generator" content="<name> v<version>">` into every page; the development server writes the name without the version.';

/**
 * Assert what the page's generator meta tag says: the whole content ("be"),
 * its start ("start with") or a part of it ("contain"), without regard to
 * case. Its value names the tool that built the page, with its version.
 *
 * Example #1: Then the page generator should contain "v3"
 * Example #2: And the page generator should contain "3.10"
 * Example #3: But the page generator should not contain "v2"
 * Example #4: Then page generator should contain "v3.10"
 * Example #5: And the page generator should not start with "v"
 */
Then(/^(?:the )?page generator should( not)* (be|start with|contain) "([^"]*)"$/, async function (notCase, mode, expected) {
  const body = escapeRegExp(expected);
  const source = mode === 'be' ? `^${body}$` : mode === 'start with' ? `^${body}` : body;
  await generator(this, notCase, new RegExp(source, 'i'), notCase
    ? `Expected the page generator not to ${mode} "${expected}", but it does.`
    : `Expected the page generator to ${mode} "${expected}".`, GENERATOR_HINT);
});

/**
 * Assert the version the page was (or was not) generated by: the first
 * number of the generator meta tag ("3.10.2" in "<name> v3.10.2"). "start
 * with" matches whole parts from the start, so "3" and "3.10" match "3.10.2",
 * but "10" and "3.1" do not; "be" wants the whole version.
 *
 * Example #1: Then the page generator version should start with "3"
 * Example #2: And the page generator version should start with "3.10"
 * Example #3: But the page generator version should not start with "2"
 * Example #4: Then page generator version should start with "3"
 * Example #5: And the page generator version should be "3.10.2"
 */
Then(/^(?:the )?page generator version should( not)* (be|start with) "([^"]*)"$/, async function (notCase, mode, version) {
  const test = new RegExp(`^[^0-9]*${escapeRegExp(version)}${mode === 'be' ? '$' : '(?![0-9])'}`);
  await generator(this, notCase, test, notCase
    ? `Expected the page generator version not to ${mode} "${version}", but it does.`
    : `Expected the page generator version to ${mode} "${version}".`,
  'The version is the first number of the generator meta tag; the development server writes no version at all.');
});

/**
 * Assert the page is (or is not) the not-found page: the server answered its
 * address with 404, or the router shows its not-found page for an address
 * it has no route for (an `h1.hero__title` in <main>). The browser logs
 * "Failed to load resource: … 404" for a page the server answers with 404:
 * a scenario that opens one carries @js-off.
 *
 * Example #1: Then I should be on a 404 page
 * Example #2: And we should be on a 404 page
 * Example #3: But I should not be on a 404 page
 * Example #4: Then should be on a 404 page
 * Example #5: And I should be on a 404 page
 */
Then(/^(I |we )*should( not)* be on a 404 page$/, async function (pronoun, notCase) {
  await pageReady(this);
  const read = async () => {
    const status = lastDocumentStatus(this.page);
    const shown = await this.page.evaluate(() => {
      const h1 = document.querySelector('main h1.hero__title');
      return h1 ? h1.textContent.trim() : '';
    }).catch(() => '');
    return { status, shown, notFound: status === 404 || Boolean(shown) };
  };
  let seen;
  const ok = await poll(this, async () => {
    seen = await read();
    return seen.notFound === !notCase;
  }, notCase ? 1000 : 5000);
  if (!ok) {
    throw failure(this, notCase
      ? `Expected a page that exists, but ${this.page.url()} is the not-found page (status ${seen.status || 'unknown'}${seen.shown ? `, "${seen.shown}"` : ''}).`
      : `Expected the not-found page, but ${this.page.url()} answered ${seen.status || 'with no status'} and shows no not-found page.`,
    notCase
      ? 'Check the address: the page may have moved, or the build left it out.'
      : 'The server answers an unknown address with 404 and the build\'s 404.html; `serve` does, and so must the web server in front of the build.');
  }
});

/**
 * Assert where the keyboard focus is after a page change in the same
 * document: the site moves it back to the start of the page (the region of
 * the "Skip to main content" link), so a screen reader starts reading the new
 * page from its top. On a page loaded from the server the focus is on the
 * page itself.
 *
 * Example #1: Then the keyboard focus should be at the start of the page
 * Example #2: And the keyboard focus should be at the start of the page
 * Example #3: But the keyboard focus should not be at the start of the page
 * Example #4: Then keyboard focus should be at the start of the page
 * Example #5: And keyboard focus should not be at the start of the page
 */
Then(/^(?:the )?keyboard focus should( not)* be at the start of the page$/, async function (notCase) {
  await readySitePage(this, 'the keyboard focus');
  let seen = '';
  const ok = await poll(this, async () => {
    const r = await this.page.evaluate(() => {
      const el = document.activeElement;
      const name = !el ? 'nothing' : el === document.body ? 'the page itself' : `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 60)}"`;
      const atStart = !el || el === document.body || el === document.documentElement
        || (el.getAttribute('role') === 'region' && Boolean(el.querySelector('a[href="#__docusaurus_skipToContent_fallback"]')))
        || el.getAttribute('href') === '#__docusaurus_skipToContent_fallback';
      return { atStart, name };
    });
    seen = r.name;
    return r.atStart === !notCase;
  }, 3000);
  if (!ok) {
    throw failure(this, notCase
      ? `Expected the keyboard focus somewhere in the page, but it is at the start of the page (${seen}).`
      : `Expected the keyboard focus at the start of the page after the page change, but it is on ${seen}.`,
    'After a page change in the same document the site focuses the region of the "Skip to main content" link; a link to a heading of the same page keeps the focus where it was.');
  }
});
