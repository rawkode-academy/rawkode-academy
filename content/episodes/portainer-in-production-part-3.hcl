episode "portainer-in-production-part-3" {
  title            = "Continuously Deploy with GitOps | Portainer in Production "
  draft            = false
  show             = ""
  live             = false
  scheduled_for    = "2023-01-16T20:56:20Z"
  youtube_id       = "62NrTrSzQGc"
  youtube_category = 24
  links = [
    "https://github.com/RawkodeAcademy/portainer-in-production",
    "https://www.youtube.com/playlist?list=PLz0t90fOInA7aRYTguuowv6qrNsMB-zxM",
    "https://www.portainer.io/"
    "https://developer.hashicorp.com/terraform/cdktf",
    "https://docs.portainer.io/admin/environments/add/edge"
  ]

  chapter "Introductions" {
    time = "00:00:00"
  }

  chapter "Overview " {
    time = "00:02:50"
  }

  chapter "Demo" {
    time = "00:8:20"
  }

  chapter "Adding Edge Devices" {
    time = "00:11:45"
  }

  chapter "Adding Edge Stacks" {
    time = "00:13:05"
  }
  chapter "Latency" {
    time = "00:15:00"
  }
  chapter "Deployments" {
    time = "00:17:05"
  }
  chapter "Stack" {
    time = "00:18:25"
  }
  chapter "Edge Jobs" {
    time = "00:19:45"
  }

  description = < < -EOF
  ### SUMMARY
  Portainer is an open-source container management tool that allows users to easily deploy, manage and monitor Docker containers and Kubernetes clusters.

  In this video we through Portainer ' s Edge APIs for administering remote compute nodes with the Portainer agent.

  Using cdktf we'll automate the provisioning of baremetal servers. We'll also take a look at edge devices and stacks. 
  
  Then we will wrap by taking a look at edge jobs and how we can leverage them to perform routine tasks.
  EOF

}
