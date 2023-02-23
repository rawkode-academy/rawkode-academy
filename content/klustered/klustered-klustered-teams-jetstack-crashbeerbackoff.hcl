episode "klustered-klustered-teams-jetstack-crashbeerbackoff" {
    title =  "Klustered Teams: Jetstack & CrashBeerBackOff"
    draft = false 
    show = "klustered"
    scheduled_for = "2022-08-12T06:03:18Z"
    youtube_id = "Hognhpy3XyA"
    youtube_category = 24
    links = [
    "https://rawkode.live/teleport",
    "https://twitter.com/rawkode",
    "https://rawkode.live/",
    "https://rawkode.live/chat",
    "https://kubernetes.io/",
    "https://twitter.com/kubernetesio",
    "https://github.com/kubernetes/kubernetes"
    ]
  description = <<-EOF 
  SUMMARY
  This episode of Klustered has teams Jetstack and CrashBeerBackOff fighting the API server,troubleshooting iptables and dabbling into `nft`

  LESSONS LEARNED
  - [nftables](https://wiki.nftables.org/wiki-nftables/index.php/What_is_nftables%3F) (`nft`) is the modern Linux kernel packet classification framework, it Simplifies dual stack IPv4/IPv6 administration and has better support for dynamic ruleset updates.
  - notice something odd? Don't hesitate to call it out, one of the breaks in this episode could have been fixed a lot faster if this was done.
  
  USEFUL COMMANDS
  The `ps` command + `grep` is a great way to quickly search for process currently running 

  ALL THE BREAKS

  Broken control plane
  Fixers quickly realized something was limiting the pods ablility to print logs,  this was quickly resolved by editing the `max_container_log_line_size` in the containerd configuration file , this lead them to discover the next break. 

  Broken Kubecontroller 
  When fixers tried to update the deployment they noticed deployments were not being submitted.

  To fix this the deployment controller was enabled via the static manifests. 

  Outdated deplyoments 
  after enabling the deployment controller the fixers noticed the changes that deployment were not being applied.

  The cause of this was a man in the middle proxy which kept applying a [dry run](https://kubernetes.io/docs/reference/kubectl/conventions/#kubectl-run) to the request. 

  Missing Certs 
  while investigating one of the broken nodes, the fixers noticed the kubelet was unable to load CA certificates. 

  The fix was to rename the certificates file. 

  Broken API server 
  When the fixers tried to run kubectl commands ,the api server seemed to be refusing connections. 

  The fix was to delete a cron job which kept changing the secure port for the API server via the static manifests 

  EOF 

  
}
