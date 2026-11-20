@test-site @theme
Feature: The colour mode and the announcement bar, remembered by the browser
  As a reader of the documentation
  I want the colours I choose and the announcement I close to stay as I left them
  So that the site does not undo my choices on every page

  @critical
  Scenario: The colour mode follows the system until a choice is made
    Given the browser prefers a dark colour scheme
    And I am on "/docs/intro"
    Then the colour mode should follow the system
    And the colour mode should be "dark"
    When I switch the colour mode to "light"
    Then the colour mode should be "light"
    And the colour mode should not follow the system

  Scenario: The colour mode chosen is remembered across pages and reloads
    Given I am on "/docs/intro"
    When I switch the colour mode to "dark"
    Then the colour mode should be "dark"
    When I click the link "Installation" without a full page reload
    Then the colour mode should be "dark"
    When I reload the page
    Then the colour mode should be "dark"
    When I switch the colour mode to "system"
    Then the colour mode should follow the system
    And the colour mode should be "light"

  Scenario: The announcement bar closes and stays closed
    Given I am on "/docs/intro"
    Then I should see the announcement bar
    And I should see "Version 2.0 is out." in the announcement bar
    When I close the announcement bar
    Then I should not see the announcement bar
    When I reload the page
    Then I should not see the announcement bar
    When I go to "/blog"
    Then I should not see the announcement bar

  Scenario: The link of the announcement bar opens its page
    Given I am on "/"
    When I click "Read what is new" in the announcement bar
    Then the path should be "/blog/version-2-0"
    And I should see "Version 2.0 adds the command line reference."
