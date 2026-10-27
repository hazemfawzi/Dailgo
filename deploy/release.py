#!/usr/bin/python3
"""Root-owned deployment controller. Never execute uploaded scripts as root."""
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
import urllib.request

spec = importlib.util.spec_from_file_location('verify_release', Path(__file__).with_name('verify-release.py'))
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)
RELEASE_ID = re.compile(r'[0-9a-f]{40}-[0-9]+-[0-9]+')


def service(action):
    subprocess.run(['/usr/bin/systemctl', action, 'personal-os.service'], check=True)


def backup():
    subprocess.run(['/usr/bin/systemctl', 'start', 'personal-os-backup.service'], check=True)


def healthy(expected_commit=None):
    request = urllib.request.Request('http://127.0.0.1:8787/api/health', headers={
        'Host': 'dailgo.decoderz.dev', 'X-Forwarded-Proto': 'https'})
    with urllib.request.urlopen(request, timeout=2) as response:
        if json.load(response).get('status') != 'production':
            return False
    if expected_commit is None:
        return True
    request = urllib.request.Request('http://127.0.0.1:8787/release.json', headers={
        'Host': 'dailgo.decoderz.dev', 'X-Forwarded-Proto': 'https'})
    with urllib.request.urlopen(request, timeout=2) as response:
        return json.load(response).get('commit') == expected_commit


def atomic_link(path, target):
    temporary = path.with_name(path.name + '.next')
    if temporary.exists() or temporary.is_symlink():
        raise ValueError('Unexpected temporary deployment link; inspect it first')
    temporary.symlink_to(target)
    os.replace(temporary, path)


def copy_regular(source, destination, limit):
    # Incoming paths belong to an unprivileged uploader; never follow their links.
    descriptor = os.open(source, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_size > limit:
            raise ValueError('Invalid or oversized uploaded file')
        with destination.open('xb') as output:
            total = 0
            while block := stream.read(1024 * 1024):
                total += len(block)
                if total > limit:
                    raise ValueError('Upload exceeds size limit')
                output.write(block)


class Deployer:
    def __init__(self, base=Path('/srv/personal-os'), incoming=Path('/var/lib/dailgo-deploy/incoming'),
                 database=Path('/var/lib/personal-os/workspace.sqlite'),
                 service_fn=service, backup_fn=backup, health_fn=healthy, attempts=20, pause=1):
        self.base, self.incoming, self.database = map(Path, (base, incoming, database))
        self.service, self.backup, self.health = service_fn, backup_fn, health_fn
        self.attempts, self.pause = attempts, pause

    def ready(self, expected_commit=None):
        for _ in range(self.attempts):
            try:
                if self.health(expected_commit):
                    return True
            except (OSError, ValueError):
                pass
            time.sleep(self.pause)
        return False

    def deploy(self, release_id):
        if not RELEASE_ID.fullmatch(release_id):
            raise ValueError('Invalid release ID')
        releases = self.base / 'releases'
        releases.mkdir(parents=True, exist_ok=True, mode=0o755)
        target, current = releases / release_id, self.base / 'current'
        if target.exists() or target.is_symlink():
            raise ValueError('Release already exists; use a new workflow attempt')
        if current.exists() and not current.is_symlink():
            raise ValueError('Current path must be a managed symlink')
        previous = current.resolve(strict=True) if current.is_symlink() else None
        if previous and (previous.parent != releases.resolve() or not previous.is_dir()):
            raise ValueError('Current release is outside the managed release directory')
        with tempfile.TemporaryDirectory(prefix='.deploy-', dir=self.base) as temporary:
            staging = Path(temporary)
            archive = staging / 'archive.tar.gz'
            checksum = staging / 'archive.sha256'
            copy_regular(self.incoming / (release_id + '.tar.gz'), archive, 50 * 1024 * 1024)
            copy_regular(self.incoming / (release_id + '.tar.gz.sha256'), checksum, 1024)
            expected = checksum.read_text().strip()
            match = re.fullmatch(r'([0-9a-f]{64})  ' + re.escape(release_id + '.tar.gz'), expected)
            with archive.open('rb') as stream:
                digest = hashlib.file_digest(stream, 'sha256').hexdigest()
            if not match or digest != match[1]:
                raise ValueError('Archive checksum mismatch')
            extracted = staging / 'extracted'
            extracted.mkdir(mode=0o755)
            verifier.extract(archive, extracted)
            metadata = json.loads((extracted / 'dist/release.json').read_text())
            if metadata.get('commit') != release_id.split('-')[0]:
                raise ValueError('Package commit does not match requested release')
            # Backup must succeed before touching a running application.
            if self.database.exists():
                self.backup()
            extracted.rename(target)
        atomic_link(current, target)
        try:
            self.service('restart')
            if not self.ready(release_id.split('-')[0]):
                raise RuntimeError('New release health check failed')
        except Exception:
            if previous:
                atomic_link(current, previous)
                self.service('restart')
                if not self.ready():
                    raise RuntimeError('Deployment failed and previous release is unhealthy') from None
            else:
                self.service('stop')
                current.unlink()
            raise
        if previous:
            atomic_link(self.base / 'previous', previous)
        print('Deployed release:', release_id)


def main():
    if os.geteuid() != 0:
        raise PermissionError('Run through the restricted deployment sudo rule')
    if len(sys.argv) != 2:
        raise ValueError('Usage: dailgo-release COMMIT-RUN-ATTEMPT')
    with open('/run/lock/dailgo-deploy.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        for directory in (Path('/srv/personal-os'), Path('/srv/personal-os/releases')):
            info = directory.lstat()
            if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
                raise ValueError('Deployment directories must be root-owned and not writable by other users')
        Deployer().deploy(sys.argv[1])


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        sys.exit(str(error))
