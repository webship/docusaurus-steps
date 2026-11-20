@must-fail @test-site
Feature: Must fail: the search and the blog
  Each scenario asserts something that is not true on the test site: its last step must fail, with the
  message its description announces and a hint.

  Scenario: The search asserted to suggest a page it does not hold
    Fails with: Expected the search to suggest "Installation", but it suggests "Behind a firewall"
    Given I am on "/docs/intro"
    When I search for "firewall"
    Then the search should suggest "Installation"

  Scenario: A search with results asserted to find nothing
    Fails with: Expected the search to find nothing, but it suggests "Behind a firewall"
    Given I am on "/docs/intro"
    When I search for "firewall"
    Then the search should find nothing

  Scenario: The page of all the results asserted to list a page it does not
    Fails with: Expected the search results to list "Installation", but they list "Behind a firewall"
    Given I am on "/search?q=firewall"
    Then the search results page should list "Installation"

  Scenario: The posts of the blog asserted in another order
    Fails with: Expected the blog page to list "Version 2.0", "What Comes Next" in that order, but it lists "What Comes Next", "Version 2.0".
    Given I am on "/blog"
    Then the blog should list the posts "Version 2.0, What Comes Next"

  Scenario: A post asserted with a tag it does not carry
    Fails with: Expected the post "Version 2.0" to be tagged "Guide", but its tags are "Release".
    Given I am on "/blog/version-2-0"
    Then the blog post should be tagged "Guide"

  Scenario: A post asserted with an author it does not have
    Fails with: Expected the post "Writing Better Guides" to be by "Alex Example", but its authors are "Sam Example".
    Given I am on "/blog/writing-better-guides"
    Then the blog post should be by "Alex Example"

  Scenario: The first page of the blog asserted to have no older posts
    Fails with: Expected no link to older posts, but the page links to "Older entries" (/blog/page/2).
    Given I am on "/blog"
    Then there should be no older posts

  Scenario: The archive asserted to list a post under another year
    Fails with: Expected the archive to list "Version 2.0" under 2025
    Given I am on "/blog/archive"
    Then the blog archive should list "Version 2.0" under "2025"

  Scenario: The feed asserted to list a post the blog does not have
    Fails with: Expected the RSS feed to list "Version 3.0", but it lists
    Given I am on "/blog"
    Then the RSS feed should list "Version 3.0"

  Scenario: The sitemap asserted to list a page the site does not have
    Fails with: Expected the sitemap to list /docs/no-such-page, but it does not
    Given I am on "/"
    Then the sitemap should list "/docs/no-such-page"
