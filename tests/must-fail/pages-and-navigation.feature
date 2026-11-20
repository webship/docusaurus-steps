@must-fail @test-site
Feature: Must fail: pages and navigation
  Each scenario asserts something that is not true on the test site: its last step must fail, with the
  message its description announces and a hint.

  Scenario: A hydrated page asserted as not hydrated
    Fails with: Expected a page the site has not hydrated
    Given I am on "/docs/intro"
    When I wait for the page to be ready
    Then I should not see a hydrated page

  Scenario: A clean page asserted to have hydration errors
    Fails with: Expected hydration errors on this page, but React reported none.
    Given I am on "/docs/intro"
    Then there should be hydration errors

  @js-off
  Scenario: A page with a hydration error asserted as clean
    Fails with: React reported 1 hydration error(s) on this page
    Given I am on "/hydration-mismatch"
    Then there should be no hydration errors

  Scenario: The production build asserted as the development server
    Fails with: Expected the development server, but the page is a production build
    Given I am on "/"
    Then the site should not be served as a production build

  Scenario: The generator asserted as another version
    Fails with: Expected the page generator version to start with "2"
    Given I am on "/"
    Then the page generator version should start with "2"

  Scenario: A page that exists asserted as the not-found page
    Fails with: Expected the not-found page, but
    Given I am on "/docs/intro"
    Then I should be on a 404 page

  @js-off
  Scenario: The not-found page asserted as a page that exists
    Fails with: Expected a page that exists, but
    When I go to "/docs/no-such-page"
    Then I should not be on a 404 page

  Scenario: The focus asserted as moved on after a page change
    Fails with: Expected the keyboard focus somewhere in the page, but it is at the start of the page
    Given I am on "/docs/intro"
    When I click the link "Installation" without a full page reload
    Then the keyboard focus should not be at the start of the page

  Scenario: Going back from the first page of the scenario
    Fails with: Going back left the site: the browser shows about:blank.
    Given I am on "/docs/intro"
    When I go back without a full page reload

  Scenario: A text asserted in a part of the page it is not in
    Fails with: Expected to see "Deployment" in the sidebar
    Given I am on "/docs/getting-started/installation"
    Then I should see "Deployment" in the sidebar

  Scenario: A link that is not in a part of the page
    Fails with: Could not find "Changelog" in the navbar
    Given I am on "/docs/intro"
    When I click "Changelog" in the navbar
