@test-site @content
Feature: What a page is made of: admonitions, tabs and code blocks
  As a reader of the documentation
  I want the notes, the tabs and the code of a page to work as they show
  So that I can pick my system once and copy the code I need

  @critical
  Scenario: The admonitions of a page show their kind and title
    Given I am on "/docs/guides/writing-content"
    Then I should see a "note" admonition
    And I should see a "tip" admonition titled "Keep it short"
    And I should see an "info" admonition titled "info"
    And I should see a "warning" admonition
    And I should see a "danger" admonition titled "Do not publish secrets"
    And the "danger" admonition should say "Never put a password or a key in a page."
    And I should not see a "caution" admonition

  Scenario: Tabs of one group choose together
    Given I am on "/docs/getting-started/installation"
    Then the "Linux" tab should be selected in every group
    When I choose the "macOS" tab
    Then the "macOS" tab should be selected in every group
    And the "Linux" tab should not be selected
    And the selected tab should show "brew install example"
    And the selected tab should show "Open Terminal and run"

  Scenario: The tab chosen is remembered on the next visit
    Given I am on "/docs/getting-started/installation"
    When I choose the "Windows" tab
    And I reload the page
    Then the "Windows" tab should be selected in every group
    And the selected tab should show "winget install Example.Cli"

  Scenario: A tab group with an address keeps the choice in the address
    Given I am on "/docs/getting-started/configuration"
    When I choose the "TypeScript" tab
    Then current url should have the "language" parameter with the "ts" value
    And the selected tab should show "const port: number = config.port;"

  Scenario: A code block shows its title, its highlighted lines and its line numbers
    Given I am on "/docs/getting-started/configuration"
    Then the code block "example.config.js" should highlight the lines "2, 4-5"
    And the code block "example.config.js" should show line numbers
    And the code block "example.config.js" should be written in "js"
    And the code block "server.js" should highlight the line "2"
    And the code block "server.js" should not show line numbers

  Scenario: The copy button copies the code of its block
    Given I am on "/docs/getting-started/configuration"
    When I copy the code block "example.config.js"
    Then the clipboard should hold the code of "example.config.js"
    And the clipboard should contain "port: 8080"

  Scenario: The code of a hidden tab is copied once its tab is chosen
    Given I am on "/docs/getting-started/installation"
    When I choose the "macOS" tab
    And I copy the code block "brew install example"
    Then the clipboard should contain "brew install example"
    And the code block "brew install example" should be written in "bash"
