@test-site @locales
Feature: The second language of the site
  As a reader of the documentation
  I want to read the site in my language, on the same page
  So that I understand it, and come back to the first language when I want

  @critical
  Scenario: The language menu lists the languages of the site
    Given I am on "/docs/intro"
    Then the language menu should show "English"
    And the language menu should list "English, Français"
    And the page language should be "en"

  Scenario: Choosing a language opens the same page in it
    Given I am on "/docs/getting-started/installation"
    When I choose "Français" in the language menu
    Then the path should be "/fr/docs/getting-started/installation"
    And the page language should be "fr"
    And the language menu should show "Français"
    And I should see "Documentation" in the navbar
    And I should see "Premiers pas" in the sidebar
    And the next page should be "Configuration"

  Scenario: A translated page shows its own text, and English comes back from the menu
    Given I am on "/fr/docs/intro"
    Then I should see "Example Docs est la documentation du projet Example."
    When I choose "English" in the language menu
    Then the path should be "/docs/intro"
    And the page language should be "en"
    And I should see "Example Docs is the documentation of the Example project."

  Scenario: Each language has its own sitemap
    Given I am on "/"
    Then the sitemap should list "/docs/intro"
    And the sitemap should list "/blog/version-2-0"
    And the sitemap should not list "/docs/no-such-page"
    And the sitemap at "/fr/sitemap.xml" should list "/fr/docs/intro"
    And the sitemap at "/fr/sitemap.xml" should not list "/docs/intro"
