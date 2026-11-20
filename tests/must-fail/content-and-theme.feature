@must-fail @test-site
Feature: Must fail: admonitions, tabs, code blocks, the colour mode and the announcement bar
  Each scenario asserts something that is not true on the test site: its last step must fail, with the
  message its description announces and a hint.

  Scenario: An admonition asserted with another title
    Fails with: Expected a "tip" admonition titled "Be brief", but the "tip" admonitions are titled "Keep it short".
    Given I am on "/docs/guides/writing-content"
    Then I should see a "tip" admonition titled "Be brief"

  Scenario: An admonition asserted to say what it does not
    Fails with: Expected the "danger" admonition to say "Share your keys"
    Given I am on "/docs/guides/writing-content"
    Then the "danger" admonition should say "Share your keys"

  Scenario: A kind of admonition the page does not have
    Fails with: Expected a "caution" admonition, but the page shows
    Given I am on "/docs/guides/writing-content"
    Then I should see a "caution" admonition

  Scenario: The tab chosen by default asserted as another one
    Fails with: Expected the "Windows" tab to be selected in every group, but the selected tabs are "Linux"
    Given I am on "/docs/getting-started/installation"
    Then the "Windows" tab should be selected in every group

  Scenario: A tab the page does not have
    Fails with: The page has no tab "Android".
    Given I am on "/docs/getting-started/installation"
    When I choose the "Android" tab

  Scenario: The highlighted lines asserted as other lines
    Fails with: Expected the code block "example.config.js" to highlight the lines 1, 2, but it highlights 2, 4, 5.
    Given I am on "/docs/getting-started/configuration"
    Then the code block "example.config.js" should highlight the lines "1, 2"

  Scenario: A code block without line numbers asserted to have them
    Fails with: Expected the code block "server.js" to number its lines, but it does not.
    Given I am on "/docs/getting-started/configuration"
    Then the code block "server.js" should show line numbers

  Scenario: The clipboard asserted to hold what was not copied
    Fails with: Expected the clipboard to contain "port: 9090", but it holds
    Given I am on "/docs/getting-started/configuration"
    When I copy the code block "example.config.js"
    Then the clipboard should contain "port: 9090"

  Scenario: The colour mode asserted as dark on a light page
    Fails with: Expected the page in the dark colour mode, but it shows light
    Given the browser prefers a light colour scheme
    And I am on "/docs/intro"
    Then the colour mode should be "dark"

  Scenario: The announcement bar asserted as closed before it was closed
    Fails with: Expected no announcement bar, but the page shows it.
    Given I am on "/docs/intro"
    Then I should not see the announcement bar
