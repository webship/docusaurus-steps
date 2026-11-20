'use strict';

// Step definitions for what the site remembers in the browser: the colour
// mode (light, dark, or the system's), and the announcement bar once it is
// closed.
//
// The colour button of the navbar goes round three choices: the system's,
// light, dark. The page shows its colours in <html data-theme> and the choice
// in <html data-theme-choice>; a script that runs before the page is drawn
// reads the stored choice, so a reload keeps it. A closed announcement bar
// stays closed the same way (<html data-announcement-bar-initially-dismissed>).

const { Given, When, Then } = require('@cucumber/cucumber');
const {
  budget, poll, afterAction, readySitePage, pageReady, failure, colourMode, centre,
} = require('./docusaurus-helpers');

/**
 * Tell the browser to prefer a light or a dark colour scheme, as an
 * operating system set to it does: a site that follows the system's choice
 * shows that one.
 *
 * Example #1: Given the browser prefers a dark colour scheme
 * Example #2: And the browser prefers a light colour scheme
 * Example #3: Given browser prefers a dark color scheme
 * Example #4: When the browser prefers a light color scheme
 * Example #5: Given the browser prefers a dark colour scheme
 */
Given(/^(?:the )?browser prefers a (light|dark) colou?r scheme$/, async function (scheme) {
  await this.page.emulateMedia({ colorScheme: scheme });
});

/**
 * Switch the colour mode with the colour button of the navbar to light,
 * dark, or the system's ("system"): the button goes round the three, so the
 * step clicks it until the page has the choice asked for.
 *
 * Example #1: When I switch the colour mode to "dark"
 * Example #2: And I switch the colour mode to "light"
 * Example #3: When we switch the color mode to "system"
 * Example #4: When switch the colour mode to "dark"
 * Example #5: And I switch the color mode to "light"
 */
When(/^(I |we )*switch the colou?r mode to "(light|dark|system)"$/, async function (pronoun, wanted) {
  await readySitePage(this, 'the colour button');
  const button = this.page.locator('nav.navbar button[class*="toggleButton"], nav.navbar .navbar__items--right button[title]').first();
  if (!(await button.count()) || !(await button.isVisible().catch(() => false))) {
    throw failure(this, 'The navbar shows no colour button.', 'The colour button is hidden when themeConfig.colorMode.disableSwitch is true; at a narrow width it is in the navigation menu.');
  }
  for (let round = 0; round < 4; round += 1) {
    const mode = await colourMode(this);
    if (mode.choice === wanted) return;
    const before = mode.choice;
    await centre(button);
    await afterAction(this, () => button.click({ timeout: budget(this) }));
    await poll(this, async () => (await colourMode(this)).choice !== before, 2000, 25);
  }
  const mode = await colourMode(this);
  throw failure(this, `The colour button did not reach "${wanted}": the page's choice is "${mode.choice}".`, 'The button goes round system, light and dark; a site that does not follow the system (respectPrefersColorScheme: false) has only light and dark.');
});

/**
 * Assert the colours the page shows: light or dark (`<html data-theme>`),
 * whatever was chosen to get there.
 *
 * Example #1: Then the colour mode should be "dark"
 * Example #2: And the colour mode should be "light"
 * Example #3: Then color mode should be "dark"
 * Example #4: And the color mode should be "light"
 * Example #5: Then the colour mode should be "light"
 */
Then(/^(?:the )?colou?r mode should be "(light|dark)"$/, async function (wanted) {
  await pageReady(this);
  let mode;
  const ok = await poll(this, async () => {
    mode = await colourMode(this);
    return mode.shown === wanted;
  }, budget(this) / 2);
  if (!ok) {
    throw failure(this, `Expected the page in the ${wanted} colour mode, but it shows ${mode.shown || 'no colour mode'} (the choice is "${mode.choice || 'none'}").`, 'The choice "system" shows the scheme the browser prefers (Given the browser prefers a dark colour scheme); a choice stays in the browser, so a reload keeps it.');
  }
});

/**
 * Assert the colour mode follows (or does not follow) the system's choice:
 * the page was given no choice of its own (`<html data-theme-choice="system">`).
 *
 * Example #1: Then the colour mode should follow the system
 * Example #2: But the colour mode should not follow the system
 * Example #3: Then color mode should follow the system
 * Example #4: And the colour mode should follow the system
 * Example #5: And the color mode should not follow the system
 */
Then(/^(?:the )?colou?r mode should( not)* follow the system$/, async function (notCase) {
  await pageReady(this);
  let mode;
  const ok = await poll(this, async () => {
    mode = await colourMode(this);
    return (mode.choice === 'system') === !notCase;
  }, notCase ? 1500 : budget(this) / 2);
  if (!ok) {
    throw failure(this, notCase
      ? 'Expected a colour mode chosen on the page, but it follows the system.'
      : `Expected the colour mode to follow the system, but the page has the choice "${mode.choice}".`,
    'The colour button goes round system, light and dark; the choice stays in the browser.');
  }
});

/**
 * Assert the announcement bar at the top of the page is (or is not) shown.
 * A closed bar stays closed in that browser, across pages and reloads.
 *
 * Example #1: Then I should see the announcement bar
 * Example #2: But I should not see the announcement bar
 * Example #3: Then we should see the announcement bar
 * Example #4: And I should not see the announcement bar
 * Example #5: Then should see the announcement bar
 */
Then(/^(I |we )*should( not)* see the announcement bar$/, async function (pronoun, notCase) {
  await readySitePage(this, 'the announcement bar');
  let shown;
  const ok = await poll(this, async () => {
    shown = await this.page.evaluate(() => {
      const bar = document.querySelector('.theme-announcement-bar');
      return Boolean(bar) && bar.getBoundingClientRect().height > 0 && getComputedStyle(bar).display !== 'none';
    });
    return shown === !notCase;
  }, notCase ? 2000 : budget(this) / 2);
  if (!ok) {
    throw failure(this, notCase ? 'Expected no announcement bar, but the page shows it.' : 'Expected the announcement bar, but the page does not show it.', 'The bar comes from themeConfig.announcementBar; once closed it stays closed in that browser until its id changes.');
  }
});

/**
 * Close the announcement bar with its close button, and wait until it is
 * gone.
 *
 * Example #1: When I close the announcement bar
 * Example #2: And I close the announcement bar
 * Example #3: When we close the announcement bar
 * Example #4: When close the announcement bar
 * Example #5: Then I close the announcement bar
 */
When(/^(I |we )*close the announcement bar$/, async function (pronoun) {
  await readySitePage(this, 'the announcement bar');
  const bar = this.page.locator('.theme-announcement-bar').first();
  if (!(await bar.isVisible().catch(() => false))) {
    throw failure(this, 'The page shows no announcement bar to close.', 'A bar closed earlier in this browser stays closed; the scenarios start with a new browser.');
  }
  const close = bar.locator('button').first();
  if (!(await close.count())) throw failure(this, 'The announcement bar has no close button.', 'A bar with isCloseable: false cannot be closed.');
  await afterAction(this, () => close.click({ timeout: budget(this) }));
  const gone = await poll(this, async () => !(await bar.isVisible().catch(() => false)), budget(this) / 2);
  if (!gone) throw failure(this, 'The announcement bar is still shown after its close button was clicked.', 'Look at the screenshot of the failure.');
});
