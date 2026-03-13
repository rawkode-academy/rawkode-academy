# OpenEBS Mayastor

This package installs OpenEBS Replicated PV Mayastor through Flux and creates one `DiskPool` per production node.

Notes:

1. The `openebs-system` Flux `Kustomization` installs the chart and waits for the `HelmRelease` to become healthy before `openebs-pools` applies any `DiskPool` custom resources.
2. Both production node pools assume the dedicated data disk is the second NVMe slot at `aio:///dev/disk/by-path/pci-0000:07:00.0-nvme-1`. Verify that path on every node with `talosctl get disks -o yaml` before adding more pools or changing hardware.
3. The default storage class becomes `openebs-single-replica`, which is what Zot is configured to use.
4. Loki, Alloy, and the local LVM/ZFS/Rawfile engines are disabled so this stays focused on CSI storage.

Verification:

1. `kubectl -n flux-system get kustomization openebs-system openebs-pools`
2. `kubectl -n flux-system get helmrelease openebs`
3. `kubectl -n openebs get pods`
4. `kubectl -n openebs get diskpool`
5. `kubectl get storageclass openebs-single-replica`
