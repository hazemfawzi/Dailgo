#!/usr/bin/env bash
# Read-only inventory. Does not dump environment variables, keys or Nginx config.
set -eu
printf '\nSystem\n'
cat /etc/os-release
printf '\nCurrent user\n'
id
printf '\nTools\n'
for tool in node nginx docker certbot python3 curl; do command -v "$tool" || true; done
if command -v node >/dev/null; then node --version; fi
printf '\nListening TCP ports\n'
ss -ltn
printf '\nRelevant services\n'
systemctl list-units --type=service --state=running --no-pager | grep -E 'nginx|apache|docker|personal-os|dailgo|node|pm2' || true
printf '\nNginx site filenames\n'
if [ -d /etc/nginx/sites-enabled ]; then ls -l /etc/nginx/sites-enabled; fi
printf '\nExisting Dailgo paths\n'
for path in /srv/personal-os /var/lib/personal-os /etc/personal-os.env /etc/systemd/system/personal-os.service /usr/local/sbin/dailgo-release; do
 if [ -e "$path" ]; then ls -ld "$path"; fi
done
printf '\nSSH public host-key fingerprints (not private keys)\n'
for path in /etc/ssh/ssh_host_*_key.pub; do
 if [ -r "$path" ]; then ssh-keygen -lf "$path"; fi
done
