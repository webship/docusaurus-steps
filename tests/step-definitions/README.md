# Step definitions

| File | Covers |
| --- | --- |
| `docusaurus-pages.steps.js` | The wait for the page to be ready; a hydrated page and hydration errors; a production build; the generator of the pages and its version; the not-found page; the keyboard focus after a page change. |
| `docusaurus-navigation.steps.js` | A link followed, back and forward, without a full page reload; a link or a text in a named part of the page; the active link of the navbar; a link that opens in a new tab. |
| `docusaurus-navbar.steps.js` | The menus of the navbar (a menu of links, the version menu, the language menu); the navigation menu of a narrow screen. |
| `docusaurus-docs.steps.js` | The sidebar and its categories; headings, their anchors and the table of contents; the pager; the breadcrumbs; the edit link; the version banner and the version of the page. |
| `docusaurus-content.steps.js` | Admonitions, tabs, code blocks and the clipboard. |
| `docusaurus-search.steps.js` | The search box and its suggestions, the page of all the results, the words marked on a page. |
| `docusaurus-blog.steps.js` | The posts of a list page, a post and its tags and authors, older and newer posts, the archive, the feeds, the sitemap. |
| `docusaurus-theme.steps.js` | The colour mode and the announcement bar the browser remembers. |
| `docusaurus-helpers.js` | Shared plumbing: the wait on the site's own signals, the requests and the console of the page, the parts of the page by name, the menus of the navbar, friendly failures. It registers no step. |

## Rules for a new step

- Check `node_modules/webship-js/tests/step-definitions/` first: a step that the
  generic click, fill and see vocabulary already covers is not added here.
- No step phrase names the framework or its plugins.
- The regular expression starts with the pronoun group `(I |we )*` where a
  person acts, and an assertion takes `should( not)*`, so one definition reads
  both polarities. No flags on the regular expression.
- A JSDoc block above the step holds at least five `Example #N:` lines. Run
  `npm run test:examples`: every example must match its own step and no step of
  webship-js.
- Find things the way a person does: a name, a label, a role, a text. The
  theme's stable class names are the fallback.
- Wait on the site's own signals (see `docusaurus-helpers.js`), never on a clock.
- A failure says what was expected, what was found, and where to look (a
  `Hint:`); add a scenario to `tests/must-fail/` that proves it can fail.
