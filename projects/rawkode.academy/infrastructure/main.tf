resource "scaleway_account_project" "project" {
  name = "rawkode.academy"
}

resource "scaleway_secret" "libsql_token" {
	project_id = scaleway_account_project.project.id

  name = "token"
  path = "/turso.tech/platform"
}

resource "scaleway_secret_version" "libsql_token" {
  secret_id = scaleway_secret.libsql_token.id

	data = var.turso_group_platform_token

  depends_on = [scaleway_secret_version.libsql_token]
}

resource "scaleway_registry_namespace" "graphql_api" {
	project_id = scaleway_account_project.project.id

  name        = "graphql-api"
  description = "Namespapce for GraphQL API images"
  is_public   = false
}

resource "scaleway_container_namespace" "graphql_api" {
	project_id = scaleway_account_project.project.id

  name        = "graphql-api"
  description = "Rawkode Academy GraphQL Services"

  environment_variables = {
    LIBSQL_BASE_URL = "rawkodeacademy.turso.io"
  }

  secret_environment_variables = {
    "LIBSQL_TOKEN" = scaleway_secret_version.libsql_token.data
  }

  depends_on = [
		scaleway_secret_version.libsql_token
	]
}
