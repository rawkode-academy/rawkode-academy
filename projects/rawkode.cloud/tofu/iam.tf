resource "scaleway_iam_application" "salt_master" {
  name        = "${var.cluster_name}-salt-master"
  description = "Salt master service account for minion validation"
  tags        = var.tags
}

resource "scaleway_iam_policy" "salt_master" {
  name           = "${var.cluster_name}-salt-master-policy"
  application_id = scaleway_iam_application.salt_master.id

  rule {
    project_ids          = [local.scaleway_project_id]
    permission_set_names = ["ElasticMetalReadOnly"]
  }
}

resource "scaleway_iam_api_key" "salt_master" {
  application_id     = scaleway_iam_application.salt_master.id
  description        = "Salt master runtime key"
  default_project_id = local.scaleway_project_id
}
