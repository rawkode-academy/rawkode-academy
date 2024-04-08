#!/usr/bin/env bash
set -xeuo pipefail

## Prepare System for Kubernetes
sed -ri '/\sswap\s/s/^#?/#/' /etc/fstab
swapoff -a
mount -a

cat <<EOF > /etc/sysctl.d/99-kubernetes-cri.conf
net.bridge.bridge-nf-call-iptables  = 1
net.ipv4.ip_forward                 = 1
net.bridge.bridge-nf-call-ip6tables = 1
EOF
sysctl --system

## Install CRI (containerd)
cat <<EOF > /etc/modules-load.d/containerd.conf
overlay
br_netfilter
EOF

modprobe overlay
modprobe br_netfilter

apt-get install --yes socat ebtables cloud-utils prips containerd

systemctl daemon-reload
systemctl enable containerd
systemctl start containerd

sleep 5

containerd config default | tee /etc/containerd/config.toml >/dev/null 2>&1
sed -i 's/SystemdCgroup \= false/SystemdCgroup \= true/g' /etc/containerd/config.toml
