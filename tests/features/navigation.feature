@test-site @navigation
Feature: Pages opened in the same document
  As a reader of the documentation
  I want the links of the site to open their pages at once, without loading the whole site again
  So that I can move through the docs quickly, with the browser's back and forward buttons too

  @critical
  Scenario: A link of the sidebar opens its page in the same document
    Given I am on "/docs/intro"
    When I click the link "Installation" without a full page reload
    Then I should see "Install the command line tool, then check that it answers."
    And the path should be "/docs/getting-started/installation"
    And the active page in the sidebar should be "Installation"

  Scenario: Back and forward keep the same document
    Given I am on "/docs/intro"
    When I click the link "Configuration" without a full page reload
    And I go back without a full page reload
    Then the path should be "/docs/intro"
    When I go forward without a full page reload
    Then the path should be "/docs/getting-started/configuration"
    And I should see "The settings live in"

  Scenario: The keyboard focus goes back to the start of the page after a page change
    Given I am on "/docs/intro"
    When I click the link "Writing content" without a full page reload
    Then the keyboard focus should be at the start of the page
    And I should see "Notes and warnings"

  Scenario: The pager at the foot of a page of the docs leads to the next and the previous page
    Given I am on "/docs/getting-started/installation"
    Then the previous page should be "Getting Started"
    And the next page should be "Configuration"
    When I go to the next page
    Then the path should be "/docs/getting-started/configuration"
    And the previous page should be "Installation"
    When I go to the previous page
    Then the path should be "/docs/getting-started/installation"

  Scenario: The first page of the docs has no previous page, the last no next one
    Given I am on "/docs/intro"
    Then there should be no previous page
    And the next page should be "Getting Started"
    When I go to "/docs/reference/faq"
    Then there should be no next page
    And the previous page should be "Command Line"

  Scenario: A link in a named part of the page opens its page
    Given I am on "/docs/intro"
    When I click "Support" in the footer
    Then the path should be "/support"
    And I should see "Ask your question on the forum"
    When I click "Blog" in the navbar
    Then the path should be "/blog"
