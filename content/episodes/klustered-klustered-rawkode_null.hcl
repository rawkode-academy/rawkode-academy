episode "klustered-klustered-Rawkode-Null-vs-The-Community" {
    title =  "Rawkode & The Null Channel Vs. The Community Klustered"
    draft = false 
    show = "klustered"
    scheduled_for = "2022-04-21T17:30:00Z"
    youtube_id = "yck5Kr-bwxQ"
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
    time = "00:02:02"
  }

  chapter "Introduction to the Guests" {
    time = "00:04:00"
  }

  chapter "Break 1" {
    time = "00:06:11"
  }

  chapter "Break 2" {
    time = "00:26:52"
  }
  chapter "Closing remarks" {
    time = "02:23:50"
  }
}
description = <<-EOF 
  SUMMARY
  This episode of Klustered has David from Rawkode and  Marek Counts from Null Channel tried to fix the cluster that was broken by the community.
  LESSONS LEARNED 
 - Always check whether the binary is tampered or not
 - Always check for the flags that are passed to the kubelet, especially the flags present in the environment file
 - Always check for the files of the configuration files like .bashrc, .vimrc, /etc/passwd
 - Always check for the restriction not only on the clusters but also on the nodes where the cluster is running
 
  USEFUL COMMANDS
 - We can check for the files that were modified recently using the `find /usr/bin/ -mtime -3600 -type f` command 
 - We can check for the contents of the binary using the `strings <binary-name>` command
 - We can use the `sed` command to remove the lines from the file 
 - We can use the `cat -n` command to print the contents of the file along with the line numbers
 - We can use `crictl --runtime-endpoint unix:///run/containerd/containerd.sock rmp --force <container-id>` to remove the container
  
  ALL THE BREAKS
  **Tampered Binary**
  The control plane node has the tampered kubelet and systemd binary . 
  This was fixed by replacing the tampered binary with the working binary.
  
  **Misconfigured Kubelet**
  Next, the fixer found out the kubelet is not in a running state , On looking at the kubelet logs they found the kubelet was configured with   `--file-check-frequency` flag set to 72000 in the configuration file.
  This was fixed by removing the `--file-check-frequency` flag from the kubelet config.
   
   **Restricted shell** 
   On sshing into the control plane node , they dropped into the custom shell with the restricted access 
   This was fixed by replacing the default shell in the `/etc/passwd` file with the `/bin/bash` shell.
  
  **Readonly path** 
  Next the fixer found that the kubelet is not running fine , On looking at the kubelet logs they found out the kubelet was configured with `TemporaryFileSystem` flag with the value set to the etc directory to read only which makes the etc directory read only by the kubelet .
  This was fixed by removing the `TemporaryFileSystem` flag from the kubelet config.
   
  **Misconfigured Kubelet** 
  Again the fixer found that the kubelet is not running  , On looking at the kubelet logs they found out the kubelet was configured with the  `InaccessiblePaths` flag with the value set to the pki directory which prevents from reading the certificates 
  This was fixed by removing the `InaccessiblePaths` flag from the kubelet config.
    
  **Restricting Namespaces**
  Next the fixer found out that the containerd is not able to create new containers, On looking at the containerd logs they found out the error saying containerd couldn't able to create the new child process
  On looking at the namespace limit using the `sysctl -a | grep pid` command they found out that the pid namespace limit is set to 7.
  This was fixed by increasing the pid namespace limit .
  
  **Corrupted Certificates**
  Next the fixer tried to access the api server , but it is not accessible , On looking at the logs of the api server they found out that the api server Certificates are corrupted.
  This was fixed by regenerating the certificates using the `kubeadm init phase certs all` command .

  **Rogue routes**
  Next the fixer found out the worker node is in `NOT READY` state, On sshing into the worker node and looking at the kubelet logs they found out that the kubelet is not able to connect to the api server.
  On looking at the routes in the node they found out the control plane ip is added under the `UNREACHABLE` state .
  This was fixed by removing the route from the node.
  

  **Voilent Vimrc**
  During the fix whenever the fixers tried to edit the file using the `vim` and after saving the file the changes that were made were not reflecting.
  On looking at the vimrc file they found out that the vimrc file has keybindings that override the default keybindings of the save command . 
  This was fixed by removing the vimrc file 

  OTHER NOTES 
  1. Command line arguments for the kubelet file https://kubernetes.io/docs/reference/command-line-tools-reference/kubelet/
  2. Restricted bash manual https://www.gnu.org/software/bash/manual/html_node/The-Restricted-Shell.html
  EOF 

}