episode "klustered-klustered-Skyscanner-vs-Digital-Ocean" {
    title =  "Klustered Teams: DigitalOcean & Skyscanner"
    draft = false 
    show = "klustered"
    scheduled_for = "2021-07-29T17:30:00Z"
    youtube_id = "JvgpDTx1AZ0"
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
    time = "00:01:46"
  }

  chapter "Introduction to the Guests" {
    time = "00:02:59"
  }

  chapter "Break 1" {
    time = "00:05:47"
  }

  chapter "Break 2" {
    time = "00:45:01"
  }

}
description = <<-EOF 
  SUMMARY
  This episode of Klustered has Skyscanner and Digital Ocean team tries to fix the cluster that was broken by each other.
  LESSONS LEARNED 
 - Always check whether the certificates that are used in the cluster are valid or not
 - Always check for the presence of the admission controllers in the cluster
 - Always verify all the control plane components are present and running fine 
 - Even if the cluster is not reachable , we can still able to see the logs running in the node from the /var/log/containers directory
 - The simplest way to restart the deployment is to add or remove the labels from the deployment yaml 
 - If the cluster doesn't allow you to delete the pods, you can simply set the replica count to 0
 
  USEFUL COMMANDS
  - We can use `kubeadm certs renew all` to renew the kubernetes certificates
  - We can use `dig +search <service-name>' inside the pod to check the DNS resolution inside the pod and verify the pod can able to talk to the service 
  
  ALL THE BREAKS

  **Corrupted Certificates**
  Initially the fixers tries to access the api server, but it was not accessible 
  On looking at the logs they found of the api server they found out the api server certificates are corrupted.
  This was fixed by renewing the certificates using the `kubeadm certs renew all` command.
  
  **Broken Etcd**
  When they tried to access the api server they frequently got the timeout error for every 3 minutes 
  On investigating further they found out the etcd was not working properly ,on looking at the logs they found it was configured with the wrong probes
  This was fixed by removing the wrong probes from the etcd manifest.
  
  **Malicious Mutation admission controllers**
  After fixing this they were able to access the application successfully next they updated the image from version 1 to version 2 but still the application points to the older version. 
  On investigating further they found out the Mutation webhook revert the changes. 
  This was fixed by removing the mutation webhook from the cluster. 
  
  **Unreachable API Server**
 Initially, the fixer tries to access the cluster using the kubectl command but it was not working.
    On investigating further they found out the api server is not working properly.
    This was fixed by restarting the API server by killing the process.
 
 **Missing Kuberproxy**
Next, they updated the application from version 1 to version 2 but they found out that version 2 of the application is not able to talk to the database 
On investigating further they found out the cillium is configured with the `kube-proxy-replacement:disabled` which prevents the Kube proxy from running.
This was fixed by changing the  value from`kube-proxy-replacement:disabled` to `kube-proxy-replacement:probe`

  OTHER NOTES 
  1. Kuberproxy Docs https://docs.cilium.io/en/v1.9/gettingstarted/kubeproxy-free/ 
EOF 

}