'use strict';

// Step definitions for the menus of the navbar (a menu of links, the version
// menu, the language menu) and for the navigation menu the navbar folds into
// at a narrow width.
//
// On a wide screen a menu of the navbar opens when the pointer is on it (and
// with Enter on the keyboard); a click on its label does nothing. The version
// menu shows the version of the page and lists the same page in every version;
// the language menu lists the same page in every language, and choosing one
// loads that language's site from the server.

const { When, Then } = require('@cucumber/cucumber');
const {
  budget, clean, same, listed, splitList, shortUrl, poll, afterAction, readySitePage, failure,
  centre, findMenu, describeMenus, menuName, openMenu, pageReady,
} = require('./docusaurus-helpers');

/** 'version', 'locale' or the label of a menu, from the words of a step. */
function which(label, kind) {
  if (kind === 'version') return 'version';
  if (kind === 'language') return 'locale';
  return label;
}

/** Open a menu and click one of its items, then wait for the page it leads to. */
async function choose(world, menu, item) {
  const { dropdown, menu: found } = await openMenu(world, menu);
  const entry = found.items.find((i) => same(i.label, item));
  if (!entry) {
    throw failure(world, `${menuName(menu)} has no item "${item}". It lists: ${listed(found.items.map((i) => i.label))}.`, 'Name the item by the text the menu shows.');
  }
  if (entry.external) {
    throw failure(world, `The item "${item}" of ${menuName(menu)} opens ${entry.href} in a new tab: this step does not follow it.`, 'Check where it leads with: the navbar link "…" should open "…" in a new tab.');
  }
  const link = dropdown.locator('.dropdown__menu a, .dropdown__menu button').filter({ hasText: item }).first();
  await afterAction(world, () => link.click({ timeout: budget(world) }));
  await world.page.mouse.move(1, 1).catch(() => {});
}

/**
 * Open a menu of the navbar, the way a person with a mouse does: the pointer
 * on its label. The menu is named by its label, or is the version menu or the
 * language menu. The step waits until its items are shown.
 *
 * Example #1: When I open the "Community" menu of the navbar
 * Example #2: And I open the version menu
 * Example #3: When we open the language menu
 * Example #4: When open the "Community" menu of the navbar
 * Example #5: And I open the "Community" menu of the navbar
 */
When(/^(I |we )*open the (?:"([^"]*)?" menu of the navbar|(version|language) menu)$/, async function (pronoun, label, kind) {
  await openMenu(this, which(label, kind));
});

/**
 * Open a menu of the navbar and choose one of its items: a page of the site
 * opens in the same document; a version opens the same page in that version
 * (or the first page of that version when the page is not in it); a language
 * loads the same page of that language's site from the server.
 *
 * Example #1: When I choose "Support" in the "Community" menu of the navbar
 * Example #2: And I choose "1.0" in the version menu
 * Example #3: When I choose "Français" in the language menu
 * Example #4: When we choose "Next" in the version menu
 * Example #5: And I choose "English" in the language menu
 */
When(/^(I |we )*choose "([^"]*)?" in the (?:"([^"]*)?" menu of the navbar|(version|language) menu)$/, async function (pronoun, item, label, kind) {
  await choose(this, which(label, kind), item);
});

/**
 * Assert a menu of the navbar lists (or does not list) one or more items,
 * given as a list ("Next, 2.0 and 1.0"): each must be there, in that order;
 * with "not", none of them may be there.
 *
 * Example #1: Then the "Community" menu of the navbar should list "Support, Forum"
 * Example #2: And the version menu should list "Next, 2.0 and 1.0"
 * Example #3: Then the language menu should list "English, Français"
 * Example #4: But the version menu should not list "3.0"
 * Example #5: And the "Community" menu of the navbar should not list "Docs"
 */
Then(/^(?:the )?(?:"([^"]*)?" menu of the navbar|(version|language) menu) should( not)* list "([^"]*)?"$/, async function (label, kind, notCase, items) {
  const menu = which(label, kind);
  await readySitePage(this, menuName(menu));
  const wanted = splitList(items);
  let found = null;
  let menus = [];
  await poll(this, async () => {
    const r = await findMenu(this, menu);
    found = r.menu;
    menus = r.menus;
    return Boolean(found);
  }, budget(this) / 2);
  if (!found) throw failure(this, `Expected ${menuName(menu)}, but ${describeMenus(menus)}.`, 'At a narrow width the menus of the navbar are in the navigation menu.');
  const labels = found.items.map((i) => clean(i.label));
  if (notCase) {
    const there = wanted.filter((w) => labels.some((l) => same(l, w)));
    if (there.length) throw failure(this, `Expected ${menuName(menu)} not to list ${listed(there)}, but it does: ${listed(labels)}.`, 'The items come from the configuration of the navbar, the versions of the docs (versions.json) or the locales (i18n.locales).');
    return;
  }
  let at = -1;
  for (const w of wanted) {
    const index = labels.findIndex((l, i) => i > at && same(l, w));
    if (index < 0) {
      throw failure(this, `Expected ${menuName(menu)} to list ${listed(wanted)} in that order, but it lists ${listed(labels)}.`, 'The items come from the configuration of the navbar, the versions of the docs (versions.json) or the locales (i18n.locales).');
    }
    at = index;
  }
});

/**
 * Assert what the version menu or the language menu shows as its label: the
 * version of the page (on a page of the docs; elsewhere the version last
 * chosen) or the language of the page.
 *
 * Example #1: Then the version menu should show "2.0"
 * Example #2: And the language menu should show "Français"
 * Example #3: Then the version menu should show "1.0"
 * Example #4: And version menu should show "Next"
 * Example #5: Then the language menu should show "English"
 */
Then(/^(?:the )?(version|language) menu should show "([^"]*)?"$/, async function (kind, label) {
  const menu = which(null, kind);
  await readySitePage(this, menuName(menu));
  let found = null;
  let menus = [];
  const ok = await poll(this, async () => {
    const r = await findMenu(this, menu);
    found = r.menu;
    menus = r.menus;
    return Boolean(found) && same(found.label, label);
  }, budget(this) / 2);
  if (!ok) {
    if (!found) throw failure(this, `Expected ${menuName(menu)}, but ${describeMenus(menus)}.`, 'At a narrow width the menus of the navbar are in the navigation menu.');
    throw failure(this, `Expected ${menuName(menu)} to show "${label}", but it shows "${found.label}".`, kind === 'version'
      ? 'On a page of the docs the version menu shows the version of the page; elsewhere it shows the version chosen last in this browser.'
      : 'The language menu shows the language of the page: its address starts with /<locale>/ for every language but the default one.');
  }
});

/** The state of the navigation menu (the navbar at a narrow width). */
async function navigationMenu(world) {
  return world.page.evaluate(() => {
    const toggle = document.querySelector('nav.navbar .navbar__toggle');
    const nav = document.querySelector('nav.navbar');
    const visible = (el) => Boolean(el) && el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
    return {
      toggle: visible(toggle),
      open: Boolean(nav && nav.classList.contains('navbar-sidebar--show')),
      expanded: toggle ? toggle.getAttribute('aria-expanded') : null,
      width: window.innerWidth,
    };
  }).catch(() => ({ toggle: false, open: false, expanded: null, width: 0 }));
}

/**
 * Open or close the navigation menu, the navbar folded into a panel at a
 * narrow width (its button "Toggle navigation bar"; "Close navigation bar"
 * inside the panel). On a page of the docs the panel opens on the sidebar of
 * the docs, with "← Back to main menu" above it.
 *
 * Example #1: When I open the navigation menu
 * Example #2: And I close the navigation menu
 * Example #3: When we open the navigation menu
 * Example #4: When open the navigation menu
 * Example #5: Then I close the navigation menu
 */
When(/^(I |we )*(open|close) the navigation menu$/, async function (pronoun, action) {
  await readySitePage(this, 'the navigation menu');
  const state = await navigationMenu(this);
  if (!state.toggle && !state.open) {
    throw failure(this, `The navbar shows no button for the navigation menu at this width (${state.width} px): it folds into one only on a narrow screen.`, 'Make the window narrow first: When I set the viewport to the "xs" breakpoint.');
  }
  if ((action === 'open') === state.open) return;
  const button = action === 'open'
    ? this.page.locator('nav.navbar .navbar__toggle').first()
    : this.page.locator('.navbar-sidebar .navbar-sidebar__close, .navbar-sidebar button[aria-label="Close navigation bar"]').first();
  await centre(button);
  await afterAction(this, () => button.click({ timeout: budget(this) }));
  const ok = await poll(this, async () => (await navigationMenu(this)).open === (action === 'open'), budget(this) / 2);
  if (!ok) throw failure(this, `The navigation menu did not ${action}.`, 'Look at the screenshot: something may cover the button.');
});

/**
 * Assert the navigation menu (the navbar at a narrow width) is open or
 * closed.
 *
 * Example #1: Then the navigation menu should be open
 * Example #2: And the navigation menu should be closed
 * Example #3: Then navigation menu should be open
 * Example #4: But the navigation menu should be closed
 * Example #5: And the navigation menu should be open
 */
Then(/^(?:the )?navigation menu should be (open|closed)$/, async function (state) {
  await pageReady(this);
  let seen;
  const ok = await poll(this, async () => {
    seen = await navigationMenu(this);
    return seen.open === (state === 'open');
  }, budget(this) / 2);
  if (!ok) {
    throw failure(this, `Expected the navigation menu to be ${state}, but it is ${seen.open ? 'open' : 'closed'}${seen.toggle ? '' : ` (the navbar has no button for it at ${seen.width} px)`}.`, 'The navbar folds into the navigation menu only on a narrow screen: When I set the viewport to the "xs" breakpoint.');
  }
});

/**
 * In the open navigation menu of a page of the docs, go from the sidebar of
 * the docs back to the main menu (the links of the navbar), with its button
 * "← Back to main menu".
 *
 * Example #1: When I go back to the main menu
 * Example #2: And I go back to the main menu
 * Example #3: When we go back to the main menu
 * Example #4: When go back to the main menu
 * Example #5: Then I go back to the main menu
 */
When(/^(I |we )*go back to the main menu$/, async function (pronoun) {
  await readySitePage(this, 'the main menu');
  const back = this.page.locator('.navbar-sidebar .navbar-sidebar__back').first();
  if (!(await back.isVisible().catch(() => false))) {
    throw failure(this, `The navigation menu shows no button back to the main menu on ${shortUrl(this.page.url())}.`, 'The navigation menu opens on the sidebar of the docs only on a page of the docs; open the navigation menu first.');
  }
  await afterAction(this, () => back.click({ timeout: budget(this) }));
  const ok = await poll(this, () => this.page.evaluate(() => {
    const items = document.querySelector('.navbar-sidebar__items');
    return Boolean(items) && !items.classList.contains('navbar-sidebar__items--show-secondary');
  }), budget(this) / 2);
  if (!ok) throw failure(this, 'The navigation menu did not go back to the main menu.', 'Look at the screenshot of the failure.');
});
