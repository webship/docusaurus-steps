@test-site @docs
Feature: The pages of the docs: sidebar, table of contents, headings, breadcrumbs and edit links
  As a reader of the documentation
  I want the sidebar, the table of contents and the headings to show me where I am on a page and in the docs
  So that I can find my way through a long page and to the next one

  @critical
  Scenario: The sidebar marks the page shown and opens the category it is in
    Given I am on "/docs/getting-started/installation"
    Then the active page in the sidebar should be "Installation"
    And the "Getting Started" category in the sidebar should be expanded
    And the "Guides" category in the sidebar should be collapsed
    And I should not see "Writing Content" in the sidebar

  Scenario: A category of the sidebar expands and collapses
    Given I am on "/docs/intro"
    When I expand the "Guides" category in the sidebar
    Then the "Guides" category in the sidebar should be expanded
    And I should see "Writing Content" in the sidebar
    When I collapse the "Guides" category in the sidebar
    Then the "Guides" category in the sidebar should be collapsed
    And I should not see "Writing Content" in the sidebar

  Scenario: A page of a category opens from the sidebar
    Given I am on "/docs/intro"
    When I expand the "Reference" category in the sidebar
    And I click "FAQ" in the sidebar
    Then the path should be "/docs/reference/faq"
    And the active page in the sidebar should be "FAQ"
    And the breadcrumbs should be "Home page, Reference, FAQ"

  Scenario: The breadcrumbs follow the categories of the page
    Given I am on "/docs/guides/writing-content"
    Then the breadcrumbs should be "Home page, Guides, Writing Content"
    When I click "Guides" in the breadcrumbs
    Then the path should be "/docs/category/guides"
    And the breadcrumbs should be "Home page, Guides"

  Scenario: The table of contents follows the part of the page being read
    Given I am on "/docs/guides/writing-content"
    Then I should see "Heading levels" in the table of contents
    And the table of contents should highlight "Notes and warnings"
    When I scroll to the heading "Links"
    Then the table of contents should highlight "Links"
    When I scroll to the heading "Long pages"
    Then the table of contents should highlight "Long pages"

  Scenario: A link of the table of contents goes to its heading
    Given I am on "/docs/guides/writing-content"
    When I click "Tables" in the table of contents
    Then the address should point to the heading "Tables"
    And the heading "Tables" should be in view
    And the table of contents should highlight "Tables"

  Scenario: The anchor link of a heading puts it in the address
    Given I am on "/docs/intro"
    When I click the anchor link of the heading "Getting help"
    Then the address should point to the heading "Getting help"
    And the heading "Getting help" should be in view

  Scenario: A page of the docs links to the file it is written in
    Given I am on "/docs/getting-started/installation"
    Then the page should have an edit link to "https://example.com/docs/edit/main/versioned_docs/version-2.0/getting-started/installation.mdx"
    When I go to "/docs/next/intro"
    Then the page should have an edit link ending with "/docs/intro.mdx"
    When I go to "/docs/category/guides"
    Then the page should not have an edit link
