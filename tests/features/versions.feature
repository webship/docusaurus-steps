@test-site @versions
Feature: The versions of the docs
  As a reader of the documentation
  I want to see which version of the docs I am reading, and to change it
  So that I read what matches the version I use

  @critical
  Scenario: The version menu shows the version of the page and lists every version
    Given I am on "/docs/intro"
    Then the version menu should show "2.0"
    And the version menu should list "Next, 2.0 and 1.0"
    And the page should belong to the version "2.0"
    And the page should not show a version banner

  Scenario: Choosing an old version opens the same page in it, with its banner
    Given I am on "/docs/getting-started/installation"
    When I choose "1.0" in the version menu
    Then the path should be "/docs/1.0/getting-started/installation"
    And the version menu should show "1.0"
    And the page should belong to the version "1.0"
    And the page should show a version banner
    And I should see "which is no longer actively maintained" in the version banner
    And the version banner should link to "/docs/getting-started/installation"

  Scenario: The banner of an old version leads back to the latest version
    Given I am on "/docs/1.0/getting-started/configuration"
    When I click "latest version" in the version banner
    Then the path should be "/docs/getting-started/configuration"
    And the page should not show a version banner
    And the version menu should show "2.0"

  Scenario: The unreleased version says so
    Given I am on "/docs/intro"
    When I choose "Next" in the version menu
    Then the path should be "/docs/next/intro"
    And the page should belong to the version "Next"
    And I should see "This is unreleased documentation" in the version banner
    And I should see "This is the Next version"

  Scenario: A page that an old version does not have leads to the first page of that version
    Given I am on "/docs/reference/faq"
    When I choose "1.0" in the version menu
    Then the path should be "/docs/1.0/intro"
    And I should see "This is the documentation of version 1.0."
    And I should not see "Reference" in the sidebar

  Scenario: The version chosen in the menu is remembered on the other pages of the site
    Given I am on "/docs/intro"
    When I choose "1.0" in the version menu
    And I click "Blog" in the navbar
    Then the path should be "/blog"
    And the version menu should show "1.0"
    And the link "Docs" with the href "/docs/1.0/intro" should exist

  Scenario: A version opened from its address is not remembered
    Given I am on "/docs/1.0/intro"
    When I click "Blog" in the navbar
    Then the version menu should show "2.0"
