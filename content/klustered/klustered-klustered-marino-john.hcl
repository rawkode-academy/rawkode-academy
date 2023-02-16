episode "klustered-klustered-Marino-Wijay-John-Anderson" {
    title =  "Marino Wijay & John Anderson Klustered"
    draft = false 
    show = "klustered"
    scheduled_for = "2022-05-12"
    youtube_id = "51b2imc6OPM"
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
    time = "00:00:57"
  }

  chapter "Introduction to the Guests" {
    time = "00:03:11"
  }

  chapter "Marino Fixing the cluster" {
    time = "00:05:30"
  }

  chapter "John Fixing the cluster" {
    time = "00:52:57"
  }
  chapter "Closing remarks" {
    time = "01:34:46"
  }
}
  description = <<-EOF 
  SUMMARY
  This episode of Klustered has Guest Marino Wijay and John Anderson fighting the misconfigured kubecontext, misconfigured kubelet , misconfigured kubescheduler , misconfigured etcd and misconfigured CNI(Cilium)
  
  LESSONS LEARNED 
 - Always check for the kubectl context to make sure you are connected to the correct cluster
 - Always check for the kubelet configuration including the extra args 
 - Always make sure that control plane components are configured with the correct certificates , even if the scheduler certificates are configured with the controller manager certificates, the scheduler will not be able to connect to the API server
 - Always check for the certificate's validity and verify it has not tampered with miscellaneous data 
 - Always check for the version of the control plane components and make sure they are compatible with the each other
  
  USEFUL COMMANDS
  - We can check for the file which takes more space in the disk by using the `du -d1 -h` command 
  - We can find the systemd configuration file by using the `systemctl cat` command
  - We can search for the file in which the string is present by using the `grep -r` command
  
  ALL THE BREAKS
  
  **Misconfigured Kubecontext** 
  Fixer initially tried to fix the cluster in the wrong context 
  This was fixed by switching the context to the correct cluster `kubectl config use-context production`
  
  **Low disk space** 
  After switching to the right context , on looking at the nodes, the nodes were in the `NotReady` state , On describing the nodes , the fixer found that the node was in low disk space
  This was fixed by sshing into the node and deleting the files which were taking more space in the disk
  
  **Misconfigured Kubelet**
  After fixing the low disk space issue , the fixer found that the node was still in the `NotReady` state , On describing the node , they got `Invalid capacity 0 on image filesystem` error. 
  On investigating further, the fixer found that the kubelet was configured with the wrong extra args
  This was fixed by removing the file that contains the extra args 
  
  **Tampered certificates**
  The fixer tried to access the api server using the `kubectl` command , but they notices the api server was not responding , On looking at the logs of the api server container, they found that one of the certificates has tampered with miscellaneous data
  This was fixed by removing the miscellaneous data from the certificate
  
  **Incompatible control plane components**
  The fixer tried to see the pods running in the cluster , but they got an error saying `kubelet network is not ready` .
  This was fixed by reinstalling the kubelet and the containerd with the correct version
  
  OTHER NOTES 
  1. Bash script to install the necessary tools for debugging the cluster https://gist.githubusercontent.com/sontek/5b31111d56d30a48dca764fe72fd9b01/raw/e8c51a1e50a5d039b9270e7930c69913c5b87aac/klustered.sh 
  EOF 


}