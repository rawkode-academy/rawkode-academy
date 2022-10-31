#!/usr/bin/env bash
set -xeuo pipefail

kubeadm config images pull
kubeadm init
