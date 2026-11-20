'use strict';

// Step definitions for what the pages of the docs and the blog are made of:
// admonitions (note, tip, info, warning, danger), tabs (synced across the page
// by a group, and remembered), and code blocks (their title, highlighted
// lines, line numbers, language and copy button).

const { When, Then } = require('@cucumber/cucumber');
const {
  budget, clean, same, listed, poll, afterAction, readySitePage, failure, centre, copiedTexts,
} = require('./docusaurus-helpers');

const ADMONITION_HINT = 'An admonition is written :::note (tip, info, warning, danger) … ::: in Markdown; its title is the word of its type unless one is given in brackets (:::tip[Keep it short]).';

/** The admonitions of the page, with their type, title and text. */
async function admonitions(world) {
  return world.page.evaluate(() => [...document.querySelectorAll('.theme-admonition')].map((el) => {
    const type = ([...el.classList].find((c) => /^theme-admonition-/.test(c)) || '').replace('theme-admonition-', '');
    const heading = el.querySelector(':scope > div:first-child');
    const body = el.querySelector(':scope > div:last-child');
    return {
      type,
      title: heading ? heading.textContent.replace(/\s+/g, ' ').trim() : '',
      text: body ? body.textContent.replace(/\s+/g, ' ').trim() : el.textContent.replace(/\s+/g, ' ').trim(),
      visible: el.getBoundingClientRect().height > 0,
    };
  })).catch(() => []);
}

/**
 * Assert the page shows (or does not show) an admonition of a type: note,
 * tip, info, warning, danger (or caution, the older name of a warning).
 *
 * Example #1: Then I should see a "note" admonition
 * Example #2: And I should see a "danger" admonition
 * Example #3: But I should not see a "caution" admonition
 * Example #4: Then we should see an "info" admonition
 * Example #5: And I should see a "warning" admonition
 */
Then(/^(I |we )*should( not)* see an? "(note|tip|info|warning|danger|caution)" admonition$/, async function (pronoun, notCase, type) {
  await readySitePage(this, `a "${type}" admonition`);
  let all = [];
  const ok = await poll(this, async () => {
    all = await admonitions(this);
    return all.some((a) => a.visible && a.type === type) === !notCase;
  }, notCase ? 1500 : budget(this) / 2);
  if (!ok) {
    throw failure(this, notCase
      ? `Expected no "${type}" admonition, but the page shows one: "${all.find((a) => a.type === type).text.slice(0, 120)}".`
      : `Expected a "${type}" admonition, but the page shows ${all.length ? listed(all.map((a) => `${a.type}: ${a.title}`)) : 'none'}.`, ADMONITION_HINT);
  }
});

/**
 * Assert the page shows an admonition of a type with a title: the word of
 * its type ("note") unless the page gives it one ("Keep it short").
 *
 * Example #1: Then I should see a "tip" admonition titled "Keep it short"
 * Example #2: And I should see a "danger" admonition titled "Do not publish secrets"
 * Example #3: Then we should see a "note" admonition titled "note"
 * Example #4: And I should see an "info" admonition titled "info"
 * Example #5: Then I should see a "warning" admonition titled "warning"
 */
Then(/^(I |we )*should see an? "(note|tip|info|warning|danger|caution)" admonition titled "([^"]*)?"$/, async function (pronoun, type, title) {
  await readySitePage(this, `a "${type}" admonition`);
  let all = [];
  const ok = await poll(this, async () => {
    all = await admonitions(this);
    return all.some((a) => a.visible && a.type === type && same(a.title, title));
  }, budget(this) / 2);
  if (!ok) {
    const sameType = all.filter((a) => a.type === type);
    throw failure(this, `Expected a "${type}" admonition titled "${title}", but ${sameType.length ? `the "${type}" admonitions are titled ${listed(sameType.map((a) => a.title))}` : `the page shows ${all.length ? listed(all.map((a) => `${a.type}: ${a.title}`)) : 'no admonition'}`}.`, ADMONITION_HINT);
  }
});

/**
 * Assert an admonition of a type says a text (a part of its content, case
 * and spacing aside).
 *
 * Example #1: Then the "danger" admonition should say "Never put a password or a key in a page."
 * Example #2: And the "note" admonition should say "Edit this page"
 * Example #3: Then "tip" admonition should say "Short sentences"
 * Example #4: And the "warning" admonition should say "gets the name of its file"
 * Example #5: Then the "info" admonition should say "written in Markdown"
 */
Then(/^(?:the )?"(note|tip|info|warning|danger|caution)" admonition should say "([^"]*)?"$/, async function (type, text) {
  await readySitePage(this, `the "${type}" admonition`);
  let all = [];
  const want = clean(text).toLowerCase();
  const ok = await poll(this, async () => {
    all = await admonitions(this);
    return all.some((a) => a.visible && a.type === type && a.text.toLowerCase().includes(want));
  }, budget(this) / 2);
  if (!ok) {
    const sameType = all.filter((a) => a.type === type);
    throw failure(this, sameType.length
      ? `Expected the "${type}" admonition to say "${text}", but it says ${listed(sameType.map((a) => a.text.slice(0, 160)))}.`
      : `Expected a "${type}" admonition saying "${text}", but the page has no "${type}" admonition.`, ADMONITION_HINT);
  }
});

/** The tab groups of the page: their tabs, the selected one and its panel. */
async function tabGroups(world) {
  return world.page.evaluate(() => [...document.querySelectorAll('[role="tablist"]')].map((list) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    // The panels of this group are the children of the block after its tab list (a group of tabs
    // inside a panel has panels of its own).
    const container = list.closest('.tabs-container') || list.parentElement;
    const panels = container ? [...container.querySelectorAll(':scope > div > [role="tabpanel"]')] : [];
    const shown = panels.find((p) => !p.hidden);
    return {
      tabs: tabs.map((t) => ({ label: t.textContent.replace(/\s+/g, ' ').trim(), selected: t.getAttribute('aria-selected') === 'true' })),
      panel: shown ? shown.textContent.replace(/\s+/g, ' ').trim() : '',
      visible: list.getBoundingClientRect().height > 0,
    };
  })).catch(() => []);
}

/**
 * Choose a tab, the way a person does, once the page has hydrated (a click
 * on a tab before that is lost), and wait until the tab is selected in every
 * group of tabs of the page that has it: tabs that share a group choose
 * together, and the site remembers the choice of a group in this browser.
 *
 * Example #1: When I choose the "macOS" tab
 * Example #2: And I choose the "TypeScript" tab
 * Example #3: When we choose the "Windows" tab
 * Example #4: When choose the "Linux" tab
 * Example #5: And I choose the "JavaScript" tab
 */
When(/^(I |we )*choose the "([^"]*)?" tab$/, async function (pronoun, label) {
  await readySitePage(this, `the "${label}" tab`);
  const tab = this.page.getByRole('tab', { name: label, exact: true }).first();
  if (!(await tab.count())) {
    const groups = await tabGroups(this);
    throw failure(this, `The page has no tab "${label}". Its tabs: ${listed(groups.flatMap((g) => g.tabs.map((t) => t.label)))}.`, 'Name the tab by the label it shows.');
  }
  await centre(tab);
  await afterAction(this, () => tab.click({ timeout: budget(this) }));
  let groups = [];
  const ok = await poll(this, async () => {
    groups = (await tabGroups(this)).filter((g) => g.tabs.some((t) => same(t.label, label)));
    return groups.length > 0 && groups.every((g) => g.tabs.some((t) => t.selected && same(t.label, label)));
  }, budget(this) / 2);
  if (!ok) {
    throw failure(this, `The "${label}" tab was clicked, but not every group of tabs that has it selected it: ${listed(groups.map((g) => (g.tabs.find((t) => t.selected) || { label: '(none)' }).label))}.`, 'Groups of tabs choose together only when they share a groupId; a tab outside the group keeps its own choice.');
  }
});

/**
 * Assert a tab is (or is not) the selected one (`aria-selected="true"`): in
 * the first group of tabs that has it, or in every group that has it (tabs
 * of one group choose together; after a reload the site gives back the tab
 * chosen last, once the page has hydrated).
 *
 * Example #1: Then the "macOS" tab should be selected
 * Example #2: And the "macOS" tab should be selected in every group
 * Example #3: But the "Linux" tab should not be selected
 * Example #4: Then "TypeScript" tab should be selected
 * Example #5: And the "Windows" tab should not be selected in every group
 */
Then(/^(?:the )?"([^"]*)?" tab should( not)* be selected( in every group)?$/, async function (label, notCase, every) {
  await readySitePage(this, `the "${label}" tab`);
  let groups = [];
  const ok = await poll(this, async () => {
    groups = (await tabGroups(this)).filter((g) => g.tabs.some((t) => same(t.label, label)));
    if (!groups.length) return false;
    const chosen = groups.map((g) => g.tabs.some((t) => t.selected && same(t.label, label)));
    const holds = every ? chosen.every(Boolean) : chosen[0];
    return holds === !notCase;
  }, notCase ? 2000 : budget(this) / 2);
  if (!ok) {
    if (!groups.length) throw failure(this, `The page has no tab "${label}".`, 'Name the tab by the label it shows.');
    const selected = groups.map((g) => (g.tabs.find((t) => t.selected) || { label: '(none)' }).label);
    throw failure(this, notCase
      ? `Expected the "${label}" tab not to be selected${every ? ' in every group' : ''}, but it is (selected: ${listed(selected)}).`
      : `Expected the "${label}" tab to be selected${every ? ' in every group' : ''}, but the selected tab${groups.length > 1 ? 's are' : ' is'} ${listed(selected)}.`,
    'The site applies a remembered choice only after the page has hydrated; a tab of a group shared by the page follows the choice of the group.');
  }
});

/**
 * Assert the panel of the selected tab (in any group of tabs of the page)
 * shows a text.
 *
 * Example #1: Then the selected tab should show "brew install example"
 * Example #2: And the selected tab should show "const port: number = config.port;"
 * Example #3: Then selected tab should show "winget install Example.Cli"
 * Example #4: And the selected tab should show "Open Terminal"
 * Example #5: Then the selected tab should show "curl -fsSL"
 */
Then(/^(?:the )?selected tab should show "([^"]*)?"$/, async function (text) {
  await readySitePage(this, 'the selected tab');
  let groups = [];
  const want = clean(text).toLowerCase();
  const ok = await poll(this, async () => {
    groups = await tabGroups(this);
    return groups.some((g) => g.visible && g.panel.toLowerCase().includes(want));
  }, budget(this) / 2);
  if (!ok) {
    throw failure(this, `Expected the selected tab to show "${text}", but the selected panels show ${listed(groups.map((g) => g.panel.slice(0, 120)))}.`, 'Only the panel of the selected tab of a group is shown; choose the tab first (When I choose the "…" tab).');
  }
});

/** The code blocks of the page. */
async function codeBlocks(world) {
  return world.page.evaluate(() => [...document.querySelectorAll('.theme-code-block')].map((block, index) => {
    const title = block.querySelector('[class*="codeBlockTitle"]');
    const lines = [...block.querySelectorAll('.token-line')];
    return {
      index,
      title: title ? title.textContent.trim() : '',
      language: ([...block.classList].find((c) => c.startsWith('language-')) || '').replace('language-', ''),
      code: lines.map((l) => l.textContent.replace(/\n$/, '')).join('\n'),
      highlighted: lines.map((l, i) => (l.classList.contains('theme-code-block-highlighted-line') ? i + 1 : 0)).filter(Boolean),
      numbered: Boolean(block.querySelector('code[class*="codeBlockLinesWithNumbering"], [class*="codeLineNumber"]')),
      visible: block.getBoundingClientRect().height > 0,
    };
  })).catch(() => []);
}

/**
 * The code block a step names: by its title ("example.config.js"), else the
 * first visible one whose code contains the text.
 */
async function findCodeBlock(world, name) {
  let all = [];
  let block = null;
  await poll(world, async () => {
    all = await codeBlocks(world);
    block = all.find((b) => b.visible && same(b.title, name)) || all.find((b) => b.visible && b.code.toLowerCase().includes(clean(name).toLowerCase())) || null;
    return Boolean(block);
  }, budget(world) / 2);
  if (!block) {
    throw failure(world, `The page has no visible code block "${name}". Its code blocks: ${listed(all.filter((b) => b.visible).map((b) => b.title || b.code.split('\n')[0]))}.`, 'Name a code block by its title (```js title="…"), or by a part of its code. A block in a hidden tab panel is not visible: choose its tab first.');
  }
  return block;
}

/** "2, 4-5" or "2, 4 and 5": the line numbers. */
function lineNumbers(text) {
  const out = [];
  for (const part of String(text).split(/\s*,\s*|\s+and\s+/)) {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) for (let n = Number(range[1]); n <= Number(range[2]); n += 1) out.push(n);
    else if (/^\d+$/.test(part)) out.push(Number(part));
  }
  return out;
}

/**
 * Assert the lines a code block highlights, by their numbers ("2, 4-5"):
 * exactly those, from the lines given in its first line (```js {2,4-5}) or
 * with `// highlight-next-line` comments.
 *
 * Example #1: Then the code block "example.config.js" should highlight the lines "2, 4-5"
 * Example #2: And the code block "server.js" should highlight the line "2"
 * Example #3: Then code block "example.config.js" should highlight the lines "2, 4 and 5"
 * Example #4: And the code block "server.ts" should highlight the line "2"
 * Example #5: Then the code block "example.config.js" should highlight the lines "2,4,5"
 */
Then(/^(?:the )?code block "([^"]*)?" should highlight the lines? "([^"]*)?"$/, async function (name, lines) {
  await readySitePage(this, `the code block "${name}"`);
  const wanted = lineNumbers(lines);
  const block = await findCodeBlock(this, name);
  const got = block.highlighted;
  if (got.length !== wanted.length || got.some((n, i) => n !== wanted[i])) {
    throw failure(this, `Expected the code block "${name}" to highlight the lines ${wanted.join(', ')}, but it highlights ${got.length ? got.join(', ') : 'none'}.`, 'Lines are highlighted by {…} after the language (```js {2,4-5}) or by // highlight-next-line, highlight-start and highlight-end comments.');
  }
});

/**
 * Assert a code block does (or does not) number its lines (`showLineNumbers`
 * after the language).
 *
 * Example #1: Then the code block "example.config.js" should show line numbers
 * Example #2: But the code block "server.js" should not show line numbers
 * Example #3: Then code block "example.config.js" should show line numbers
 * Example #4: And the code block "brew install example" should not show line numbers
 * Example #5: And the code block "example.config.js" should show line numbers
 */
Then(/^(?:the )?code block "([^"]*)?" should( not)* show line numbers$/, async function (name, notCase) {
  await readySitePage(this, `the code block "${name}"`);
  const block = await findCodeBlock(this, name);
  if (block.numbered === Boolean(notCase)) {
    throw failure(this, notCase ? `Expected the code block "${name}" without line numbers, but it numbers its lines.` : `Expected the code block "${name}" to number its lines, but it does not.`, 'A code block numbers its lines with showLineNumbers after its language (```js showLineNumbers).');
  }
});

/**
 * Assert the language a code block is highlighted as (its class
 * `language-<name>`).
 *
 * Example #1: Then the code block "example.config.js" should be written in "js"
 * Example #2: And the code block "server.ts" should be written in "ts"
 * Example #3: Then code block "brew install example" should be written in "bash"
 * Example #4: And the code block "winget install" should be written in "powershell"
 * Example #5: Then the code block "server.js" should be written in "js"
 */
Then(/^(?:the )?code block "([^"]*)?" should be written in "([^"]*)?"$/, async function (name, language) {
  await readySitePage(this, `the code block "${name}"`);
  const block = await findCodeBlock(this, name);
  if (!same(block.language, language)) {
    throw failure(this, `Expected the code block "${name}" to be written in "${language}", but it is "${block.language || 'plain text'}".`, 'The language follows the three backquotes (```js); a language the site does not highlight needs prism.additionalLanguages.');
  }
});

/**
 * Copy the code of a code block with its copy button ("Copy code to
 * clipboard"), and wait until the button says the code was copied. The
 * browser is allowed to write to the clipboard first (Chromium).
 *
 * Example #1: When I copy the code block "example.config.js"
 * Example #2: And I copy the code block "server.js"
 * Example #3: When we copy the code block "brew install example"
 * Example #4: When copy the code block "example.config.js"
 * Example #5: And I copy the code block "curl -fsSL"
 */
When(/^(I |we )*copy the code block "([^"]*)?"$/, async function (pronoun, name) {
  await readySitePage(this, `the code block "${name}"`);
  const block = await findCodeBlock(this, name);
  try {
    await this.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(this.page.url()).origin });
  } catch {
    // Firefox and WebKit have no such permissions; the copy goes through without them.
  }
  const container = this.page.locator('.theme-code-block').nth(block.index);
  const button = container.locator('button[class*="copyButton"], button[aria-label="Copy code to clipboard"]').first();
  if (!(await button.count())) throw failure(this, `The code block "${name}" has no copy button.`, 'Every code block of the theme has one; a swizzled code block may not.');
  await centre(container);
  await container.hover();
  await afterAction(this, () => button.click({ timeout: budget(this) }));
  const copied = await poll(this, () => button.evaluate((el) => /copyButtonCopied/.test(el.className)), 1500, 25);
  const texts = await copiedTexts(this);
  if (!copied && !texts.length) {
    throw failure(this, `The copy button of the code block "${name}" did not copy (it never showed that the code was copied).`, 'The browser may refuse the clipboard to the page; the site must be served over HTTPS or from localhost.');
  }
});

/**
 * Assert what the page last wrote to the clipboard: the code of a code block
 * (all its lines, as they are, without line numbers), or a text it contains.
 * The copy is read from what the page handed the clipboard, which the pack
 * records in every page of the run.
 *
 * Example #1: Then the clipboard should hold the code of "example.config.js"
 * Example #2: And the clipboard should contain "module.exports = {"
 * Example #3: Then clipboard should hold the code of "server.js"
 * Example #4: And the clipboard should contain "port: 8080"
 * Example #5: Then the clipboard should hold the code of "brew install example"
 */
Then(/^(?:the )?clipboard should (hold the code of|contain) "([^"]*)?"$/, async function (mode, value) {
  await readySitePage(this, 'the clipboard');
  let last = '';
  let expected = value;
  if (mode === 'hold the code of') expected = (await findCodeBlock(this, value)).code;
  const ok = await poll(this, async () => {
    const texts = await copiedTexts(this);
    last = texts.length ? texts[texts.length - 1] : null;
    if (last === null) return false;
    return mode === 'contain' ? last.includes(value) : last.replace(/\s+$/, '') === expected.replace(/\s+$/, '');
  }, 3000);
  if (!ok) {
    throw failure(this, last === null
      ? 'Expected a copy in the clipboard, but the page has written nothing to it.'
      : mode === 'contain'
        ? `Expected the clipboard to contain "${value}", but it holds "${last.slice(0, 200)}".`
        : `Expected the clipboard to hold the code of "${value}", but it holds "${last.slice(0, 200)}".`,
    'Copy first (When I copy the code block "…"); the clipboard holds the last copy of this page.');
  }
});
