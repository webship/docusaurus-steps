<p align="center"><img src="https://raw.githubusercontent.com/webship/docusaurus-steps/2.0.x/assets/logo.svg" alt="Docusaurus logo" width="96"></p>

# docusaurus-steps

Cucumber step definitions for testing documentation sites built with
Docusaurus, with [webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD
browser automation harness built on Playwright and Cucumber-js.

`@webship-js/docusaurus-steps` targets what every site of the classic theme
has, and what makes tests flaky when a step does not wait for it: the
production build and its hydration; pages opened in the same document, back
and forward, and the keyboard focus after a page change; the navbar, its
menus, the version menu and the language menu, and the navigation menu it
folds into on a narrow screen; the sidebar of the docs and its categories, the
table of contents that follows the scroll, the headings and their anchor links,
the next and previous pages, the breadcrumbs and the "Edit this page" link; the
versions of the docs and their banners; the second language; the colour mode
and the announcement bar that the browser remembers; the search that runs in
the browser; the blog with its pages, tags, archive and feeds; tabs that choose
together and are remembered; admonitions; code blocks with their title,
highlighted lines, line numbers and copy button; the sitemap and the not-found
page. The steps are proven on 3.10.2, the current release.

No step phrase names the framework or its plugins: a scenario reads `When I
choose "1.0" in the version menu` and `Then the table of contents should
highlight "Links"`.

Every step waits on the site's own signals, never on a clock: the attribute
its runtime sets once the page has hydrated (`<html
data-has-hydrated="true">`), the script tags its router adds while it loads
the code of the next page and removes once that code is in, the progress bar
of a page change, the requests of the page, the states the search box takes
while it loads its index, and the classes and ARIA attributes of the theme.
[How the steps find things and wait](#how-the-steps-find-things-and-wait) says
what each wait relies on.

CI builds the sites with [DDEV](https://ddev.com) on the runner (the test site
of this pack, and the site `create-docusaurus` makes, as it makes it), runs the
suite of each twice on every push and pull request, then the assertions that
must fail; see [`.github/workflows/test.yml`](.github/workflows/test.yml).

## From nothing to a green run

What the machine needs: Docker, [DDEV](https://ddev.com), git, python3, and Node.js 20 or later with npm. The site and its Node.js 24 run in DDEV's containers.

**1. The site.** The pack's own build script (the one CI runs) makes the site in a DDEV project of type `generic`: `create-docusaurus` makes a site of the classic template in TypeScript, on 3.10.2, then [`site/test-site.cjs`](site/test-site.cjs) gives it the test content of this pack (docs with tabs, admonitions and code blocks in three versions, a French locale, a blog, an announcement bar, a menu in the navbar and a search that runs in the browser), then the site is built for production and served by the web container. It takes about two minutes.

```bash
git clone https://github.com/webship/docusaurus-steps.git
SITE_DIR="$PWD/docs-site" docusaurus-steps/.github/scripts/build-ddev-site.sh
```

The site answers at `https://docusaurussteps.ddev.site`. A documentation site has no accounts: nothing logs in.

In the [Webship Workspace](https://github.com/webship/workspace), its Docusaurus plugin builds the same site instead, in a sites folder of the workspace (`dev/` here, the one `--with-needs` adds to a new workspace; `test/`, `sandboxes/` and `demos/` work the same):

```bash
bash core/scripts/plugins.sh --require docusaurus --with-needs
bash core/scripts/plugins.sh --activate docusaurus --with-needs
bash core/scripts/plugins.sh --install docusaurus
bash dev/cmd-docusaurus-project.sh dcws --install --test-content
```

That site answers at `https://dcws.ddev.site`. `--test-content` gives it the same test content, from the same script. Without it the builder makes the site of the classic template as it is, and `--versions`, `--locales` and `--search` add each of those parts to it. It has no accounts either.

**2. A test project.**

```bash
mkdir docusaurus-tests && cd docusaurus-tests
npm init -y
npm install --save-dev webship-js @webship-js/docusaurus-steps
npx init-webship-js
```

`npx init-webship-js` writes `cucumber.js`, `playwright.config.ts`, the `tests/` folders with a first feature and the `npm test` scripts, and installs Chromium. npm usually runs it already when it installs webship-js; a second run changes nothing.

**3. `cucumber.js`.** Replace the file with the wiring of the pack: the step files of webship-js and of the pack, the paths (a feature named on the command line runs alone, as in the file `npx init-webship-js` writes), the tags that keep work in progress and the assertions that must fail out of a normal run, and the address of the site. There are no accounts to list.

```javascript
// A feature or a scenario named on the command line runs alone (cucumber-js 12 would add it to the
// paths below): `npx cucumber-js tests/features/first-run.feature`.
const OPTIONS_WITH_A_VALUE = new Set([
  '-c', '--config', '-f', '--format', '--format-options', '--i18n-keywords',
  '-i', '--import', '-l', '--loader', '--language', '--name', '--order',
  '-p', '--profile', '--parallel', '--plugin', '--plugin-options',
  '-r', '--require', '--require-module', '--retry', '--retry-tag-filter',
  '--shard', '-t', '--tags', '--world-parameters',
]);

function commandLinePaths() {
  if (!/cucumber(-js|\.js)?$/.test(String(process.argv[1] || ''))) return [];
  const args = process.argv.slice(2);
  const paths = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('-')) {
      if (OPTIONS_WITH_A_VALUE.has(args[i])) i += 1;
    } else {
      paths.push(args[i]);
    }
  }
  return paths;
}

module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',
      'node_modules/@webship-js/docusaurus-steps/tests/step-definitions/*.js',
      'tests/step-definitions/**/*.js',
    ],
    paths: commandLinePaths().length ? [] : ['tests/features/**/*.feature'],
    // Work in progress and the assertions that must fail stay out of a normal run.
    tags: 'not @wip and not @must-fail',
    format: ['@cucumber/pretty-formatter', 'json:tests/reports/cucumber_report.json'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'https://docusaurussteps.ddev.site',
      // The browser logs "Failed to load resource: the server responded with a status of 404" for the
      // not-found page: not a fault of the site. The scenarios that open it carry @js-off.
      javascript: { mode: 'warn', levels: ['error'] },
      // The waits webship-js adds around each page, scenario and step (milliseconds).
      minWaitTime: { page: 3000, before_scenario: 0, after_scenario: 0, before_step: 0, after_step: 0 },
    },
  },
};
```

On the site of the Webship Workspace (step 1) everything is the same but its address, which goes in `LAUNCH_URL` (step 5).

**4. A first feature**, `tests/features/first-run.feature`:

```gherkin
Feature: First run
  Scenario: A page of the docs opens in the same document, from a hydrated production build
    Given I am on "/docs/intro"
    Then the site should be served as a production build
    And I should see a hydrated page
    When I click the link "Installation" without a full page reload
    Then the active page in the sidebar should be "Installation"
    And there should be no hydration errors

  Scenario: The search finds a page by its words
    Given I am on "/docs/intro"
    When I search for "firewall"
    Then the search should suggest "Behind a firewall"
```

**5. Run it.** Set `LAUNCH_URL` to the address of the site: `https://docusaurussteps.ddev.site` for the build script's site, `https://dcws.ddev.site` for the Workspace's.

```bash
LAUNCH_URL=https://docusaurussteps.ddev.site npm test
```

A green first run prints every step, then the summary (the starter feature of `npx init-webship-js` and the two scenarios above, passed) and the HTML report it wrote:

```
3 scenarios (3 passed)
11 steps (11 passed)
[webship-js] HTML report → …/docusaurus-tests/tests/reports/cucumber_report.html
```

`npx cucumber-js tests/features/first-run.feature` runs that feature alone.

From there, copy the features of [`tests/features/`](tests/features/) (they also ship in the package, under `node_modules/@webship-js/docusaurus-steps/tests/features/`): together they use every step of the pack. Each carries the tag of the site it runs on: `@test-site` (the test site, from either way of step 1) or `@template` (the site `create-docusaurus` makes, as it makes it). Run the ones of your site with `--tags`, for example `npx cucumber-js --tags @test-site`. They read no file of their own.

### What the suite tests

The features of this repository run every step of the pack, twice in a row in CI on every change, then the assertions that must fail:

- **The pages** (`@test-site`, `@template`): the production build, hydrated, without hydration errors, the generator of the pages and its version, a page that renders differently on the server and in the browser (its error found), the not-found page of an unknown address, in both languages.
- **Navigation**: links that open their pages in the same document, back and forward, the keyboard focus back at the start of the page, the next and the previous page, a link in a named part of the page (the navbar, the footer, …).
- **The navbar**: the active link of the part of the site shown, a menu that opens under the pointer and its items, links to other sites that open in a new tab, the navigation menu of a narrow screen and its way back to the main menu.
- **The docs**: the categories of the sidebar, expanded and collapsed, the active page, the breadcrumbs, the table of contents that follows the scroll and its links, the anchor links of the headings, the "Edit this page" links (and a page without one).
- **The versions**: the version menu, its versions and the version it shows, an old version and its banner with its link back, the unreleased version, a page an old version does not have, the version chosen remembered on the other pages.
- **The languages**: the language menu, the same page in French, the French page and the way back, the sitemap of each language.
- **The colour mode and the announcement bar**: the system's choice, a choice of the reader remembered across pages and reloads, the announcement bar closed for good, its link.
- **The search**: suggestions for words, a suggestion opened with the words marked on its page, the posts of the blog found, nothing found, the page of all the results and a result opened from it.
- **The blog**: its pages of posts newest first, a post with its authors and tags, the older and the newer post, a tag and the page of all the tags, the archive, the recent posts beside a post, the RSS and Atom feeds.
- **Admonitions, tabs and code blocks**: the kind, title and text of an admonition, tabs that choose together and are remembered, a tab kept in the address, the title, highlighted lines, line numbers and language of a code block, the copy button and what it copied.

Not tested: the framework's own tests (it has its own); the development server beyond telling it from a production build; a search service with an account (DocSearch needs one); a site behind a CDN; the swizzled components of a site of your own; Firefox and WebKit beyond what the steps need.

## Requirements

- Node.js 20 or later
- A webship-js 2.0 test project (webship-js 2.0.16 or later)
- A site of the 3.x line with the classic theme (proven on 3.10.2), served as a production build (`build`, then `serve` or any web server); for the search steps, the local search plugin [`@easyops-cn/docusaurus-search-local`](https://github.com/easyops-cn/docusaurus-search-local) (MIT)

## Install

```bash
npm install --save-dev @webship-js/docusaurus-steps
```

## Quick start

1. Add the step files to the `require` list of your webship-js `cucumber.js`:

   ```javascript
   require: [
     'node_modules/webship-js/tests/step-definitions/**/*.js',
     'node_modules/@webship-js/docusaurus-steps/tests/step-definitions/*.js',
     'tests/step-definitions/**/*.js',
   ],
   ```

2. Point `launchUrl` at the site:

   ```javascript
   worldParameters: {
     launchUrl: process.env.LAUNCH_URL || 'https://your-site.ddev.site',
   },
   ```

3. Copy a feature file from [`tests/features/`](tests/features/) into your
   project and replace the addresses, labels and texts with those of your site.

```gherkin
Feature: The docs follow the reader

  Scenario: The table of contents marks the part of the page being read
    Given I am on "/docs/guides/writing-content"
    When I scroll to the heading "Links"
    Then the table of contents should highlight "Links"
```

## What is included

| File | Steps | Covers |
| --- | --- | --- |
| `docusaurus-pages.steps.js` | 8 | The wait for the page to be ready; a hydrated page and hydration errors; a production build; the generator of the pages and its version; the not-found page; the keyboard focus after a page change. |
| `docusaurus-navigation.steps.js` | 6 | A link followed, back and forward, each without a full page reload; a link or a text in a named part of the page; the active link of the navbar; a link that opens in a new tab. |
| `docusaurus-navbar.steps.js` | 7 | The menus of the navbar (a menu of links, the version menu, the language menu): open one, choose an item, the items it lists, the label it shows; the navigation menu of a narrow screen, open, closed and its way back to the main menu. |
| `docusaurus-docs.steps.js` | 16 | The categories of the sidebar and its active page; a heading scrolled to, in view, its anchor link, the address pointing to it; the table of contents; the next and the previous page; the breadcrumbs; the edit link; the version banner, its link and the version of the page. |
| `docusaurus-content.steps.js` | 11 | Admonitions (kind, title, text); tabs (choose one, selected in one or every group, the panel shown); code blocks (highlighted lines, line numbers, language, copy); the clipboard. |
| `docusaurus-search.steps.js` | 8 | A search in the search box, its suggestions or nothing found, a suggestion opened; the page of all the results and a result opened; the words marked on the page. |
| `docusaurus-blog.steps.js` | 11 | The posts of a list page, in order; a post opened, its tags and authors; a tag opened; the older and the newer posts; the archive; the RSS and Atom feeds; the sitemap. |
| `docusaurus-theme.steps.js` | 6 | The colour scheme the browser prefers; the colour mode switched, shown, following the system; the announcement bar, shown and closed. |
| `docusaurus-helpers.js` | | Shared plumbing for the files above and for your own steps: the wait on the site's own signals, the requests of the page, the console of the page, the parts of the page by name, the menus of the navbar, friendly errors (a request the browser cut says so). It registers no step; it puts its recorders on every page of the run. |

Text, links, buttons, fields, the address and its parameters, the status code
of a page, the language of the page, the size of the window, reloading a page
and the accessibility audit are webship-js's own steps (`I should see "..."`,
`the path should be "..."`, `current url should have the "..." parameter with
the "..." value`, `the response status code should be 404`, `the page language
should be "fr"`, `I set the viewport to the "xs" breakpoint`, `I reload the
page`): this pack adds only what the site decides.

## Beside other packs

The pack loads beside webship-js and the Diffy pack with no phrase in common.
Some of its phrases are those of other platform packs on purpose, so that a
tester reads one vocabulary everywhere:

- the behaviour of a site that hydrates (`I click the link "…" without a full
  page reload`, `I go back without a full page reload`, `I should see a
  hydrated page`, `there should be no hydration errors`, the site served as a
  production build, the page generator and its version, `I should be on a 404
  page`) with the Gatsby, Astro and Next.js packs;
- `I wait for the page to be ready` with the Next.js and Moodle packs;
- the RSS feed and the sitemap (`the RSS feed should list "…"`, `the sitemap
  should list "…"`) with the Astro pack.

Other phrases are the words a tester of another site uses for the same thing,
and match a definition of another platform pack:

- `I search for "…"` with the Drupal core, MediaWiki and WordPress packs;
- `I click "…" in the navigation menu` with the django CMS, Drupal core and
  WordPress packs, and `I open the navigation menu` with the WordPress pack;
- `I should see "…" in the search results` with the Joomla and TYPO3 packs,
  and `I open the search result "…"` with the HubSpot CMS and Joomla packs;
- `the breadcrumbs should be "…"` with the Magento and WooCommerce packs;
- `the blog post should be tagged "…"` and `the blog post should be written by
  "…"` with the HubSpot CMS pack; `I open the blog post "…"` and `I close the
  announcement bar` with the Squarespace pack;
- `the "…" tab should be selected` with the Webflow pack;
- the page generator steps with the Ghost, HubSpot CMS, Joomla and TYPO3 packs.

Load two such packs in two profiles of one project, one per site: no phrase of
this pack is ambiguous with webship-js or with the Diffy pack.

## How the steps find things and wait

- **By what a person reads.** A link and a button by their text or their
  accessible name, a menu by its label, a tab by its label, a heading by its
  text, a code block by its title (or a part of its code), a part of the page
  by name: the navbar, the navigation menu, the sidebar, the table of contents,
  the breadcrumbs, the version banner, the announcement bar, the footer, the
  blog sidebar, the search results, the content. The theme's stable class names
  are the fallback (`theme-doc-sidebar-container`, `theme-doc-toc-desktop`,
  `theme-doc-version-banner`, `theme-code-block`, `theme-admonition-tip`,
  `theme-announcement-bar`, …): unlike the aria-labels of the theme, they do not
  change with the language of the page.
- **Hydrated.** The site's runtime writes `<html data-has-hydrated="false">`
  into the server's HTML and sets it to `"true"` once React has taken the page
  over. Only then do the links open pages in the same document, the tabs answer
  a click and the stored choices (the colour mode, a tab, a closed announcement
  bar, the version chosen) apply: a step waits for it before it acts.
- **A page ready.** After every action a step waits until the document is
  loaded, the page is hydrated, no script of a page is still loading (the
  router adds a `<script data-rspack>` (or `data-webpack`) tag to the head for
  each piece of code the next page needs, and removes it once it is in; the old
  page stays on screen until then), the progress bar of a slow page change
  (`#nprogress`) is gone, and no request of the page is running; all of that
  for 150 ms. The canonical link of the page is no signal: it changes with the
  address at once, while the old page is still shown. `When I wait for the page
  to be ready` is that wait, for a project's own steps.
- **A page in the same document.** Each document of the run gets an identity
  of its own; a page opened by the router keeps it, a page loaded from the
  server does not.
- **Menus of the navbar.** They open when the pointer is on them (a click on
  their label does nothing). The version menu is the one whose label links to
  a page of the docs; the language menu is the one whose items carry a `lang`
  attribute.
- **The sidebar.** A category is expanded or collapsed by its arrow button
  (`aria-expanded`), and the step waits until its list has finished growing or
  shrinking. The page shown is the link with `aria-current="page"`.
- **The table of contents.** It marks the heading of the part of the page at
  the top of the window (`table-of-contents__link--active`), and follows the
  scroll.
- **Tabs.** A tab is selected when `aria-selected="true"`; a group of tabs
  shows only the panel of that tab. Tabs that share a group choose together,
  and the site gives back the choice of a group after a reload, once the page
  has hydrated: the server's HTML shows the default tab until then.
- **The copy button.** The step lets the browser write to the clipboard, clicks
  the button, and waits until it says the code was copied; what the page hands
  the clipboard is recorded in every page of the run, so the clipboard steps
  read the copy in any browser.
- **The search.** The search box loads its index when it gets the focus; once
  the index is in, the box becomes a combobox (`role="combobox"`) that lists its
  suggestions (`role="option"`) in a listbox under it, or "No results". The page
  of all the results (`/search?q=…`) loads the index itself.
- **The colour mode.** `<html data-theme>` is the mode shown, `<html
  data-theme-choice>` the choice (light, dark or system); the colour button goes
  round system, light and dark.
- **The sticky navbar.** An element is brought to the middle of the window
  before a click, so the fixed navbar never covers it.
- **Failures say what was found.** `Expected the table of contents to
  highlight "Long pages", but it highlights "Notes and warnings".` with a hint
  on where to look; a request the browser cut (the network of the machine
  changed) says so instead of blaming the scenario.

## Accounts

None: a documentation site has no accounts, and no step logs in.

## The test site

[`.github/scripts/build-ddev-site.sh`](.github/scripts/build-ddev-site.sh)
builds the site the suite of this repository runs against, in a DDEV project of
type `generic` (`PROJECT_NAME`, `docusaurussteps`): the site in `site/`, made by
`create-docusaurus` (the classic template, TypeScript, `DOCUSAURUS_VERSION`,
3.10.2), Node.js 24 baked in the web image, the production build served on port
3000 by a daemon of the web container (`docusaurus serve`), the router sending
ports 80 and 443 of the project's address to it. `SITE` chooses the site:

- `test-site` (the default): the template's site given the test content of
  this pack by [`site/test-site.cjs`](site/test-site.cjs): its own docs
  (Introduction; Getting Started with Installation and Configuration; Guides
  with Writing Content and Deployment; Reference with Command Line and FAQ),
  with tabs in a group (`operating-system`) and in the address (`language`),
  the five kinds of admonition, code blocks with titles, highlighted lines and
  line numbers; three versions (1.0 without the Reference, 2.0, and Next, the
  unreleased one); French beside English, with the labels of the navbar, the
  footer and the sidebar and the introduction translated; its own blog (five
  posts, two authors, three tags, two posts on a page); an announcement bar; a
  menu "Community" in the navbar; the search that runs in the browser
  ([`@easyops-cn/docusaurus-search-local`](https://github.com/easyops-cn/docusaurus-search-local)
  0.55.3, MIT: no account, no outside service); and one page,
  `/hydration-mismatch`, that renders differently on the server and in the
  browser on purpose, to prove the check of hydration errors.
- `template`: the site `create-docusaurus` makes, as it makes it.

```bash
SITE_DIR="$PWD/../docs-site" .github/scripts/build-ddev-site.sh
npm test
```

`SITE=template` builds the other site (the default tags of `cucumber.js`
follow `SITE`); `SERVE_ONLY=1` builds the site in `SITE_DIR` again and serves
it.

## Steps

One example of each step; the JSDoc block above each definition holds five.

### `docusaurus-pages.steps.js` (8)

- `I wait for the page to be ready`
- `I should see a hydrated page`
- `there should be no hydration errors`
- `the site should be served as a production build`
- `the page generator should contain "v3"`
- `the page generator version should start with "3"`
- `I should be on a 404 page`
- `the keyboard focus should be at the start of the page`

### `docusaurus-navigation.steps.js` (6)

- `I click the link "Installation" without a full page reload`
- `I go back without a full page reload`
- `I click "Installation" in the sidebar`
- `I should see "Headings" in the table of contents`
- `the navbar link "Blog" should be active`
- `the navbar link "Source" should open "https://example.com/source" in a new tab`

### `docusaurus-navbar.steps.js` (7)

- `I open the "Community" menu of the navbar`
- `I choose "1.0" in the version menu`
- `the language menu should list "English, Français"`
- `the version menu should show "2.0"`
- `I open the navigation menu`
- `the navigation menu should be open`
- `I go back to the main menu`

### `docusaurus-docs.steps.js` (16)

- `I expand the "Guides" category in the sidebar`
- `the "Getting Started" category in the sidebar should be expanded`
- `the active page in the sidebar should be "Installation"`
- `I scroll to the heading "Links"`
- `the heading "Headings" should be in view`
- `I click the anchor link of the heading "Getting help"`
- `the address should point to the heading "Getting help"`
- `the table of contents should highlight "Links"`
- `the next page should be "Configuration"`
- `there should be no previous page`
- `I go to the next page`
- `the breadcrumbs should be "Home page, Guides, Writing Content"`
- `the page should have an edit link ending with "docs/intro.mdx"`
- `the page should show a version banner`
- `the version banner should link to "/docs/intro"`
- `the page should belong to the version "2.0"`

### `docusaurus-content.steps.js` (11)

- `I should see a "note" admonition`
- `I should see a "tip" admonition titled "Keep it short"`
- `the "danger" admonition should say "Never put a password or a key in a page."`
- `I choose the "macOS" tab`
- `the "macOS" tab should be selected in every group`
- `the selected tab should show "brew install example"`
- `the code block "example.config.js" should highlight the lines "2, 4-5"`
- `the code block "example.config.js" should show line numbers`
- `the code block "example.config.js" should be written in "js"`
- `I copy the code block "example.config.js"`
- `the clipboard should hold the code of "example.config.js"`

### `docusaurus-search.steps.js` (8)

- `I search for "firewall"`
- `the search should suggest "Behind a firewall"`
- `the search should find nothing`
- `I open the search suggestion "Behind a firewall"`
- `I open the page of all the search results`
- `the search results page should list "Behind a firewall"`
- `I open the search result "Behind a firewall"`
- `the words "firewall" should be marked on the page`

### `docusaurus-blog.steps.js` (11)

- `the blog should list the post "Version 2.0"`
- `the blog should list the posts "What Comes Next, Version 2.0"`
- `I open the blog post "Version 2.0"`
- `the blog post should be tagged "Release"`
- `the blog post should be by "Alex Example"`
- `I open the tag "Release"`
- `I go to the older posts`
- `there should be no older posts`
- `the blog archive should list "Welcome to Example Docs" under "2026"`
- `the RSS feed should list "Version 2.0"`
- `the sitemap should list "/docs/intro"`

### `docusaurus-theme.steps.js` (6)

- `the browser prefers a dark colour scheme`
- `I switch the colour mode to "dark"`
- `the colour mode should be "dark"`
- `the colour mode should follow the system`
- `I should see the announcement bar`
- `I close the announcement bar`

## Testing this package

```bash
npm install
SITE_DIR="$PWD/../docs-site" .github/scripts/build-ddev-site.sh
npm run test:examples      # the examples and the features against the step patterns
npm run test:paths         # a feature or a scenario named on the command line runs alone
npx cucumber-js --dry-run  # no undefined and no ambiguous step
npm test                   # the suite, against the site
npm run test:must-fail     # assertions that must fail, each with its message
```

`LAUNCH_URL` points the suite at another site; `npx cucumber-js
tests/features/search.feature` runs one feature and `npx cucumber-js
tests/features/search.feature:<line>` one scenario (the line of its
`Scenario:`; the paths of `cucumber.js` are left out when the command line
names any); `FEATURES` runs a subset too
(`FEATURES=tests/features/search.feature npm test`); `CUCUMBER_TAGS=@critical`
runs the smoke lane; `HEADLESS=false` shows the browser.

`tests/must-fail/` holds scenarios that assert something that is not true on
the test site. `npm run test:must-fail` runs them and checks that each one
fails at its last step, with the message it announces and a hint: a step that
cannot fail proves nothing.

The suite only reads the site: it changes nothing on it. What a scenario
changes lives in its own browser (the colour mode, a tab, a closed announcement
bar, the version chosen), and every scenario starts with a new one.

On a machine where other containers start and stop, Chromium can lose a
request in flight (`net::ERR_NETWORK_CHANGED`): the failure then says the
request was cut. Run the suite again, or run it inside the project's container
(the Webship Workspace's `cmd-tools-testing.sh <project> --run` does).

## How the steps were written

Every page a step touches was opened in a real browser first, and the step was
written from what is there: the roles and names of the accessibility tree, the
stable class names of the theme, what the page does while it hydrates, opens
another page or loads its search index, the exact messages. The steps are
proven on 3.10.2, on the test site and on the site of the classic template, in
English and French, with Chromium.

Not covered: the development server's own tools; a search with an outside
service; the sidebar collapsed into a side button (`hideable`); the blog's
author pages beyond their posts; the mobile table of contents ("On this page");
versions of the docs per plugin instance (several docs plugins); the
`<BrowserOnly>` and `<Translate>` components of a site's own pages.

## License

MIT

## Logo

The Docusaurus logo in this README comes from Simple Icons 16.37.0 (CC0-1.0), filled with the colour the set lists for the brand. The Docusaurus name and logo are trademarks of their owner; this pack is not affiliated with or endorsed by them.
