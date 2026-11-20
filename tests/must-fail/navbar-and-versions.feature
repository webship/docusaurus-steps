@must-fail @test-site
Feature: Must fail: the navbar, its menus and the versions
  Each scenario asserts something that is not true on the test site: its last step must fail, with the
  message its description announces and a hint.

  Scenario: An active navbar link asserted as not active
    Fails with: Expected the navbar link "Docs" not to be active, but it is.
    Given I am on "/docs/intro"
    Then the navbar link "Docs" should not be active

  Scenario: A menu asserted to list an item it does not have
    Fails with: Expected the "Community" menu of the navbar to list "Support", "Changelog" in that order
    Given I am on "/docs/intro"
    Then the "Community" menu of the navbar should list "Support, Changelog"

  Scenario: The version menu asserted to show another version
    Fails with: Expected the version menu to show "1.0", but it shows "2.0".
    Given I am on "/docs/intro"
    Then the version menu should show "1.0"

  Scenario: A menu the navbar does not have
    Fails with: Expected the "Products" menu of the navbar, but the navbar has
    Given I am on "/docs/intro"
    When I open the "Products" menu of the navbar

  Scenario: The navigation menu opened on a wide screen
    Fails with: The navbar shows no button for the navigation menu at this width
    Given I am on "/docs/intro"
    When I open the navigation menu

  Scenario: A link of another site asserted to lead elsewhere
    Fails with: Expected the navbar link "Source" to lead to https://example.com/elsewhere
    Given I am on "/docs/intro"
    Then the navbar link "Source" should open "https://example.com/elsewhere" in a new tab

  Scenario: A page of the latest version asserted to show a version banner
    Fails with: Expected a version banner, but the page shows none
    Given I am on "/docs/intro"
    Then the page should show a version banner

  Scenario: A page of an old version asserted to show no banner
    Fails with: Expected no version banner, but the page shows "This is documentation for Example Docs 1.0
    Given I am on "/docs/1.0/intro"
    Then the page should not show a version banner

  Scenario: The version of a page asserted as another one
    Fails with: Expected a page of the version "Next", but its badge says "Version: 1.0"
    Given I am on "/docs/1.0/intro"
    Then the page should belong to the version "Next"

  Scenario: The link of the version banner asserted to lead elsewhere
    Fails with: Expected the version banner to link to /docs/intro, but it links to "/docs/getting-started/installation"
    Given I am on "/docs/1.0/getting-started/installation"
    Then the version banner should link to "/docs/intro"
