package talos

import (
	"fmt"
	"strings"
)

const defaultOSDisk = "/dev/nvme0n1"
const defaultDataDisk = "/dev/nvme1n1"

// PivotParams holds parameters for generating the Talos pivot script.
type PivotParams struct {
	TalosVersion   string
	TalosSchematic string
	OSDisk         string
	DataDisk       string
}

// BuildPivotScript generates a cloud-init compatible script that pivots
// a running Ubuntu system to Talos Linux. Translated from rawkode.cloud2/talos.sh.
func BuildPivotScript(params PivotParams) string {
	osDisk := params.OSDisk
	if osDisk == "" {
		osDisk = defaultOSDisk
	}
	dataDisk := params.DataDisk
	if dataDisk == "" {
		dataDisk = defaultDataDisk
	}
	imageURL := fmt.Sprintf("https://factory.talos.dev/image/%s/%s/metal-amd64.raw.zst",
		params.TalosSchematic, params.TalosVersion)

	return fmt.Sprintf(`#!/usr/bin/env bash
set -xeuo pipefail

TALOS_VERSION="%s"
TALOS_IMAGE_URL="%s"
OS_DISK="%s"
DATA_DISK="%s"

echo "==> Pivoting to Talos Linux ${TALOS_VERSION}"
echo "    Image: ${TALOS_IMAGE_URL}"
echo "    OS disk: ${OS_DISK}"
echo "    Data disk: ${DATA_DISK}"

# 1. Install dependencies
echo "==> Installing dependencies"
apt-get update -qq && apt-get install -y -qq zstd gdisk efibootmgr

# 2. Stage binaries + shared libs to tmpfs (survives dd of root filesystem)
echo "==> Staging binaries to /dev/shm"
STAGE="/dev/shm/talos-stage"
mkdir -p "${STAGE}"/{bin,lib}

for bin in sgdisk efibootmgr; do
	src="$(command -v "${bin}")"
	cp "${src}" "${STAGE}/bin/"
	ldd "${src}" | awk '/=>/{print $3}' | while read -r lib; do
		cp -n "${lib}" "${STAGE}/lib/" 2>/dev/null || true
	done
done

# 3. Download Talos image to tmpfs
echo "==> Downloading Talos image"
curl -fSL -o /dev/shm/talos.raw.zst "${TALOS_IMAGE_URL}"

# 4. Clear stale EFI boot variables (prevents boot failures on reinstall)
echo "==> Clearing EFI boot variables"
for entry in /sys/firmware/efi/efivars/Boot0*; do
	[ -e "${entry}" ] || continue
	chattr -i "${entry}" 2>/dev/null || true
	rm -f "${entry}"
done

# 5. Wipe data disk boot signatures (prevents fallback to Ubuntu)
if [ -b "${DATA_DISK}" ]; then
	echo "==> Wiping boot signatures on ${DATA_DISK}"
	wipefs -a "${DATA_DISK}" || true
fi

# 6. Write Talos image to OS disk (root filesystem destroyed after this point)
echo "==> Writing Talos to ${OS_DISK}"
zstd -d /dev/shm/talos.raw.zst --stdout | dd of="${OS_DISK}" bs=4M status=progress conv=fsync

# --- Root filesystem is gone. Only staged binaries on /dev/shm survive. ---

# 7. Fix GPT backup header (image is smaller than disk, backup GPT is at wrong offset)
echo "==> Fixing GPT backup header"
LD_LIBRARY_PATH="${STAGE}/lib" "${STAGE}/bin/sgdisk" -e "${OS_DISK}"

# 8. Create EFI boot entry for Talos
echo "==> Creating EFI boot entry"
EFI_PART=$(LD_LIBRARY_PATH="${STAGE}/lib" "${STAGE}/bin/sgdisk" -p "${OS_DISK}" | awk '/EF00/{print $1}')
LD_LIBRARY_PATH="${STAGE}/lib" "${STAGE}/bin/efibootmgr" --create --disk "${OS_DISK}" --part "${EFI_PART}" --label "Talos" --loader '\EFI\BOOT\BOOTX64.EFI'

# 9. Hard reboot via sysrq (systemd is gone, normal reboot won't work)
echo "==> Rebooting into Talos maintenance mode"
echo b > /proc/sysrq-trigger
`, params.TalosVersion, imageURL, osDisk, dataDisk)
}

// BuildCloudInit wraps the pivot script in a cloud-config YAML suitable
// for Scaleway bare metal user data.
func BuildCloudInit(params PivotParams) string {
	pivotScript := BuildPivotScript(params)

	return fmt.Sprintf(`#cloud-config
write_files:
  - path: /usr/local/bin/talos-pivot.sh
    owner: root:root
    permissions: "0755"
    content: |
%s
runcmd:
  - [ bash, -lc, "/usr/local/bin/talos-pivot.sh" ]
`, indentLines(pivotScript, "      "))
}

func indentLines(s, prefix string) string {
	lines := strings.Split(s, "\n")
	for i := range lines {
		lines[i] = prefix + lines[i]
	}
	return strings.Join(lines, "\n")
}
