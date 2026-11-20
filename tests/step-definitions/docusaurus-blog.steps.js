'use strict';

// Step definitions for the blog: the posts of a list page (the blog, a tag,
// an author), a post and its tags and authors, the older and the newer posts,
// the archive, and the RSS and Atom feeds; and the sitemap of the site.

const { When, Then } = require('@cucumber/cucumber');
const {
  budget, clean, same, listed, splitList, shortUrl, poll, afterAction, readySitePage, failure, centre,
  siteUrl, pathOf,
} = require('./docusaurus-helpers');

/** The posts of the page: their titles, links, tags and authors. */
async function posts(world) {
  return world.page.evaluate(() => [...document.querySelectorAll('main article')].map((article) => {
    const title = article.querySelector('header h2, header h1, h2, h1');
    const link = title ? title.querySelector('a') : null;
    return {
      title: title ? title.textContent.replace(/\s+/g, ' ').trim() : '',
      href: link ? link.getAttribute('href') : null,
      tags: [...article.querySelectorAll('footer a[rel="tag"]')].map((a) => a.textContent.replace(/\s+/g, ' ').trim()),
      authors: [...new Set([...article.querySelectorAll('[class*="authorName"], .avatar__name')].map((a) => a.textContent.replace(/\s+/g, ' ').trim()))],
      time: (article.querySelector('time') || { getAttribute: () => '' }).getAttribute('datetime') || '',
    };
  }).filter((p) => p.title)).catch(() => []);
}

const LIST_HINT = 'A list page of the blog (/blog, /blog/page/2, a tag, an author) shows postsPerPage posts, newest first.';

/**
 * Assert the list page of the blog shown (the blog, a page of it, a tag, an
 * author) lists (or does not list) a post, by its title.
 *
 * Example #1: Then the blog should list the post "Version 2.0"
 * Example #2: And the blog should list the post "What Comes Next"
 * Example #3: But the blog should not list the post "Version 1.0"
 * Example #4: Then blog should list the post "Writing Better Guides"
 * Example #5: And the blog should not list the post "Welcome to Example Docs"
 */
Then(/^(?:the )?blog should( not)* list the post "([^"]*)?"$/, async function (notCase, title) {
  await readySitePage(this, 'the posts of the blog');
  let seen = [];
  const ok = await poll(this, async () => {
    seen = await posts(this);
    return seen.some((p) => same(p.title, title)) === !notCase;
  }, notCase ? 1500 : budget(this) / 2);
  if (!ok) {
    throw failure(this, notCase
      ? `Expected the blog page not to list the post "${title}", but it does.`
      : `Expected the blog page to list the post "${title}", but it lists ${listed(seen.map((p) => p.title))}.`, LIST_HINT);
  }
});

/**
 * Assert the posts of the list page shown, in order (a list: "What Comes
 * Next, Version 2.0"): exactly those posts, newest first.
 *
 * Example #1: Then the blog should list the posts "What Comes Next, Version 2.0"
 * Example #2: And the blog should list the posts "Writing Better Guides, Version 1.0"
 * Example #3: Then blog should list the posts "Welcome to Example Docs"
 * Example #4: And the blog should list the posts "What Comes Next and Version 2.0"
 * Example #5: Then the blog should list the posts "Version 2.0, Version 1.0"
 */
Then(/^(?:the )?blog should list the posts "([^"]*)?"$/, async function (list) {
  await readySitePage(this, 'the posts of the blog');
  const wanted = splitList(list);
  let seen = [];
  const ok = await poll(this, async () => {
    seen = await posts(this);
    return seen.length === wanted.length && seen.every((p, i) => same(p.title, wanted[i]));
  }, budget(this) / 2);
  if (!ok) throw failure(this, `Expected the blog page to list ${listed(wanted)} in that order, but it lists ${listed(seen.map((p) => p.title))}.`, LIST_HINT);
});

/**
 * Open a post from the list page shown, by its title: the post opens in the
 * same document.
 *
 * Example #1: When I open the blog post "Version 2.0"
 * Example #2: And I open the blog post "What Comes Next"
 * Example #3: When we open the blog post "Writing Better Guides"
 * Example #4: When open the blog post "Version 1.0"
 * Example #5: And I open the blog post "Welcome to Example Docs"
 */
When(/^(I |we )*open the blog post "([^"]*)?"$/, async function (pronoun, title) {
  await readySitePage(this, `the blog post "${title}"`);
  const seen = await posts(this);
  const post = seen.find((p) => same(p.title, title) && p.href);
  if (!post) throw failure(this, `The page lists no post "${title}" to open; it lists ${listed(seen.map((p) => p.title))}.`, LIST_HINT);
  const link = this.page.locator(`main article h2 a[href="${post.href}"], main article h1 a[href="${post.href}"]`).first();
  await centre(link);
  await afterAction(this, () => link.click({ timeout: budget(this) }));
  const arrived = await poll(this, async () => pathOf(this.page.url()) === pathOf(post.href, this.page.url()), budget(this) / 2);
  if (!arrived) throw failure(this, `The post "${title}" leads to ${post.href}, but the browser shows ${shortUrl(this.page.url())}.`, 'Look at the screenshot of the failure.');
});

/** The post of a post page. */
async function thePost(world) {
  const seen = await posts(world);
  if (seen.length !== 1) {
    throw failure(world, `Expected the page of one blog post, but ${shortUrl(world.page.url())} shows ${seen.length} posts (${listed(seen.map((p) => p.title))}).`, 'Open the post first (When I open the blog post "…").');
  }
  return seen[0];
}

/**
 * Assert the blog post shown carries (or does not carry) a tag.
 *
 * Example #1: Then the blog post should be tagged "Release"
 * Example #2: And the blog post should be tagged "Community"
 * Example #3: But the blog post should not be tagged "Guide"
 * Example #4: Then blog post should be tagged "Release"
 * Example #5: And the blog post should not be tagged "Community"
 */
Then(/^(?:the )?blog post should( not)* be tagged "([^"]*)?"$/, async function (notCase, tag) {
  await readySitePage(this, 'the tags of the post');
  const post = await thePost(this);
  if (post.tags.some((t) => same(t, tag)) === Boolean(notCase)) {
    throw failure(this, notCase ? `Expected the post "${post.title}" not to be tagged "${tag}", but it is.` : `Expected the post "${post.title}" to be tagged "${tag}", but its tags are ${listed(post.tags)}.`, 'The tags of a post are in its front matter (tags: […]), with their labels in blog/tags.yml.');
  }
});

/**
 * Assert who wrote the blog post shown: one of its authors has the name.
 *
 * Example #1: Then the blog post should be by "Alex Example"
 * Example #2: And the blog post should be by "Sam Example"
 * Example #3: Then blog post should be by "Alex Example"
 * Example #4: And the blog post should be written by "Sam Example"
 * Example #5: Then the blog post should be written by "Alex Example"
 */
Then(/^(?:the )?blog post should be (?:written )?by "([^"]*)?"$/, async function (name) {
  await readySitePage(this, 'the authors of the post');
  const post = await thePost(this);
  if (!post.authors.some((a) => same(a, name))) {
    throw failure(this, `Expected the post "${post.title}" to be by "${name}", but its authors are ${listed(post.authors)}.`, 'The authors of a post are in its front matter (authors: […]), with their names in blog/authors.yml.');
  }
});

/**
 * Open the page of a tag of the blog: from a post, from a list of posts or
 * from the page of all the tags (whose links also show how many posts carry
 * the tag). The page opens in the same document.
 *
 * Example #1: When I open the tag "Release"
 * Example #2: And I open the tag "Community"
 * Example #3: When we open the tag "Guide"
 * Example #4: When open the tag "Release"
 * Example #5: And I open the tag "Guide"
 */
When(/^(I |we )*open the tag "([^"]*)?"$/, async function (pronoun, tag) {
  await readySitePage(this, `the tag "${tag}"`);
  const links = this.page.locator('a[rel="tag"]');
  const count = await links.count();
  const seen = [];
  for (let i = 0; i < count; i += 1) {
    const link = links.nth(i);
    if (!(await link.isVisible().catch(() => false))) continue;
    const label = clean(await link.evaluate((el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('') || el.textContent));
    seen.push(label);
    if (same(label, tag)) {
      await centre(link);
      await afterAction(this, () => link.click({ timeout: budget(this) }));
      return;
    }
  }
  throw failure(this, `The page shows no tag "${tag}"; it shows ${listed(seen)}.`, 'The tags are shown on the posts and on /blog/tags.');
});

/** The pager of a list page or a post page of the blog. */
async function blogPager(world) {
  return world.page.evaluate(() => {
    const nav = document.querySelector('nav.pagination-nav');
    const read = (cls) => {
      const a = nav && nav.querySelector(`a.pagination-nav__link--${cls}`);
      return a ? { text: a.textContent.replace(/[«»]/g, '').replace(/\s+/g, ' ').trim(), href: a.getAttribute('href') } : null;
    };
    return { nav: Boolean(nav), older: read('next'), newer: read('prev'), post: document.documentElement.classList.contains('blog-post-page') };
  }).catch(() => ({ nav: false, older: null, newer: null, post: false }));
}

/**
 * Go to the older or the newer posts of a list page of the blog ("Older
 * entries", "Newer entries"), or from a post to the older or the newer post
 * ("Older post", "Newer post"). The page opens in the same document.
 *
 * Example #1: When I go to the older posts
 * Example #2: And I go to the newer posts
 * Example #3: When I go to the older post
 * Example #4: When we go to the newer post
 * Example #5: And I go to the older posts
 */
When(/^(I |we )*go to the (older|newer) posts?$/, async function (pronoun, which) {
  await readySitePage(this, `the ${which} posts`);
  const pagerState = await blogPager(this);
  const link = pagerState[which];
  if (!link) {
    throw failure(this, `The page has no link to the ${which} posts (${shortUrl(this.page.url())}).`, which === 'older' ? 'The last page of a list and the oldest post have no older ones.' : 'The first page of a list and the newest post have no newer ones.');
  }
  const target = this.page.locator(`nav.pagination-nav a.pagination-nav__link--${which === 'older' ? 'next' : 'prev'}`).first();
  await centre(target);
  await afterAction(this, () => target.click({ timeout: budget(this) }));
  const arrived = await poll(this, async () => pathOf(this.page.url()) === pathOf(link.href, this.page.url()), budget(this) / 2);
  if (!arrived) throw failure(this, `The link to the ${which} posts leads to ${link.href}, but the browser shows ${shortUrl(this.page.url())}.`, 'Look at the screenshot of the failure.');
});

/**
 * Assert the page of the blog has no link to older (or newer) posts: the
 * last (or the first) page of a list, the oldest (or the newest) post.
 *
 * Example #1: Then there should be no older posts
 * Example #2: And there should be no newer posts
 * Example #3: Then there should be no newer post
 * Example #4: And there should be no older post
 * Example #5: But there should be no newer posts
 */
Then(/^there should be no (older|newer) posts?$/, async function (which) {
  await readySitePage(this, `the ${which} posts`);
  const pagerState = await blogPager(this);
  if (pagerState[which]) {
    throw failure(this, `Expected no link to ${which} posts, but the page links to "${pagerState[which].text}" (${pagerState[which].href}).`, 'Only the last page of a list (the oldest post) has no older posts, and only the first (the newest) has no newer ones.');
  }
});

/**
 * Assert the archive of the blog (/blog/archive) lists a post, under a year
 * when one is given: its links read "<date> - <title>".
 *
 * Example #1: Then the blog archive should list "Version 2.0"
 * Example #2: And the blog archive should list "Welcome to Example Docs" under "2026"
 * Example #3: Then blog archive should list "Writing Better Guides" under "2026"
 * Example #4: And the blog archive should list "What Comes Next"
 * Example #5: Then the blog archive should list "Version 1.0" under "2026"
 */
Then(/^(?:the )?blog archive should list "([^"]*)?"(?: under "([^"]*)?")?$/, async function (title, year) {
  await readySitePage(this, 'the archive of the blog');
  let years = [];
  const ok = await poll(this, async () => {
    years = await this.page.evaluate(() => [...document.querySelectorAll('main h3')].map((h) => {
      const list = h.nextElementSibling && h.nextElementSibling.tagName === 'UL' ? h.nextElementSibling : null;
      return {
        year: [...h.childNodes].filter((n) => !(n.nodeType === 1 && n.classList.contains('hash-link'))).map((n) => n.textContent).join('').replace(/[​\s]+/g, ' ').trim(),
        posts: list ? [...list.querySelectorAll('a')].map((a) => a.textContent.replace(/\s+/g, ' ').trim()) : [],
      };
    })).catch(() => []);
    return years.some((y) => (!year || same(y.year, year)) && y.posts.some((p) => same(p.replace(/^.*? - /, ''), title)));
  }, budget(this) / 2);
  if (!ok) {
    throw failure(this, `Expected the archive to list "${title}"${year ? ` under ${year}` : ''}, but it lists ${years.length ? years.map((y) => `${y.year}: ${listed(y.posts)}`).join('; ') : 'nothing'} (${shortUrl(this.page.url())}).`, 'The archive is /blog/archive: every post of the blog, by year.');
  }
});

/** Fetch a text of the site in the page (the cookies and the certificate of the browser). */
async function fetchText(world, url) {
  return world.page.evaluate(async (address) => {
    try {
      const response = await fetch(address, { credentials: 'same-origin' });
      return { status: response.status, type: response.headers.get('content-type') || '', text: await response.text() };
    } catch (e) {
      return { status: 0, type: '', text: '', error: String(e && e.message) };
    }
  }, url);
}

/** The titles of the items of a feed (RSS or Atom), CDATA unwrapped. */
function feedTitles(xml, kind) {
  const block = kind === 'RSS' ? /<item>([\s\S]*?)<\/item>/g : /<entry>([\s\S]*?)<\/entry>/g;
  const titles = [];
  let m;
  while ((m = block.exec(xml))) {
    const t = m[1].match(/<title[^>]*>([\s\S]*?)<\/title>/);
    if (t) titles.push(t[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim());
  }
  return titles;
}

/**
 * Assert the RSS or the Atom feed of the blog lists (or does not list) a
 * post, by its title. The feed is the one the page links to (`<link
 * rel="alternate">`), or the path given.
 *
 * Example #1: Then the RSS feed should list "Version 2.0"
 * Example #2: And the Atom feed should list "What Comes Next"
 * Example #3: Then the RSS feed at "/blog/rss.xml" should list "Welcome to Example Docs"
 * Example #4: But the Atom feed at "/blog/atom.xml" should not list "Version 3.0"
 * Example #5: And RSS feed should not list "Version 3.0"
 */
Then(/^(?:the )?(RSS|Atom) feed(?: at "([^"]*)")? should( not)* list "([^"]*)?"$/, async function (kind, path, notCase, title) {
  let address = path ? siteUrl(this, path) : null;
  if (!address) {
    const linked = await this.page.evaluate((type) => {
      const link = document.querySelector(`link[rel="alternate"][type="${type}"]`);
      return link ? new URL(link.getAttribute('href'), location.href).href : null;
    }, kind === 'RSS' ? 'application/rss+xml' : 'application/atom+xml').catch(() => null);
    address = linked || siteUrl(this, kind === 'RSS' ? '/blog/rss.xml' : '/blog/atom.xml');
  }
  const answer = await fetchText(this, address);
  if (answer.status !== 200) {
    throw failure(this, `The ${kind} feed at ${shortUrl(address)} answered ${answer.status || answer.error || 'nothing'}.`, 'The blog writes rss.xml and atom.xml when feedOptions.type lists them; open a page of the site first, so the feed is fetched from it.');
  }
  const titles = feedTitles(answer.text, kind);
  if (titles.some((t) => same(t, title)) === Boolean(notCase)) {
    throw failure(this, notCase ? `Expected the ${kind} feed not to list "${title}", but it does.` : `Expected the ${kind} feed to list "${title}", but it lists ${listed(titles)}.`, 'The feeds list the posts of the blog, newest first (feedOptions.limit sets how many).');
  }
});

/**
 * Assert the sitemap of the site (/sitemap.xml, or the one given: each
 * language writes its own, /fr/sitemap.xml) lists (or does not list) a page,
 * by its path. The sitemap names each page by the site's url in the
 * configuration, so only the path is compared.
 *
 * Example #1: Then the sitemap should list "/docs/intro"
 * Example #2: And the sitemap should list "/blog/version-2-0"
 * Example #3: But the sitemap should not list "/docs/no-such-page"
 * Example #4: Then the sitemap at "/fr/sitemap.xml" should list "/fr/docs/intro"
 * Example #5: And sitemap should list "/docs/1.0/intro"
 */
Then(/^(?:the )?sitemap(?: at "([^"]*)")? should( not)* list "([^"]*)?"$/, async function (at, notCase, path) {
  const address = siteUrl(this, at || '/sitemap.xml');
  const answer = await fetchText(this, address);
  if (answer.status !== 200) {
    throw failure(this, `The sitemap (${shortUrl(address)}) answered ${answer.status || answer.error || 'nothing'}.`, 'The classic preset writes sitemap.xml in a production build, one per language (/<locale>/sitemap.xml); open a page of the site first, so the sitemap is fetched from it.');
  }
  const paths = [...answer.text.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => pathOf(m[1]));
  if (paths.includes(pathOf(path)) === Boolean(notCase)) {
    throw failure(this, notCase ? `Expected the sitemap not to list ${path}, but it does.` : `Expected the sitemap to list ${path}, but it does not (it lists ${paths.length} pages, among them ${listed(paths.slice(0, 8))}).`, 'The sitemap lists every page of the build but the ones marked noindex; each language writes its own (/fr/sitemap.xml).');
  }
});
