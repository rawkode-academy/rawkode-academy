episode "rawkode-live-building-php-applications-with-docker-docker-compose-and-kubernetes" {
  title = "Building PHP Applications with Docker, Docker Compose, and Kubernetes"
  draft = false
  show = "rawkode-live"
  live = true
  scheduled_for = "2020-09-08T11:00:00Z"
  youtube_id = "LteLJ99oJMs"
  youtube_category = 24
  links = [
    "https://twitter.com/rawkode",
    "https://rawko.de/office-hours",
    "https://twitter.com/CiaranMcNulty",
    "https://gitlab.com/rawkode/php-examples/-/tree/main/docker-and-kubernetes"
  ]

  chapter "Holding screen" {
    time = "00:00:00"
  }

  chapter "Introductions" {
    time = "00:00:50"
  }

  chapter "Creating a Slim Framework application" {
    time = "00:09:30"
  }

  chapter "Checking out the docker-compose.yml ... oh, did I write this? 😮" {
    time = "00:14:50"
  }

  chapter "Adding a damn .editorconfig" {
    time = "00:30:15"
  }

  chapter "Replacing the PHP dev server with nginx and php-fpm" {
    time = "00:31:15"
  }

  chapter "Ditching compose 3.x for 2.x: leveraging complex dependencies with health-checks" {
    time = "00:55:00"
  }

  chapter "Adding a multi-layer Dockerfile for build cache goodness" {
    time = "00:11:00"
  }

  chapter "Deploying our application to Kubernetes" {
    time = "00:29:00"
  }
}
