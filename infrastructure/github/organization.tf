resource "github_organization_settings" "rawkodeacademy" {
  name    = "Rawkode Academy"
  blog    = "https://rawkode.academy"

  email         = "support@rawkode.academy"
  billing_email = "support@rawkode.academy"

  twitter_username = "RawkodeAcademy"
  location         = "United Kingdom"
  description      = "Helping Senior Developers, Platform Engineers, and Infrastructure Operators Level Up with Cloud Native, Kubernetes, and Server-Side WebAssembly."

  has_organization_projects     = true
  has_repository_projects       = true
  default_repository_permission = "read"

	// Everything should be public
	members_can_create_private_repositories = false

	// Disable GitHub Pages
	members_can_create_pages = false
	members_can_create_public_pages = false
	members_can_create_private_pages = false
}
