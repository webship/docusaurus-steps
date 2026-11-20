@must-fail @test-site
Feature: Must fail: the pages of the docs
  Each scenario asserts something that is not true on the test site: its last step must fail, with the
  message its description announces and a hint.

  Scenario: A collapsed category asserted as expanded
    Fails with: Expected the "Guides" category of the sidebar to be expanded, but it is collapsed.
    Given I am on "/docs/intro"
    Then the "Guides" category in the sidebar should be expanded

  Scenario: A category the sidebar does not have
    Fails with: The sidebar has no category "Tutorials".
    Given I am on "/docs/intro"
    When I expand the "Tutorials" category in the sidebar

  Scenario: The active page of the sidebar asserted as another page
    Fails with: Expected the sidebar to mark "Configuration" as the page shown, but it marks "Installation".
    Given I am on "/docs/getting-started/installation"
    Then the active page in the sidebar should be "Configuration"

  Scenario: The table of contents asserted to highlight a heading far down
    Fails with: Expected the table of contents to highlight "Long pages", but it highlights "Notes and warnings".
    Given I am on "/docs/guides/writing-content"
    Then the table of contents should highlight "Long pages"

  Scenario: A heading far down asserted in view
    Fails with: Expected the heading "Long pages" in view
    Given I am on "/docs/guides/writing-content"
    Then the heading "Long pages" should be in view

  Scenario: The address asserted to point to a heading it does not point to
    Fails with: Expected the address to point to the heading "Getting help" (#getting-help), but its fragment is "(none)".
    Given I am on "/docs/intro"
    Then the address should point to the heading "Getting help"

  Scenario: The next page asserted as another page
    Fails with: Expected the next page to be "Deployment", but the pager gives "Configuration".
    Given I am on "/docs/getting-started/installation"
    Then the next page should be "Deployment"

  Scenario: The first page asserted to have no next page
    Fails with: Expected no next page, but the pager links to "Getting Started"
    Given I am on "/docs/intro"
    Then there should be no next page

  Scenario: The breadcrumbs asserted in another order
    Fails with: Expected the breadcrumbs "Home page", "Writing Content", "Guides", but they are "Home page", "Guides", "Writing Content".
    Given I am on "/docs/guides/writing-content"
    Then the breadcrumbs should be "Home page, Writing Content, Guides"

  Scenario: The edit link asserted to lead elsewhere
    Fails with: Expected the "Edit this page" link ending with "docs/intro.md", but it is https://example.com/docs/edit/main/versioned_docs/version-2.0/intro.mdx.
    Given I am on "/docs/intro"
    Then the page should have an edit link ending with "docs/intro.md"

  Scenario: A generated index asserted to have an edit link
    Fails with: Expected an "Edit this page" link ending with ".mdx", but the page has none.
    Given I am on "/docs/category/guides"
    Then the page should have an edit link ending with ".mdx"
