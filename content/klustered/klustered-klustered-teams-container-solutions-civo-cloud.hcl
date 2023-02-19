episode "klustered-klustered-teams-container-solutions-civo-cloud" {
  title            = "Klustered Teams: Container Solutions & Civo Cloud"
  draft            = false
  show             = "klustered"
  live             = true
  scheduled_for    = "2021-07-08T16:30:00Z"
  youtube_id       = "ozbE25Y_rcM"
  youtube_category = 24
  links = [
    "https://rawkode.live/teleport",
    "https://youtu.be/teB22ZuV_z8",
    "https://youtu.be/JzGv36Pcq3g",
    "https://youtu.be/Ps2CQm6_aZU",
    "https://youtu.be/Cp6zvBIo5KM",
    "https://youtu.be/Ju1WmHfK6t8",
    "https://youtu.be/tmsqYWBTxEQ",
    "https://youtu.be/Pd90XGptVec",
    "https://youtu.be/QFxJWPF-QDk",
    "https://youtu.be/1f6KTDo5WEo",
    "https://youtu.be/RGaUhqgrsXE",
    "https://youtu.be/K72fOdbxXu8",
    "https://youtu.be/ysfUgYs4YYY",
    "https://youtu.be/H2227nrkhOg",
    "https://youtu.be/akJCvD0ASmw",
    "https://youtu.be/5Rw7_1Yvm0U",
    "https://youtu.be/4lMxlQ64Z7I",
    "https://youtu.be/IWz1XJnOR_g",
    "https://youtu.be/_BFbrrXKMOM",
    "https://youtu.be/JvgpDTx1AZ0",
    "https://youtu.be/_GZ8UuEZxbY",
    "https://youtu.be/_BFbrrXKMOM",
    "https://youtu.be/z0Lf303tKtQ",
    "https://youtu.be/-k5y2C6HNa0",
    "https://youtu.be/FClIbQ8hdxY",
    "https://twitter.com/rawkode",
    "https://rawkode.live/",
    "https://rawkode.live/chat",
    "https://twitter.com/containersoluti",
    "https://github.com/ContainerSolutions",
    "https://www.container-solutions.com/",
    "https://twitter.com/CivoCloud",
    "https://github.com/civo",
    "https://civo.com/"
  ]

  chapter "Holding screen" {
    time = "00:00:00"
  }

  chapter "Introductions" {
    time = "00:02:00"
  }

  chapter "Team Container Solutions" {
    time = "00:03:00"
  }

  chapter "Team Civo Cloud" {
    time = "00:34:40"
  }

  description = <<-EOF
  ### SUMMARY (Example)
  This epside of Klustered features a team who are no strangers to Kubernetes: Civo cloud and a team who are no strangers to containers: Container Solutions.

  During this episode the Container Solutions relive some problems the Civo team have encountered in the wild, while the Civo team battle network polices , quotas and a clever containerd break. 
  ### LESSONS LEARNED (Example)

  - Alway verify container images using the SHA and tag 
  - Sometimes nework policies are the cause 
  - [Cordons](https://www.google.com/search?client=firefox-b-d&q=kubernetes+cordons) are a great way to isolate nodes when debugging 
  
  ### Useful Commands (Example)
  `cat -t` :  Display non-printing characters (see the -v option), and display tab characters as ‘^I’ 
  `journalctl -xfu <unit>` will continuously monitor the logs for the specified unit and display them in real-time as they are generated.
  `crictl rmi <image id>` can be used to remove container images on a worker node

  ### ALL THE BREAKS (Example)

  Expired Certificates 
  while debugging the control plane fixers discovered that the certificated used on the nodes had expired. 
  
  To resolve this the fixer used the `kubeadm certs renew all` command which renewed all the certificates in the cluster and the kubelet need to be restarted for the changes to take effect. 

  Broken Controller Manager
  After renewing the certificates, fixers noticed that deployments where not being created. 
  To fix this, the fixers had to delete a mutatingwebhookconfiguration that prevented pods from starting.

  Broken Scheduler 
  The `kube-scheduler` is configured via a static manifest, fixers the `kube-scheduler` configuration was not being detected this led to pods not being scheduled.
   
  The fix was to rename the `kube-scheduler` configuration file located at `/etc/kubernetes`.  

  Misconfigured Scheduler  
  While trying to make out what was broken fixers noticed that a deployment was not running. 

  To remedy this fixers had to change the address of the API server which had the wrong port number 

  Falling Deployments
  Fixers noticed deployments were failing to start after the scheduler had been fixed 

  The fix was to delete the [resource quota](https://kubernetes.io/docs/concepts/policy/resource-quotas/) which was limiting the amount of deployments that could exist within the namespace and restart the deployment by deleteing it. 

  Incorrect Klustered Image
  This sneaky break had Containerd pulling the wrong container image for the `klustered` deployment.

  To fix this the Containerd configuration file was updated to point to the right registry.

  Failed Database Connection 
  After solving the mystery of the image, fixers noticed the `klustered` deployment was unable to communicate with the postgres database. 

  The fix was to delete a network policy that prevented the `klustered` pod from communicating with postgres.

  ### Other Notes
  
  - [Configuring Containerd to use a registry mirror](https://github.com/containerd/containerd/blob/main/docs/hosts.md)
EOF

}
