episode "rawkode-live-managing-linux-in-real-time-with-saltstack" {
  title = "Managing Linux in Real Time with SaltStack"
  draft = false
  show = "rawkode-live"
  live = true
  scheduled_for = "2020-09-16T14:00:00Z"
  youtube_id = "E6LoyB1l8QQ"
  youtube_category = 24
  links = [
    "https://twitter.com/rawkode",
    "https://rawko.de/office-hours",
    "https://twitter.com/w8emv",
    "https://saltstack.com/",
    "https://packet.com/"
  ]

  chapter "Holding Screen" {
    time = "00:00:00"
  }

  chapter "Introductions" {
    time = "00:02:00"
  }

  chapter "Deploying a heterogeneous cluster (Machines and OS) with SaltStack on Packet’s bare metal with Pulumi and TypeScript" {
    time = "00:05:00"
  }

  chapter "Extending SaltStack with Packet’s metadata as grains" {
    time = "00:17:30"
  }

  chapter "Covering SaltStack’s Vocabulary: Grains and Pillars" {
    time = "00:18:30"
  }

  chapter "Binding SaltStack to the private IPv4 address" {
    time = "00:22:30"
  }

  chapter "Ed has a cool use-case for Tailscale, connecting his SaltStack nodes over disparate private networks" {
    time = "00:24:00"
  }

  chapter "Connecting to our SaltStack master / Checking it works!" {
    time = "00:26:30"
  }

  chapter "Approving our first minion key" {
    time = "00:28:00"
  }

  chapter "Oops! Our provisioning on the CentOS machine failed. Lets fix it (Fuck you, Python 2)" {
    time = "00:29:20"
  }

  chapter "Introduction to SaltStack CLI" {
    time = "00:37:00"
  }

  chapter "Executing remote commands on minions" {
    time = "00:38:20"
  }

  chapter "Targeting minions" {
    time = "00:39:00"
  }

  chapter "Querying grains" {
    time = "00:40:00"
  }

  chapter "Fixing the Ubuntu machine (Fuck you, Python 2)" {
    time = "00:52:00"
  }

  chapter "SaltStack communication method. Spoiler: event driven through zero-mq" {
    time = "00:56:10"
  }

  chapter "Python / wheel on Arm needs compiled, so it’s a bit slower." {
    time = "00:58:40"
  }

  chapter "Installing software to our minions through SaltStack’s package module" {
    time = "00:59:30"
  }

  chapter "Looking at state modules" {
    time = "00:07:00"
  }

  chapter "Writing our first state using the cron state module" {
    time = "00:09:00"
  }

  chapter "Running a single state from the file root" {
    time = "00:13:00"
  }

  chapter "Adding the file state module to our first state: creating a directory and writing a file" {
    time = "00:14:00"
  }

  chapter "Provisioning all our machines with SSH keys from our custom grain data" {
    time = "00:26:45"
  }
}
