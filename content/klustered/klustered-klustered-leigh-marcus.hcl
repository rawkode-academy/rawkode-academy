episode "klustered-klustered-Leigh-Capili-Marcus-Noble" {
    title =  "Leigh Capili vs. Marcus Noble Klustered"
    draft = false 
    show = "klustered"
    scheduled_for = "2022-04-07T17:30:00Z"
    youtube_id = "dr22hR62GXo"
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
    time = "00:01:31"
  }

  chapter "Introduction to klustered" {
    time = "00:03:30"
  }

  chapter "Introduction to the Guests" {
    time = "00:05:15"
  }

  chapter "Leigh Fixing the cluster" {
    time = "00:06:25"
  }

  chapter "Marcus Fixing the cluster" { 
    time = "01:01:50"
  }
  chapter "Closing remarks" { 
    time = "01:44:12"
  }
}
  description = <<-EOF 
  SUMMARY
  This episode of Klustered has Guest Leigh Capili  and Marcus Noble fighting the misconfigured kubeconfig , misconfigured kubelet , restrictions via admission controllers,and limit ranges.
  
  LESSONS LEARNED 
 - Always check whether the Kubeconfig file is correct and point to the right server ip and port
 - Always check for the flags that are passed to the kubelet 
 - Always check for the admission controllers, pod security policy and, limit ranges that are enabled in the cluster
 
  USEFUL COMMANDS
  - We can check for the process that is listening on a particular port by using the `netstat` command and easy mnemonic is `netstat -plant | grep ` 
  - We can check for the running pods using the `crictl pods` command , This command will work even if the api server is not responding
  - We can check for the container running in the node using `crictl ps` command .
  - We can use `ctr -n k8s.io containers ls` command to list the containers running in the node 
  
  ALL THE BREAKS
  
  **Misconfigured Kubeconfig** 
  Fixer initially worked with the kubeconfig file that points to the different port rather than the port where the api server is running ,
  This was fixed by changing to the correct port where the api server is running in the kubeconfig file.
  
  
  **Misconfigured Kubelet**
  After fixing the kubeconfig file, the fixer tried to access the api server using the `kubectl` command , but they notices the api server was not responding , 
  Next they tried to verify if the kubelet is running on the node , they found out the kubelet is also not running on the node , On looking at the logs of the kubelet service `invalid maxFiles 1 must be >= 1`
  This was fixed by removing the flag from the kubelet configuration file present in `var/lib/kubelet/config.yaml`
  
  **Intercepting Admission Controller**
  After fixing the kubeconfig and kubelet , now they are able to access the api server , Next they tried to edit the deployment and update the klustered image to version 2
  But they got an error saying `error : deployments.apps "klustered" could not be patched: Internal error occurred: failed calling webhook "validate.kubernetes.io": Post "https://klustered-webhook.klustered.svc:443/validate?timeout=30s": dial tcp`
  Investigating further they found out there is a admission controller that prevents them from deploying the new version of the image , 
  This was fixed by removing the admission controller from the api server configuration file present in `/etc/kubernetes/manifests/kube-apiserver.yaml`
  
  **Preventing Pod Security policy**
  The fixer next tried to deploy the new version of the image , but they got an another error saying `Error from server (Forbidden): error when creating "klustered.yaml": pods "klustered" is forbidden: unable to validate against any pod security policy`
  This was fixed by removing the pod security policy from the cluster .

  **Limiting limit ranges**
  Further the fixer tried to deploy the new version of the image , but they got an error saying memory limit must be less than or equal to 100Mi
  Investigating further they found out there is a limit range that prevents them from deploying the new version of the image .
  This was fixed by removing the limit ranges from the cluster .
  
  OTHER NOTES 
  1. Bash script to install the necessary tools for debugging the cluster  https://github.com/stealthybox/bashrc-simple
  2. Debugging Kubernetes nodes with crictl https://kubernetes.io/docs/tasks/debug/debug-cluster/crictl/
  EOF 


}