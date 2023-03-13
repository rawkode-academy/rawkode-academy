episode "portainer-in-production-part-1" {
  title            = "Managing TLS | Portainer in Production "
  draft            = false
  show             = ""
  live             = false
  scheduled_for    = "2022-12-09T17:08:49Z"
  youtube_id       = "VrtBN5pQMo4"
  youtube_category = 24
  links = [
    "https://github.com/RawkodeAcademy/portainer-in-production",
    "https://www.youtube.com/playlist?list=PLz0t90fOInA7aRYTguuowv6qrNsMB-zxM",
    "https://www.portainer.io/",
    "https://certbot.eff.org/",
  ]

  chapter "Introductions" {
    time = "00:00:00"
  }

  chapter "Default Portainer install" {
    time = "00:01:25"
  }

  chapter "Using Certbot to provision X509 certs for Portainer" {
    time = "00:4:30"
  }

  chapter "Configuring Caddy as reverse proxy for Portainer" {
    time = "00:10:30"
  }

  chapter "Conclusion" {
    time = "00:14:08"
  }


  description = < < -EOF
  ### SUMMARY
  Portainer is an open-source container management tool that allows users to easily deploy, manage, and monitor Docker containers and Kubernetes clusters.
  In this video, we will explore different ways to manage TLS on your Portainer deployments.In the first section of this episode, we will take a closer look at the default installation of Portainer with self-signed certificates.We will then delve into the topic of provisioning X509 certificates for Portainer using Certbot, a free and open-source software tool that automates the process of obtaining and installing TLS / SSL certificates.
  We will also explore the use of Caddy, a modern web server that automates HTTPS deployment, to negotiate TLS and use it as a reverse proxy for Portainer.By using Caddy as a reverse proxy, you can offload the SSL / TLS encryption and decryption from Portainer.

  EOF

}
