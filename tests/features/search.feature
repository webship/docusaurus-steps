@test-site @search
Feature: The search of the site, which runs in the browser
  As a reader of the documentation
  I want to find a page by the words in it
  So that I do not have to know where it is in the sidebar

  @critical
  Scenario: The search suggests the pages and headings that hold the words
    Given I am on "/docs/intro"
    When I search for "firewall"
    Then the search should suggest "Behind a firewall"
    And the search should not suggest "Installation"

  Scenario: A suggestion opens its page with the words marked
    Given I am on "/docs/intro"
    When I search for "firewall"
    And I open the search suggestion "Behind a firewall"
    Then the path should be "/docs/guides/deployment"
    And the words "firewall" should be marked on the page
    And the heading "Behind a firewall" should be in view

  Scenario: The posts of the blog are found too
    Given I am on "/blog"
    When I search for "version"
    Then the search should suggest "Version 2.0"
    And the search should suggest "Version 1.0"

  Scenario: Words that are nowhere find nothing
    Given I am on "/docs/intro"
    When I search for "zzqqxx"
    Then the search should find nothing

  Scenario: The page of all the results lists them and opens one
    Given I am on "/docs/intro"
    When I search for "firewall"
    And I open the page of all the search results
    Then the search results page should list "Behind a firewall"
    And the search results page should not list "Version 2.0"
    When I open the search result "Behind a firewall"
    Then the path should be "/docs/guides/deployment"

  Scenario: The page of all the results opens from its address
    Given I am on "/search?q=version"
    Then the search results page should list "Version 2.0"
    And the search results page should list "What Comes Next"
