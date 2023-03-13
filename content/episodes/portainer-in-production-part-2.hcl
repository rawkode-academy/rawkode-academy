episode "portainer-in-production-part-2" {
  title = "Continuously Deploy with GitOps | Portainer in Production "
  draft = false
  show = ""
  live = false
  scheduled_for = "2022-12-09T17:08:49Z"
  youtube_id = "TeF0wEEUd8c"
  youtube_category = 24
  links = [
    "https://github.com/RawkodeAcademy/portainer-in-production",
    "https://www.youtube.com/playlist?list=PLz0t90fOInA7aRYTguuowv6qrNsMB-zxM",
    "https://www.portainer.io/",
    "https://docs.portainer.io/user/docker/stacks",
    "https://www.edgedb.com/",
  ]

  chapter "Introductions" {
    time = "00:00:00"
  }

  chapter "Setting up EdgeDB with docker-compose" {
    time = "00:02:15"
  }

  chapter "Creating a new Portainer stack" {
    time = "00:5:57"
  }

  chapter "Configuring webhooks for stacks" {
    time = "00:12:27"
  }

  chapter "Conclusion" {
    time = "00:14:03"
  }

  
  description = <<- EOF 
   ### SUMMARY
   Portainer is an open-source container management tool that allows users to easily deploy, manage and monitor Docker containers and Kubernetes clusters.
   In this video, we will walk through the process of continuously deploying your application from Git with Portainer Stacks.We will show you how to create a Docker Compose file to deploy EdgeDB containers,once our database is up and running we will create a new Portainer stack to deploy our application.
   Finally, we will configure webhooks for our stacks, so that Portainer will automatically pull the latest changes from our Git repository and redeploy our application whenever there are new updates.
  EOF
    
}
