episode "Klustered Teams - PolarSignals & Pulumi" {
    title =  "Klustered Teams - PolarSignals & Pulumi"
    draft = false 
    show = "klustered"
    scheduled_for = "2022-03-16T17:30:00Z"
    youtube_id = "jGtR-9SEc1c"
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
    time = "00:01:23"
  }

  chapter "Introduction to the Team 1" {
    time = "00:02:28"
  }

  chapter "Break 1" {
    time = "00:05:46"
  }


  chapter "Closing Remarks of Team 1" {
    time = "00:50:05"
  }

    chapter "Introduction to Team 2" {
    time = "00:51:34"
  }

  chapter "Break 2" {
    time = "00:57:10"
  }
  chapter "Closing remarks" {
    time = "01:36:40"
  }
}
description = <<-EOF 
  SUMMARY
  This episode of Klustered has the team from Polar Signals and  Pulumi tries to fix the cluster that was broken by each other.
  LESSONS LEARNED 
 - Always check for the images deployed in the cluster 
 - Always check fo typos and errors in the configuration in the files like configmaps. 
 - Always check for the api server ip address that is passed to the control plane component like the scheduler and controller  
 - We can manually schedule the pods using the `NodeName` field in the pod spec
  USEFUL COMMANDS
 - We can use `diff` command to check the difference between the files
 - We can use `drill` command to check the dns resolution
 - We can make the node unschedulable by using the `kubectl cordon <node-name>` command
 - We can enable the auto-completion in the bash shell by using the `source <(kubectl completion bash)` command

  ALL THE BREAKS
  
  **Problematic Probes**
  The fixer found out the pod is in the `CrashLoopBackOff` state. On investigating further 
  They found out that the readiness probe and liveness probe is configured to the wrong endpoint
  This was fixed by changing the endpoint in the probes.
  
  **Misconfigured Server IP **
  Next the fixer found out the pod is still in the `CrashLoopBackOff` state. 
  On investigating further they found out the controller manager is not working fine which prevents the updation of the pod.
  They found out the controller manager is configured with a different api server IP address.
  This was fixed by setting the correct API server IP address in the controller manager config.
  
  **It is Always DNS**
 After fixing the controller manager, the fixer found out that the pod is now working fine 
 Next they tried to access the application, On accessing the application they found out the application is not able to reach the Postgres database.
 On investigating further they found out that the kubelet in the worker node is configured with the cluster domain 
 This was fixed by setting the correct cluster domain `cluster.local` in the kubelet config.
   
   **Malicious Metric Server**
   Next, the fixer found out the pod is not created but the deployment is created.
   On investigating further the found out the replica count is set to 0 in the deployment. 
   They tried to fix it by setting the replica count to 1 in the deployment.
   But the fixer found out the pod is still not created.
   On investigating further they found out there is a metric server in the cluster with the custom image which prevents the updation of the replica count.
   This was fixed by removing the metric server from the cluster.

   **Corrupted CoreDNS**
   Next the fixer found out the klustered application is not able to talk to the backend postgres. 
   On investigating further they found out the core dns configmap is configured with the wrong forwarding rules 
   This was fixed by setting the correct forwarding rules in the configmap `forward . /etc/resolv.conf`.
  
  OTHER NOTES 
1. https://linux.die.net/man/1/drill
2. https://kubernetes.io/docs/tasks/administer-cluster/dns-custom-nameservers/

}