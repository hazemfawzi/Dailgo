import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('release', ROOT / 'deploy/release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
COMMIT = 'a' * 40
IDENTITY = COMMIT + '-123-1'


def package(path, additions=None, corrupt=False):
    files = {name: b'fixture' for name in ('server/index.mjs', 'server/domain.mjs', 'server/resources.mjs', 'dist/index.html', 'package.json')}
    files['dist/release.json'] = json.dumps({'commit': COMMIT}).encode()
    files.update(additions or {})
    manifest = ''.join(hashlib.sha256(value).hexdigest() + '  ' + name + '\n' for name, value in files.items())
    files['SHA256SUMS'] = manifest.encode()
    if corrupt:
        files['dist/index.html'] = b'tampered'
    with tarfile.open(path, 'w:gz') as archive:
        directory = tarfile.TarInfo('./')
        directory.type = tarfile.DIRTYPE
        archive.addfile(directory)
        for name, value in files.items():
            entry = tarfile.TarInfo('./' + name)
            entry.size = len(value)
            entry.mode = 0o644
            archive.addfile(entry, io.BytesIO(value))


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.base, self.incoming = self.root / 'app', self.root / 'incoming'
        (self.base / 'releases').mkdir(parents=True)
        self.incoming.mkdir()
        self.database = self.root / 'database.sqlite'
        self.events = []

    def upload(self, **kwargs):
        path = self.incoming / (IDENTITY + '.tar.gz')
        package(path, **kwargs)
        (self.incoming / (IDENTITY + '.tar.gz.sha256')).write_text(hashlib.sha256(path.read_bytes()).hexdigest() + '  ' + path.name + '\n')
        return path

    def previous(self):
        old = self.base / 'releases/old'
        old.mkdir()
        (self.base / 'current').symlink_to(old)
        return old

    def deployer(self, health=lambda _commit: True, backup=None, service=None):
        return release.Deployer(self.base, self.incoming, self.database,
                                service_fn=service or (lambda action: self.events.append(action)),
                                backup_fn=backup or (lambda: self.events.append('backup')),
                                health_fn=health, attempts=1, pause=0)

    def test_verified_release_backs_up_and_switches_atomically(self):
        old = self.previous()
        self.database.touch()
        self.upload()
        commits = []
        self.deployer(health=lambda commit: commits.append(commit) or True).deploy(IDENTITY)
        self.assertEqual(self.events, ['backup', 'restart'])
        self.assertEqual(commits, [COMMIT])
        self.assertEqual((self.base / 'current').resolve(), self.base / 'releases' / IDENTITY)
        self.assertEqual((self.base / 'previous').resolve(), old)
        self.assertEqual((old).is_dir(), True)

    def test_unhealthy_release_restores_previous_without_restoring_database(self):
        old = self.previous()
        self.database.write_text('preserve database')
        self.upload()
        outcomes = iter([False, True])
        with self.assertRaisesRegex(RuntimeError, 'health check failed'):
            self.deployer(health=lambda _commit: next(outcomes)).deploy(IDENTITY)
        self.assertEqual((self.base / 'current').resolve(), old)
        self.assertEqual(self.database.read_text(), 'preserve database')
        self.assertEqual(self.events, ['backup', 'restart', 'restart'])

    def test_failed_first_release_stops_only_its_own_service(self):
        self.upload()
        with self.assertRaisesRegex(RuntimeError, 'health check failed'):
            self.deployer(health=lambda _commit: False).deploy(IDENTITY)
        self.assertFalse((self.base / 'current').is_symlink())
        self.assertEqual(self.events, ['restart', 'stop'])

    def test_backup_failure_preserves_running_release(self):
        old = self.previous()
        self.database.touch()
        self.upload()
        def unavailable():
            raise RuntimeError('backup failed')
        with self.assertRaisesRegex(RuntimeError, 'backup failed'):
            self.deployer(backup=unavailable).deploy(IDENTITY)
        self.assertEqual((self.base / 'current').resolve(), old)
        self.assertFalse((self.base / 'releases' / IDENTITY).exists())
        self.assertEqual(self.events, [])

    def test_outer_checksum_tamper_is_rejected_before_service_changes(self):
        path = self.upload()
        with path.open('ab') as output:
            output.write(b'tampered')
        with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
            self.deployer().deploy(IDENTITY)
        self.assertEqual(self.events, [])

    def test_inner_checksum_tamper_is_rejected_before_service_changes(self):
        self.upload(corrupt=True)
        with self.assertRaisesRegex(ValueError, 'Checksum mismatch'):
            self.deployer().deploy(IDENTITY)
        self.assertEqual(self.events, [])

    def test_traversal_cannot_escape_staging(self):
        self.upload(additions={'../outside': b'forbidden'})
        with self.assertRaisesRegex(ValueError, 'Invalid package path'):
            self.deployer().deploy(IDENTITY)
        self.assertFalse((self.base / 'outside').exists())
        self.assertEqual(self.events, [])

    def test_symlink_upload_is_never_followed(self):
        path = self.upload()
        original = path.with_suffix('.original')
        path.rename(original)
        path.symlink_to(original)
        with self.assertRaises(OSError):
            self.deployer().deploy(IDENTITY)
        self.assertEqual(self.events, [])

    def test_archive_links_are_rejected(self):
        path = self.upload()
        with tarfile.open(path, 'w:gz') as archive:
            link = tarfile.TarInfo('dist/escape')
            link.type, link.linkname = tarfile.SYMTYPE, '/etc'
            archive.addfile(link)
        checksum = self.incoming / (IDENTITY + '.tar.gz.sha256')
        checksum.write_text(hashlib.sha256(path.read_bytes()).hexdigest() + '  ' + path.name)
        with self.assertRaisesRegex(ValueError, 'Unsupported file type'):
            self.deployer().deploy(IDENTITY)
        self.assertEqual(self.events, [])

    def test_mismatched_commit_cannot_be_deployed(self):
        self.upload(additions={'dist/release.json': b'{"commit":"wrong"}'})
        with self.assertRaisesRegex(ValueError, 'commit does not match'):
            self.deployer().deploy(IDENTITY)
        self.assertEqual(self.events, [])

    def test_existing_release_and_invalid_identifiers_are_preserved(self):
        target = self.base / 'releases' / IDENTITY
        target.mkdir()
        with self.assertRaisesRegex(ValueError, 'already exists'):
            self.deployer().deploy(IDENTITY)
        for invalid in ('../escape', ';reboot', '-f', 'main', ''):
            with self.assertRaisesRegex(ValueError, 'Invalid release ID'):
                self.deployer().deploy(invalid)
        self.assertTrue(target.is_dir())
        self.assertEqual(self.events, [])

    def test_restart_failure_rolls_back(self):
        old = self.previous()
        self.upload()
        def restart(action):
            self.events.append(action)
            if len(self.events) == 1:
                raise RuntimeError('restart failed')
        with self.assertRaisesRegex(RuntimeError, 'restart failed'):
            self.deployer(service=restart).deploy(IDENTITY)
        self.assertEqual((self.base / 'current').resolve(), old)
        self.assertEqual(self.events, ['restart', 'restart'])
