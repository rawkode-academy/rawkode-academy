episode "Introduction to Cilium" {
  draft = false
  show = "rawkode-live"
  published_at = "2020-09-24T13:00:00Z"
  youtube_id = "LF-itMcCkWs"
  youtube_category = 24
  links = [
    "https://twitter.com/rawkode",
    "https://rawko.de/office-hours",
    "https://twitter.com/errordeveloper",
    "https://cilium.io/"
  ]

  chapter "Holding screen" {
    time = "00:00:00"
  }

  chapter "Introductions" {
    time = "00:03:05"
  }

  chapter "Installing Cilium with the Quickstart" {
    time = "00:04:30"
  }

  chapter "Running the Cilium connectivity tests" {
    time = "00:08:50"
  }

  chapter "Connectivity test failures: IPAM range is full" {
    time = "00:11:50"
  }

  chapter "Changing the IPv4 CIDR" {
    time = "00:15:00"
  }

  chapter "Deleting the Cilium pods to force a config reload" {
    time = "00:16:00"
  }

  chapter "Using the Cilium CLI to fetch Cilium status" {
    time = "00:18:50"
  }

  chapter "Lets just delete everything and start again 😅" {
    time = "00:20:20"
  }

  chapter "Lets try minikube ..." {
    time = "00:26:30"
  }

  chapter "What is the Container Networking Interface (CNI)?" {
    time = "00:30:30"
  }

  chapter "Advantages of Cilium" {
    time = "00:35:00"
  }

  chapter "Deploying the Star Wars demo to our cluster" {
    time = "00:39:30"
  }

  chapter "What is Hubble?" {
    time = "00:41:00"
  }

  chapter "Back to Star Wars demo" {
    time = "00:42:00"
  }

  chapter "Debugging Cilum Endpoints / What are Cilium Endpoints" {
    time = "00:43:30"
  }

  chapter "Lets delete minikube and start again 😅" {
    time = "00:45:50"
  }

  chapter "Now CoreDNS can't get an IP address 😀" {
    time = "00:48:00"
  }

  chapter "Lets go back to our Packet cluster" {
    time = "00:49:00"
  }

  chapter "Deploying Cilium again, this time with Helm" {
    time = "00:55:00"
  }

  chapter "IPAM range is full 😅" {
    time = "00:58:00"
  }

  chapter "Lets reboot all our nodes ..." {
    time = "00:06:00"
  }

  chapter "Summary of what has gone wrong thus far" {
    time = "00:06:20"
  }

  chapter "Lets delete Cilium node CRDs " {
    time = "00:16:00"
  }

  chapter "Cilium is working ... but DNS isn't " {
    time = "00:17:00"
  }
}
