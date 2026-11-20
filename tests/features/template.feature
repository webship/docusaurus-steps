@template
Feature: The site of the classic template, unchanged
  As the owner of a new documentation site
  I want the steps to hold on the site the template makes, before I change anything
  So that a first suite is green on day one

  @critical
  Scenario: The front page is a hydrated production build
    Given I am on "/"
    When I wait for the page to be ready
    Then the site should be served as a production build
    And I should see a hydrated page
    And there should be no hydration errors

  Scenario: The tutorial opens from the navbar in the same document
    Given I am on "/"
    When I click "Tutorial" in the navbar
    Then the path should be "/docs/intro"
    And the navbar link "Tutorial" should be active
    And the active page in the sidebar should be "Tutorial Intro"
    And the next page should be "Tutorial - Basics"
    And there should be no previous page

  Scenario: A category of the sidebar opens on its pages
    Given I am on "/docs/intro"
    Then the "Tutorial - Basics" category in the sidebar should be collapsed
    When I expand the "Tutorial - Basics" category in the sidebar
    And I click "Markdown Features" in the sidebar
    Then the breadcrumbs should be "Home page, Tutorial - Basics, Markdown Features"
    And I should see a "tip" admonition titled "My tip"
    And the "danger" admonition should say "This action is dangerous"

  Scenario: The table of contents leads to a heading, and a code block copies its code
    Given I am on "/docs/intro"
    Then I should see "Generate a new site" in the table of contents
    When I click "Start your site" in the table of contents
    Then the address should point to the heading "Start your site"
    When I copy the code block "npm run start"
    Then the clipboard should contain "cd my-website"

  Scenario: The blog lists its posts and opens one
    Given I am on "/blog"
    Then the blog should list the post "Welcome"
    And the blog should list the post "First Blog Post"
    And there should be no older posts
    When I open the blog post "Welcome"
    Then the blog post should be tagged "Hello"

  Scenario: The colour mode chosen is remembered
    Given I am on "/docs/intro"
    When I switch the colour mode to "dark"
    And I reload the page
    Then the colour mode should be "dark"

  @js-off
  Scenario: An address with no page answers with the not-found page
    When I go to "/docs/no-such-page"
    Then I should be on a 404 page
