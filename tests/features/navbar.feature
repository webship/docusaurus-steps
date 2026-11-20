@test-site @navbar
Feature: The navbar, its menus and the navigation menu of a narrow screen
  As a reader of the documentation
  I want the navbar to lead me to every part of the site, on a wide and on a narrow screen
  So that I can always find the docs, the blog and the other pages

  @critical
  Scenario: The navbar marks the part of the site the page belongs to
    Given I am on "/docs/intro"
    Then I should see "Docs" in the navbar
    And the navbar link "Docs" should be active
    And the navbar link "Blog" should not be active
    When I click "Blog" in the navbar
    Then the navbar link "Blog" should be active
    And the navbar link "Docs" should not be active

  Scenario: A menu of the navbar opens under the pointer and lists its items
    Given I am on "/docs/intro"
    When I open the "Community" menu of the navbar
    Then the "Community" menu of the navbar should list "Support, Forum"
    And the "Community" menu of the navbar should not list "Docs"

  Scenario: An item of a menu of the navbar opens its page
    Given I am on "/docs/intro"
    When I choose "Support" in the "Community" menu of the navbar
    Then the path should be "/support"
    And I should see "Ask your question on the forum"

  Scenario: The links to other sites open in a new tab
    Given I am on "/"
    Then the navbar link "Source" should open "https://example.com/source" in a new tab
    And the navbar link "Forum" should open "https://example.com/forum" in a new tab

  @mobile
  Scenario: On a narrow screen the navbar folds into the navigation menu
    Given I am on "/blog"
    When I set the viewport to the "xs" breakpoint
    Then the navigation menu should be closed
    When I open the navigation menu
    Then the navigation menu should be open
    And I should see "Docs" in the navigation menu
    When I close the navigation menu
    Then the navigation menu should be closed

  @mobile
  Scenario: On a page of the docs the navigation menu opens on the sidebar, with the way back to the main menu
    Given I am on "/docs/intro"
    When I open the navigation menu
    Then I should see "Installation" in the navigation menu
    When I go back to the main menu
    Then I should see "Blog" in the navigation menu
    When I click "Blog" in the navigation menu
    Then the path should be "/blog"
    And the navigation menu should be closed
