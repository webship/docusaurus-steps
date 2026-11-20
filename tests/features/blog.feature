@test-site @blog
Feature: The blog: its pages of posts, a post, the tags, the archive and the feeds
  As a reader of the blog
  I want to go through the posts, newest first, by tag and by date
  So that I can follow what the project publishes

  @critical
  Scenario: The blog lists its newest posts first, a few on each page
    Given I am on "/blog"
    Then the blog should list the posts "What Comes Next, Version 2.0"
    And there should be no newer posts
    When I go to the older posts
    Then the path should be "/blog/page/2"
    And the blog should list the posts "Writing Better Guides, Version 1.0"
    When I go to the older posts
    Then the blog should list the posts "Welcome to Example Docs"
    And there should be no older posts
    When I go to the newer posts
    Then the path should be "/blog/page/2"

  Scenario: A post opens from the list, with its authors and tags
    Given I am on "/blog"
    When I open the blog post "Version 2.0"
    Then the path should be "/blog/version-2-0"
    And the blog post should be by "Alex Example"
    And the blog post should be written by "Sam Example"
    And the blog post should be tagged "Release"
    And the blog post should not be tagged "Guide"
    And the page should have an edit link ending with "blog/2026-07-08-version-2-0.mdx"

  Scenario: A post leads to the older and the newer post
    Given I am on "/blog/version-2-0"
    When I go to the older post
    Then the path should be "/blog/writing-better-guides"
    When I go to the newer post
    Then the path should be "/blog/version-2-0"
    When I go to the newer post
    Then the path should be "/blog/what-comes-next"
    And there should be no newer post

  Scenario: A tag lists the posts that carry it
    Given I am on "/blog/version-2-0"
    When I open the tag "Release"
    Then the path should be "/blog/tags/release"
    And the blog should list the post "Version 2.0"
    And the blog should not list the post "Writing Better Guides"

  Scenario: The page of all the tags leads to a tag
    Given I am on "/blog/tags"
    When I open the tag "Guide"
    Then the path should be "/blog/tags/guide"
    And the blog should list the posts "Writing Better Guides"

  Scenario: The archive lists every post by year
    Given I am on "/blog/archive"
    Then the blog archive should list "Welcome to Example Docs" under "2026"
    And the blog archive should list "What Comes Next" under "2026"

  Scenario: The recent posts beside a post mark the post shown
    Given I am on "/blog/writing-better-guides"
    Then I should see "Version 1.0" in the blog sidebar
    When I click "Version 1.0" in the blog sidebar
    Then the path should be "/blog/version-1-0"

  Scenario: The feeds of the blog list its posts
    Given I am on "/blog"
    Then the RSS feed should list "Version 2.0"
    And the Atom feed should list "What Comes Next"
    And the RSS feed at "/blog/rss.xml" should not list "Version 3.0"
