#!/usr/bin/env bash
set -euo pipefail

vm_name="${MAKTAB_ACCEPTANCE_VM:-windows}"
command_name="${1:-status}"

if ! command -v VBoxManage >/dev/null 2>&1; then
  echo "VBoxManage is required." >&2
  exit 1
fi

vm_state() {
  VBoxManage showvminfo "$vm_name" --machinereadable |
    sed -n 's/^VMState="\([^"]*\)"/\1/p'
}

require_powered_off() {
  local state
  state="$(vm_state)"
  if [[ "$state" != "poweroff" && "$state" != "saved" ]]; then
    echo "VM '$vm_name' must be shut down first (current state: $state)." >&2
    exit 1
  fi
}

snapshot_exists() {
  VBoxManage snapshot "$vm_name" list --machinereadable 2>/dev/null |
    grep -Fq "SnapshotName=\"$1\""
}

case "$command_name" in
  status)
    VBoxManage showvminfo "$vm_name" --machinereadable |
      grep -E '^(name|VMState|memory|cpus|GuestOSType|GuestAdditionsVersion|SnapshotFolder)='
    guest_additions="$(VBoxManage guestproperty get "$vm_name" /VirtualBox/GuestAdd/Version 2>/dev/null || true)"
    if [[ "$guest_additions" == Value:* ]]; then
      echo "GuestAdditionsVersion=\"${guest_additions#Value: }\""
    fi
    VBoxManage snapshot "$vm_name" list --details 2>/dev/null || true
    ;;
  snapshot-pre-additions)
    require_powered_off
    name="win10-clean-pre-guest-additions"
    if snapshot_exists "$name"; then
      echo "Snapshot already exists: $name"
    else
      VBoxManage snapshot "$vm_name" take "$name" \
        --description "Clean Windows 10 before Guest Additions and internal trust material"
    fi
    ;;
  snapshot-ready)
    require_powered_off
    name="win10-acceptance-ready"
    if snapshot_exists "$name"; then
      echo "Snapshot already exists: $name"
    else
      VBoxManage snapshot "$vm_name" take "$name" \
        --description "Patched Windows 10 with Guest Additions; no Maktab test CA installed"
    fi
    ;;
  share-artifacts)
    require_powered_off
    artifact_directory="${2:-}"
    if [[ -z "$artifact_directory" || "$artifact_directory" != /* ]]; then
      echo "Pass a real absolute artifact directory, for example /var/tmp/maktab-acceptance." >&2
      exit 1
    fi
    artifact_directory="$(realpath -m "$artifact_directory")"
    repository_root="$(realpath "$(dirname "${BASH_SOURCE[0]}")/../..")"
    user_home="$(realpath "${HOME}")"
    if [[
      "$artifact_directory" == "$repository_root"
      || "$artifact_directory" == "$repository_root/"*
      || "$artifact_directory" == "$user_home"
      || "$artifact_directory" == "$user_home/"*
    ]]; then
      echo "Refusing to share the repository or home directory." >&2
      exit 1
    fi
    mkdir -p "$artifact_directory"
    VBoxManage sharedfolder remove "$vm_name" --name MaktabAcceptance 2>/dev/null || true
    VBoxManage sharedfolder add "$vm_name" --name MaktabAcceptance \
      --hostpath "$artifact_directory" --readonly --automount
    echo "Configured read-only VM share: $artifact_directory"
    ;;
  restore-ready)
    require_powered_off
    if ! snapshot_exists "win10-acceptance-ready"; then
      echo "Snapshot win10-acceptance-ready does not exist." >&2
      exit 1
    fi
    VBoxManage snapshot "$vm_name" restore "win10-acceptance-ready"
    ;;
  *)
    echo "Usage: $0 {status|snapshot-pre-additions|snapshot-ready|share-artifacts ABS_DIR|restore-ready}" >&2
    exit 2
    ;;
esac
