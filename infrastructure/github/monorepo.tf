resource "github_repository" "monorepo" {
  name         = "RawkodeAcademy"
  description  = "Rawkode Academy Monorepository"
  homepage_url = "https://rawkode.academy"

  has_discussions = true
  has_downloads   = true
  has_issues      = true
  has_projects    = true
  has_wiki        = false

  allow_auto_merge       = true
  allow_merge_commit     = false
  allow_update_branch    = true
  delete_branch_on_merge = true

  merge_commit_title        = "PR_TITLE"
  merge_commit_message      = "PR_BODY"
  squash_merge_commit_title = "PR_TITLE"
}

resource "github_branch" "monorepo-main" {
  repository = github_repository.monorepo.name
  branch     = "main"
}

resource "github_branch_default" "monorepo-default" {
  repository = github_repository.monorepo.name
  branch     = github_branch.monorepo-main.branch
}

resource "github_branch_protection" "monorepo-main" {
  repository_id = github_repository.monorepo.node_id

  pattern        = github_branch_default.monorepo-default.branch
  enforce_admins = true

  allows_deletions    = false
  allows_force_pushes = false

  require_conversation_resolution = true
  required_linear_history         = true
  require_signed_commits          = true

  required_status_checks {
    contexts = []
    strict   = true
  }

  force_push_bypassers = []

  required_pull_request_reviews {
    dismiss_stale_reviews      = true
    restrict_dismissals        = false
    require_code_owner_reviews = true
    require_last_push_approval = true
  }
}

resource "github_repository_collaborators" "monorepo-contributors" {
  repository = github_repository.monorepo.name

  user {
    permission = "maintain"
    username   = "icepuma"
  }

  user {
    permission = "push"
    username   = "randax"
  }

  user {
    permission = "pull"
    username   = "wanderingkaiju"
  }
}

resource "github_issue_labels" "monorepo" {
  repository = github_repository.monorepo.name

	// Theme
  label {
    name  = "DevEx"
    color = "78C6BE"
  }

  label {
    name  = "Documentation"
    color = "78C6BE"
  }

  label {
    name  = "Friction"
    color = "78C6BE"
  }

	// ??
	  label {
    name  = "Good First Issue"
    color = "0E8A16"
  }

	// Technologies
  label {
    name  = "Drizzle"
    color = "30D0FE"
  }

  label {
    name  = "Apollo GraphQL"
    color = "30D0FE"
  }

  label {
    name  = "Restate"
    color = "30D0FE"
  }
}
