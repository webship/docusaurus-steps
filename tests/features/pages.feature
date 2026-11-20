@test-site @pages
Feature: The site as a production build that hydrates
  As the owner of a documentation site
  I want every page served by the production build and taken over by the browser without errors
  So that the links, the tabs and the search work, and a broken build is caught first

  @critical
  Scenario: The front page is a hydrated production build
    Given I am on "/"
    When I wait for the page to be ready
    Then the site should be served as a production build
    And I should see a hydrated page
    And there should be no hydration errors

  Scenario: The generator of the pages names its version
    Given I am on "/docs/intro"
    Then the page generator version should start with "3"
    And the page generator should contain "v3"
    And the page generator should not contain "v2"

  Scenario: A page of the docs hydrates without errors
    Given I am on "/docs/guides/writing-content"
    Then I should see a hydrated page
    And there should be no hydration errors
    And I should not be on a 404 page

  @js-off
  Scenario: A page that renders differently on the server and in the browser reports a hydration error
    Given I am on "/hydration-mismatch"
    Then I should see a hydrated page
    And there should be hydration errors

  @js-off
  Scenario: An address with no page answers with the not-found page
    When I go to "/docs/no-such-page"
    Then I should be on a 404 page
    And the response status code should be 404
    And I should see "Page Not Found"

  @js-off
  Scenario: An unknown address under the second language answers with the not-found page
    When I go to "/fr/no-such-page"
    Then I should be on a 404 page
    And the response status code should be 404
