#!/usr/bin/env bash
# Run once as an administrator AFTER reviewing inspect-vps.sh output.
# Creates only Dailgo resources; never upgrades Node, edits Nginx, or changes firewall rules.
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run as an administrator with sudo.' >&2; exit 1; }
[[ $# == 1 ]] || { echo 'Usage: bootstrap-deploy.sh /absolute/path/to/deployment-key.pub' >&2; exit 1; }
for tool in useradd install ss systemctl openssl visudo python3 ssh-keygen grep sed getent; do command -v "$tool" >/dev/null; done
public_key=$1
[[ $public_key == /* && -f $public_key ]]
[[ $(wc -l < "$public_key") -le 1 ]]
grep -Eq '^ssh-ed25519 [A-Za-z0-9+/]+=*( .*)?$' "$public_key"
ssh-keygen -lf "$public_key" >/dev/null
node_binary=/opt/dailgo/node/bin/node
[[ -x $node_binary ]] || { echo 'Install a dedicated Node 24 runtime at /opt/dailgo/node first.' >&2; exit 1; }
"$node_binary" -e "if(Number(process.versions.node.split('.')[0])!==24)throw Error('Node 24 required');require('node:sqlite')"
for account in personal-os dailgo-deploy; do
 if getent passwd "$account" >/dev/null; then echo "Existing account: $account; inspect before proceeding." >&2; exit 1; fi
done
for path in /srv/personal-os /var/lib/personal-os /var/lib/dailgo-deploy /etc/personal-os.env /usr/local/lib/dailgo /usr/local/sbin/dailgo-release /etc/sudoers.d/dailgo-deploy /etc/systemd/system/personal-os.service /etc/systemd/system/personal-os-backup.service /etc/systemd/system/personal-os-backup.timer; do
 if [[ -e $path || -L $path ]]; then echo "Existing path: $path; inspect before proceeding." >&2; exit 1; fi
done
[[ -z $(ss -H -ltn '( sport = :8787 )') ]] || { echo 'Port 8787 is already in use.' >&2; exit 1; }
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
for file in release.py verify-release.py dailgo-release personal-os.service personal-os-backup.service personal-os-backup.timer; do test -f "$script_dir/$file"; done
useradd --system --home-dir /var/lib/personal-os --no-create-home --shell /usr/sbin/nologin personal-os
useradd --system --home-dir /var/lib/dailgo-deploy --no-create-home --shell /bin/bash dailgo-deploy
install -d -o root -g root -m 755 /srv/personal-os /srv/personal-os/releases /usr/local/lib/dailgo /var/lib/dailgo-deploy /var/lib/dailgo-deploy/.ssh
install -d -o personal-os -g personal-os -m 700 /var/lib/personal-os
install -d -o dailgo-deploy -g dailgo-deploy -m 700 /var/lib/dailgo-deploy/incoming
{ printf 'restrict '; cat "$public_key"; } > /var/lib/dailgo-deploy/.ssh/authorized_keys
chmod 644 /var/lib/dailgo-deploy/.ssh/authorized_keys
install -o root -g root -m 644 "$script_dir/release.py" "$script_dir/verify-release.py" /usr/local/lib/dailgo/
install -o root -g root -m 755 "$script_dir/dailgo-release" /usr/local/sbin/dailgo-release
umask 077
{
 printf 'NODE_ENV=production\nAPP_ORIGIN=https://dailgo.decoderz.dev\nPORT=8787\nPERSONAL_OS_DB=/var/lib/personal-os/workspace.sqlite\nPERSONAL_OS_SETUP_TOKEN='
 openssl rand -hex 32
} > /etc/personal-os.env
for file in personal-os.service personal-os-backup.service; do
 sed "s@/usr/bin/node@${node_binary}@g" "$script_dir/$file" > "/etc/systemd/system/$file"
done
install -o root -g root -m 644 "$script_dir/personal-os-backup.timer" /etc/systemd/system/personal-os-backup.timer
sudoers_file=$(mktemp /etc/sudoers.d/.dailgo-XXXXXX)
trap 'rm -f "$sudoers_file"' EXIT
printf 'dailgo-deploy ALL=(root) NOPASSWD: /usr/local/sbin/dailgo-release *\n' > "$sudoers_file"
chmod 440 "$sudoers_file"
visudo -cf "$sudoers_file"
mv "$sudoers_file" /etc/sudoers.d/dailgo-deploy
systemctl daemon-reload
systemctl enable personal-os.service personal-os-backup.timer
printf '\nDailgo accounts and deployment helper installed. No application or Nginx service was started.\n'
printf 'The first successful GitHub deployment starts Dailgo. Configure HTTPS separately, then enable the backup timer.\n'
