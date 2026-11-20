# Features

Reference features for the sites that `.github/scripts/build-ddev-site.sh`
builds. Each feature carries the tag of the site it runs on: `@test-site` (the
test site: the template made into a site with its own docs in three versions,
French, its own blog, an announcement bar, a menu in the navbar and the local
search) or `@template` (the site `create-docusaurus` makes, as it makes it).
Copy a feature into your project and replace the addresses, labels and texts
with those of your site.

| Feature | Covers |
| --- | --- |
| `pages` | The production build, hydrated, without hydration errors; the generator and its version; a page with a hydration error found; the not-found page, in both languages. |
| `navigation` | Links in the same document, back and forward, the keyboard focus after a page change, the next and the previous page, a link in a named part of the page. |
| `navbar` | The active link, a menu under the pointer and its items, links to other sites, the navigation menu of a narrow screen. |
| `docs` | The categories of the sidebar, the active page, the breadcrumbs, the table of contents and the headings, the edit links. |
| `versions` | The version menu, an old version and its banner, the unreleased version, a page an old version does not have, the version chosen remembered. |
| `locales` | The language menu, the same page in French and back, the sitemap of each language. |
| `theme` | The colour mode, its choice remembered; the announcement bar closed for good, its link. |
| `search` | Suggestions, a suggestion opened with the words marked, posts found, nothing found, the page of all the results. |
| `blog` | The pages of posts, a post with its authors and tags, the older and newer post, a tag, the archive, the recent posts, the feeds. |
| `content` | Admonitions; tabs that choose together, remembered and kept in the address; code blocks and their copy button. |
| `template` | The site of the classic template: the production build, the tutorial, a category, the table of contents and a copy, the blog, the colour mode, the not-found page. |

No scenario logs in (a documentation site has no accounts), and none changes the
site: what a scenario chooses lives in its own browser.
