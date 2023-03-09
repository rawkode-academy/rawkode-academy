episode "klustered-klustered-Aerospike-vs-PixieLabs" {
    title =  "Klustered Teams - Aerospike & PixieLabs"
    draft = false 
    show = "klustered"
    scheduled_for = "2022-04-13T17:30:00Z"
    youtube_id = "GHsPEffFLlM"
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
    chapter "Holding screen" {
    time = "00:00:00"
  }

  chapter "Introduction to klustered" {
    time = "00:02:00"
  }

  chapter "Introduction to the Team 1" {
    time = "00:04:00"
  }

  chapter "Break 1" {
    time = "00:05:58"
  }

  chapter "Introduction to the Team 2" {
    time = "00:41:38"
  }

  chapter "Break 2" {
    time = "00:46:00"
  }
  chapter "Closing remarks" {
    time = "01:44:56"
  }
}
description = <<-EOF 
  SUMMARY
  This episode of Klustered has the team from Aerospike and  PixieLabs  tried to fix the cluster that was broken by each other.
  LESSONS LEARNED 
 - Always check for the logs of the kubelet and the control plane components
 - Always check for the flags that are passed to the kubelet, containerd components especially lookout for the typo and extra characters
 - If there is a network issue always check for the DNS configuration 
 - Even if the scheduler is not working , we can manually schedule the pods using the `NodeName` field in the pod spec
 
  USEFUL COMMANDS
 - We can use `etcdctl` to interact with the etcd
 - We can restart and look for the logs of the systemd services using the `systemctl restart <service-name>` and `journalctl -u <service-name> | journalctl -flu <service-name> | less` 

  ALL THE BREAKS
  **Restricting etcd RBAC**
  The fixer found out the api server is not up and running and investigating from the logs they found out the api server is not abel to talk to the etcd.
  On investigating further they found out the etcd is configured with the authentication 
  This was fixed by removing the auth using `disable auth` with the etcdctl command.
  
  **Problematic Image Pull**
  Once it is done the fixer able to interact with the cluster Now when they tried to update the image in the deployment they found out the pods with new images are not creating.
  On investigating they found out the imagepullPolicy is set to `Never` in the deployment.
  This was fixed by changing the imagepullPolicy to `Always` in the deployment.
  
  **It is Always DNS**
  After updating the image policy the worker node not able to pull the image
  Next, the fixer sshed into the worker node and try to download the image from the ghcr registry but they got always timeout error.
  On investigating they found out the `etc/hosts` file is modified and the `ghcr.io` is mapped to the some other IP address.
  This was fixed by removing the entry from the `etc/hosts` file.
   
   **Wrong Port** 
   First the fixer found out the kubelet is not running ,
   Next from the kubelet logs they found kubelet was configured with the `--etcd-server` flag set to the wrong port.
   This was fixed by setting the correct port value of 2379 in the `--etcd-server` flag.
  
  **Misconfigured Kubelet** 
  Even after fixing the port,  fixer found that the kubelet is not running  , On looking at the kubelet logs they found out the kubelet was configured with the  `--pod-manifest-path` flag set to the directory which doesn't exist.
  This was fixed by setting the correct value in the  `--pod-manifest-path` flag . 
    
  **Corrupted Manifests**
  Again the kubelet is not running ,the fixer tried to look at the kubelet logs . 
  From the logs they found out the Manifests presents in the `/etc/kubernetes/manifests` directory are corrupted.
  This was fixed by removing/replacing the corrupted manifests from the `/etc/kubernetes/manifests` directory.
  
  **Restricting Kubelet**
  Next the fixer found out only etcd is running from the control plane node .
  On looking at the kubelet config they found out the kubelet was configured with the `--max-pods ` flag set to 1. 
  This was fixed by increasing the `--max-pods ` flag to 110 in the kubelet config.

  **Misconfigured Containerd**
  Next the fixer on looking out the containerd logs they found out that the containerd is not working fine. 
  On looking at the containerd config they found out that the `address` flag is not set correctly .
  This was fixed by setting the `address` flag to the `run/containerd/containerd.sock` in the containerd config.
  

  **Overloaded worker node**
  Next the fixer found out the pod is not creating on the worker node.
  On investigating further they found out the `/run` directory is full.
  This was fixed by removing the files from the `/run` directory.
  
  OTHER NOTES 
  1. ETCD cheat sheet https://www.devops.buzz/public/kubernetes/etcd-cheat-sheet
  2. Kubelet flags https://kubernetes.io/docs/reference/command-line-tools-reference/kubelet/
  EOF 

}